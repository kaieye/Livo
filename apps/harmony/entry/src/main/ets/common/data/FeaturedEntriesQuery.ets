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
}

export { FeaturedEntriesQuery }
