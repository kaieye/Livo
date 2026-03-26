import relationalStore from '@ohos.data.relationalStore'
import { Feed, FeedViewType } from '../models/LivoModels'
import { AppDatabaseService } from '../services/AppDatabaseService'

export interface FeedDraft {
  title: string
  url: string
  siteUrl: string
  description: string
  category: string
  view: FeedViewType
  showInAll: boolean
}

function boolToNumber(value: boolean): number {
  return value ? 1 : 0
}

function numberToBool(value: number): boolean {
  return value === 1
}

function mapFeed(result: relationalStore.ResultSet): Feed {
  return {
    id: result.getString(result.getColumnIndex('id')),
    title: result.getString(result.getColumnIndex('title')),
    url: result.getString(result.getColumnIndex('url')),
    siteUrl: result.getString(result.getColumnIndex('site_url')),
    description: result.getString(result.getColumnIndex('description')),
    category: result.getString(result.getColumnIndex('category')),
    view: result.getLong(result.getColumnIndex('view')) as FeedViewType,
    showInAll: numberToBool(result.getLong(result.getColumnIndex('show_in_all'))),
    lastFetched: result.getLong(result.getColumnIndex('last_fetched')),
    etag: result.getString(result.getColumnIndex('etag')),
    lastModified: result.getString(result.getColumnIndex('last_modified')),
    errorCount: result.getLong(result.getColumnIndex('error_count')),
    createdAt: result.getLong(result.getColumnIndex('created_at')),
    updatedAt: result.getLong(result.getColumnIndex('updated_at')),
  }
}

function createFeedId(url: string): string {
  const normalized = url.trim().toLowerCase()
  const compact = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `feed-${compact || Date.now()}`
}

export class FeedRepository {
  static async list(): Promise<Feed[]> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('feeds')
    predicates.orderByDesc('updated_at')
    const result = await store.query(predicates)
    const feeds: Feed[] = []

    while (result.goToNextRow()) {
      feeds.push(mapFeed(result))
    }

    result.close()
    return feeds
  }

  static async getById(feedId: string): Promise<Feed | undefined> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('feeds')
    predicates.equalTo('id', feedId)
    predicates.limitAs(1)
    const result = await store.query(predicates)

    if (!result.goToNextRow()) {
      result.close()
      return undefined
    }

    const feed = mapFeed(result)
    result.close()
    return feed
  }

  static async count(): Promise<number> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('feeds')
    const result = await store.query(predicates, ['id'])
    const count = result.rowCount
    result.close()
    return count
  }

  static async insert(feed: Feed): Promise<void> {
    const store = await AppDatabaseService.getStore()
    await store.insert('feeds', {
      id: feed.id,
      title: feed.title,
      url: feed.url,
      site_url: feed.siteUrl ?? '',
      description: feed.description ?? '',
      category: feed.category ?? '',
      view: feed.view,
      show_in_all: boolToNumber(feed.showInAll),
      last_fetched: feed.lastFetched ?? 0,
      etag: feed.etag ?? '',
      last_modified: feed.lastModified ?? '',
      error_count: feed.errorCount,
      created_at: feed.createdAt,
      updated_at: feed.updatedAt,
    })
  }

  static async create(draft: FeedDraft): Promise<Feed> {
    const now = Date.now()
    const feed: Feed = {
      id: createFeedId(draft.url),
      title: draft.title.trim(),
      url: draft.url.trim(),
      siteUrl: draft.siteUrl.trim(),
      description: draft.description.trim(),
      category: draft.category.trim(),
      view: draft.view,
      showInAll: draft.showInAll,
      lastFetched: 0,
      etag: '',
      lastModified: '',
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    await FeedRepository.insert(feed)
    return feed
  }

  static async update(feedId: string, draft: FeedDraft): Promise<Feed> {
    const current = await FeedRepository.getById(feedId)

    if (!current) {
      throw new Error('订阅源不存在')
    }

    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('feeds')
    predicates.equalTo('id', feedId)

    await store.update({
      title: draft.title.trim(),
      url: draft.url.trim(),
      site_url: draft.siteUrl.trim(),
      description: draft.description.trim(),
      category: draft.category.trim(),
      view: draft.view,
      show_in_all: boolToNumber(draft.showInAll),
      updated_at: Date.now(),
    }, predicates)

    return (await FeedRepository.getById(feedId))!
  }

  static async updateFetchState(
    feedId: string,
    next: { lastFetched?: number; etag?: string; lastModified?: string; errorCount?: number },
  ): Promise<void> {
    const store = await AppDatabaseService.getStore()
    const predicates = new relationalStore.RdbPredicates('feeds')
    predicates.equalTo('id', feedId)
    await store.update({
      last_fetched: next.lastFetched ?? 0,
      etag: next.etag ?? '',
      last_modified: next.lastModified ?? '',
      error_count: next.errorCount ?? 0,
      updated_at: Date.now(),
    }, predicates)
  }

  static async remove(feedId: string): Promise<void> {
    const store = await AppDatabaseService.getStore()
    const feedPredicates = new relationalStore.RdbPredicates('feeds')
    feedPredicates.equalTo('id', feedId)
    const entryPredicates = new relationalStore.RdbPredicates('entries')
    entryPredicates.equalTo('feed_id', feedId)

    await store.rdbTransaction(async () => {
      await store.delete(entryPredicates)
      await store.delete(feedPredicates)
    })
  }
}
