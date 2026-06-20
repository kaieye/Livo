import type Database from 'better-sqlite3'
import type { Entry } from '../../../shared/types'
import { planEntryWrite } from '../../services/entry/entry-write-plan'
import { dedupeEntriesForRead } from '../../services/entry/entry-read-dedup'
import { normalizeIdentityText } from '../../services/entry/entry-identity'
import { entryFromRow } from '../row-mappers'

export interface EntryListOptions {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
  beforePublishedAt?: number
  beforeId?: string
  compact?: boolean
  maxContentLength?: number
  skipDedupe?: boolean
}

export interface EntryListResult {
  entries: Entry[]
  hasMore: boolean
  nextCursorEntry?: Pick<Entry, 'id' | 'publishedAt'>
}

export interface EntrySearchOptions {
  limit?: number
  feedId?: string
  starredOnly?: boolean
  unreadOnly?: boolean
  publishedAfter?: number
  publishedBefore?: number
}

export interface EntryWriteResult {
  addedCount: number
  addedEntries: Entry[]
}

export interface IEntryRepository {
  getEntryById(id: string): Entry | undefined
  insertEntry(entry: Entry): boolean
  insertEntries(entries: Entry[]): number
  insertEntriesWithResult(entries: Entry[]): EntryWriteResult
  replaceEntriesForFeed(feedId: string, entries: Entry[]): number
  replaceEntriesForFeedWithResult(
    feedId: string,
    entries: Entry[],
  ): EntryWriteResult
  updateEntry(id: string, updates: Partial<Entry>): void
  markAllRead(feedId?: string): void
  searchEntries(
    query: string,
    limitOrOptions?: number | EntrySearchOptions,
  ): Entry[]
  getEntries(options: EntryListOptions): EntryListResult
  getOrphanEntries(): Entry[]
  reassignEntriesToFeed(fromFeedId: string, toFeedId: string): number
  getUnreadCount(feedId: string): number
  getUnreadCountMap(): Map<string, number>
}

export class EntryRepository implements IEntryRepository {
  constructor(private readonly db: Database.Database) {}

  getEntryById(id: string): Entry | undefined {
    const row = this.db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    return row ? entryFromRow(row) : undefined
  }

