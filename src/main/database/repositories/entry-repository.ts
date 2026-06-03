import type Database from 'better-sqlite3'
import type { Entry } from '../../../shared/types'
import {
  dedupeEntriesForRead,
  isBrokenScraperEntry,
  mergeEntryData,
  mergeTextFromEntry,
} from '../entry-dedupe'
import {
  makeEntryIdentityKey,
  normalizeIdentityText,
  titlesLikelySameForRead,
} from '../entry-identity'
import { entryFromRow } from '../row-mappers'

export class EntryRepository {
  constructor(private readonly db: Database.Database) {}

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

    // 多取一条用于判断分页是否还有后续数据。
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
