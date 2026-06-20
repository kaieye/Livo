import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../../shared/types'
import { getDb } from '../../database'
import {
  buildSearchAndOpenEntryTool,
  buildSearchEntriesTool,
  buildSetEntryReadStateTool,
  buildSetEntryStarredStateTool,
} from './entry-tools'

vi.mock('../../database', () => ({
  getDb: vi.fn(),
}))

const operationMocks = vi.hoisted(() => ({
  markAllRead: vi.fn(() => ({ markedCount: 0 })),
  updateEntryWithWriteBack: vi.fn(),
}))

vi.mock('../../operations/entry-operations', () => ({
  markAllRead: operationMocks.markAllRead,
  updateEntryWithWriteBack: operationMocks.updateEntryWithWriteBack,
}))

const navigationMocks = vi.hoisted(() => ({
  dispatchAgentNavigation: vi.fn(),
}))

vi.mock('../navigation-bridge', () => ({
  dispatchAgentNavigation: navigationMocks.dispatchAgentNavigation,
}))

const getDbMock = vi.mocked(getDb)

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Local-first RSS search',
    url: 'https://example.com/local-first-rss',
    content: 'Searching local archives should be fast and private.',
    summary: 'A note about local search.',
    publishedAt: Date.parse('2026-06-18T12:00:00Z'),
    isRead: false,
    isStarred: false,
    createdAt: Date.parse('2026-06-18T12:00:00Z'),
    ...overrides,
  }
}

function mockDb(entries: Entry[]): void {
  getDbMock.mockReturnValue({
    entries: {
      searchEntries: vi.fn(() => entries),
    },
    feeds: {
      getAllFeeds: vi.fn(() => [{ id: 'feed-1', title: 'Engineering Notes' }]),
    },
  } as unknown as ReturnType<typeof getDb>)
}

describe('buildSearchEntriesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches local entries and includes feed names and entry ids', async () => {
    mockDb([makeEntry()])
    const tool = buildSearchEntriesTool()

    const result = await tool.execute({} as never, {
      query: 'local first',
      limit: 10,
      feedId: 'feed-1',
      starredOnly: true,
      unreadOnly: false,
      publishedAfter: '2026-06-01',
      publishedBefore: '2026-06-20T23:59:59Z',
    })

    expect(getDbMock().entries.searchEntries).toHaveBeenCalledWith(
      'local first',
      expect.objectContaining({
        limit: 10,
        feedId: 'feed-1',
        starredOnly: true,
        unreadOnly: false,
        publishedAfter: Date.parse('2026-06-01'),
        publishedBefore: Date.parse('2026-06-20T23:59:59Z'),
      }),
    )
    expect(result.status).toBe('success')
    expect(result.message).toContain('找到 1 篇')
    expect(result.message).toContain('Engineering Notes')
    expect(result.message).toContain('ID: entry-1')
    expect(result.data).toMatchObject({ count: 1 })
  })

  it('returns a useful empty result when no local entries match', async () => {
    mockDb([])
    const tool = buildSearchEntriesTool()

    const result = await tool.execute({} as never, { query: 'missing' })

    expect(getDbMock().entries.searchEntries).toHaveBeenCalledWith(
      'missing',
      expect.objectContaining({ limit: 10 }),
    )
    expect(result).toMatchObject({
      status: 'success',
      message: '没有找到包含「missing」的本地文章。',
      data: { count: 0, entries: [] },
    })
  })
})

describe('buildSearchAndOpenEntryTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the best matching entry', async () => {
    mockDb([makeEntry({ id: 'entry-best', title: 'Best match' })])
    const tool = buildSearchAndOpenEntryTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
        agentPermissions: {
          allowRead: true,
          allowNavigate: true,
          allowMutate: true,
          allowDestructive: true,
          allowExternal: true,
        },
      },
      { query: 'best match' },
    )

    expect(getDbMock().entries.searchEntries).toHaveBeenCalledWith(
      'best match',
      expect.objectContaining({ limit: 1 }),
    )
    expect(navigationMocks.dispatchAgentNavigation).toHaveBeenCalledWith({
      type: 'open-entry-detail',
      entryId: 'entry-best',
    })
    expect(result).toMatchObject({
      status: 'success',
      data: { entry: expect.objectContaining({ id: 'entry-best' }) },
    })
  })

  it('does not search when read permission is disabled', async () => {
    mockDb([makeEntry()])
    const tool = buildSearchAndOpenEntryTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
        agentPermissions: {
          allowRead: false,
          allowNavigate: true,
          allowMutate: true,
          allowDestructive: true,
          allowExternal: true,
        },
      },
      { query: 'private' },
    )

    expect(result.status).toBe('failed')
    expect(getDbMock().entries.searchEntries).not.toHaveBeenCalled()
    expect(navigationMocks.dispatchAgentNavigation).not.toHaveBeenCalled()
  })
})

describe('entry state tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks a single entry read or unread through the shared operation', async () => {
    operationMocks.updateEntryWithWriteBack.mockReturnValueOnce({
      entry: makeEntry({ isRead: true }),
      changed: true,
    })
    const tool = buildSetEntryReadStateTool()

    const result = await tool.execute({} as never, {
      entryId: 'entry-1',
      isRead: true,
    })

    expect(operationMocks.updateEntryWithWriteBack).toHaveBeenCalledWith(
      'entry-1',
      { isRead: true },
    )
    expect(result).toMatchObject({
      status: 'success',
      data: { entryId: 'entry-1', isRead: true, changed: true },
    })
  })

  it('stars or unstars a single entry through the shared operation', async () => {
    operationMocks.updateEntryWithWriteBack.mockReturnValueOnce({
      entry: makeEntry({ isStarred: true }),
      changed: true,
    })
    const tool = buildSetEntryStarredStateTool()

    const result = await tool.execute({} as never, {
      entryId: 'entry-1',
      isStarred: true,
    })

    expect(operationMocks.updateEntryWithWriteBack).toHaveBeenCalledWith(
      'entry-1',
      { isStarred: true },
    )
    expect(result).toMatchObject({
      status: 'success',
      data: { entryId: 'entry-1', isStarred: true, changed: true },
    })
  })

  it('returns failed when the entry does not exist', async () => {
    operationMocks.updateEntryWithWriteBack.mockReturnValueOnce({
      entry: null,
      changed: false,
    })
    const tool = buildSetEntryReadStateTool()

    const result = await tool.execute({} as never, {
      entryId: 'missing',
      isRead: false,
    })

    expect(result.status).toBe('failed')
    expect(result.message).toContain('未找到')
  })
})
