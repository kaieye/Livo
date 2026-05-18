import {
  Entry,
  Feed,
  EntryCardModel,
  FeedCardModel,
  toFeedCardModel,
} from '../models/LivoModels'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import {
  buildEntryCards,
  buildEntryCardsChunked,
  feedWithCount,
  feedCardFromFeed,
  sortFeedsStable,
  selectBalancedHomeEntries,
  HomeEntryMode,
  uniqueEntryCardKey,
  hasModeCoverageGap,
  countHomeEntryModes,
  homeEntryModeStatsSummary,
  logHomeFeedDebug,
  resolveFeedModePresence,
  HOME_ENTRY_CANDIDATE_LIMIT,
  HOME_ENTRY_BALANCED_POOL_MULTIPLIER,
  HOME_ENTRY_BALANCED_POOL_MAX,
  HOME_ENTRY_BALANCED_MAX_ATTEMPTS,
  HOME_ENTRY_MODE_ORDER,
  modeMatchesFeedView,
} from './AppRepositoryEntryHelpers'
import { HOME_FAST_PAGE_CACHE_BUFFER } from '../components/HomeRootConfig'

interface FeaturedModeEntriesCacheItem {
  signature: string
  entries: EntryCardModel[]
}

function allowedFeedsForMode(
  feeds: Feed[],
  mode: HomeEntryMode,
): Feed[] {
  return feeds.filter((feed: Feed) => modeMatchesFeedView(mode, feed.view))
}

function groupModeCardsByFeed(
  cards: EntryCardModel[],
  allowedFeeds: Feed[],
): Map<string, EntryCardModel[]> {
  const buckets = new Map<string, EntryCardModel[]>()
  allowedFeeds.forEach((feed: Feed) => {
    buckets.set(feed.id, [])
  })
  cards.forEach((card: EntryCardModel) => {
    const bucket = buckets.get(card.feedId)
    if (bucket) {
      bucket.push(card)
    }
  })
  return buckets
}

function roundRobinFeedCards(
  buckets: Map<string, EntryCardModel[]>,
  allowedFeeds: Feed[],
  targetCount: number,
): EntryCardModel[] {
  const result: EntryCardModel[] = []
  const seen = new Set<string>()
  let progressed = true

  while (result.length < targetCount && progressed) {
    progressed = false
    allowedFeeds.forEach((feed: Feed) => {
      if (result.length >= targetCount) {
        return
      }
      const bucket = buckets.get(feed.id)
      if (!bucket || bucket.length === 0) {
        return
      }
      const card = bucket.shift()
      if (!card) {
        return
      }
      const key = uniqueEntryCardKey(card)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      result.push(card)
      progressed = true
    })
  }

  result.sort((left: EntryCardModel, right: EntryCardModel) => {
    return (right.publishedAt || 0) - (left.publishedAt || 0)
  })
  return result
}

