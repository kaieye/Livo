import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Entry,
  EntryListResult,
  FeedWithCount,
  ReaderSnapshot,
  ReaderSnapshotEntry,
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

function makeSnapshotEntry(
  partial: Partial<ReaderSnapshotEntry> = {},
): ReaderSnapshotEntry {
  return {
    ...makeEntry(partial),
    taskSnapshot: partial.taskSnapshot ?? {
      fulltext: { status: 'idle' },
      aiSummary: { status: 'idle' },
    },
  }
}

async function loadEntryStore(options: {
  listResults: EntryListResult[]
  detailResult: Entry
  snapshotResults?: ReaderSnapshot[]
  snapshotHandler?: () => Promise<ReaderSnapshot>
  localStorageItems?: Record<string, string>
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
      snapshot: vi.fn(
        options.snapshotHandler ??
          (async () => {
            const result =
              snapshotResults.shift() ?? options.snapshotResults?.at(-1)
            if (!result) throw new Error('No snapshot result')
            return result
          }),
      ),
    },
    feeds: {
      refresh: vi.fn(async () => undefined),
    },
  }

  vi.stubGlobal('window', {
    api,
    localStorage: createMemoryStorage(options.localStorageItems),
  })
  const mod = await import('./entry-store')
  return { useEntryStore: mod.useEntryStore, api }
}

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial))
  return {
    get length() {
      return entries.size
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value)
    }),
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
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

const SNAPSHOT_CACHE_STORAGE_KEY = 'livo:reader-snapshot-cache:v1'

