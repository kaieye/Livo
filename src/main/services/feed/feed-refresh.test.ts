import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyActionRulesToEntriesAsync,
  applyActionRulesToEntries,
  filterForeignEntries,
} from '../entry/entry-ingestion-pipeline'
import {
  getNextAutoRefreshDelayMs,
  mapFeedRefreshError,
  queueBootstrapRefresh,
  refreshAllFeeds,
  sanitizeExistingFeedAvatarForRefresh,
  startAutoRefresh,
  stopAutoRefresh,
} from './feed-refresh'
import {
  FeedViewType,
  type Entry,
  type Feed,
} from '../../../shared/types/index'
import type { ActionRule } from '../../../shared/actions'
import type { AIConfig } from '../../../shared/types/index'
import { FEED_BOOTSTRAP_REFRESH_TASK } from '../system/task-contracts'

const getDbMock = vi.hoisted(() => vi.fn())
const getLocalTaskRunnerMock = vi.hoisted(() => vi.fn())
const settingsProviderGetMock = vi.hoisted(() => vi.fn())
const resolveFeedPayloadMock = vi.hoisted(() => vi.fn())
const prefetchServerFeedCacheMock = vi.hoisted(() => vi.fn())
const getNormalizedFeedUrlForCacheMock = vi.hoisted(() =>
  vi.fn((feed: Feed) => feed.url),
)
const resolveFeedAvatarMock = vi.hoisted(() => vi.fn())
const ingestParsedFeedEntriesMock = vi.hoisted(() => vi.fn())
const appendRefreshLogMock = vi.hoisted(() => vi.fn())
const queueFeverSyncAccountMock = vi.hoisted(() => vi.fn())
const logUserOperationMock = vi.hoisted(() => vi.fn())

vi.mock('../../database', () => ({
  getDb: getDbMock,
}))

vi.mock('../system/settings-provider', () => ({
  settingsProvider: {
    get: settingsProviderGetMock,
  },
}))

vi.mock('../system/task-runner-service', () => ({
  getLocalTaskRunner: getLocalTaskRunnerMock,
}))

vi.mock('./feed-source-provider', () => ({
  resolveFeedPayload: resolveFeedPayloadMock,
  prefetchServerFeedCache: prefetchServerFeedCacheMock,
  getNormalizedFeedUrlForCache: getNormalizedFeedUrlForCacheMock,
}))

vi.mock('./feed-avatar', () => ({
  resolveFeedAvatar: resolveFeedAvatarMock,
}))

vi.mock('../system/refresh-log-store', () => ({
  appendRefreshLog: appendRefreshLogMock,
}))

vi.mock('../fever/fever-sync', () => ({
  queueFeverSyncAccount: queueFeverSyncAccountMock,
}))

vi.mock('../system/user-operation-log', () => ({
  logUserOperation: logUserOperationMock,
}))

vi.mock('../entry/entry-ingestion-pipeline', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../entry/entry-ingestion-pipeline')>()
  return {
    ...actual,
    ingestParsedFeedEntries: ingestParsedFeedEntriesMock,
  }
})

function makeEntry(url: string): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'title',
    content: 'content',
    url,
    publishedAt: Date.now(),
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
  }
}

function makeFeed(): Feed {
  return {
    id: 'feed-1',
    title: 'Tech Feed',
    url: 'https://example.com/feed.xml',
    category: 'Tech',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1,
  }
}

function makeRule(partial: Partial<ActionRule>): ActionRule {
  return {
    id: partial.id || 'rule-1',
    name: partial.name || 'rule',
    enabled: partial.enabled ?? true,
    conditions: partial.conditions || [
      { field: 'entry.title', operator: 'contains', value: 'title' },
    ],
    actions: partial.actions || [],
    createdAt: partial.createdAt || 1,
  }
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const aiConfig: AIConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  model: 'test-model',
}

