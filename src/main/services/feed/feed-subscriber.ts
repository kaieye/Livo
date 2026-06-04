import { v4 as uuidv4 } from 'uuid'
import { FeedViewType, type Feed } from '../../../shared/types'
import {
  getAllFeeds,
  getFeedById,
  getFeedByUrl,
  insertFeed,
  insertEntries,
  updateFeed,
} from '../../database'
import { fetchAndParseFeed } from './rss-parser'
import { buildEntriesFromParsedItems } from '../entry/entry-builder'
import { resolveFeedAvatar } from './feed-avatar'
import { getFeedImageUrl } from './feed-utils'
import { detectViewType } from './feed-view'
import { formatFeedTitle } from './feed-title'
import {
  canonicalizeInstagramFeedUrl,
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from './rsshub-url'
import { getSettings } from '../../handlers/settings-handlers'
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
    getSettings().general.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE

  // ---- URL normalization ----
  const rawProtocolUrl = toRsshubProtocolUrl(url)
  const limitedProtocolUrl = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(rawProtocolUrl, 100),
    120,
  )
  const storedUrl = canonicalizeInstagramFeedUrl(limitedProtocolUrl)
  const legacyStoredUrl = canonicalizeInstagramFeedUrl(rawProtocolUrl)
  const normalizedUrl = normalizeRsshubProtocolUrl(storedUrl, rsshubInstance)
  const normalizedLegacyUrl = normalizeRsshubProtocolUrl(
    legacyStoredUrl,
    rsshubInstance,
  )

  // ---- Dedup check ----
  const existingFeed =
    getFeedByUrl(storedUrl) ||
    getFeedByUrl(normalizedUrl) ||
    getFeedByUrl(toRsshubProtocolUrl(normalizedUrl)) ||
    getFeedByUrl(legacyStoredUrl) ||
    getFeedByUrl(normalizedLegacyUrl) ||
    getFeedByUrl(toRsshubProtocolUrl(normalizedLegacyUrl))

  if (existingFeed) {
    const upgradedUrl = ensureTwitterUserFeedLimit(
      ensureInstagramUserFeedLimit(existingFeed.url, 100),
      120,
    )
    if (upgradedUrl !== existingFeed.url) {
      updateFeed(existingFeed.id, { url: upgradedUrl })
      const updated = getFeedById(existingFeed.id)
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
  let parsed: Awaited<ReturnType<typeof fetchAndParseFeed>>['data'] | null =
    null
  try {
    parsed = (await fetchAndParseFeed(normalizedUrl)).data
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
  const imageUrl = await resolveFeedAvatar(
    normalizedUrl,
    parsed ? getFeedImageUrl(parsed) : undefined,
  )

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
  insertFeed(feed)

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
    entriesInserted = insertEntries(entries)
  }

  return {
    feedId: id,
    feedTitle: feed.title,
    feed,
    existed: false,
    entriesInserted,
    fetched: !!parsed,
  }
}
