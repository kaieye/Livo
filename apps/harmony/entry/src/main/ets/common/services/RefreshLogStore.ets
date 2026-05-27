import { RefreshLogEntry } from '../models/LivoModels'
import { loadJsonArray, saveJsonArray } from './PreferenceStoreAccessor'

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

export interface IRefreshLogStore {
  load(): Promise<RefreshLogEntry[]>
  save(entries: RefreshLogEntry[]): Promise<RefreshLogEntry[]>
  append(entry: RefreshLogEntry): Promise<RefreshLogEntry[]>
  clear(): Promise<void>
}

export class RefreshLogStore implements IRefreshLogStore {
  static readonly default: RefreshLogStore = new RefreshLogStore()

  async load(): Promise<RefreshLogEntry[]> {
    const parsed = await loadJsonArray<RefreshLogEntry>(REFRESH_LOGS_KEY)
    return parsed
      .filter((item: RefreshLogEntry) => item && typeof item.id === 'string')
      .map((item: RefreshLogEntry) => normalizeRefreshLogEntry(item))
  }

  async save(entries: RefreshLogEntry[]): Promise<RefreshLogEntry[]> {
    const normalizedEntries = entries
      .slice(0, MAX_REFRESH_LOGS)
      .map((entry: RefreshLogEntry) => normalizeRefreshLogEntry(entry))
    await saveJsonArray(REFRESH_LOGS_KEY, normalizedEntries, '保存刷新日志失败')
    return normalizedEntries
  }

  async append(entry: RefreshLogEntry): Promise<RefreshLogEntry[]> {
    const current = await this.load()
    const nextEntries = [entry, ...current].slice(0, MAX_REFRESH_LOGS)
    return this.save(nextEntries)
  }

  async clear(): Promise<void> {
    await this.save([])
  }

  // --- Static convenience methods (delegate to singleton, backward-compatible) ---

  static async load(): Promise<RefreshLogEntry[]> {
    return RefreshLogStore.default.load()
  }

  static async save(entries: RefreshLogEntry[]): Promise<RefreshLogEntry[]> {
    return RefreshLogStore.default.save(entries)
  }

  static async append(entry: RefreshLogEntry): Promise<RefreshLogEntry[]> {
    return RefreshLogStore.default.append(entry)
  }

  static async clear(): Promise<void> {
    return RefreshLogStore.default.clear()
  }
}
