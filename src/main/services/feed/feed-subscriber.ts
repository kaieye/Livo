import { v4 as uuidv4 } from 'uuid'
import { FeedViewType, type Feed } from '../../../shared/types'
import { getDb } from '../../database'
import { fetchAndParseFeed } from './rss-parser'
import { buildEntriesFromParsedItems } from '../entry/entry-builder'
import { getImmediateFeedAvatar, resolveFeedAvatar } from './feed-avatar'
import { getFeedImageUrl } from './feed-utils'
import { detectViewType } from './feed-view'
import { formatFeedTitle } from './feed-title'
import {
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from './rsshub-url'
import { getEventBus } from '../system/event-bus'
import { settingsProvider } from '../system/settings-provider'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../shared/discover-data'
import { inferDiscoverFeedViewFromUrl } from '../../../shared/subscription-intake'

export interface SubscribeFeedOptions {
  url: string
  title?: string
  category?: string
  view?: FeedViewType
}

export interface SubscribeFeedResult {
  feedId: string
  feedTitle: string
  feed: Feed
  /** True if the feed already existed (subscription was a no-op for new-feed creation). */
  existed: boolean
  /** Number of entries inserted during initial fetch. */
  entriesInserted: number
  /** Whether the feed was successfully fetched and parsed. */
  fetched: boolean
}

/**
 * Core feed subscription logic shared by the IPC handler and agent tools.
 *
 * Handles URL normalization, deduplication against existing feeds, best-effort
 * fetch+parse, view-type detection, feed creation, and entry insertion.
 *
 * Callers are responsible for:
 * - Existing-feed update logic (Recommended promotion, view correction, etc.)
 * - Warmup/bootstrap strategy
 * - Video duration enrichment
 * - Response formatting (IPC envelope / AgentToolResult)
 */
export async function subscribeFeed(
  options: SubscribeFeedOptions,
): Promise<SubscribeFeedResult> {
  const url = options.url.trim()
  const rsshubInstance =
    settingsProvider.get().general.rsshubInstance?.trim() ||
    DEFAULT_RSSHUB_INSTANCE

  // ---- URL normalization ----
  const rawProtocolUrl = toRsshubProtocolUrl(url)
  const limitedProtocolUrl = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(rawProtocolUrl, 100),
    120,
  )
  const storedUrl = limitedProtocolUrl
  const legacyStoredUrl = rawProtocolUrl
  const normalizedUrl = normalizeRsshubProtocolUrl(storedUrl, rsshubInstance)
  const normalizedLegacyUrl = normalizeRsshubProtocolUrl(
    legacyStoredUrl,
    rsshubInstance,
  )

  // ---- Dedup check ----
  const existingFeed =
    getDb().feeds.getFeedByUrl(storedUrl) ||
    getDb().feeds.getFeedByUrl(normalizedUrl) ||
    getDb().feeds.getFeedByUrl(toRsshubProtocolUrl(normalizedUrl)) ||
    getDb().feeds.getFeedByUrl(legacyStoredUrl) ||
    getDb().feeds.getFeedByUrl(normalizedLegacyUrl) ||
    getDb().feeds.getFeedByUrl(toRsshubProtocolUrl(normalizedLegacyUrl))

  if (existingFeed) {
    const upgradedUrl = ensureTwitterUserFeedLimit(
      ensureInstagramUserFeedLimit(existingFeed.url, 100),
      120,
    )
    if (upgradedUrl !== existingFeed.url) {
      getDb().feeds.updateFeed(existingFeed.id, { url: upgradedUrl })
      const updated = getDb().feeds.getFeedById(existingFeed.id)
      if (updated) {
        return {
          feedId: updated.id,
          feedTitle: updated.title,
          feed: updated,
          existed: true,
          entriesInserted: 0,
          fetched: false,
        }
      }
    }
    return {
      feedId: existingFeed.id,
      feedTitle: existingFeed.title,
      feed: existingFeed,
      existed: true,
      entriesInserted: 0,
      fetched: false,
    }
  }

  // ---- Fetch + parse ----
  const now = Date.now()
  const fetchUrl = /^https?:\/\//i.test(url) ? url : normalizedUrl
  let parsed: Awaited<ReturnType<typeof fetchAndParseFeed>>['data'] | null =
    null
  try {
    parsed = (await fetchAndParseFeed(fetchUrl)).data
  } catch {
    // Tolerate unreachable/slow feeds: create the subscription anyway.
  }

  // ---- View type detection ----
  // Route-derived view wins over explicit, then content-derived.
  const inferredView = inferDiscoverFeedViewFromUrl(normalizedUrl)
  const detectedView =
    inferredView !== FeedViewType.Articles
      ? inferredView
      : (options.view ??
        (parsed ? detectViewType(parsed) : FeedViewType.Articles))

  // ---- Avatar ----
  // Use immediate/local avatar so the feed appears instantly; defer network
  // resolution to a background task so it doesn't block the subscribe flow.
  const immediateImageUrl =
    (parsed ? getFeedImageUrl(parsed) : undefined) ||
    getImmediateFeedAvatar(normalizedUrl)
  const imageUrl = immediateImageUrl

  // ---- Feed creation ----
  const id = uuidv4()
  const feed: Feed = {
    id,
    title: formatFeedTitle(
      storedUrl,
      parsed?.title,
      options.title || storedUrl,
    ),
    url: storedUrl,
    upstreamUrl: url,
    siteUrl: parsed?.link,
    description: parsed?.description,
    imageUrl,
    folder: options.category || '',
    category: options.category || '',
    view: detectedView,
    fetchSource: 'auto',
    showInAll: true,
    lastFetched: parsed ? now : 0,
    errorCount: parsed ? 0 : 1,
    createdAt: now,
  }
  getDb().feeds.insertFeed(feed)

  // ---- Entry insertion ----
  let entriesInserted = 0
  if (parsed) {
    const entries = await buildEntriesFromParsedItems(
      id,
      (parsed.items || []) as Array<Record<string, unknown>>,
      imageUrl,
      detectedView,
      now,
    )
    entriesInserted = getDb().entries.insertEntries(entries)
  }

  // Resolve full avatar asynchronously and update feed when ready.
  // resolveFeedAvatar short-circuits when a good image is already present,
  // so this is effectively a no-op for feeds that shipped with a parsed image.
  void (async () => {
    try {
      const resolved = await resolveFeedAvatar(
        normalizedUrl,
        parsed ? getFeedImageUrl(parsed) : undefined,
        undefined,
        parsed?.link,
      )
      if (resolved && resolved !== immediateImageUrl) {
        getDb().feeds.updateFeed(id, { imageUrl: resolved })
        getEventBus().send('feeds:updated', { feedId: id })
      }
    } catch {
      // Best-effort; feed works without avatar.
    }
  })()

  return {
    feedId: id,
    feedTitle: feed.title,
    feed,
    existed: false,
    entriesInserted,
    fetched: !!parsed,
  }
}