describe('filterForeignEntries', () => {
  it('keeps bilibili entries across sibling bilibili subdomains', () => {
    const entries = [
      makeEntry('https://t.bilibili.com/1234567890'),
      makeEntry('https://www.bilibili.com/video/BV1xx411c7mD'),
    ]

    expect(
      filterForeignEntries(
        entries,
        'https://space.bilibili.com/123456',
        'https://space.bilibili.com/123456/dynamic',
        'https://rsshub.app/bilibili/user/dynamic/123456',
      ),
    ).toEqual(entries)
  })

  it('still filters unrelated domains for regular feeds', () => {
    const ownEntry = makeEntry('https://blog.example.com/post-1')
    const foreignEntry = makeEntry('https://another-site.com/post-2')

    expect(
      filterForeignEntries(
        [ownEntry, foreignEntry],
        'https://example.com/feed',
        'https://example.com/feed',
        'https://example.com/feed.xml',
      ),
    ).toEqual([ownEntry])
  })
})

describe('refreshAllFeeds', () => {
  beforeEach(() => {
    getLocalTaskRunnerMock.mockReset()
    getDbMock.mockReset()
    settingsProviderGetMock.mockReset()
    resolveFeedPayloadMock.mockReset()
    prefetchServerFeedCacheMock.mockReset()
    prefetchServerFeedCacheMock.mockResolvedValue(new Map())
    getNormalizedFeedUrlForCacheMock.mockReset()
    getNormalizedFeedUrlForCacheMock.mockImplementation(
      (feed: Feed) => feed.url,
    )
    resolveFeedAvatarMock.mockReset()
    ingestParsedFeedEntriesMock.mockReset()
    appendRefreshLogMock.mockReset()
    queueFeverSyncAccountMock.mockReset()
    logUserOperationMock.mockReset()
  })

  it('returns the active run result when a batch refresh is already running', async () => {
    const activeResult = {
      totalFeeds: 3,
      refreshedCount: 2,
      failedCount: 1,
      failedFeedTitles: ['Feed A'],
      totalNewEntries: 4,
      items: [],
    }
    const activeRun = {
      runId: 'feed.refresh_all-1',
      promise: Promise.resolve(activeResult),
    }
    const enqueue = vi.fn()
    const getActiveRun = vi.fn().mockReturnValue(activeRun)
    getLocalTaskRunnerMock.mockReturnValue({
      enqueue,
      getActiveRun,
    })

    await expect(refreshAllFeeds()).resolves.toEqual({
      ...activeResult,
      runId: activeRun.runId,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('emits per-feed progress as concurrent refreshes complete', async () => {
    const feedA = {
      ...makeFeed(),
      id: 'feed-a',
      title: 'Feed A',
      url: 'https://a.example.com/feed.xml',
    }
    const feedB = {
      ...makeFeed(),
      id: 'feed-b',
      title: 'Feed B',
      url: 'https://b.example.com/feed.xml',
    }
    const feedById = new Map([feedA, feedB].map((feed) => [feed.id, feed]))
    const getAllFeeds = vi.fn(() => Array.from(feedById.values()))
    const updateFeed = vi.fn((feedId: string, updates: Partial<Feed>) => {
      const current = feedById.get(feedId)
      if (current) feedById.set(feedId, { ...current, ...updates })
    })
    const cleanupEntries = vi.fn()
    getDbMock.mockReturnValue({
      feeds: {
        getAllFeeds,
        updateFeed,
      },
      maintenance: {
        cleanupEntries,
      },
      fever: {
        getFeverAccounts: vi.fn(() => []),
      },
    })
    settingsProviderGetMock.mockReturnValue({
      general: { showRecommended: true },
      data: {
        enrichVideoDuration: false,
        entriesPerFeed: 128,
        maxEntryAgeDays: 90,
      },
    })
    const runner = {
      getActiveRun: vi.fn(() => undefined),
      enqueue: vi.fn((contract, payload, handler) => ({
        runId: `${contract.name}-test`,
        promise: Promise.resolve().then(() =>
          handler(payload, { reportProgress: vi.fn() }),
        ),
        getRecord: vi.fn(),
      })),
    }
    getLocalTaskRunnerMock.mockReturnValue(runner)
    resolveFeedAvatarMock.mockResolvedValue(undefined)
    ingestParsedFeedEntriesMock.mockResolvedValue({ addedCount: 0 })

    const delayedFeedB = createDeferred<{
      parsed: { title: string; description: string; link: string; items: [] }
    }>()
    resolveFeedPayloadMock.mockImplementation((feed: Feed) =>
      feed.id === feedA.id
        ? Promise.resolve({
            parsed: {
              title: feed.title,
              description: '',
              link: feed.url,
              items: [],
            },
          })
        : delayedFeedB.promise,
    )
    const onProgress = vi.fn()

    const refreshPromise = refreshAllFeeds({
      force: true,
      concurrency: 2,
      onProgress,
    })

    await vi.waitFor(() => {
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          feedId: feedA.id,
          completed: 1,
          total: 2,
          done: false,
        }),
      )
    })
    expect(onProgress).not.toHaveBeenCalledWith(
      expect.objectContaining({ completed: 2 }),
    )

    delayedFeedB.resolve({
      parsed: {
        title: feedB.title,
        description: '',
        link: feedB.url,
        items: [],
      },
    })

    await refreshPromise

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        feedId: feedB.id,
        completed: 2,
        total: 2,
        done: true,
      }),
    )
  })

  it('passes prefetched server-cache hits into per-feed refreshes', async () => {
    const feed = {
      ...makeFeed(),
      id: 'feed-cached',
      title: 'Cached Feed',
      url: 'https://cache.example.com/feed.xml',
    }
    getDbMock.mockReturnValue({
      feeds: {
        getAllFeeds: vi.fn(() => [feed]),
        updateFeed: vi.fn(),
      },
      maintenance: {
        cleanupEntries: vi.fn(),
      },
      fever: {
        getFeverAccounts: vi.fn(() => []),
      },
    })
    settingsProviderGetMock.mockReturnValue({
      general: { showRecommended: true },
      data: {
        enrichVideoDuration: false,
        entriesPerFeed: 128,
        maxEntryAgeDays: 90,
      },
    })
    getLocalTaskRunnerMock.mockReturnValue({
      getActiveRun: vi.fn(() => undefined),
      enqueue: vi.fn((contract, payload, handler) => ({
        runId: `${contract.name}-test`,
        promise: Promise.resolve().then(() =>
          handler(payload, { reportProgress: vi.fn() }),
        ),
        getRecord: vi.fn(),
      })),
    })

    const serverCacheHit = {
      url: feed.url,
      sourceId: 'source-1',
      lastFetchedAt: new Date().toISOString(),
      entries: [],
    }
    prefetchServerFeedCacheMock.mockResolvedValue(
      new Map([[feed.url, serverCacheHit]]),
    )
    resolveFeedPayloadMock.mockResolvedValue({
      parsed: {
        title: feed.title,
        description: '',
        link: feed.url,
        items: [],
      },
    })
    resolveFeedAvatarMock.mockResolvedValue(undefined)
    ingestParsedFeedEntriesMock.mockResolvedValue({ addedCount: 0 })

    await refreshAllFeeds({ force: true })

    expect(prefetchServerFeedCacheMock).toHaveBeenCalledWith([feed])
    expect(resolveFeedPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: feed.id }),
      expect.objectContaining({ serverCacheHit }),
    )
  })
})

