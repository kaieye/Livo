import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('app ready queue', () => {
  it('queues callbacks until ready and then flushes them', async () => {
    const mod = await import('./queue')
    const calls: string[] = []

    mod.waitForAppReady(() => calls.push('first'))
    mod.waitForAppReady(() => calls.push('second'))

    expect(calls).toEqual([])

    mod.applyAfterReadyCallbacks()

    expect(calls).toEqual(['first', 'second'])
    expect(mod.isAppReady()).toBe(true)
  })

  it('runs immediately after ready', async () => {
    const mod = await import('./queue')
    const spy = vi.fn()

    mod.applyAfterReadyCallbacks()
    mod.waitForAppReady(spy)

    expect(spy).toHaveBeenCalledTimes(1)
  })
})

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (payload: unknown) => void>(),
  calls: [] as string[],
  feeds: [
    {
      id: 'nitter-feed',
      title: 'Elon Musk - X',
      url: 'https://nitter.net/elonmusk/rss',
      view: 0,
      errorCount: 0,
      createdAt: 0,
      unreadCount: 0,
    },
  ],
  loadFeeds: vi.fn(),
  loadEntries: vi.fn(),
  invalidateFeedCache: vi.fn(),
  invalidateMultipleFeedsCaches: vi.fn(),
  invalidateListCache: vi.fn(),
}))

async function setupQueue() {
  vi.resetModules()
  mocks.listeners.clear()
  mocks.calls.length = 0
  mocks.loadFeeds.mockReset()
  mocks.loadEntries.mockReset().mockImplementation(() => {
    mocks.calls.push('loadEntries')
  })
  mocks.invalidateFeedCache.mockReset().mockImplementation(() => {
    mocks.calls.push('invalidateFeedCache')
  })
  mocks.invalidateMultipleFeedsCaches.mockReset().mockImplementation(() => {
    mocks.calls.push('invalidateMultipleFeedsCaches')
  })
  mocks.invalidateListCache.mockReset().mockImplementation(() => {
    mocks.calls.push('invalidateListCache')
  })

  const useFeedStore = {
    getState: () => ({
      feeds: mocks.feeds,
      selectedFeedId: 'nitter-feed',
      activeView: 0,
      loadFeeds: mocks.loadFeeds,
    }),
    setState: vi.fn(),
  }

  vi.doMock('../store/feed-store', () => ({
    serializeFeedsForCache: vi.fn(() => '[]'),
    useFeedStore,
  }))
  vi.doMock('../store/entry-store', () => ({
    useEntryStore: {
      getState: () => ({ loadEntries: mocks.loadEntries }),
    },
  }))
  vi.doMock('../lib/home-feed-scope', () => ({
    buildHomeFeedLoadOptions: vi.fn(() => ({ feedId: 'nitter-feed' })),
  }))
  vi.doMock('../lib/entry-cache', () => ({
    invalidateFeedCache: mocks.invalidateFeedCache,
    invalidateMultipleFeedsCaches: mocks.invalidateMultipleFeedsCaches,
    invalidateListCache: mocks.invalidateListCache,
  }))

  vi.stubGlobal('localStorage', { setItem: vi.fn() })
  vi.stubGlobal('window', {
    api: {
      on: vi.fn((event: string, callback: (payload: unknown) => void) => {
        mocks.listeners.set(event, callback)
      }),
    },
  })

  const { setupBackgroundEventListeners } = await import('./queue')
  await setupBackgroundEventListeners()
}

describe('setupBackgroundEventListeners', () => {
  beforeEach(async () => {
    await setupQueue()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../store/feed-store')
    vi.doUnmock('../store/entry-store')
    vi.doUnmock('../lib/home-feed-scope')
    vi.doUnmock('../lib/entry-cache')
  })

  it('invalidates an updated feed list cache before reloading the current scope', () => {
    const listener = mocks.listeners.get('feeds:updated')
    expect(listener).toBeTypeOf('function')

    listener?.({
      feedId: 'nitter-feed',
      feedIds: ['nitter-feed'],
      hasEntries: true,
      feeds: [{ id: 'nitter-feed', lastFetched: Date.now() }],
    })

    expect(mocks.invalidateMultipleFeedsCaches).toHaveBeenCalledWith([
      'nitter-feed',
    ])
    expect(mocks.calls).toEqual([
      'invalidateMultipleFeedsCaches',
      'loadEntries',
    ])
  })
})
