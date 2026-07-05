import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedViewType, IPC, type Feed } from '../../shared/types'
import { registerFeedHandlers } from './feed-handlers'

const registerChannelMock = vi.hoisted(() => vi.fn())
const addFeedMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))

vi.mock('../ipc/register-channel', () => ({
  registerChannel: registerChannelMock,
}))

vi.mock('../operations/feed-operations', () => ({
  addFeed: addFeedMock,
  refreshAllFeeds: vi.fn(),
  refreshFeed: vi.fn(),
  removeFeed: vi.fn(),
}))

vi.mock('../services/auth/session-store', () => ({
  sessionStore: {
    isSessionValid: vi.fn(() => false),
    getSession: vi.fn(() => null),
  },
}))

vi.mock('../database', () => ({
  getDb: vi.fn(),
}))

vi.mock('../services/system/app-shell', () => ({
  getAppCacheDirectoryPath: vi.fn(() => ''),
  getDirectorySize: vi.fn(() => 0),
}))

function makeFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    title: 'Example Feed',
    url: 'https://example.com/feed.xml',
    upstreamUrl: 'https://example.com/feed.xml',
    category: 'Tech',
    folder: 'Tech',
    view: FeedViewType.Articles,
    fetchSource: 'auto',
    showInAll: true,
    errorCount: 0,
    createdAt: 1,
    ...overrides,
  }
}

function getRegisteredHandler(channel: string) {
  const call = registerChannelMock.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  )
  expect(call).toBeTruthy()
  return call?.[1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerFeedHandlers', () => {
  beforeEach(() => {
    registerChannelMock.mockReset()
    addFeedMock.mockReset()
  })

  it('adds feeds optimistically from the UI subscription IPC path', async () => {
    const feed = makeFeed()
    addFeedMock.mockResolvedValue({ success: true, feed, existed: false })

    registerFeedHandlers()
    const handler = getRegisteredHandler(IPC.FEED_ADD)

    const result = await handler(
      {},
      'https://example.com/feed.xml',
      'Tech',
      FeedViewType.Articles,
      'Example Feed',
    )

    expect(addFeedMock).toHaveBeenCalledWith({
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      category: 'Tech',
      view: FeedViewType.Articles,
      deferInitialFetch: true,
    })
    expect(result).toEqual({ success: true, feed })
  })
})
