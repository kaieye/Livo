/**
 * Client-side entry cache layer.
 *
 * Manages three cache tiers for the renderer entry store:
 * - List cache: paginated entry list results with TTL-based expiration
 * - Detail cache: full entry objects keyed by entry ID
 * - Snapshot cache: compact entry snapshots used for list→detail merging
 *
 * Also provides in-flight request deduplication to avoid duplicate IPC calls.
 */
import type { Entry, EntryListResult } from '../../../shared/types'

const ENTRY_LIST_CACHE_TTL_MS = 10 * 60 * 1000 // Extended from 2min to 10min
const EMPTY_ENTRY_LIST_CACHE_TTL_MS = 5000
const ENTRY_LIST_CACHE_VERSION = 4
const DEFAULT_ENTRY_PAGE_SIZE = 10
const MAX_ENTRY_PAGE_SIZE = 1000

const entryListCache = new Map<
  string,
  { result: EntryListResult; cachedAt: number }
>()
const entryListInFlight = new Map<string, Promise<EntryListResult>>()
const entryDetailCache = new Map<string, Entry>()
const entryDetailInFlight = new Map<string, Promise<Entry | null>>()
const entrySnapshotCache = new Map<string, Entry>()

// ---- List cache ----

export function buildListCacheKey(options?: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  offset?: number
}): string {
  const feedIds = [...(options?.feedIds || [])].sort()
  return JSON.stringify({
    v: ENTRY_LIST_CACHE_VERSION,
    feedId: options?.feedId || '',
    feedIds,
    starred: !!options?.starred,
    unreadOnly: !!options?.unreadOnly,
    offset: options?.offset ?? 0,
  })
}

/** Returns cached result if fresh, sliced to limit. null = miss. */
export function getCachedListResult(
  cacheKey: string,
  limit?: number,
): EntryListResult | null {
  const cached = entryListCache.get(cacheKey)
  if (!cached) return null
  const ttl = cached.result?.entries?.length
    ? ENTRY_LIST_CACHE_TTL_MS
    : EMPTY_ENTRY_LIST_CACHE_TTL_MS
  if (Date.now() - cached.cachedAt < ttl) {
    const entries = cached.result.entries
    if (limit != null && entries.length < limit && cached.result.hasMore) {
      // Cache has fewer entries than requested and more exist — refetch.
      return null
    }
    if (limit != null && entries.length > limit) {
      return { entries: entries.slice(0, limit), hasMore: true }
    }
    return cached.result
  }
  return null
}

/** Manually populate the list cache (e.g. after a snapshot load). */
export function setCachedListResult(
  cacheKey: string,
  result: EntryListResult,
): void {
  entryListCache.set(cacheKey, { result, cachedAt: Date.now() })
}

/** Fetch with in-flight dedup and cache store. */
export async function fetchAndCacheList(
  cacheKey: string,
  fetchFn: () => Promise<EntryListResult>,
): Promise<EntryListResult> {
  const existing = entryListInFlight.get(cacheKey)
  if (existing) return existing
  const promise = fetchFn()
    .then((result) => {
      entryListCache.set(cacheKey, { result, cachedAt: Date.now() })
      return result
    })
    .finally(() => {
      entryListInFlight.delete(cacheKey)
    })
  entryListInFlight.set(cacheKey, promise)
  return promise
}

export function getDefaultPageSize(): number {
  return DEFAULT_ENTRY_PAGE_SIZE
}

export function getMaxPageSize(): number {
  return MAX_ENTRY_PAGE_SIZE
}

// ---- Detail cache ----

export function hasEntryDetail(entryId: string): boolean {
  return entryDetailCache.has(entryId)
}

export function getCachedEntryDetail(entryId: string): Entry | undefined {
  const detail = entryDetailCache.get(entryId)
  if (!detail) return undefined
  const snapshot = entrySnapshotCache.get(entryId)
  return snapshot ? mergeEntrySnapshotState(detail, snapshot) : detail
}

export function cacheEntryDetail(entry: Entry): Entry {
  entryDetailCache.set(entry.id, entry)
  return getCachedEntryDetail(entry.id) ?? entry
}

export function getEntryDetailInFlight(
  entryId: string,
): Promise<Entry | null> | undefined {
  return entryDetailInFlight.get(entryId)
}

