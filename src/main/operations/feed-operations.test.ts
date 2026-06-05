import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Feed } from '../../shared/types'
import { FeedViewType } from '../../shared/types'
import { refreshAllFeeds, refreshFeed, removeFeed } from './feed-operations'

const getDbMock = vi.hoisted(() => vi.fn())
const refreshSingleFeedMock = vi.hoisted(() => vi.fn())
const refreshAllFeedsTaskMock = vi.hoisted(() => vi.fn())

vi.mock('../database', () => ({
  getDb: getDbMock,
}))

vi.mock('../services/feed/feed-refresh', () => ({
  bootstrapFeedEntries: vi.fn(),
  queueBootstrapRefresh: vi.fn(),
  refreshSingleFeed: refreshSingleFeedMock,
  refreshAllFeeds: refreshAllFeedsTaskMock,
}))

function makeFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    title: 'Tech Feed',
    url: 'https://example.com/feed.xml',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1,
    ...overrides,
  }
}

function mockDb(feed: Feed | null = makeFeed()) {
  const feeds = {
    getFeedById: vi.fn().mockReturnValue(feed ?? undefined),
    deleteFeed: vi.fn(),
  }
  const entries = {
    getEntries: vi.fn().mockReturnValue({
      entries: feed ? [{ id: 'entry-1', feedId: feed.id }] : [],
      hasMore: false,
    }),
    getUnreadCount: vi.fn().mockReturnValue(3),
  }
  getDbMock.mockReturnValue({ feeds, entries })
  return { feeds, entries }
}

describe('feed operations', () => {
  beforeEach(() => {
    getDbMock.mockReset()
    refreshSingleFeedMock.mockReset()
    refreshAllFeedsTaskMock.mockReset()
  })

  it('removes an existing Feed and returns confirmation data', () => {
    const feed = makeFeed()
    const db = mockDb(feed)

    expect(removeFeed(feed.id)).toEqual({ feed, entryCount: 1 })
    expect(db.feeds.deleteFeed).toHaveBeenCalledWith(feed.id)
  })

  it('returns null when removing a missing Feed', () => {
    const db = mockDb(null)

    expect(removeFeed('missing-feed')).toBeNull()
    expect(db.feeds.deleteFeed).not.toHaveBeenCalled()
  })

  it('refreshes one Feed through the shared refresh Module', async () => {
    const feed = makeFeed()
    const refreshed = { ...feed, title: 'Updated Feed' }
    const db = mockDb(feed)
    db.feeds.getFeedById
      .mockReturnValueOnce(feed)
      .mockReturnValueOnce(refreshed)
    refreshSingleFeedMock.mockResolvedValue(2)

    await expect(refreshFeed(feed.id)).resolves.toEqual({
      feed: refreshed,
      newEntries: 2,
      unreadCount: 3,
    })
    expect(refreshSingleFeedMock).toHaveBeenCalledWith(feed, { force: true })
  })

  it('delegates batch refresh to the Task Runner backed refresh Module', async () => {
    const result = {
      totalFeeds: 4,
      refreshedCount: 3,
      failedCount: 1,
      failedFeedTitles: ['Broken Feed'],
      totalNewEntries: 8,
      items: [],
      runId: 'feed.refresh_all-1',
    }
    refreshAllFeedsTaskMock.mockResolvedValue(result)

    await expect(refreshAllFeeds({ force: true })).resolves.toBe(result)
    expect(refreshAllFeedsTaskMock).toHaveBeenCalledWith({ force: true })
  })
})
