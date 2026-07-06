import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { dialog } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedViewType, IPC, type Feed } from '../../shared/types'
import { getDb } from '../database'
import { fetchAndParseFeed } from '../services/feed/rss-parser'
import { registerFeedHandlers } from './feed-handlers'

const registerChannelMock = vi.hoisted(() => vi.fn())
const addFeedMock = vi.hoisted(() => vi.fn())
const updateFeedMock = vi.hoisted(() => vi.fn())
const mocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  sendEvent: vi.fn(),
}))

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: mocks.showOpenDialog,
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

vi.mock('../services/feed/rss-parser', () => ({
  fetchAndParseFeed: vi.fn(),
}))

vi.mock('../services/system/event-bus', () => ({
  getEventBus: vi.fn(() => ({ send: mocks.sendEvent })),
}))

vi.mock('./settings-handlers', () => ({
  getSettings: vi.fn(() => ({
    general: {
      rsshubInstance: 'https://rsshub.example.com',
    },
  })),
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
  let tempDir = ''

  beforeEach(() => {
    registerChannelMock.mockReset()
    addFeedMock.mockReset()
    updateFeedMock.mockReset()
    mocks.showOpenDialog.mockReset()
    mocks.sendEvent.mockReset()
    vi.mocked(fetchAndParseFeed).mockReset()
    tempDir = mkdtempSync(join(tmpdir(), 'livo-opml-import-test-'))
    vi.mocked(getDb).mockReturnValue({
      feeds: {
        getFeedByUrl: vi.fn(() => null),
        getFeedById: vi.fn(() => null),
        insertFeed: vi.fn(),
        updateFeed: updateFeedMock,
      },
      entries: {
        insertEntries: vi.fn(),
      },
    } as unknown as ReturnType<typeof getDb>)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
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

  it('persists only normalized editable feed updates from IPC', async () => {
    registerFeedHandlers()
    const handler = getRegisteredHandler(IPC.FEED_UPDATE)

    const result = await handler({}, 'feed-1', {
      title: undefined,
      folder: 'Design',
      view: FeedViewType.Pictures,
      imageUrl: 'https://example.com/avatar.png',
      showInAll: false,
      maxEntries: undefined,
    })

    expect(result).toEqual({ success: true })
    expect(updateFeedMock).toHaveBeenCalledWith('feed-1', {
      folder: 'Design',
      category: 'Design',
      view: FeedViewType.Pictures,
      imageUrl: 'https://example.com/avatar.png',
      showInAll: false,
      maxEntries: undefined,
    })
  })

  it('rejects non-OPML file selections before importing', async () => {
    const filePath = join(tempDir, 'subscriptions.txt')
    writeFileSync(filePath, '<opml><body /></opml>', 'utf-8')
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [filePath],
    })

    registerFeedHandlers()
    const handler = getRegisteredHandler(IPC.FEED_IMPORT_OPML)
    const result = await handler({})

    expect(result).toEqual({
      success: false,
      error: 'Only OPML or XML files can be imported',
    })
    expect(fetchAndParseFeed).not.toHaveBeenCalled()
  })

  it('rejects oversized OPML files before importing', async () => {
    const filePath = join(tempDir, 'subscriptions.opml')
    writeFileSync(filePath, 'x'.repeat(5 * 1024 * 1024 + 1), 'utf-8')
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [filePath],
    })

    registerFeedHandlers()
    const handler = getRegisteredHandler(IPC.FEED_IMPORT_OPML)
    const result = await handler({})

    expect(result).toEqual({ success: false, error: 'OPML file is too large' })
    expect(fetchAndParseFeed).not.toHaveBeenCalled()
  })

  it('skips private or loopback feed URLs from OPML before fetching', async () => {
    const filePath = join(tempDir, 'subscriptions.opml')
    writeFileSync(
      filePath,
      `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Local" xmlUrl="http://localhost:8080/feed.xml" />
  </body>
</opml>`,
      'utf-8',
    )
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [filePath],
    })

    registerFeedHandlers()
    const handler = getRegisteredHandler(IPC.FEED_IMPORT_OPML)
    const result = await handler({})

    expect(result).toMatchObject({
      success: true,
      total: 1,
      imported: 0,
      skipped: 1,
      importedFeedIds: [],
    })
    expect((result as { errors?: string[] }).errors?.[0]).toContain(
      'URL 已被安全策略阻止',
    )
    expect(fetchAndParseFeed).not.toHaveBeenCalled()
  })
})
