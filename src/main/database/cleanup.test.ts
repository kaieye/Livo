import { describe, expect, it } from 'vitest'
import type { Entry, Feed } from '../../shared/types'
import { FeedViewType } from '../../shared/types'
import { cleanupDatabaseEntries } from './cleanup'

function createFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    title: 'Feed',
    url: 'https://example.com/rss',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

function createEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: `entry-${Math.random()}`,
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/post',
    publishedAt: Date.now(),
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('cleanupDatabaseEntries', () => {
  it('removes entries only when both age and cap conditions match', () => {
    const now = Date.now()
    const feed = createFeed()
    const entries = [
      createEntry({ id: 'new-1', publishedAt: now - 1_000 }),
      createEntry({
        id: 'new-2',
        publishedAt: now - 2_000,
        url: 'https://example.com/post-2',
      }),
      createEntry({
        id: 'old-over-cap',
        publishedAt: now - 100 * 24 * 60 * 60 * 1000,
        url: 'https://example.com/post-3',
      }),
      createEntry({
        id: 'old-but-kept',
        publishedAt: now - 101 * 24 * 60 * 60 * 1000,
        url: 'https://example.com/post-4',
      }),
    ]

    const result = cleanupDatabaseEntries([feed], entries, {
      entriesPerFeed: 3,
      maxEntryAgeDays: 90,
    })

    expect(result.stats.removed).toBe(1)
    expect(result.entries.map((entry) => entry.id)).not.toContain(
      'old-but-kept',
    )
  })
})
