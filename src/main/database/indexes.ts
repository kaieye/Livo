import type { Entry, Feed } from '../../shared/types'

function makeEntryUrlKey(feedId: string, url: string): string {
  return `${feedId}\n${url}`
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
} {
  const entryByFeedUrlIndex = new Map<string, Entry>()
  const entryByFeedIdentityIndex = new Map<string, Entry>()

  for (const entry of entries) {
    if (entry.url) {
      entryByFeedUrlIndex.set(makeEntryUrlKey(entry.feedId, entry.url), entry)
    }
    const identityKey = makeEntryIdentityKey(entry)
    if (identityKey) {
      entryByFeedIdentityIndex.set(identityKey, entry)
    }
  }

  return {
    entryByFeedUrlIndex,
    entryByFeedIdentityIndex,
  }
}
