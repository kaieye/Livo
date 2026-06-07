import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
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
} from '../../shared/types'
import { runMigrations } from './sqlite-schema'
import type { CleanupOptions, CleanupStats } from './cleanup'
import { DigestRepository } from './repositories/digest-repository'
import type { IDigestRepository } from './repositories/digest-repository'
import { EntryAISummarySessionRepository } from './repositories/ai-summary-session-repository'
import type { IEntryAISummarySessionRepository } from './repositories/ai-summary-session-repository'
import { EntryAITranslationSessionRepository } from './repositories/ai-translation-session-repository'
import type { IEntryAITranslationSessionRepository } from './repositories/ai-translation-session-repository'
import { EntryRepository } from './repositories/entry-repository'
import type { IEntryRepository } from './repositories/entry-repository'
import type {
  EntryListOptions,
  EntryListResult,
} from './repositories/entry-repository'
import { FeedRepository } from './repositories/feed-repository'
import type { IFeedRepository } from './repositories/feed-repository'
import { FeverRepository } from './repositories/fever-repository'
import type { IFeverRepository } from './repositories/fever-repository'
import { MaintenanceRepository } from './repositories/maintenance-repository'
import type { IMaintenanceRepository } from './repositories/maintenance-repository'
import { SyncChangesRepository } from './repositories/sync-changes-repository'
import type { ISyncChangesRepository } from './repositories/sync-changes-repository'

export type { CleanupOptions, CleanupStats }

export class SqliteAdapter {
  private readonly db: Database.Database
  readonly feeds: IFeedRepository
  readonly entries: IEntryRepository
  readonly aiSummarySessions: IEntryAISummarySessionRepository
  readonly aiTranslationSessions: IEntryAITranslationSessionRepository
  readonly digests: IDigestRepository
  readonly fever: IFeverRepository
  readonly maintenance: IMaintenanceRepository
  readonly syncChanges: ISyncChangesRepository

