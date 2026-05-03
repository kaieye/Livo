import relationalStore from '@ohos.data.relationalStore'
import { Entry } from '../models/LivoModels'
import { AppDatabaseService } from '../services/AppDatabaseService'
import { resultLong, resultString } from '../utils/ResultSetHelper'
import { RdbTable } from './RdbTable'

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

const table = new RdbTable<Entry>('entries', mapEntry)

export class EntryRepository {
  static async listRecent(limit: number = 20): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.orderByDesc('published_at')
    predicates.orderByDesc('id')
    predicates.limitAs(limit)
    return table.list(predicates)
  }

  static async listRecentPage(limit: number = 20, offset: number = 0): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.orderByDesc('published_at')
    predicates.orderByDesc('id')
    predicates.limitAs(Math.max(1, limit))
    predicates.offsetAs(Math.max(0, offset))
    return table.list(predicates)
  }

  static async listStarred(limit: number = 100): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_starred', 1)
    predicates.orderByDesc('published_at')
    predicates.limitAs(limit)
    return table.list(predicates)
  }

  static async listByFeed(feedId: string): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    predicates.orderByDesc('published_at')
    return table.list(predicates)
  }

  static async getById(entryId: string): Promise<Entry | undefined> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    predicates.limitAs(1)
    return table.getOne(predicates)
  }

  static async countUnread(): Promise<number> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_read', 0)
    return table.count(predicates)
  }

  static async countStarred(): Promise<number> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_starred', 1)
    return table.count(predicates)
  }

  static async countUnreadByFeed(feedId: string): Promise<number> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    predicates.equalTo('is_read', 0)
    return table.count(predicates)
  }

  static async removeByFeed(feedId: string): Promise<void> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    await table.delete(predicates)
  }

  static async upsertMany(entries: Entry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }

    await AppDatabaseService.withRdb('批量插入条目', async (store) => {
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
    })
  }

  static async markRead(entryId: string, isRead: boolean): Promise<void> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    await table.update(predicates, {
      is_read: boolToNumber(isRead),
      updated_at: Date.now(),
    })
  }

  static async toggleStar(entryId: string): Promise<void> {
    const entry = await EntryRepository.getById(entryId)
    if (!entry) {
      throw new Error('条目不存在')
    }
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    await table.update(predicates, {
      is_starred: boolToNumber(!entry.isStarred),
      updated_at: Date.now(),
    })
  }
}
