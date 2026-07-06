import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedViewType, type FeedWithCount } from '../../../shared/types'

function makeFeed(partial: Partial<FeedWithCount> = {}): FeedWithCount {
  return {
    id: partial.id ?? 'feed-1',
    title: partial.title ?? 'Feed title',
    url: partial.url ?? 'https://example.com/feed.xml',
    view: partial.view ?? 0,
    errorCount: partial.errorCount ?? 0,
    createdAt: partial.createdAt ?? 1000,
    unreadCount: partial.unreadCount ?? 0,
    ...partial,
  }
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

async function loadFeedStore(
  options: {
    feeds?: FeedWithCount[]
    localStorageItems?: Record<string, string>
  } = {},
) {
  vi.resetModules()
  const storage = createMemoryStorage(options.localStorageItems)
  const api = {
    feeds: {
      list: vi.fn(async () => options.feeds ?? []),
    },
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { localStorage: storage, api })
  const mod = await import('./feed-store')
  return { ...mod, storage, api }
}

describe('resolveSnapshotFeeds', () => {
  it('rejects an empty snapshot so feeds are never cleared', async () => {
    const { resolveSnapshotFeeds } = await loadFeedStore()
    const current = [makeFeed({ id: 'a' }), makeFeed({ id: 'b' })]
    expect(resolveSnapshotFeeds(current, [])).toBeNull()
  })

  it('rejects a scoped snapshot with far fewer feeds than the full list', async () => {
    const { resolveSnapshotFeeds } = await loadFeedStore()
    const current = [
      makeFeed({ id: 'a' }),
      makeFeed({ id: 'b' }),
      makeFeed({ id: 'c' }),
      makeFeed({ id: 'd' }),
    ]
    // Only one video feed in the snapshot — a scoped view, not the full set.
    expect(resolveSnapshotFeeds(current, [makeFeed({ id: 'a' })])).toBeNull()
  })

  it('applies a full snapshot when the canonical list is empty (startup)', async () => {
    const { resolveSnapshotFeeds } = await loadFeedStore()
    const snapshot = [makeFeed({ id: 'a' }), makeFeed({ id: 'b' })]
    expect(resolveSnapshotFeeds([], snapshot)).toBe(snapshot)
  })

  it('returns null when the snapshot is identical to the current list', async () => {
    const { resolveSnapshotFeeds } = await loadFeedStore()
    const current = [makeFeed({ id: 'a', unreadCount: 3 })]
    const snapshot = [makeFeed({ id: 'a', unreadCount: 3 })]
    expect(resolveSnapshotFeeds(current, snapshot)).toBeNull()
  })

  it('applies a same-size snapshot that changed (e.g. unread counts)', async () => {
    const { resolveSnapshotFeeds } = await loadFeedStore()
    const current = [makeFeed({ id: 'a', unreadCount: 3 })]
    const snapshot = [makeFeed({ id: 'a', unreadCount: 0 })]
    expect(resolveSnapshotFeeds(current, snapshot)).toBe(snapshot)
  })
})

describe('useFeedStore.applySnapshotFeeds', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the full feed list when a view switch delivers an empty snapshot', async () => {
    const { useFeedStore } = await loadFeedStore()
    const fullList = [makeFeed({ id: 'a' }), makeFeed({ id: 'b' })]
    useFeedStore.setState({ feeds: fullList })

    useFeedStore.getState().applySnapshotFeeds([])

    expect(useFeedStore.getState().feeds).toBe(fullList)
  })

  it('keeps the full feed list when a scoped snapshot has too few feeds', async () => {
    const { useFeedStore } = await loadFeedStore()
    const fullList = [
      makeFeed({ id: 'a' }),
      makeFeed({ id: 'b' }),
      makeFeed({ id: 'c' }),
      makeFeed({ id: 'd' }),
    ]
    useFeedStore.setState({ feeds: fullList })

    useFeedStore.getState().applySnapshotFeeds([makeFeed({ id: 'a' })])

    expect(useFeedStore.getState().feeds).toBe(fullList)
  })

  it('replaces feeds when a full snapshot brings real changes', async () => {
    const { useFeedStore } = await loadFeedStore()
    useFeedStore.setState({ feeds: [makeFeed({ id: 'a', unreadCount: 3 })] })

    const snapshot = [makeFeed({ id: 'a', unreadCount: 0 })]
    useFeedStore.getState().applySnapshotFeeds(snapshot)

    expect(useFeedStore.getState().feeds).toBe(snapshot)
  })
})

