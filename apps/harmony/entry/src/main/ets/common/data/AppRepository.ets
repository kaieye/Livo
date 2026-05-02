import {
  AIAssistantSettings,
  ArticleDetailModel,
  AccountProvider,
  AccountStatusResult,
  BilibiliImportProgress,
  DashboardMetric,
  Entry,
  EntryCardModel,
  Feed,
  FeedCardModel,
  FeedViewType,
  HarmonySettings,
  PendingBilibiliCreator,
  RefreshLogEntry,
  RemoteFeedResult,
  toArticleDetailModel,
  toFeedCardModel,
} from '../models/LivoModels'
import { FeedRepository, FeedDraft } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { seedSettings, SEED_ENTRIES, SEED_FEEDS } from './SeedData'
import { AppPreferenceService } from '../services/AppPreferenceService'
import { AccountSessionService } from '../services/AccountSessionService'
import { BilibiliFollowingsService } from '../services/BilibiliFollowingsService'
import { RssFeedService, FeedRefreshPayload } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { ThemeService } from '../services/ThemeService'
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'
import {
  feedWithCount,
  feedCardFromFeed,
  buildEntryCardsChunked,
  HomeEntryMode,
} from './AppRepositoryEntryHelpers'
import { FeedRefreshCoordinator } from './FeedRefreshCoordinator'
import { FeaturedEntriesQuery } from './FeaturedEntriesQuery'

function compactEntryCards(items: Array<EntryCardModel | undefined>): EntryCardModel[] {
  const result: EntryCardModel[] = []
  items.forEach((item: EntryCardModel | undefined) => {
    if (item) {
      result.push(item)
    }
  })
  return result
}

class AppRepository {
  private static bootstrapped: boolean = false

  static async bootstrap(): Promise<void> {
    if (AppRepository.bootstrapped) {
      return
    }

    const settings = await AppPreferenceService.loadSettings()
    await ThemeService.resolvePalette(settings)
    const existingFeeds = await FeedRepository.count()

    if (existingFeeds === 0) {
      for (const feed of SEED_FEEDS) {
        await FeedRepository.insert(feed)
      }

      await EntryRepository.upsertMany(SEED_ENTRIES)
      await AppPreferenceService.saveSettings(seedSettings())
      void FeedRefreshCoordinator.hydrateSeedFeeds(SEED_FEEDS)
    }

    AppRepository.bootstrapped = true
    await FeedRefreshCoordinator.bootstrap()
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

  // Feed operations
  static async feeds(): Promise<FeedCardModel[]> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.list()
    const sorted = [...feeds].sort((a, b) => {
      const aTime = a.createdAt || 0
      const bTime = b.createdAt || 0
      if (aTime !== bTime) return aTime - bTime
      return a.id.localeCompare(b.id)
    })
    const cards: FeedCardModel[] = []
    for (const feed of sorted) {
      cards.push(toFeedCardModel(await feedWithCount(feed)))
    }
    return cards
  }

