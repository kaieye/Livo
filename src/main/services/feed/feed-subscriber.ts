import { v4 as uuidv4 } from 'uuid'
import { FeedViewType, type Feed } from '../../../shared/types'
import { getDb } from '../../database'
import { fetchAndParseFeed } from './rss-parser'
import { buildEntriesFromParsedItems } from '../entry/entry-builder'
import { getImmediateFeedAvatar, resolveFeedAvatar } from './feed-avatar'
import { getFeedImageUrl } from './feed-utils'
import { detectViewType } from './feed-view'
import { formatFeedTitle } from './feed-title'
import { resolveFeedTitleFallback } from './feed-title-resolver'
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
import { rewriteWechatMpFeedUrlToBackendProxy } from './wechat-mp-feed-url'

export interface SubscribeFeedOptions {
  url: string
  title?: string
  category?: string
  view?: FeedViewType
  /** Skip the initial network fetch and insert an optimistic feed record so it
   *  appears in the list instantly. The caller is responsible for queueing a
   *  background bootstrap that performs the real fetch + entry ingestion. */
  deferInitialFetch?: boolean
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
  /** True when the feed was inserted optimistically and the initial fetch was deferred. */
  deferred: boolean
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
  const originalProtocolUrl = toRsshubProtocolUrl(url)
  const rawProtocolUrl =
    rewriteWechatMpFeedUrlToBackendProxy(originalProtocolUrl)
  const limitedProtocolUrl = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(rawProtocolUrl, 100),
    120,
  )
  const storedUrl = limitedProtocolUrl
  const legacyStoredUrl = originalProtocolUrl
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
    const upgradedUrl = rewriteWechatMpFeedUrlToBackendProxy(
      ensureTwitterUserFeedLimit(
        ensureInstagramUserFeedLimit(existingFeed.url, 100),
        120,
      ),
    )
    if (upgradedUrl !== existingFeed.url) {
      getDb().feeds.updateFeed(existingFeed.id, {
        url: upgradedUrl,
        upstreamUrl: upgradedUrl,
      })
      const updated = getDb().feeds.getFeedById(existingFeed.id)
      if (updated) {
        return {
          feedId: updated.id,
          feedTitle: updated.title,
          feed: updated,
          existed: true,
          entriesInserted: 0,
          fetched: false,
          deferred: false,
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
      deferred: false,
    }
  }

  // ---- Optimistic insert (deferred fetch) ----
  // Insert the feed without waiting for the network so the subscription appears
  // instantly; the caller queues a background bootstrap to fetch + ingest entries.
  if (options.deferInitialFetch) {
    const routeView = inferDiscoverFeedViewFromUrl(normalizedUrl)
    const optimisticView =
      routeView !== FeedViewType.Articles
        ? routeView
        : (options.view ?? FeedViewType.Articles)
    const optimisticId = uuidv4()
    const optimisticFeed: Feed = {
      id: optimisticId,
      title: formatFeedTitle(storedUrl, undefined, options.title || storedUrl),
      url: storedUrl,
      upstreamUrl: rawProtocolUrl,
      siteUrl: undefined,
      description: undefined,
      imageUrl: getImmediateFeedAvatar(normalizedUrl),
      folder: options.category || '',
      category: options.category || '',
      view: optimisticView,
      fetchSource: 'auto',
      showInAll: true,
      lastFetched: 0,
      errorCount: 0,
      createdAt: Date.now(),
    }
    getDb().feeds.insertFeed(optimisticFeed)

    // 后台异步解析真实订阅源名称（不阻塞订阅流程）
    resolveFeedTitleFallback(storedUrl)
      .then((resolvedTitle) => {
        if (resolvedTitle) {
          getDb().feeds.updateFeed(optimisticId, { title: resolvedTitle })
          const updatedFeed = getDb().feeds.getFeedById(optimisticId)
          getEventBus().send('feeds:updated', {
            feedId: optimisticId,
            feedIds: [optimisticId],
            feeds: updatedFeed
              ? [{ id: updatedFeed.id, title: updatedFeed.title }]
              : undefined,
          })
        }
      })
      .catch(() => {
        // 静默失败：标题解析失败不影响订阅
      })

    return {
      feedId: optimisticId,
      feedTitle: optimisticFeed.title,
      feed: optimisticFeed,
      existed: false,
      entriesInserted: 0,
      fetched: false,
      deferred: true,
    }
  }

  // ---- Fetch + parse ----
  const now = Date.now()
  const fetchUrl = /^https?:\/\//i.test(rawProtocolUrl)
    ? rawProtocolUrl
    : normalizedUrl
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
    upstreamUrl: rawProtocolUrl,
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

  // 如果标题看起来只是用户名（没有空格或太短），后台尝试解析真实名称
  const currentTitle = feed.title
  const looksLikeUsername =
    currentTitle &&
    !currentTitle.includes(' ') &&
    (currentTitle.endsWith(' - X') ||
      currentTitle.endsWith(' - Ins') ||
      currentTitle.endsWith(' - Bilibili'))
  if (looksLikeUsername) {
    resolveFeedTitleFallback(storedUrl)
      .then((resolvedTitle) => {
        if (resolvedTitle && resolvedTitle !== currentTitle) {
          getDb().feeds.updateFeed(id, { title: resolvedTitle })
          const updatedFeed = getDb().feeds.getFeedById(id)
          getEventBus().send('feeds:updated', {
            feedId: id,
            feedIds: [id],
            feeds: updatedFeed
              ? [{ id: updatedFeed.id, title: updatedFeed.title }]
              : undefined,
          })
        }
      })
      .catch(() => {
        // 静默失败
      })
  }

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
        // PERF: Send incremental update with feed patch
        const updatedFeed = getDb().feeds.getFeedById(id)
        getEventBus().send('feeds:updated', {
          feedId: id,
          feedIds: [id],
          feeds: updatedFeed
            ? [{ id: updatedFeed.id, imageUrl: updatedFeed.imageUrl }]
            : undefined,
        })
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
    deferred: false,
  }
}
