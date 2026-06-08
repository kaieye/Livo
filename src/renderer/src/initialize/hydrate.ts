/**
 * Data hydration layer - loads data from backend into memory store before React renders.
 * This avoids blocking the UI with serial IPC calls during bootstrap.
 */

import { useSettingsStore } from '../store/settings-store'
import { useFeedStore } from '../store/feed-store'
import { useActionsStore } from '../store/actions-store'
import { useAuthStore } from '../store/auth-store'
import { recordAppMetric } from '../lib/performance-metrics'

export interface HydrateResult {
  settings: any
  feeds: any[]
  rules: any[]
  session: any | null
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

  try {
    const batchStart = performance.now()
    const batch = await window.api.app.hydrate()
    const batchDuration = performance.now() - batchStart
    recordAppMetric('hydrate.batch', batchDuration)

    settings = batch.settings
    feeds = batch.feeds
    sessionData = batch.auth
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
    timings,
  }
}