  static async feedsFast(): Promise<FeedCardModel[]> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.list()
    const sorted = [...feeds].sort((a, b) => {
      const aTime = a.createdAt || 0
      const bTime = b.createdAt || 0
      if (aTime !== bTime) return aTime - bTime
      return a.id.localeCompare(b.id)
    })
    return sorted.map((feed: Feed) => feedCardFromFeed(feed))
  }

  static async feedEntities(): Promise<Feed[]> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.list()
    return [...feeds].sort((a, b) => {
      const aTime = a.createdAt || 0
      const bTime = b.createdAt || 0
      if (aTime !== bTime) return aTime - bTime
      return a.id.localeCompare(b.id)
    })
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

  static async resolveFeedAvatarOnly(feedId: string): Promise<boolean> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.getById(feedId)
    if (!feed) {
      return false
    }

    const resolvedImageUrl = await SocialFeedAvatarService.resolveFeedAvatar(
      feed.url,
      feed.siteUrl || '',
      '',
      feed.imageUrl || '',
    )
    const nextImageUrl = resolvedImageUrl || ''
    if (!nextImageUrl || nextImageUrl === (feed.imageUrl || '').trim()) {
      return false
    }

    const feedTitle = feed.title
    const currentDisplayUrl = feed.imageUrl || ''
    const nextDisplayUrl = nextImageUrl
    if (currentDisplayUrl === nextDisplayUrl) {
      return false
    }

    await FeedRepository.update(feedId, {
      title: feed.title,
      url: feed.url,
      siteUrl: feed.siteUrl || '',
      imageUrl: nextImageUrl,
      description: feed.description || '',
      category: feed.category || '',
      view: feed.view,
      showInAll: feed.showInAll,
    })
    bumpFeedsChangedSignal()
    return true
  }

  // Featured entries operations
  static async featuredEntries(candidateLimit: number = 480): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return FeaturedEntriesQuery.featuredEntries(candidateLimit)
  }

  static async featuredEntriesFast(candidateLimit: number = 480): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return FeaturedEntriesQuery.featuredEntriesFast(candidateLimit)
  }

  static async featuredEntriesFastPage(limit: number, offset: number): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return FeaturedEntriesQuery.featuredEntriesFastPage(limit, offset)
  }

  static async featuredEntriesByMode(
    mode: HomeEntryMode,
    candidateLimit: number = 480,
  ): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return FeaturedEntriesQuery.featuredEntriesByMode(mode, candidateLimit)
  }

  static async featuredEntriesFastByMode(
    mode: HomeEntryMode,
    candidateLimit: number = 480,
  ): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return FeaturedEntriesQuery.featuredEntriesFastByMode(mode, candidateLimit)
  }

  static async featuredEntriesFastPageByMode(
    mode: HomeEntryMode,
    limit: number,
    offset: number,
  ): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return FeaturedEntriesQuery.featuredEntriesFastPageByMode(mode, limit, offset)
  }

  static async starredEntries(): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const entries = await EntryRepository.listStarred(100)
    const feeds = await FeedRepository.list()
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    return buildEntryCardsChunked(entries, (entry: Entry) => feedMap.get(entry.feedId))
  }

  // Entry operations
  static async entryEntitiesByFeed(feedId: string): Promise<Entry[]> {
    await AppRepository.bootstrap()
    return EntryRepository.listByFeed(feedId)
  }

  static async entriesByFeed(feedId: string): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const entriesPromise = EntryRepository.listByFeed(feedId)
    const feedPromise = FeedRepository.getById(feedId)
    const entries = await entriesPromise
    const feed = await feedPromise
    return buildEntryCardsChunked(entries, (_entry: Entry) => feed)
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

  static async markRead(entryId: string, isRead: boolean): Promise<void> {
    await AppRepository.bootstrap()
    await EntryRepository.markRead(entryId, isRead)
  }

  static async toggleStar(entryId: string): Promise<void> {
    await AppRepository.bootstrap()
    await EntryRepository.toggleStar(entryId)
  }

  // Account operations
  static async accountStatus(provider: AccountProvider): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.status(provider)
  }

  static async linkAccount(provider: AccountProvider): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.link(provider)
  }

  static accountLoginUrl(provider: AccountProvider): string {
    return AccountSessionService.loginUrl(provider)
  }

  static async unlinkAccount(provider: AccountProvider): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.unlink(provider)
  }

  static async setAccountDisplayName(provider: AccountProvider, displayName: string): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.setDisplayName(provider, displayName)
  }

  static async bilibiliSessData(): Promise<string> {
    await AppRepository.bootstrap()
    return AccountSessionService.bilibiliSessData()
  }

  static async setBilibiliSessData(sessdata: string): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.setBilibiliSessData(sessdata)
  }

  static async setBilibiliVerifiedLink(displayName: string, sessdata?: string): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.setBilibiliVerifiedLink(displayName, sessdata)
  }

  static async setVerifiedAccountLink(provider: AccountProvider, displayName: string): Promise<AccountStatusResult> {
    await AppRepository.bootstrap()
    return AccountSessionService.setVerifiedLink(provider, displayName)
  }

  // Bilibili operations
  static async previewBilibiliFollowings(): Promise<PendingBilibiliCreator[]> {
    await AppRepository.bootstrap()
    return BilibiliFollowingsService.preview()
  }

  static async importBilibiliFollowings(
    creators: PendingBilibiliCreator[],
    views: FeedViewType[],
    onProgress: (progress: BilibiliImportProgress) => void,
  ): Promise<void> {
    await AppRepository.bootstrap()
    await BilibiliFollowingsService.importCreators(creators, views, onProgress)
  }

  // Settings operations
  static async settings(): Promise<HarmonySettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadSettings()
  }

  static async aiSettings(): Promise<AIAssistantSettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadAISettings()
  }

  static async persistSettings(next: HarmonySettings): Promise<HarmonySettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.saveSettings(next)
  }

  static async persistAISettings(next: AIAssistantSettings): Promise<AIAssistantSettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.saveAISettings(next)
  }

  static async refreshLogs(): Promise<RefreshLogEntry[]> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadRefreshLogs()
  }

  static async clearRefreshLogs(): Promise<void> {
    await AppRepository.bootstrap()
    await AppPreferenceService.clearRefreshLogs()
  }

  static async homeEntrySnapshot(): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadHomeEntrySnapshot()
  }

  static async persistHomeEntrySnapshot(entries: EntryCardModel[]): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return AppPreferenceService.saveHomeEntrySnapshot(entries)
  }

  // Feed management operations
  static async createFeed(draft: FeedDraft): Promise<FeedCardModel> {
    await AppRepository.bootstrap()
    try {
      const feed = await FeedRepository.create(draft)
      return toFeedCardModel(await feedWithCount(feed))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      if (message.includes('constraint violation')) {
        const existing = await FeedRepository.getByUrl(draft.url)
        if (existing) {
          return toFeedCardModel(await feedWithCount(existing))
        }
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  static async feedEntityByUrl(url: string): Promise<Feed | undefined> {
    await AppRepository.bootstrap()
    return FeedRepository.getByUrl(url)
  }

  static async feedEntityBySiteUrl(siteUrl: string): Promise<Feed | undefined> {
    await AppRepository.bootstrap()
    return FeedRepository.getBySiteUrl(siteUrl)
  }

  static async updateFeed(feedId: string, draft: FeedDraft): Promise<FeedCardModel> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.update(feedId, draft)
    return toFeedCardModel(await feedWithCount(feed))
  }

  static async removeFeed(feedId: string): Promise<void> {
    await AppRepository.bootstrap()
    await FeedRepository.remove(feedId)
    await AppPreferenceService.removeHomeEntrySnapshotEntriesByFeedId(feedId)
    bumpFeedsChangedSignal()
  }

  // Feed refresh operations
  static async refreshFeed(
    feedId: string,
    preferFastImageResolve: boolean = false,
    includeEntries: boolean = true,
    includeNewEntryCount: boolean = true,
    notifyFeedsChanged: boolean = true,
  ): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    return FeedRefreshCoordinator.refreshFeed(feedId, preferFastImageResolve, includeEntries, includeNewEntryCount, notifyFeedsChanged)
  }

  static async seedFeedFromPreview(feedId: string, payload: FeedRefreshPayload): Promise<void> {
    await AppRepository.bootstrap()
    return FeedRefreshCoordinator.seedFeedFromPreview(feedId, payload)
  }

  static async refreshAllFeeds(
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    return FeedRefreshCoordinator.refreshAllFeeds(onProgress)
  }
}

export { AppRepository }
