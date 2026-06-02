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
  MediaItem,
} from '../../shared/types'
import { FeedViewType } from '../../shared/types'
import { runMigrations } from './sqlite-schema'
import {
  cleanupDatabaseEntries,
  type CleanupOptions,
  type CleanupStats,
} from './cleanup'
import {
  dedupeEntriesForRead,
  isBrokenScraperEntry,
  mergeEntryData,
  mergeTextFromEntry,
} from './entry-dedupe'
import {
  makeEntryIdentityKey,
  normalizeIdentityText,
  titlesLikelySameForRead,
} from './entry-identity'

export type { CleanupOptions, CleanupStats }

// ---- Row ↔ Domain mappers ----

function feedFromRow(row: any): Feed {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    siteUrl: row.site_url || undefined,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
    folder: row.folder || undefined,
    category: row.category || undefined,
    view: row.view as FeedViewType,
    maxEntries: row.max_entries ?? undefined,
    showInAll: row.show_in_all === 1,
    lastFetched: row.last_fetched ?? undefined,
    etag: row.etag || undefined,
    lastModified: row.last_modified || undefined,
    fetchSource: row.fetch_source || undefined,
    upstreamUrl: row.upstream_url || undefined,
    remoteFeedId: row.remote_feed_id || undefined,
    provider: row.provider || 'local',
    errorCount: row.error_count,
    createdAt: row.created_at,
  }
}

function entryFromRow(row: any): Entry {
  let media: MediaItem[] | undefined
  if (row.media) {
    try {
      media = JSON.parse(row.media)
    } catch {
      media = undefined
    }
  }
  return {
    id: row.id,
    feedId: row.feed_id,
    title: row.title,
    url: row.url,
    content: row.content || undefined,
    summary: row.summary || undefined,
    readabilityContent: row.readability_content || undefined,
    readabilityTitle: row.readability_title || undefined,
    readabilityExcerpt: row.readability_excerpt || undefined,
    readabilitySiteName: row.readability_site_name || undefined,
    readabilityLength: row.readability_length ?? undefined,
    readabilityFetchedAt: row.readability_fetched_at ?? undefined,
    readabilityError: row.readability_error || undefined,
    aiSummary: row.ai_summary || undefined,
    aiSummaryGeneratedAt: row.ai_summary_generated_at ?? undefined,
    aiSummaryError: row.ai_summary_error || undefined,
    notifiedAt: row.notified_at ?? undefined,
    author: row.author || undefined,
    authorAvatar: row.author_avatar || undefined,
    imageUrl: row.image_url || undefined,
    media,
    publishedAt: row.published_at,
    isRead: row.is_read === 1,
    isStarred: row.is_starred === 1,
    readProgress: row.read_progress ?? undefined,
    isListened: row.is_listened === 1,
    listenProgress: row.listen_progress ?? undefined,
    createdAt: row.created_at,
  }
}

