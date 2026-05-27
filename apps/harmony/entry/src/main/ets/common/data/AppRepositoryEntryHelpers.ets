import {
  Entry,
  Feed,
  FeedCardModel,
  FeedViewType,
  FeedWithCount,
  EntryCardModel,
  toEntryCardModel,
  EntryCardTiming,
  toFeedCardModel,
} from '../models/LivoModels'
import { EntryRepository } from '../repositories/EntryRepository'
import {
  resolveSocialFeedDisplayDescription,
  resolveSocialFeedDisplayImageUrl,
  resolveSocialFeedDisplayTitle,
} from '../utils/social/SocialFeedPresentation'

import { HomeEntryMode, modeMatchesFeedView, modeOfFeedView } from './HomeEntryModeUtils'

export { HomeEntryMode, modeMatchesFeedView, modeOfFeedView }

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
const HOME_ENTRY_CANDIDATE_LIMIT: number = 480
const HOME_ENTRY_BALANCED_POOL_MULTIPLIER: number = 6
const HOME_ENTRY_BALANCED_POOL_MAX: number = 6000
const HOME_ENTRY_BALANCED_MAX_ATTEMPTS: number = 4
const ENTRY_CARD_YIELD_BATCH_SIZE: number = 6
const HOME_FEED_DEBUG_ENABLED: boolean = false
const HOME_FEED_DEBUG_PREFIX: string = '[FeedFetchStateDebug][HomeFeed]'

export function yieldToUiLoop(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 0)
  })
}

export async function buildEntryCardsChunked(
  entries: Entry[],
  resolveFeed: (entry: Entry) => Feed | undefined,
): Promise<EntryCardModel[]> {
  const cards: EntryCardModel[] = []

  let maxCardMs = 0
  let maxCardIndex = -1
  let totalCardMs = 0
  let skippedCards = 0
  let totalFeedDisplayMs = 0
  let totalToCardModelMs = 0
  let totalMediaCtxMs = 0
  let totalVideoUrlsMs = 0
  let totalImageUrlMs = 0

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (!entry) {
      continue
    }

    const measured = measureEntryCardBuild(entry, resolveFeed(entry))
    totalCardMs += measured.timing.totalMs
    totalFeedDisplayMs += measured.timing.feedDisplayMs
    totalToCardModelMs += measured.timing.toCardModelMs
    totalMediaCtxMs += measured.timing.mediaCtxMs
    totalVideoUrlsMs += measured.timing.videoUrlsMs
    totalImageUrlMs += measured.timing.imageUrlMs

    if (measured.card) {
      cards.push(measured.card)
      if (measured.timing.totalMs > maxCardMs) {
        maxCardMs = measured.timing.totalMs
        maxCardIndex = index
      }
    } else {
      skippedCards += 1
    }

    if ((index + 1) % ENTRY_CARD_YIELD_BATCH_SIZE === 0) {
      await yieldToUiLoop()
    }
  }

  const validCards = cards.length
  const avgMs = validCards > 0 ? Math.round(totalCardMs / validCards) : 0
  const avgFeedDisplayMs = validCards > 0 ? Math.round(totalFeedDisplayMs / validCards) : 0
  const avgMediaCtxMs = validCards > 0 ? Math.round(totalMediaCtxMs / validCards) : 0
  const avgVideoUrlsMs = validCards > 0 ? Math.round(totalVideoUrlsMs / validCards) : 0
  const avgImageUrlMs = validCards > 0 ? Math.round(totalImageUrlMs / validCards) : 0
  const avgOtherMs = Math.max(0, avgMs - avgFeedDisplayMs - avgMediaCtxMs - avgVideoUrlsMs - avgImageUrlMs)
  console.info(
    `[LIVO-PERF] buildEntryCardsChunked done input=${entries.length} output=${validCards} skipped=${skippedCards} ` +
    `totalCardMs=${totalCardMs} avgCardMs=${avgMs} maxCardMs=${maxCardMs} maxCardIdx=${maxCardIndex} ` +
    `feedDisplay[avg=${avgFeedDisplayMs}/total=${totalFeedDisplayMs}] ` +
    `mediaCtx[avg=${avgMediaCtxMs}/total=${totalMediaCtxMs}] ` +
    `videoUrls[avg=${avgVideoUrlsMs}/total=${totalVideoUrlsMs}] ` +
    `imageUrl[avg=${avgImageUrlMs}/total=${totalImageUrlMs}] ` +
    `other[avg=${avgOtherMs}]`,
  )

  return cards
}

