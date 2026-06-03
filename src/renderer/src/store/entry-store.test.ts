import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Entry,
  EntryListResult,
  FeedWithCount,
  ReaderSnapshot,
} from '../../../shared/types'

function makeEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: partial.id ?? 'entry-1',
    feedId: partial.feedId ?? 'feed-1',
    title: partial.title ?? 'Entry title',
    url: partial.url ?? 'https://example.com/entry-1',
    content: partial.content,
    summary: partial.summary,
    author: partial.author,
    imageUrl: partial.imageUrl,
    media: partial.media,
    publishedAt: partial.publishedAt ?? 1000,
    isRead: partial.isRead ?? true,
    isStarred: partial.isStarred ?? false,
    readProgress: partial.readProgress,
    createdAt: partial.createdAt ?? 1000,
  }
}

async function loadEntryStore(options: {
  listResults: EntryListResult[]
  detailResult: Entry
  snapshotResults?: ReaderSnapshot[]
}) {
  vi.resetModules()

  const listResults = [...options.listResults]
  const snapshotResults = [...(options.snapshotResults || [])]
  const api = {
    entries: {
      list: vi.fn(
        async () => listResults.shift() ?? options.listResults.at(-1)!,
      ),
      get: vi.fn(async () => options.detailResult),
      markRead: vi.fn(async () => undefined),
      markAllRead: vi.fn(async () => undefined),
      toggleStar: vi.fn(async () => ({ isStarred: true })),
      saveProgress: vi.fn(async () => undefined),
      search: vi.fn(async () => []),
    },
    reader: {
      snapshot: vi.fn(async () => {
        const result =
          snapshotResults.shift() ?? options.snapshotResults?.at(-1)
        if (!result) throw new Error('No snapshot result')
        return result
      }),
    },
    feeds: {
      refresh: vi.fn(async () => undefined),
    },
  }

  vi.stubGlobal('window', { api })
  const mod = await import('./entry-store')
  return { useEntryStore: mod.useEntryStore, api }
}

function makeFeed(partial: Partial<FeedWithCount> = {}): FeedWithCount {
  return {
    id: partial.id ?? 'feed-1',
    title: partial.title ?? 'Feed title',
    url: partial.url ?? 'https://example.com/feed.xml',
    view: partial.view ?? 0,
    errorCount: partial.errorCount ?? 0,
    createdAt: partial.createdAt ?? 1000,
    unreadCount: partial.unreadCount ?? 0,
  }
}

describe('useEntryStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps cached detail content while applying newer list snapshot state', async () => {
    const compact = makeEntry({
      content: 'compact body',
      isStarred: false,
    })
    const full = makeEntry({
      content: 'full article body',
      isStarred: false,
    })
    const refreshedCompact = makeEntry({
      content: 'new compact body',
      isStarred: true,
      readProgress: 45,
    })

    const { useEntryStore, api } = await loadEntryStore({
      listResults: [
        { entries: [compact], hasMore: false },
        { entries: [refreshedCompact], hasMore: false },
      ],
      detailResult: full,
    })
    const store = useEntryStore.getState()

    await store.loadEntries({ limit: 10 })
    await useEntryStore.getState().selectEntry(compact)
    expect(useEntryStore.getState().selectedEntry).toMatchObject({
      content: 'full article body',
      isStarred: false,
    })
    expect(api.entries.get).toHaveBeenCalledTimes(1)

    await useEntryStore.getState().selectEntry(null)
    useEntryStore.getState().clearListCache()
    await useEntryStore.getState().loadEntries({ limit: 10 })

    const refreshedListEntry = useEntryStore.getState().entries[0]
    await useEntryStore.getState().selectEntry(refreshedListEntry)

    expect(api.entries.get).toHaveBeenCalledTimes(1)
    expect(useEntryStore.getState().selectedEntry).toMatchObject({
      content: 'full article body',
      isStarred: true,
      readProgress: 45,
    })
  })

  it('loads and paginates reader snapshots', async () => {
    const first = makeEntry({
      id: 'entry-1',
      title: 'First',
      publishedAt: 2000,
    })
    const second = makeEntry({
      id: 'entry-2',
      title: 'Second',
      publishedAt: 1000,
    })
    const { useEntryStore, api } = await loadEntryStore({
      listResults: [],
      detailResult: first,
      snapshotResults: [
        {
          feeds: [makeFeed({ unreadCount: 2 })],
          entries: [first],
          counts: {
            totalFeeds: 1,
            totalUnread: 2,
            unreadByFeedId: { 'feed-1': 2 },
            scopeUnread: 2,
          },
          nextCursor: 'cursor-1',
        },
        {
          feeds: [makeFeed({ unreadCount: 2 })],
          entries: [second],
          counts: {
            totalFeeds: 1,
            totalUnread: 2,
            unreadByFeedId: { 'feed-1': 2 },
            scopeUnread: 2,
          },
          nextCursor: null,
        },
      ],
    })

    await useEntryStore.getState().loadSnapshot({ limit: 1 })
    expect(useEntryStore.getState().entries.map((entry) => entry.id)).toEqual([
      'entry-1',
    ])
    expect(useEntryStore.getState().hasMoreEntries).toBe(true)

    await useEntryStore.getState().loadMoreEntries()
    expect(useEntryStore.getState().entries.map((entry) => entry.id)).toEqual([
      'entry-1',
      'entry-2',
    ])
    expect(useEntryStore.getState().hasMoreEntries).toBe(false)
    expect(api.reader.snapshot).toHaveBeenLastCalledWith({
      scope: { type: 'all', feedIds: undefined },
      limit: 1,
      cursor: 'cursor-1',
      unreadOnly: undefined,
      compact: true,
      maxContentLength: 520,
    })
  })
})
