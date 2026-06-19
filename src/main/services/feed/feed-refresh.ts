import { BrowserWindow } from 'electron'
import { getEventBus } from '../system/event-bus'
import { getDb } from '../../database'
import type { CleanupOptions } from '../../database'
import { getFeedImageUrl } from './feed-utils'
import { settingsProvider } from '../system/settings-provider'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../shared/discover-data'
import type { Feed, RefreshRunItemResult } from '../../../shared/types/index'
import { FeedViewType } from '../../../shared/types/index'
import {
  queueVideoDurationEnrich,
  enrichAllVideoFeeds,
} from '../video/video-duration'
import {
  resolveFeedPayload,
  prefetchServerFeedCache,
  getNormalizedFeedUrlForCache,
} from './feed-source-provider'
import {
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeFeedUrl,
} from './rsshub-url'
import { resolveFeedAvatar } from './feed-avatar'
import {
  pickBestFeedAvatar,
  sanitizeExistingFeedAvatarForRefresh,
} from './feed-avatar-policy'
import { formatFeedTitle } from './feed-title'
import { logWarnQuiet } from '../system/logger'
import {
  getBootstrapRefreshTimeoutMs,
  getRefreshTimeoutMs,
  isBilibiliVideoFeedUrl,
  isInstagramUserFeedUrl,
  isSlowFeedUrl,
} from './feed-route-policy'
import {
  getNextAutoRefreshDelayMs,
  shouldBackOffFeed,
  withTimeout,
} from './feed-backoff-policy'
import { isAbortError, throwIfAborted } from '../../utils/abort-signal'
import {
  isKnownInstagramUpstreamFailure,
  mapFeedRefreshError,
} from './feed-refresh-error'
import { reconcileFeedView } from './feed-view'
import { appendRefreshLog } from '../system/refresh-log-store'
import { runConcurrencyPool } from '../../utils/concurrency-pool'
import { queueFeverSyncAccount } from '../fever/fever-sync'
import {
  FEED_BOOTSTRAP_REFRESH_TASK,
  FEED_REFRESH_ALL_TASK,
  FEED_REFRESH_SINGLE_TASK,
  type FeedBootstrapRefreshTaskPayload,
} from '../system/task-contracts'
import { getLocalTaskRunner } from '../system/task-runner-service'
import type { TaskRunContext } from '../system/task-runner'
import { runLoggedTask } from '../system/task-operation'
import { ingestParsedFeedEntries } from '../entry/entry-ingestion-pipeline'
import { USER_OPERATION_KEYS } from '../../../shared/user-operations'

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let autoRefreshGeneration = 0
const RECOMMENDED_CATEGORY = 'Recommended'

function isVideoDurationEnrichmentEnabled(): boolean {
  return !!settingsProvider.get().data?.enrichVideoDuration
}

/** Default data-maintenance constants (overridden by settings at call site) */
const DEFAULT_FRESHNESS_TTL_MINUTES = 10
const AUTO_REFRESH_MIN_DELAY_MS = 1000

/**
 * Get optimal concurrency level based on feed characteristics.
 * PERF: Slow feeds (Instagram/Bilibili) need lower concurrency to avoid blocking the queue.
 */
function getOptimalConcurrency(
  feeds: Feed[],
  userConcurrency?: number,
): number {
  if (userConcurrency) return userConcurrency

  const hasSlowFeeds = feeds.some((feed) => isSlowFeedUrl(feed.url))

  // Reduce concurrency when slow feeds are present to prevent blocking
  if (hasSlowFeeds) return 4

  const feedCount = feeds.length
  if (feedCount < 10) return Math.min(feedCount, 6)
  if (feedCount < 50) return 8
  return 12
}

/**
 * Sort feeds by priority for optimal refresh order.
 * PERF: Prioritize feeds that are likely to succeed quickly.
 * Priority order:
 * 1. Feeds with fewer errors (more likely to succeed)
 * 2. Feeds that haven't been fetched recently (more stale)
 * 3. Non-slow feeds before slow feeds
 */
