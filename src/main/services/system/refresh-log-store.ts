import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type {
  RefreshLogEntry,
  RefreshRunItemResult,
} from '../../../shared/types/index'

const MAX_REFRESH_LOGS = 60

function normalizeRunItem(item: RefreshRunItemResult): RefreshRunItemResult {
  const status = item.status === 'failed' ? 'failed' : 'succeeded'
  return {
    feedId: String(item.feedId || ''),
    feedTitle: String(item.feedTitle || ''),
    status,
    newEntries: Math.max(0, Number(item.newEntries) || 0),
    error: item.error ? String(item.error) : undefined,
  }
}

function getLogsPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'data', 'refresh-logs.json')
}

function normalizeEntry(item: RefreshLogEntry): RefreshLogEntry {
  return {
    id: item.id,
    refreshedAt: Number(item.refreshedAt) || 0,
    successFeedCount: Math.max(0, Number(item.successFeedCount) || 0),
    failedFeedCount: Math.max(0, Number(item.failedFeedCount) || 0),
    failedFeedTitles: Array.isArray(item.failedFeedTitles)
      ? item.failedFeedTitles.filter((title: string) => !!title)
      : [],
    items: Array.isArray(item.items)
      ? item.items.map((runItem) => normalizeRunItem(runItem))
      : undefined,
  }
}

export function loadRefreshLogs(): RefreshLogEntry[] {
  const logsPath = getLogsPath()
  if (!existsSync(logsPath)) return []

  try {
    const raw = readFileSync(logsPath, 'utf-8')
    const parsed = JSON.parse(raw) as RefreshLogEntry[]
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => normalizeEntry(item))
  } catch {
    return []
  }
}

function saveRefreshLogs(entries: RefreshLogEntry[]): void {
  const logsPath = getLogsPath()
  const dir = join(logsPath, '../../index')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const normalized = entries.slice(0, MAX_REFRESH_LOGS).map(normalizeEntry)
  writeFileSync(logsPath, JSON.stringify(normalized, null, 2))
}

export function appendRefreshLog(entry: RefreshLogEntry): void {
  const current = loadRefreshLogs()
  const next = [entry, ...current].slice(0, MAX_REFRESH_LOGS)
  saveRefreshLogs(next)
}

export function clearRefreshLogs(): void {
  saveRefreshLogs([])
}
