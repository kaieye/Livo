/**
 * SQLite-backed database for Livo.
 * Migrates from legacy JSON on first launch, then uses SQLite exclusively.
 */
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, renameSync } from 'fs'
import type {
  AIDigestCandidate,
  AIDigestPreset,
  AIDigestRun,
  Entry,
  Feed,
  FeverAccount,
  FeverFeedMapping,
  FeverItemMapping,
  FeverSyncState,
} from '../shared/types'
import { FeedViewType } from '../shared/types'
import type { CleanupOptions, CleanupStats } from './database/cleanup'
import { SqliteAdapter } from './database/sqlite-adapter'

export type { CleanupOptions, CleanupStats }

let adapter: SqliteAdapter

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

// ---- Feed operations ----

export function getAllFeeds(): Feed[] {
  return adapter.getAllFeeds()
}

export function getFeedById(id: string): Feed | undefined {
  return adapter.getFeedById(id)
}

export function getFeedByUrl(url: string): Feed | undefined {
  return adapter.getFeedByUrl(url)
}

export function insertFeed(feed: Feed): void {
  adapter.insertFeed(feed)
}

export function updateFeed(id: string, updates: Partial<Feed>): void {
  adapter.updateFeed(id, updates)
}

export function deleteFeed(id: string): void {
  adapter.deleteFeed(id)
}

// ---- Entry operations ----

export interface EntryListResult {
  entries: Entry[]
  hasMore: boolean
}

export function getEntries(options: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
  compact?: boolean
  maxContentLength?: number
  skipDedupe?: boolean
}): EntryListResult {
  return adapter.getEntries(options)
}

export function getOrphanEntries(): Entry[] {
  return adapter.getOrphanEntries()
}

export function reassignEntriesToFeed(
  fromFeedId: string,
  toFeedId: string,
): number {
  return adapter.reassignEntriesToFeed(fromFeedId, toFeedId)
}

export function getEntryById(id: string): Entry | undefined {
  return adapter.getEntryById(id)
}

export function insertEntry(entry: Entry): boolean {
  return adapter.insertEntry(entry)
}

export interface EntryWriteResult {
  addedCount: number
  addedEntries: Entry[]
}

export function insertEntriesWithResult(entries: Entry[]): EntryWriteResult {
  return adapter.insertEntriesWithResult(entries)
}

export function insertEntries(entries: Entry[]): number {
  return adapter.insertEntries(entries)
}

export function replaceEntriesForFeedWithResult(
  feedId: string,
  entries: Entry[],
): EntryWriteResult {
  return adapter.replaceEntriesForFeedWithResult(feedId, entries)
}

export function replaceEntriesForFeed(
  feedId: string,
  entries: Entry[],
): number {
  return adapter.replaceEntriesForFeed(feedId, entries)
}

export function updateEntry(id: string, updates: Partial<Entry>): void {
  adapter.updateEntry(id, updates)
}

export function markAllRead(feedId?: string): void {
  adapter.markAllRead(feedId)
}

export function searchEntries(query: string, limit?: number): Entry[] {
  return adapter.searchEntries(query, limit)
}

export function getDigestWindow(
  preset: AIDigestPreset,
  now?: number,
): { windowStartAt: number; windowEndAt: number } {
  return adapter.getDigestWindow(preset, now)
}

export function listDigestCandidates(options: {
  preset: AIDigestPreset
  feedId?: string
  limit?: number
  now?: number
}): AIDigestCandidate[] {
  return adapter.listDigestCandidates(options)
}

export function listAIDigestRuns(limit?: number): AIDigestRun[] {
  return adapter.listAIDigestRuns(limit)
}

export function upsertAIDigestRun(
  input: Omit<AIDigestRun, 'id' | 'createdAt' | 'updatedAt'>,
): AIDigestRun {
  return adapter.upsertAIDigestRun(input)
}

export function updateAIDigestRun(
  id: string,
  updates: Partial<Omit<AIDigestRun, 'id' | 'createdAt'>>,
): AIDigestRun | null {
  return adapter.updateAIDigestRun(id, updates)
}

export function getUnreadCount(feedId: string): number {
  return adapter.getUnreadCount(feedId)
}

export function getUnreadCountMap(): Map<string, number> {
  return adapter.getUnreadCountMap()
}

// ---- Data maintenance / cleanup ----

export function cleanupEntries(options: CleanupOptions): CleanupStats {
  return adapter.cleanupEntries(options)
}

export function getDatabaseStats(): {
  totalFeeds: number
  totalEntries: number
  readEntries: number
  starredEntries: number
  dataSizeBytes: number
} {
  return adapter.getDatabaseStats()
}

export function getDatabase(): { close: () => void } {
  return {
    close: () => {
      adapter.close()
    },
  }
}

export function forceSave(): void {
  // SQLite writes are immediate — no-op for backward compat.
}

// ---- Fever account operations ----

export function getFeverAccounts(): FeverAccount[] {
  return adapter.getFeverAccounts()
}

export function getFeverAccountById(id: string): FeverAccount | undefined {
  return adapter.getFeverAccountById(id)
}

export function insertFeverAccount(account: FeverAccount): void {
  adapter.insertFeverAccount(account)
}

export function updateFeverAccount(
  id: string,
  updates: Partial<FeverAccount>,
): void {
  adapter.updateFeverAccount(id, updates)
}

export function deleteFeverAccount(id: string): void {
  adapter.deleteFeverAccount(id)
}

// ---- Fever feed mapping operations ----

export function getFeverFeedMappings(accountId: string): FeverFeedMapping[] {
  return adapter.getFeverFeedMappings(accountId)
}

export function getFeverFeedMappingByRemoteId(
  accountId: string,
  feverFeedId: number,
): FeverFeedMapping | undefined {
  return adapter.getFeverFeedMappingByRemoteId(accountId, feverFeedId)
}

export function upsertFeverFeedMapping(mapping: FeverFeedMapping): void {
  adapter.upsertFeverFeedMapping(mapping)
}

export function deleteFeverFeedMappings(accountId: string): void {
  adapter.deleteFeverFeedMappings(accountId)
}

export function markFeverFeedMappingsInactive(
  accountId: string,
  activeRemoteIds: number[],
): void {
  adapter.markFeverFeedMappingsInactive(accountId, activeRemoteIds)
}

// ---- Fever item mapping operations ----

export function getFeverItemMapping(
  accountId: string,
  feverItemId: number,
): FeverItemMapping | undefined {
  return adapter.getFeverItemMapping(accountId, feverItemId)
}

export function upsertFeverItemMapping(mapping: FeverItemMapping): void {
  adapter.upsertFeverItemMapping(mapping)
}

export function getFeverItemMappingsByLocalEntry(
  localEntryId: string,
): FeverItemMapping[] {
  return adapter.getFeverItemMappingsByLocalEntry(localEntryId)
}

export function markFeverItemMappingsInactive(
  accountId: string,
  feverFeedId: number,
): void {
  adapter.markFeverItemMappingsInactive(accountId, feverFeedId)
}

// ---- Fever sync state operations ----

export function getFeverSyncState(
  accountId: string,
): FeverSyncState | undefined {
  return adapter.getFeverSyncState(accountId)
}

export function upsertFeverSyncState(state: FeverSyncState): void {
  adapter.upsertFeverSyncState(state)
}
