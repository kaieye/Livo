import { PreferenceStoreAccessor } from './PreferenceStoreAccessor'
import { discoverAvatarCacheKey, isDiscoverAvatarCacheableImageUrl } from '../utils/discover/DiscoverAvatarPresentation'

const DISCOVER_AVATAR_CACHE_KEY: string = 'discoverAvatarCacheV1'
const MAX_DISCOVER_AVATAR_CACHE_ENTRIES: number = 600

export interface DiscoverAvatarCacheEntry {
  targetUrl: string
  siteUrl: string
  imageUrl: string
  updatedAt: number
}

function normalizeDiscoverAvatarCacheEntry(item: DiscoverAvatarCacheEntry): DiscoverAvatarCacheEntry | undefined {
  const targetUrl = (item.targetUrl || '').trim()
  const siteUrl = (item.siteUrl || '').trim()
  const imageUrl = (item.imageUrl || '').trim()
  if (!targetUrl || !isDiscoverAvatarCacheableImageUrl(imageUrl)) {
    return undefined
  }

  return {
    targetUrl,
    siteUrl,
    imageUrl,
    updatedAt: Number(item.updatedAt) || Date.now(),
  }
}

export class DiscoverAvatarCacheStore {
  static async load(): Promise<DiscoverAvatarCacheEntry[]> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      const raw = await pref.get(DISCOVER_AVATAR_CACHE_KEY, '[]')
      const text = typeof raw === 'string' ? raw : '[]'
      const parsed = JSON.parse(text) as DiscoverAvatarCacheEntry[]
      if (!Array.isArray(parsed)) {
        return []
      }

      const entries: DiscoverAvatarCacheEntry[] = []
      parsed.forEach((item: DiscoverAvatarCacheEntry) => {
        if (entries.length >= MAX_DISCOVER_AVATAR_CACHE_ENTRIES) {
          return
        }

        const normalized = normalizeDiscoverAvatarCacheEntry(item)
        if (normalized) {
          entries.push(normalized)
        }
      })
      return entries
    } catch (_error) {
      return []
    }
  }

  static async save(entries: DiscoverAvatarCacheEntry[]): Promise<DiscoverAvatarCacheEntry[]> {
    const normalizedEntries: DiscoverAvatarCacheEntry[] = []
    const seenKeys: Set<string> = new Set<string>()
    const normalizedCandidates: DiscoverAvatarCacheEntry[] = []
    entries.forEach((entry: DiscoverAvatarCacheEntry) => {
      const normalized = normalizeDiscoverAvatarCacheEntry(entry)
      if (normalized) {
        normalizedCandidates.push(normalized)
      }
    })
    normalizedCandidates.sort((left: DiscoverAvatarCacheEntry, right: DiscoverAvatarCacheEntry) => right.updatedAt - left.updatedAt)
    normalizedCandidates.forEach((entry: DiscoverAvatarCacheEntry) => {
      if (normalizedEntries.length >= MAX_DISCOVER_AVATAR_CACHE_ENTRIES) {
        return
      }

      const key = discoverAvatarCacheKey(entry.targetUrl, entry.siteUrl)
      if (seenKeys.has(key)) {
        return
      }
      seenKeys.add(key)
      normalizedEntries.push(entry)
    })

    const pref = await PreferenceStoreAccessor.getPreferences()
    try {
      await pref.put(DISCOVER_AVATAR_CACHE_KEY, JSON.stringify(normalizedEntries))
      await pref.flush()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '保存发现页头像缓存失败')
    }
    return normalizedEntries
  }

  static async remember(targetUrl: string, siteUrl: string, imageUrl: string): Promise<void> {
    const normalized = normalizeDiscoverAvatarCacheEntry({
      targetUrl,
      siteUrl,
      imageUrl,
      updatedAt: Date.now(),
    })
    if (!normalized) {
      return
    }

    const currentEntries = await DiscoverAvatarCacheStore.load()
    const nextEntries = [
      normalized,
      ...currentEntries.filter((entry: DiscoverAvatarCacheEntry) => {
        return discoverAvatarCacheKey(entry.targetUrl, entry.siteUrl) !== discoverAvatarCacheKey(normalized.targetUrl, normalized.siteUrl)
      }),
    ]
    await DiscoverAvatarCacheStore.save(nextEntries)
  }
}
