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
  {
    version: 2,
    name: 'fever-provider-column',
    sql: `
      ALTER TABLE feeds ADD COLUMN provider TEXT NOT NULL DEFAULT 'local';
    `,
  },
  {
    version: 3,
    name: 'fever-tables',
    sql: `
      CREATE TABLE IF NOT EXISTS fever_accounts (
        id TEXT PRIMARY KEY,
        base_url TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT '',
        api_key TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        auto_sync INTEGER NOT NULL DEFAULT 1,
        sync_interval_min INTEGER NOT NULL DEFAULT 30,
        last_sync_at INTEGER,
        last_error TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fever_feed_mappings (
        account_id TEXT NOT NULL,
        fever_feed_id INTEGER NOT NULL,
        local_feed_id TEXT NOT NULL,
        remote_group TEXT,
        remote_title TEXT,
        remote_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_seen_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, fever_feed_id),
        FOREIGN KEY (account_id) REFERENCES fever_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (local_feed_id) REFERENCES feeds(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS fever_feed_mappings_local_idx
        ON fever_feed_mappings (local_feed_id);

      CREATE TABLE IF NOT EXISTS fever_item_mappings (
        account_id TEXT NOT NULL,
        fever_item_id INTEGER NOT NULL,
        fever_feed_id INTEGER NOT NULL,
        local_feed_id TEXT NOT NULL,
        local_entry_id TEXT NOT NULL,
        remote_is_read INTEGER,
        remote_is_starred INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_seen_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, fever_item_id),
        FOREIGN KEY (account_id) REFERENCES fever_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (local_entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS fever_item_mappings_local_idx
        ON fever_item_mappings (local_entry_id);
      CREATE INDEX IF NOT EXISTS fever_item_mappings_account_feed_idx
        ON fever_item_mappings (account_id, fever_feed_id);

      CREATE TABLE IF NOT EXISTS fever_sync_states (
        account_id TEXT PRIMARY KEY,
        last_item_id INTEGER NOT NULL DEFAULT 0,
        last_sync_at INTEGER,
        last_full_sync_at INTEGER,
        last_error TEXT,
        FOREIGN KEY (account_id) REFERENCES fever_accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 4,
    name: 'podcast-listen-state',
    sql: `
      ALTER TABLE entries ADD COLUMN is_listened INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE entries ADD COLUMN listen_progress REAL;
      CREATE INDEX IF NOT EXISTS entries_listened_published_idx
        ON entries (is_listened, published_at DESC, id DESC);
    `,
  },
  {
    version: 5,
    name: 'feed-refresh-status',
    sql: `
      ALTER TABLE feeds ADD COLUMN last_refresh_status TEXT;
      ALTER TABLE feeds ADD COLUMN last_refresh_attempted_at INTEGER;
      ALTER TABLE feeds ADD COLUMN last_refresh_error TEXT;
      ALTER TABLE feeds ADD COLUMN last_refresh_raw_error TEXT;
    `,
  },
  {
    version: 6,
    name: 'entry-ai-summary-sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS entry_ai_summary_sessions (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        status TEXT NOT NULL,
        draft_text TEXT NOT NULL DEFAULT '',
        final_text TEXT,
        error_code TEXT,
        error_message TEXT,
        raw_error_message TEXT,
        model TEXT,
        source_hash TEXT,
        run_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        finished_at INTEGER,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS entry_ai_summary_sessions_entry_updated_idx
        ON entry_ai_summary_sessions (entry_id, updated_at DESC);
    `,
  },
  {
    version: 7,
    name: 'entry-ai-translation-sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS entry_ai_translation_sessions (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        target_language TEXT NOT NULL,
        status TEXT NOT NULL,
        segments_json TEXT NOT NULL DEFAULT '[]',
        error_code TEXT,
        error_message TEXT,
        model TEXT,
        config_fingerprint TEXT,
        run_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        finished_at INTEGER,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS entry_ai_translation_sessions_entry_updated_idx
        ON entry_ai_translation_sessions (entry_id, updated_at DESC);
    `,
  },
  {
    version: 8,
    name: 'feed-sync-changes',
    sql: `
      CREATE TABLE IF NOT EXISTS sync_changes (
        url TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('subscribe', 'unsubscribe')),
        updated_at INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE UNIQUE INDEX IF NOT EXISTS sync_changes_user_url_idx
        ON sync_changes (user_id, url);
      CREATE INDEX IF NOT EXISTS sync_changes_user_synced_idx
        ON sync_changes (user_id, synced, updated_at DESC);
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
