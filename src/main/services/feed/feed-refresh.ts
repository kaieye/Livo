import { BrowserWindow } from 'electron'
import { getEventBus } from '../system/event-bus'
import {
  getAllFeeds,
  getFeedById,
  getEntries,
  updateFeed,
  cleanupEntries,
  type CleanupOptions,
} from '../../database'
import { deriveImageUrl } from './feed-utils'
import { getSettings } from '../../handlers/settings-handlers'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../shared/discover-data'
import type { Feed } from '../../../shared/types/index'
import { FeedViewType } from '../../../shared/types/index'
import {
  queueVideoDurationEnrich,
  enrichAllVideoFeeds,
} from '../video/video-duration'
import { resolveFeedPayload } from './feed-source-provider'
import {
  canonicalizeInstagramFeedUrl,
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeFeedUrl,
} from './rsshub-url'
import { resolveFeedAvatar } from './feed-avatar'
import { formatFeedTitle } from './feed-title'
import { logWarnQuiet } from '../system/logger'
import {
  isInstagramFeedUrl as _isInstagramFeed,
  isInstagramUserFeedUrl as _isInstagramUserFeed,
} from '../../../shared/url-detect'
import { reconcileFeedView } from './feed-view'
import { appendRefreshLog } from '../system/refresh-log-store'
import { runConcurrencyPool } from '../../utils/concurrency-pool'
import { queueFeverSyncAccount } from '../fever/fever-sync'
import {
  FEED_REFRESH_ALL_TASK,
  FEED_REFRESH_SINGLE_TASK,
} from '../system/task-contracts'
import { getLocalTaskRunner } from '../system/task-runner-service'
import type { TaskRunContext } from '../system/task-runner'
import { logUserOperation } from '../system/user-operation-log'
import { ingestParsedFeedEntries } from '../entry/entry-ingestion-pipeline'
import { USER_OPERATION_KEYS } from '../../../shared/user-operations'

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let autoRefreshGeneration = 0
const RECOMMENDED_CATEGORY = 'Recommended'

function isPlaceholderAvatar(url: string | undefined): boolean {
  const raw = (url || '').trim()
  if (!raw) return true
  const lower = raw.toLowerCase()
  if (lower.includes('unavatar.io/instagram/')) return true
  if (
    lower.includes('instagram.com/static/images/ico') ||
    lower.includes('instagram_static/images/ico') ||
    lower.includes('instagram_logo') ||
    lower.includes('instagram-logo') ||
    lower.includes('/apple-touch-icon') ||
    lower.includes('favicon')
  )
    return true
  if (
    (lower.includes('picnob') ||
      lower.includes('pixnoy') ||
      lower.includes('piokok')) &&
    lower.includes('logo')
  )
    return true
  return false
}

function isInstagramLikeFeed(feedUrl: string | undefined): boolean {
  return _isInstagramFeed(feedUrl || '')
}

function pickBestFeedAvatar(
  feedUrl: string | undefined,
  existing: string | undefined,
  incoming: string | undefined,
): string {
  const current = (existing || '').trim()
  const next = (incoming || '').trim()
  if (!current) return next
  if (!next) return current
  if (current === next) return current
  // Instagram/Picnob avatar URLs are often signed/expiring.
  // Prefer the latest fetched value so old expired URLs get replaced.
  if (isInstagramLikeFeed(feedUrl)) return next
  if (!isPlaceholderAvatar(next)) return next
  if (isPlaceholderAvatar(current) && !isPlaceholderAvatar(next)) return next
  return current
}

function isVideoDurationEnrichmentEnabled(): boolean {
  return !!getSettings().data?.enrichVideoDuration
}

/** Default data-maintenance constants (overridden by settings at call site) */
const DEFAULT_FRESHNESS_TTL_MINUTES = 10
const DEFAULT_CONCURRENCY = 8
const DEFAULT_FEED_REFRESH_TIMEOUT_MS = 12000
const INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS = 15 * 60 * 1000
const INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS = 90 * 60 * 1000
const AUTO_REFRESH_MIN_DELAY_MS = 1000

function isInstagramFeedUrl(feedUrl: string | undefined): boolean {
  return _isInstagramUserFeed(feedUrl || '')
}

