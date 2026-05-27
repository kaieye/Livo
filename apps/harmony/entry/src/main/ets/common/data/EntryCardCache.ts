import type { HomeEntryMode } from './HomeEntryModeUtils'
import { modeMatchesFeedView } from './HomeEntryModeUtils'

const MAX_CACHED_MODES = 5
const CACHE_TTL_MS = 5 * 60 * 1000

export interface FeedLike {
  id: string
  view: number
  updatedAt: number
}

interface CacheItem<TEntry> {
  signature: string
  entries: TEntry[]
  savedAt: number
}

function allowedFeedsForMode<TFeed extends FeedLike>(
  feeds: TFeed[],
  mode: HomeEntryMode,
): TFeed[] {
  return feeds.filter((feed) => modeMatchesFeedView(mode, feed.view))
}

function modeFeedSignature<TFeed extends FeedLike>(
  mode: HomeEntryMode,
  feeds: TFeed[],
): string {
  const allowedFeedIds = allowedFeedsForMode(feeds, mode).map(
    (feed) => `${feed.id}:${feed.updatedAt}:${feed.view}`,
  )
  return `${mode}|${allowedFeedIds.join('|')}`
}

export interface IEntryCardCache<
  TEntry = object,
  TFeed extends FeedLike = FeedLike,
> {
  clear(): void
  get(
    mode: HomeEntryMode,
    feeds: TFeed[],
    targetCount: number,
  ): TEntry[] | undefined
  set(mode: HomeEntryMode, feeds: TFeed[], entries: TEntry[]): void
}

export class EntryCardCache<
  TEntry = object,
  TFeed extends FeedLike = FeedLike,
> implements IEntryCardCache<TEntry, TFeed> {
  private readonly store: Map<string, CacheItem<TEntry>> = new Map()
  private modeOrder: string[] = []

  clear(): void {
    this.store.clear()
    this.modeOrder = []
  }

  get(
    mode: HomeEntryMode,
    feeds: TFeed[],
    targetCount: number,
  ): TEntry[] | undefined {
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

  set(mode: HomeEntryMode, feeds: TFeed[], entries: TEntry[]): void {
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
