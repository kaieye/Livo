import { BrowserWindow } from 'electron'
import {
  getAllFeeds,
  updateFeed,
  insertEntries,
  replaceEntriesForFeed,
  cleanupEntries,
  type CleanupOptions,
} from '../database'
import { deriveImageUrl } from './feed-utils'
import { getSettings } from '../handlers/settings-handlers'
import { DEFAULT_RSSHUB_INSTANCE } from '../../shared/discover-data'
import type { Feed, Entry } from '../../shared/types'
import { FeedViewType } from '../../shared/types'
import { queueVideoDurationEnrich, enrichAllVideoFeeds } from './video-duration'
import { resolveFeedPayload } from './feed-source-provider'
import {
  canonicalizeInstagramFeedUrl,
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
} from './rsshub-url'
import { resolveFeedAvatar } from './feed-avatar'
import { formatFeedTitle } from './feed-title'
import { buildEntriesFromParsedItems } from './entry-builder'
import { logWarnQuiet } from './logger'
import { reconcileFeedView } from './feed-view'
import { appendRefreshLog } from './refresh-log-store'
import { runConcurrencyPool } from '../utils/concurrency-pool'

let refreshTimer: ReturnType<typeof setInterval> | null = null
let refreshAllInFlight: Promise<RefreshAllResult> | null = null
const feedRefreshInFlight = new Map<string, Promise<number>>()
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
  const raw = (feedUrl || '').toLowerCase()
  return /instagram|picnob|pixnoy|piokok/.test(raw)
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