function digestRunFromRow(row: any): AIDigestRun {
  let sourceEntryIds: string[] = []
  if (row.source_entry_ids) {
    try {
      sourceEntryIds = JSON.parse(row.source_entry_ids)
    } catch {
      sourceEntryIds = []
    }
  }
  return {
    id: row.id,
    preset: row.preset as AIDigestPreset,
    feedId: row.feed_id || undefined,
    title: row.title,
    status: row.status,
    windowStartAt: row.window_start_at,
    windowEndAt: row.window_end_at,
    sourceEntryIds,
    candidateCount: row.candidate_count,
    content: row.content || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function feverAccountFromRow(row: any): FeverAccount {
  return {
    id: row.id,
    baseUrl: row.base_url,
    username: row.username,
    apiKey: row.api_key,
    enabled: row.enabled === 1,
    autoSync: row.auto_sync === 1,
    syncIntervalMin: row.sync_interval_min,
    lastSyncAt: row.last_sync_at ?? undefined,
    lastError: row.last_error || undefined,
    createdAt: row.created_at,
  }
}

function feverFeedMappingFromRow(row: any): FeverFeedMapping {
  return {
    accountId: row.account_id,
    feverFeedId: row.fever_feed_id,
    localFeedId: row.local_feed_id,
    remoteGroup: row.remote_group || undefined,
    remoteTitle: row.remote_title || undefined,
    remoteUrl: row.remote_url || undefined,
    isActive: row.is_active === 1,
    lastSeenAt: row.last_seen_at,
  }
}

function feverItemMappingFromRow(row: any): FeverItemMapping {
  return {
    accountId: row.account_id,
    feverItemId: row.fever_item_id,
    feverFeedId: row.fever_feed_id,
    localFeedId: row.local_feed_id,
    localEntryId: row.local_entry_id,
    remoteIsRead: row.remote_is_read === 1,
    remoteIsStarred: row.remote_is_starred === 1,
    isActive: row.is_active === 1,
    lastSeenAt: row.last_seen_at,
  }
}

function feverSyncStateFromRow(row: any): FeverSyncState {
  return {
    accountId: row.account_id,
    lastItemId: row.last_item_id,
    lastSyncAt: row.last_sync_at ?? undefined,
    lastFullSyncAt: row.last_full_sync_at ?? undefined,
    lastError: row.last_error || undefined,
  }
}

// ---- SQLite Adapter ----

export class SqliteAdapter {
  private db: Database.Database

  constructor(dbPath: string) {
    const dir = join(dbPath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db = new BetterSqlite3(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('synchronous = NORMAL')
    runMigrations(this.db)
  }

  // ---- Feed operations ----

  getAllFeeds(): Feed[] {
    return this.db
      .prepare('SELECT * FROM feeds ORDER BY created_at')
      .all()
      .map(feedFromRow)
  }

  getFeedById(id: string): Feed | undefined {
    const row = this.db.prepare('SELECT * FROM feeds WHERE id = ?').get(id)
    return row ? feedFromRow(row) : undefined
  }

  getFeedByUrl(url: string): Feed | undefined {
    const row = this.db.prepare('SELECT * FROM feeds WHERE url = ?').get(url)
    return row ? feedFromRow(row) : undefined
  }

  insertFeed(feed: Feed): void {
    const f = { ...feed, showInAll: feed.showInAll ?? true }
    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO feeds
        (id, title, url, site_url, description, image_url, folder, category,
         view, max_entries, show_in_all, last_fetched, etag, last_modified,
         fetch_source, upstream_url, remote_feed_id, provider, error_count, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        f.id,
        f.title,
        f.url,
        f.siteUrl ?? null,
        f.description ?? null,
        f.imageUrl ?? null,
        f.folder ?? null,
        f.category ?? null,
        f.view,
        f.maxEntries ?? null,
        f.showInAll ? 1 : 0,
        f.lastFetched ?? null,
        f.etag ?? null,
        f.lastModified ?? null,
        f.fetchSource ?? null,
        f.upstreamUrl ?? null,
        f.remoteFeedId ?? null,
        f.provider ?? 'local',
        f.errorCount,
        f.createdAt,
      )
  }

  updateFeed(id: string, updates: Partial<Feed>): void {
    const existing = this.getFeedById(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    this.db
      .prepare(
        `
      UPDATE feeds SET
        title = ?, url = ?, site_url = ?, description = ?, image_url = ?,
        folder = ?, category = ?, view = ?, max_entries = ?, show_in_all = ?,
        last_fetched = ?, etag = ?, last_modified = ?, fetch_source = ?,
        upstream_url = ?, remote_feed_id = ?, provider = ?, error_count = ?
      WHERE id = ?
    `,
      )
      .run(
        merged.title,
        merged.url,
        merged.siteUrl ?? null,
        merged.description ?? null,
        merged.imageUrl ?? null,
        merged.folder ?? null,
        merged.category ?? null,
        merged.view,
        merged.maxEntries ?? null,
        merged.showInAll ? 1 : 0,
        merged.lastFetched ?? null,
        merged.etag ?? null,
        merged.lastModified ?? null,
        merged.fetchSource ?? null,
        merged.upstreamUrl ?? null,
        merged.remoteFeedId ?? null,
        merged.provider ?? 'local',
        merged.errorCount,
        id,
      )
  }

  deleteFeed(id: string): void {
    this.db.prepare('DELETE FROM feeds WHERE id = ?').run(id)
  }

  // ---- Entry operations ----

  getEntryById(id: string): Entry | undefined {
    const row = this.db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    return row ? entryFromRow(row) : undefined
  }

  insertEntry(entry: Entry): boolean {
    return this.upsertEntry(entry).added
  }

  insertEntries(entries: Entry[]): number {
    return this.insertEntriesWithResult(entries).addedCount
  }

  insertEntriesWithResult(entries: Entry[]): {
    addedCount: number
    addedEntries: Entry[]
  } {
    const insertMany = this.db.transaction((items: Entry[]) => {
      let added = 0
      const addedEntries: Entry[] = []
      for (const entry of items) {
        const result = this.upsertEntry(entry)
        if (result.added) {
          added++
          addedEntries.push(entry)
        }
      }
      return { addedCount: added, addedEntries }
    })
    return insertMany(entries)
  }

  replaceEntriesForFeed(feedId: string, entries: Entry[]): number {
    return this.replaceEntriesForFeedWithResult(feedId, entries).addedCount
  }

  replaceEntriesForFeedWithResult(
    feedId: string,
    entries: Entry[],
  ): { addedCount: number; addedEntries: Entry[] } {
    const txn = this.db.transaction(() => {
      const existingRows = this.db
        .prepare('SELECT * FROM entries WHERE feed_id = ?')
        .all(feedId) as any[]

      const stateByKey = new Map<
        string,
        {
          isRead: boolean
          isStarred: boolean
          readProgress?: number
          isListened: boolean
          listenProgress?: number
        }
      >()
      const makeKeepKey = (entry: {
        title: string
        publishedAt: number
      }): string => {
        const title = normalizeIdentityText(entry.title).slice(0, 140)
        const bucket = Math.floor((entry.publishedAt || 0) / (60 * 60 * 1000))
        return `${title}|${bucket}`
      }

      for (const row of existingRows) {
        const entry = entryFromRow(row)
        const key = makeKeepKey(entry)
        const existing = stateByKey.get(key)
        if (!existing) {
          stateByKey.set(key, {
            isRead: !!entry.isRead,
            isStarred: !!entry.isStarred,
            readProgress: entry.readProgress,
            isListened: !!entry.isListened,
            listenProgress: entry.listenProgress,
          })
          continue
        }
        existing.isRead = existing.isRead || !!entry.isRead
        existing.isStarred = existing.isStarred || !!entry.isStarred
        if (
          entry.readProgress !== undefined &&
          (existing.readProgress === undefined ||
            entry.readProgress > existing.readProgress)
        ) {
          existing.readProgress = entry.readProgress
        }
        existing.isListened = existing.isListened || !!entry.isListened
        if (
          entry.listenProgress !== undefined &&
          (existing.listenProgress === undefined ||
            entry.listenProgress > existing.listenProgress)
        ) {
          existing.listenProgress = entry.listenProgress
        }
      }

      this.db.prepare('DELETE FROM entries WHERE feed_id = ?').run(feedId)

      let added = 0
      const addedEntries: Entry[] = []
      for (const entry of entries) {
        const keep = stateByKey.get(makeKeepKey(entry))
        const incoming: Entry = keep
          ? {
              ...entry,
              isRead: entry.isRead || keep.isRead,
              isStarred: entry.isStarred || keep.isStarred,
              readProgress: keep.readProgress,
              isListened: entry.isListened || keep.isListened,
              listenProgress: keep.listenProgress,
            }
          : entry
        const result = this.upsertEntry(incoming)
        if (!keep && result.added) {
          added += 1
          addedEntries.push(incoming)
        }
      }
      return { addedCount: added, addedEntries }
    })
    return txn()
  }

  updateEntry(id: string, updates: Partial<Entry>): void {
    const existing = this.getEntryById(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    this.db
      .prepare(
        `
      UPDATE entries SET
        feed_id = ?, title = ?, url = ?, content = ?, summary = ?,
        readability_content = ?, readability_title = ?, readability_excerpt = ?,
        readability_site_name = ?, readability_length = ?,
        readability_fetched_at = ?, readability_error = ?,
        ai_summary = ?, ai_summary_generated_at = ?, ai_summary_error = ?,
        notified_at = ?, author = ?, author_avatar = ?, image_url = ?,
        media = ?, published_at = ?, is_read = ?, is_starred = ?,
        read_progress = ?, is_listened = ?, listen_progress = ?
      WHERE id = ?
    `,
      )
      .run(
        merged.feedId,
        merged.title,
        merged.url,
        merged.content ?? null,
        merged.summary ?? null,
        merged.readabilityContent ?? null,
        merged.readabilityTitle ?? null,
        merged.readabilityExcerpt ?? null,
        merged.readabilitySiteName ?? null,
        merged.readabilityLength ?? null,
        merged.readabilityFetchedAt ?? null,
        merged.readabilityError ?? null,
        merged.aiSummary ?? null,
        merged.aiSummaryGeneratedAt ?? null,
        merged.aiSummaryError ?? null,
        merged.notifiedAt ?? null,
        merged.author ?? null,
        merged.authorAvatar ?? null,
        merged.imageUrl ?? null,
        merged.media ? JSON.stringify(merged.media) : null,
        merged.publishedAt,
        merged.isRead ? 1 : 0,
        merged.isStarred ? 1 : 0,
        merged.readProgress ?? null,
        merged.isListened ? 1 : 0,
        merged.listenProgress ?? null,
        id,
      )
  }

  markAllRead(feedId?: string): void {
    if (feedId) {
      this.db
        .prepare(
          'UPDATE entries SET is_read = 1 WHERE feed_id = ? AND is_read = 0',
        )
        .run(feedId)
    } else {
      this.db.prepare('UPDATE entries SET is_read = 1 WHERE is_read = 0').run()
    }
  }

  searchEntries(query: string, limit = 50): Entry[] {
    const q = `%${query}%`
    const rows = this.db
      .prepare(
        `
      SELECT e.* FROM entries e
      INNER JOIN feeds f ON f.id = e.feed_id
      WHERE (e.title LIKE ? OR e.content LIKE ? OR e.summary LIKE ?)
      ORDER BY e.published_at DESC
      LIMIT ?
    `,
      )
      .all(q, q, q, limit) as any[]
    return rows.map(entryFromRow)
  }

  getEntries(options: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
    limit?: number
    offset?: number
    compact?: boolean
    maxContentLength?: number
    skipDedupe?: boolean
  }): { entries: Entry[]; hasMore: boolean } {
    const offset = options.offset || 0
    const limit = options.limit || 1000

    let sql = 'SELECT e.* FROM entries e INNER JOIN feeds f ON f.id = e.feed_id'
    const conditions: string[] = []
    const params: any[] = []

    if (options.feedId) {
      conditions.push('e.feed_id = ?')
      params.push(options.feedId)
    } else if (options.feedIds && options.feedIds.length > 0) {
      const placeholders = options.feedIds.map(() => '?').join(',')
      conditions.push(`e.feed_id IN (${placeholders})`)
      params.push(...options.feedIds)
    }

    if (options.starred) {
      conditions.push('e.is_starred = 1')
    }
    if (options.unreadOnly) {
      conditions.push('e.is_read = 0')
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY e.published_at DESC, e.id DESC'

    // Fetch one extra to determine hasMore
    sql += ' LIMIT ? OFFSET ?'
    params.push(limit + 1, offset)

    const rows = this.db.prepare(sql).all(...params) as any[]
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    let entries = pageRows.map(entryFromRow)

    if (!options.skipDedupe) {
      entries = dedupeEntriesForRead(entries, () => {})
      entries.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    }

    if (!options.compact) return { entries, hasMore }

    const maxContentLength = Math.max(
      160,
      Math.min(options.maxContentLength ?? 1600, 10000),
    )
    const maxSummaryLength = Math.max(
      120,
      Math.min(Math.floor(maxContentLength / 2), 2400),
    )

    const trimCompactContent = (
      value: string | undefined,
      maxLen: number,
    ): string => {
      const raw = value || ''
      if (!raw) return ''
      let next = raw
        .replace(
          /&lt;\s*(img|video|iframe|audio|picture|source)\b[\s\S]*?(?:&gt;|$)/gi,
          ' ',
        )
        .replace(
          /<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi,
          ' ',
        )
      if (next.length <= maxLen) return next

      let sliced = next.slice(0, maxLen)
      const lastLt = sliced.lastIndexOf('<')
      const lastGt = sliced.lastIndexOf('>')
      if (lastLt > lastGt) {
        const nextGt = next.indexOf('>', maxLen)
        if (nextGt !== -1 && nextGt - maxLen <= 240) {
          sliced = next.slice(0, nextGt + 1)
        } else {
          sliced = sliced.slice(0, lastLt)
        }
      }
      return sliced
    }

    return {
      entries: entries.map((entry) => ({
        ...entry,
        content: trimCompactContent(entry.content, maxContentLength),
        summary: trimCompactContent(entry.summary, maxSummaryLength),
        media: entry.media || [],
      })),
      hasMore,
    }
  }

  getOrphanEntries(): Entry[] {
    const rows = this.db
      .prepare(
        `
      SELECT e.* FROM entries e
      LEFT JOIN feeds f ON f.id = e.feed_id
      WHERE f.id IS NULL
    `,
      )
      .all() as any[]
    return rows.map(entryFromRow)
  }

  reassignEntriesToFeed(fromFeedId: string, toFeedId: string): number {
    if (!fromFeedId || !toFeedId || fromFeedId === toFeedId) return 0
    const result = this.db
      .prepare('UPDATE entries SET feed_id = ? WHERE feed_id = ?')
      .run(toFeedId, fromFeedId)
    return result.changes
  }

  getUnreadCount(feedId: string): number {
    const row = this.db
      .prepare(
        'SELECT COUNT(*) as count FROM entries WHERE feed_id = ? AND is_read = 0',
      )
      .get(feedId) as any
    return row?.count ?? 0
  }

  getUnreadCountMap(): Map<string, number> {
    const rows = this.db
      .prepare(
        `
      SELECT feed_id, COUNT(*) as count
      FROM entries
      WHERE is_read = 0
      GROUP BY feed_id
    `,
      )
      .all() as any[]
    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.feed_id, row.count)
    }
    return map
  }

  // ---- Digest operations ----

  getDigestWindow(
    preset: AIDigestPreset,
    now = Date.now(),
  ): { windowStartAt: number; windowEndAt: number } {
    const date = new Date(now)
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    if (preset === 'week') {
      const day = start.getDay()
      const diffToMonday = (day + 6) % 7
      start.setDate(start.getDate() - diffToMonday)
    }
    return { windowStartAt: start.getTime(), windowEndAt: now }
  }

  listDigestCandidates(options: {
    preset: AIDigestPreset
    feedId?: string
    limit?: number
    now?: number
  }): AIDigestCandidate[] {
    const { windowStartAt, windowEndAt } = this.getDigestWindow(
      options.preset,
      options.now,
    )
    const limit = Math.max(1, Math.min(options.limit ?? 80, 200))

    let sql = `
      SELECT e.id, e.title, e.summary, e.content, e.readability_content,
             e.ai_summary, e.url, e.published_at, f.title as feed_title
      FROM entries e
      INNER JOIN feeds f ON f.id = e.feed_id
      WHERE e.published_at >= ? AND e.published_at <= ?
        AND f.show_in_all = 1
    `
    const params: any[] = [windowStartAt, windowEndAt]

    if (options.feedId) {
      sql += ' AND e.feed_id = ?'
      params.push(options.feedId)
    }

    sql += ' ORDER BY e.published_at DESC LIMIT ?'
    params.push(limit)

    const rows = this.db.prepare(sql).all(...params) as any[]

    const stripText = (value: string | undefined): string =>
      (value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const candidates: AIDigestCandidate[] = []
    for (const row of rows) {
      const content = stripText(
        row.readability_content || row.content || row.summary,
      )
      const summary = stripText(row.ai_summary || row.summary)
      if (!row.title && !content && !summary) continue
      candidates.push({
        id: row.id,
        title: row.title || summary.slice(0, 80) || content.slice(0, 80),
        summary,
        content,
        feedTitle: row.feed_title,
        url: row.url,
        publishedAt: row.published_at,
      })
    }
    return candidates
  }

  listAIDigestRuns(limit = 20): AIDigestRun[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM ai_digest_runs
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ?
    `,
      )
      .all(Math.max(1, Math.min(limit, 100))) as any[]
    return rows.map(digestRunFromRow)
  }

  upsertAIDigestRun(
    input: Omit<AIDigestRun, 'id' | 'createdAt' | 'updatedAt'>,
  ): AIDigestRun {
    const now = Date.now()
    const existing = this.db
      .prepare(
        `
      SELECT * FROM ai_digest_runs
      WHERE preset = ? AND feed_id IS ? AND window_start_at = ?
    `,
      )
      .get(input.preset, input.feedId ?? null, input.windowStartAt) as any

    if (existing) {
      this.db
        .prepare(
          `
        UPDATE ai_digest_runs SET
          title = ?, status = ?, window_end_at = ?,
          source_entry_ids = ?, candidate_count = ?,
          content = ?, error = ?, updated_at = ?
        WHERE id = ?
      `,
        )
        .run(
          input.title,
          input.status,
          input.windowEndAt,
          JSON.stringify(input.sourceEntryIds),
          input.candidateCount,
          input.content ?? null,
          input.error ?? null,
          now,
          existing.id,
        )
      return digestRunFromRow(
        this.db
          .prepare('SELECT * FROM ai_digest_runs WHERE id = ?')
          .get(existing.id),
      )
    }

    const id = `digest-${now}-${Math.random().toString(36).slice(2, 8)}`
    this.db
      .prepare(
        `
      INSERT INTO ai_digest_runs
        (id, preset, feed_id, title, status, window_start_at, window_end_at,
         source_entry_ids, candidate_count, content, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        input.preset,
        input.feedId ?? null,
        input.title,
        input.status,
        input.windowStartAt,
        input.windowEndAt,
        JSON.stringify(input.sourceEntryIds),
        input.candidateCount,
        input.content ?? null,
        input.error ?? null,
        now,
        now,
      )
    return digestRunFromRow(
      this.db.prepare('SELECT * FROM ai_digest_runs WHERE id = ?').get(id),
    )
  }

  updateAIDigestRun(
    id: string,
    updates: Partial<Omit<AIDigestRun, 'id' | 'createdAt'>>,
  ): AIDigestRun | null {
    const existing = this.db
      .prepare('SELECT * FROM ai_digest_runs WHERE id = ?')
      .get(id) as any
    if (!existing) return null

    const merged = {
      ...digestRunFromRow(existing),
      ...updates,
      updatedAt: Date.now(),
    }
    this.db
      .prepare(
        `
      UPDATE ai_digest_runs SET
        preset = ?, feed_id = ?, title = ?, status = ?,
        window_start_at = ?, window_end_at = ?,
        source_entry_ids = ?, candidate_count = ?,
        content = ?, error = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(
        merged.preset,
        merged.feedId ?? null,
        merged.title,
        merged.status,
        merged.windowStartAt,
        merged.windowEndAt,
        JSON.stringify(merged.sourceEntryIds),
        merged.candidateCount,
        merged.content ?? null,
        merged.error ?? null,
        merged.updatedAt,
        id,
      )
    return digestRunFromRow(
      this.db.prepare('SELECT * FROM ai_digest_runs WHERE id = ?').get(id),
    )
  }

  // ---- Cleanup ----

  cleanupEntries(options: CleanupOptions): CleanupStats {
    const feeds = this.getAllFeeds()
    const allEntries = this.db
      .prepare('SELECT * FROM entries')
      .all()
      .map(entryFromRow)
    const result = cleanupDatabaseEntries(feeds, allEntries, options)
    if (result.stats.removed > 0) {
      const ids = result.entries.map((e) => e.id)
      if (ids.length === 0) {
        this.db.prepare('DELETE FROM entries').run()
      } else {
        const batchSize = 500
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize)
          const placeholders = batch.map(() => '?').join(',')
          this.db
            .prepare(`DELETE FROM entries WHERE id NOT IN (${placeholders})`)
            .run(...batch)
        }
      }
    }
    return result.stats
  }

  // ---- Stats ----

  getDatabaseStats(): {
    totalFeeds: number
    totalEntries: number
    readEntries: number
    starredEntries: number
    dataSizeBytes: number
  } {
    const feedCount = (
      this.db.prepare('SELECT COUNT(*) as c FROM feeds').get() as any
    ).c
    const entryCount = (
      this.db.prepare('SELECT COUNT(*) as c FROM entries').get() as any
    ).c
    const readCount = (
      this.db
        .prepare('SELECT COUNT(*) as c FROM entries WHERE is_read = 1')
        .get() as any
    ).c
    const starredCount = (
      this.db
        .prepare('SELECT COUNT(*) as c FROM entries WHERE is_starred = 1')
        .get() as any
    ).c

    let dataSizeBytes = 0
    try {
      const pageCount =
        (this.db.pragma('page_count', { simple: true }) as number) || 0
      const pageSize =
        (this.db.pragma('page_size', { simple: true }) as number) || 4096
      dataSizeBytes = pageCount * pageSize
    } catch {
      dataSizeBytes = 0
    }

    return {
      totalFeeds: feedCount,
      totalEntries: entryCount,
      readEntries: readCount,
      starredEntries: starredCount,
      dataSizeBytes,
    }
  }

  // ---- Fever account operations ----

  getFeverAccounts(): FeverAccount[] {
    return this.db
      .prepare('SELECT * FROM fever_accounts ORDER BY created_at')
      .all()
      .map(feverAccountFromRow)
  }

  getFeverAccountById(id: string): FeverAccount | undefined {
    const row = this.db
      .prepare('SELECT * FROM fever_accounts WHERE id = ?')
      .get(id)
    return row ? feverAccountFromRow(row) : undefined
  }

  insertFeverAccount(account: FeverAccount): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_accounts
        (id, base_url, username, api_key, enabled, auto_sync,
         sync_interval_min, last_sync_at, last_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        account.id,
        account.baseUrl,
        account.username,
        account.apiKey,
        account.enabled ? 1 : 0,
        account.autoSync ? 1 : 0,
        account.syncIntervalMin,
        account.lastSyncAt ?? null,
        account.lastError ?? null,
        account.createdAt,
      )
  }

  updateFeverAccount(id: string, updates: Partial<FeverAccount>): void {
    const existing = this.getFeverAccountById(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    this.db
      .prepare(
        `
      UPDATE fever_accounts SET
        base_url = ?, username = ?, api_key = ?, enabled = ?,
        auto_sync = ?, sync_interval_min = ?, last_sync_at = ?,
        last_error = ?
      WHERE id = ?
    `,
      )
      .run(
        merged.baseUrl,
        merged.username,
        merged.apiKey,
        merged.enabled ? 1 : 0,
        merged.autoSync ? 1 : 0,
        merged.syncIntervalMin,
        merged.lastSyncAt ?? null,
        merged.lastError ?? null,
        id,
      )
  }

  deleteFeverAccount(id: string): void {
    this.db.prepare('DELETE FROM fever_accounts WHERE id = ?').run(id)
  }

  // ---- Fever feed mapping operations ----

  getFeverFeedMappings(accountId: string): FeverFeedMapping[] {
    return this.db
      .prepare('SELECT * FROM fever_feed_mappings WHERE account_id = ?')
      .all(accountId)
      .map(feverFeedMappingFromRow)
  }

  getFeverFeedMappingByRemoteId(
    accountId: string,
    feverFeedId: number,
  ): FeverFeedMapping | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM fever_feed_mappings WHERE account_id = ? AND fever_feed_id = ?',
      )
      .get(accountId, feverFeedId)
    return row ? feverFeedMappingFromRow(row) : undefined
  }

  upsertFeverFeedMapping(mapping: FeverFeedMapping): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_feed_mappings
        (account_id, fever_feed_id, local_feed_id, remote_group,
         remote_title, remote_url, is_active, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, fever_feed_id) DO UPDATE SET
        local_feed_id = excluded.local_feed_id,
        remote_group = excluded.remote_group,
        remote_title = excluded.remote_title,
        remote_url = excluded.remote_url,
        is_active = excluded.is_active,
        last_seen_at = excluded.last_seen_at
    `,
      )
      .run(
        mapping.accountId,
        mapping.feverFeedId,
        mapping.localFeedId,
        mapping.remoteGroup ?? null,
        mapping.remoteTitle ?? null,
        mapping.remoteUrl ?? null,
        mapping.isActive ? 1 : 0,
        mapping.lastSeenAt,
      )
  }

  deleteFeverFeedMappings(accountId: string): void {
    this.db
      .prepare('DELETE FROM fever_feed_mappings WHERE account_id = ?')
      .run(accountId)
  }

  markFeverFeedMappingsInactive(
    accountId: string,
    activeRemoteIds: number[],
  ): void {
    if (activeRemoteIds.length === 0) {
      this.db
        .prepare(
          'UPDATE fever_feed_mappings SET is_active = 0 WHERE account_id = ?',
        )
        .run(accountId)
      return
    }
    const placeholders = activeRemoteIds.map(() => '?').join(',')
    this.db
      .prepare(
        `UPDATE fever_feed_mappings SET is_active = 0
         WHERE account_id = ? AND fever_feed_id NOT IN (${placeholders})`,
      )
      .run(accountId, ...activeRemoteIds)
  }

  // ---- Fever item mapping operations ----

  getFeverItemMapping(
    accountId: string,
    feverItemId: number,
  ): FeverItemMapping | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM fever_item_mappings WHERE account_id = ? AND fever_item_id = ?',
      )
      .get(accountId, feverItemId)
    return row ? feverItemMappingFromRow(row) : undefined
  }

  upsertFeverItemMapping(mapping: FeverItemMapping): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_item_mappings
        (account_id, fever_item_id, fever_feed_id, local_feed_id,
         local_entry_id, remote_is_read, remote_is_starred, is_active, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, fever_item_id) DO UPDATE SET
        local_feed_id = excluded.local_feed_id,
        local_entry_id = excluded.local_entry_id,
        remote_is_read = excluded.remote_is_read,
        remote_is_starred = excluded.remote_is_starred,
        is_active = excluded.is_active,
        last_seen_at = excluded.last_seen_at
    `,
      )
      .run(
        mapping.accountId,
        mapping.feverItemId,
        mapping.feverFeedId,
        mapping.localFeedId,
        mapping.localEntryId,
        mapping.remoteIsRead ? 1 : 0,
        mapping.remoteIsStarred ? 1 : 0,
        mapping.isActive ? 1 : 0,
        mapping.lastSeenAt,
      )
  }

  getFeverItemMappingsByLocalEntry(localEntryId: string): FeverItemMapping[] {
    return this.db
      .prepare('SELECT * FROM fever_item_mappings WHERE local_entry_id = ?')
      .all(localEntryId)
      .map(feverItemMappingFromRow)
  }

  markFeverItemMappingsInactive(accountId: string, feverFeedId: number): void {
    this.db
      .prepare(
        'UPDATE fever_item_mappings SET is_active = 0 WHERE account_id = ? AND fever_feed_id = ?',
      )
      .run(accountId, feverFeedId)
  }

  // ---- Fever sync state operations ----

  getFeverSyncState(accountId: string): FeverSyncState | undefined {
    const row = this.db
      .prepare('SELECT * FROM fever_sync_states WHERE account_id = ?')
      .get(accountId)
    return row ? feverSyncStateFromRow(row) : undefined
  }

  upsertFeverSyncState(state: FeverSyncState): void {
    this.db
      .prepare(
        `
      INSERT INTO fever_sync_states
        (account_id, last_item_id, last_sync_at, last_full_sync_at, last_error)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        last_item_id = excluded.last_item_id,
        last_sync_at = excluded.last_sync_at,
        last_full_sync_at = excluded.last_full_sync_at,
        last_error = excluded.last_error
    `,
      )
      .run(
        state.accountId,
        state.lastItemId,
        state.lastSyncAt ?? null,
        state.lastFullSyncAt ?? null,
        state.lastError ?? null,
      )
  }

  // ---- Lifecycle ----

  close(): void {
    this.db.close()
  }

  // ---- Internal ----

  private upsertEntry(entry: Entry): { added: boolean; changed: boolean } {
    if (isBrokenScraperEntry(entry)) {
      const rows = this.db
        .prepare('SELECT * FROM entries WHERE feed_id = ?')
        .all(entry.feedId) as any[]

      let bestMatch: Entry | null = null
      let bestDelta = Infinity
      for (const row of rows) {
        const e = entryFromRow(row)
        if (!titlesLikelySameForRead(e.title, entry.title)) continue
        const delta = Math.abs((e.publishedAt || 0) - (entry.publishedAt || 0))
        if (delta < bestDelta) {
          bestDelta = delta
          bestMatch = e
        }
      }
      if (bestMatch && bestDelta <= 48 * 60 * 60 * 1000) {
        return { added: false, changed: mergeTextFromEntry(bestMatch, entry) }
      }
      return { added: false, changed: false }
    }

    const identityKey = makeEntryIdentityKey(entry)
    if (identityKey) {
      // Check by URL+feed first (fast path via index)
      if (entry.url) {
        const existingByUrl = this.db
          .prepare('SELECT * FROM entries WHERE feed_id = ? AND url = ?')
          .get(entry.feedId, entry.url) as any
        if (existingByUrl) {
          const existing = entryFromRow(existingByUrl)
          return {
            added: false,
            changed: mergeEntryData(existing, entry, {
              onPublishedAtAdvanced: () => {},
            }),
          }
        }
      }

      // Fallback: scan same-feed entries for identity match
      const sameFeedRows = this.db
        .prepare('SELECT * FROM entries WHERE feed_id = ?')
        .all(entry.feedId) as any[]
      for (const row of sameFeedRows) {
        const existing = entryFromRow(row)
        if (makeEntryIdentityKey(existing) === identityKey) {
          return {
            added: false,
            changed: mergeEntryData(existing, entry, {
              onPublishedAtAdvanced: () => {},
            }),
          }
        }
      }
    }

    this.db
      .prepare(
        `
      INSERT INTO entries
        (id, feed_id, title, url, content, summary,
         readability_content, readability_title, readability_excerpt,
         readability_site_name, readability_length, readability_fetched_at,
         readability_error, ai_summary, ai_summary_generated_at,
         ai_summary_error, notified_at, author, author_avatar, image_url,
         media, published_at, is_read, is_starred, read_progress,
         is_listened, listen_progress, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        entry.id,
        entry.feedId,
        entry.title,
        entry.url,
        entry.content ?? null,
        entry.summary ?? null,
        entry.readabilityContent ?? null,
        entry.readabilityTitle ?? null,
        entry.readabilityExcerpt ?? null,
        entry.readabilitySiteName ?? null,
        entry.readabilityLength ?? null,
        entry.readabilityFetchedAt ?? null,
        entry.readabilityError ?? null,
        entry.aiSummary ?? null,
        entry.aiSummaryGeneratedAt ?? null,
        entry.aiSummaryError ?? null,
        entry.notifiedAt ?? null,
        entry.author ?? null,
        entry.authorAvatar ?? null,
        entry.imageUrl ?? null,
        entry.media ? JSON.stringify(entry.media) : null,
        entry.publishedAt,
        entry.isRead ? 1 : 0,
        entry.isStarred ? 1 : 0,
        entry.readProgress ?? null,
        entry.isListened ? 1 : 0,
        entry.listenProgress ?? null,
        entry.createdAt,
      )
    return { added: true, changed: true }
  }
}
