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
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'

function compactEntryCards(items: Array<EntryCardModel | undefined>): EntryCardModel[] {
  const result: EntryCardModel[] = []

  items.forEach((item: EntryCardModel | undefined) => {
    if (item) {
      result.push(item)
    }
  })

  return result
}

const HOME_ENTRY_CANDIDATE_LIMIT: number = 480
const HOME_ENTRY_BALANCED_POOL_MULTIPLIER: number = 6
const HOME_ENTRY_BALANCED_POOL_MAX: number = 6000
const HOME_ENTRY_BALANCED_MAX_ATTEMPTS: number = 4
const ENTRY_CARD_YIELD_BATCH_SIZE: number = 12
const HOME_FEED_DEBUG_ENABLED: boolean = false
const HOME_FEED_DEBUG_PREFIX: string = '[FeedFetchStateDebug][HomeFeed]'

export type HomeEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

interface HomeEntryModeStats {
  articles: number
  social: number
  pictures: number
  videos: number
}

interface HomeEntryModeGroups {
  articles: EntryCardModel[]
  social: EntryCardModel[]
  pictures: EntryCardModel[]
  videos: EntryCardModel[]
}

const HOME_ENTRY_MODE_ORDER: HomeEntryMode[] = ['articles', 'social', 'pictures', 'videos']

function yieldToUiLoop(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 0)
  })
}

async function buildEntryCardsChunked(
  entries: Entry[],
  resolveFeed: (entry: Entry) => Feed | undefined,
): Promise<EntryCardModel[]> {
  const cards: EntryCardModel[] = []

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (!entry) {
      continue
    }

    const card = entryCardFromEntry(entry, resolveFeed(entry))
    if (card) {
      cards.push(card)
    }

    if ((index + 1) % ENTRY_CARD_YIELD_BATCH_SIZE === 0) {
      await yieldToUiLoop()
    }
  }

  return cards
}

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

function feedCardFromFeed(feed: Feed, unreadCount: number = 0): FeedCardModel {
  return toFeedCardModel({
    id: feed.id,
    title: feed.title,
    url: feed.url,
    siteUrl: feed.siteUrl,
    imageUrl: feed.imageUrl,
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
  })
}

function sortFeedsStable(feeds: Feed[]): Feed[] {
  return [...feeds].sort((left: Feed, right: Feed) => {
    const leftCreatedAt = left.createdAt || 0
    const rightCreatedAt = right.createdAt || 0
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt
    }

    return left.id.localeCompare(right.id)
  })
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

