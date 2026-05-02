import { AppRepository } from '../data/AppRepository'
import { EntryCardModel } from '../models/LivoModels'
import {
  HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import { resolveHomeVisibleEntryLoadMoreStep } from './HomeVisibleEntryPolicy'
import { HomePaginationState, IndexHomePaginationOwner } from './HomePaginationState'

export class HomePrefetchCoordinator extends HomePaginationState {
  constructor(owner: IndexHomePaginationOwner) {
    super(owner)
  }

  canPrefetchHomeLoadMore(): boolean {
    if (!HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED) {
      return false
    }
    return this.owner.isComponentActive
      && this.owner.isHomeRootTab()
      && !this.shouldRenderAllEntriesForMode(this.owner.mode)
      && !this.owner.searchOverlayVisible
      && !this.owner.hasHomeInlineSearchQuery()
      && !this.owner.isRefreshing
      && !this.owner.isHomeStartupRefreshing
      && !this.owner.homeInitialLoadPending
      && !this.owner.homeLoadMoreInProgress
      && this.owner.homeHasMoreEntries
      && this.modeHasMoreEntries(this.owner.mode)
  }

  invalidateHomeLoadMorePrefetch(): void {
    this.owner.homeLoadMorePrefetchToken += 1
    this.owner.homeLoadMorePrefetchInProgress = false
    this.owner.homeLoadMorePrefetchLimit = 0
    this.owner.homeLoadMorePrefetchEntries = []
    this.owner.homeLoadMorePrefetchMode = this.owner.mode
  }

  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void {
    this.owner.runManagedTimeout(() => {
      void this.prefetchHomeLoadMore()
    }, delayMs)
  }

  async prefetchHomeLoadMore(): Promise<void> {
    if (!this.canPrefetchHomeLoadMore()) {
      return
    }
    const mode = this.owner.mode
    const currentLimit = this.candidateLimitForMode(mode)
    const targetLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentLimit + resolveHomeVisibleEntryLoadMoreStep(mode),
    )
    if (targetLimit <= currentLimit) {
      return
    }
    if (this.owner.homeLoadMorePrefetchLimit >= targetLimit && this.owner.homeLoadMorePrefetchEntries.length > 0) {
      return
    }
    if (this.owner.homeLoadMorePrefetchInProgress) {
      return
    }

    this.owner.homeLoadMorePrefetchInProgress = true
    const token = this.owner.homeLoadMorePrefetchToken + 1
    this.owner.homeLoadMorePrefetchToken = token
    this.owner.logHomeLoadMore(`prefetch start mode=${mode} currentLimit=${currentLimit} targetLimit=${targetLimit}`)

    try {
      const entries = await AppRepository.featuredEntriesByMode(mode, targetLimit)
      if (!this.owner.isComponentActive || this.owner.homeLoadMorePrefetchToken !== token) {
        return
      }
      this.owner.homeLoadMorePrefetchLimit = targetLimit
      this.owner.homeLoadMorePrefetchEntries = entries
      this.owner.homeLoadMorePrefetchMode = mode
      this.owner.logHomeLoadMore(`prefetch done mode=${mode} targetLimit=${targetLimit} entries=${entries.length}`)
    } catch (_error) {
      this.owner.logHomeLoadMore(`prefetch failed targetLimit=${targetLimit}`)
    } finally {
      if (this.owner.homeLoadMorePrefetchToken === token) {
        this.owner.homeLoadMorePrefetchInProgress = false
      }
    }
  }

  consumePrefetchedHomeEntries(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    if (this.owner.homeLoadMorePrefetchMode !== mode) {
      return undefined
    }
    if (this.owner.homeLoadMorePrefetchLimit < nextLimit || this.owner.homeLoadMorePrefetchEntries.length === 0) {
      return undefined
    }
    const entries = this.owner.homeLoadMorePrefetchEntries
    this.owner.homeLoadMorePrefetchLimit = 0
    this.owner.homeLoadMorePrefetchEntries = []
    this.owner.homeLoadMorePrefetchInProgress = false
    this.owner.logHomeLoadMore(`consume-prefetch nextLimit=${nextLimit} entries=${entries.length}`)
    return entries
  }

  async appendFeaturedEntriesFromLocalFast(mode: SubscriptionMode, nextLimit: number): Promise<void> {
    const previousEntries = this.owner.filteredEntriesFor(mode)
    const previousTotal = previousEntries.length
    const currentLimit = this.candidateLimitForMode(mode)
    const appendCount = Math.max(1, nextLimit - currentLimit)
    const nextPage = await AppRepository.featuredEntriesFastPageByMode(mode, appendCount, previousTotal)

    if (nextPage.length === 0) {
      this.setCandidateLimitForMode(mode, nextLimit)
      this.owner.logHomeLoadMore(
        `append-fast-empty mode=${mode} prevTotal=${previousTotal} appendCount=${appendCount} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await AppRepository.featuredEntriesByMode(mode, nextLimit)
      this.syncModePaginationFromReloadResult(mode, fallbackEntries, nextLimit)
      if (fallbackEntries.length <= previousTotal) {
        this.setModeHasMoreEntries(
          mode,
          false,
          `append-empty-fallback prevTotal=${previousTotal} fallback=${fallbackEntries.length} nextLimit=${nextLimit}`,
        )
      }
      this.owner.applyEntriesForMode(mode, fallbackEntries, true)
      return
    }

    const seen = new Set<string>()
    const merged: EntryCardModel[] = []
    previousEntries.forEach((entry: EntryCardModel) => {
      seen.add(`${entry.id}|${entry.feedId}|${entry.articleUrl}`)
      merged.push(entry)
    })
    nextPage.forEach((entry: EntryCardModel) => {
      const key = `${entry.id}|${entry.feedId}|${entry.articleUrl}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(entry)
      }
    })

    const appendedUniqueCount = Math.max(0, merged.length - previousTotal)
    if (appendedUniqueCount === 0) {
      this.owner.logHomeLoadMore(
        `append-no-unique prevTotal=${previousTotal} appendCount=${appendCount} nextPage=${nextPage.length} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await AppRepository.featuredEntriesByMode(mode, nextLimit)
      this.syncModePaginationFromReloadResult(mode, fallbackEntries, nextLimit)
      if (fallbackEntries.length <= previousTotal) {
        this.setModeHasMoreEntries(
          mode,
          false,
          `append-no-progress prevTotal=${previousTotal} fallback=${fallbackEntries.length} nextLimit=${nextLimit}`,
        )
      }
      this.owner.applyEntriesForMode(mode, fallbackEntries, true)
      return
    }

    this.setCandidateLimitForMode(mode, nextLimit)
    if (mode === 'articles') {
      this.owner.entryGroups = {
        articles: merged,
        social: this.owner.entryGroups.social,
        pictures: this.owner.entryGroups.pictures,
        videos: this.owner.entryGroups.videos,
      }
      this.owner.featuredEntries = this.owner.mergeFeaturedEntriesFromGroups()
      this.markModeLoaded(mode, true)
      this.owner.settleInitialHomeLoadState()
      this.owner.schedulePersistHomeSnapshot(this.owner.featuredEntries)
      this.owner.notifyHomeEntryDataReloadedForMode(mode)
      return
    }
    this.owner.applyEntriesForMode(mode, merged, true)
  }
}
