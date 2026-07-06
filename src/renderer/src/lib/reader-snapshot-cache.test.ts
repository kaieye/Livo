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
})
