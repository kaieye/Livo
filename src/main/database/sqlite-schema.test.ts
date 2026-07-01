import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { runMigrations } from './sqlite-schema'

const tempDirs: string[] = []

function createTempDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'livo-sqlite-schema-'))
  tempDirs.push(dir)
  return new BetterSqlite3(join(dir, 'test.sqlite'))
}

function canCreateSqliteSchemaDb(): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'livo-sqlite-schema-preflight-'))
  try {
    const db = new BetterSqlite3(join(dir, 'test.sqlite'))
    db.close()
    return true
  } catch {
    return false
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

const describeSqliteSchema = canCreateSqliteSchemaDb()
  ? describe
  : describe.skip

describeSqliteSchema('sqlite schema migrations', () => {
  it('upgrades v4 feeds with refresh status columns without losing existing data', () => {
    const db = createTempDb()
    try {
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );
        INSERT INTO schema_migrations (version, name) VALUES
          (1, 'init'),
          (2, 'fever-provider-column'),
          (3, 'fever-tables'),
          (4, 'podcast-listen-state');

        CREATE TABLE feeds (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          site_url TEXT,
          description TEXT,
          image_url TEXT,
          folder TEXT,
          category TEXT,
          view INTEGER NOT NULL DEFAULT 0,
          max_entries INTEGER,
          show_in_all INTEGER NOT NULL DEFAULT 1,
          last_fetched INTEGER,
          etag TEXT,
          last_modified TEXT,
          fetch_source TEXT,
          upstream_url TEXT,
          remote_feed_id TEXT,
          error_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          provider TEXT NOT NULL DEFAULT 'local'
        );
        CREATE TABLE entries (
          id TEXT PRIMARY KEY,
          feed_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          url TEXT NOT NULL DEFAULT '',
          published_at INTEGER NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          is_starred INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        INSERT INTO feeds (id, title, url, error_count, created_at, provider)
        VALUES ('feed-1', 'Feed title', 'https://example.com/feed.xml', 2, 1000, 'local');
      `)

      runMigrations(db)

      const columnNames = db
        .prepare('PRAGMA table_info(feeds)')
        .all()
        .map((row: any) => row.name)
      expect(columnNames).toEqual(
        expect.arrayContaining([
          'last_refresh_status',
          'last_refresh_attempted_at',
          'last_refresh_error',
          'last_refresh_raw_error',
        ]),
      )
      expect(
        db
          .prepare('SELECT title, error_count FROM feeds WHERE id = ?')
          .get('feed-1'),
      ).toEqual({ title: 'Feed title', error_count: 2 })
      expect(
        db
          .prepare('SELECT name FROM schema_migrations WHERE version = ?')
          .get(5),
      ).toEqual({ name: 'feed-refresh-status' })
    } finally {
      db.close()
    }
  })

  it('creates feed sync_changes table with user-url uniqueness', () => {
    const db = createTempDb()
    try {
      runMigrations(db)

      const columnNames = db
        .prepare('PRAGMA table_info(sync_changes)')
        .all()
        .map((row: any) => row.name)
      expect(columnNames).toEqual(
        expect.arrayContaining([
          'url',
          'action',
          'updated_at',
          'user_id',
          'synced',
          'title',
        ]),
      )

      db.prepare(
        `INSERT INTO sync_changes (url, action, updated_at, user_id, synced)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('https://example.com/feed.xml', 'subscribe', 1000, 'user-1', 0)

      expect(() =>
        db
          .prepare(
            `INSERT INTO sync_changes (url, action, updated_at, user_id, synced)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            'https://example.com/feed.xml',
            'unsubscribe',
            2000,
            'user-1',
            0,
          ),
      ).toThrow()
    } finally {
      db.close()
    }
  })
})