  constructor(dbPath: string) {
    const dir = join(dbPath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db = new BetterSqlite3(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('synchronous = NORMAL')
    runMigrations(this.db)

    this.feeds = new FeedRepository(this.db)
    this.entries = new EntryRepository(this.db)
    this.aiSummarySessions = new EntryAISummarySessionRepository(this.db)
    this.aiTranslationSessions = new EntryAITranslationSessionRepository(
      this.db,
    )
    this.digests = new DigestRepository(this.db)
    this.fever = new FeverRepository(this.db)
    this.maintenance = new MaintenanceRepository(this.db, this.feeds)
    this.syncChanges = new SyncChangesRepository(this.db)
  }

  getAllFeeds(): Feed[] {
    return this.feeds.getAllFeeds()
  }

  getFeedById(id: string): Feed | undefined {
    return this.feeds.getFeedById(id)
  }

  getFeedByUrl(url: string): Feed | undefined {
    return this.feeds.getFeedByUrl(url)
  }

  insertFeed(feed: Feed): void {
    this.feeds.insertFeed(feed)
  }

  updateFeed(id: string, updates: Partial<Feed>): void {
    this.feeds.updateFeed(id, updates)
  }

  deleteFeed(id: string): void {
    this.feeds.deleteFeed(id)
  }

  getEntryById(id: string): Entry | undefined {
    return this.entries.getEntryById(id)
  }

  insertEntry(entry: Entry): boolean {
    return this.entries.insertEntry(entry)
  }

  insertEntries(entries: Entry[]): number {
    return this.entries.insertEntries(entries)
  }

  insertEntriesWithResult(entries: Entry[]): {
    addedCount: number
    addedEntries: Entry[]
  } {
    return this.entries.insertEntriesWithResult(entries)
  }

  replaceEntriesForFeed(feedId: string, entries: Entry[]): number {
    return this.entries.replaceEntriesForFeed(feedId, entries)
  }

  replaceEntriesForFeedWithResult(
    feedId: string,
    entries: Entry[],
  ): { addedCount: number; addedEntries: Entry[] } {
    return this.entries.replaceEntriesForFeedWithResult(feedId, entries)
  }

  updateEntry(id: string, updates: Partial<Entry>): void {
    this.entries.updateEntry(id, updates)
  }

  markAllRead(feedId?: string): void {
    this.entries.markAllRead(feedId)
  }

  searchEntries(query: string, limit = 50): Entry[] {
    return this.entries.searchEntries(query, limit)
  }

  getEntries(options: EntryListOptions): EntryListResult {
    return this.entries.getEntries(options)
  }

  getOrphanEntries(): Entry[] {
    return this.entries.getOrphanEntries()
  }

  reassignEntriesToFeed(fromFeedId: string, toFeedId: string): number {
    return this.entries.reassignEntriesToFeed(fromFeedId, toFeedId)
  }

  getUnreadCount(feedId: string): number {
    return this.entries.getUnreadCount(feedId)
  }

  getUnreadCountMap(): Map<string, number> {
    return this.entries.getUnreadCountMap()
  }

  getDigestWindow(
    preset: AIDigestPreset,
    now?: number,
  ): { windowStartAt: number; windowEndAt: number } {
    return this.digests.getDigestWindow(preset, now)
  }

  listDigestCandidates(options: {
    preset: AIDigestPreset
    feedId?: string
    limit?: number
    now?: number
  }): AIDigestCandidate[] {
    return this.digests.listDigestCandidates(options)
  }

  listAIDigestRuns(limit = 20): AIDigestRun[] {
    return this.digests.listAIDigestRuns(limit)
  }

  upsertAIDigestRun(
    input: Omit<AIDigestRun, 'id' | 'createdAt' | 'updatedAt'>,
  ): AIDigestRun {
    return this.digests.upsertAIDigestRun(input)
  }

  updateAIDigestRun(
    id: string,
    updates: Partial<Omit<AIDigestRun, 'id' | 'createdAt'>>,
  ): AIDigestRun | null {
    return this.digests.updateAIDigestRun(id, updates)
  }

  cleanupEntries(options: CleanupOptions): CleanupStats {
    return this.maintenance.cleanupEntries(options)
  }

  getDatabaseStats(): {
    totalFeeds: number
    totalEntries: number
    readEntries: number
    starredEntries: number
    dataSizeBytes: number
  } {
    return this.maintenance.getDatabaseStats()
  }

  getFeverAccounts(): FeverAccount[] {
    return this.fever.getFeverAccounts()
  }

  getFeverAccountById(id: string): FeverAccount | undefined {
    return this.fever.getFeverAccountById(id)
  }

  insertFeverAccount(account: FeverAccount): void {
    this.fever.insertFeverAccount(account)
  }

  updateFeverAccount(id: string, updates: Partial<FeverAccount>): void {
    this.fever.updateFeverAccount(id, updates)
  }

  deleteFeverAccount(id: string): void {
    this.fever.deleteFeverAccount(id)
  }

  getFeverFeedMappings(accountId: string): FeverFeedMapping[] {
    return this.fever.getFeverFeedMappings(accountId)
  }

  getFeverFeedMappingByRemoteId(
    accountId: string,
    feverFeedId: number,
  ): FeverFeedMapping | undefined {
    return this.fever.getFeverFeedMappingByRemoteId(accountId, feverFeedId)
  }

  upsertFeverFeedMapping(mapping: FeverFeedMapping): void {
    this.fever.upsertFeverFeedMapping(mapping)
  }

  deleteFeverFeedMappings(accountId: string): void {
    this.fever.deleteFeverFeedMappings(accountId)
  }

  markFeverFeedMappingsInactive(
    accountId: string,
    activeRemoteIds: number[],
  ): void {
    this.fever.markFeverFeedMappingsInactive(accountId, activeRemoteIds)
  }

  getFeverItemMapping(
    accountId: string,
    feverItemId: number,
  ): FeverItemMapping | undefined {
    return this.fever.getFeverItemMapping(accountId, feverItemId)
  }

  upsertFeverItemMapping(mapping: FeverItemMapping): void {
    this.fever.upsertFeverItemMapping(mapping)
  }

  getFeverItemMappingsByLocalEntry(localEntryId: string): FeverItemMapping[] {
    return this.fever.getFeverItemMappingsByLocalEntry(localEntryId)
  }

  markFeverItemMappingsInactive(accountId: string, feverFeedId: number): void {
    this.fever.markFeverItemMappingsInactive(accountId, feverFeedId)
  }

  getFeverSyncState(accountId: string): FeverSyncState | undefined {
    return this.fever.getFeverSyncState(accountId)
  }

  upsertFeverSyncState(state: FeverSyncState): void {
    this.fever.upsertFeverSyncState(state)
  }

  close(): void {
    this.db.close()
  }
}
