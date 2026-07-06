import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Entry, Feed } from '../shared/types'
import { FeedViewType } from '../shared/types'

type FakeRequest<T> = {
  result?: T
  error: Error | null
  onsuccess: ((event: { target: FakeRequest<T> }) => void) | null
  onerror: (() => void) | null
  onupgradeneeded?: ((event: { target: FakeRequest<T> }) => void) | null
}

function createFakeRequest<T>(): FakeRequest<T> {
  return {
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }
}

function successRequest<T>(value: T): FakeRequest<T> {
  const request = createFakeRequest<T>()
  queueMicrotask(() => {
    request.result = value
    request.onsuccess?.({ target: request })
  })
  return request
}

function stubIndexedDBStorage(
  options: {
    feeds?: Feed[]
    entries?: Entry[]
  } = {},
) {
  const feeds = new Map((options.feeds ?? []).map((feed) => [feed.id, feed]))
  const entries = new Map(
    (options.entries ?? []).map((entry) => [entry.id, entry]),
  )
  const addedFeeds: Feed[] = []
  const putFeeds: Feed[] = []
  const addedEntries: Entry[] = []
  const putEntries: Entry[] = []

  const feedStore = {
    getAll: vi.fn(() => successRequest(Array.from(feeds.values()))),
    get: vi.fn((id: string) => successRequest(feeds.get(id))),
    add: vi.fn((feed: Feed) => {
      addedFeeds.push(feed)
      feeds.set(feed.id, feed)
      return successRequest(undefined)
    }),
    put: vi.fn((feed: Feed) => {
      putFeeds.push(feed)
      feeds.set(feed.id, feed)
      return successRequest(undefined)
    }),
    index: vi.fn((name: string) => ({
      get: vi.fn((value: string) => {
        if (name === 'url') {
          return successRequest(
            Array.from(feeds.values()).find((feed) => feed.url === value),
          )
        }
        return successRequest(undefined)
      }),
    })),
  }
  const entryStore = {
    getAll: vi.fn(() => successRequest(Array.from(entries.values()))),
    get: vi.fn((id: string) => successRequest(entries.get(id))),
    add: vi.fn((entry: Entry) => {
      addedEntries.push(entry)
      entries.set(entry.id, entry)
      return successRequest(undefined)
    }),
    put: vi.fn((entry: Entry) => {
      putEntries.push(entry)
      entries.set(entry.id, entry)
      return successRequest(undefined)
    }),
    index: vi.fn((name: string) => ({
      get: vi.fn((value: string) => {
        if (name === 'url') {
          return successRequest(
            Array.from(entries.values()).find((entry) => entry.url === value),
          )
        }
        return successRequest(undefined)
      }),
      getAll: vi.fn((value: string) => {
        if (name === 'feedId') {
          return successRequest(
            Array.from(entries.values()).filter(
              (entry) => entry.feedId === value,
            ),
          )
        }
        return successRequest([])
      }),
    })),
  }

  const fakeDatabase = {
    objectStoreNames: { contains: vi.fn(() => true) },
    transaction: vi.fn(() => ({
      objectStore: vi.fn((name: string) => {
        if (name === 'feeds') return feedStore
        if (name === 'entries') return entryStore
        throw new Error(`Unexpected store ${name}`)
      }),
    })),
  }
  const open = vi.fn(() => successRequest(fakeDatabase))

  vi.stubGlobal('indexedDB', { open })
  return {
    addedEntries,
    addedFeeds,
    fakeDatabase,
    feedStore,
    entryStore,
    open,
    putEntries,
    putFeeds,
  }
}

function stubIndexedDBFeeds(feeds: Feed[]) {
  const getAll = vi.fn(() => {
    const request = createFakeRequest<Feed[]>()
    queueMicrotask(() => {
      request.result = feeds
      request.onsuccess?.({ target: request })
    })
    return request
  })

  const fakeDatabase = {
    objectStoreNames: { contains: vi.fn(() => true) },
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({ getAll })),
    })),
  }
  const open = vi.fn(() => {
    const request = createFakeRequest<typeof fakeDatabase>()
    queueMicrotask(() => {
      request.result = fakeDatabase
      request.onsuccess?.({ target: request })
    })
    return request
  })

  vi.stubGlobal('indexedDB', { open })
  return { fakeDatabase, getAll, open }
}

