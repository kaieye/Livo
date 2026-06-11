import type {
  ReaderSnapshot,
  ReaderSnapshotRequest,
} from '../../../shared/types'

const STORAGE_KEY = 'livo:reader-snapshot-cache:v2'
const CACHE_VERSION = 2
const MAX_CACHE_ENTRIES = 8

interface PersistedSnapshotCacheEntry {
  cachedAt: number
  snapshot: ReaderSnapshot
}

interface PersistedSnapshotCache {
  version: number
  entries: Record<string, PersistedSnapshotCacheEntry>
}

let cachedPersistedSnapshotCache: PersistedSnapshotCache | null = null

function emptyPersistedCache(): PersistedSnapshotCache {
  return { version: CACHE_VERSION, entries: {} }
}

function getStorage(): Storage | null {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function normalizeDefaultHomeSnapshotCacheKey(
  input: ReaderSnapshotRequest,
): string | null {
  const scope = input.scope ?? { type: 'all' as const }
  if (scope.type !== 'all') return null
  if (input.cursor) return null

  // 首屏视图通常带 feedIds（按视图过滤的订阅源列表），把排序后的
  // feedIds 纳入 key，让各视图的首屏都能命中缓存而不是每次都走慢 IPC。
  const feedIds = [...(scope.feedIds || [])].sort()

  return JSON.stringify({
    scope: { type: 'all' },
    feedIds,
    unreadOnly: !!input.unreadOnly,
    limit: input.limit ?? null,
    compact: input.compact ?? true,
    maxContentLength: input.maxContentLength ?? null,
  })
}

function readPersistedCache(): PersistedSnapshotCache {
  if (cachedPersistedSnapshotCache) return cachedPersistedSnapshotCache
  const storage = getStorage()
  if (!storage) {
    cachedPersistedSnapshotCache = emptyPersistedCache()
    return cachedPersistedSnapshotCache
  }

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedPersistedSnapshotCache = emptyPersistedCache()
      return cachedPersistedSnapshotCache
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshotCache>
    if (parsed.version !== CACHE_VERSION || !parsed.entries) {
      cachedPersistedSnapshotCache = emptyPersistedCache()
      return cachedPersistedSnapshotCache
    }
    cachedPersistedSnapshotCache = {
      version: CACHE_VERSION,
      entries: parsed.entries,
    }
    return cachedPersistedSnapshotCache
  } catch {
    cachedPersistedSnapshotCache = emptyPersistedCache()
    return cachedPersistedSnapshotCache
  }
}

function writePersistedCache(cache: PersistedSnapshotCache): void {
  cachedPersistedSnapshotCache = cache
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 快照缓存只是首屏体验优化，写入失败不影响真实数据加载。
  }
}

function isReaderSnapshot(value: unknown): value is ReaderSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<ReaderSnapshot>
  return (
    Array.isArray(snapshot.feeds) &&
    Array.isArray(snapshot.entries) &&
    !!snapshot.counts &&
    (snapshot.nextCursor === null || typeof snapshot.nextCursor === 'string')
  )
}

export function readDefaultHomeSnapshotCache(
  input: ReaderSnapshotRequest,
): ReaderSnapshot | null {
  const key = normalizeDefaultHomeSnapshotCacheKey(input)
  if (!key) return null

  const entry = readPersistedCache().entries[key]
  if (!entry || !isReaderSnapshot(entry.snapshot)) return null
  return entry.snapshot
}

export function writeDefaultHomeSnapshotCache(
  input: ReaderSnapshotRequest,
  snapshot: ReaderSnapshot,
): void {
  const key = normalizeDefaultHomeSnapshotCacheKey(input)
  if (!key) return

  const cache = readPersistedCache()
  cache.entries[key] = {
    cachedAt: Date.now(),
    snapshot,
  }

  const overflowKeys = Object.entries(cache.entries)
    .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
    .slice(MAX_CACHE_ENTRIES)
    .map(([entryKey]) => entryKey)
  for (const entryKey of overflowKeys) {
    delete cache.entries[entryKey]
  }

  writePersistedCache(cache)
}
