import type { HomeEntryMode } from './HomeEntryModeUtils'
import { modeMatchesFeedView } from './HomeEntryModeUtils'

export function deduplicateEntryCards<T>(
  cards: T[],
  keyOf: (card: T) => string,
): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []
  cards.forEach((card: T) => {
    const key = keyOf(card)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    deduped.push(card)
  })
  return deduped
}

export interface FeedLike {
  id: string
  view: number
}

export function allowedFeedsForMode(
  feeds: FeedLike[],
  mode: HomeEntryMode,
): FeedLike[] {
  return feeds.filter((feed: FeedLike) => modeMatchesFeedView(mode, feed.view))
}

export function groupModeCardsByFeed<T extends { feedId: string }>(
  cards: T[],
  allowedFeeds: FeedLike[],
): Map<string, T[]> {
  const buckets = new Map<string, T[]>()
  allowedFeeds.forEach((feed: FeedLike) => {
    buckets.set(feed.id, [])
  })
  cards.forEach((card: T) => {
    const bucket = buckets.get(card.feedId)
    if (bucket) {
      bucket.push(card)
    }
  })
  return buckets
}

export function roundRobinFeedCards<T>(
  buckets: Map<string, T[]>,
  feedIds: string[],
  targetCount: number,
  keyOf: (card: T) => string,
  sortBy?: (a: T, b: T) => number,
): T[] {
  const result: T[] = []
  const seen = new Set<string>()
  let progressed = true

  while (result.length < targetCount && progressed) {
    progressed = false
    feedIds.forEach((feedId: string) => {
      if (result.length >= targetCount) {
        return
      }
      const bucket = buckets.get(feedId)
      if (!bucket || bucket.length === 0) {
        return
      }
      const card = bucket.shift()
      if (!card) {
        return
      }
      const key = keyOf(card)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      result.push(card)
      progressed = true
    })
  }

  if (sortBy) {
    result.sort(sortBy)
  }
  return result
}
