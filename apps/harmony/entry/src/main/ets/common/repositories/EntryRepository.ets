import relationalStore from '@ohos.data.relationalStore'
import { Entry } from '../models/LivoModels'
import { AppDatabaseService } from '../services/AppDatabaseService'

function boolToNumber(value: boolean): number {
  return value ? 1 : 0
}

function numberToBool(value: number): boolean {
  return value === 1
}

function resultColumnIndex(result: relationalStore.ResultSet, columnName: string): number {
  try {
    return result.getColumnIndex(columnName)
  } catch (_error) {
    return -1
  }
}

function resultString(result: relationalStore.ResultSet, columnName: string): string {
  try {
    const columnIndex = resultColumnIndex(result, columnName)
    return columnIndex >= 0 ? result.getString(columnIndex) : ''
  } catch (_error) {
    return ''
  }
}

function resultLong(result: relationalStore.ResultSet, columnName: string): number {
  try {
    const columnIndex = resultColumnIndex(result, columnName)
    return columnIndex >= 0 ? result.getLong(columnIndex) : 0
  } catch (_error) {
    return 0
  }
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

function parseMediaUrls(mediaUrlsJson: string): string[] {
  if (!mediaUrlsJson.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(mediaUrlsJson) as string[]
    return Array.isArray(parsed) ? parsed.filter((value: string) => !!value) : []
  } catch (_error) {
    return []
  }
}

function mapEntry(result: relationalStore.ResultSet): Entry {
  return {
    id: resultString(result, 'id'),
    feedId: resultString(result, 'feed_id'),
    title: resultString(result, 'title'),
    url: resultString(result, 'url'),
    summary: resultString(result, 'summary'),
    content: resultString(result, 'content'),
    author: resultString(result, 'author'),
    publishedAt: resultLong(result, 'published_at'),
    isRead: numberToBool(resultLong(result, 'is_read')),
    isStarred: numberToBool(resultLong(result, 'is_starred')),
    readingTimeMinutes: resultLong(result, 'reading_time_minutes'),
    tags: parseTags(resultString(result, 'tags_json')),
    mediaUrls: parseMediaUrls(resultString(result, 'media_urls_json')),
    createdAt: resultLong(result, 'created_at'),
    updatedAt: resultLong(result, 'updated_at'),
  }
}

export class EntryRepository {
  static async listRecent(limit: number = 20): Promise<Entry[]> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.orderByDesc('published_at')
      predicates.orderByDesc('id')
      predicates.limitAs(limit)
      const result = await store.query(predicates, [
        'id',
        'feed_id',
        'title',
        'url',
        'summary',
        'content',
        'author',
        'published_at',
        'is_read',
        'is_starred',
        'reading_time_minutes',
        'tags_json',
        'media_urls_json',
        'created_at',
        'updated_at',
      ])
      const entries: Entry[] = []

      while (result.goToNextRow()) {
        entries.push(mapEntry(result))
      }

      result.close()
      return entries
    } catch (error) {
      throw new Error(`读取最近条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async listRecentPage(limit: number = 20, offset: number = 0): Promise<Entry[]> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.orderByDesc('published_at')
      predicates.orderByDesc('id')
      predicates.limitAs(Math.max(1, limit))
      predicates.offsetAs(Math.max(0, offset))
      const result = await store.query(predicates, [
        'id',
        'feed_id',
        'title',
        'url',
        'summary',
        'content',
        'author',
        'published_at',
        'is_read',
        'is_starred',
        'reading_time_minutes',
        'tags_json',
        'media_urls_json',
        'created_at',
        'updated_at',
      ])
      const entries: Entry[] = []

      while (result.goToNextRow()) {
        entries.push(mapEntry(result))
      }

      result.close()
      return entries
    } catch (error) {
      throw new Error(`分页读取最近条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async listStarred(limit: number = 100): Promise<Entry[]> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('is_starred', 1)
      predicates.orderByDesc('published_at')
      predicates.limitAs(limit)
      const result = await store.query(predicates)
      const entries: Entry[] = []

      while (result.goToNextRow()) {
        entries.push(mapEntry(result))
      }

      result.close()
      return entries
    } catch (error) {
      throw new Error(`读取收藏条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async listByFeed(feedId: string): Promise<Entry[]> {
    try {
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
    } catch (error) {
      throw new Error(`读取订阅条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async getById(entryId: string): Promise<Entry | undefined> {
    try {
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
    } catch (error) {
      throw new Error(`读取条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async countUnread(): Promise<number> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('is_read', 0)
      const result = await store.query(predicates, ['id'])
      const count = result.rowCount
      result.close()
      return count
    } catch (error) {
      throw new Error(`统计未读条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async countStarred(): Promise<number> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('is_starred', 1)
      const result = await store.query(predicates, ['id'])
      const count = result.rowCount
      result.close()
      return count
    } catch (error) {
      throw new Error(`统计收藏条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async countUnreadByFeed(feedId: string): Promise<number> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('feed_id', feedId)
      predicates.equalTo('is_read', 0)
      const result = await store.query(predicates, ['id'])
      const count = result.rowCount
      result.close()
      return count
    } catch (error) {
      throw new Error(`统计订阅未读条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async removeByFeed(feedId: string): Promise<void> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('feed_id', feedId)
      await store.delete(predicates)
    } catch (error) {
      throw new Error(`删除订阅条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async upsertMany(entries: Entry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }

    const store = await AppDatabaseService.getStore()

    try {
      for (const entry of entries) {
        const predicates = new relationalStore.RdbPredicates('entries')
        predicates.equalTo('id', entry.id)
        const updatedRows = await store.update({
          feed_id: entry.feedId,
          title: entry.title,
          url: entry.url,
          summary: entry.summary,
          content: entry.content,
          author: entry.author,
          published_at: entry.publishedAt,
          reading_time_minutes: entry.readingTimeMinutes,
          tags_json: JSON.stringify(entry.tags),
          media_urls_json: JSON.stringify(entry.mediaUrls ?? []),
          updated_at: Date.now(),
        }, predicates)

        if ((updatedRows as number) > 0) {
          continue
        }

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
          media_urls_json: JSON.stringify(entry.mediaUrls ?? []),
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
        })
      }
    } catch (error) {
      throw new Error(`批量插入条目失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async markRead(entryId: string, isRead: boolean): Promise<void> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('id', entryId)
      await store.update({
        is_read: boolToNumber(isRead),
        updated_at: Date.now(),
      }, predicates)
    } catch (error) {
      throw new Error(`更新已读状态失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async toggleStar(entryId: string): Promise<void> {
    const entry = await EntryRepository.getById(entryId)

    if (!entry) {
      throw new Error('条目不存在')
    }

    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('entries')
      predicates.equalTo('id', entryId)
      await store.update({
        is_starred: boolToNumber(!entry.isStarred),
        updated_at: Date.now(),
      }, predicates)
    } catch (error) {
      throw new Error(`更新收藏状态失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
}