  // 写路径的去重匹配只需要 identity 相关字段。截断 content/summary 并跳过
  // readability / AI 摘要等大列，避免每次 upsert 把整个 feed 的全文读出来。
  private getFeedEntriesLite(feedId: string): Entry[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, feed_id, title, url,
             substr(content, 1, 4096) AS content,
             substr(summary, 1, 4096) AS summary,
             author, author_avatar, image_url, media, published_at,
             is_read, is_starred, read_progress,
             is_listened, listen_progress, created_at
      FROM entries WHERE feed_id = ?
    `,
      )
      .all(feedId) as any[]
    return rows.map(entryFromRow)
  }

  private getFeedEntriesForUpsert(
    feedId: string,
    feedCache?: Map<string, Entry[]>,
  ): Entry[] {
    const cached = feedCache?.get(feedId)
    if (cached) return cached
    const rows = this.getFeedEntriesLite(feedId)
    feedCache?.set(feedId, rows)
    return rows
  }

  private static replaceCachedEntry(rows: Entry[], updated: Entry): void {
    const index = rows.findIndex((row) => row.id === updated.id)
    if (index !== -1) rows[index] = updated
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
      const feedCache = new Map<string, Entry[]>()
      for (const entry of items) {
        const result = this.upsertEntry(entry, feedCache)
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
      // 只需要阅读状态相关的小列来保留用户状态，跳过正文等大列。
      const existingRows = this.db
        .prepare(
          `
        SELECT title, published_at, is_read, is_starred, read_progress,
               is_listened, listen_progress
        FROM entries WHERE feed_id = ?
      `,
        )
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
        const entry = {
          title: row.title as string,
          publishedAt: row.published_at as number,
          isRead: row.is_read === 1,
          isStarred: row.is_starred === 1,
          readProgress: (row.read_progress ?? undefined) as number | undefined,
          isListened: row.is_listened === 1,
          listenProgress: (row.listen_progress ?? undefined) as
            | number
            | undefined,
        }
        const key = makeKeepKey(entry)
        const existing = stateByKey.get(key)
        if (!existing) {
          stateByKey.set(key, {
            isRead: entry.isRead,
            isStarred: entry.isStarred,
            readProgress: entry.readProgress,
            isListened: entry.isListened,
            listenProgress: entry.listenProgress,
          })
          continue
        }
        existing.isRead = existing.isRead || entry.isRead
        existing.isStarred = existing.isStarred || entry.isStarred
        if (
          entry.readProgress !== undefined &&
          (existing.readProgress === undefined ||
            entry.readProgress > existing.readProgress)
        ) {
          existing.readProgress = entry.readProgress
        }
        existing.isListened = existing.isListened || entry.isListened
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
      const feedCache = new Map<string, Entry[]>([[feedId, []]])
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
        const result = this.upsertEntry(incoming, feedCache)
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
    this.persistEntry(merged)
  }

  private persistEntry(entry: Entry): void {
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
        entry.id,
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

  searchEntries(
    query: string,
    limitOrOptions: number | EntrySearchOptions = 50,
  ): Entry[] {
    const trimmed = query.trim()
    if (!trimmed) return []

    const options =
      typeof limitOrOptions === 'number'
        ? { limit: limitOrOptions }
        : limitOrOptions
    const limit = options.limit ?? 50
    const cappedLimit = Math.max(1, Math.min(Math.floor(limit), 100))
    const q = `%${trimmed}%`
    const conditions = [
      '(e.title LIKE ? OR e.content LIKE ? OR e.summary LIKE ?)',
    ]
    const params: any[] = [q, q, q]
    if (options.feedId) {
      conditions.push('e.feed_id = ?')
      params.push(options.feedId)
    }
    if (options.starredOnly) {
      conditions.push('e.is_starred = 1')
    }
    if (options.unreadOnly) {
      conditions.push('e.is_read = 0')
    }
    if (typeof options.publishedAfter === 'number') {
      conditions.push('e.published_at >= ?')
      params.push(options.publishedAfter)
    }
    if (typeof options.publishedBefore === 'number') {
      conditions.push('e.published_at <= ?')
      params.push(options.publishedBefore)
    }

    const rows = this.db
      .prepare(
        `
      SELECT e.* FROM entries e
      INNER JOIN feeds f ON f.id = e.feed_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE
          WHEN e.title LIKE ? THEN 0
          WHEN e.summary LIKE ? THEN 1
          ELSE 2
        END,
        e.published_at DESC,
        e.id DESC
      LIMIT ?
    `,
      )
      .all(...params, q, q, cappedLimit) as any[]
    return rows.map(entryFromRow)
  }

  getEntries(options: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
    limit?: number
    offset?: number
    beforePublishedAt?: number
    beforeId?: string
    compact?: boolean
    maxContentLength?: number
    skipDedupe?: boolean
  }): {
    entries: Entry[]
    hasMore: boolean
    nextCursorEntry?: Pick<Entry, 'id' | 'publishedAt'>
  } {
    const offset = options.offset || 0
    const limit = options.limit || 1000
    const useKeyset =
      typeof options.beforePublishedAt === 'number' && !!options.beforeId
    const fetchLimit = options.skipDedupe ? limit + 1 : limit * 3 + 1

    // 紧凑列表不需要 readability / AI 摘要全文，正文也只要 trim 预算内的前缀。
    // 在 SQL 层截断可以避免把数百 KB 的大列读出再丢弃，这是列表查询的主要开销。
    const compactContentBudget = Math.max(
      2048,
      Math.min(options.maxContentLength ?? 1600, 10000) * 2,
    )
    const selectColumns = options.compact
      ? `e.id, e.feed_id, e.title, e.url,
         substr(e.content, 1, ${compactContentBudget}) AS content,
         substr(e.summary, 1, ${compactContentBudget}) AS summary,
         substr(e.readability_content, 1, 600) AS readability_content,
         e.readability_title, e.readability_excerpt, e.readability_site_name,
         e.readability_length, e.readability_fetched_at, e.readability_error,
         substr(e.ai_summary, 1, 600) AS ai_summary,
         e.ai_summary_generated_at, e.ai_summary_error,
         e.notified_at, e.author, e.author_avatar, e.image_url, e.media,
         e.published_at, e.is_read, e.is_starred, e.read_progress,
         e.is_listened, e.listen_progress, e.created_at`
      : 'e.*'

    let sql = `SELECT ${selectColumns} FROM entries e INNER JOIN feeds f ON f.id = e.feed_id`
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

    if (useKeyset) {
      conditions.push(
        '(e.published_at < ? OR (e.published_at = ? AND e.id < ?))',
      )
      params.push(
        options.beforePublishedAt,
        options.beforePublishedAt,
        options.beforeId,
      )
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY e.published_at DESC, e.id DESC'

    // 多取一条用于判断分页是否还有后续数据；去重列表额外 overscan，
    // 避免 SQL 层页内重复导致 renderer 拿不到足够条目。
    sql += ' LIMIT ?'
    params.push(fetchLimit)
    if (!useKeyset) {
      sql += ' OFFSET ?'
      params.push(offset)
    }

    const rows = this.db.prepare(sql).all(...params) as any[]
    const hasExtraRawRow = rows.length > fetchLimit - 1
    const visibleRows = hasExtraRawRow ? rows.slice(0, fetchLimit - 1) : rows
    const pageRows = options.skipDedupe
      ? visibleRows.slice(0, limit)
      : visibleRows
    let entries = pageRows.map(entryFromRow)

    if (!options.skipDedupe) {
      entries = dedupeEntriesForRead(entries, () => {})
      entries.sort((a, b) => {
        const dateDelta = (b.publishedAt || 0) - (a.publishedAt || 0)
        return dateDelta || b.id.localeCompare(a.id)
      })
    }
    const hasOverflowAfterDedupe = entries.length > limit
    const resultEntries = hasOverflowAfterDedupe
      ? entries.slice(0, limit)
      : entries
    const anchorEntry =
      hasOverflowAfterDedupe || options.skipDedupe
        ? resultEntries.at(-1)
        : pageRows.at(-1)
          ? entryFromRow(pageRows.at(-1))
          : undefined
    const nextCursorEntry = anchorEntry
      ? { id: anchorEntry.id, publishedAt: anchorEntry.publishedAt }
      : undefined
    const hasMore = hasExtraRawRow || hasOverflowAfterDedupe

    if (!options.compact)
      return { entries: resultEntries, hasMore, nextCursorEntry }

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
      entries: resultEntries.map((entry) => ({
        ...entry,
        content: trimCompactContent(entry.content, maxContentLength),
        summary: trimCompactContent(entry.summary, maxSummaryLength),
        media: entry.media || [],
      })),
      hasMore,
      nextCursorEntry,
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

  private upsertEntry(
    entry: Entry,
    feedCache?: Map<string, Entry[]>,
  ): { added: boolean; changed: boolean } {
    // 匹配阶段使用轻量行（截断正文、跳过大列），命中后再按 id 取完整行合并。
    // 批量写入时通过 feedCache 复用同一 feed 的轻量行，避免每条都重读全表。
    // 去重/合并的决策（insert / merge / noop）由 entry-write-plan 的纯函数
    // planEntryWrite 负责，本方法只负责执行该计划（原始 SQL 插入/更新）。
    const liteRows = this.getFeedEntriesForUpsert(entry.feedId, feedCache)
    const plan = planEntryWrite(entry, liteRows)

    if (plan.type === 'noop') {
      return { added: false, changed: false }
    }

    if (plan.type === 'merge') {
      const existing = this.getEntryById(plan.targetId)
      if (!existing) return { added: false, changed: false }
      const changed = plan.applyMerge(existing)
      if (changed) {
        this.persistEntry(existing)
        EntryRepository.replaceCachedEntry(liteRows, existing)
      }
      return { added: false, changed }
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
    feedCache?.get(entry.feedId)?.push(entry)
    return { added: true, changed: true }
  }
}
