import { EntryCardModel, FeedViewType } from '../models/LivoModels'
import { PreferenceStoreAccessor } from './PreferenceStoreAccessor'
import { uniqueEntryCardKey } from '../data/AppRepositoryEntryHelpers'

const HOME_ENTRY_SNAPSHOT_KEY: string = 'homeEntrySnapshotV1'
const MAX_HOME_ENTRY_SNAPSHOT_ENTRIES: number = 240

function cloneHomeEntrySnapshotItem(item: EntryCardModel): EntryCardModel | undefined {
  const id = (item.id || '').trim()
  const feedId = (item.feedId || '').trim()
  if (!id || !feedId) {
    return undefined
  }

  const tags = Array.isArray(item.tags)
    ? item.tags.filter((tag: string) => !!tag)
    : []
  const mediaUrls = Array.isArray(item.mediaUrls)
    ? item.mediaUrls.filter((url: string) => !!url)
    : []
  const rawMediaUrls = Array.isArray(item.rawMediaUrls)
    ? item.rawMediaUrls.filter((url: string) => !!url)
    : []

  const normalized: EntryCardModel = {
    id,
    feedId,
    title: item.title || '',
    summary: item.summary || '',
    content: item.content || '',
    imageUrl: item.imageUrl || '',
    feedImageUrl: item.feedImageUrl || '',
    author: item.author || '',
    articleUrl: item.articleUrl || '',
    publishedAt: Number(item.publishedAt) || 0,
    publishedLabel: item.publishedLabel || '',
    readingLabel: item.readingLabel || '',
    tags,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    rawMediaUrls: rawMediaUrls.length > 0 ? rawMediaUrls : undefined,
    feedTitle: item.feedTitle || '',
    feedCategory: item.feedCategory || '',
    view: (item.view != null ? item.view : FeedViewType.Articles) as FeedViewType,
    viewLabel: item.viewLabel || '',
    viewBadgeColor: item.viewBadgeColor || '',
    hasVideoMedia: item.hasVideoMedia === true,
    isRead: item.isRead === true,
    isStarred: item.isStarred === true,
  }
  return normalized
}

function normalizeHomeEntrySnapshotEntries(entries: EntryCardModel[]): EntryCardModel[] {
  const seen = new Set<string>()
  const normalizedEntries: EntryCardModel[] = []
  entries.forEach((entry: EntryCardModel) => {
    if (normalizedEntries.length >= MAX_HOME_ENTRY_SNAPSHOT_ENTRIES) {
      return
    }

    const normalizedEntry = cloneHomeEntrySnapshotItem(entry)
    if (!normalizedEntry) {
      return
    }

    const key = uniqueEntryCardKey(normalizedEntry)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    normalizedEntries.push(normalizedEntry)
  })
  return normalizedEntries
}

function filterHomeEntrySnapshotEntriesByFeedId(entries: EntryCardModel[], feedId: string): EntryCardModel[] {
  const targetFeedId = (feedId || '').trim()
  if (!targetFeedId) {
    return normalizeHomeEntrySnapshotEntries(entries)
  }

  return normalizeHomeEntrySnapshotEntries(entries.filter((entry: EntryCardModel) => {
    return (entry.feedId || '').trim() !== targetFeedId
  }))
}

export interface IHomeEntrySnapshotStore {
  load(): Promise<EntryCardModel[]>
  save(entries: EntryCardModel[]): Promise<EntryCardModel[]>
  removeByFeedId(feedId: string): Promise<EntryCardModel[]>
}

export class HomeEntrySnapshotStore implements IHomeEntrySnapshotStore {
  static readonly default: HomeEntrySnapshotStore = new HomeEntrySnapshotStore()

  async load(): Promise<EntryCardModel[]> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      const raw = await pref.get(HOME_ENTRY_SNAPSHOT_KEY, '[]')
      const text = typeof raw === 'string' ? raw : '[]'
      const parsed = JSON.parse(text) as EntryCardModel[]
      if (!Array.isArray(parsed)) {
        return []
      }

      const seen = new Set<string>()
      const normalizedEntries: EntryCardModel[] = []
      parsed.forEach((item: EntryCardModel) => {
        if (normalizedEntries.length >= MAX_HOME_ENTRY_SNAPSHOT_ENTRIES) {
          return
        }

        const normalizedItem = cloneHomeEntrySnapshotItem(item)
        if (!normalizedItem) {
          return
        }

        const key = uniqueEntryCardKey(normalizedItem)
        if (seen.has(key)) {
          return
        }
        seen.add(key)
        normalizedEntries.push(normalizedItem)
      })
      return normalizedEntries
    } catch (_error) {
      return []
    }
  }

  async save(entries: EntryCardModel[]): Promise<EntryCardModel[]> {
    const normalizedEntries = normalizeHomeEntrySnapshotEntries(entries)
    const pref = await PreferenceStoreAccessor.getPreferences()
    try {
      await pref.put(HOME_ENTRY_SNAPSHOT_KEY, JSON.stringify(normalizedEntries))
      await pref.flush()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '保存首页快照失败')
    }
    return normalizedEntries
  }

  async removeByFeedId(feedId: string): Promise<EntryCardModel[]> {
    const pref = await PreferenceStoreAccessor.getPreferences()
    const currentEntries = await this.load()
    const nextEntries = filterHomeEntrySnapshotEntriesByFeedId(currentEntries, feedId)
    if (nextEntries.length === currentEntries.length) {
      return currentEntries
    }

    try {
      await pref.put(HOME_ENTRY_SNAPSHOT_KEY, JSON.stringify(nextEntries))
      await pref.flush()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '移除首页快照失败')
    }
    return nextEntries
  }

  // --- Static convenience methods (delegate to singleton, backward-compatible) ---

  static async load(): Promise<EntryCardModel[]> {
    return HomeEntrySnapshotStore.default.load()
  }

  static async save(entries: EntryCardModel[]): Promise<EntryCardModel[]> {
    return HomeEntrySnapshotStore.default.save(entries)
  }

  static async removeByFeedId(feedId: string): Promise<EntryCardModel[]> {
    return HomeEntrySnapshotStore.default.removeByFeedId(feedId)
  }
}
