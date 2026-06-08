import { BrowserWindow } from 'electron'
import { getEventBus } from '../system/event-bus'
import { getDb } from '../../database'
import type { CleanupOptions } from '../../database'
import { deriveImageUrl, extractMedia, getFeedImageUrl } from './feed-utils'
import { settingsProvider } from '../system/settings-provider'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../shared/discover-data'
import type { Feed, RefreshRunItemResult } from '../../../shared/types/index'
import { FeedViewType } from '../../../shared/types/index'
import {
  queueVideoDurationEnrich,
  enrichAllVideoFeeds,
} from '../video/video-duration'
import { resolveFeedPayload } from './feed-source-provider'
import {
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
  FEED_BOOTSTRAP_REFRESH_TASK,
  FEED_REFRESH_ALL_TASK,
  FEED_REFRESH_SINGLE_TASK,
  type FeedBootstrapRefreshTaskPayload,
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

function normalizeAvatarComparisonKey(value: string | undefined): string {
  return (value || '').trim()
}

function collectParsedItemImageKeys(
  items: Array<Record<string, any>>,
): Set<string> {
  const keys = new Set<string>()
  const push = (value: string | undefined): void => {
    const key = normalizeAvatarComparisonKey(value)
    if (key) keys.add(key)
  }

  for (const item of items) {
    push(deriveImageUrl(item))
    for (const media of extractMedia(item) || []) {
      if (media.type !== 'photo') continue
      push(media.url)
      push(media.previewUrl)
    }
  }

  return keys
}

export function sanitizeExistingFeedAvatarForRefresh(
  existingImageUrl: string | undefined,
  parsedFeedImageUrl: string | undefined,
  items: Array<Record<string, any>>,
): string | undefined {
  if (parsedFeedImageUrl) return existingImageUrl
  const existingKey = normalizeAvatarComparisonKey(existingImageUrl)
  if (!existingKey) return existingImageUrl

  // 历史版本会把最新文章图写进 feed.imageUrl；刷新时不能继续保留。
  return collectParsedItemImageKeys(items).has(existingKey)
    ? undefined
    : existingImageUrl
}

function isVideoDurationEnrichmentEnabled(): boolean {
  return !!settingsProvider.get().data?.enrichVideoDuration
}

/** Default data-maintenance constants (overridden by settings at call site) */
const DEFAULT_FRESHNESS_TTL_MINUTES = 10
const DEFAULT_FEED_REFRESH_TIMEOUT_MS = 12000
const INSTAGRAM_FEED_FAILURE_BACKOFF_BASE_MS = 15 * 60 * 1000
const INSTAGRAM_FEED_FAILURE_BACKOFF_MAX_MS = 90 * 60 * 1000
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

  const hasSlowFeeds = feeds.some(
    (feed) =>
      isInstagramFeedUrl(feed.url) ||
      isBilibiliDynamicFeedUrl(feed.url) ||
      isBilibiliVideoFeedUrl(feed.url),
  )

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
    const aIsSlow =
      isInstagramFeedUrl(a.url) ||
      isBilibiliDynamicFeedUrl(a.url) ||
      isBilibiliVideoFeedUrl(a.url)
    const bIsSlow =
      isInstagramFeedUrl(b.url) ||
      isBilibiliDynamicFeedUrl(b.url) ||
      isBilibiliVideoFeedUrl(b.url)
    if (aIsSlow !== bIsSlow) {
      return aIsSlow ? 1 : -1
    }

    return 0
  })
}

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

export interface FeedRefreshErrorContext {
  knownInstagramFailure?: boolean
}

export interface FeedRefreshErrorInfo {
  userMessage: string
  rawMessage: string
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function mapFeedRefreshError(
  error: unknown,
  context: FeedRefreshErrorContext = {},
): FeedRefreshErrorInfo {
  const rawMessage = getRawErrorMessage(error) || 'Unknown refresh error'
  const lower = rawMessage.toLowerCase()

  if (context.knownInstagramFailure) {
    return {
      userMessage: 'Instagram/RSSHub 上游暂时不可用，请稍后重试',
      rawMessage,
    }
  }

  if (lower.includes('[refresh] timeout after') || lower.includes('timeout')) {
    return {
      userMessage: '刷新超时，请稍后重试',
      rawMessage,
    }
  }

  const httpStatus = rawMessage.match(/\bHTTP\s+(\d{3})\b/i)?.[1]
  if (httpStatus) {
    return {
      userMessage: `源站返回 HTTP ${httpStatus}`,
      rawMessage,
    }
  }

  return {
    userMessage: rawMessage,
    rawMessage,
  }
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
    settingsProvider.get().general.rsshubInstance?.trim() ||
    DEFAULT_RSSHUB_INSTANCE
  const normalizedFeedUrl = normalizeFeedUrl(feed.url, rsshubInstance)

  try {
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
      resolveFeedPayload(feed, { force: options?.force }),
      getRefreshTimeoutMs(feed.url),
      normalizedFeedUrl,
    )

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
    const knownInstagramFailure =
      isInstagramFeedUrl(feed.url) && isKnownInstagramUpstreamFailure(error)
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

  // PERF: Use optimal concurrency based on feed characteristics
  const concurrency = getOptimalConcurrency(sortedStaleFeeds, options.concurrency)

  context?.reportProgress({
    completed: 0,
    total: sortedStaleFeeds.length,
    message: 'refresh all',
  })

  if (sortedStaleFeeds.length === 0) {
    getDb().maintenance.cleanupEntries(cleanupOptions)
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

  const settled = await runConcurrencyPool(
    sortedStaleFeeds,
    concurrency,
    async (feed) => {
      const newCount = await refreshSingleFeed(feed, { logOperation: false })
      return newCount
    },
  )

  // Emit per-feed progress events. Done after the pool completes so the
  // listener sees a deterministic order and never a partial set.
  for (let i = 0; i < settled.length; i += 1) {
    const feed = sortedStaleFeeds[i]
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
  getDb().maintenance.cleanupEntries(cleanupOptions)

  // Record refresh log entry
  const refreshedFeeds = getDb().feeds.getAllFeeds()
  const refreshedFeedById = new Map(
    refreshedFeeds.map((feed) => [feed.id, feed]),
  )
  const itemResults: RefreshRunItemResult[] = sortedStaleFeeds.map((feed, index) => {
    const refreshed = refreshedFeedById.get(feed.id)
    const result = settled[index]
    const before = errorCountBefore.get(feed.id)
    const failedByErrorCount =
      before !== undefined && refreshed ? refreshed.errorCount > before : false
    const failedByReject = result.status === 'rejected'
    const status = failedByErrorCount || failedByReject ? 'failed' : 'succeeded'
    const error =
      status === 'failed'
        ? refreshed?.lastRefreshError ||
          (failedByReject ? String(result.reason) : undefined)
        : undefined

    return {
      feedId: feed.id,
      feedTitle: refreshed?.title || feed.title,
      status,
      newEntries: result.status === 'fulfilled' ? result.value : 0,
      error,
    }
  })

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
    const feverAccounts = getDb()
      .fever.getFeverAccounts()
      .filter((a) => a.enabled)
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
      feeds: refreshed ? [
        {
          id: refreshed.id,
          imageUrl: refreshed.imageUrl,
          lastFetched: refreshed.lastFetched,
          errorCount: refreshed.errorCount,
        },
      ] : undefined,
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
