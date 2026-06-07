import type Database from 'better-sqlite3'

export type FeedSyncAction = 'subscribe' | 'unsubscribe'

export interface SyncChange {
  url: string
  action: FeedSyncAction
  updatedAt: number
  userId: string
  synced: boolean
}

export interface UpsertSyncChangeInput {
  url: string
  action: FeedSyncAction
  updatedAt: number
  userId: string
  synced?: boolean
}

export interface ISyncChangesRepository {
  getChange(userId: string, url: string): SyncChange | undefined
  getChangesByUser(userId: string): SyncChange[]
  getUnsyncedChangesByUser(userId: string): SyncChange[]
  upsertChange(change: UpsertSyncChangeInput): void
  markChangesSynced(userId: string, urls: string[]): void
  countPending(userId: string): number
}

function syncChangeFromRow(row: any): SyncChange {
  return {
    url: row.url,
    action: row.action,
    updatedAt: row.updated_at,
    userId: row.user_id,
    synced: row.synced === 1,
  }
}

export class SyncChangesRepository implements ISyncChangesRepository {
  constructor(private readonly db: Database.Database) {}

  getChange(userId: string, url: string): SyncChange | undefined {
    const row = this.db
      .prepare('SELECT * FROM sync_changes WHERE user_id = ? AND url = ?')
      .get(userId, url)
    return row ? syncChangeFromRow(row) : undefined
  }

  getChangesByUser(userId: string): SyncChange[] {
    return this.db
      .prepare(
        'SELECT * FROM sync_changes WHERE user_id = ? ORDER BY updated_at DESC, url ASC',
      )
      .all(userId)
      .map(syncChangeFromRow)
  }

  getUnsyncedChangesByUser(userId: string): SyncChange[] {
    return this.db
      .prepare(
        `SELECT * FROM sync_changes
         WHERE user_id = ? AND synced = 0
         ORDER BY updated_at DESC, url ASC`,
      )
      .all(userId)
      .map(syncChangeFromRow)
  }

  upsertChange(change: UpsertSyncChangeInput): void {
    this.db
      .prepare(
        `INSERT INTO sync_changes (url, action, updated_at, user_id, synced)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, url) DO UPDATE SET
           action = excluded.action,
           updated_at = excluded.updated_at,
           synced = excluded.synced
         WHERE excluded.updated_at >= sync_changes.updated_at`,
      )
      .run(
        change.url,
        change.action,
        change.updatedAt,
        change.userId,
        change.synced ? 1 : 0,
      )
  }

  markChangesSynced(userId: string, urls: string[]): void {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)))
    if (uniqueUrls.length === 0) return

    const markOne = this.db.prepare(
      'UPDATE sync_changes SET synced = 1 WHERE user_id = ? AND url = ?',
    )
    const run = this.db.transaction((items: string[]) => {
      for (const url of items) {
        markOne.run(userId, url)
      }
    })
    run(uniqueUrls)
  }

  countPending(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM sync_changes
         WHERE user_id = ? AND synced = 0`,
      )
      .get(userId) as { count: number } | undefined

    return row?.count ?? 0
  }
}