function sortFeedsByPriority(feeds: Feed[]): Feed[] {
  return [...feeds].sort((a, b) => {
    // 1. Prioritize feeds with fewer errors
    if (a.errorCount !== b.errorCount) {
      return a.errorCount - b.errorCount
    }

    // 2. Prioritize older feeds (haven't been fetched recently)
    const aLastFetched = a.lastFetched || 0
    const bLastFetched = b.lastFetched || 0
    if (aLastFetched !== bLastFetched) {
      return aLastFetched - bLastFetched
    }

    // 3. Prioritize non-slow feeds (Instagram/Bilibili are slow)
    const aIsSlow = isSlowFeedUrl(a.url)
    const bIsSlow = isSlowFeedUrl(b.url)
    if (aIsSlow !== bIsSlow) {
      return aIsSlow ? 1 : -1
    }

    return 0
  })
}

export interface RefreshOptions {
  /** Minutes - feeds fetched more recently than this are skipped */
  freshnessTTL?: number
  /** Number of feeds to fetch in parallel */
  concurrency?: number
  /** Force refresh even if feed is fresh */
  force?: boolean
  /** Optional override of data cleanup options */
  cleanup?: CleanupOptions
  /** Optional external cancellation signal for foreground callers. */
  signal?: AbortSignal
}

export interface RefreshProgressEvent {
  feedId: string
  feedTitle: string
  success: boolean
  newEntries: number
  completed: number
  total: number
  done: boolean
}

export interface RefreshAllResult {
  totalFeeds: number
  refreshedCount: number
  failedCount: number
  failedFeedTitles: string[]
  totalNewEntries: number
  items: RefreshRunItemResult[]
}

export function startAutoRefresh(
  intervalMinutes: number,
  mainWindow: BrowserWindow | null,
  options?: RefreshOptions,
): void {
  stopAutoRefresh()
  const generation = autoRefreshGeneration + 1
  autoRefreshGeneration = generation
  let shouldRunInitialDurationSweep = true
  const scheduleIntervalMinutes =
    Number.isFinite(options?.freshnessTTL) && (options?.freshnessTTL ?? 0) > 0
      ? Math.max(intervalMinutes, options?.freshnessTTL ?? intervalMinutes)
      : intervalMinutes

  const notifyUpdated = (newEntries: number): void => {
    if (newEntries > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('feeds:updated', { newEntries })
    }
  }

  const scheduleNext = (): void => {
    if (generation !== autoRefreshGeneration || intervalMinutes <= 0) return

    const receiveRecommended = !!settingsProvider.get().general.showRecommended
    const feeds = getDb()
      .feeds.getAllFeeds()
      .filter(
        (feed) => receiveRecommended || feed.category !== RECOMMENDED_CATEGORY,
      )
    const delayMs = getNextAutoRefreshDelayMs(
      feeds,
      Date.now(),
      scheduleIntervalMinutes,
    )
    if (delayMs === null) return

    refreshTimer = setTimeout(
      () => {
        refreshTimer = null
        void runAndSchedule()
      },
      Math.max(AUTO_REFRESH_MIN_DELAY_MS, delayMs),
    )
  }

  const runAndSchedule = async (): Promise<void> => {
    try {
      const result = await refreshAllFeeds(options)
      if (generation !== autoRefreshGeneration) return
      if (shouldRunInitialDurationSweep) {
        shouldRunInitialDurationSweep = false
        if (isVideoDurationEnrichmentEnabled()) {
          enrichAllVideoFeeds().catch(() => {})
        }
      }
      notifyUpdated(result.totalNewEntries)
    } catch (error) {
      console.warn('[refresh] auto refresh failed', error)
    } finally {
      scheduleNext()
    }
  }

  // 启动阶段只安排下一次到期刷新，避免开窗时执行一次不必要的全量任务。
  scheduleNext()
}

