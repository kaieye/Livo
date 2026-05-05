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
): Promise<EntryCardModel[]> {
  const allowedFeeds = allowedFeedsForMode(feeds, mode)
  if (allowedFeeds.length === 0 || targetCount <= 0) {
    return []
  }

  const pageSize = Math.max(180, Math.min(2400, targetCount * 6))
  const pooledCards: EntryCardModel[] = []
  const seen = new Set<string>()
  let repositoryOffset = 0

  while (pooledCards.length < targetCount * 2) {
    const page = await EntryRepository.listRecentPage(pageSize, repositoryOffset)
    if (page.length === 0) {
      break
    }

    const allowedFeedIds = new Set<string>(allowedFeeds.map((feed: Feed) => feed.id))
    const scopedEntries = page.filter((entry: Entry) => allowedFeedIds.has(entry.feedId))
    const cards = await buildEntryCardsChunked(scopedEntries, (entry: Entry) => feedMap.get(entry.feedId))
    cards.forEach((card: EntryCardModel) => {
      const key = uniqueEntryCardKey(card)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      pooledCards.push(card)
    })

    if (page.length < pageSize) {
      break
    }
    repositoryOffset += pageSize
  }

  const buckets = groupModeCardsByFeed(pooledCards, allowedFeeds)
  return roundRobinFeedCards(buckets, allowedFeeds, targetCount)
}

class FeaturedEntriesQuery {
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
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    const result = await balancedModeEntries(mode, feeds, feedMap, safeCandidateLimit)

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
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    const cards = await balancedModeEntries(mode, feeds, feedMap, safeCandidateLimit)

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
    const feedMap = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => feedMap.set(feed.id, feed))
    const targetVisibleCount = safeOffset + safeLimit
    const result = (await balancedModeEntries(mode, feeds, feedMap, targetVisibleCount))
      .slice(safeOffset, safeOffset + safeLimit)

    logHomeFeedDebug(
      `featuredEntriesFastPageByMode mode=${mode} limit=${safeLimit} offset=${safeOffset} result=${result.length} elapsedMs=${Date.now() - startedAt}`,
    )
    return result
  }
}

export { FeaturedEntriesQuery }
