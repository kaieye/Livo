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
  FeedWithCount,
  PendingBilibiliCreator,
  RefreshLogEntry,
  FeedViewType,
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
import { AccountSessionService } from '../services/AccountSessionService'
import { BilibiliFollowingsService } from '../services/BilibiliFollowingsService'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { ThemeService } from '../services/ThemeService'
import { canonicalFeedUrl, normalizeSocialFeedDescription, normalizeSocialFeedTitle } from '../utils/SocialFeedTitles'
import {
  resolveSocialFeedDisplayDescription,
  resolveSocialFeedDisplayImageUrl,
  resolveSocialFeedDisplayTitle,
  resolvePreferredStoredFeedImageUrl,
  resolvePreferredStoredFeedTitle,
} from '../utils/SocialFeedPresentation'
import { rekeyPreviewEntries } from '../utils/PreviewFeedSeed'

function compactEntryCards(items: Array<EntryCardModel | undefined>): EntryCardModel[] {
  const result: EntryCardModel[] = []

  items.forEach((item: EntryCardModel | undefined) => {
    if (item) {
      result.push(item)
    }
  })

  return result
}

const HOME_ENTRY_CANDIDATE_LIMIT: number = 400

async function feedWithCount(feed: Feed): Promise<FeedWithCount> {
  const unreadCount = await EntryRepository.countUnreadByFeed(feed.id)
  const displayTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  const displayDescription = resolveSocialFeedDisplayDescription(feed.description || '', feed.url, feed.siteUrl || '')
  const displayImageUrl = resolveSocialFeedDisplayImageUrl(feed.imageUrl || '', feed.url, feed.siteUrl || '', displayTitle)
  return {
    id: feed.id,
    title: displayTitle,
    url: feed.url,
    siteUrl: feed.siteUrl,
    imageUrl: displayImageUrl,
    description: displayDescription,
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

  const displayTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  const displayDescription = resolveSocialFeedDisplayDescription(feed.description || '', feed.url, feed.siteUrl || '')
  const displayImageUrl = resolveSocialFeedDisplayImageUrl(feed.imageUrl || '', feed.url, feed.siteUrl || '', displayTitle)
  return toEntryCardModel(entry, {
    id: feed.id,
    title: displayTitle,
    url: feed.url,
    siteUrl: feed.siteUrl,
    imageUrl: displayImageUrl,
    description: displayDescription,
    category: feed.category,
    view: feed.view,
    showInAll: feed.showInAll,
    lastFetched: feed.lastFetched,
    etag: feed.etag,
    lastModified: feed.lastModified,
    errorCount: feed.errorCount,
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt,
  })
}

export class AppRepository {
  private static bootstrapped: boolean = false
  private static seedFeedHydrationStarted: boolean = false
  private static readonly refreshConcurrencyMin: number = 4
  private static readonly refreshConcurrencyMax: number = 8

  private static resolveRefreshConcurrency(totalFeeds: number): number {
    if (totalFeeds >= 24) {
      return AppRepository.refreshConcurrencyMax
    }

    if (totalFeeds >= 12) {
      return 6
    }

    return AppRepository.refreshConcurrencyMin
  }

  private static async refreshFeedsWithPool(
    feeds: Feed[],
    refreshConcurrency: number,
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<PromiseSettledResult<RemoteFeedResult>[]> {
    const results: PromiseSettledResult<RemoteFeedResult>[] = new Array(feeds.length)
    let nextIndex = 0
    let completedCount = 0

    const worker = async (): Promise<void> => {
      while (true) {
        const currentIndex = nextIndex
        nextIndex += 1

        if (currentIndex >= feeds.length) {
          return
        }

        const feed = feeds[currentIndex]
        if (!feed) {
          const rejected: PromiseSettledResult<RemoteFeedResult> = {
            status: 'rejected',
            reason: '订阅源不存在',
          }
          results[currentIndex] = rejected
          completedCount += 1
          onProgress?.(completedCount, feeds.length)
          continue
        }

        try {
          const value = await AppRepository.refreshFeed(feed.id, true)
          const fulfilled: PromiseSettledResult<RemoteFeedResult> = {
            status: 'fulfilled',
            value,
          }
          results[currentIndex] = fulfilled
        } catch (reason) {
          const rejected: PromiseSettledResult<RemoteFeedResult> = {
            status: 'rejected',
            reason,
          }
          results[currentIndex] = rejected
        }

        completedCount += 1
        onProgress?.(completedCount, feeds.length)
      }
    }

    const workerCount = Math.min(refreshConcurrency, feeds.length)
    const workers: Promise<void>[] = []
    for (let index = 0; index < workerCount; index += 1) {
      workers.push(worker())
    }
    await Promise.all(workers)
    return results
  }

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
      void AppRepository.hydrateSeedFeedsOnFirstLaunch(SEED_FEEDS)
    }

    AppRepository.bootstrapped = true
  }

  private static async hydrateSeedFeedsOnFirstLaunch(feeds: Feed[]): Promise<void> {
    if (AppRepository.seedFeedHydrationStarted) {
      return
    }

    AppRepository.seedFeedHydrationStarted = true

    for (const feed of feeds) {
      try {
        const payload = await RssFeedService.fetchFeedEntries(feed)
        const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
        const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
        const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
        const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
        const nextResolvedImageUrl = await SocialFeedAvatarService.resolveFeedAvatar(
          nextUrl,
          nextSiteUrl,
          payload.imageUrl || '',
          feed.imageUrl || '',
        )
        const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)

        await EntryRepository.upsertMany(payload.entries)
        await FeedRepository.updateFetchState(feed.id, {
          url: nextUrl,
          title: nextTitle,
          siteUrl: nextSiteUrl,
          imageUrl: nextImageUrl,
          description: nextDescription,
          lastFetched: Date.now(),
          etag: payload.etag,
          lastModified: payload.lastModified,
          errorCount: 0,
        })
        AppStorage.setOrCreate('feedsChangedAt', Date.now())
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        console.error(`Failed to hydrate built-in feed ${feed.id}: ${message}`)
      }
    }
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

  static async feedEntities(): Promise<Feed[]> {
    await AppRepository.bootstrap()
    return FeedRepository.list()
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
    const entries = await EntryRepository.listRecent(HOME_ENTRY_CANDIDATE_LIMIT)
    const feeds = await FeedRepository.list()
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))

    return compactEntryCards(entries.map((entry: Entry) => entryCardFromEntry(entry, feedMap.get(entry.feedId))))
  }

  static async starredEntries(): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const entries = await EntryRepository.listStarred(100)
    const feeds = await FeedRepository.list()
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))

    return compactEntryCards(entries.map((entry: Entry) => entryCardFromEntry(entry, feedMap.get(entry.feedId))))
  }

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

  static async aiSettings(): Promise<AIAssistantSettings> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadAISettings()
  }

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

  private static async recordRefreshLog(
    successFeedCount: number,
    failedFeedCount: number,
    failedFeedTitles: string[],
  ): Promise<void> {
    const normalizedFailedFeedTitles = failedFeedTitles.filter((title: string) => !!title)
    const entry: RefreshLogEntry = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      refreshedAt: Date.now(),
      successFeedCount: Math.max(0, successFeedCount),
      failedFeedCount: Math.max(0, failedFeedCount),
      failedFeedTitles: normalizedFailedFeedTitles,
    }
    await AppPreferenceService.appendRefreshLog(entry)
  }

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
  }

  static async markRead(entryId: string, isRead: boolean): Promise<void> {
    await AppRepository.bootstrap()
    await EntryRepository.markRead(entryId, isRead)
  }

  static async toggleStar(entryId: string): Promise<void> {
    await AppRepository.bootstrap()
    await EntryRepository.toggleStar(entryId)
  }

  static async refreshFeed(
    feedId: string,
    preferFastImageResolve: boolean = false,
  ): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.getById(feedId)

    if (!feed) {
      throw new Error('订阅源不存在')
    }

    try {
      const existingEntries = await EntryRepository.listByFeed(feedId)
      const existingEntryIds = new Set<string>()
      existingEntries.forEach((entry: Entry) => {
        existingEntryIds.add(entry.id)
      })
      const payload = await RssFeedService.fetchFeedEntries(feed)
      const newEntriesCount = payload.entries.filter((entry: Entry) => !existingEntryIds.has(entry.id)).length
      const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
      const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
      const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
      const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
      const nextResolvedImageUrl = preferFastImageResolve
        ? (payload.imageUrl || feed.imageUrl || '')
        : await SocialFeedAvatarService.resolveFeedAvatar(
          nextUrl,
          nextSiteUrl,
          payload.imageUrl || '',
          feed.imageUrl || '',
        )
      const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)
      await EntryRepository.upsertMany(payload.entries)
      await FeedRepository.updateFetchState(feedId, {
        url: nextUrl,
        title: nextTitle,
        siteUrl: nextSiteUrl,
        imageUrl: nextImageUrl,
        description: nextDescription,
        lastFetched: Date.now(),
        etag: payload.etag,
        lastModified: payload.lastModified,
        errorCount: 0,
      })
      const result: RemoteFeedResult = {
        entries: await AppRepository.entriesByFeed(feedId),
        sourceLabel: `${feed.title} · 新增 ${newEntriesCount} 条`,
        newEntriesCount,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      await FeedRepository.updateFetchState(feedId, {
        lastFetched: feed.lastFetched ?? 0,
        etag: feed.etag ?? '',
        lastModified: feed.lastModified ?? '',
        errorCount: (feed.errorCount ?? 0) + 1,
        imageUrl: feed.imageUrl ?? '',
      })
      const result: RemoteFeedResult = {
        entries: await AppRepository.entriesByFeed(feedId),
        sourceLabel: `${feed.title} · 刷新失败：${message}`,
        newEntriesCount: 0,
        failedFeedCount: 1,
        failedFeedLabels: [feed.title],
        failedFeedDetails: [`${feed.title}：${message}`],
        fallbackUsed: true,
      }
      return result
    }
  }

  static async seedFeedFromPreview(feedId: string, payload: FeedRefreshPayload): Promise<void> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.getById(feedId)

    if (!feed) {
      throw new Error('订阅源不存在')
    }

    const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
    const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
    const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
    const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
    const nextResolvedImageUrl = await SocialFeedAvatarService.resolveFeedAvatar(
      nextUrl,
      nextSiteUrl,
      payload.imageUrl || '',
      feed.imageUrl || '',
    )
    const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)
    await EntryRepository.removeByFeed(feedId)
    await EntryRepository.upsertMany(rekeyPreviewEntries(feedId, payload.entries))
    await FeedRepository.updateFetchState(feedId, {
      url: nextUrl,
      title: nextTitle,
      siteUrl: nextSiteUrl,
      imageUrl: nextImageUrl,
      description: nextDescription,
      lastFetched: Date.now(),
      etag: payload.etag,
      lastModified: payload.lastModified,
      errorCount: 0,
    })
  }

  static async refreshAllFeeds(
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    const feeds = await FeedRepository.list()
    if (feeds.length === 0) {
      await AppRepository.recordRefreshLog(0, 0, [])
      return {
        entries: [],
        sourceLabel: '暂无可刷新的订阅源',
        newEntriesCount: 0,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    }
    let refreshedCount = 0
    let failedCount = 0
    let newEntriesCount = 0
    const failedFeedLabels: string[] = []
    const failedFeedDetails: string[] = []
    const refreshConcurrency = AppRepository.resolveRefreshConcurrency(feeds.length)
    onProgress?.(0, feeds.length)
    const results = await AppRepository.refreshFeedsWithPool(
      feeds,
      refreshConcurrency,
      onProgress,
    )

    results.forEach((result: PromiseSettledResult<RemoteFeedResult>, index: number) => {
      if (result.status === 'fulfilled') {
        newEntriesCount += result.value.newEntriesCount ?? 0
        if (result.value.fallbackUsed) {
          failedCount += 1
          ;(result.value.failedFeedLabels ?? []).forEach((label: string) => {
            if (label && !failedFeedLabels.includes(label)) {
              failedFeedLabels.push(label)
            }
          })
          ;(result.value.failedFeedDetails ?? []).forEach((detail: string) => {
            if (detail) {
              failedFeedDetails.push(detail)
            }
          })
        } else {
          refreshedCount += 1
        }
        return
      }

      failedCount += 1
      const failedFeed = feeds[index]
      if (failedFeed && !failedFeedLabels.includes(failedFeed.title)) {
        failedFeedLabels.push(failedFeed.title)
      }
      failedFeedDetails.push(`${failedFeed?.title || '未知订阅源'}：${result.reason}`)
      console.error(`Failed to refresh feed in aggregate refresh: ${result.reason}`)
    })

    if (failedCount > feeds.length) {
      failedCount = feeds.length
    }

    if (failedFeedDetails.length > 0) {
      console.error(`[AppRepository] Aggregate refresh failed feeds: ${failedFeedDetails.join(' | ')}`)
    }

    const failedFeedSummary = failedFeedLabels.slice(0, 3).join('、')
    const failedFeedSuffix = failedFeedSummary
      ? `：${failedFeedSummary}${failedFeedLabels.length > 3 ? ' 等' : ''}`
      : ''

    await AppRepository.recordRefreshLog(refreshedCount, failedCount, failedFeedLabels)

    return {
      entries: await AppRepository.featuredEntries(),
      sourceLabel: `新增 ${newEntriesCount} 条，${failedCount} 个订阅源刷新失败${failedFeedSuffix}`,
      newEntriesCount,
      failedFeedCount: failedCount,
      failedFeedLabels,
      failedFeedDetails,
      fallbackUsed: failedCount > 0,
    } as RemoteFeedResult
  }
}
