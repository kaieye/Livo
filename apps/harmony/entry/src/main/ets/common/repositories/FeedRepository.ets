import relationalStore from '@ohos.data.relationalStore'
import { Feed, FeedViewType } from '../models/LivoModels'
import { AppDatabaseService } from '../services/AppDatabaseService'

export interface FeedDraft {
  title: string
  url: string
  siteUrl: string
  imageUrl: string
  description: string
  category: string
  view: FeedViewType
  showInAll: boolean
}

export interface UpdateFetchStateParams {
  title?: string
  siteUrl?: string
  imageUrl?: string
  description?: string
  lastFetched?: number
  etag?: string
  lastModified?: string
  errorCount?: number
}

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

function mapFeed(result: relationalStore.ResultSet): Feed {
  return {
    id: resultString(result, 'id'),
    title: resultString(result, 'title'),
    url: resultString(result, 'url'),
    siteUrl: resultString(result, 'site_url'),
    imageUrl: resultString(result, 'image_url'),
    description: resultString(result, 'description'),
    category: resultString(result, 'category'),
    view: resultLong(result, 'view') as FeedViewType,
    showInAll: numberToBool(resultLong(result, 'show_in_all')),
    lastFetched: resultLong(result, 'last_fetched'),
    etag: resultString(result, 'etag'),
    lastModified: resultString(result, 'last_modified'),
    errorCount: resultLong(result, 'error_count'),
    createdAt: resultLong(result, 'created_at'),
    updatedAt: resultLong(result, 'updated_at'),
  }
}

function createFeedId(url: string): string {
  const normalized = url.trim().toLowerCase()
  const compact = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `feed-${compact || Date.now()}`
}

export class FeedRepository {
  static async list(): Promise<Feed[]> {
    try {
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
    } catch (error) {
      throw new Error(`读取订阅源列表失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async getById(feedId: string): Promise<Feed | undefined> {
    try {
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
    } catch (error) {
      throw new Error(`读取订阅源失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async count(): Promise<number> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('feeds')
      const result = await store.query(predicates, ['id'])
      const count = result.rowCount
      result.close()
      return count
    } catch (error) {
      throw new Error(`统计订阅源失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async insert(feed: Feed): Promise<void> {
    try {
      const store = await AppDatabaseService.getStore()
      await store.insert('feeds', {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        site_url: feed.siteUrl ?? '',
        image_url: feed.imageUrl ?? '',
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
    } catch (error) {
      throw new Error(`新增订阅源失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async create(draft: FeedDraft): Promise<Feed> {
    const now = Date.now()
    const feed: Feed = {
      id: createFeedId(draft.url),
      title: draft.title.trim(),
      url: draft.url.trim(),
      siteUrl: draft.siteUrl.trim(),
      imageUrl: draft.imageUrl.trim(),
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

    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('feeds')
      predicates.equalTo('id', feedId)

      await store.update({
        title: draft.title.trim(),
        url: draft.url.trim(),
        site_url: draft.siteUrl.trim(),
        image_url: draft.imageUrl.trim() || current.imageUrl || '',
        description: draft.description.trim(),
        category: draft.category.trim(),
        view: draft.view,
        show_in_all: boolToNumber(draft.showInAll),
        updated_at: Date.now(),
      }, predicates)
    } catch (error) {
      throw new Error(`更新订阅源失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }

    return (await FeedRepository.getById(feedId))!
  }

  static async updateFetchState(
    feedId: string,
    next: UpdateFetchStateParams,
  ): Promise<void> {
    try {
      const store = await AppDatabaseService.getStore()
      const predicates = new relationalStore.RdbPredicates('feeds')
      predicates.equalTo('id', feedId)
      await store.update({
        title: next.title ?? '',
        site_url: next.siteUrl ?? '',
        image_url: next.imageUrl ?? '',
        description: next.description ?? '',
        last_fetched: next.lastFetched ?? 0,
        etag: next.etag ?? '',
        last_modified: next.lastModified ?? '',
        error_count: next.errorCount ?? 0,
        updated_at: Date.now(),
      }, predicates)
    } catch (error) {
      throw new Error(`更新抓取状态失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  static async remove(feedId: string): Promise<void> {
    const store = await AppDatabaseService.getStore()
    const feedPredicates = new relationalStore.RdbPredicates('feeds')
    feedPredicates.equalTo('id', feedId)
    const entryPredicates = new relationalStore.RdbPredicates('entries')
    entryPredicates.equalTo('feed_id', feedId)

    try {
      await store.delete(entryPredicates)
      await store.delete(feedPredicates)
    } catch (error) {
      throw new Error(`删除订阅源失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
}
