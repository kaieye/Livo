/**
 * Data hydration layer - loads data from backend into memory store before React renders.
 * This avoids blocking the UI with serial IPC calls during bootstrap.
 */

import { useSettingsStore } from '../store/settings-store'
import { useFeedStore } from '../store/feed-store'
import { useActionsStore } from '../store/actions-store'
import { useAuthStore } from '../store/auth-store'
import { useEntryStore } from '../store/entry-store'
import { recordAppMetric } from '../lib/performance-metrics'
import { writeDefaultHomeSnapshotCache } from '../lib/reader-snapshot-cache'
import {
  buildListCacheKey,
  cacheEntrySnapshots,
  setCachedListResult,
} from '../lib/entry-cache'
import type { AppHydratePayload } from '../../../shared/types'

const DEFAULT_INITIAL_SNAPSHOT_LIMIT = 10

function logStartupTiming(label: string, startTime: number): number {
  const duration = performance.now() - startTime
  console.log(`[Startup] ${label} ${duration.toFixed(0)}ms`)
  recordAppMetric(label, duration)
  return duration
}

/**
 * Restore the last persisted home snapshot synchronously before IPC hydration.
 * This mirrors Folo's local read-model-first startup: the shell can show cached
 * reader content immediately, then backend hydration reconciles it afterward.
 */
export function hydrateStartupCache(): boolean {
  const startTime = performance.now()
  const snapshot = useEntryStore.getState().hydrateSnapshotCache({
    limit: DEFAULT_INITIAL_SNAPSHOT_LIMIT,
  })
  const duration = logStartupTiming('hydrate.startupCache', startTime)

  if (snapshot) {
    console.log('[Hydrate] Startup cache restored:', {
      entryCount: snapshot.entries.length,
      feedCount: snapshot.feeds.length,
      duration: Math.round(duration),
    })
  }

  return !!snapshot
}

export interface HydrateResult {
  settings: any
  feeds: any[]
  rules: any[]
  session: any | null
  initialSnapshot: any | null
  timings: {
    settings: number
    feeds: number
    rules: number
    auth: number
    total: number
  }
}

/**
 * Load all critical application data from backend in parallel and write directly to stores.
 * This runs before React renders, so stores are pre-populated when components mount.
 */
export async function hydrateDataToMemory(): Promise<HydrateResult> {
  const startTime = performance.now()
  const timings = {
    settings: 0,
    feeds: 0,
    rules: 0,
    auth: 0,
    total: 0,
  }

  // 单次批量 IPC 替代多个独立请求，减少往返和结构化克隆成本。
  // Web 端或旧桥接不支持时降级为独立请求。
  let settings: any = null
  let feeds: any[] = []
  let sessionData: any = null
  let initialSnapshot: AppHydratePayload['initialSnapshot'] = null

  try {
    const batchStart = performance.now()
    const batch = await window.api.app.hydrate()
    const batchDuration = logStartupTiming('hydrate.batch', batchStart)

    settings = batch.settings
    feeds = batch.feeds
    sessionData = batch.auth
    initialSnapshot = batch.initialSnapshot ?? null
    timings.settings = batchDuration
    timings.feeds = batchDuration
    timings.auth = batchDuration
  } catch {
    console.warn(
      '[Hydrate] Batch hydration failed, falling back to individual calls',
    )
    const [settingsResult, feedsResult, sessionResult] =
      await Promise.allSettled([
        (async () => {
          const s = await window.api.settings.get()
          return s
        })(),
        (async () => {
          const f = await window.api.feeds.list()
          return f
        })(),
        (async () => {
          const s = await window.api.auth.checkSession()
          return s
        })(),
      ])
    settings =
      settingsResult.status === 'fulfilled' ? settingsResult.value : null
    feeds = feedsResult.status === 'fulfilled' ? feedsResult.value : []
    sessionData =
      sessionResult.status === 'fulfilled' ? sessionResult.value : null
  }

  // 动作规则来自 localStorage，不需要 IPC。
  const rules: any[] = []
  timings.rules = 0

  // 直接写入 store，避免调用 action 带来额外副作用。
  if (settings) {
    useSettingsStore.setState({ settings, isLoaded: true })
  }

  if (feeds && feeds.length > 0) {
    useFeedStore.setState({ feeds, isLoading: false })
  }

  if (initialSnapshot) {
    applyInitialSnapshot(initialSnapshot)
  }

  // 动作规则自行处理 localStorage hydrate。
  useActionsStore.getState().loadRules()

  // 认证状态 hydrate。
  if (sessionData?.success && sessionData?.isValid && sessionData?.user) {
    useAuthStore.setState({
      user: sessionData.user,
      isAuthenticated: true,
      isSessionChecked: true,
      isLoading: false,
    })
  } else {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isSessionChecked: true,
      isLoading: false,
    })
  }

  timings.total = performance.now() - startTime

  console.log('[Hydrate] Data hydration complete:', {
    settings: !!settings,
    feedCount: feeds.length,
    ruleCount: rules.length,
    authenticated: sessionData?.success && sessionData?.isValid,
    timings,
  })

  return {
    settings,
    feeds,
    rules,
    session: sessionData,
    initialSnapshot,
    timings,
  }
}

export async function hydrateInitialSnapshot(): Promise<void> {
  const startTime = performance.now()
  try {
    const snapshot = await window.api.reader.snapshot({
      limit: DEFAULT_INITIAL_SNAPSHOT_LIMIT,
      compact: true,
      maxContentLength: 520,
    })
    logStartupTiming('hydrate.initialSnapshot', startTime)
    applyInitialSnapshot(snapshot)
  } catch (error) {
    console.warn('[Hydrate] Initial snapshot hydration failed', error)
  }
}

function applyInitialSnapshot(
  initialSnapshot: NonNullable<AppHydratePayload['initialSnapshot']>,
): void {
  const pageSize =
    initialSnapshot.entries.length || DEFAULT_INITIAL_SNAPSHOT_LIMIT
  writeDefaultHomeSnapshotCache(
    {
      scope: { type: 'all' },
      limit: pageSize,
      compact: true,
      maxContentLength: 520,
    },
    initialSnapshot,
  )
  setCachedListResult(buildListCacheKey({}), {
    entries: initialSnapshot.entries,
    hasMore: initialSnapshot.nextCursor !== null,
  })
  useEntryStore.setState((state) =>
    state.entries.length > 0
      ? state
      : {
          entries: cacheEntrySnapshots(initialSnapshot.entries),
          isLoading: false,
          isLoadingMore: false,
          hasMoreEntries: initialSnapshot.nextCursor !== null,
          paginationSource: 'snapshot',
          paginationQueryKey: JSON.stringify({
            snapshot: true,
            feedId: '',
            feedIds: [],
            starred: false,
            unreadOnly: false,
            pageSize,
          }),
          paginationOptions: {
            feedId: undefined,
            feedIds: undefined,
            starred: undefined,
            unreadOnly: undefined,
          },
          paginationPageSize: pageSize,
          snapshotNextCursor: initialSnapshot.nextCursor,
        },
  )
}
