import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  Entry,
  Feed,
  FeverAccount,
  FeverFeedMapping,
  FeverItemMapping,
  FeverSyncState,
} from '../../shared/types'
import { FeedViewType } from '../../shared/types'
import { SqliteAdapter } from './sqlite-adapter'

const adapters: SqliteAdapter[] = []
const tempDirs: string[] = []

function createAdapter(): SqliteAdapter {
  const dir = mkdtempSync(join(tmpdir(), 'livo-sqlite-adapter-'))
  tempDirs.push(dir)
  const adapter = new SqliteAdapter(join(dir, 'test.sqlite'))
  adapters.push(adapter)
  return adapter
}

function canCreateSqliteAdapter(): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'livo-sqlite-adapter-preflight-'))
  try {
    const adapter = new SqliteAdapter(join(dir, 'test.sqlite'))
    adapter.close()
    return true
  } catch {
    return false
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function makeFeed(partial: Partial<Feed> = {}): Feed {
  return {
    id: partial.id ?? 'feed-1',
    title: partial.title ?? 'Feed title',
    url: partial.url ?? 'https://example.com/feed.xml',
    siteUrl: partial.siteUrl,
    description: partial.description,
    imageUrl: partial.imageUrl,
    folder: partial.folder,
    category: partial.category,
    view: partial.view ?? FeedViewType.Articles,
    maxEntries: partial.maxEntries,
    showInAll: partial.showInAll,
    lastFetched: partial.lastFetched,
    etag: partial.etag,
    lastModified: partial.lastModified,
    fetchSource: partial.fetchSource,
    upstreamUrl: partial.upstreamUrl,
    remoteFeedId: partial.remoteFeedId,
    provider: partial.provider,
    lastRefreshStatus: partial.lastRefreshStatus,
    lastRefreshAttemptedAt: partial.lastRefreshAttemptedAt,
    lastRefreshError: partial.lastRefreshError,
    lastRefreshRawError: partial.lastRefreshRawError,
    errorCount: partial.errorCount ?? 0,
    createdAt: partial.createdAt ?? 1000,
  }
}

function makeEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: partial.id ?? 'entry-1',
    feedId: partial.feedId ?? 'feed-1',
    title: partial.title ?? 'Entry title',
    url: partial.url ?? 'https://example.com/entry-1',
    content: partial.content,
    summary: partial.summary,
    readabilityContent: partial.readabilityContent,
    readabilityTitle: partial.readabilityTitle,
    readabilityExcerpt: partial.readabilityExcerpt,
    readabilitySiteName: partial.readabilitySiteName,
    readabilityLength: partial.readabilityLength,
    readabilityFetchedAt: partial.readabilityFetchedAt,
    readabilityError: partial.readabilityError,
    aiSummary: partial.aiSummary,
    aiSummaryGeneratedAt: partial.aiSummaryGeneratedAt,
    aiSummaryError: partial.aiSummaryError,
    notifiedAt: partial.notifiedAt,
    author: partial.author,
    authorAvatar: partial.authorAvatar,
    imageUrl: partial.imageUrl,
    media: partial.media,
    publishedAt: partial.publishedAt ?? 1000,
    isRead: partial.isRead ?? false,
    isStarred: partial.isStarred ?? false,
    readProgress: partial.readProgress,
    isListened: partial.isListened,
    listenProgress: partial.listenProgress,
    createdAt: partial.createdAt ?? 1000,
  }
}

