import {
  ArticleDetailModel,
  DashboardMetric,
  Entry,
  EntryCardModel,
  Feed,
  FeedCardModel,
  FeedWithCount,
  HarmonySettings,
  RemoteFeedResult,
  toArticleDetailModel,
  toEntryCardModel,
  toFeedCardModel,
} from '../models/LivoModels'
import { FeedDraft, FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { seedSettings, SEED_ENTRIES, SEED_FEEDS } from './SeedData'
import { AppPreferenceService } from '../services/AppPreferenceService'
import { RssFeedService } from '../services/RssFeedService'

function compactEntryCards(items: Array<EntryCardModel | undefined>): EntryCardModel[] {
  const result: EntryCardModel[] = []

  items.forEach((item: EntryCardModel | undefined) => {
    if (item) {
      result.push(item)
    }
  })

  return result
}

async function feedWithCount(feed: Feed): Promise<FeedWithCount> {
  const unreadCount = await EntryRepository.countUnreadByFeed(feed.id)
  return {
    id: feed.id,
    title: feed.title,
    url: feed.url,
    siteUrl: feed.siteUrl,
    description: feed.description,
    category: feed.category,
    view: feed.view,
    showInAll: feed.showInAll,
    lastFetched: feed.lastFetched,
    etag: feed.etag,
    lastModified: feed.lastModified,
    errorCount: feed.errorCount,
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt,
    unreadCount,
  }
}

function entryCardFromEntry(entry: Entry, feed: Feed | undefined): EntryCardModel | undefined {
  if (!feed) {
    return undefined
  }

  return toEntryCardModel(entry, feed)
}

export class AppRepository {
  private static bootstrapped: boolean = false

  static async bootstrap(): Promise<void> {
    if (AppRepository.bootstrapped) {
      return
    }

    await AppPreferenceService.loadSettings()
    const existingFeeds = await FeedRepository.count()

    if (existingFeeds === 0) {
      for (const feed of SEED_FEEDS) {
        await FeedRepository.insert(feed)
      }

      await EntryRepository.upsertMany(SEED_ENTRIES)
      await AppPreferenceService.saveSettings(seedSettings())
    }

    AppRepository.bootstrapped = true
  }

  static async dashboardMetrics(): Promise<DashboardMetric[]> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.count()
    const unreadEntries = await EntryRepository.countUnread()
    const starredEntries = await EntryRepository.countStarred()

    return [
      { label: '订阅源', value: `${feeds}`, hint: '已接入内容来源' },
      { label: '未读条目', value: `${unreadEntries}`, hint: '待浏览更新内容' },
      { label: '已收藏', value: `${starredEntries}`, hint: '稍后阅读入口' },
    ]
  }

  static async feeds(): Promise<FeedCardModel[]> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.list()
    const cards: FeedCardModel[] = []

    for (const feed of feeds) {
      cards.push(toFeedCardModel(await feedWithCount(feed)))
    }

    return cards
  }

  static async feedById(feedId: string): Promise<FeedCardModel | undefined> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.getById(feedId)
    return feed ? toFeedCardModel(await feedWithCount(feed)) : undefined
  }

  static async feedEntityById(feedId: string): Promise<Feed | undefined> {
    await AppRepository.bootstrap()
    return FeedRepository.getById(feedId)
  }

  static async featuredEntries(): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const entries = await EntryRepository.listRecent(20)
    const feeds = await FeedRepository.list()
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))

    return compactEntryCards(entries.map((entry: Entry) => entryCardFromEntry(entry, feedMap.get(entry.feedId))))
  }

  static async entriesByFeed(feedId: string): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const [entries, feed] = await Promise.all([
      EntryRepository.listByFeed(feedId),
      FeedRepository.getById(feedId),
    ])

    return compactEntryCards(entries.map((entry: Entry) => entryCardFromEntry(entry, feed)))
  }

  static async entryById(entryId: string): Promise<ArticleDetailModel | undefined> {
    await AppRepository.bootstrap()
    const entry = await EntryRepository.getById(entryId)

    if (!entry) {
      return undefined
    }

    const feed = await FeedRepository.getById(entry.feedId)
    if (!feed) {
      return undefined
    }

    return toArticleDetailModel(entry, feed)
  }

  static async settings(): Promise<HarmonySettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadSettings()
  }

  static async persistSettings(next: HarmonySettings): Promise<HarmonySettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.saveSettings(next)
  }

  static async createFeed(draft: FeedDraft): Promise<FeedCardModel> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.create(draft)
    return toFeedCardModel(await feedWithCount(feed))
  }

  static async updateFeed(feedId: string, draft: FeedDraft): Promise<FeedCardModel> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.update(feedId, draft)
    return toFeedCardModel(await feedWithCount(feed))
  }

  static async removeFeed(feedId: string): Promise<void> {
    await AppRepository.bootstrap()
    await FeedRepository.remove(feedId)
  }

  static async markRead(entryId: string, isRead: boolean): Promise<void> {
    await AppRepository.bootstrap()
    await EntryRepository.markRead(entryId, isRead)
  }

  static async toggleStar(entryId: string): Promise<void> {
    await AppRepository.bootstrap()
    await EntryRepository.toggleStar(entryId)
  }

  static async refreshFeed(feedId: string): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.getById(feedId)

    if (!feed) {
      throw new Error('订阅源不存在')
    }

    try {
      const payload = await RssFeedService.fetchFeedEntries(feed)
      await EntryRepository.upsertMany(payload.entries)
      await FeedRepository.updateFetchState(feedId, {
        lastFetched: Date.now(),
        etag: payload.etag,
        lastModified: payload.lastModified,
        errorCount: 0,
      })

      return {
        entries: await AppRepository.entriesByFeed(feedId),
        sourceLabel: `${feed.title} · 已刷新 ${payload.entries.length} 条`,
        fallbackUsed: false,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      await FeedRepository.updateFetchState(feedId, {
        lastFetched: feed.lastFetched ?? 0,
        etag: feed.etag ?? '',
        lastModified: feed.lastModified ?? '',
        errorCount: (feed.errorCount ?? 0) + 1,
      })

      return {
        entries: await AppRepository.entriesByFeed(feedId),
        sourceLabel: `${feed.title} · 刷新失败：${message}`,
        fallbackUsed: true,
      }
    }
  }

  static async refreshAllFeeds(): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.list()
    let refreshedCount = 0
    let failedCount = 0

    for (const feed of feeds) {
      const result = await AppRepository.refreshFeed(feed.id)
      if (result.fallbackUsed) {
        failedCount += 1
      } else {
        refreshedCount += 1
      }
    }

    return {
      entries: await AppRepository.featuredEntries(),
      sourceLabel: `全部订阅：成功 ${refreshedCount}，失败 ${failedCount}`,
      fallbackUsed: failedCount > 0,
    }
  }
}
