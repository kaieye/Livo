import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Feed } from '../shared/types'
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
})
