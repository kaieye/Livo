import { EntryCardModel } from '../models/LivoModels'
import { HomeScrollIntentTracker } from './HomeScrollIntentTracker'
import {
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeVisibleEntryLimitMap,
  HomeModeCandidateLimitMap,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import {
  homeCandidateLimitValue,
  homeModeBooleanValue,
  homeModeLoadedValue,
  homeModeLoadingValue,
  homeNoProgressCountValue,
  homeVisibleEntryLimitValue,
  withHomeCandidateLimitValue,
  withHomeLoadedValue,
  withHomeLoadingValue,
  withHomeModeBooleanValue,
  withHomeNoProgressCountValue,
  withHomeVisibleEntryLimitValue,
} from './IndexHomeStateFactory'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
} from './HomeVisibleEntryPolicy'
import { HomeEntryGroups } from './HomeEntryGroups'

export interface IndexHomePaginationOwner {
  mode: SubscriptionMode
  homeCandidateLimit: number
  homeCandidateLimitsByMode: HomeModeCandidateLimitMap
  homeModeLoaded: HomeModeLoadedMap
  homeModeLoading: HomeModeLoadingMap
  homeVisibleEntryLimits: HomeModeVisibleEntryLimitMap
  homeHasMoreEntries: boolean
  homeHasMoreEntriesByMode: HomeModeHasMoreMap
  homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap
  homeLoadMorePrefetchToken: number
  homeLoadMorePrefetchLimit: number
  homeLoadMorePrefetchEntries: EntryCardModel[]
  homeLoadMorePrefetchMode: SubscriptionMode
  homeLoadMorePrefetchInProgress: boolean
  lastHomeLoadMoreRequestedAt: number
  homeLoadMoreInProgress: boolean
  homeLoadMoreRequestToken: number
  lastHomeLoadMoreCompletedAt: number
  searchOverlayVisible: boolean
  homeInitialLoadPending: boolean
  isComponentActive: boolean
  isRefreshing: boolean
  isHomeStartupRefreshing: boolean
  homeScrollIntent: HomeScrollIntentTracker
  featuredEntries: EntryCardModel[]
  entryGroups: HomeEntryGroups<EntryCardModel>

  isHomeRootTab(): boolean
  hasHomeInlineSearchQuery(): boolean
  runManagedTimeout(callback: () => void, delayMs: number): void
  logHomeLoadMore(message: string): void
  logHomePerf(message: string): void
  logHomeLoadState(message: string): void
  logHomeAsyncError(stage: string, error: Error | string | Object): void
  describeError(error: Error | string | Object): string
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[]
  mergeFeaturedEntriesFromGroups(): EntryCardModel[]
  applyEntriesForMode(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    deferredPersist: boolean,
    skipNotify?: boolean,
    skipMerge?: boolean,
  ): void
  settleInitialHomeLoadState(force?: boolean): void
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void
  reloadFeaturedEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
    targetMode?: SubscriptionMode,
  ): Promise<void>
}

export class HomePaginationState {
  protected readonly owner: IndexHomePaginationOwner

  constructor(owner: IndexHomePaginationOwner) {
    this.owner = owner
  }

  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean {
    return false
  }

