import { RefreshLogEntry } from '../models/LivoModels'
import { PreferenceStoreAccessor } from './PreferenceStoreAccessor'

const REFRESH_LOGS_KEY: string = 'refreshLogs'
const MAX_REFRESH_LOGS: number = 60

function normalizeRefreshLogEntry(item: RefreshLogEntry): RefreshLogEntry {
  const normalized: RefreshLogEntry = {
    id: item.id,
    refreshedAt: Number(item.refreshedAt) || 0,
    successFeedCount: Math.max(0, Number(item.successFeedCount) || 0),
    failedFeedCount: Math.max(0, Number(item.failedFeedCount) || 0),
    failedFeedTitles: Array.isArray(item.failedFeedTitles)
      ? item.failedFeedTitles.filter((title: string) => !!title)
      : [],
  }
  return normalized
}

export class RefreshLogStore {
  static async load(): Promise<RefreshLogEntry[]> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      const raw = await pref.get(REFRESH_LOGS_KEY, '[]')
      const text = typeof raw === 'string' ? raw : '[]'
      const parsed = JSON.parse(text) as RefreshLogEntry[]
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed
        .filter((item: RefreshLogEntry) => item && typeof item.id === 'string')
        .map((item: RefreshLogEntry) => normalizeRefreshLogEntry(item))
    } catch (_error) {
      return []
    }
  }

  static async save(entries: RefreshLogEntry[]): Promise<RefreshLogEntry[]> {
    const normalizedEntries = entries
      .slice(0, MAX_REFRESH_LOGS)
      .map((entry: RefreshLogEntry) => normalizeRefreshLogEntry(entry))

    const pref = await PreferenceStoreAccessor.getPreferences()
    try {
      await pref.put(REFRESH_LOGS_KEY, JSON.stringify(normalizedEntries))
      await pref.flush()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '保存刷新日志失败')
    }
    return normalizedEntries
  }

  static async append(entry: RefreshLogEntry): Promise<RefreshLogEntry[]> {
    const current = await RefreshLogStore.load()
    const nextEntries = [entry, ...current].slice(0, MAX_REFRESH_LOGS)
    return RefreshLogStore.save(nextEntries)
  }

  static async clear(): Promise<void> {
    await RefreshLogStore.save([])
  }
}
