import { describe, expect, it } from 'vitest'
import type { Entry } from '../../shared/types'
import { buildEntryIndexes, makeEntryUrlKey } from './indexes'

function createEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/post',
    publishedAt: 1_000,
    isRead: false,
    isStarred: false,
    createdAt: 1_000,
    ...overrides,
  }
}

describe('database indexes', () => {
  it('builds feed and unread indexes ordered by published time desc', () => {
    const entries = [
      createEntry({
        id: 'old',
        url: 'https://example.com/old',
        publishedAt: 1_000,
      }),
      createEntry({
        id: 'read-new',
        url: 'https://example.com/read-new',
        publishedAt: 3_000,
        isRead: true,
      }),
      createEntry({
        id: 'unread-new',
        url: 'https://example.com/unread-new',
        publishedAt: 2_000,
      }),
      createEntry({
        id: 'other-feed',
        feedId: 'feed-2',
        url: 'https://example.net/post',
        publishedAt: 4_000,
      }),
    ]

    const indexes = buildEntryIndexes(
      entries,
      (entry) => `${entry.feedId}:${entry.url}`,
    )

    expect(
      indexes.entriesByFeedIdPublishedDesc
        .get('feed-1')
        ?.map((entry) => entry.id),
    ).toEqual(['read-new', 'unread-new', 'old'])
    expect(
      indexes.unreadEntriesByPublishedDesc.map((entry) => entry.id),
    ).toEqual(['other-feed', 'unread-new', 'old'])
    expect(indexes.unreadCountByFeedId.get('feed-1')).toBe(2)
    expect(indexes.unreadCountByFeedId.get('feed-2')).toBe(1)
  })

  it('keeps url, identity and starred indexes in the same pass', () => {
    const entries = [
      createEntry({
        id: 'starred',
        url: 'https://example.com/starred',
        publishedAt: 2_000,
        isStarred: true,
      }),
      createEntry({
        id: 'plain',
        url: 'https://example.com/plain',
        publishedAt: 3_000,
      }),
    ]

    const indexes = buildEntryIndexes(
      entries,
      (entry) => `${entry.feedId}:${entry.url}`,
    )

    expect(
      indexes.entryByFeedUrlIndex.get(
        makeEntryUrlKey('feed-1', 'https://example.com/plain'),
      )?.id,
    ).toBe('plain')
    expect(
      indexes.entryByFeedIdentityIndex.get('feed-1:https://example.com/starred')
        ?.id,
    ).toBe('starred')
    expect(
      indexes.starredEntriesByPublishedDesc.map((entry) => entry.id),
    ).toEqual(['starred'])
  })
})
