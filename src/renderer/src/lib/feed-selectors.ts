import { FeedViewType, type FeedWithCount } from '../../../shared/types'

function normalizeFeedUrl(url: string | null | undefined): string {
  return (url || '').trim().replace(/\/+$/, '').toLowerCase()
}

export function buildFeedByIdMap(
  feeds: readonly FeedWithCount[],
): Map<string, FeedWithCount> {
  return new Map(feeds.map((feed) => [feed.id, feed] as const))
}

export function findFeedById(
  feeds: readonly FeedWithCount[],
  feedId: string | null | undefined,
): FeedWithCount | null {
  if (!feedId) return null
  return feeds.find((feed) => feed.id === feedId) ?? null
}

export function findFeedByUrl(
  feeds: readonly FeedWithCount[],
  url: string | null | undefined,
): FeedWithCount | null {
  const normalized = normalizeFeedUrl(url)
  if (!normalized) return null
  return feeds.find((feed) => normalizeFeedUrl(feed.url) === normalized) ?? null
}

export function getFeedsByView(
  feeds: readonly FeedWithCount[],
  view: FeedViewType | null,
  options?: { excludeCategory?: string },
): FeedWithCount[] {
  if (view === null) return [...feeds]
  return feeds.filter((feed) => {
    if (options?.excludeCategory && feed.category === options.excludeCategory) {
      return false
    }
    return (feed.view ?? FeedViewType.Articles) === view
  })
}
