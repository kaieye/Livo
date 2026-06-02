import type Database from 'better-sqlite3'

const MIGRATIONS: Array<{
  version: number
  name: string
  sql: string
}> = [
  {
    version: 1,
    name: 'init',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE TABLE IF NOT EXISTS feeds (
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
        created_at INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS feeds_url_unique ON feeds (url);

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        feed_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        content TEXT,
        summary TEXT,
        readability_content TEXT,
        readability_title TEXT,
        readability_excerpt TEXT,
        readability_site_name TEXT,
        readability_length INTEGER,
        readability_fetched_at INTEGER,
        readability_error TEXT,
        ai_summary TEXT,
        ai_summary_generated_at INTEGER,
        ai_summary_error TEXT,
        notified_at INTEGER,
        author TEXT,
        author_avatar TEXT,
        image_url TEXT,
        media TEXT,
        published_at INTEGER NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        is_starred INTEGER NOT NULL DEFAULT 0,
        read_progress REAL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS entries_feed_published_idx
        ON entries (feed_id, published_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS entries_read_published_idx
        ON entries (is_read, published_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS entries_starred_published_idx
        ON entries (is_starred, published_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS entries_published_idx
        ON entries (published_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS entries_url_idx
        ON entries (feed_id, url);

      CREATE TABLE IF NOT EXISTS ai_digest_runs (
        id TEXT PRIMARY KEY,
        preset TEXT NOT NULL,
        feed_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        window_start_at INTEGER NOT NULL,
        window_end_at INTEGER NOT NULL,
        source_entry_ids TEXT NOT NULL DEFAULT '[]',
        candidate_count INTEGER NOT NULL DEFAULT 0,
        content TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS ai_digest_runs_dedupe_idx
        ON ai_digest_runs (preset, feed_id, window_start_at);
    `,
  },
]

export function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
     )`,
  )

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row: any) => row.version),
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue
    db.exec(migration.sql)
    db.prepare(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
    ).run(migration.version, migration.name)
  }
}
