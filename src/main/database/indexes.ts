import type { Entry, Feed } from '../../shared/types'

export function makeEntryUrlKey(feedId: string, url: string): string {
  return `${feedId}\n${url}`
}

function compareByPublishedDesc(a: Entry, b: Entry): number {
  return (b.publishedAt || 0) - (a.publishedAt || 0)
}

export function buildFeedByUrlIndex(feeds: Feed[]): Map<string, Feed> {
  const index = new Map<string, Feed>()
  for (const feed of feeds) {
    index.set(feed.url, feed)
  }
  return index
}

export function buildEntryIndexes(
  entries: Entry[],
  makeEntryIdentityKey: (entry: Entry) => string | null,
): {
  entryByFeedUrlIndex: Map<string, Entry>
  entryByFeedIdentityIndex: Map<string, Entry>
  entriesByFeedIdPublishedDesc: Map<string, Entry[]>
  unreadEntriesByPublishedDesc: Entry[]
  starredEntriesByPublishedDesc: Entry[]
  unreadCountByFeedId: Map<string, number>
} {
  const entryByFeedUrlIndex = new Map<string, Entry>()
  const entryByFeedIdentityIndex = new Map<string, Entry>()
  const entriesByFeedIdPublishedDesc = new Map<string, Entry[]>()
  const unreadEntriesByPublishedDesc: Entry[] = []
  const starredEntriesByPublishedDesc: Entry[] = []
  const unreadCountByFeedId = new Map<string, number>()

  for (const entry of entries) {
    if (entry.url) {
      entryByFeedUrlIndex.set(makeEntryUrlKey(entry.feedId, entry.url), entry)
    }
    const identityKey = makeEntryIdentityKey(entry)
    if (identityKey) {
      entryByFeedIdentityIndex.set(identityKey, entry)
    }

    const feedEntries = entriesByFeedIdPublishedDesc.get(entry.feedId) || []
    feedEntries.push(entry)
    entriesByFeedIdPublishedDesc.set(entry.feedId, feedEntries)

    if (!entry.isRead) {
      unreadEntriesByPublishedDesc.push(entry)
      unreadCountByFeedId.set(
        entry.feedId,
        (unreadCountByFeedId.get(entry.feedId) || 0) + 1,
      )
    }
    if (entry.isStarred) {
      starredEntriesByPublishedDesc.push(entry)
    }
  }

  for (const feedEntries of entriesByFeedIdPublishedDesc.values()) {
    feedEntries.sort(compareByPublishedDesc)
  }
  unreadEntriesByPublishedDesc.sort(compareByPublishedDesc)
  starredEntriesByPublishedDesc.sort(compareByPublishedDesc)

  return {
    entryByFeedUrlIndex,
    entryByFeedIdentityIndex,
    entriesByFeedIdPublishedDesc,
    unreadEntriesByPublishedDesc,
    starredEntriesByPublishedDesc,
    unreadCountByFeedId,
  }
}