  candidateLimitForMode(mode: SubscriptionMode): number {
    return homeCandidateLimitValue(mode, this.owner.homeCandidateLimitsByMode)
  }

  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, limit)
    this.owner.homeCandidateLimitsByMode =
      withHomeCandidateLimitValue(mode, safeLimit, this.owner.homeCandidateLimitsByMode)
    if (mode === this.owner.mode) {
      this.owner.homeCandidateLimit = safeLimit
    }
  }

  resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return Math.max(HOME_FULL_MODE_CANDIDATE_LIMIT, minimumLimit)
    }
    return Math.max(minimumLimit, this.candidateLimitForMode(mode))
  }

  resolveHomeCandidateLimit(minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(this.owner.mode)) {
      return this.resolveHomeCandidateLimitForMode(this.owner.mode, minimumLimit)
    }
    return Math.max(minimumLimit, this.owner.homeCandidateLimit)
  }

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void {
    this.owner.homeModeLoaded = withHomeLoadedValue(mode, loaded, this.owner.homeModeLoaded)
  }

  isModeLoaded(mode: SubscriptionMode): boolean {
    return homeModeLoadedValue(mode, this.owner.homeModeLoaded)
  }

  isModeLoading(mode: SubscriptionMode): boolean {
    return homeModeLoadingValue(mode, this.owner.homeModeLoading)
  }

  setModeLoading(mode: SubscriptionMode, loading: boolean): void {
    this.owner.homeModeLoading = withHomeLoadingValue(mode, loading, this.owner.homeModeLoading)
  }

  visibleEntryLimitFor(mode: SubscriptionMode): number {
    return homeVisibleEntryLimitValue(mode, this.owner.homeVisibleEntryLimits)
  }

  setVisibleEntryLimitFor(mode: SubscriptionMode, limit: number): void {
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    this.owner.homeVisibleEntryLimits =
      withHomeVisibleEntryLimitValue(mode, safeLimit, this.owner.homeVisibleEntryLimits)
  }

  totalEntryCountFor(mode: SubscriptionMode): number {
    return this.owner.filteredEntriesFor(mode).length
  }

  hasBufferedEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    return this.visibleEntryLimitFor(mode) < this.totalEntryCountFor(mode)
  }

  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    const entries = this.owner.filteredEntriesFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return entries
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    return entries.slice(0, Math.min(entries.length, safeLimit))
  }

  visibleEntryCountFor(mode: SubscriptionMode): number {
    const totalCount = this.totalEntryCountFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return totalCount
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    return Math.min(totalCount, safeLimit)
  }

  expandVisibleEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const total = this.totalEntryCountFor(mode)
    const currentLimit = this.visibleEntryLimitFor(mode)
    if (currentLimit >= total) {
      return false
    }
    const nextLimit = Math.min(total, currentLimit + resolveHomeVisibleEntryLoadMoreStep(mode))
    this.setVisibleEntryLimitFor(mode, nextLimit)
    this.owner.logHomeLoadMore(
      `expand-visible mode=${mode} currentLimit=${currentLimit} nextLimit=${nextLimit} total=${total}`,
    )
    return true
  }

  modeHasMoreEntries(mode: SubscriptionMode): boolean {
    return homeModeBooleanValue(mode, this.owner.homeHasMoreEntriesByMode)
  }

  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void {
    const previous = this.modeHasMoreEntries(mode)
    if (previous === next) {
      return
    }
    this.owner.homeHasMoreEntriesByMode =
      withHomeModeBooleanValue(mode, next, this.owner.homeHasMoreEntriesByMode)
    this.owner.logHomeLoadState(
      `modeHasMore mode=${mode} next=${next ? 'true' : 'false'} reason=${reason} `
      + `globalHasMore=${this.owner.homeHasMoreEntries} visible=${this.visibleEntryCountFor(mode)}/${this.totalEntryCountFor(mode)}`,
    )
    if (next) {
      this.setHomeHasMoreEntries(true, `mode-has-more mode=${mode}`)
    }
  }

  setHomeHasMoreEntries(next: boolean, reason: string): void {
    if (this.owner.homeHasMoreEntries === next) {
      return
    }
    const mode = this.owner.mode
    const total = this.totalEntryCountFor(mode)
    const visible = this.visibleEntryCountFor(mode)
    this.owner.homeHasMoreEntries = next
    if (!next) {
      this.owner.homeHasMoreEntriesByMode = {
        articles: false,
        social: false,
        pictures: false,
        videos: false,
      }
    }
    this.owner.logHomeLoadState(
      `hasMore=${next ? 'true' : 'false'} reason=${reason} mode=${mode} `
      + `candidateLimit=${this.owner.homeCandidateLimit} featured=${this.owner.featuredEntries.length} `
      + `visible=${visible}/${total} inProgress=${this.owner.homeLoadMoreInProgress}`,
    )
  }

  modeNoProgressCount(mode: SubscriptionMode): number {
    return homeNoProgressCountValue(mode, this.owner.homeModeNoProgressLoadMoreCount)
  }

  setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    const safeCount = Math.max(0, count)
    this.owner.homeModeNoProgressLoadMoreCount =
      withHomeNoProgressCountValue(mode, safeCount, this.owner.homeModeNoProgressLoadMoreCount)
  }

  syncModePaginationFromReloadResult(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    candidateLimit: number,
  ): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, candidateLimit)
    const currentEntries = this.owner.filteredEntriesFor(mode)
    const currentCount = currentEntries.length
    this.setCandidateLimitForMode(mode, safeLimit)
    if (entries.length >= safeLimit) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-full entries=${entries.length} limit=${safeLimit}`)
      return
    }
    if (entries.length > currentCount) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-growth entries=${entries.length} current=${currentCount} limit=${safeLimit}`)
      return
    }
    const visibleCount = this.visibleEntryCountFor(mode)
    const currentCandidateLimit = this.candidateLimitForMode(mode)
    const reachedCurrentBoundary = visibleCount >= currentCount && safeLimit > currentCandidateLimit
    if (currentCount > 0 && reachedCurrentBoundary) {
      this.setModeHasMoreEntries(
        mode,
        true,
        `sync-pagination-boundary visible=${visibleCount} current=${currentCount} limit=${safeLimit}`,
      )
      return
    }
    this.setModeHasMoreEntries(mode, false, `sync-pagination-short entries=${entries.length} limit=${safeLimit}`)
    this.owner.logHomeLoadMore(
      `stop-hasMore mode=${mode} entries=${entries.length} limit=${safeLimit} candidateLimit=${this.candidateLimitForMode(mode)}`,
    )
    if (!this.modeHasMoreEntries('articles')
      && !this.modeHasMoreEntries('social')
      && !this.modeHasMoreEntries('pictures')
      && !this.modeHasMoreEntries('videos')
    ) {
      this.setHomeHasMoreEntries(false, `all-modes-exhausted mode=${mode}`)
    }
  }

  syncHomePaginationFromReloadResult(entries: EntryCardModel[], candidateLimit: number): void {
    this.syncModePaginationFromReloadResult(this.owner.mode, entries, candidateLimit)
  }
}
