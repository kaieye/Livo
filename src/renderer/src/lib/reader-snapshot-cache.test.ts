import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ReaderSnapshot,
  ReaderSnapshotRequest,
} from '../../../shared/types'

const STORAGE_KEY = 'livo:reader-snapshot-cache:v2'

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial))
  return {
    get length() {
      return entries.size
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value)
    }),
  }
}

function makeSnapshot(): ReaderSnapshot {
  return {
    feeds: [
      {
        id: 'feed-1',
        title: 'Feed',
        url: 'https://user:pass@example.com/rss.xml?token=raw-token&ok=1',
        siteUrl: 'https://example.com/site?api_key=raw-api-key&view=1',
        imageUrl:
          'https://cdn.example.com/icon.png?X-Amz-Signature=raw-signature&size=1',
        upstreamUrl:
          'https://upstream.example.com/feed?refresh_token=raw-refresh&view=1',
        view: 0,
        errorCount: 0,
        createdAt: 1000,
        unreadCount: 1,
      },
    ],
    entries: [
      {
        id: 'entry-1',
        feedId: 'feed-1',
        title: 'Entry',
        url: 'https://example.com/post?access_token=raw-access&ok=1',
        content:
          '<p><a href="https://user:pass@example.com/article?token=raw-content&ok=1">Read</a><img src="https://cdn.example.com/image.png?X-Amz-Signature=raw-content-sig&width=320"><video poster="https://cdn.example.com/poster.jpg?signature=raw-poster&size=large"></video><img srcset="https://cdn.example.com/small.jpg?token=raw-small&width=320 320w, https://cdn.example.com/large.jpg?sig=raw-large&width=640 640w"></p>',
        summary:
          'Read https://user:pass@example.com/summary?access_token=raw-summary&ok=1.',
        readabilityContent:
          '<p>Full text <a href="https://example.com/full?api_key=raw-full&amp;view=1&amp;page=2">link</a></p>',
        readabilityExcerpt:
          'Excerpt https://example.com/excerpt?refresh_token=raw-excerpt&keep=1,',
        aiSummary:
          'AI link https://example.com/ai?client_secret=raw-ai&keep=1)',
        authorAvatar:
          'https://cdn.example.com/avatar.jpg?token=raw-avatar&size=1',
        imageUrl: 'https://cdn.example.com/cover.jpg?sig=raw-sig&width=640',
        media: [
          {
            type: 'photo',
            url: 'https://cdn.example.com/photo.jpg?token=raw-media&ig_cache_key=abc',
            previewUrl:
              'https://cdn.example.com/preview.jpg?signature=raw-preview&size=1',
          },
        ],
        publishedAt: 1000,
        isRead: false,
        isStarred: false,
        createdAt: 1000,
        taskSnapshot: {
          fulltext: { status: 'idle' },
          aiSummary: { status: 'idle' },
        },
      },
    ],
    counts: {
      totalFeeds: 1,
      totalUnread: 1,
      unreadByFeedId: { 'feed-1': 1 },
      scopeUnread: 1,
    },
    nextCursor: null,
  }
}

function defaultSnapshotRequest(): ReaderSnapshotRequest {
  return {
    scope: { type: 'all' },
    limit: 1,
    compact: true,
    maxContentLength: 520,
  }
}

function defaultSnapshotCacheKey(): string {
  return JSON.stringify({
    scope: { type: 'all' },
    feedIds: [],
    unreadOnly: false,
    limit: 1,
    compact: true,
    maxContentLength: 520,
  })
}

function makePersistedSnapshotCache(snapshot: ReaderSnapshot): string {
  return JSON.stringify({
    version: 2,
    entries: {
      [defaultSnapshotCacheKey()]: {
        cachedAt: 1000,
        snapshot,
      },
    },
  })
}

async function loadCacheModule(initial: Record<string, string> = {}) {
  vi.resetModules()
  const storage = createMemoryStorage(initial)
  vi.stubGlobal('window', { localStorage: storage })
  const mod = await import('./reader-snapshot-cache')
  return { ...mod, storage }
}

describe('reader snapshot cache persistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes secret URL components before writing snapshots to localStorage', async () => {
    const {
      writeDefaultHomeSnapshotCache,
      readDefaultHomeSnapshotCache,
      storage,
    } = await loadCacheModule()
    const request = defaultSnapshotRequest()

    writeDefaultHomeSnapshotCache(request, makeSnapshot())

    const rawPayload = storage.getItem(STORAGE_KEY) || ''
    expect(rawPayload).not.toContain('raw-')
    expect(rawPayload).not.toContain('user:pass')
    expect(rawPayload).toContain('ig_cache_key')

    const cached = readDefaultHomeSnapshotCache(request)
    expect(cached?.feeds[0].url).toBe('https://example.com/rss.xml?ok=1')
    expect(cached?.feeds[0].siteUrl).toBe('https://example.com/site?view=1')
    expect(cached?.entries[0].url).toBe('https://example.com/post?ok=1')
    expect(cached?.entries[0].content).toContain(
      'href="https://example.com/article?ok=1"',
    )
    expect(cached?.entries[0].content).toContain(
      'src="https://cdn.example.com/image.png?width=320"',
    )
    expect(cached?.entries[0].content).toContain(
      'poster="https://cdn.example.com/poster.jpg?size=large"',
    )
    expect(cached?.entries[0].content).toContain(
      'https://cdn.example.com/small.jpg?width=320 320w',
    )
    expect(cached?.entries[0].content).toContain(
      'https://cdn.example.com/large.jpg?width=640 640w',
    )
    expect(cached?.entries[0].summary).toBe(
      'Read https://example.com/summary?ok=1.',
    )
    expect(cached?.entries[0].readabilityContent).toBe(
      '<p>Full text <a href="https://example.com/full?view=1&amp;page=2">link</a></p>',
    )
    expect(cached?.entries[0].readabilityExcerpt).toBe(
      'Excerpt https://example.com/excerpt?keep=1,',
    )
    expect(cached?.entries[0].aiSummary).toBe(
      'AI link https://example.com/ai?keep=1)',
    )
    expect(cached?.entries[0].authorAvatar).toBe(
      'https://cdn.example.com/avatar.jpg?size=1',
    )
    expect(cached?.entries[0].media?.[0].url).toBe(
      'https://cdn.example.com/photo.jpg?ig_cache_key=abc',
    )
  })

  it('sanitizes legacy snapshot cache payloads during hydration', async () => {
    const { readDefaultHomeSnapshotCache, storage } = await loadCacheModule({
      [STORAGE_KEY]: makePersistedSnapshotCache(makeSnapshot()),
    })

    const cached = readDefaultHomeSnapshotCache(defaultSnapshotRequest())

    expect(cached?.feeds[0].url).toBe('https://example.com/rss.xml?ok=1')
    expect(storage.getItem(STORAGE_KEY)).not.toContain('raw-')
    expect(storage.getItem(STORAGE_KEY)).not.toContain('user:pass')
  })

  it('does not mutate the runtime snapshot when writing sanitized cache data', async () => {
    const { writeDefaultHomeSnapshotCache } = await loadCacheModule()
    const snapshot = makeSnapshot()

    writeDefaultHomeSnapshotCache(defaultSnapshotRequest(), snapshot)

    expect(snapshot.entries[0].content).toContain('raw-content')
    expect(snapshot.entries[0].summary).toContain('user:pass')
    expect(snapshot.entries[0].aiSummary).toContain('raw-ai')
  })
})