export function stopAutoRefresh(): void {
  autoRefreshGeneration++
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Refresh a single feed with conditional GET support.
 * Returns the number of new entries, or -1 if skipped (still fresh).
 */
export async function refreshSingleFeed(
  feed: Feed,
  options?: {
    force?: boolean
    logOperation?: boolean
    serverCacheHit?: import('./feed-cache-client').FeedCacheHit
    signal?: AbortSignal
  },
): Promise<number> {
  const { promise } = runLoggedTask({
    contract: FEED_REFRESH_SINGLE_TASK,
    payload: { feedId: feed.id, force: !!options?.force },
    handler: (_payload, context) =>
      runRefreshSingleFeed(feed, options, context),
    operationKey: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
    metadata: {
      feedId: feed.id,
      feedTitle: feed.title,
      force: !!options?.force,
    },
    log: options?.logOperation !== false,
    target: { id: feed.id, label: feed.title },
    details: {
      queued: { force: !!options?.force },
      succeeded: (newEntries) => ({ newEntries }),
    },
  })
  return promise
}

async function runRefreshSingleFeed(
  feed: Feed,
  options:
    | {
        force?: boolean
        serverCacheHit?: import('./feed-cache-client').FeedCacheHit
        signal?: AbortSignal
      }
    | undefined,
  context?: TaskRunContext,
): Promise<number> {
  throwIfAborted(options?.signal)
  context?.reportProgress({
    completed: 0,
    total: 1,
    message: feed.title,
    data: { feedId: feed.id },
  })

  if (feed.provider === 'fever') return 0
  const now = Date.now()
  const rsshubInstance =
    settingsProvider.get().general.rsshubInstance?.trim() ||
    DEFAULT_RSSHUB_INSTANCE
  const normalizedFeedUrl = normalizeFeedUrl(feed.url, rsshubInstance)

  try {
    throwIfAborted(options?.signal)
    // 更新 RSSHub 用户路由的 limit，后续刷新直接使用规范化 URL。
    const feedUrlToStore = ensureTwitterUserFeedLimit(
      ensureInstagramUserFeedLimit(feed.url, 100),
      120,
    )
    if (feedUrlToStore !== feed.url) {
      getDb().feeds.updateFeed(feed.id, { url: feedUrlToStore })
      feed = { ...feed, url: feedUrlToStore }
    }

    const result = await withTimeout(
      resolveFeedPayload(feed, {
        force: options?.force,
        serverCacheHit: options?.serverCacheHit,
        signal: options?.signal,
      }),
      getRefreshTimeoutMs(feed.url),
      normalizedFeedUrl,
      options?.signal,
    )
    throwIfAborted(options?.signal)

    // 304 Not Modified - no need to parse entries
    if (result.notModified || !result.parsed) {
      getDb().feeds.updateFeed(feed.id, {
        lastFetched: now,
        lastRefreshStatus: 'succeeded',
        lastRefreshAttemptedAt: now,
        lastRefreshError: undefined,
        lastRefreshRawError: undefined,
        errorCount: 0,
        etag: result.etag || feed.etag,
        lastModified: result.lastModified || feed.lastModified,
      })
      context?.reportProgress({
        completed: 1,
        total: 1,
        message: feed.title,
        data: { feedId: feed.id, newEntries: 0 },
      })
      return 0
    }

    const parsed = result.parsed

    const parsedItems = (parsed.items || []) as Array<Record<string, any>>
    const parsedFeedImage = getFeedImageUrl(parsed)
    const existingFeedImage = sanitizeExistingFeedAvatarForRefresh(
      feed.imageUrl,
      parsedFeedImage,
      parsedItems,
    )
    const feedImageUrl = await resolveFeedAvatar(
      normalizedFeedUrl,
      parsedFeedImage,
      existingFeedImage,
      parsed.link || feed.siteUrl,
    )
    throwIfAborted(options?.signal)
    const selectedFeedAvatar = pickBestFeedAvatar(
      feed.url,
      existingFeedImage,
      feedImageUrl,
    )

    getDb().feeds.updateFeed(feed.id, {
      title: formatFeedTitle(normalizedFeedUrl, parsed.title, feed.title),
      description: parsed.description,
      // Keep avatars fresh when upstream exposes a newer image, while still
      // avoiding regressions back to placeholder/default assets.
      imageUrl: selectedFeedAvatar,
      lastFetched: now,
      lastRefreshStatus: 'succeeded',
      lastRefreshAttemptedAt: now,
      lastRefreshError: undefined,
      lastRefreshRawError: undefined,
      errorCount: 0,
      etag: result.etag,
      lastModified: result.lastModified,
      ...(reconcileFeedView(feed.url, feed.view) !== feed.view
        ? { view: reconcileFeedView(feed.url, feed.view) }
        : {}),
    })

    // IMPORTANT:
    // Do incremental upsert for all feeds, including Instagram/Picnob mirror routes.
    // Full replacement can permanently drop history when upstream temporarily returns
    // only a short window (e.g. 8 recent items) or degraded single-photo entries.
    // Database identity merge keeps duplicates under control while preserving richer
    // historical entries and multi-photo media arrays.
    const ingestionResult = await ingestParsedFeedEntries({
      feed,
      items: parsedItems,
      authorAvatarSeed: selectedFeedAvatar || feedImageUrl,
      parsedFeedLink: parsed.link,
      now,
      replaceExisting: isBilibiliVideoFeedUrl(feed.url),
    })
    throwIfAborted(options?.signal)
    const newCount = ingestionResult.addedCount

    if (
      isVideoDurationEnrichmentEnabled() &&
      feed.view === FeedViewType.Videos
    ) {
      queueVideoDurationEnrich(feed.id).catch(() => {})
    }

    context?.reportProgress({
      completed: 1,
      total: 1,
      message: feed.title,
      data: { feedId: feed.id, newEntries: newCount },
    })
    return newCount
  } catch (error) {
    if (isAbortError(error)) throw error
    const knownInstagramFailure =
      isInstagramUserFeedUrl(feed.url) && isKnownInstagramUpstreamFailure(error)
    const refreshMessage = `[refresh] failed: ${feed.title} (${normalizedFeedUrl})`
    if (knownInstagramFailure) {
      logWarnQuiet(refreshMessage, error)
    } else {
      console.warn(refreshMessage, error)
    }
    const refreshError = mapFeedRefreshError(error, {
      knownInstagramFailure,
    })
    getDb().feeds.updateFeed(feed.id, {
      lastRefreshStatus: 'failed',
      lastRefreshAttemptedAt: now,
      lastRefreshError: refreshError.userMessage,
      lastRefreshRawError: refreshError.rawMessage,
      errorCount: feed.errorCount + 1,
      lastFetched: now,
    })
    context?.reportProgress({
      completed: 1,
      total: 1,
      message: feed.title,
      data: { feedId: feed.id, newEntries: 0 },
    })
    return 0
  }
}

export async function refreshAllFeeds(
  options: RefreshOptions & {
    onProgress?: (event: RefreshProgressEvent) => void
  } = {},
): Promise<RefreshAllResult & { runId: string }> {
  throwIfAborted(options.signal)
  const { runId, promise } = runLoggedTask({
    contract: FEED_REFRESH_ALL_TASK,
    payload: { force: !!options.force },
    handler: (_payload, context) => runRefreshAllFeeds(options, context),
    operationKey: USER_OPERATION_KEYS.FEED_REFRESH_ALL,
    metadata: { force: !!options.force },
    reuseActiveDedupe: true,
    details: {
      queued: { force: !!options.force },
      succeeded: (result) => ({
        refreshedCount: result.refreshedCount,
        failedCount: result.failedCount,
        totalNewEntries: result.totalNewEntries,
      }),
    },
  })
  const result = await promise
  throwIfAborted(options.signal)
  return { ...result, runId }
}

async function runRefreshAllFeeds(
  options: RefreshOptions & {
    onProgress?: (event: RefreshProgressEvent) => void
  },
  context?: TaskRunContext,
): Promise<RefreshAllResult> {
  throwIfAborted(options.signal)
  const allFeeds = getDb().feeds.getAllFeeds()
  const receiveRecommended = !!settingsProvider.get().general.showRecommended
  const feeds = receiveRecommended
    ? allFeeds
    : allFeeds.filter((f) => f.category !== RECOMMENDED_CATEGORY)
  const freshnessTTL =
    (options.freshnessTTL ?? DEFAULT_FRESHNESS_TTL_MINUTES) * 60 * 1000
  const force = options.force ?? false
  const now = Date.now()
  const settingsCleanup: CleanupOptions = {
    entriesPerFeed: settingsProvider.get().data?.entriesPerFeed ?? 128,
    maxEntryAgeDays: settingsProvider.get().data?.maxEntryAgeDays ?? 90,
  }
  const cleanupOptions = options.cleanup ?? settingsCleanup

  // Filter feeds that need refreshing (respect freshness TTL)
  const staleFeeds = force
    ? feeds
    : feeds.filter((feed) => {
        if (shouldBackOffFeed(feed, now, force)) return false
        if (!feed.lastFetched) return true // never fetched
        return now - feed.lastFetched >= freshnessTTL
      })

  // PERF: Sort feeds by priority for optimal refresh order
  const sortedStaleFeeds = sortFeedsByPriority(staleFeeds)
  throwIfAborted(options.signal)

  // PERF: Use optimal concurrency based on feed characteristics
  const concurrency = getOptimalConcurrency(
    sortedStaleFeeds,
    options.concurrency,
  )

  context?.reportProgress({
    completed: 0,
    total: sortedStaleFeeds.length,
    message: 'refresh all',
  })

  if (sortedStaleFeeds.length === 0) {
    throwIfAborted(options.signal)
    if (options.signal) {
      getDb().maintenance.cleanupEntries(cleanupOptions, {
        signal: options.signal,
      })
    } else {
      getDb().maintenance.cleanupEntries(cleanupOptions)
    }
    options.onProgress?.({
      feedId: '',
      feedTitle: '',
      success: true,
      newEntries: 0,
      completed: 0,
      total: 0,
      done: true,
    })
    context?.reportProgress({
      completed: 0,
      total: 0,
      message: 'refresh all done',
      data: { items: [] },
    })
    return emptyRefreshAllResult()
  }

  // Track pre-refresh error counts to detect fresh failures
  const errorCountBefore = new Map<string, number>()
  for (const feed of sortedStaleFeeds) {
    throwIfAborted(options.signal)
    errorCountBefore.set(feed.id, feed.errorCount)
  }

  options.onProgress?.({
    feedId: '',
    feedTitle: '',
    success: true,
    newEntries: 0,
    completed: 0,
    total: sortedStaleFeeds.length,
    done: false,
  })

  let totalNew = 0
  const failedTitles: string[] = []
  let completedRefreshes = 0

  // admin/vip 用户登录时，先批量问后端是否已经缓存了对应条目；
  // 命中的源会被 resolveFeedPayload 直接消费，避免本地再去拉一次 RSS。
  const serverCacheByUrl = options.signal
    ? await prefetchServerFeedCache(sortedStaleFeeds, {
        signal: options.signal,
      })
    : await prefetchServerFeedCache(sortedStaleFeeds)
  throwIfAborted(options.signal)

  const reportFeedProgress = (
    feed: Feed,
    success: boolean,
    newEntries: number,
  ): void => {
    completedRefreshes += 1
    const completed = completedRefreshes
    options.onProgress?.({
      feedId: feed.id,
      feedTitle: feed.title,
      success,
      newEntries,
      completed,
      total: sortedStaleFeeds.length,
      done: completed === sortedStaleFeeds.length,
    })
    context?.reportProgress({
      completed,
      total: sortedStaleFeeds.length,
      message: feed.title,
      data: {
        feedId: feed.id,
        success,
        newEntries,
      },
    })
  }

  const settled = await runConcurrencyPool(
    sortedStaleFeeds,
    concurrency,
    async (feed) => {
      throwIfAborted(options.signal)
      try {
        const newCount = await refreshSingleFeed(feed, {
          logOperation: false,
          serverCacheHit: serverCacheByUrl.get(
            getNormalizedFeedUrlForCache(feed),
          ),
          signal: options.signal,
        })
        totalNew += newCount
        reportFeedProgress(feed, true, newCount)
        return newCount
      } catch (error) {
        reportFeedProgress(feed, false, 0)
        throw error
      }
    },
    undefined,
    options.signal,
  )
  throwIfAborted(options.signal)

  // Run data cleanup after refresh
  throwIfAborted(options.signal)
  if (options.signal) {
    getDb().maintenance.cleanupEntries(cleanupOptions, {
      signal: options.signal,
    })
  } else {
    getDb().maintenance.cleanupEntries(cleanupOptions)
  }
  throwIfAborted(options.signal)

  // Record refresh log entry
  const refreshedFeeds = getDb().feeds.getAllFeeds()
  const refreshedFeedById = new Map(
    refreshedFeeds.map((feed) => [feed.id, feed]),
  )
  const itemResults: RefreshRunItemResult[] = sortedStaleFeeds.map(
    (feed, index) => {
      const refreshed = refreshedFeedById.get(feed.id)
      const result = settled[index]
      const before = errorCountBefore.get(feed.id)
      const failedByErrorCount =
        before !== undefined && refreshed
          ? refreshed.errorCount > before
          : false
      const failedByReject = result.status === 'rejected'
      const status =
        failedByErrorCount || failedByReject ? 'failed' : 'succeeded'
      const error =
        status === 'failed'
          ? refreshed?.lastRefreshError ||
            (failedByReject ? String(result.reason) : undefined)
          : undefined

      // 命中后端缓存的源最终走的是 server-cache 路径（resolveFeedPayload
      // 在 shouldUseServerFeedCache 为真时直接消费 serverCacheHit）；
      // 未命中或非 admin/vip 用户都视作直接从订阅源原链接拉取。
      const cacheKey = getNormalizedFeedUrlForCache(feed)
      const hadServerCacheHit = serverCacheByUrl.has(cacheKey)
      const source: RefreshRunItemResult['source'] =
        status === 'succeeded' && hadServerCacheHit
          ? 'server-cache'
          : 'upstream'

      return {
        feedId: feed.id,
        feedTitle: refreshed?.title || feed.title,
        status,
        newEntries: result.status === 'fulfilled' ? result.value : 0,
        error,
        source,
      }
    },
  )

  const successCount = itemResults.filter(
    (item) => item.status === 'succeeded',
  ).length
  const failedCount = itemResults.length - successCount
  failedTitles.push(
    ...itemResults
      .filter((item) => item.status === 'failed')
      .map((item) => item.feedTitle),
  )

  appendRefreshLog({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    refreshedAt: Date.now(),
    successFeedCount: successCount,
    failedFeedCount: failedCount,
    failedFeedTitles: failedTitles,
    items: itemResults,
  })

  context?.reportProgress({
    completed: settled.length,
    total: settled.length,
    message: 'refresh all done',
    data: {
      items: itemResults,
      failedFeedTitles: failedTitles,
      totalNewEntries: totalNew,
    },
  })

  // Sync Fever accounts after normal feed refresh
  try {
    throwIfAborted(options.signal)
    const feverAccounts = getDb()
      .fever.getFeverAccounts()
      .filter((a) => a.enabled)
    for (const account of feverAccounts) {
      throwIfAborted(options.signal)
      try {
        await queueFeverSyncAccount(account.id).promise
        throwIfAborted(options.signal)
      } catch (err) {
        if (isAbortError(err) && options.signal?.aborted) throw err
        console.warn('[fever] sync failed for', account.baseUrl, err)
      }
    }
  } catch (error) {
    if (isAbortError(error) && options.signal?.aborted) throw error
    // Database not ready or import failure — skip fever sync
  }

  return {
    totalFeeds: feeds.length,
    refreshedCount: successCount,
    failedCount,
    failedFeedTitles: failedTitles,
    totalNewEntries: totalNew,
    items: itemResults,
  }
}

function emptyRefreshAllResult(): RefreshAllResult {
  return {
    totalFeeds: 0,
    refreshedCount: 0,
    failedCount: 0,
    failedFeedTitles: [],
    totalNewEntries: 0,
    items: [],
  }
}

// ---- Bootstrap helpers ----

export async function bootstrapFeedEntries(
  feed: Feed,
  normalizedUrl: string,
  view?: FeedViewType,
): Promise<void> {
  const bootstrapTimeoutMs = getBootstrapRefreshTimeoutMs(normalizedUrl, view)

  await withTimeout(
    refreshSingleFeed(feed, { force: true }),
    bootstrapTimeoutMs,
    `bootstrap ${normalizedUrl}`,
  ).catch(() => {})
  const hasEntriesAfterFirstTry =
    getDb().entries.getEntries({
      feedId: feed.id,
      limit: 1,
      skipDedupe: true,
    }).entries.length > 0
  if (hasEntriesAfterFirstTry) return

  await withTimeout(
    refreshSingleFeed(feed, { force: true }),
    bootstrapTimeoutMs,
    `bootstrap retry ${normalizedUrl}`,
  ).catch(() => {})
}

export async function bootstrapFeedEntriesQuick(
  feed: Feed,
  normalizedUrl: string,
  view?: FeedViewType,
): Promise<void> {
  const quickTimeoutMs = Math.min(
    7000,
    getBootstrapRefreshTimeoutMs(normalizedUrl, view),
  )
  await withTimeout(
    refreshSingleFeed(feed, { force: true }),
    quickTimeoutMs,
    `bootstrap quick ${normalizedUrl}`,
  ).catch(() => {})
}

function hasAnyEntries(feedId: string): boolean {
  return (
    getDb().entries.getEntries({
      feedId,
      limit: 1,
      skipDedupe: true,
    }).entries.length > 0
  )
}

export function queueBootstrapRefresh(
  feed: Feed,
  normalizedUrl: string,
  view?: FeedViewType,
): void {
  const task = getLocalTaskRunner().enqueue(
    FEED_BOOTSTRAP_REFRESH_TASK,
    { feed, normalizedUrl, view },
    async (payload, context) => runBootstrapRefresh(payload, context),
    {
      metadata: {
        feedId: feed.id,
        feedTitle: feed.title,
        normalizedUrl,
        view,
      },
    },
  )
  void task.promise.catch(() => {})
}

async function runBootstrapRefresh(
  payload: FeedBootstrapRefreshTaskPayload,
  context?: TaskRunContext,
): Promise<{ rounds: number; hasEntries: boolean; hasAvatar: boolean }> {
  const { feed, normalizedUrl, view } = payload
  let rounds = 0
  let hasEntries = false
  let hasAvatar = false

  context?.reportProgress({
    completed: 0,
    total: 3,
    message: feed.title,
    data: { feedId: feed.id, phase: 'starting' },
  })

  for (let round = 0; round < 3; round++) {
    rounds = round + 1
    if (round === 0) {
      await bootstrapFeedEntriesQuick(feed, normalizedUrl, view).catch(() => {})
    } else {
      await bootstrapFeedEntries(feed, normalizedUrl, view).catch(() => {})
    }

    const refreshed = getDb().feeds.getFeedById(feed.id)
    hasEntries = hasAnyEntries(feed.id)
    hasAvatar = !!(refreshed?.imageUrl || '').trim()

    const progressData = {
      feedId: feed.id,
      phase: 'round',
      round: rounds,
      hasEntries,
      hasAvatar,
    }
    context?.reportProgress({
      completed: rounds,
      total: 3,
      message: feed.title,
      data: progressData,
    })

    getEventBus().send('feeds:updated', {
      feedId: feed.id,
      background: true,
      round: rounds,
      hasEntries,
      hasAvatar,
      // PERF: Send incremental update with feed patch
      feedIds: [feed.id],
      feeds: refreshed
        ? [
            {
              id: refreshed.id,
              imageUrl: refreshed.imageUrl,
              lastFetched: refreshed.lastFetched,
              errorCount: refreshed.errorCount,
            },
          ]
        : undefined,
    })

    if (hasEntries && hasAvatar) break
    await new Promise((resolve) => setTimeout(resolve, 2000 * rounds))
  }

  context?.reportProgress({
    completed: 3,
    total: 3,
    message: 'done',
    data: {
      feedId: feed.id,
      phase: 'done',
      rounds,
      hasEntries,
      hasAvatar,
    },
  })

  return { rounds, hasEntries, hasAvatar }
}
