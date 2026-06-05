import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry, Feed } from '../../../shared/types/index'
import { FeedViewType } from '../../../shared/types/index'
import { getReaderSnapshot } from './reader-snapshot'

const mocks = vi.hoisted(() => ({
  getUnreadCountMap: vi.fn(),
  getEntries: vi.fn(),
  getAllFeeds: vi.fn(),
  listRecentRuns: vi.fn(),
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

vi.mock('../system/task-runner-service', () => ({
  getLocalTaskRunner: () => ({
    listRecentRuns: mocks.listRecentRuns,
  }),
}))

function makeFeed(partial: Partial<Feed> = {}): Feed {
  return {
    id: partial.id ?? 'feed-1',
    title: partial.title ?? 'Feed title',
    url: partial.url ?? 'https://example.com/feed.xml',
    imageUrl: partial.imageUrl,
    view: partial.view ?? FeedViewType.Articles,
    lastRefreshStatus: partial.lastRefreshStatus,
    lastRefreshAttemptedAt: partial.lastRefreshAttemptedAt,
    lastRefreshError: partial.lastRefreshError,
    lastRefreshRawError: partial.lastRefreshRawError,
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
    authorAvatar: partial.authorAvatar,
    imageUrl: partial.imageUrl,
    media: partial.media,
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
    mocks.listRecentRuns.mockReturnValue([])
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

  it('returns feed refresh status fields', () => {
    mocks.getAllFeeds.mockReturnValue([
      makeFeed({
        lastRefreshStatus: 'failed',
        lastRefreshAttemptedAt: 3000,
        lastRefreshError: '源站返回 HTTP 403',
        lastRefreshRawError: 'HTTPError: 403 Forbidden',
      }),
    ])

    const snapshot = getReaderSnapshot({ limit: 10 })

    expect(snapshot.feeds[0]).toMatchObject({
      id: 'feed-1',
      unreadCount: 1,
      lastRefreshStatus: 'failed',
      lastRefreshAttemptedAt: 3000,
      lastRefreshError: '源站返回 HTTP 403',
      lastRefreshRawError: 'HTTPError: 403 Forbidden',
    })
  })

  it('hides feed avatars and entry author avatars polluted by article images', () => {
    const articleCover = 'https://cdn.example.com/latest-cover.webp'
    mocks.getAllFeeds.mockReturnValue([
      makeFeed({
        imageUrl: articleCover,
      }),
    ])
    mocks.getEntries.mockReturnValue({
      entries: [
        makeEntry({
          id: 'entry-latest',
          imageUrl: articleCover,
          authorAvatar: articleCover,
        }),
        makeEntry({
          id: 'entry-older',
          imageUrl: 'https://cdn.example.com/older-cover.webp',
          authorAvatar: articleCover,
        }),
      ],
      hasMore: false,
    })

    const snapshot = getReaderSnapshot({ limit: 10 })

    expect(snapshot.feeds[0].imageUrl).toBeUndefined()
    expect(snapshot.entries.map((entry) => entry.authorAvatar)).toEqual([
      '',
      '',
    ])
  })

  it('uses v2 keyset cursor for the next page and ignores v1 cursors', () => {
    mocks.getEntries.mockReturnValueOnce({
      entries: [makeEntry({ id: 'entry-2', publishedAt: 2000 })],
      hasMore: true,
      nextCursorEntry: { id: 'entry-2', publishedAt: 2000 },
    })

    const first = getReaderSnapshot({ limit: 1 })
    expect(first.nextCursor).toBeTruthy()

    getReaderSnapshot({ limit: 1, cursor: first.nextCursor })
    expect(mocks.getEntries.mock.calls[1][0]).toMatchObject({
      beforePublishedAt: 2000,
      beforeId: 'entry-2',
    })

    const v1Cursor = Buffer.from(
      JSON.stringify({ v: 1, offset: 10, queryKey: 'old' }),
      'utf8',
    ).toString('base64url')
    getReaderSnapshot({ limit: 1, cursor: v1Cursor })
    expect(mocks.getEntries.mock.calls[2][0]).toMatchObject({
      beforePublishedAt: undefined,
      beforeId: undefined,
    })
  })

  it('merges active entry tasks into task snapshots', () => {
    mocks.getEntries.mockReturnValue({
      entries: [makeEntry({ id: 'entry-active' })],
      hasMore: false,
    })
    mocks.listRecentRuns.mockReturnValue([
      {
        runId: 'entry-fulltext-fetch-1',
        taskName: 'entry.fulltext_fetch',
        status: 'running',
        attempt: 1,
        maxAttempts: 1,
        createdAt: 1000,
        updatedAt: 2000,
        metadata: {
          entryId: 'entry-active',
          entryTaskKind: 'fulltext',
        },
      },
    ])

    const snapshot = getReaderSnapshot({ limit: 10 })

    expect(snapshot.entries[0].taskSnapshot.fulltext).toMatchObject({
      status: 'running',
      updatedAt: 2000,
    })
  })
})