afterEach(() => {
  while (adapters.length > 0) {
    adapters.pop()?.close()
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

const describeSqliteAdapter = canCreateSqliteAdapter()
  ? describe
  : describe.skip

describeSqliteAdapter('SqliteAdapter repository contracts', () => {
  it('runs migrations and preserves feed defaults through feed queries', () => {
    const adapter = createAdapter()
    const feed = makeFeed({ showInAll: undefined, provider: undefined })

    adapter.insertFeed(feed)

    expect(adapter.getAllFeeds()).toHaveLength(1)
    expect(adapter.getFeedById(feed.id)).toMatchObject({
      id: feed.id,
      title: feed.title,
      showInAll: true,
      provider: 'local',
    })
    expect(adapter.getFeedByUrl(feed.url)?.id).toBe(feed.id)
  })

  it('persists feed refresh status fields through feed repository writes', () => {
    const adapter = createAdapter()
    const feed = makeFeed({
      lastRefreshStatus: 'failed',
      lastRefreshAttemptedAt: 2000,
      lastRefreshError: '源站返回 HTTP 403',
      lastRefreshRawError: 'HTTP 403 Forbidden',
    })

    adapter.insertFeed(feed)

    expect(adapter.getFeedById(feed.id)).toMatchObject({
      lastRefreshStatus: 'failed',
      lastRefreshAttemptedAt: 2000,
      lastRefreshError: '源站返回 HTTP 403',
      lastRefreshRawError: 'HTTP 403 Forbidden',
    })

    adapter.updateFeed(feed.id, {
      lastRefreshStatus: 'succeeded',
      lastRefreshAttemptedAt: 3000,
      lastRefreshError: undefined,
      lastRefreshRawError: undefined,
      errorCount: 0,
    })

    expect(adapter.getFeedById(feed.id)).toMatchObject({
      lastRefreshStatus: 'succeeded',
      lastRefreshAttemptedAt: 3000,
      lastRefreshError: undefined,
      lastRefreshRawError: undefined,
      errorCount: 0,
    })
  })

  it('stores entries and applies list filters, pagination, and read counts', () => {
    const adapter = createAdapter()
    adapter.insertFeed(makeFeed({ id: 'feed-1' }))
    adapter.insertFeed(
      makeFeed({
        id: 'feed-2',
        url: 'https://example.com/feed-2.xml',
        createdAt: 2000,
      }),
    )
    adapter.insertEntries([
      makeEntry({
        id: 'entry-new',
        title: 'Newest unread',
        publishedAt: 3000,
        isStarred: true,
      }),
      makeEntry({
        id: 'entry-old',
        title: 'Older read',
        publishedAt: 1000,
        isRead: true,
      }),
      makeEntry({
        id: 'entry-other-feed',
        feedId: 'feed-2',
        title: 'Other feed',
        url: 'https://example.com/entry-other-feed',
        publishedAt: 2000,
      }),
    ])

    expect(
      adapter
        .getEntries({ feedId: 'feed-1', unreadOnly: true })
        .entries.map((entry) => entry.id),
    ).toEqual(['entry-new'])
    expect(
      adapter.getEntries({ starred: true }).entries.map((entry) => entry.id),
    ).toEqual(['entry-new'])

    const page = adapter.getEntries({ limit: 1, offset: 0 })
    expect(page.entries.map((entry) => entry.id)).toEqual(['entry-new'])
    expect(page.hasMore).toBe(true)
    expect(adapter.getUnreadCount('feed-1')).toBe(1)
    expect(Object.fromEntries(adapter.getUnreadCountMap())).toEqual({
      'feed-1': 1,
      'feed-2': 1,
    })
  })

  it('supports keyset pagination with publishedAt and id ordering', () => {
    const adapter = createAdapter()
    adapter.insertFeed(makeFeed({ id: 'feed-1' }))
    adapter.insertEntries([
      makeEntry({
        id: 'entry-c',
        title: 'C',
        url: 'https://example.com/entry-c',
        publishedAt: 2000,
      }),
      makeEntry({
        id: 'entry-b',
        title: 'B',
        url: 'https://example.com/entry-b',
        publishedAt: 2000,
      }),
      makeEntry({
        id: 'entry-a',
        title: 'A',
        url: 'https://example.com/entry-a',
        publishedAt: 1000,
      }),
    ])

    const first = adapter.getEntries({ limit: 1, skipDedupe: true })
    expect(first.entries.map((entry) => entry.id)).toEqual(['entry-c'])
    expect(first.nextCursorEntry).toEqual({
      id: 'entry-c',
      publishedAt: 2000,
    })

    const second = adapter.getEntries({
      limit: 2,
      beforePublishedAt: first.nextCursorEntry?.publishedAt,
      beforeId: first.nextCursorEntry?.id,
      skipDedupe: true,
    })
    expect(second.entries.map((entry) => entry.id)).toEqual([
      'entry-b',
      'entry-a',
    ])
  })

  it('upserts digest runs by preset, feed, and window start', () => {
    const adapter = createAdapter()
    const feed = makeFeed()
    adapter.insertFeed(feed)

    const first = adapter.upsertAIDigestRun({
      preset: 'today',
      feedId: feed.id,
      title: 'Running digest',
      status: 'running',
      windowStartAt: 1000,
      windowEndAt: 2000,
      sourceEntryIds: ['entry-1'],
      candidateCount: 1,
    })
    const updated = adapter.upsertAIDigestRun({
      preset: 'today',
      feedId: feed.id,
      title: 'Completed digest',
      status: 'completed',
      windowStartAt: 1000,
      windowEndAt: 3000,
      sourceEntryIds: ['entry-1', 'entry-2'],
      candidateCount: 2,
      content: 'Digest body',
    })

    expect(updated.id).toBe(first.id)
    expect(adapter.listAIDigestRuns()).toHaveLength(1)
    expect(adapter.listAIDigestRuns()[0]).toMatchObject({
      id: first.id,
      title: 'Completed digest',
      status: 'completed',
      sourceEntryIds: ['entry-1', 'entry-2'],
      candidateCount: 2,
      content: 'Digest body',
    })
  })

  it('persists entry AI summary sessions by latest updated state', () => {
    const adapter = createAdapter()
    const feed = makeFeed()
    const entry = makeEntry({ content: 'Article body' })
    adapter.insertFeed(feed)
    adapter.insertEntry(entry)

    const first = adapter.aiSummarySessions.createSession({
      entryId: entry.id,
      status: 'queued',
      draftText: '',
      model: 'gpt-test',
      sourceHash: 'hash-1',
    })
    const completed = adapter.aiSummarySessions.updateSession(first.id, {
      status: 'succeeded',
      draftText: '摘要草稿',
      finalText: '摘要草稿',
      runId: 'ai-summarize-1',
      finishedAt: 2000,
    })

    expect(completed).toMatchObject({
      id: first.id,
      entryId: entry.id,
      status: 'succeeded',
      finalText: '摘要草稿',
      runId: 'ai-summarize-1',
    })
    expect(
      adapter.aiSummarySessions.getLatestSessionByEntryId(entry.id),
    ).toMatchObject({
      id: first.id,
      status: 'succeeded',
      finalText: '摘要草稿',
    })
  })

  it('persists Fever accounts, mappings, and sync state', () => {
    const adapter = createAdapter()
    const feed = makeFeed()
    const entry = makeEntry()
    adapter.insertFeed(feed)
    adapter.insertEntry(entry)

    const account: FeverAccount = {
      id: 'account-1',
      baseUrl: 'https://fever.example.com',
      username: 'user',
      apiKey: 'secret',
      enabled: true,
      autoSync: true,
      syncIntervalMin: 30,
      createdAt: 1000,
    }
    const feedMapping: FeverFeedMapping = {
      accountId: account.id,
      feverFeedId: 42,
      localFeedId: feed.id,
      remoteGroup: 'News',
      remoteTitle: 'Remote feed',
      remoteUrl: 'https://remote.example.com/feed.xml',
      isActive: true,
      lastSeenAt: 2000,
    }
    const itemMapping: FeverItemMapping = {
      accountId: account.id,
      feverItemId: 99,
      feverFeedId: feedMapping.feverFeedId,
      localFeedId: feed.id,
      localEntryId: entry.id,
      remoteIsRead: false,
      remoteIsStarred: true,
      isActive: true,
      lastSeenAt: 3000,
    }
    const syncState: FeverSyncState = {
      accountId: account.id,
      lastItemId: 99,
      lastSyncAt: 4000,
      lastFullSyncAt: 5000,
    }

    adapter.insertFeverAccount(account)
    adapter.upsertFeverFeedMapping(feedMapping)
    adapter.upsertFeverItemMapping(itemMapping)
    adapter.upsertFeverSyncState(syncState)

    expect(adapter.getFeverAccountById(account.id)).toMatchObject(account)
    expect(adapter.getFeverFeedMappingByRemoteId(account.id, 42)).toMatchObject(
      feedMapping,
    )
    expect(adapter.getFeverItemMapping(account.id, 99)).toMatchObject(
      itemMapping,
    )
    expect(adapter.getFeverItemMappingsByLocalEntry(entry.id)).toHaveLength(1)
    expect(adapter.getFeverSyncState(account.id)).toMatchObject(syncState)
  })
})