function makeDefaultHomeSnapshotStorage(snapshot: ReaderSnapshot, limit = 1) {
  const cacheKey = JSON.stringify({
    scope: { type: 'all' },
    unreadOnly: false,
    limit,
    compact: true,
    maxContentLength: 520,
  })
  return {
    [SNAPSHOT_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      entries: {
        [cacheKey]: {
          cachedAt: Date.now(),
          snapshot,
        },
      },
    }),
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
    const first = makeSnapshotEntry({
      id: 'entry-1',
      title: 'First',
      publishedAt: 2000,
    })
    const second = makeSnapshotEntry({
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

  it('hydrates default home snapshot from persistent cache before refreshing', async () => {
    const cached = makeSnapshotEntry({
      id: 'entry-cached',
      title: 'Cached',
      publishedAt: 1000,
    })
    const fresh = makeSnapshotEntry({
      id: 'entry-fresh',
      title: 'Fresh',
      publishedAt: 2000,
    })
    const cachedSnapshot: ReaderSnapshot = {
      feeds: [makeFeed({ unreadCount: 1 })],
      entries: [cached],
      counts: {
        totalFeeds: 1,
        totalUnread: 1,
        unreadByFeedId: { 'feed-1': 1 },
        scopeUnread: 1,
      },
      nextCursor: null,
    }
    const { useEntryStore, api } = await loadEntryStore({
      listResults: [],
      detailResult: cached,
      snapshotResults: [
        {
          feeds: [makeFeed({ unreadCount: 2 })],
          entries: [fresh],
          counts: {
            totalFeeds: 1,
            totalUnread: 2,
            unreadByFeedId: { 'feed-1': 2 },
            scopeUnread: 2,
          },
          nextCursor: null,
        },
      ],
      localStorageItems: makeDefaultHomeSnapshotStorage(cachedSnapshot),
    })

    const hydrated = useEntryStore.getState().hydrateSnapshotCache({ limit: 1 })
    expect(hydrated?.entries.map((entry) => entry.id)).toEqual(['entry-cached'])
    expect(useEntryStore.getState().entries.map((entry) => entry.id)).toEqual([
      'entry-cached',
    ])
    expect(api.reader.snapshot).not.toHaveBeenCalled()

    await useEntryStore.getState().loadSnapshot({ limit: 1 })
    expect(api.reader.snapshot).toHaveBeenCalledTimes(1)
    expect(useEntryStore.getState().entries.map((entry) => entry.id)).toEqual([
      'entry-fresh',
    ])
  })

  it('does not apply default home snapshot cache to feed-scoped lists', async () => {
    const cached = makeSnapshotEntry({
      id: 'entry-cached',
      feedId: 'feed-1',
    })
    const cachedSnapshot: ReaderSnapshot = {
      feeds: [makeFeed({ id: 'feed-1' })],
      entries: [cached],
      counts: {
        totalFeeds: 1,
        totalUnread: 0,
        unreadByFeedId: { 'feed-1': 0 },
        scopeUnread: 0,
      },
      nextCursor: null,
    }
    const { useEntryStore } = await loadEntryStore({
      listResults: [],
      detailResult: cached,
      localStorageItems: makeDefaultHomeSnapshotStorage(cachedSnapshot),
    })

    const hydrated = useEntryStore
      .getState()
      .hydrateSnapshotCache({ feedId: 'feed-1', limit: 1 })

    expect(hydrated).toBeNull()
    expect(useEntryStore.getState().entries).toEqual([])
  })

  it('ignores stale snapshot pagination after switching feeds', async () => {
    const first = makeSnapshotEntry({
      id: 'entry-1',
      feedId: 'feed-1',
      title: 'First',
      publishedAt: 3000,
    })
    const oldPage = makeSnapshotEntry({
      id: 'entry-2',
      feedId: 'feed-1',
      title: 'Old page',
      publishedAt: 2000,
    })
    const switched = makeSnapshotEntry({
      id: 'entry-3',
      feedId: 'feed-2',
      title: 'Switched feed',
      publishedAt: 1000,
    })
    const loadMoreResult = createDeferred<ReaderSnapshot>()
    const snapshotResults: Array<ReaderSnapshot | Promise<ReaderSnapshot>> = [
      {
        feeds: [makeFeed({ id: 'feed-1', unreadCount: 2 })],
        entries: [first],
        counts: {
          totalFeeds: 1,
          totalUnread: 2,
          unreadByFeedId: { 'feed-1': 2 },
          scopeUnread: 2,
        },
        nextCursor: 'cursor-1',
      },
      loadMoreResult.promise,
      {
        feeds: [makeFeed({ id: 'feed-2', unreadCount: 1 })],
        entries: [switched],
        counts: {
          totalFeeds: 1,
          totalUnread: 1,
          unreadByFeedId: { 'feed-2': 1 },
          scopeUnread: 1,
        },
        nextCursor: null,
      },
    ]
    const { useEntryStore } = await loadEntryStore({
      listResults: [],
      detailResult: first,
      snapshotHandler: vi.fn(async () => {
        const result = snapshotResults.shift()
        if (!result) throw new Error('No snapshot result')
        return result
      }),
    })

    await useEntryStore.getState().loadSnapshot({
      feedId: 'feed-1',
      limit: 1,
    })
    const loadMorePromise = useEntryStore.getState().loadMoreEntries()
    await useEntryStore.getState().loadSnapshot({
      feedId: 'feed-2',
      limit: 1,
    })

    loadMoreResult.resolve({
      feeds: [makeFeed({ id: 'feed-1', unreadCount: 2 })],
      entries: [oldPage],
      counts: {
        totalFeeds: 1,
        totalUnread: 2,
        unreadByFeedId: { 'feed-1': 2 },
        scopeUnread: 2,
      },
      nextCursor: null,
    })
    await loadMorePromise

    expect(useEntryStore.getState().entries.map((entry) => entry.id)).toEqual([
      'entry-3',
    ])
    expect(useEntryStore.getState().hasMoreEntries).toBe(false)
    expect(useEntryStore.getState().isLoadingMore).toBe(false)
  })

  it('does not change local read state when markRead fails', async () => {
    const unread = makeEntry({ isRead: false })
    const { useEntryStore, api } = await loadEntryStore({
      listResults: [],
      detailResult: unread,
    })
    useEntryStore.setState({
      entries: [unread],
      selectedEntry: unread,
    })
    api.entries.markRead.mockRejectedValueOnce(new Error('mark failed'))

    await expect(
      useEntryStore.getState().markRead(unread.id, true),
    ).rejects.toThrow('mark failed')

    expect(useEntryStore.getState().entries[0]).toMatchObject({
      id: unread.id,
      isRead: false,
    })
    expect(useEntryStore.getState().selectedEntry).toMatchObject({
      id: unread.id,
      isRead: false,
    })
  })

  it('does not change local starred state when toggleStar fails', async () => {
    const unstarred = makeEntry({ isStarred: false })
    const { useEntryStore, api } = await loadEntryStore({
      listResults: [],
      detailResult: unstarred,
    })
    useEntryStore.setState({
      entries: [unstarred],
      selectedEntry: unstarred,
    })
    api.entries.toggleStar.mockRejectedValueOnce(new Error('star failed'))

    await expect(
      useEntryStore.getState().toggleStar(unstarred.id),
    ).rejects.toThrow('star failed')

    expect(useEntryStore.getState().entries[0]).toMatchObject({
      id: unstarred.id,
      isStarred: false,
    })
    expect(useEntryStore.getState().selectedEntry).toMatchObject({
      id: unstarred.id,
      isStarred: false,
    })
  })
})
