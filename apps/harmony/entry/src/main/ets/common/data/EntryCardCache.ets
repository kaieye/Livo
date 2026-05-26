import type { EntryCardModel, Feed } from '../models/LivoModels'
import type { HomeEntryMode } from './AppRepositoryEntryHelpers'
import { modeMatchesFeedView } from './AppRepositoryEntryHelpers'

interface CacheItem {
  signature: string
  entries: EntryCardModel[]
}

function allowedFeedsForMode(feeds: Feed[], mode: HomeEntryMode): Feed[] {
  return feeds.filter((feed) => modeMatchesFeedView(mode, feed.view))
}

function modeFeedSignature(mode: HomeEntryMode, feeds: Feed[]): string {
  const allowedFeedIds = allowedFeedsForMode(feeds, mode)
    .map((feed) => `${feed.id}:${feed.updatedAt}:${feed.view}`)
  return `${mode}|${allowedFeedIds.join('|')}`
}

export class EntryCardCache {
  private readonly store: Map<string, CacheItem> = new Map()

  clear(): void {
    this.store.clear()
  }

  get(mode: HomeEntryMode, feeds: Feed[], targetCount: number): EntryCardModel[] | undefined {
    const cache = this.store.get(mode)
    const signature = modeFeedSignature(mode, feeds)
    if (!cache || cache.signature !== signature) {
      return undefined
    }
    if (cache.entries.length < targetCount) {
      return undefined
    }
    return cache.entries.slice(0, targetCount)
  }

  set(mode: HomeEntryMode, feeds: Feed[], entries: EntryCardModel[]): void {
    const existing = this.store.get(mode)
    if (existing && existing.entries.length > entries.length) {
      return
    }
    this.store.set(mode, {
      signature: modeFeedSignature(mode, feeds),
      entries: [...entries],
    })
  }
}
