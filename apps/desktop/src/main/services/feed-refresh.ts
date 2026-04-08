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

let refreshTimer: ReturnType<typeof setInterval> | null = null
let refreshAllInFlight: Promise<void> | null = null
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

function getRouteAlignedView(feedUrl: string | undefined): FeedViewType | null {
  const raw = (feedUrl || '').toLowerCase()
  if (/\/bilibili\/user\/dynamic\//.test(raw)) return FeedViewType.SocialMedia
  if (/\/bilibili\/user\/video\//.test(raw)) return FeedViewType.Videos
  if (/\/bilibili\/user\/article\//.test(raw)) return FeedViewType.Articles
  return null
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

export function startAutoRefresh(
  intervalMinutes: number,
  mainWindow: BrowserWindow | null,
  options?: RefreshOptions,
): void {
  if (refreshTimer) clearInterval(refreshTimer)

  // Always refresh once immediately on startup (but respect freshness)
  refreshAllFeeds(mainWindow, options).then(() => {
    // After initial refresh, enrich video durations for all video/audio feeds
    // (catches entries fetched before duration enrichment was implemented)
    if (isVideoDurationEnrichmentEnabled()) {
      enrichAllVideoFeeds().catch(() => {})
    }
  })

  if (intervalMinutes <= 0) return

  refreshTimer = setInterval(
    async () => {
      await refreshAllFeeds(mainWindow, options)
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

async function refreshAllFeeds(
  mainWindow: BrowserWindow | null,
  options?: RefreshOptions,
): Promise<void> {
  if (refreshAllInFlight) {
    await refreshAllInFlight
    return
  }

  const run = (async () => {
    const allFeeds = getAllFeeds()
    const receiveRecommended = !!getSettings().general.showRecommended
    const feeds = receiveRecommended
      ? allFeeds
      : allFeeds.filter((f) => f.category !== RECOMMENDED_CATEGORY)
    const freshnessTTL =
      (options?.freshnessTTL ?? DEFAULT_FRESHNESS_TTL_MINUTES) * 60 * 1000
    const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY
    const force = options?.force ?? false
    const now = Date.now()
    const settingsCleanup: CleanupOptions = {
      entriesPerFeed: getSettings().data?.entriesPerFeed ?? 128,
      maxEntryAgeDays: getSettings().data?.maxEntryAgeDays ?? 90,
    }
    const cleanupOptions = options?.cleanup ?? settingsCleanup

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
      return
    }

    let totalNew = 0

    // Concurrent refresh with limited parallelism
    const queue = [...staleFeeds]
    const runWorker = async () => {
      while (queue.length > 0) {
        const feed = queue.shift()!
        const newCount = await refreshSingleFeed(feed)
        totalNew += newCount
      }
    }
    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => runWorker(),
    )
    await Promise.all(workers)

    // Run data cleanup after refresh
    cleanupEntries(cleanupOptions)

    if (totalNew > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('feeds:updated', { newEntries: totalNew })
    }
  })()

  refreshAllInFlight = run
  try {
    await run
  } finally {
    if (refreshAllInFlight === run) refreshAllInFlight = null
  }
}
