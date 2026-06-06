import type { FeedWithCount } from '../../../shared/types'

function normalizeSearchText(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function scoreField(value: string | undefined, query: string, weight: number) {
  const normalized = normalizeSearchText(value)
  if (!normalized) return 0
  if (normalized === query) return weight + 40
  if (normalized.startsWith(query)) return weight + 20
  if (normalized.includes(query)) return weight
  return 0
}

function scoreFeed(feed: FeedWithCount, query: string): number {
  return (
    scoreField(feed.title, query, 100) +
    scoreField(feed.url, query, 50) +
    scoreField(feed.siteUrl, query, 40) +
    scoreField(feed.category, query, 30) +
    scoreField(feed.description, query, 10)
  )
}

export function rankFeedsForQuickSearch(
  feeds: FeedWithCount[],
  rawQuery: string,
  limit: number,
): FeedWithCount[] {
  const query = normalizeSearchText(rawQuery)
  if (!query) return []

  return feeds
    .map((feed, index) => ({
      feed,
      index,
      score: scoreFeed(feed, query),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((result) => result.feed)
}
