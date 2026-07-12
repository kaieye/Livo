import { describe, expect, it, vi } from 'vitest'
import type { ReaderSnapshot } from '../../../shared/types'
import { loadHomeFeedSnapshot } from './useHomeFeedCoordinator'

function snapshot(options: { entryId?: string } = {}): ReaderSnapshot {
  const entries = options.entryId
    ? [
        {
          id: options.entryId,
          feedId: 'feed-1',
          title: 'Entry',
          url: 'https://example.com/entry',
          publishedAt: 1000,
          isRead: false,
          isStarred: false,
          createdAt: 1000,
          taskSnapshot: {
            fulltext: { status: 'idle' as const },
            aiSummary: { status: 'idle' as const },
          },
        },
      ]
    : []

  return {
    feeds: [
      {
        id: 'feed-1',
        title: 'Feed',
        url: 'https://example.com/feed.xml',
        view: 0,
        errorCount: 0,
        createdAt: 1000,
        unreadCount: entries.length,
      },
    ],
    entries,
    counts: {
      totalFeeds: 1,
      totalUnread: entries.length,
      unreadByFeedId: { 'feed-1': entries.length },
      scopeUnread: entries.length,
    },
    nextCursor: null,
  }
}

describe('loadHomeFeedSnapshot', () => {
  it('revalidates an empty persisted snapshot so startup can reveal existing articles', async () => {
    const cachedSnapshot = snapshot()
    const freshSnapshot = snapshot({ entryId: 'entry-fresh' })
    const applySnapshotFeeds = vi.fn()
    const loadSnapshot = vi.fn(async () => freshSnapshot)
    const waitForHydration = vi.fn(async () => undefined)

    await loadHomeFeedSnapshot({
      options: { limit: 80 },
      hydrateSnapshotCache: vi.fn(() => cachedSnapshot),
      loadSnapshot,
      applySnapshotFeeds,
      waitForHydration,
    })

    expect(applySnapshotFeeds).toHaveBeenNthCalledWith(1, cachedSnapshot.feeds)
    expect(waitForHydration).toHaveBeenCalledTimes(1)
    expect(loadSnapshot).toHaveBeenCalledWith({ limit: 80 })
    expect(applySnapshotFeeds).toHaveBeenNthCalledWith(2, freshSnapshot.feeds)
  })
})