describe('useFeedStore selectors', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds feeds by id and normalized url through the store Interface', async () => {
    const { useFeedStore } = await loadFeedStore()
    const feeds = [
      makeFeed({ id: 'article', url: 'https://Example.com/rss/' }),
      makeFeed({ id: 'video', url: 'https://video.example.com/feed.xml' }),
    ]
    useFeedStore.setState({ feeds })

    const state = useFeedStore.getState()

    expect(state.getFeedById('video')).toBe(feeds[1])
    expect(state.getFeedById('missing')).toBeNull()
    expect(state.getFeedByUrl('https://example.com/rss')).toBe(feeds[0])
    expect(state.getFeedByUrl('')).toBeNull()
  })

  it('returns view-scoped feeds and can exclude Recommended feeds', async () => {
    const { useFeedStore } = await loadFeedStore()
    const feeds = [
      makeFeed({ id: 'article', view: FeedViewType.Articles }),
      makeFeed({ id: 'video', view: FeedViewType.Videos }),
      makeFeed({
        id: 'recommended-video',
        view: FeedViewType.Videos,
        category: 'Recommended',
      }),
    ]
    useFeedStore.setState({ feeds })

    const state = useFeedStore.getState()

    expect(state.getFeedsByView(FeedViewType.Videos)).toEqual([
      feeds[1],
      feeds[2],
    ])
    expect(
      state.getFeedsByView(FeedViewType.Videos, {
        excludeCategory: 'Recommended',
      }),
    ).toEqual([feeds[1]])
  })
})

describe('useFeedStore feed cache persistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes secret URL components before writing feeds to localStorage', async () => {
    const rawFeed = makeFeed({
      url: 'https://user:pass@example.com/rss.xml?token=raw-token&ok=1',
      siteUrl: 'https://example.com/site?api_key=raw-api-key&utm_source=reader',
      imageUrl:
        'https://cdn.example.com/icon.png?X-Amz-Signature=raw-signature&size=1',
      upstreamUrl:
        'https://upstream.example.com/feed?refresh_token=raw-refresh&view=1',
    })
    const { useFeedStore, storage } = await loadFeedStore({ feeds: [rawFeed] })

    await useFeedStore.getState().loadFeeds()

    const persisted = JSON.parse(
      storage.getItem('livo-feeds-cache') || '[]',
    ) as FeedWithCount[]
    expect(persisted[0].url).toBe('https://example.com/rss.xml?ok=1')
    expect(persisted[0].siteUrl).toBe(
      'https://example.com/site?utm_source=reader',
    )
    expect(persisted[0].imageUrl).toBe(
      'https://cdn.example.com/icon.png?size=1',
    )
    expect(persisted[0].upstreamUrl).toBe(
      'https://upstream.example.com/feed?view=1',
    )
    expect(JSON.stringify(persisted)).not.toContain('raw-')
    expect(useFeedStore.getState().feeds[0].url).toBe(rawFeed.url)
  })

  it('serializes sanitized feed cache payloads for non-store writers', async () => {
    const { serializeFeedsForCache } = await loadFeedStore()

    const serialized = serializeFeedsForCache([
      makeFeed({
        url: 'https://user:pass@example.com/rss.xml?token=raw-token&ok=1',
      }),
    ])

    expect(serialized).not.toContain('raw-token')
    expect(serialized).not.toContain('user:pass')
    expect(JSON.parse(serialized)[0].url).toBe(
      'https://example.com/rss.xml?ok=1',
    )
  })

  it('sanitizes legacy feed cache payloads during hydration', async () => {
    const { useFeedStore, storage } = await loadFeedStore({
      localStorageItems: {
        'livo-feeds-cache': JSON.stringify([
          makeFeed({
            url: 'https://user:pass@example.com/rss.xml?token=raw-token&ok=1',
          }),
        ]),
      },
    })

    const cached = useFeedStore.getState().hydrateFromCache()

    expect(cached[0].url).toBe('https://example.com/rss.xml?ok=1')
    expect(storage.getItem('livo-feeds-cache')).not.toContain('raw-token')
    expect(storage.getItem('livo-feeds-cache')).not.toContain('user:pass')
  })
})