describe('startAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(60 * 60 * 1000)
    getDbMock.mockReset()
    getLocalTaskRunnerMock.mockReset()
    settingsProviderGetMock.mockReset()
    settingsProviderGetMock.mockReturnValue({
      general: { showRecommended: true },
      data: { enrichVideoDuration: false },
    })
  })

  afterEach(() => {
    stopAutoRefresh()
    vi.useRealTimers()
  })

  it('启动时不立即排队刷新仍然新鲜的订阅源', () => {
    const feeds = [{ ...makeFeed(), lastFetched: Date.now() - 60 * 1000 }]
    getDbMock.mockReturnValue({
      feeds: {
        getAllFeeds: vi.fn(() => feeds),
      },
    })

    startAutoRefresh(30, null, { freshnessTTL: 10, concurrency: 5 })

    expect(getLocalTaskRunnerMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(getLocalTaskRunnerMock).not.toHaveBeenCalled()
  })
})

describe('sanitizeExistingFeedAvatarForRefresh', () => {
  it('drops an existing feed avatar when it came from a parsed item image', () => {
    expect(
      sanitizeExistingFeedAvatarForRefresh(
        'https://cdn.example.com/latest-cover.webp',
        undefined,
        [
          {
            enclosure: {
              url: 'https://cdn.example.com/latest-cover.webp',
              type: 'image/webp',
            },
          },
        ],
      ),
    ).toBeUndefined()
  })

  it('keeps the existing feed avatar when upstream exposes a feed-level image', () => {
    expect(
      sanitizeExistingFeedAvatarForRefresh(
        'https://cdn.example.com/logo.png',
        'https://cdn.example.com/logo.png',
        [
          {
            enclosure: {
              url: 'https://cdn.example.com/logo.png',
              type: 'image/png',
            },
          },
        ],
      ),
    ).toBe('https://cdn.example.com/logo.png')
  })
})

