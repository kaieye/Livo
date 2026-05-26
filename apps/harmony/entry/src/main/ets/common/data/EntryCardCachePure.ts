import type { HomeEntryMode } from './HomeEntryModeUtils'
import { modeMatchesFeedView } from './HomeEntryModeUtils'

const MAX_CACHED_MODES = 5
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheItem {
  signature: string
  entries: object[]
  savedAt: number
}

export interface FeedLike {
  id: string
  view: number
  updatedAt: number
}

function allowedFeedsForMode(
  feeds: FeedLike[],
  mode: HomeEntryMode,
): FeedLike[] {
  return feeds.filter((feed) => modeMatchesFeedView(mode, feed.view))
}

function modeFeedSignature(mode: HomeEntryMode, feeds: FeedLike[]): string {
  const allowedFeedIds = allowedFeedsForMode(feeds, mode).map(
    (feed) => `${feed.id}:${feed.updatedAt}:${feed.view}`,
  )
  return `${mode}|${allowedFeedIds.join('|')}`
}

export interface IEntryCardCache {
  clear(): void
  get(
    mode: HomeEntryMode,
    feeds: FeedLike[],
    targetCount: number,
  ): object[] | undefined
  set(mode: HomeEntryMode, feeds: FeedLike[], entries: object[]): void
}

export class EntryCardCache implements IEntryCardCache {
  private readonly store: Map<string, CacheItem> = new Map()
  private modeOrder: string[] = []

  clear(): void {
    this.store.clear()
    this.modeOrder = []
  }

  get(
    mode: HomeEntryMode,
    feeds: FeedLike[],
    targetCount: number,
  ): object[] | undefined {
    const cache = this.store.get(mode)
    if (!cache) {
      return undefined
    }
    if (Date.now() - cache.savedAt > CACHE_TTL_MS) {
      this.store.delete(mode)
      this.modeOrder = this.modeOrder.filter((m) => m !== mode)
      return undefined
    }
    const signature = modeFeedSignature(mode, feeds)
    if (cache.signature !== signature) {
      return undefined
    }
    if (cache.entries.length < targetCount) {
      return undefined
    }
    return cache.entries.slice(0, targetCount)
  }

  set(mode: HomeEntryMode, feeds: FeedLike[], entries: object[]): void {
    const existing = this.store.get(mode)
    if (existing && existing.entries.length > entries.length) {
      return
    }
    this.store.set(mode, {
      signature: modeFeedSignature(mode, feeds),
      entries: [...entries],
      savedAt: Date.now(),
    })
    this.modeOrder = this.modeOrder.filter((m) => m !== mode)
    this.modeOrder.push(mode)
    if (this.modeOrder.length > MAX_CACHED_MODES) {
      const evicted = this.modeOrder.shift()
      if (evicted) {
        this.store.delete(evicted)
      }
    }
  }
}