function isBilibiliDynamicFeedUrl(feedUrl: string | undefined): boolean {
  const raw = (feedUrl || '').toLowerCase()
  return /\/bilibili\/user\/dynamic\//.test(raw)
}

function isBilibiliVideoFeedUrl(feedUrl: string | undefined): boolean {
  const raw = (feedUrl || '').toLowerCase()
  return /\/bilibili\/user\/video\//.test(raw)
}

function getRefreshTimeoutMs(feedUrl: string | undefined): number {
  // Instagram refreshes may fan out across many RSSHub candidates and route
  // variants before we can pick the freshest result, so they need a wider
  // timeout budget than normal feeds. Bilibili video fallbacks use a serialized
  // hidden BrowserWindow scraper, so later feeds in the queue also need extra time.
  if (isInstagramFeedUrl(feedUrl) || isBilibiliDynamicFeedUrl(feedUrl)) {
    return 40000
  }
  if (isBilibiliVideoFeedUrl(feedUrl)) {
    return 120000
  }
  return DEFAULT_FEED_REFRESH_TIMEOUT_MS
}

function isKnownInstagramUpstreamFailure(error: unknown): boolean {
  const message = String(error || '').toLowerCase()
  if (!message) return false
  return (
    message.includes('feed not recognized as rss') ||
    message.includes('challenge_required') ||
    message.includes('[refresh] timeout after') ||
    message.includes('err_connection_closed') ||
    message.includes('http 403') ||
    message.includes('http 429') ||
    message.includes('http 503')
  )
}

function shouldBackOffFeed(feed: Feed, now: number, force: boolean): boolean {
  if (force) return false
  if (!isInstagramFeedUrl(feed.url)) return false
  if (!feed.lastFetched || feed.errorCount <= 0) return false
  const exp = Math.max(0, feed.errorCount - 1)
  const backoffMs = Math.min(
    INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS * Math.pow(2, exp),
    INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS,
  )
  return now - feed.lastFetched < backoffMs
}

function getFeedBackoffUntilMs(feed: Feed): number | null {
  if (!isInstagramFeedUrl(feed.url)) return null
  if (!feed.lastFetched || feed.errorCount <= 0) return null
  const exp = Math.max(0, feed.errorCount - 1)
  const backoffMs = Math.min(
    INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS * Math.pow(2, exp),
    INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS,
  )
  return feed.lastFetched + backoffMs
}