function isInstagramFeedUrl(feedUrl: string | undefined): boolean {
  const raw = (feedUrl || '').toLowerCase()
  return /(?:^|\/)(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//.test(
    raw,
  )
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

/**
 * FeedBurner (and similar aggregators) sometimes inject entries from completely
 * unrelated blogs.  When the feed declares a site URL we can compare domains
 * and drop entries that clearly do not belong.
 */
export function filterForeignEntries(
  entries: Entry[],
  feedSiteUrl: string | undefined,
  parsedFeedLink: string | undefined,
  feedUrl?: string,
): Entry[] {
  const rawFeedUrl = (feedUrl || '').toLowerCase()
  const isTwitterFeed = /\/(?:twitter|x)\/user\//i.test(rawFeedUrl)
  const isInstagramMirrorFeed =
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//i.test(rawFeedUrl)
  const isBilibiliUserFeed =
    /\/bilibili\/user\/(?:dynamic|video|article)\//i.test(rawFeedUrl)
  if (isTwitterFeed || isInstagramMirrorFeed || isBilibiliUserFeed) {
    // Twitter fallbacks may return x.com / twitter.com / nitter links interchangeably.
    // Instagram fallbacks may return instagram/picnob/pixnoy/piokok links interchangeably.
    // Bilibili user feeds frequently link across sibling subdomains like
    // space.bilibili.com / t.bilibili.com / www.bilibili.com.
    // Keep them all instead of strict same-domain filtering.
    return entries
  }

  const siteUrl = feedSiteUrl || parsedFeedLink || ''
  if (!siteUrl) return entries
  let siteHost: string
  try {
    siteHost = new URL(siteUrl).hostname.replace(/^www\./, '')
  } catch {
    return entries
  }
  if (!siteHost) return entries

  const filtered = entries.filter((e) => {
    if (!e.url) return true // keep entries without a URL
    let entryHost: string
    try {
      entryHost = new URL(e.url).hostname.replace(/^www\./, '')
    } catch {
      return true
    }
    // Allow exact match or subdomain match (e.g. blog.example.com matches example.com)
    return (
      entryHost === siteHost ||
      entryHost.endsWith('.' + siteHost) ||
      siteHost.endsWith('.' + entryHost)
    )
  })

  return filtered
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

function withTimeout<T>(
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
  if (refreshTimer) clearInterval(refreshTimer)

  // Always refresh once immediately on startup (but respect freshness)
  refreshAllFeeds(options).then((result) => {
    // After initial refresh, enrich video durations for all video/audio feeds
    // (catches entries fetched before duration enrichment was implemented)
    if (isVideoDurationEnrichmentEnabled()) {
      enrichAllVideoFeeds().catch(() => {})
    }
    if (result.totalNewEntries > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('feeds:updated', {
        newEntries: result.totalNewEntries,
      })
    }
  })

  if (intervalMinutes <= 0) return

  refreshTimer = setInterval(
    async () => {
      const result = await refreshAllFeeds(options)
      if (
        result.totalNewEntries > 0 &&
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.webContents.send('feeds:updated', {
          newEntries: result.totalNewEntries,
        })
      }
    },
    intervalMinutes * 60 * 1000,
  )
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Refresh a single feed with conditional GET support.
 * Returns the number of new entries, or -1 if skipped (still fresh).
 */
export async function refreshSingleFeed(
  feed: Feed,
  options?: { force?: boolean },
): Promise<number> {
  const inFlight = feedRefreshInFlight.get(feed.id)
  if (inFlight) return inFlight

  const task = (async (): Promise<number> => {
    const now = Date.now()
    const rsshubInstance =
      getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE
    const canonicalFeedUrl = canonicalizeInstagramFeedUrl(feed.url)
    const normalizedFeedUrl = normalizeRsshubProtocolUrl(
      canonicalFeedUrl,
      rsshubInstance,
    )

    try {
      // Update the feed URL to include limit param so subsequent refreshes use it directly
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

      const builtEntries = await buildEntriesFromParsedItems(
        feed.id,
        (parsed.items || []) as Array<Record<string, any>>,
        selectedFeedAvatar || feedImageUrl,
        feed.view,
        now,
      )
      // Filter out entries injected by FeedBurner from unrelated domains
      const entriesToInsert = filterForeignEntries(
        builtEntries,
        feed.siteUrl,
        parsed.link,
        feed.url,
      )
      // IMPORTANT:
      // Do incremental upsert for all feeds, including Instagram/Picnob mirror routes.
      // Full replacement can permanently drop history when upstream temporarily returns
      // only a short window (e.g. 8 recent items) or degraded single-photo entries.
      // Database identity merge keeps duplicates under control while preserving richer
      // historical entries and multi-photo media arrays.
      const newCount = isBilibiliVideoFeedUrl(feed.url)
        ? replaceEntriesForFeed(feed.id, entriesToInsert)
        : insertEntries(entriesToInsert)

      // Fire-and-forget: enrich video entries with duration from YouTube/Bilibili
      if (
        isVideoDurationEnrichmentEnabled() &&
        feed.view === FeedViewType.Videos
      ) {
        queueVideoDurationEnrich(feed.id)
          .then((count) => {
            if (count > 0) {
              const win = BrowserWindow.getAllWindows()[0]
              if (win && !win.isDestroyed())
                win.webContents.send('entries:enriched')
            }
          })
          .catch(() => {})
      }

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
      return 0
    }
  })()

  feedRefreshInFlight.set(feed.id, task)
  try {
    return await task
  } finally {
    if (feedRefreshInFlight.get(feed.id) === task) {
      feedRefreshInFlight.delete(feed.id)
    }
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
): Promise<RefreshAllResult> {
  if (refreshAllInFlight) {
    await refreshAllInFlight
    return emptyRefreshAllResult()
  }

  const run = (async (): Promise<RefreshAllResult> => {
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
        const newCount = await refreshSingleFeed(feed)
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

    return {
      totalFeeds: feeds.length,
      refreshedCount: successCount,
      failedCount,
      failedFeedTitles: failedTitles,
      totalNewEntries: totalNew,
    }
  })()

  refreshAllInFlight = run
  try {
    return await run
  } finally {
    if (refreshAllInFlight === run) refreshAllInFlight = null
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
