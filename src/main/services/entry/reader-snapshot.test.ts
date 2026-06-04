import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry, Feed } from '../../../shared/types/index'
import { FeedViewType } from '../../../shared/types/index'
import { getReaderSnapshot } from './reader-snapshot'

const mocks = vi.hoisted(() => ({
  getUnreadCountMap: vi.fn(),
  getEntries: vi.fn(),
  getAllFeeds: vi.fn(),
}))

vi.mock('../../database', () => ({
  getDb: () => ({
    entries: {
      getUnreadCountMap: mocks.getUnreadCountMap,
      getEntries: mocks.getEntries,
    },
    feeds: {
      getAllFeeds: mocks.getAllFeeds,
    },
  }),
}))

function makeFeed(partial: Partial<Feed> = {}): Feed {
  return {
    id: partial.id ?? 'feed-1',
    title: partial.title ?? 'Feed title',
    url: partial.url ?? 'https://example.com/feed.xml',
    view: partial.view ?? FeedViewType.Articles,
    errorCount: partial.errorCount ?? 0,
    createdAt: partial.createdAt ?? 1000,
  }
}

function makeEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: partial.id ?? 'entry-1',
    feedId: partial.feedId ?? 'feed-1',
    title: partial.title ?? 'Entry title',
    url: partial.url ?? 'https://example.com/entry',
    content: partial.content,
    readabilityContent: partial.readabilityContent,
    readabilityFetchedAt: partial.readabilityFetchedAt,
    aiSummaryError: partial.aiSummaryError,
    publishedAt: partial.publishedAt ?? 1000,
    isRead: partial.isRead ?? false,
    isStarred: partial.isStarred ?? false,
    createdAt: partial.createdAt ?? 1000,
  }
}

describe('getReaderSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllFeeds.mockReturnValue([makeFeed()])
    mocks.getUnreadCountMap.mockReturnValue(new Map([['feed-1', 1]]))
    mocks.getEntries.mockReturnValue({ entries: [], hasMore: false })
  })

  it('returns task snapshots for entries', () => {
    mocks.getEntries.mockReturnValue({
      entries: [
        makeEntry({
          readabilityContent: '<p>Readable body</p>',
          readabilityFetchedAt: 2000,
          aiSummaryError: 'No API key',
        }),
      ],
      hasMore: false,
    })

    const snapshot = getReaderSnapshot({ limit: 10 })

    expect(snapshot.entries[0]).toMatchObject({
      id: 'entry-1',
      taskSnapshot: {
        fulltext: { status: 'succeeded', updatedAt: 2000 },
        aiSummary: { status: 'failed', error: 'No API key' },
      },
    })
  })
})