export function getNextAutoRefreshDelayMs(
  feeds: Feed[],
  now: number,
  intervalMinutes: number,
): number | null {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return null

  const intervalMs = intervalMinutes * 60 * 1000
  if (feeds.length === 0) return intervalMs

  let nextDueAt = Number.POSITIVE_INFINITY
  for (const feed of feeds) {
    if (!feed.lastFetched) return 0
    const dueAt = Math.max(
      feed.lastFetched + intervalMs,
      getFeedBackoffUntilMs(feed) ?? 0,
    )
    nextDueAt = Math.min(nextDueAt, dueAt)
  }

  if (!Number.isFinite(nextDueAt)) return intervalMs
  return Math.max(0, nextDueAt - now)
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[refresh] timeout after ${timeoutMs}ms: ${context}`))
    }, timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
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

    const receiveRecommended = !!getSettings().general.showRecommended
    const feeds = getAllFeeds().filter(
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

  void runAndSchedule()
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
  options?: { force?: boolean; logOperation?: boolean },
): Promise<number> {
  const task = getLocalTaskRunner().enqueue(
    FEED_REFRESH_SINGLE_TASK,
    { feedId: feed.id, force: !!options?.force },
    async (_payload, context) => {
      return runRefreshSingleFeed(feed, options, context)
    },
    {
      metadata: {
        operationKey: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
        feedId: feed.id,
        feedTitle: feed.title,
        force: !!options?.force,
      },
    },
  )
  const shouldLogOperation = options?.logOperation !== false
  if (shouldLogOperation) {
    logUserOperation({
      operationKey: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
      status: 'queued',
      runId: task.runId,
      targetId: feed.id,
      targetLabel: feed.title,
      details: { force: !!options?.force },
    })
  }
  return task.promise.then(
    (result) => {
      if (shouldLogOperation) {
        logUserOperation({
          operationKey: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
          status: 'succeeded',
          runId: task.runId,
          targetId: feed.id,
          targetLabel: feed.title,
          details: { newEntries: result },
        })
      }
      return result
    },
    (error) => {
      if (shouldLogOperation) {
        logUserOperation({
          operationKey: USER_OPERATION_KEYS.FEED_REFRESH_SINGLE,
          status: 'failed',
          runId: task.runId,
          targetId: feed.id,
          targetLabel: feed.title,
          error,
        })
      }
      throw error
    },
  )
}

async function runRefreshSingleFeed(
  feed: Feed,
  options: { force?: boolean } | undefined,
  context?: TaskRunContext,
): Promise<number> {
  context?.reportProgress({
    completed: 0,
    total: 1,
    message: feed.title,
    data: { feedId: feed.id },
  })

  if (feed.provider === 'fever') return 0
  const now = Date.now()
  const rsshubInstance =
    getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE
  const normalizedFeedUrl = normalizeFeedUrl(feed.url, rsshubInstance)
  const canonicalFeedUrl = canonicalizeInstagramFeedUrl(feed.url)

  try {
    // 更新 RSSHub 用户路由的 limit，后续刷新直接使用规范化 URL。
    const feedUrlToStore = ensureTwitterUserFeedLimit(
      ensureInstagramUserFeedLimit(canonicalFeedUrl, 100),
      120,
    )
    if (feedUrlToStore !== feed.url) {
      updateFeed(feed.id, { url: feedUrlToStore })
      feed = { ...feed, url: feedUrlToStore }
    }

    const result = await withTimeout(
      resolveFeedPayload(feed, { force: options?.force }),
      getRefreshTimeoutMs(feed.url),
      normalizedFeedUrl,
    )

    // 304 Not Modified - no need to parse entries
    if (result.notModified || !result.parsed) {
      updateFeed(feed.id, {
        lastFetched: now,
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

    const parsedFeedImage = getFeedImageUrl(parsed)
    const feedImageUrl = await resolveFeedAvatar(
      normalizedFeedUrl,
      parsedFeedImage,
      feed.imageUrl,
    )
    const selectedFeedAvatar = pickBestFeedAvatar(
      feed.url,
      feed.imageUrl,
      feedImageUrl,
    )

    updateFeed(feed.id, {
      title: formatFeedTitle(normalizedFeedUrl, parsed.title, feed.title),
      description: parsed.description,
      // Keep avatars fresh when upstream exposes a newer image, while still
      // avoiding regressions back to placeholder/default assets.
      imageUrl: selectedFeedAvatar,
      lastFetched: now,
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
      items: (parsed.items || []) as Array<Record<string, any>>,
      authorAvatarSeed: selectedFeedAvatar || feedImageUrl,
      parsedFeedLink: parsed.link,
      now,
      replaceExisting: isBilibiliVideoFeedUrl(feed.url),
    })
    const newCount = ingestionResult.addedCount

    // Fire-and-forget: enrich video entries with duration from YouTube/Bilibili
    if (
      isVideoDurationEnrichmentEnabled() &&
      feed.view === FeedViewType.Videos
    ) {
      queueVideoDurationEnrich(feed.id)
        .then((count) => {
          if (count > 0) getEventBus().send('entries:enriched')
        })
        .catch(() => {})
    }

    context?.reportProgress({
      completed: 1,
      total: 1,
      message: feed.title,
      data: { feedId: feed.id, newEntries: newCount },
    })
    return newCount
  } catch (error) {
    const knownInstagramFailure =
      isInstagramFeedUrl(feed.url) && isKnownInstagramUpstreamFailure(error)
    const refreshMessage = `[refresh] failed: ${feed.title} (${normalizedFeedUrl})`
    if (knownInstagramFailure) {
      logWarnQuiet(refreshMessage, error)
    } else {
      console.warn(refreshMessage, error)
    }
    updateFeed(feed.id, {
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

function getFeedImageUrl(parsed: any): string | undefined {
  const imageUrl =
    (parsed['image'] as { url?: string } | undefined)?.url ||
    (parsed['itunes'] as { image?: string } | undefined)?.image
  if (imageUrl) return imageUrl

  const items =
    (parsed['items'] as Array<Record<string, unknown>> | undefined) || []
  for (const item of items.slice(0, 3)) {
    const image = deriveImageUrl(item)
    if (image) return image
  }
  return undefined
}

export async function refreshAllFeeds(
  options: RefreshOptions & {
    onProgress?: (event: RefreshProgressEvent) => void
  } = {},
): Promise<RefreshAllResult & { runId: string }> {
  const runner = getLocalTaskRunner()
  const dedupeKey =
    FEED_REFRESH_ALL_TASK.dedupeKey?.({ force: !!options.force }) || 'all'
  const activeRun = runner.getActiveRun<RefreshAllResult>(
    FEED_REFRESH_ALL_TASK.name,
    dedupeKey,
  )
  if (activeRun) {
    const result = await activeRun.promise
    return { ...result, runId: activeRun.runId }
  }

  const task = runner.enqueue(
    FEED_REFRESH_ALL_TASK,
    { force: !!options.force },
    async (_payload, context) => runRefreshAllFeeds(options, context),
    {
      metadata: {
        operationKey: USER_OPERATION_KEYS.FEED_REFRESH_ALL,
        force: !!options.force,
      },
    },
  )
  logUserOperation({
    operationKey: USER_OPERATION_KEYS.FEED_REFRESH_ALL,
    status: 'queued',
    runId: task.runId,
    details: { force: !!options.force },
  })
  return task.promise.then(
    (result) => {
      logUserOperation({
        operationKey: USER_OPERATION_KEYS.FEED_REFRESH_ALL,
        status: 'succeeded',
        runId: task.runId,
        details: {
          refreshedCount: result.refreshedCount,
          failedCount: result.failedCount,
          totalNewEntries: result.totalNewEntries,
        },
      })
      return { ...result, runId: task.runId }
    },
    (error) => {
      logUserOperation({
        operationKey: USER_OPERATION_KEYS.FEED_REFRESH_ALL,
        status: 'failed',
        runId: task.runId,
        error,
      })
      throw error
    },
  )
}

async function runRefreshAllFeeds(
  options: RefreshOptions & {
    onProgress?: (event: RefreshProgressEvent) => void
  },
  context?: TaskRunContext,
): Promise<RefreshAllResult> {
  const allFeeds = getAllFeeds()
  const receiveRecommended = !!getSettings().general.showRecommended
  const feeds = receiveRecommended
    ? allFeeds
    : allFeeds.filter((f) => f.category !== RECOMMENDED_CATEGORY)
  const freshnessTTL =
    (options.freshnessTTL ?? DEFAULT_FRESHNESS_TTL_MINUTES) * 60 * 1000
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
  const force = options.force ?? false
  const now = Date.now()
  const settingsCleanup: CleanupOptions = {
    entriesPerFeed: getSettings().data?.entriesPerFeed ?? 128,
    maxEntryAgeDays: getSettings().data?.maxEntryAgeDays ?? 90,
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

  context?.reportProgress({
    completed: 0,
    total: staleFeeds.length,
    message: 'refresh all',
  })

  if (staleFeeds.length === 0) {
    cleanupEntries(cleanupOptions)
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
    })
    return emptyRefreshAllResult()
  }

  // Track pre-refresh error counts to detect fresh failures
  const errorCountBefore = new Map<string, number>()
  for (const feed of staleFeeds) {
    errorCountBefore.set(feed.id, feed.errorCount)
  }

  options.onProgress?.({
    feedId: '',
    feedTitle: '',
    success: true,
    newEntries: 0,
    completed: 0,
    total: staleFeeds.length,
    done: false,
  })

  let totalNew = 0
  const failedTitles: string[] = []

  const settled = await runConcurrencyPool(
    staleFeeds,
    concurrency,
    async (feed) => {
      const newCount = await refreshSingleFeed(feed, { logOperation: false })
      return newCount
    },
  )

  // Emit per-feed progress events. Done after the pool completes so the
  // listener sees a deterministic order and never a partial set.
  for (let i = 0; i < settled.length; i += 1) {
    const feed = staleFeeds[i]
    const result = settled[i]
    const success = result.status === 'fulfilled'
    const newEntries = success ? result.value : 0
    if (success) totalNew += newEntries
    options.onProgress?.({
      feedId: feed.id,
      feedTitle: feed.title,
      success,
      newEntries,
      completed: i + 1,
      total: settled.length,
      done: i + 1 === settled.length,
    })
    context?.reportProgress({
      completed: i + 1,
      total: settled.length,
      message: feed.title,
      data: {
        feedId: feed.id,
        success,
        newEntries,
      },
    })
  }

  // Run data cleanup after refresh
  cleanupEntries(cleanupOptions)

  // Record refresh log entry
  const refreshedFeeds = getAllFeeds()
  let successCount = 0
  let failedCount = 0
  for (const feed of refreshedFeeds) {
    const before = errorCountBefore.get(feed.id)
    if (before !== undefined) {
      if (feed.errorCount > before) {
        failedCount++
        failedTitles.push(feed.title)
      } else {
        successCount++
      }
    }
  }

  appendRefreshLog({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    refreshedAt: Date.now(),
    successFeedCount: successCount,
    failedFeedCount: failedCount,
    failedFeedTitles: failedTitles,
  })

  // Sync Fever accounts after normal feed refresh
  try {
    const { getFeverAccounts } = await import('../../database')
    const feverAccounts = getFeverAccounts().filter((a) => a.enabled)
    for (const account of feverAccounts) {
      try {
        await queueFeverSyncAccount(account.id).promise
      } catch (err) {
        console.warn('[fever] sync failed for', account.baseUrl, err)
      }
    }
  } catch {
    // Database not ready or import failure — skip fever sync
  }

  return {
    totalFeeds: feeds.length,
    refreshedCount: successCount,
    failedCount,
    failedFeedTitles: failedTitles,
    totalNewEntries: totalNew,
  }
}

function emptyRefreshAllResult(): RefreshAllResult {
  return {
    totalFeeds: 0,
    refreshedCount: 0,
    failedCount: 0,
    failedFeedTitles: [],
    totalNewEntries: 0,
  }
}

// ---- Bootstrap helpers ----

export function getInitialFetchTimeoutMs(
  url: string,
  view?: FeedViewType,
): number {
  const raw = (url || '').toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\//i.test(
      raw,
    ) ||
    /\/bilibili\/user\/dynamic\//i.test(raw)
  const isBilibiliVideoRoute = /\/bilibili\/user\/video\//i.test(raw)
  if (
    isSocialRoute ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  ) {
    return 18000
  }
  if (isBilibiliVideoRoute || view === FeedViewType.Videos) {
    return 45000
  }
  return 6000
}

export function getBootstrapRefreshTimeoutMs(
  url: string,
  view?: FeedViewType,
): number {
  const raw = (url || '').toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\//i.test(
      raw,
    ) ||
    /\/bilibili\/user\/dynamic\//i.test(raw)
  const isBilibiliVideoRoute = /\/bilibili\/user\/video\//i.test(raw)

  if (
    isSocialRoute ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  ) {
    return 45000
  }
  if (isBilibiliVideoRoute || view === FeedViewType.Videos) {
    return 120000
  }
  return 18000
}

export function shouldDeferBootstrap(
  url: string,
  view?: FeedViewType,
): boolean {
  const raw = (url || '').toLowerCase()
  const isSocialRoute =
    /\/(?:twitter|x)\/user\//i.test(raw) ||
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\//i.test(
      raw,
    ) ||
    /\/bilibili\/user\/dynamic\//i.test(raw)
  return (
    isSocialRoute ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  )
}

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
    getEntries({
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
    getEntries({
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
  void (async () => {
    for (let round = 0; round < 3; round++) {
      if (round === 0) {
        await bootstrapFeedEntriesQuick(feed, normalizedUrl, view).catch(
          () => {},
        )
      } else {
        await bootstrapFeedEntries(feed, normalizedUrl, view).catch(() => {})
      }

      const refreshed = getFeedById(feed.id)
      const hasEntries = hasAnyEntries(feed.id)
      const hasAvatar = !!(refreshed?.imageUrl || '').trim()

      getEventBus().send('feeds:updated', {
        feedId: feed.id,
        background: true,
        round: round + 1,
        hasEntries,
        hasAvatar,
      })

      if (hasEntries && hasAvatar) break
      await new Promise((resolve) => setTimeout(resolve, 2000 * (round + 1)))
    }
  })().catch(() => {})
}
