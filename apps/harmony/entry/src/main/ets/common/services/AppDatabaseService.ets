import relationalStore from '@ohos.data.relationalStore'
import { AppContextService } from './AppContextService'

const STORE_CONFIG: relationalStore.StoreConfig = {
  name: 'LivoHarmony.db',
  securityLevel: relationalStore.SecurityLevel.S1,
}

const CREATE_FEEDS_TABLE = `
  CREATE TABLE IF NOT EXISTS feeds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    site_url TEXT,
    image_url TEXT,
    description TEXT,
    category TEXT,
    view INTEGER NOT NULL,
    show_in_all INTEGER NOT NULL,
    last_fetched INTEGER,
    etag TEXT,
    last_modified TEXT,
    error_count INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`

const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    author TEXT,
    published_at INTEGER NOT NULL,
    is_read INTEGER NOT NULL,
    is_starred INTEGER NOT NULL,
    reading_time_minutes INTEGER NOT NULL,
    tags_json TEXT NOT NULL,
    media_urls_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`

const CREATE_FEED_URL_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_feeds_url
  ON feeds (url)
`

const CREATE_ENTRIES_FEED_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entries_feed_published
  ON entries (feed_id, published_at DESC)
`

const CREATE_ENTRIES_READ_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entries_read_published
  ON entries (is_read, published_at DESC)
`

const CREATE_ENTRIES_STAR_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entries_star_published
  ON entries (is_starred, published_at DESC)
`

const CREATE_ENTRIES_PUBLISHED_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entries_published
  ON entries (published_at DESC)
`

export class AppDatabaseService {
  private static store: relationalStore.RdbStore | null = null

  static async getStore(): Promise<relationalStore.RdbStore> {
    if (!AppDatabaseService.store) {
      try {
        const context = AppContextService.getContext()
        AppDatabaseService.store = await relationalStore.getRdbStore(context, STORE_CONFIG)
        await AppDatabaseService.migrate(AppDatabaseService.store)
      } catch (error) {
        throw new Error(`初始化数据库失败：${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }

    return AppDatabaseService.store
  }

  private static async migrate(store: relationalStore.RdbStore): Promise<void> {
    try {
      await store.executeSql(CREATE_FEEDS_TABLE)
      await store.executeSql(CREATE_ENTRIES_TABLE)
      await AppDatabaseService.tryAddColumn(store, 'ALTER TABLE feeds ADD COLUMN image_url TEXT')
      await AppDatabaseService.tryAddColumn(store, `ALTER TABLE entries ADD COLUMN media_urls_json TEXT NOT NULL DEFAULT '[]'`)
      await store.executeSql(CREATE_FEED_URL_INDEX)
      await store.executeSql(CREATE_ENTRIES_FEED_INDEX)
      await store.executeSql(CREATE_ENTRIES_READ_INDEX)
      await store.executeSql(CREATE_ENTRIES_STAR_INDEX)
      await store.executeSql(CREATE_ENTRIES_PUBLISHED_INDEX)
    } catch (error) {
      throw new Error(`执行数据库迁移失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async withRdb<T>(operationLabel: string, fn: (store: relationalStore.RdbStore) => Promise<T>): Promise<T> {
    try {
      const store = await AppDatabaseService.getStore()
      return await fn(store)
    } catch (error) {
      throw new Error(`${operationLabel}失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async withRdbResult<T>(
    operationLabel: string,
    fn: (store: relationalStore.RdbStore) => Promise<relationalStore.ResultSet>,
    mapRow: (result: relationalStore.ResultSet) => T,
  ): Promise<T[]> {
    return AppDatabaseService.withRdb(operationLabel, async (store) => {
      const result = await fn(store)
      const rows: T[] = []
      while (result.goToNextRow()) {
        rows.push(mapRow(result))
      }
      result.close()
      return rows
    })
  }

  private static async tryAddColumn(
    store: relationalStore.RdbStore,
    sql: string,
  ): Promise<void> {
    try {
      await store.executeSql(sql)
    } catch (_) {
    }
  }
}
