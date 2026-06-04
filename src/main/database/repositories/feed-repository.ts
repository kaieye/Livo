import type Database from 'better-sqlite3'
import type { Feed } from '../../../shared/types'
import { feedFromRow } from '../row-mappers'

export interface IFeedRepository {
  getAllFeeds(): Feed[]
  getFeedById(id: string): Feed | undefined
  getFeedByUrl(url: string): Feed | undefined
  insertFeed(feed: Feed): void
  updateFeed(id: string, updates: Partial<Feed>): void
  deleteFeed(id: string): void
}

export class FeedRepository implements IFeedRepository {
  constructor(private readonly db: Database.Database) {}

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
         fetch_source, upstream_url, remote_feed_id, provider,
         last_refresh_status, last_refresh_attempted_at, last_refresh_error,
         last_refresh_raw_error, error_count, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        f.lastRefreshStatus ?? null,
        f.lastRefreshAttemptedAt ?? null,
        f.lastRefreshError ?? null,
        f.lastRefreshRawError ?? null,
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
        upstream_url = ?, remote_feed_id = ?, provider = ?,
        last_refresh_status = ?, last_refresh_attempted_at = ?,
        last_refresh_error = ?, last_refresh_raw_error = ?, error_count = ?
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
        merged.lastRefreshStatus ?? null,
        merged.lastRefreshAttemptedAt ?? null,
        merged.lastRefreshError ?? null,
        merged.lastRefreshRawError ?? null,
        merged.errorCount,
        id,
      )
  }

  deleteFeed(id: string): void {
    this.db.prepare('DELETE FROM feeds WHERE id = ?').run(id)
  }
}
