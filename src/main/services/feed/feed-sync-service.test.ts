import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedSyncService } from './feed-sync-service'

const fetchMock = vi.hoisted(() => vi.fn())
const getDbMock = vi.hoisted(() => vi.fn())
const addFeedMock = vi.hoisted(() => vi.fn())
const removeFeedMock = vi.hoisted(() => vi.fn())
const sessionStoreMock = vi.hoisted(() => ({
  getValidToken: vi.fn(),
  getSession: vi.fn(),
  isSessionValid: vi.fn(),
}))
const storeState = vi.hoisted(() => new Map<string, unknown>())

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      fetch: fetchMock,
    },
  },
}))

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn((key: string) => storeState.get(key)),
    set: vi.fn((key: string, value: unknown) => storeState.set(key, value)),
  })),
}))

vi.mock('../../database', () => ({
  getDb: getDbMock,
}))

vi.mock('../../operations/feed-operations', () => ({
  addFeed: addFeedMock,
  removeFeed: removeFeedMock,
}))

vi.mock('../auth/session-store', () => ({
  sessionStore: sessionStoreMock,
}))

vi.mock('../system/settings-provider', () => ({
  settingsProvider: {
    get: () => ({ general: { rsshubInstance: 'https://rsshub.example.com' } }),
  },
}))

vi.mock('../system/logger', () => ({
  logInfo: vi.fn(),
}))

describe('FeedSyncService', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    getDbMock.mockReset()
    addFeedMock.mockReset()
    removeFeedMock.mockReset()
    sessionStoreMock.getValidToken.mockReturnValue('token-1')
    sessionStoreMock.getSession.mockReturnValue({
      userId: 'user-1',
      token: 'token-1',
      expiresAt: Date.now() + 60_000,
      user: { id: 'user-1' },
    })
    sessionStoreMock.isSessionValid.mockReturnValue(true)
    storeState.clear()
  })

  it('uses the remote feed title when materializing cloud subscriptions', async () => {
    const feeds = {
      getAllFeeds: vi.fn(() => []),
      getFeedByUrl: vi.fn(() => undefined),
    }
    const syncChanges = {
      countPending: vi.fn(() => 0),
      getChangesByUser: vi.fn(() => []),
      getChange: vi.fn(() => undefined),
      upsertChange: vi.fn(),
      markChangesSynced: vi.fn(),
    }
    getDbMock.mockReturnValue({ feeds, syncChanges })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [
          {
            url: 'https://example.com/feed.xml',
            title: 'Example Feed',
            action: 'subscribe',
            updatedAt: 1000,
          },
        ],
      }),
    })
    addFeedMock.mockResolvedValue({ success: true })

    const result = await new FeedSyncService(
      'https://api.example.com',
    ).syncFromCloud()

    expect(result).toMatchObject({
      success: true,
      downloaded: 1,
      subscribed: 1,
    })
    expect(addFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/feed.xml',
        title: 'Example Feed',
        deferInitialFetch: true,
        recordSyncChange: false,
      }),
    )
    expect(syncChanges.upsertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        url: 'https://example.com/feed.xml',
        title: 'Example Feed',
        synced: true,
      }),
    )
  })

  it('uploads local feed titles to backfill legacy cloud records', async () => {
    const feed = {
      id: 'feed-1',
      title: 'Example Feed',
      url: 'https://example.com/feed.xml',
      view: 0,
      errorCount: 0,
      createdAt: 1000,
    }
    let change = {
      userId: 'user-1',
      url: feed.url,
      action: 'subscribe' as const,
      updatedAt: 1000,
      synced: true,
      title: undefined as string | undefined,
    }
    const feeds = {
      getAllFeeds: vi.fn(() => [feed]),
      getFeedByUrl: vi.fn((url: string) =>
        url === feed.url ? feed : undefined,
      ),
    }
    const syncChanges = {
      countPending: vi.fn(() => (change.synced ? 0 : 1)),
      getChangesByUser: vi.fn(() => [change]),
      getChange: vi.fn(() => change),
      upsertChange: vi.fn((next: typeof change) => {
        change = { ...change, ...next }
      }),
      markChangesSynced: vi.fn(() => {
        change = { ...change, synced: true }
      }),
    }
    getDbMock.mockReturnValue({ feeds, syncChanges })
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/feeds/sync')) {
        const body = JSON.parse(String(init?.body))
        return {
          ok: true,
          json: async () => ({
            accepted: body.changes.length,
            ignored: 0,
            records: body.changes,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          records: [
            {
              url: feed.url,
              action: 'subscribe',
              updatedAt: 1000,
            },
          ],
        }),
      }
    })

    const result = await new FeedSyncService(
      'https://api.example.com',
    ).syncNow()

    expect(result).toMatchObject({
      success: true,
      uploaded: 1,
    })
    expect(syncChanges.upsertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        url: feed.url,
        title: 'Example Feed',
        synced: false,
      }),
    )
    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/api/feeds/sync'),
    )
    expect(uploadCall).toBeTruthy()
    expect(JSON.parse(String(uploadCall?.[1]?.body))).toEqual({
      changes: [
        {
          url: feed.url,
          title: 'Example Feed',
          action: 'subscribe',
          updatedAt: 1000,
        },
      ],
    })
  })
})