function createHomeEntryModeStats(): HomeEntryModeStats {
  return {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
}

function homeEntryModeStatsSummary(stats: HomeEntryModeStats): string {
  return `articles=${stats.articles} social=${stats.social} pictures=${stats.pictures} videos=${stats.videos}`
}

function logHomeFeedDebug(message: string): void {
  if (!HOME_FEED_DEBUG_ENABLED) {
    return
  }

  console.info(`${HOME_FEED_DEBUG_PREFIX} ${message}`)
}

function modeOfFeedView(view: FeedViewType): HomeEntryMode {
  switch (view) {
    case FeedViewType.SocialMedia:
      return 'social'
    case FeedViewType.Pictures:
      return 'pictures'
    case FeedViewType.Videos:
      return 'videos'
    default:
      return 'articles'
  }
}

function modeMatchesFeedView(mode: HomeEntryMode, view: FeedViewType): boolean {
  return modeOfFeedView(view) === mode
}

function modeOfEntryCard(card: EntryCardModel): HomeEntryMode {
  switch (card.viewLabel) {
    case '社交':
      return 'social'
    case '图片':
      return 'pictures'
    case '视频':
      return 'videos'
    default:
      return 'articles'
  }
}

function countHomeEntryModes(entries: EntryCardModel[]): HomeEntryModeStats {
  let articles = 0
  let social = 0
  let pictures = 0
  let videos = 0

  entries.forEach((entry: EntryCardModel) => {
    switch (modeOfEntryCard(entry)) {
      case 'social':
        social += 1
        break
      case 'pictures':
        pictures += 1
        break
      case 'videos':
        videos += 1
        break
      default:
        articles += 1
        break
    }
  })

  return {
    articles,
    social,
    pictures,
    videos,
  }
}

function resolveFeedModePresence(feeds: Feed[]): HomeEntryModeStats {
  let articles = 0
  let social = 0
  let pictures = 0
  let videos = 0

  feeds.forEach((feed: Feed) => {
    switch (modeOfFeedView(feed.view)) {
      case 'social':
        social += 1
        break
      case 'pictures':
        pictures += 1
        break
      case 'videos':
        videos += 1
        break
      default:
        articles += 1
        break
    }
  })

  return {
    articles,
    social,
    pictures,
    videos,
  }
}

function modeStatsValue(stats: HomeEntryModeStats, mode: HomeEntryMode): number {
  switch (mode) {
    case 'social':
      return stats.social
    case 'pictures':
      return stats.pictures
    case 'videos':
      return stats.videos
    default:
      return stats.articles
  }
}

function modeGroupEntries(groups: HomeEntryModeGroups, mode: HomeEntryMode): EntryCardModel[] {
  switch (mode) {
    case 'social':
      return groups.social
    case 'pictures':
      return groups.pictures
    case 'videos':
      return groups.videos
    default:
      return groups.articles
  }
}

function hasModeCoverageGap(
  entryModeStats: HomeEntryModeStats,
  feedModePresence: HomeEntryModeStats,
  perModeTarget: number,
): boolean {
  for (const mode of HOME_ENTRY_MODE_ORDER) {
    if (modeStatsValue(feedModePresence, mode) <= 0) {
      continue
    }

    if (modeStatsValue(entryModeStats, mode) < perModeTarget) {
      return true
    }
  }

  return false
}

function uniqueEntryCardKey(entry: EntryCardModel): string {
  return `${entry.id}|${entry.feedId}|${entry.articleUrl}`
}

function selectBalancedHomeEntries(
  entries: EntryCardModel[],
  candidateLimit: number,
): EntryCardModel[] {
  if (entries.length <= candidateLimit) {
    return entries
  }

  const grouped: HomeEntryModeGroups = {
    articles: [],
    social: [],
    pictures: [],
    videos: [],
  }
  entries.forEach((entry: EntryCardModel) => {
    switch (modeOfEntryCard(entry)) {
      case 'social':
        grouped.social.push(entry)
        break
      case 'pictures':
        grouped.pictures.push(entry)
        break
      case 'videos':
        grouped.videos.push(entry)
        break
      default:
        grouped.articles.push(entry)
        break
    }
  })

  const selected: EntryCardModel[] = []
  const selectedKeys = new Set<string>()
  const pushSelected = (entry: EntryCardModel): boolean => {
    const key = uniqueEntryCardKey(entry)
    if (selectedKeys.has(key)) {
      return false
    }

    selectedKeys.add(key)
    selected.push(entry)
    return true
  }

  const perModeTarget = Math.max(1, Math.floor(candidateLimit / HOME_ENTRY_MODE_ORDER.length))
  HOME_ENTRY_MODE_ORDER.forEach((mode: HomeEntryMode) => {
    if (selected.length >= candidateLimit) {
      return
    }

    let modeAdded = 0
    modeGroupEntries(grouped, mode).forEach((entry: EntryCardModel) => {
      if (selected.length >= candidateLimit || modeAdded >= perModeTarget) {
        return
      }

      if (pushSelected(entry)) {
        modeAdded += 1
      }
    })
  })

  if (selected.length < candidateLimit) {
    entries.forEach((entry: EntryCardModel) => {
      if (selected.length >= candidateLimit) {
        return
      }

      pushSelected(entry)
    })
  }

  const sorted = [...selected]
  sorted.sort((left: EntryCardModel, right: EntryCardModel) => {
    return (right.publishedAt || 0) - (left.publishedAt || 0)
  })
  return sorted
}

export class AppRepository {
  private static bootstrapped: boolean = false
  private static seedFeedHydrationStarted: boolean = false
  private static feedMetadataRepairStarted: boolean = false
  private static readonly successfulRefreshCooldownMs: number = 3 * 60 * 1000
  private static readonly refreshConcurrency: number = 12

  private static async repairFeedMetadataInBackground(): Promise<void> {
    if (AppRepository.feedMetadataRepairStarted) {
      return
    }

    AppRepository.feedMetadataRepairStarted = true

    try {
      const feeds = sortFeedsStable(await FeedRepository.list())
      let repaired = false

      for (const feed of feeds) {
        const fallbackTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
        const shouldRepairTitle = !(feed.title || '').trim() && !!fallbackTitle

        if (!shouldRepairTitle) {
          continue
        }

        await FeedRepository.update(feed.id, {
          title: shouldRepairTitle ? fallbackTitle : feed.title,
          url: feed.url,
          siteUrl: feed.siteUrl || '',
          imageUrl: feed.imageUrl || '',
          description: feed.description || '',
          category: feed.category || '',
          view: feed.view,
          showInAll: feed.showInAll,
        })
        repaired = true
      }

      if (repaired) {
        bumpFeedsChangedSignal()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`repair feed metadata failed: ${message}`)
    }
  }

  private static isFeedRefreshInCooldown(feed: Feed, now: number = Date.now()): boolean {
    const lastFetched = feed.lastFetched ?? 0
    if (lastFetched <= 0) {
      return false
    }

    return now - lastFetched < AppRepository.successfulRefreshCooldownMs
  }

  private static resolveRefreshConcurrency(totalFeeds: number): number {
    if (totalFeeds <= 0) {
      return 1
    }
    return AppRepository.refreshConcurrency
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
          const value = await AppRepository.refreshFeed(feed.id, true, false, false, false)
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
    void AppRepository.repairFeedMetadataInBackground()
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
        bumpFeedsChangedSignal()
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
    const feeds = sortFeedsStable(await FeedRepository.list())
    const cards: FeedCardModel[] = []

    for (const feed of feeds) {
      cards.push(toFeedCardModel(await feedWithCount(feed)))
    }

    return cards
  }

  static async feedsFast(): Promise<FeedCardModel[]> {
    await AppRepository.bootstrap()
    const feeds = sortFeedsStable(await FeedRepository.list())
    return feeds.map((feed: Feed) => feedCardFromFeed(feed))
  }

  static async feedEntities(): Promise<Feed[]> {
    await AppRepository.bootstrap()
    return sortFeedsStable(await FeedRepository.list())
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
    // 使用评分比较，避免用低质量的 unavatar.io 代理 URL 覆盖已存储的真实头像 URL
    const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', (resolvedImageUrl || '').trim())
    if (!nextImageUrl || nextImageUrl === (feed.imageUrl || '').trim()) {
      return false
    }

    // 如果新 URL 与当前展示效果等价（iconSource 会推断出相同结果），则无需写库，避免触发不必要的刷新
    const feedTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
    const currentDisplayUrl = resolveSocialFeedDisplayImageUrl(feed.imageUrl || '', feed.url, feed.siteUrl || '', feedTitle)
    const nextDisplayUrl = resolveSocialFeedDisplayImageUrl(nextImageUrl, feed.url, feed.siteUrl || '', feedTitle)
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

  static async featuredEntries(candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(1, candidateLimit)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    const feedModePresence = resolveFeedModePresence(feeds)
    const perModeTarget = Math.max(1, Math.floor(safeCandidateLimit / HOME_ENTRY_MODE_ORDER.length))
    logHomeFeedDebug(
      `featuredEntries start candidateLimit=${safeCandidateLimit} feeds=${feeds.length} `
      + `feedModes=${homeEntryModeStatsSummary(feedModePresence)} perModeTarget=${perModeTarget}`,
    )

    let poolLimit = Math.min(
      HOME_ENTRY_BALANCED_POOL_MAX,
      Math.max(safeCandidateLimit, safeCandidateLimit * HOME_ENTRY_BALANCED_POOL_MULTIPLIER),
    )
    let selectedEntries: EntryCardModel[] = []

    for (let attempt = 0; attempt < HOME_ENTRY_BALANCED_MAX_ATTEMPTS; attempt += 1) {
      const entries = await EntryRepository.listRecent(poolLimit)
      const cards = await buildEntryCardsChunked(entries, (entry: Entry) => feedMap.get(entry.feedId))
      selectedEntries = selectBalancedHomeEntries(cards, safeCandidateLimit)
      const modeStats = countHomeEntryModes(selectedEntries)
      const reachedOldestEntry = entries.length < poolLimit
      const hasGap = hasModeCoverageGap(modeStats, feedModePresence, perModeTarget)
      logHomeFeedDebug(
        `featuredEntries attempt=${attempt + 1} poolLimit=${poolLimit} recent=${entries.length} cards=${cards.length} `
        + `selected=${selectedEntries.length} selectedModes=${homeEntryModeStatsSummary(modeStats)} `
        + `hasGap=${hasGap} reachedOldest=${reachedOldestEntry}`,
      )

      if (!hasGap || reachedOldestEntry) {
        logHomeFeedDebug(
          `featuredEntries return attempt=${attempt + 1} elapsedMs=${Date.now() - startedAt}`,
        )
        return selectedEntries
      }

      if (poolLimit >= HOME_ENTRY_BALANCED_POOL_MAX) {
        logHomeFeedDebug(
          `featuredEntries hitPoolMax selected=${selectedEntries.length} elapsedMs=${Date.now() - startedAt}`,
        )
        return selectedEntries
      }

      poolLimit = Math.min(HOME_ENTRY_BALANCED_POOL_MAX, poolLimit * 2)
    }

    logHomeFeedDebug(
      `featuredEntries exhaustedAttempts selected=${selectedEntries.length} elapsedMs=${Date.now() - startedAt}`,
    )

    return selectedEntries
  }

  static async featuredEntriesFast(candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(1, candidateLimit)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))

    const entries = await EntryRepository.listRecent(safeCandidateLimit)
    const cards = await buildEntryCardsChunked(entries, (entry: Entry) => feedMap.get(entry.feedId))
    logHomeFeedDebug(
      `featuredEntriesFast limit=${safeCandidateLimit} recent=${entries.length} cards=${cards.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return cards
  }

  static async featuredEntriesFastPage(limit: number, offset: number): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const startedAt = Date.now()
    const safeLimit = Math.max(1, limit)
    const safeOffset = Math.max(0, offset)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))

    const entries = await EntryRepository.listRecentPage(safeLimit, safeOffset)
    const cards = await buildEntryCardsChunked(entries, (entry: Entry) => feedMap.get(entry.feedId))
    logHomeFeedDebug(
      `featuredEntriesFastPage limit=${safeLimit} offset=${safeOffset} recent=${entries.length} cards=${cards.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return cards
  }

  static async featuredEntriesByMode(
    mode: HomeEntryMode,
    candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT,
  ): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(1, candidateLimit)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    const allowedFeedIds = new Set<string>()
    feeds.forEach((feed: Feed) => {
      feedMap.set(feed.id, feed)
      if (modeMatchesFeedView(mode, feed.view)) {
        allowedFeedIds.add(feed.id)
      }
    })

    if (allowedFeedIds.size === 0) {
      return []
    }

    const result: EntryCardModel[] = []
    const seen = new Set<string>()
    const pageSize = Math.max(180, Math.min(1800, safeCandidateLimit * 3))
    let offset = 0
    while (result.length < safeCandidateLimit) {
      const page = await EntryRepository.listRecentPage(pageSize, offset)
      if (page.length === 0) {
        break
      }

      const scopedEntries = page.filter((entry: Entry) => allowedFeedIds.has(entry.feedId))
      const cards = await buildEntryCardsChunked(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
      cards.forEach((card: EntryCardModel) => {
        if (result.length >= safeCandidateLimit) {
          return
        }
        const key = uniqueEntryCardKey(card)
        if (seen.has(key)) {
          return
        }
        seen.add(key)
        result.push(card)
      })

      if (page.length < pageSize) {
        break
      }
      offset += pageSize
    }

    logHomeFeedDebug(
      `featuredEntriesByMode mode=${mode} limit=${safeCandidateLimit} result=${result.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return result
  }

  static async featuredEntriesFastByMode(
    mode: HomeEntryMode,
    candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT,
  ): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(1, candidateLimit)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    const allowedFeedIds = new Set<string>()
    feeds.forEach((feed: Feed) => {
      feedMap.set(feed.id, feed)
      if (modeMatchesFeedView(mode, feed.view)) {
        allowedFeedIds.add(feed.id)
      }
    })

    if (allowedFeedIds.size === 0) {
      return []
    }

    const pageSize = Math.max(60, Math.min(360, safeCandidateLimit * 2))
    const entries = await EntryRepository.listRecentPage(pageSize, 0)
    const scopedEntries = entries.filter((entry: Entry) => allowedFeedIds.has(entry.feedId))
    const cards = await buildEntryCardsChunked(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))

    logHomeFeedDebug(
      `featuredEntriesFastByMode mode=${mode} limit=${safeCandidateLimit} recent=${entries.length} ` +
      `scoped=${scopedEntries.length} cards=${cards.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return cards.slice(0, safeCandidateLimit)
  }

  static async featuredEntriesFastPageByMode(
    mode: HomeEntryMode,
    limit: number,
    offset: number,
  ): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const startedAt = Date.now()
    const safeLimit = Math.max(1, limit)
    const safeOffset = Math.max(0, offset)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    const allowedFeedIds = new Set<string>()
    feeds.forEach((feed: Feed) => {
      feedMap.set(feed.id, feed)
      if (modeMatchesFeedView(mode, feed.view)) {
        allowedFeedIds.add(feed.id)
      }
    })

    if (allowedFeedIds.size === 0) {
      return []
    }

    const result: EntryCardModel[] = []
    const seen = new Set<string>()
    const targetVisibleCount = safeOffset + safeLimit
    const pageSize = Math.max(180, Math.min(1800, targetVisibleCount * 3))
    let repositoryOffset = 0
    let skippedVisibleCount = 0

    while (result.length < safeLimit) {
      const page = await EntryRepository.listRecentPage(pageSize, repositoryOffset)
      if (page.length === 0) {
        break
      }

      const scopedEntries = page.filter((entry: Entry) => allowedFeedIds.has(entry.feedId))
      const cards = await buildEntryCardsChunked(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
      cards.forEach((card: EntryCardModel) => {
        const key = uniqueEntryCardKey(card)
        if (seen.has(key)) {
          return
        }
        seen.add(key)
        if (skippedVisibleCount < safeOffset) {
          skippedVisibleCount += 1
          return
        }
        if (result.length >= safeLimit) {
          return
        }
        result.push(card)
      })

      if (page.length < pageSize) {
        break
      }
      repositoryOffset += pageSize
    }

    logHomeFeedDebug(
      `featuredEntriesFastPageByMode mode=${mode} limit=${safeLimit} offset=${safeOffset} result=${result.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return result
  }

  static async starredEntries(): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    const entries = await EntryRepository.listStarred(100)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))

    return buildEntryCardsChunked(entries, (entry: Entry) => feedMap.get(entry.feedId))
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

  static async homeEntrySnapshot(): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return AppPreferenceService.loadHomeEntrySnapshot()
  }

  static async persistHomeEntrySnapshot(entries: EntryCardModel[]): Promise<EntryCardModel[]> {
    await AppRepository.bootstrap()
    return AppPreferenceService.saveHomeEntrySnapshot(entries)
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
    await AppPreferenceService.removeHomeEntrySnapshotEntriesByFeedId(feedId)
    bumpFeedsChangedSignal()
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
    includeEntries: boolean = true,
    includeNewEntryCount: boolean = true,
    notifyFeedsChanged: boolean = true,
  ): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    const feed = await FeedRepository.getById(feedId)

    if (!feed) {
      throw new Error('订阅源不存在')
    }

    if (AppRepository.isFeedRefreshInCooldown(feed)) {
      return {
        entries: includeEntries ? await AppRepository.entriesByFeed(feedId) : [],
        sourceLabel: `${feed.title} · 3 分钟内已刷新，跳过`,
        newEntriesCount: 0,
        skippedByCooldown: true,
        skippedFeedCount: 1,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    }

    try {
      const payload = await RssFeedService.fetchFeedEntries(feed)
      let newEntriesCount = 0
      if (includeNewEntryCount) {
        const existingEntries = await EntryRepository.listByFeed(feedId)
        const existingEntryIds = new Set<string>()
        existingEntries.forEach((entry: Entry) => {
          existingEntryIds.add(entry.id)
        })
        newEntriesCount = payload.entries.filter((entry: Entry) => !existingEntryIds.has(entry.id)).length
      }
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
        entries: includeEntries ? await AppRepository.entriesByFeed(feedId) : [],
        sourceLabel: includeNewEntryCount
          ? `${feed.title} · 新增 ${newEntriesCount} 条`
          : `${feed.title} · 已刷新`,
        newEntriesCount,
        skippedByCooldown: false,
        skippedFeedCount: 0,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
      if (notifyFeedsChanged) {
        bumpFeedsChangedSignal()
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
        entries: includeEntries ? await AppRepository.entriesByFeed(feedId) : [],
        sourceLabel: `${feed.title} · 刷新失败：${message}`,
        newEntriesCount: 0,
        skippedByCooldown: false,
        skippedFeedCount: 0,
        failedFeedCount: 1,
        failedFeedLabels: [feed.title],
        failedFeedDetails: [`${feed.title}：${message}`],
        fallbackUsed: true,
      }
      if (notifyFeedsChanged) {
        bumpFeedsChangedSignal()
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
    const normalizedPreviewEntries = rekeyPreviewEntries(feedId, payload.entries)
    const existingEntries = await EntryRepository.listByFeed(feedId)
    const shouldReplaceExistingEntries = existingEntries.length === 0
      || normalizedPreviewEntries.length >= existingEntries.length
    logHomeFeedDebug(
      `seedFeedFromPreview feedId=${feedId} previewEntries=${normalizedPreviewEntries.length} `
      + `existingEntries=${existingEntries.length} replace=${shouldReplaceExistingEntries} `
      + `payloadFeedTitleLen=${(payload.feedTitle || '').trim().length}`,
    )

    if (shouldReplaceExistingEntries) {
      await EntryRepository.removeByFeed(feedId)
    }
    await EntryRepository.upsertMany(normalizedPreviewEntries)
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
    logHomeFeedDebug(
      `seedFeedFromPreview updated feedId=${feedId} nextTitleLen=${nextTitle.trim().length} `
      + `nextUrl=${nextUrl} nextSiteUrl=${nextSiteUrl}`,
    )
  }

  static async refreshAllFeeds(
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<RemoteFeedResult> {
    await AppRepository.bootstrap()
    const feeds = sortFeedsStable(await FeedRepository.list())
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
    const refreshStartedAt = Date.now()
    const pendingFeeds: Feed[] = []
    feeds.forEach((feed: Feed) => {
      if (AppRepository.isFeedRefreshInCooldown(feed, refreshStartedAt)) {
        return
      }
      pendingFeeds.push(feed)
    })

    let skippedByCooldownCount = Math.max(0, feeds.length - pendingFeeds.length)
    let newEntriesCount = 0
    const failedFeedLabels: string[] = []
    const failedFeedDetails: string[] = []

    if (HOME_FEED_DEBUG_ENABLED) {
      const totalModes = resolveFeedModePresence(feeds)
      const pendingModes = resolveFeedModePresence(pendingFeeds)
      logHomeFeedDebug(
        `refreshAllFeeds start totalFeeds=${feeds.length} pending=${pendingFeeds.length} `
        + `skippedByCooldown=${skippedByCooldownCount} `
        + `totalModes=${homeEntryModeStatsSummary(totalModes)} `
        + `pendingModes=${homeEntryModeStatsSummary(pendingModes)}`,
      )
    }

    onProgress?.(0, feeds.length)

    if (pendingFeeds.length === 0) {
      await AppRepository.recordRefreshLog(0, 0, [])
      return {
        entries: [],
        sourceLabel: '全部订阅源 3 分钟内已刷新，已跳过重复抓取',
        newEntriesCount: 0,
        skippedByCooldown: true,
        skippedFeedCount: skippedByCooldownCount,
        allSkippedByCooldown: true,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    }

    const refreshConcurrency = AppRepository.resolveRefreshConcurrency(pendingFeeds.length)
    if (skippedByCooldownCount > 0) {
      onProgress?.(skippedByCooldownCount, feeds.length)
    }

    const results = await AppRepository.refreshFeedsWithPool(
      pendingFeeds,
      refreshConcurrency,
      (completedCount: number, totalCount: number) => {
        const normalizedCompleted = skippedByCooldownCount + completedCount
        onProgress?.(normalizedCompleted, skippedByCooldownCount + totalCount)
      },
    )

    results.forEach((result: PromiseSettledResult<RemoteFeedResult>, index: number) => {
      if (result.status === 'fulfilled') {
        newEntriesCount += result.value.newEntriesCount ?? 0
        if (result.value.skippedByCooldown) {
          skippedByCooldownCount += Math.max(1, result.value.skippedFeedCount ?? 1)
          return
        }

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
      const failedFeed = pendingFeeds[index]
      if (failedFeed && !failedFeedLabels.includes(failedFeed.title)) {
        failedFeedLabels.push(failedFeed.title)
      }
      failedFeedDetails.push(`${failedFeed?.title || '未知订阅源'}：${result.reason}`)
      console.error(`Failed to refresh feed in aggregate refresh: ${result.reason}`)
    })

    if (failedCount > pendingFeeds.length) {
      failedCount = pendingFeeds.length
    }

    if (failedFeedDetails.length > 0) {
      console.error(`[AppRepository] Aggregate refresh failed feeds: ${failedFeedDetails.join(' | ')}`)
    }

    const failedFeedSummary = failedFeedLabels.slice(0, 3).join('、')
    const failedFeedSuffix = failedFeedSummary
      ? `：${failedFeedSummary}${failedFeedLabels.length > 3 ? ' 等' : ''}`
      : ''
    const allSkippedByCooldown = skippedByCooldownCount === feeds.length && failedCount === 0 && newEntriesCount === 0

    await AppRepository.recordRefreshLog(refreshedCount, failedCount, failedFeedLabels)

    if (HOME_FEED_DEBUG_ENABLED) {
      logHomeFeedDebug(
        `refreshAllFeeds done refreshed=${refreshedCount} failed=${failedCount} `
        + `skipped=${skippedByCooldownCount} newEntries=${newEntriesCount} `
        + `allSkipped=${allSkippedByCooldown}`,
      )
    }

    return {
      entries: [],
      sourceLabel: allSkippedByCooldown
        ? '全部订阅源 3 分钟内已刷新，已跳过重复抓取'
        : `新增 ${newEntriesCount} 条，${failedCount} 个订阅源刷新失败${failedFeedSuffix}`,
      newEntriesCount,
      skippedByCooldown: allSkippedByCooldown,
      skippedFeedCount: skippedByCooldownCount,
      allSkippedByCooldown,
      failedFeedCount: failedCount,
      failedFeedLabels,
      failedFeedDetails,
      fallbackUsed: failedCount > 0,
    } as RemoteFeedResult
  }
}
