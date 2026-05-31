import { BrowserWindow } from 'electron'
import {
  getAllFeeds,
  getFeedById,
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
import { filterForeignEntries } from './feed-refresh'

const SUCCESSFUL_REFRESH_COOLDOWN_MS = 3 * 60 * 1000
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
  if (isInstagramFeedUrl(feedUrl) || isBilibiliDynamicFeedUrl(feedUrl))
    return 40000
  if (isBilibiliVideoFeedUrl(feedUrl)) return 120000
  return DEFAULT_FEED_REFRESH_TIMEOUT_MS
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
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

export interface RefreshProgress {
  completed: number
  total: number
  percent: number
  feedId?: string
  feedTitle?: string
  success?: boolean
  newEntries?: number
  done: boolean
}

export interface BatchRefreshResult {
  totalFeeds: number
  skippedByCooldown: number
  refreshedCount: number
  failedCount: number
  failedFeedTitles: string[]
  totalNewEntries: number
}

export class FeedRefreshCoordinator {
  private feedRefreshInFlight = new Map<string, Promise<number>>()
  private refreshAllInFlight: Promise<BatchRefreshResult> | null = null

  isFeedInCooldown(feed: Feed, now: number = Date.now()): boolean {
    const lastFetched = feed.lastFetched ?? 0
    return lastFetched > 0 && now - lastFetched < SUCCESSFUL_REFRESH_COOLDOWN_MS
  }

  resolveConcurrency(totalFeeds: number, configConcurrency?: number): number {
    if (totalFeeds <= 0) return 1
    return Math.max(1, configConcurrency ?? DEFAULT_CONCURRENCY)
  }

  async refreshSingleFeed(
    feed: Feed,
    options?: { force?: boolean },
  ): Promise<number> {
    const inFlight = this.feedRefreshInFlight.get(feed.id)
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
        let currentFeed = { ...feed }
        const feedUrlToStore = ensureTwitterUserFeedLimit(
          ensureInstagramUserFeedLimit(canonicalFeedUrl, 100),
          120,
        )
        if (feedUrlToStore !== feed.url) {
          updateFeed(feed.id, { url: feedUrlToStore })
          currentFeed = { ...currentFeed, url: feedUrlToStore }
        }

        const result = await withTimeout(
          resolveFeedPayload(currentFeed, { force: options?.force }),
          getRefreshTimeoutMs(currentFeed.url),
          normalizedFeedUrl,
        )

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

        updateFeed(currentFeed.id, {
          title: formatFeedTitle(
            normalizedFeedUrl,
            parsed.title,
            currentFeed.title,
          ),
          description: parsed.description,
          imageUrl: selectedFeedAvatar,
          lastFetched: now,
          errorCount: 0,
          etag: result.etag,
          lastModified: result.lastModified,
          ...(reconcileFeedView(currentFeed.url, currentFeed.view) !==
          currentFeed.view
            ? { view: reconcileFeedView(currentFeed.url, currentFeed.view) }
            : {}),
        })

        const builtEntries = await buildEntriesFromParsedItems(
          currentFeed.id,
          (parsed.items || []) as Array<Record<string, any>>,
          selectedFeedAvatar || feedImageUrl,
          currentFeed.view,
          now,
        )
        const entriesToInsert = filterForeignEntries(
          builtEntries,
          currentFeed.siteUrl,
          parsed.link,
          currentFeed.url,
        )
        const newCount = isBilibiliVideoFeedUrl(currentFeed.url)
          ? replaceEntriesForFeed(currentFeed.id, entriesToInsert)
          : insertEntries(entriesToInsert)

        return newCount
      } catch (error) {
        const knownIg =
          isInstagramFeedUrl(feed.url) && isKnownInstagramUpstreamFailure(error)
        const msg = `[refresh] failed: ${feed.title} (${normalizedFeedUrl})`
        if (knownIg) {
          logWarnQuiet(msg, error)
        } else {
          console.warn(msg, error)
        }
        updateFeed(feed.id, {
          errorCount: feed.errorCount + 1,
          lastFetched: now,
        })
        return 0
      }
    })()

    this.feedRefreshInFlight.set(feed.id, task)
    try {
      return await task
    } finally {
      if (this.feedRefreshInFlight.get(feed.id) === task) {
        this.feedRefreshInFlight.delete(feed.id)
      }
    }
  }

  async refreshAllFeeds(
    onProgress?: (progress: RefreshProgress) => void,
    options?: {
      freshnessTTL?: number
      concurrency?: number
      force?: boolean
      cleanup?: CleanupOptions
    },
  ): Promise<BatchRefreshResult> {
    if (this.refreshAllInFlight) {
      return this.refreshAllInFlight
    }

    const run = (async (): Promise<BatchRefreshResult> => {
      const allFeeds = getAllFeeds()
      const receiveRecommended = !!getSettings().general.showRecommended
      const feeds = receiveRecommended
        ? allFeeds
        : allFeeds.filter((f) => f.category !== 'Recommended')
      const freshnessTTL = (options?.freshnessTTL ?? 10) * 60 * 1000
      const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY
      const force = options?.force ?? false
      const now = Date.now()
      const settingsCleanup: CleanupOptions = {
        entriesPerFeed: getSettings().data?.entriesPerFeed ?? 128,
        maxEntryAgeDays: getSettings().data?.maxEntryAgeDays ?? 90,
      }
      const cleanupOpts = options?.cleanup ?? settingsCleanup

      const staleFeeds = force
        ? feeds
        : feeds.filter((f) => {
            if (this.isFeedInCooldown(f, now)) return false
            if (!f.lastFetched) return true
            return now - f.lastFetched >= freshnessTTL
          })

      if (staleFeeds.length === 0) {
        cleanupEntries(cleanupOpts)
        onProgress?.({ completed: 0, total: 0, percent: 0, done: true })
        return {
          totalFeeds: feeds.length,
          skippedByCooldown: feeds.length,
          refreshedCount: 0,
          failedCount: 0,
          failedFeedTitles: [],
          totalNewEntries: 0,
        }
      }

      const skippedByCooldown = feeds.length - staleFeeds.length
      const errorCountBefore = new Map<string, number>()
      for (const f of staleFeeds) errorCountBefore.set(f.id, f.errorCount)

      let totalNew = 0
      const failedTitles: string[] = []

      onProgress?.({
        completed: 0,
        total: staleFeeds.length,
        percent: 0,
        done: false,
      })

      await runConcurrencyPool(
        staleFeeds,
        concurrency,
        async (feed, _index) => {
          const newCount = await this.refreshSingleFeed(feed)
          totalNew += newCount
        },
        (completed, total) => {
          onProgress?.({
            completed,
            total,
            percent: Math.round((completed / total) * 100),
            done: completed >= total,
          })
        },
      )

      cleanupEntries(cleanupOpts)

      const refreshedFeeds = getAllFeeds()
      let refreshedCount = 0
      let failedCount = 0
      for (const f of refreshedFeeds) {
        const before = errorCountBefore.get(f.id)
        if (before !== undefined) {
          if (f.errorCount > before) {
            failedCount++
            failedTitles.push(f.title)
          } else {
            refreshedCount++
          }
        }
      }

      appendRefreshLog({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        refreshedAt: Date.now(),
        successFeedCount: refreshedCount,
        failedFeedCount: failedCount,
        failedFeedTitles: failedTitles,
      })

      onProgress?.({
        completed: staleFeeds.length,
        total: staleFeeds.length,
        percent: 100,
        done: true,
      })

      return {
        totalFeeds: feeds.length,
        skippedByCooldown,
        refreshedCount,
        failedCount,
        failedFeedTitles: failedTitles,
        totalNewEntries: totalNew,
      }
    })()

    this.refreshAllInFlight = run
    try {
      return await run
    } finally {
      if (this.refreshAllInFlight === run) this.refreshAllInFlight = null
    }
  }
}

/** Singleton instance */
export const feedRefreshCoordinator = new FeedRefreshCoordinator()

// Internal helpers (mirror feed-refresh.ts utilities)
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
  return /instagram|picnob|pixnoy|piokok/.test((feedUrl || '').toLowerCase())
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
  if (isInstagramLikeFeed(feedUrl)) return next
  if (!isPlaceholderAvatar(next)) return next
  if (isPlaceholderAvatar(current) && !isPlaceholderAvatar(next)) return next
  return current
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
