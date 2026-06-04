import type Database from 'better-sqlite3'
import {
  cleanupDatabaseEntries,
  type CleanupOptions,
  type CleanupStats,
} from '../cleanup'
import { entryFromRow } from '../row-mappers'
import type { IFeedRepository } from './feed-repository'

export interface IMaintenanceRepository {
  cleanupEntries(options: CleanupOptions): CleanupStats
  getDatabaseStats(): {
    totalFeeds: number
    totalEntries: number
    readEntries: number
    starredEntries: number
    dataSizeBytes: number
  }
}

export class MaintenanceRepository implements IMaintenanceRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly feeds: IFeedRepository,
  ) {}

  cleanupEntries(options: CleanupOptions): CleanupStats {
    const feeds = this.feeds.getAllFeeds()
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
}
