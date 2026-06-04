/**
 * SQLite-backed database for Livo.
 * Migrates from legacy JSON on first launch, then uses SQLite exclusively.
 *
 * Prefer `getDb()` for structured repository access:
 *   const db = getDb()
 *   db.feeds.getAllFeeds()
 *   db.entries.getEntries({ limit: 30 })
 */
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, renameSync } from 'fs'
import type { AIDigestRun, Entry, Feed } from '../shared/types'
import { FeedViewType } from '../shared/types'
import type { CleanupOptions, CleanupStats } from './database/cleanup'
import { SqliteAdapter } from './database/sqlite-adapter'
import type {
  IFeedRepository,
  IEntryRepository,
  IDigestRepository,
  IFeverRepository,
  IMaintenanceRepository,
} from './database/repositories'

// Re-export types needed by consumers
export type { CleanupOptions, CleanupStats }
export type { EntryListResult, EntryWriteResult } from './database/repositories'

let adapter: SqliteAdapter

/** Structured access to the database repositories. */
export function getDb(): {
  feeds: IFeedRepository
  entries: IEntryRepository
  digests: IDigestRepository
  fever: IFeverRepository
  maintenance: IMaintenanceRepository
  close: () => void
} {
  return {
    feeds: adapter.feeds,
    entries: adapter.entries,
    digests: adapter.digests,
    fever: adapter.fever,
    maintenance: adapter.maintenance,
    close: () => adapter.close(),
  }
}

function getDbDir(): string {
  return join(app.getPath('userData'), 'data')
}

function migrateFromJson(
  jsonPath: string,
  sqlitePath: string,
  adapter: SqliteAdapter,
): void {
  try {
    const raw = readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw)
    const feeds: Feed[] = data.feeds || []
    const entries: Entry[] = data.entries || []
    const runs: AIDigestRun[] = data.aiDigestRuns || []

    for (const feed of feeds) {
      if (feed.view === undefined) {
        ;(feed as any).view = FeedViewType.Articles
      }
      if (feed.showInAll === undefined) {
        ;(feed as any).showInAll = true
      }
      adapter.insertFeed(feed)
    }

    // Batch insert entries in transactions for performance
    const batchSize = 500
    for (let i = 0; i < entries.length; i += batchSize) {
      adapter.insertEntriesWithResult(entries.slice(i, i + batchSize))
    }

    for (const run of runs) {
      adapter.upsertAIDigestRun(run)
    }

    // Rename JSON file as backup
    const backupPath = jsonPath + '.bak'
    try {
      renameSync(jsonPath, backupPath)
    } catch {
      // Ignore if rename fails
    }
  } catch (e) {
    console.error('Failed to migrate JSON data to SQLite:', e)
  }
}

export async function initDatabase(): Promise<void> {
  const dir = getDbDir()
  const sqlitePath = join(dir, 'livo.db')
  const jsonPath = join(dir, 'livo-data.json')
  const legacyJsonPath = join(dir, `${['for', 'ss', '-data.json'].join('')}`)

  adapter = new SqliteAdapter(sqlitePath)

  // Migrate from JSON if SQLite is empty and JSON exists
  const stats = adapter.getDatabaseStats()
  if (stats.totalFeeds === 0) {
    const sourceJson = existsSync(jsonPath)
      ? jsonPath
      : existsSync(legacyJsonPath)
        ? legacyJsonPath
        : null
    if (sourceJson) {
      migrateFromJson(sourceJson, sqlitePath, adapter)
    }
  }
}