export function buildEntryCards(
  entries: Entry[],
  resolveFeed: (entry: Entry) => Feed | undefined,
): EntryCardModel[] {
  const cards: EntryCardModel[] = []
  entries.forEach((entry: Entry) => {
    const card = entryCardFromEntry(entry, resolveFeed(entry))
    if (card) {
      cards.push(card)
    }
  })
  return cards
}

export async function feedWithCount(feed: Feed): Promise<FeedWithCount> {
  const unreadCount = await EntryRepository.default.countUnreadByFeed(feed.id)
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

export function feedCardFromFeed(feed: Feed, unreadCount: number = 0): FeedCardModel {
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

export function sortFeedsStable(feeds: Feed[]): Feed[] {
  return [...feeds].sort((left: Feed, right: Feed) => {
    const leftCreatedAt = left.createdAt || 0
    const rightCreatedAt = right.createdAt || 0
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt
    }

    return left.id.localeCompare(right.id)
  })
}

export function entryCardFromEntry(entry: Entry, feed: Feed | undefined): EntryCardModel | undefined {
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

export interface EntryCardBuildTiming {
  totalCards: number
  skippedCards: number
  totalMs: number
  maxMs: number
  maxIndex: number
  // sub-step totals (populated only when PERF_COLLECT_SUBSTEPS === true)
  feedDisplayMs: number
  toCardModelMs: number
  videoUrlsMs: number
  imageUrlMs: number
}

export interface EntryCardBuildSubTiming {
  feedDisplayMs: number
  toCardModelMs: number
  mediaCtxMs: number
  videoUrlsMs: number
  imageUrlMs: number
  totalMs: number
}

export interface MeasureEntryCardBuildResult {
  card: EntryCardModel | undefined
  timing: EntryCardBuildSubTiming
}

export function measureEntryCardBuild(
  entry: Entry,
  feed: Feed | undefined,
): MeasureEntryCardBuildResult {
  const t0 = Date.now()
  if (!feed) {
    return {
      card: undefined,
      timing: {
        feedDisplayMs: 0,
        toCardModelMs: 0,
        mediaCtxMs: 0,
        videoUrlsMs: 0,
        imageUrlMs: 0,
        totalMs: Date.now() - t0,
      } as EntryCardBuildSubTiming,
    } as MeasureEntryCardBuildResult
  }

  const t1 = Date.now()
  const displayTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  const displayDescription = resolveSocialFeedDisplayDescription(feed.description || '', feed.url, feed.siteUrl || '')
  const displayImageUrl = resolveSocialFeedDisplayImageUrl(feed.imageUrl || '', feed.url, feed.siteUrl || '', displayTitle)
  const feedDisplayMs = Date.now() - t1

  const t2 = Date.now()
  const entryTiming: EntryCardTiming = { mediaCtxMs: 0, videoUrlsMs: 0, imageUrlMs: 0 }
  const card = toEntryCardModel(entry, {
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
  }, entryTiming)
  const toCardModelMs = Date.now() - t2

  return {
    card,
    timing: {
      feedDisplayMs,
      toCardModelMs,
      mediaCtxMs: entryTiming.mediaCtxMs,
      videoUrlsMs: entryTiming.videoUrlsMs,
      imageUrlMs: entryTiming.imageUrlMs,
      totalMs: Date.now() - t0,
    },
  }
}

function createHomeEntryModeStats(): HomeEntryModeStats {
  return {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
}

export function homeEntryModeStatsSummary(stats: HomeEntryModeStats): string {
  return `articles=${stats.articles} social=${stats.social} pictures=${stats.pictures} videos=${stats.videos}`
}

export function logHomeFeedDebug(message: string): void {
  if (!HOME_FEED_DEBUG_ENABLED) {
    return
  }

  console.info(`${HOME_FEED_DEBUG_PREFIX} ${message}`)
}

export function countHomeEntryModes(entries: EntryCardModel[]): HomeEntryModeStats {
  let articles = 0
  let social = 0
  let pictures = 0
  let videos = 0

  entries.forEach((entry: EntryCardModel) => {
    switch (modeOfFeedView(entry.view)) {
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

export function resolveFeedModePresence(feeds: Feed[]): HomeEntryModeStats {
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

export function hasModeCoverageGap(
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

export function uniqueEntryCardKey(entry: EntryCardModel): string {
  return `${entry.id}|${entry.feedId}|${entry.articleUrl}`
}

export function selectBalancedHomeEntries(
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
    switch (modeOfFeedView(entry.view)) {
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

export {
  HOME_ENTRY_CANDIDATE_LIMIT,
  HOME_ENTRY_BALANCED_POOL_MULTIPLIER,
  HOME_ENTRY_BALANCED_POOL_MAX,
  HOME_ENTRY_BALANCED_MAX_ATTEMPTS,
  HOME_ENTRY_MODE_ORDER,
}