describe('web storage feed migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults missing upstreamUrl to url when reading legacy feeds', async () => {
    vi.resetModules()
    const legacyFeed = {
      id: 'feed-1',
      title: 'Legacy',
      url: 'https://example.com/rss.xml',
      errorCount: 0,
      createdAt: 1000,
    } as Feed
    stubIndexedDBFeeds([legacyFeed])

    const { initWebDB, getAllFeeds } = await import('./storage')
    await initWebDB()

    const feeds = await getAllFeeds()

    expect(feeds[0]).toMatchObject({
      url: 'https://example.com/rss.xml',
      upstreamUrl: 'https://example.com/rss.xml',
      view: FeedViewType.Articles,
      showInAll: true,
    })
  })

  it('redacts feed URL fields when reading legacy IndexedDB rows', async () => {
    vi.resetModules()
    const legacyFeed = {
      id: 'feed-1',
      title: 'Legacy',
      url: 'https://user:pass@example.com/rss.xml?token=raw&ok=1',
      siteUrl: 'https://example.com?api_key=raw&ok=1',
      imageUrl:
        'https://cdn.example.com/avatar.png?X-Amz-Signature=raw&width=128',
      upstreamUrl: 'https://source.example.com/rss.xml?refresh_token=raw&ok=1',
      errorCount: 0,
      createdAt: 1000,
    } as Feed
    stubIndexedDBFeeds([legacyFeed])

    const { initWebDB, getAllFeeds } = await import('./storage')
    await initWebDB()

    const feeds = await getAllFeeds()

    expect(feeds[0]).toMatchObject({
      url: 'https://example.com/rss.xml?ok=1',
      siteUrl: 'https://example.com/?ok=1',
      imageUrl: 'https://cdn.example.com/avatar.png?width=128',
      upstreamUrl: 'https://source.example.com/rss.xml?ok=1',
    })
  })

  it('redacts feed URL fields before IndexedDB writes', async () => {
    vi.resetModules()
    const storage = stubIndexedDBStorage()
    const { initWebDB, insertFeed } = await import('./storage')
    await initWebDB()

    await insertFeed({
      id: 'feed-1',
      title: 'Feed',
      url: 'https://user:pass@example.com/rss.xml?token=raw&ok=1',
      siteUrl: 'https://example.com?api_key=raw&ok=1',
      imageUrl:
        'https://cdn.example.com/avatar.png?X-Amz-Signature=raw&width=128',
      upstreamUrl: 'https://source.example.com/rss.xml?refresh_token=raw&ok=1',
      errorCount: 0,
      createdAt: 1000,
    } as Feed)

    expect(storage.addedFeeds[0]).toMatchObject({
      url: 'https://example.com/rss.xml?ok=1',
      siteUrl: 'https://example.com/?ok=1',
      imageUrl: 'https://cdn.example.com/avatar.png?width=128',
      upstreamUrl: 'https://source.example.com/rss.xml?ok=1',
    })
  })
})

describe('web storage entry persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redacts entry URL fields before IndexedDB writes', async () => {
    vi.resetModules()
    const storage = stubIndexedDBStorage()
    const { initWebDB, insertEntry } = await import('./storage')
    await initWebDB()

    await insertEntry({
      id: 'entry-1',
      feedId: 'feed-1',
      title: 'Entry',
      url: 'https://user:pass@example.com/post?token=raw&ok=1',
      imageUrl: 'https://cdn.example.com/img.jpg?signature=raw&width=640',
      authorAvatar:
        'https://cdn.example.com/avatar.jpg?refresh_token=raw&size=64',
      media: [
        {
          type: 'photo',
          url: 'https://cdn.example.com/photo.jpg?X-Amz-Signature=raw&w=1',
          previewUrl: 'https://cdn.example.com/preview.jpg?api_key=raw&w=1',
        },
      ],
      publishedAt: 1,
      isRead: false,
      isStarred: false,
      createdAt: 1,
    })

    expect(storage.addedEntries[0]).toMatchObject({
      url: 'https://example.com/post?ok=1',
      imageUrl: 'https://cdn.example.com/img.jpg?width=640',
      authorAvatar: 'https://cdn.example.com/avatar.jpg?size=64',
      media: [
        {
          url: 'https://cdn.example.com/photo.jpg?w=1',
          previewUrl: 'https://cdn.example.com/preview.jpg?w=1',
        },
      ],
    })
  })

  it('redacts entry URL fields when updating existing rows', async () => {
    vi.resetModules()
    const storage = stubIndexedDBStorage({
      entries: [
        {
          id: 'entry-1',
          feedId: 'feed-1',
          title: 'Entry',
          url: 'https://example.com/post',
          publishedAt: 1,
          isRead: false,
          isStarred: false,
          createdAt: 1,
        },
      ],
    })
    const { initWebDB, updateEntry } = await import('./storage')
    await initWebDB()

    await updateEntry('entry-1', {
      imageUrl: 'https://cdn.example.com/img.jpg?sig=raw&width=640',
    })

    expect(storage.putEntries[0]).toMatchObject({
      id: 'entry-1',
      imageUrl: 'https://cdn.example.com/img.jpg?width=640',
    })
  })
})
