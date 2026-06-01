import type { Entry, Feed } from '../../shared/types'

export interface CleanupOptions {
  entriesPerFeed: number
  maxEntryAgeDays: number
}

export interface CleanupStats {
  removed: number
  removedByCap: number
  removedByAge: number
  remaining: number
}

export function cleanupDatabaseEntries(
  feeds: Feed[],
  entries: Entry[],
  options: CleanupOptions,
): { entries: Entry[]; stats: CleanupStats } {
  const { entriesPerFeed, maxEntryAgeDays } = options
  const now = Date.now()
  const ageCutoff =
    maxEntryAgeDays > 0 ? now - maxEntryAgeDays * 24 * 60 * 60 * 1000 : 0
  let removed = 0
  let removedByCap = 0
  let removedByAge = 0
  let nextEntries = entries

  const feedCapMap = new Map<string, number>()
  for (const feed of feeds) {
    feedCapMap.set(
      feed.id,
      feed.maxEntries != null && feed.maxEntries > 0
        ? feed.maxEntries
        : entriesPerFeed,
    )
  }

  const hasAnyCapLimit =
    entriesPerFeed > 0 ||
    feeds.some((feed) => feed.maxEntries != null && feed.maxEntries > 0)
  if (ageCutoff > 0 && hasAnyCapLimit) {
    const byFeed = new Map<string, Entry[]>()
    for (const entry of entries) {
      const bucket = byFeed.get(entry.feedId)
      if (bucket) {
        bucket.push(entry)
      } else {
        byFeed.set(entry.feedId, [entry])
      }
    }

    const overCapIds = new Set<string>()
    const overAgeIds = new Set<string>()
    for (const [feedId, feedEntries] of byFeed) {
      const cap = feedCapMap.get(feedId) ?? entriesPerFeed
      feedEntries.sort((a, b) => b.publishedAt - a.publishedAt)
      if (cap > 0 && feedEntries.length > cap) {
        for (let i = cap; i < feedEntries.length; i++) {
          overCapIds.add(feedEntries[i].id)
        }
      }
      for (const entry of feedEntries) {
        if (entry.publishedAt < ageCutoff) {
          overAgeIds.add(entry.id)
        }
      }
    }

    const toRemoveIds = new Set<string>()
    for (const id of overCapIds) {
      if (overAgeIds.has(id)) {
        toRemoveIds.add(id)
      }
    }

    if (toRemoveIds.size > 0) {
      nextEntries = entries.filter((entry) => !toRemoveIds.has(entry.id))
      removed = toRemoveIds.size
      removedByCap = toRemoveIds.size
      removedByAge = toRemoveIds.size
    }
  }

  return {
    entries: nextEntries,
    stats: {
      removed,
      removedByCap,
      removedByAge,
      remaining: nextEntries.length,
    },
  }
}
