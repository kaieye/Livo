import relationalStore from '@ohos.data.relationalStore'
import { Entry } from '../models/LivoModels'
import { AppDatabaseService } from '../services/AppDatabaseService'

function boolToNumber(value: boolean): number {
  return value ? 1 : 0
}

function numberToBool(value: number): boolean {
  return value === 1
}

function parseTags(tagsJson: string): string[] {
  if (!tagsJson.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(tagsJson) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

function mapEntry(result: relationalStore.ResultSet): Entry {
  return {
    id: result.getString(result.getColumnIndex('id')),
    feedId: result.getString(result.getColumnIndex('feed_id')),
    title: result.getString(result.getColumnIndex('title')),
    url: result.getString(result.getColumnIndex('url')),
    summary: result.getString(result.getColumnIndex('summary')),
    content: result.getString(result.getColumnIndex('content')),
    author: result.getString(result.getColumnIndex('author')),
    publishedAt: result.getLong(result.getColumnIndex('published_at')),
    isRead: numberToBool(result.getLong(result.getColumnIndex('is_read'))),
    isStarred: numberToBool(result.getLong(result.getColumnIndex('is_starred'))),
    readingTimeMinutes: result.getLong(result.getColumnIndex('reading_time_minutes')),
    tags: parseTags(result.getString(result.getColumnIndex('tags_json'))),
    createdAt: result.getLong(result.getColumnIndex('created_at')),
    updatedAt: result.getLong(result.getColumnIndex('updated_at')),
  }
}

export class EntryRepository {
  static async listRecent(limit: number = 20): Promise<Entry[]> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.orderByDesc('published_at')
    predicates.limitAs(limit)
    const result = await store.query(predicates)
    const entries: Entry[] = []

    while (result.goToNextRow()) {
      entries.push(mapEntry(result))
    }

    result.close()
    return entries
  }

  static async listByFeed(feedId: string): Promise<Entry[]> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    predicates.orderByDesc('published_at')
    const result = await store.query(predicates)
    const entries: Entry[] = []

    while (result.goToNextRow()) {
      entries.push(mapEntry(result))
    }

    result.close()
    return entries
  }

  static async getById(entryId: string): Promise<Entry | undefined> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    predicates.limitAs(1)
    const result = await store.query(predicates)

    if (!result.goToNextRow()) {
      result.close()
      return undefined
    }

    const entry = mapEntry(result)
    result.close()
    return entry
  }

  static async countUnread(): Promise<number> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_read', 0)
    const result = await store.query(predicates, ['id'])
    const count = result.rowCount
    result.close()
    return count
  }

  static async countStarred(): Promise<number> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_starred', 1)
    const result = await store.query(predicates, ['id'])
    const count = result.rowCount
    result.close()
    return count
  }

  static async countUnreadByFeed(feedId: string): Promise<number> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    predicates.equalTo('is_read', 0)
    const result = await store.query(predicates, ['id'])
    const count = result.rowCount
    result.close()
    return count
  }

  static async upsertMany(entries: Entry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }

    const store = await AppDatabaseService.getStore()

    try {
      for (const entry of entries) {
        const existing = await EntryRepository.getById(entry.id)
        if (existing) {
          const predicates = new relationalStore.RdbPredicates('entries')
          predicates.equalTo('id', entry.id)
          await store.update({
            feed_id: entry.feedId,
            title: entry.title,
            url: entry.url,
            summary: entry.summary,
            content: entry.content,
            author: entry.author,
            published_at: entry.publishedAt,
            reading_time_minutes: entry.readingTimeMinutes,
            tags_json: JSON.stringify(entry.tags),
            is_read: boolToNumber(existing.isRead),
            is_starred: boolToNumber(existing.isStarred),
            updated_at: Date.now(),
          }, predicates)
        } else {
          await store.insert('entries', {
            id: entry.id,
            feed_id: entry.feedId,
            title: entry.title,
            url: entry.url,
            summary: entry.summary,
            content: entry.content,
            author: entry.author,
            published_at: entry.publishedAt,
            is_read: boolToNumber(entry.isRead),
            is_starred: boolToNumber(entry.isStarred),
            reading_time_minutes: entry.readingTimeMinutes,
            tags_json: JSON.stringify(entry.tags),
            created_at: entry.createdAt,
            updated_at: entry.updatedAt,
          })
        }
      }
    } catch (error) {
      throw new Error(`批量插入条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async markRead(entryId: string, isRead: boolean): Promise<void> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    await store.update({
      is_read: boolToNumber(isRead),
      updated_at: Date.now(),
    }, predicates)
  }

  static async toggleStar(entryId: string): Promise<void> {
    const entry = await EntryRepository.getById(entryId)

    if (!entry) {
      throw new Error('条目不存在')
    }

    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    await store.update({
      is_starred: boolToNumber(!entry.isStarred),
      updated_at: Date.now(),
    }, predicates)
  }
}
