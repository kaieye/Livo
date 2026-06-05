/**
 * Shared feed operations used by both IPC handlers and Agent tools.
 * Each function owns the complete orchestration — both callers become thin adapters.
 */
import type { Feed, FeedViewType } from '../../shared/types'
import { getDb } from '../database'
import { settingsProvider } from '../services/system/settings-provider'
import { subscribeFeed } from '../services/feed/feed-subscriber'
import {
  bootstrapFeedEntries,
  queueBootstrapRefresh,
  refreshAllFeeds as refreshAllFeedsTask,
  refreshSingleFeed,
  type RefreshAllResult as FeedRefreshAllResult,
  type RefreshOptions,
  type RefreshProgressEvent,
} from '../services/feed/feed-refresh'
import { queueVideoDurationEnrich } from '../services/video/video-duration'
import {
  inferDiscoverFeedViewFromUrl,
  getWarmupStrategy,
} from '../../shared/subscription-intake'
import { DEFAULT_RSSHUB_INSTANCE } from '../../shared/discover-data'
import { normalizeRsshubProtocolUrl } from '../services/feed/rsshub-url'
import { formatFeedTitle } from '../services/feed/feed-title'

export interface AddFeedInput {
  url: string
  title?: string
  category?: string
  view?: FeedViewType
}

export interface AddFeedResult {
  success: boolean
  feed: Feed
  existed: boolean
}

/**
 * Add (or re-subscribe to) a feed with full orchestration:
 * subscribe → warmup/bootstrap → video enrichment → view inference.
 */
export async function addFeed(input: AddFeedInput): Promise<AddFeedResult> {
  const outcome = await subscribeFeed({
    url: input.url.trim(),
    title: input.title,
    category: input.category,
    view: input.view,
  })

  const rsshubInstance =
    settingsProvider.get().general.rsshubInstance?.trim() ||
    DEFAULT_RSSHUB_INSTANCE

  if (outcome.existed) {
    const existingFeed = outcome.feed
    const normalizedUrl = normalizeRsshubProtocolUrl(
      existingFeed.url,
      rsshubInstance,
    )
    const wantsRecommended = (input.category || '') === 'Recommended'
    const updates: Partial<Feed> = {}
    const inferredView = inferDiscoverFeedViewFromUrl(normalizedUrl)

    if (existingFeed.category === 'Recommended' && !wantsRecommended) {
      updates.category = input.category || ''
      updates.folder = input.category || ''
    }

    const desiredView =
      inferredView !== 0 /* Articles */
        ? inferredView
        : (input.view ?? existingFeed.view)
    if (existingFeed.view !== desiredView) {
      updates.view = desiredView
    }
    if (input.title?.trim()) {
      updates.title = formatFeedTitle(
        existingFeed.url,
        undefined,
        input.title.trim(),
      )
    }

    if (Object.keys(updates).length > 0) {
      getDb().feeds.updateFeed(existingFeed.id, updates)
      const mergedFeed = { ...existingFeed, ...updates }
      const strategy = getWarmupStrategy(normalizedUrl, mergedFeed.view)
      if (strategy === 'deferred-queue') {
        queueBootstrapRefresh(mergedFeed, normalizedUrl, mergedFeed.view)
      } else {
        await bootstrapFeedEntries(mergedFeed, normalizedUrl, mergedFeed.view)
      }
      const refreshed = getDb().feeds.getFeedById(existingFeed.id)
      return { success: true, feed: refreshed ?? mergedFeed, existed: true }
    }

    const strategy = getWarmupStrategy(normalizedUrl, existingFeed.view)
    if (strategy === 'deferred-queue') {
      queueBootstrapRefresh(existingFeed, normalizedUrl, existingFeed.view)
    } else {
      await bootstrapFeedEntries(existingFeed, normalizedUrl, existingFeed.view)
    }
    const refreshed = getDb().feeds.getFeedById(existingFeed.id)
    return { success: true, feed: refreshed ?? existingFeed, existed: true }
  }

  // New feed
  const feed = outcome.feed
  const normalizedUrl = normalizeRsshubProtocolUrl(feed.url, rsshubInstance)

  if (
    outcome.fetched &&
    settingsProvider.get().data?.enrichVideoDuration &&
    feed.view === 2 /* Videos */
  ) {
    queueVideoDurationEnrich(feed.id).catch(() => {})
  }

  if (!outcome.fetched) {
    const strategy = getWarmupStrategy(normalizedUrl, feed.view)
    if (strategy === 'deferred-queue') {
      queueBootstrapRefresh(feed, normalizedUrl, feed.view)
    } else {
      await bootstrapFeedEntries(feed, normalizedUrl, feed.view)
    }
    const refreshed = getDb().feeds.getFeedById(feed.id)
    return { success: true, feed: refreshed ?? feed, existed: false }
  }

  return { success: true, feed, existed: false }
}

/**
 * Remove a feed by ID. Returns the feed title for confirmation messages.
 */
export function removeFeed(
  feedId: string,
): { feed: Feed; entryCount: number } | null {
  const feed = getDb().feeds.getFeedById(feedId)
  if (!feed) return null
  const { entries } = getDb().entries.getEntries({
    feedId,
    limit: 1,
    skipDedupe: true,
  })
  getDb().feeds.deleteFeed(feedId)
  return { feed, entryCount: entries.length }
}

export interface RefreshFeedResult {
  feed: Feed
  newEntries: number
  unreadCount: number
}

/** Refresh a single Feed and return the state needed by UI/Agent adapters. */
export async function refreshFeed(
  feedId: string,
): Promise<RefreshFeedResult | null> {
  const feed = getDb().feeds.getFeedById(feedId)
  if (!feed) return null

  const newEntries = await refreshSingleFeed(feed, { force: true })
  const refreshedFeed = getDb().feeds.getFeedById(feedId) ?? feed
  const unreadCount = getDb().entries.getUnreadCount(feedId)

  return { feed: refreshedFeed, newEntries, unreadCount }
}

export type RefreshAllFeedsInput = RefreshOptions & {
  onProgress?: (event: RefreshProgressEvent) => void
}

/** Refresh all Feeds through the shared Task Runner backed refresh Module. */
export async function refreshAllFeeds(
  input: RefreshAllFeedsInput = {},
): Promise<FeedRefreshAllResult & { runId: string }> {
  return refreshAllFeedsTask(input)
}
