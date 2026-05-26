import relationalStore from '@ohos.data.relationalStore'
import { Entry } from '../models/LivoModels'
import { resultLong, resultString } from '../utils/ResultSetHelper'
import { boolToNumber, numberToBool, IDatabaseAccess, RdbTable, defaultDatabaseAccess } from './RdbTable'

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

export interface IEntryRepository {
  listRecent(limit?: number): Promise<Entry[]>
  listRecentPage(limit?: number, offset?: number): Promise<Entry[]>
  listStarred(limit?: number): Promise<Entry[]>
  listByFeed(feedId: string): Promise<Entry[]>
  getById(entryId: string): Promise<Entry | undefined>
  countUnread(): Promise<number>
  countStarred(): Promise<number>
  countUnreadByFeed(feedId: string): Promise<number>
  removeByFeed(feedId: string): Promise<void>
  upsertMany(entries: Entry[]): Promise<void>
  markRead(entryId: string, isRead: boolean): Promise<void>
  toggleStar(entryId: string): Promise<void>
}

export class EntryRepository implements IEntryRepository {
  private static _default?: EntryRepository

  static get default(): EntryRepository {
    if (!EntryRepository._default) {
      EntryRepository._default = new EntryRepository()
    }
    return EntryRepository._default
  }

  private readonly entriesTable: RdbTable<Entry>
  private readonly db: IDatabaseAccess

  constructor(db?: IDatabaseAccess) {
    this.db = db ?? defaultDatabaseAccess
    this.entriesTable = new RdbTable<Entry>('entries', mapEntry, this.db)
  }

  async listRecent(limit: number = 20): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.orderByDesc('published_at')
    predicates.orderByDesc('id')
    predicates.limitAs(limit)
    return this.entriesTable.list(predicates)
  }

  async listRecentPage(limit: number = 20, offset: number = 0): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.orderByDesc('published_at')
    predicates.orderByDesc('id')
    predicates.limitAs(Math.max(1, limit))
    predicates.offsetAs(Math.max(0, offset))
    return this.entriesTable.list(predicates)
  }

  async listStarred(limit: number = 100): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_starred', 1)
    predicates.orderByDesc('published_at')
    predicates.limitAs(limit)
    return this.entriesTable.list(predicates)
  }

  async listByFeed(feedId: string): Promise<Entry[]> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    predicates.orderByDesc('published_at')
    return this.entriesTable.list(predicates)
  }

  async getById(entryId: string): Promise<Entry | undefined> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    predicates.limitAs(1)
    return this.entriesTable.getOne(predicates)
  }

  async countUnread(): Promise<number> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_read', 0)
    return this.entriesTable.count(predicates)
  }

  async countStarred(): Promise<number> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('is_starred', 1)
    return this.entriesTable.count(predicates)
  }

  async countUnreadByFeed(feedId: string): Promise<number> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    predicates.equalTo('is_read', 0)
    return this.entriesTable.count(predicates)
  }

  async removeByFeed(feedId: string): Promise<void> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('feed_id', feedId)
    await this.entriesTable.delete(predicates)
  }

  async upsertMany(entries: Entry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }

    await this.db.withRdb('批量插入条目', async (store) => {
      for (const entry of entries) {
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
          updated_at: Date.now(),
        }, relationalStore.ConflictResolution.ON_CONFLICT_REPLACE)
      }
    })
  }

  async markRead(entryId: string, isRead: boolean): Promise<void> {
    const predicates = new relationalStore.RdbPredicates('entries')
    predicates.equalTo('id', entryId)
    await this.entriesTable.update(predicates, {
      is_read: boolToNumber(isRead),
      updated_at: Date.now(),
    })
  }

  async toggleStar(entryId: string): Promise<void> {
    await this.entriesTable.executeSql(
      `UPDATE entries SET is_starred = 1 - is_starred, updated_at = ? WHERE id = ?`,
      [Date.now(), entryId],
    )
  }

}