describe('mapFeedRefreshError', () => {
  it('keeps raw HTTP errors while returning user-readable text', () => {
    expect(mapFeedRefreshError(new Error('HTTP 403 Forbidden'))).toEqual({
      userMessage: '源站返回 HTTP 403',
      rawMessage: 'HTTP 403 Forbidden',
    })
  })

  it('maps known Instagram upstream failures to a quiet user message', () => {
    expect(
      mapFeedRefreshError(new Error('challenge_required'), {
        knownInstagramFailure: true,
      }),
    ).toEqual({
      userMessage: 'Instagram/RSSHub 上游暂时不可用，请稍后重试',
      rawMessage: 'challenge_required',
    })
  })
})

describe('queueBootstrapRefresh', () => {
  beforeEach(() => {
    getLocalTaskRunnerMock.mockReset()
  })

  it('通过 Task Runner 执行 deferred bootstrap', () => {
    const feed = { ...makeFeed(), view: FeedViewType.SocialMedia }
    const promise = Promise.resolve({
      rounds: 0,
      hasEntries: false,
      hasAvatar: false,
    })
    const enqueue = vi.fn().mockReturnValue({
      runId: 'feed.bootstrap_refresh-1',
      promise,
      getRecord: vi.fn(),
    })
    getLocalTaskRunnerMock.mockReturnValue({ enqueue })

    queueBootstrapRefresh(
      feed,
      'https://rsshub.example.com/instagram/user/livo',
      FeedViewType.SocialMedia,
    )

    expect(enqueue).toHaveBeenCalledWith(
      FEED_BOOTSTRAP_REFRESH_TASK,
      {
        feed,
        normalizedUrl: 'https://rsshub.example.com/instagram/user/livo',
        view: FeedViewType.SocialMedia,
      },
      expect.any(Function),
      {
        metadata: {
          feedId: feed.id,
          feedTitle: feed.title,
          normalizedUrl: 'https://rsshub.example.com/instagram/user/livo',
          view: FeedViewType.SocialMedia,
        },
      },
    )
  })
})