async function balancedModeEntries(
  mode: HomeEntryMode,
  feeds: Feed[],
  feedMap: Map<string, Feed>,
  targetCount: number,
  chunked: boolean = true,
): Promise<EntryCardModel[]> {
  const fnStartedAt = Date.now()
  const allowedFeeds = allowedFeedsForMode(feeds, mode)
  if (allowedFeeds.length === 0 || targetCount <= 0) {
    return []
  }

  const pageSize = Math.max(180, Math.min(2400, targetCount * 6))
  const pooledCards: EntryCardModel[] = []
  const seen = new Set<string>()
  let repositoryOffset = 0
  let pageIndex = 0
  let totalFilterMs = 0
  let totalBuildCardsMs = 0

  while (pooledCards.length < targetCount * 2) {
    const dbFetchStartedAt = Date.now()
    const page = await EntryRepository.listRecentPage(pageSize, repositoryOffset)
    const dbFetchMs = Date.now() - dbFetchStartedAt
    if (page.length === 0) {
      break
    }

    const allowedFeedIds = new Set<string>(allowedFeeds.map((feed: Feed) => feed.id))
    const filterStartedAt = Date.now()
    const scopedEntries = page.filter((entry: Entry) => allowedFeedIds.has(entry.feedId))
    const filterMs = Date.now() - filterStartedAt
    totalFilterMs += filterMs

    const buildStartedAt = Date.now()
    const cards = chunked
      ? await buildEntryCardsChunked(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
      : buildEntryCards(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
    const buildMs = Date.now() - buildStartedAt
    totalBuildCardsMs += buildMs

    cards.forEach((card: EntryCardModel) => {
      const key = uniqueEntryCardKey(card)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      pooledCards.push(card)
    })

    console.info(
      `[LIVO-PERF] balancedModeEntries page=${pageIndex} mode=${mode} pageSize=${pageSize} ` +
      `pageLen=${page.length} scopedLen=${scopedEntries.length} cardsLen=${cards.length} ` +
      `pooledLen=${pooledCards.length}/${targetCount * 2} dbFetchMs=${dbFetchMs} filterMs=${filterMs} buildMs=${buildMs}`,
    )

    if (page.length < pageSize) {
      break
    }
    repositoryOffset += pageSize
    pageIndex += 1
  }

  const roundRobinStartedAt = Date.now()
  const buckets = groupModeCardsByFeed(pooledCards, allowedFeeds)
  const result = roundRobinFeedCards(buckets, allowedFeeds, targetCount)
  const roundRobinMs = Date.now() - roundRobinStartedAt

  console.info(
    `[LIVO-PERF] balancedModeEntries done mode=${mode} target=${targetCount} result=${result.length} ` +
    `pooled=${pooledCards.length} pageCount=${pageIndex + 1} chunked=${String(chunked)} ` +
    `totalFilterMs=${totalFilterMs} totalBuildMs=${totalBuildCardsMs} roundRobinMs=${roundRobinMs} totalMs=${Date.now() - fnStartedAt}`,
  )
  return result
}

async function recentModeEntries(
  mode: HomeEntryMode,
  feeds: Feed[],
  feedMap: Map<string, Feed>,
  targetCount: number,
  chunked: boolean = false,
): Promise<EntryCardModel[]> {
  const fnStartedAt = Date.now()
  const allowedFeeds = allowedFeedsForMode(feeds, mode)
  if (allowedFeeds.length === 0 || targetCount <= 0) {
    return []
  }

  const allowedFeedIds = new Set<string>(allowedFeeds.map((feed: Feed) => feed.id))
  const result: EntryCardModel[] = []
  const seen = new Set<string>()
  const pageSize = Math.max(120, Math.min(720, targetCount * 3))
  let repositoryOffset = 0
  let pageIndex = 0
  let totalFilterMs = 0
  let totalBuildCardsMs = 0

  while (result.length < targetCount) {
    const dbFetchStartedAt = Date.now()
    const page = await EntryRepository.listRecentPage(pageSize, repositoryOffset)
    const dbFetchMs = Date.now() - dbFetchStartedAt
    if (page.length === 0) {
      break
    }

    const filterStartedAt = Date.now()
    const scopedEntries = page.filter((entry: Entry) => allowedFeedIds.has(entry.feedId))
    const filterMs = Date.now() - filterStartedAt
    totalFilterMs += filterMs

    const buildStartedAt = Date.now()
    const cards = chunked
      ? await buildEntryCardsChunked(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
      : buildEntryCards(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
    const buildMs = Date.now() - buildStartedAt
    totalBuildCardsMs += buildMs

    cards.forEach((card: EntryCardModel) => {
      if (result.length >= targetCount) {
        return
      }
      const key = uniqueEntryCardKey(card)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      result.push(card)
    })

    console.info(
      `[LIVO-PERF] recentModeEntries page=${pageIndex} mode=${mode} pageSize=${pageSize} ` +
      `pageLen=${page.length} scopedLen=${scopedEntries.length} cardsLen=${cards.length} ` +
      `resultLen=${result.length}/${targetCount} dbFetchMs=${dbFetchMs} filterMs=${filterMs} buildMs=${buildMs}`,
    )

    if (page.length < pageSize) {
      break
    }
    repositoryOffset += pageSize
    pageIndex += 1
  }

  console.info(
    `[LIVO-PERF] recentModeEntries done mode=${mode} target=${targetCount} result=${result.length} ` +
    `pageCount=${pageIndex + 1} chunked=${String(chunked)} totalFilterMs=${totalFilterMs} totalBuildMs=${totalBuildCardsMs} totalMs=${Date.now() - fnStartedAt}`,
  )
  return result
}

function modeFeedSignature(mode: HomeEntryMode, feeds: Feed[]): string {
  const allowedFeedIds = allowedFeedsForMode(feeds, mode)
    .map((feed: Feed) => `${feed.id}:${feed.updatedAt}:${feed.view}`)
  return `${mode}|${allowedFeedIds.join('|')}`
}

function fastPageCacheBufferForMode(mode: HomeEntryMode): number {
  if (mode === 'pictures') {
    return 12
  }
  if (mode === 'social') {
    return 24
  }
  if (mode === 'videos') {
    // 视频每页加载 24 条，buffer 提到 36 让一次扫库覆盖 1.5 个分页步长，
    // 触底再次加载时直接命中缓存，避免重复 round-robin。
    return 36
  }
  return HOME_FAST_PAGE_CACHE_BUFFER
}

function shouldUseRecentModeQuery(mode: HomeEntryMode): boolean {
  return mode === 'articles' || mode === 'social'
}

class FeaturedEntriesQuery {
  private static readonly modeEntriesCache: Map<string, FeaturedModeEntriesCacheItem> = new Map()

  private static cachedModeEntries(
    mode: HomeEntryMode,
    feeds: Feed[],
    targetCount: number,
  ): EntryCardModel[] | undefined {
    const cache = FeaturedEntriesQuery.modeEntriesCache.get(mode)
    const signature = modeFeedSignature(mode, feeds)
    if (!cache || cache.signature !== signature) {
      return undefined
    }
    if (cache.entries.length < targetCount) {
      return undefined
    }
    return cache.entries.slice(0, targetCount)
  }

  private static storeModeEntriesCache(
    mode: HomeEntryMode,
    feeds: Feed[],
    entries: EntryCardModel[],
  ): void {
    const existing = FeaturedEntriesQuery.modeEntriesCache.get(mode)
    if (existing && existing.entries.length > entries.length) {
      return
    }
    FeaturedEntriesQuery.modeEntriesCache.set(mode, {
      signature: modeFeedSignature(mode, feeds),
      entries: [...entries],
    })
  }

  static async featuredEntries(candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT): Promise<EntryCardModel[]> {
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
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(1, candidateLimit)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const cached = FeaturedEntriesQuery.cachedModeEntries(mode, feeds, safeCandidateLimit)
    if (cached) {
      logHomeFeedDebug(
        `featuredEntriesByMode cache-hit mode=${mode} limit=${safeCandidateLimit} result=${cached.length} elapsedMs=${Date.now() - startedAt}`,
      )
      return cached
    }
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    const result = shouldUseRecentModeQuery(mode)
      ? await recentModeEntries(mode, feeds, feedMap, safeCandidateLimit, true)
      : await balancedModeEntries(mode, feeds, feedMap, safeCandidateLimit)
    FeaturedEntriesQuery.storeModeEntriesCache(mode, feeds, result)

    logHomeFeedDebug(
      `featuredEntriesByMode mode=${mode} limit=${safeCandidateLimit} result=${result.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return result
  }

  static async featuredEntriesFastByMode(
    mode: HomeEntryMode,
    candidateLimit: number = HOME_ENTRY_CANDIDATE_LIMIT,
  ): Promise<EntryCardModel[]> {
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(1, candidateLimit)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const cached = FeaturedEntriesQuery.cachedModeEntries(mode, feeds, safeCandidateLimit)
    if (cached) {
      logHomeFeedDebug(
        `featuredEntriesFastByMode cache-hit mode=${mode} limit=${safeCandidateLimit} cards=${cached.length} elapsedMs=${Date.now() - startedAt}`,
      )
      return cached
    }
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    const cards = shouldUseRecentModeQuery(mode)
      ? await recentModeEntries(mode, feeds, feedMap, safeCandidateLimit, true)
      : await balancedModeEntries(mode, feeds, feedMap, safeCandidateLimit, true)
    FeaturedEntriesQuery.storeModeEntriesCache(mode, feeds, cards)

    logHomeFeedDebug(
      `featuredEntriesFastByMode mode=${mode} limit=${safeCandidateLimit} cards=${cards.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return cards
  }

  static async featuredEntriesFastPageByMode(
    mode: HomeEntryMode,
    limit: number,
    offset: number,
  ): Promise<EntryCardModel[]> {
    const startedAt = Date.now()
    const safeLimit = Math.max(1, limit)
    const safeOffset = Math.max(0, offset)
    const feeds = sortFeedsStable(await FeedRepository.list())
    const targetVisibleCount = safeOffset + safeLimit
    const cacheLookupStartedAt = Date.now()
    const cached = FeaturedEntriesQuery.cachedModeEntries(mode, feeds, targetVisibleCount)
    const cacheLookupMs = Date.now() - cacheLookupStartedAt
    if (cached) {
      const cachedPage = cached.slice(safeOffset, safeOffset + safeLimit)
      const totalElapsed = Date.now() - startedAt
      console.info(`[LIVO-PERF] fastPage cache-hit mode=${mode} limit=${safeLimit} offset=${safeOffset} result=${cachedPage.length} cacheLookupMs=${cacheLookupMs} totalMs=${totalElapsed}`)
      logHomeFeedDebug(
        `featuredEntriesFastPageByMode cache-hit mode=${mode} limit=${safeLimit} offset=${safeOffset} result=${cachedPage.length} elapsedMs=${totalElapsed}`,
      )
      return cachedPage
    }
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    // 图片卡片解码和布局成本高，加载更多时只预取小缓冲，避免触底瞬间全量扫库和建卡。
    const queryTarget = targetVisibleCount + fastPageCacheBufferForMode(mode)
    const dbQueryStartedAt = Date.now()
    const expandedEntries = shouldUseRecentModeQuery(mode)
      ? await recentModeEntries(mode, feeds, feedMap, queryTarget, true)
      : await balancedModeEntries(mode, feeds, feedMap, queryTarget, true)
    const dbQueryMs = Date.now() - dbQueryStartedAt
    FeaturedEntriesQuery.storeModeEntriesCache(mode, feeds, expandedEntries)
    const result = expandedEntries
      .slice(safeOffset, safeOffset + safeLimit)
    const totalElapsed = Date.now() - startedAt

    console.info(`[LIVO-PERF] fastPage cache-miss mode=${mode} limit=${safeLimit} offset=${safeOffset} result=${result.length} expanded=${expandedEntries.length} queryTarget=${queryTarget} cacheLookupMs=${cacheLookupMs} dbQueryMs=${dbQueryMs} totalMs=${totalElapsed}`)
    logHomeFeedDebug(
      `featuredEntriesFastPageByMode mode=${mode} limit=${safeLimit} offset=${safeOffset} result=${result.length} elapsedMs=${totalElapsed}`,
    )
    return result
  }
}

export { FeaturedEntriesQuery }
