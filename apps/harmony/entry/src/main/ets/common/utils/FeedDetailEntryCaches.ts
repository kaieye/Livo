export interface FeedDetailEntryCacheEntryLike {
  id?: string
  feedId: string
  publishedAt: number
  url: string
  title: string
  updatedAt?: number
}

export function feedDetailEntryCacheKey(
  entry: FeedDetailEntryCacheEntryLike,
): string {
  const id = (entry.id || '').trim()
  if (id) {
    return id
  }
  return `${entry.feedId}|${entry.publishedAt}|${entry.url}|${entry.title}`
}

export function feedDetailEntryVersionCacheKey(
  entry: FeedDetailEntryCacheEntryLike,
): string {
  return `${feedDetailEntryCacheKey(entry)}|${entry.updatedAt || 0}`
}

export function feedDetailEntryStableKey(
  entry: FeedDetailEntryCacheEntryLike,
): string {
  const id = (entry.id || '').trim()
  if (id) {
    return id
  }
  return `${entry.feedId}|${entry.publishedAt}|${entry.url}`
}

/**
 * Caches values keyed by the entry version key. `reconcile` drops keys not
 * referenced by the latest entry list, ensuring stale entries do not retain
 * memory after refresh.
 */
export class FeedDetailEntryScopedCache<T> {
  private readonly storage: Map<string, T> = new Map()

  has(key: string): boolean {
    return this.storage.has(key)
  }

  get(key: string): T | undefined {
    return this.storage.get(key)
  }

  set(key: string, value: T): void {
    this.storage.set(key, value)
  }

  reconcile(expectedKeys: Set<string>): void {
    const staleKeys: string[] = []
    this.storage.forEach((_value: T, key: string) => {
      if (!expectedKeys.has(key)) {
        staleKeys.push(key)
      }
    })
    staleKeys.forEach((key: string) => {
      this.storage.delete(key)
    })
  }

  clear(): void {
    if (this.storage.size === 0) {
      return
    }
    this.storage.clear()
  }
}

export function collectFeedDetailEntryVersionKeys(
  entries: FeedDetailEntryCacheEntryLike[],
): Set<string> {
  const keys: Set<string> = new Set<string>()
  entries.forEach((entry: FeedDetailEntryCacheEntryLike) => {
    keys.add(feedDetailEntryVersionCacheKey(entry))
  })
  return keys
}
