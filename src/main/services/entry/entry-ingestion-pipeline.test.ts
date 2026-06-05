import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FeedViewType,
  type Entry,
  type Feed,
} from '../../../shared/types/index'
import { ingestParsedFeedEntries } from './entry-ingestion-pipeline'
import { buildEntriesFromParsedItems } from './entry-builder'
import { enqueueEntryActionEffects } from './entry-action-effects'
import { getActionRules } from '../actions/action-rules-store'
import { validateAIConfig } from '../ai/ai-client'

vi.mock('./entry-builder', () => ({
  buildEntriesFromParsedItems: vi.fn(),
}))

vi.mock('./entry-action-effects', () => ({
  enqueueEntryActionEffects: vi.fn(),
}))

const {
  mockInsertEntriesWithResult,
  mockReplaceEntriesForFeedWithResult,
  mockGetSettings,
} = vi.hoisted(() => ({
  mockInsertEntriesWithResult: vi.fn(),
  mockReplaceEntriesForFeedWithResult: vi.fn(),
  mockGetSettings: vi.fn(),
}))

vi.mock('../../database', () => ({
  getDb: () => ({
    entries: {
      insertEntriesWithResult: mockInsertEntriesWithResult,
      replaceEntriesForFeedWithResult: mockReplaceEntriesForFeedWithResult,
    },
  }),
}))

vi.mock('../actions/action-rules-store', () => ({
  getActionRules: vi.fn(),
}))

vi.mock('../system/settings-provider', () => ({
  settingsProvider: {
    get: mockGetSettings,
  },
}))

vi.mock('../ai/ai-client', () => ({
  validateAIConfig: vi.fn(),
}))

function makeFeed(): Feed {
  return {
    id: 'feed-1',
    title: 'Tech Feed',
    url: 'https://example.com/feed.xml',
    siteUrl: 'https://example.com',
    category: 'Tech',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1,
  }
}

function makeEntry(id: string, title: string, url: string): Entry {
  return {
    id,
    feedId: 'feed-1',
    title,
    content: 'content',
    url,
    publishedAt: 1,
    isRead: false,
    isStarred: false,
    createdAt: 1,
  }
}

beforeEach(() => {
  vi.mocked(buildEntriesFromParsedItems).mockReset()
  vi.mocked(enqueueEntryActionEffects).mockReset()
  mockInsertEntriesWithResult.mockReset()
  mockReplaceEntriesForFeedWithResult.mockReset()
  vi.mocked(getActionRules).mockReset()
  mockGetSettings.mockReset()
  vi.mocked(validateAIConfig).mockReset()

  mockGetSettings.mockReturnValue({
    ai: {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'test-model',
    },
  } as never)
  vi.mocked(validateAIConfig).mockReturnValue(null)
})

describe('ingestParsedFeedEntries', () => {
  it('builds, filters, applies rules, persists entries, and queues effects', async () => {
    const feed = makeFeed()
    const keptEntry = makeEntry(
      'entry-1',
      'keep this entry',
      'https://blog.example.com/post-1',
    )
    const foreignEntry = makeEntry(
      'entry-2',
      'keep foreign entry',
      'https://another-site.com/post-2',
    )
    vi.mocked(buildEntriesFromParsedItems).mockResolvedValue([
      keptEntry,
      foreignEntry,
    ])
    vi.mocked(getActionRules).mockReturnValue([
      {
        id: 'rule-1',
        name: 'notify kept entries',
        enabled: true,
        conditions: [
          { field: 'entry.title', operator: 'contains', value: 'keep' },
        ],
        actions: [{ type: 'star' }, { type: 'notify' }],
        createdAt: 1,
      },
    ])
    mockInsertEntriesWithResult.mockReturnValue({
      addedCount: 1,
      addedEntries: [{ ...keptEntry, isStarred: true }],
    })

    const result = await ingestParsedFeedEntries({
      feed,
      items: [{ title: 'raw item' }],
      authorAvatarSeed: 'https://example.com/avatar.png',
      parsedFeedLink: 'https://example.com/feed.xml',
      now: 123,
    })

    expect(buildEntriesFromParsedItems).toHaveBeenCalledWith(
      feed.id,
      [{ title: 'raw item' }],
      'https://example.com/avatar.png',
      feed.view,
      123,
    )
    expect(mockInsertEntriesWithResult).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'entry-1',
        isStarred: true,
      }),
    ])
    expect(mockReplaceEntriesForFeedWithResult).not.toHaveBeenCalled()
    expect(enqueueEntryActionEffects).toHaveBeenCalledWith([
      {
        entry: expect.objectContaining({ id: 'entry-1' }),
        feed,
        effects: ['star', 'notify'],
      },
    ])
    expect(result).toMatchObject({
      addedCount: 1,
      storedEntries: 1,
    })
  })

  it('uses replacement persistence when requested', async () => {
    const feed = makeFeed()
    const entry = makeEntry('entry-1', 'plain entry', 'https://example.com/1')
    vi.mocked(buildEntriesFromParsedItems).mockResolvedValue([entry])
    vi.mocked(getActionRules).mockReturnValue([])
    mockReplaceEntriesForFeedWithResult.mockReturnValue({
      addedCount: 1,
      addedEntries: [entry],
    })

    await ingestParsedFeedEntries({
      feed,
      items: [],
      now: 123,
      replaceExisting: true,
    })

    expect(mockReplaceEntriesForFeedWithResult).toHaveBeenCalledWith(feed.id, [
      entry,
    ])
    expect(mockInsertEntriesWithResult).not.toHaveBeenCalled()
  })
})