export function setEntryDetailInFlight(
  entryId: string,
  promise: Promise<Entry | null>,
): void {
  entryDetailInFlight.set(entryId, promise)
}

export function deleteEntryDetailInFlight(entryId: string): void {
  entryDetailInFlight.delete(entryId)
}

// ---- Snapshot cache ----

export function cacheEntrySnapshot(entry: Entry): Entry {
  entrySnapshotCache.set(entry.id, entry)
  return entry
}

export function cacheEntrySnapshots(entries: Entry[]): Entry[] {
  for (const entry of entries) cacheEntrySnapshot(entry)
  return entries
}

export function mergeEntrySnapshotState(detail: Entry, snapshot: Entry): Entry {
  return {
    ...detail,
    feedId: snapshot.feedId,
    title: snapshot.title,
    url: snapshot.url,
    author: snapshot.author ?? detail.author,
    authorAvatar: snapshot.authorAvatar ?? detail.authorAvatar,
    imageUrl: snapshot.imageUrl ?? detail.imageUrl,
    media: snapshot.media ?? detail.media,
    publishedAt: snapshot.publishedAt,
    isRead: snapshot.isRead,
    isStarred: snapshot.isStarred,
    readProgress: snapshot.readProgress ?? detail.readProgress,
    notifiedAt: snapshot.notifiedAt ?? detail.notifiedAt,
    createdAt: snapshot.createdAt,
  }
}

export function patchCachedEntry(entryId: string, patch: Partial<Entry>): void {
  const snapshot = entrySnapshotCache.get(entryId)
  if (snapshot) entrySnapshotCache.set(entryId, { ...snapshot, ...patch })
  const detail = entryDetailCache.get(entryId)
  if (detail) entryDetailCache.set(entryId, { ...detail, ...patch })
}

export function getInitialSelectedEntry(entry: Entry): Entry {
  const snapshot = cacheEntrySnapshot(entry)
  const detail = getCachedEntryDetail(entry.id)
  return detail ? mergeEntrySnapshotState(detail, snapshot) : snapshot
}

// ---- Cache clearing ----

export function clearAllCaches(): void {
  entryListCache.clear()
  entryListInFlight.clear()
  entrySnapshotCache.clear()
}

export function invalidateListCache(): void {
  entryListCache.clear()
}

/**
 * Invalidate only the cache entries related to a specific feed.
 * This is more granular than clearAllCaches() and preserves unrelated cached data.
 */
export function invalidateFeedCache(feedId: string): void {
  const keysToDelete: string[] = []

  for (const [key] of entryListCache) {
    try {
      const parsed = JSON.parse(key) as {
        feedId?: string
        feedIds?: string[]
      }

      // Invalidate if this cache key is for the specific feed or includes it in feedIds
      if (parsed.feedId === feedId || parsed.feedIds?.includes(feedId)) {
        keysToDelete.push(key)
      }
    } catch {
      // Invalid key format, skip
    }
  }

  for (const key of keysToDelete) {
    entryListCache.delete(key)
  }
}

/**
 * Invalidate cache entries for multiple feeds.
 * Useful when refreshing multiple feeds at once.
 */
export function invalidateMultipleFeedsCaches(feedIds: string[]): void {
  if (feedIds.length === 0) return

  const feedIdSet = new Set(feedIds)
  const keysToDelete: string[] = []

  for (const [key] of entryListCache) {
    try {
      const parsed = JSON.parse(key) as {
        feedId?: string
        feedIds?: string[]
      }

      // Invalidate if this cache key involves any of the specified feeds
      const shouldInvalidate =
        (parsed.feedId && feedIdSet.has(parsed.feedId)) ||
        (parsed.feedIds && parsed.feedIds.some((id) => feedIdSet.has(id)))

      if (shouldInvalidate) {
        keysToDelete.push(key)
      }
    } catch {
      // Invalid key format, skip
    }
  }

  for (const key of keysToDelete) {
    entryListCache.delete(key)
  }
}

// ---- List helpers ----

export function sortEntriesByPublishedDesc(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )
}

export function mergeEntriesById(prev: Entry[], next: Entry[]): Entry[] {
  if (next.length === 0) return prev
  const byId = new Map<string, Entry>()
  for (const entry of prev) byId.set(entry.id, entry)
  for (const entry of next) byId.set(entry.id, entry)
  return sortEntriesByPublishedDesc(Array.from(byId.values()))
}