describe('applyActionRulesToEntries', () => {
  it('keeps matched side effects on stored entries', () => {
    const entry = makeEntry('https://blog.example.com/post-1')
    const result = applyActionRulesToEntries([entry], makeFeed(), [
      makeRule({
        actions: [
          { type: 'star' },
          { type: 'mark_read' },
          { type: 'notify' },
          { type: 'readability' },
          { type: 'summarize' },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].entry).toMatchObject({
      isRead: true,
      isStarred: true,
    })
    expect(result[0].effects).toEqual([
      'star',
      'mark_read',
      'notify',
      'readability',
      'summarize',
    ])
  })

  it('drops blocked entries before side effects run', () => {
    const entry = makeEntry('https://blog.example.com/post-1')
    const result = applyActionRulesToEntries([entry], makeFeed(), [
      makeRule({
        actions: [{ type: 'block' }, { type: 'notify' }],
      }),
    ])

    expect(result).toEqual([])
  })

  it('skips text-processing effects for podcast category feeds', () => {
    const entry = makeEntry('https://podcast.example.com/episode-1')
    const feed = { ...makeFeed(), category: 'podcast' }
    const result = applyActionRulesToEntries([entry], feed, [
      makeRule({
        actions: [
          { type: 'star' },
          { type: 'mark_read' },
          { type: 'notify' },
          { type: 'readability' },
          { type: 'summarize' },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].entry).toMatchObject({
      isRead: true,
      isStarred: true,
    })
    expect(result[0].effects).toEqual(['star', 'mark_read', 'notify'])
  })

  it('skips text-processing effects for audio entries', () => {
    const entry: Entry = {
      ...makeEntry('https://media.example.com/episode-1'),
      media: [{ type: 'audio', url: 'https://media.example.com/episode.mp3' }],
    }
    const result = applyActionRulesToEntries([entry], makeFeed(), [
      makeRule({
        actions: [{ type: 'notify' }, { type: 'readability' }],
      }),
    ])

    expect(result[0].effects).toEqual(['notify'])
  })

  it('applies semantic rules through the injected AI judge', async () => {
    const entry = makeEntry('https://blog.example.com/post-1')
    const result = await applyActionRulesToEntriesAsync(
      [entry],
      makeFeed(),
      [
        makeRule({
          conditions: [
            {
              field: 'ai.semantic',
              operator: 'semantic_matches',
              value: '与产品发布有关',
            },
          ],
          actions: [{ type: 'star' }, { type: 'mark_read' }],
        }),
      ],
      {
        aiConfig,
        semanticJudge: async (input) => ({
          matched: input.condition === '与产品发布有关',
          confidence: 0.92,
          reason: '主题匹配',
        }),
      },
    )

    expect(result).toHaveLength(1)
    expect(result[0].entry.isRead).toBe(true)
    expect(result[0].entry.isStarred).toBe(true)
  })

  it('treats failed semantic rules as not matched', async () => {
    const entry = makeEntry('https://blog.example.com/post-1')
    const result = await applyActionRulesToEntriesAsync(
      [entry],
      makeFeed(),
      [
        makeRule({
          conditions: [
            {
              field: 'ai.semantic',
              operator: 'semantic_matches',
              value: '应该屏蔽',
            },
          ],
          actions: [{ type: 'block' }],
        }),
      ],
      {
        aiConfig,
        semanticJudge: async () => {
          throw new Error('judge failed')
        },
      },
    )

    expect(result).toEqual([{ entry, effects: [] }])
  })
})

describe('getNextAutoRefreshDelayMs', () => {
  it('disables scheduling when interval is manual', () => {
    expect(getNextAutoRefreshDelayMs([makeFeed()], Date.now(), 0)).toBeNull()
  })

  it('checks again after the configured interval when there are no feeds', () => {
    expect(getNextAutoRefreshDelayMs([], 1000, 15)).toBe(15 * 60 * 1000)
  })

  it('runs immediately when a feed has never been fetched', () => {
    expect(getNextAutoRefreshDelayMs([makeFeed()], 1000, 15)).toBe(0)
  })

  it('uses the earliest due time across feeds', () => {
    const now = 60 * 60 * 1000
    const feeds = [
      { ...makeFeed(), id: 'feed-1', lastFetched: now - 5 * 60 * 1000 },
      { ...makeFeed(), id: 'feed-2', lastFetched: now - 14 * 60 * 1000 },
    ]

    expect(getNextAutoRefreshDelayMs(feeds, now, 15)).toBe(60 * 1000)
  })

  it('respects social feed failure backoff when computing the next run', () => {
    const now = 60 * 60 * 1000
    const feed = {
      ...makeFeed(),
      url: 'https://rsshub.app/instagram/user/example',
      lastFetched: now - 30 * 60 * 1000,
      errorCount: 3,
    }

    expect(getNextAutoRefreshDelayMs([feed], now, 15)).toBe(30 * 60 * 1000)
  })
})
