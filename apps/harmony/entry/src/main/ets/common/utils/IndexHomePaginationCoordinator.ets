import { AppRepository } from '../data/AppRepository'
import { EntryCardModel } from '../models/LivoModels'
import {
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_LOAD_MORE_AFTER_STOP_DELAY_MS,
  HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED,
  HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER,
  HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  HOME_LOAD_MORE_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
  HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS,
  HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS,
  HOME_MODE_SWITCH_CANDIDATE_LIMIT,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadMoreTimestampMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModePendingLoadMoreMap,
  HomeModeScrollOffsetMap,
  HomeModeVisibleEntryLimitMap,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import {
  createHomeLoadMoreTimestampMap,
  createHomePendingLoadMoreMap,
  createHomeScrollOffsetMap,
  homeCandidateLimitValue,
  homeLoadMoreTimestampValue,
  homeModeBooleanValue,
  homeModeLoadedValue,
  homeModeLoadingValue,
  homeModeNumberValue,
  homeModePendingLoadMoreValue,
  homeNoProgressCountValue,
  homeVisibleEntryLimitValue,
  withHomeCandidateLimitValue,
  withHomeLoadMoreTimestampValue,
  withHomeLoadedValue,
  withHomeLoadingValue,
  withHomeModeBooleanValue,
  withHomeModeNumberValue,
  withHomeNoProgressCountValue,
  withHomePendingLoadMoreValue,
  withHomeVisibleEntryLimitValue,
} from './IndexHomeStateFactory'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
  shouldPreloadHomeVisibleEntries,
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
  lastHomeUserScrollAt: number
  lastHomeLoadMoreRequestedAt: number
  homeLoadMoreInProgress: boolean
  homeLoadMoreRequestToken: number
  lastHomeLoadMoreCompletedAt: number
  searchOverlayVisible: boolean
  homeInitialLoadPending: boolean
  isComponentActive: boolean
  isRefreshing: boolean
  isHomeStartupRefreshing: boolean
  isHomeScrollInteracting: boolean
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
  modeScrollIntentVersion(mode: SubscriptionMode): number
  consumedModeScrollIntentVersion(mode: SubscriptionMode): number
  setConsumedModeScrollIntentVersion(mode: SubscriptionMode, value: number): void
  reloadFeaturedEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
    targetMode?: SubscriptionMode,
  ): Promise<void>
}

export class IndexHomePaginationCoordinator {
  private readonly owner: IndexHomePaginationOwner
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = createHomePendingLoadMoreMap()
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = createHomeLoadMoreTimestampMap()
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()

  constructor(owner: IndexHomePaginationOwner) {
    this.owner = owner
  }

  resolveHomeCandidateLimit(minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(this.owner.mode)) {
      return this.resolveHomeCandidateLimitForMode(this.owner.mode, minimumLimit)
    }
    return Math.max(minimumLimit, this.owner.homeCandidateLimit)
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

  syncHomePaginationFromReloadResult(entries: EntryCardModel[], candidateLimit: number): void {
    this.syncModePaginationFromReloadResult(this.owner.mode, entries, candidateLimit)
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

  canLoadMoreForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    return this.owner.isHomeRootTab()
      && mode === this.owner.mode
      && (hasBufferedEntries || this.modeHasMoreEntries(mode))
      && !this.owner.searchOverlayVisible
      && !this.owner.hasHomeInlineSearchQuery()
      && !this.owner.homeInitialLoadPending
      && !this.owner.homeLoadMoreInProgress
      && (hasBufferedEntries || this.owner.homeHasMoreEntries)
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

  modeNoProgressCount(mode: SubscriptionMode): number {
    return homeNoProgressCountValue(mode, this.owner.homeModeNoProgressLoadMoreCount)
  }

  setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    const safeCount = Math.max(0, count)
    this.owner.homeModeNoProgressLoadMoreCount =
      withHomeNoProgressCountValue(mode, safeCount, this.owner.homeModeNoProgressLoadMoreCount)
  }

  resetModeLoadMoreStates(reason: string): void {
    this.owner.homeHasMoreEntriesByMode = {
      articles: true,
      social: true,
      pictures: true,
      videos: true,
    }
    this.owner.homeModeNoProgressLoadMoreCount = {
      articles: 0,
      social: 0,
      pictures: 0,
      videos: 0,
    }
    this.homePendingLoadMoreModes = createHomePendingLoadMoreMap()
    this.homeLastItemAppearLoadMoreAt = createHomeLoadMoreTimestampMap()
    this.homeLastScrollProgressLoadMoreAt = createHomeScrollOffsetMap()
    this.owner.logHomeLoadState(`mode loadMore state reset reason=${reason}`)
  }

  loadMoreBlockedReason(mode: SubscriptionMode): string {
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    if (!this.owner.isHomeRootTab()) {
      return 'not-home-tab'
    }
    if (mode !== this.owner.mode) {
      return 'inactive-mode'
    }
    if (this.owner.searchOverlayVisible) {
      return 'search-overlay'
    }
    if (this.owner.hasHomeInlineSearchQuery()) {
      return 'search-query-active'
    }
    if (this.owner.homeInitialLoadPending) {
      return 'initial-load-pending'
    }
    if (this.owner.homeLoadMoreInProgress) {
      return 'load-more-in-progress'
    }
    if (!hasBufferedEntries && !this.modeHasMoreEntries(mode)) {
      return 'mode-no-more'
    }
    if (!hasBufferedEntries && !this.owner.homeHasMoreEntries) {
      return 'no-buffer-and-no-more'
    }
    if (!this.hasRecentHomeScrollIntent()) {
      return 'no-recent-scroll-intent'
    }
    return ''
  }

  hasRecentHomeScrollIntent(): boolean {
    return Date.now() - this.owner.lastHomeUserScrollAt <= HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS
  }

  invalidateHomeLoadMorePrefetch(): void {
    this.owner.homeLoadMorePrefetchToken += 1
    this.owner.homeLoadMorePrefetchInProgress = false
    this.owner.homeLoadMorePrefetchLimit = 0
    this.owner.homeLoadMorePrefetchEntries = []
    this.owner.homeLoadMorePrefetchMode = this.owner.mode
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
    this.owner.logHomeLoadMore(
      `prefetch start mode=${mode} currentLimit=${currentLimit} targetLimit=${targetLimit}`,
    )

    try {
      const entries = await AppRepository.featuredEntriesByMode(mode, targetLimit)
      if (!this.owner.isComponentActive || this.owner.homeLoadMorePrefetchToken !== token) {
        return
      }

      this.owner.homeLoadMorePrefetchLimit = targetLimit
      this.owner.homeLoadMorePrefetchEntries = entries
      this.owner.homeLoadMorePrefetchMode = mode
      this.owner.logHomeLoadMore(
        `prefetch done mode=${mode} targetLimit=${targetLimit} entries=${entries.length}`,
      )
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

  shouldRetryLoadMoreBlockedReason(reason: string): boolean {
    return reason === 'load-more-in-progress' || reason === 'initial-load-pending'
  }

  requestLoadMoreForMode(mode: SubscriptionMode): boolean {
    const blockedReason = this.loadMoreBlockedReason(mode)
    if (!!blockedReason || !this.canLoadMoreForMode(mode)) {
      this.owner.logHomePerf(`loadMore skip mode=${mode} reason=${blockedReason || 'canLoadMore=false'}`)
      return !!blockedReason ? !this.shouldRetryLoadMoreBlockedReason(blockedReason) : true
    }

    const now = Date.now()
    if (
      this.owner.lastHomeLoadMoreCompletedAt > 0
      && now - this.owner.lastHomeLoadMoreCompletedAt < HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS
    ) {
      this.owner.logHomePerf(`loadMore skip mode=${mode} reason=post-complete-cooldown`)
      return false
    }
    if (now - this.owner.lastHomeLoadMoreRequestedAt < HOME_LOAD_MORE_MIN_INTERVAL_MS) {
      this.owner.logHomePerf(`loadMore skip mode=${mode} reason=min-interval`)
      return false
    }
    this.owner.lastHomeLoadMoreRequestedAt = now

    const expandedVisible = this.expandVisibleEntriesForMode(mode)
    const totalCount = this.totalEntryCountFor(mode)
    const visibleLimit = this.visibleEntryLimitFor(mode)
    const remainingBufferedCount = Math.max(0, totalCount - visibleLimit)
    const fetchAheadBufferThreshold =
      resolveHomeVisibleEntryLoadMoreStep(mode) * HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER
    if (expandedVisible && remainingBufferedCount > fetchAheadBufferThreshold) {
      return true
    }

    if (!this.owner.homeHasMoreEntries) {
      return true
    }

    const previousTotal = this.owner.featuredEntries.length
    const previousModeTotal = this.totalEntryCountFor(mode)
    const currentModeLimit = this.candidateLimitForMode(mode)
    const nextLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentModeLimit + resolveHomeVisibleEntryLoadMoreStep(mode),
    )
    if (nextLimit <= currentModeLimit) {
      this.setModeHasMoreEntries(
        mode,
        false,
        `next-limit-clamped nextLimit=${nextLimit} currentLimit=${currentModeLimit}`,
      )
      return true
    }

    this.owner.homeLoadMoreInProgress = true
    const requestToken = this.owner.homeLoadMoreRequestToken + 1
    this.owner.homeLoadMoreRequestToken = requestToken
    const prefetchedEntries = this.consumePrefetchedHomeEntries(mode, nextLimit)
    const requestStartedAt = Date.now()
    this.owner.logHomePerf(
      `loadMore start mode=${mode} nextLimit=${nextLimit} hasPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
    )
    this.owner.logHomeLoadMore(
      `request start mode=${mode} prevTotal=${previousTotal} currentLimit=${currentModeLimit} nextLimit=${nextLimit}`,
    )

    const loadPromise = prefetchedEntries
      ? (async () => {
          this.syncModePaginationFromReloadResult(mode, prefetchedEntries, nextLimit)
          this.owner.applyEntriesForMode(mode, prefetchedEntries, true)
        })()
      : this.appendFeaturedEntriesFromLocalFast(mode, nextLimit)

    void loadPromise
      .then(() => {
        if (this.owner.homeLoadMoreRequestToken !== requestToken) {
          return
        }

        const currentTotal = this.owner.featuredEntries.length
        const currentModeTotal = this.totalEntryCountFor(mode)
        const modeHasGrowth = currentModeTotal > previousModeTotal
        if (modeHasGrowth) {
          this.setModeNoProgressCount(mode, 0)
        } else if (!this.hasBufferedEntriesForMode(mode)) {
          const nextNoProgressCount = this.modeNoProgressCount(mode) + 1
          this.setModeNoProgressCount(mode, nextNoProgressCount)
        }
        if (this.candidateLimitForMode(mode) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT) {
          this.setModeHasMoreEntries(
            mode,
            false,
            `candidate-limit-max mode=${mode} limit=${this.candidateLimitForMode(mode)}`,
          )
        }

        if (expandedVisible && !this.hasBufferedEntriesForMode(mode)) {
          this.expandVisibleEntriesForMode(mode)
        }
        this.owner.logHomeLoadMore(
          `request done mode=${mode} prevTotal=${previousTotal} currentTotal=${currentTotal} `
          + `prevModeTotal=${previousModeTotal} currentModeTotal=${currentModeTotal} `
          + `candidateLimit=${this.candidateLimitForMode(mode)} hasMore=${this.owner.homeHasMoreEntries} `
          + `modeHasMore=${this.modeHasMoreEntries(mode)} noProgress=${this.modeNoProgressCount(mode)} `
          + `usedPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
        )
      })
      .catch((error: Error | string | Object) => {
        this.owner.logHomeLoadMore(`request failed mode=${mode} error=${this.owner.describeError(error)}`)
        this.owner.logHomeAsyncError(`load-more-request mode=${mode}`, error)
      })
      .finally(() => {
        if (this.owner.homeLoadMoreRequestToken !== requestToken) {
          return
        }
        this.owner.homeLoadMoreInProgress = false
        this.owner.lastHomeLoadMoreCompletedAt = Date.now()
        this.scheduleHomeLoadMorePrefetch()
        this.owner.logHomePerf(
          `loadMore done mode=${mode} elapsedMs=${Date.now() - requestStartedAt} total=${this.owner.featuredEntries.length}`,
        )
        if (this.pendingLoadMoreForMode(mode)) {
          this.flushPendingLoadMoreForMode(mode)
        }
      })
    return true
  }

  private setPendingLoadMoreForMode(mode: SubscriptionMode, pending: boolean): void {
    this.homePendingLoadMoreModes =
      withHomePendingLoadMoreValue(mode, pending, this.homePendingLoadMoreModes)
  }

  pendingLoadMoreForMode(mode: SubscriptionMode): boolean {
    return homeModePendingLoadMoreValue(mode, this.homePendingLoadMoreModes)
  }

  private modeLoadMoreTimestampValue(mode: SubscriptionMode): number {
    return homeLoadMoreTimestampValue(mode, this.homeLastItemAppearLoadMoreAt)
  }

  private setModeLoadMoreTimestamp(mode: SubscriptionMode, value: number): void {
    this.homeLastItemAppearLoadMoreAt =
      withHomeLoadMoreTimestampValue(mode, value, this.homeLastItemAppearLoadMoreAt)
  }

  private modeScrollProgressLoadMoreValue(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeLastScrollProgressLoadMoreAt)
  }

  private setModeScrollProgressLoadMoreValue(mode: SubscriptionMode, value: number): void {
    this.homeLastScrollProgressLoadMoreAt =
      withHomeModeNumberValue(mode, value, this.homeLastScrollProgressLoadMoreAt)
  }

  resetModeScrollProgressLoadMoreValue(mode: SubscriptionMode): void {
    this.setModeScrollProgressLoadMoreValue(mode, 0)
  }

  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void {
    if (
      mode !== this.owner.mode
      || !this.owner.isHomeRootTab()
      || this.owner.searchOverlayVisible
      || this.owner.hasHomeInlineSearchQuery()
    ) {
      return
    }
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return
    }
    if (this.owner.homeInitialLoadPending || this.owner.homeLoadMoreInProgress || this.pendingLoadMoreForMode(mode)) {
      return
    }
    const totalCount = this.totalEntryCountFor(mode)
    const visibleCount = this.visibleEntryCountFor(mode)
    const hasBufferedEntries = visibleCount < totalCount
    if (!hasBufferedEntries && (!this.owner.homeHasMoreEntries || !this.modeHasMoreEntries(mode))) {
      return
    }
    if (!shouldPreloadHomeVisibleEntries(mode, currentOffset, totalCount, visibleCount)) {
      return
    }
    if (this.owner.isHomeScrollInteracting && !this.hasRecentHomeScrollIntent()) {
      return
    }
    const scrollIntentVersion = this.owner.modeScrollIntentVersion(mode)
    if (
      this.owner.isHomeScrollInteracting
      && scrollIntentVersion <= this.owner.consumedModeScrollIntentVersion(mode)
    ) {
      return
    }

    const previousOffset = this.modeScrollProgressLoadMoreValue(mode)
    if (currentOffset <= previousOffset && visibleCount >= resolveHomeVisibleEntryLoadMoreStep(mode)) {
      return
    }

    this.setModeScrollProgressLoadMoreValue(mode, currentOffset)
    this.owner.setConsumedModeScrollIntentVersion(mode, scrollIntentVersion)
    this.enqueueLoadMoreForMode(mode, 'scroll-progress')
  }

  private shouldAcceptItemAppearLoadMore(mode: SubscriptionMode): boolean {
    const now = Date.now()
    const previousAt = this.modeLoadMoreTimestampValue(mode)
    if (now - previousAt < HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS) {
      return false
    }
    this.setModeLoadMoreTimestamp(mode, now)
    return true
  }

  private enqueueLoadMoreForMode(mode: SubscriptionMode, source: string): void {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return
    }
    if (source === 'item-appear' && !this.shouldAcceptItemAppearLoadMore(mode)) {
      return
    }

    if (source === 'item-appear' && this.owner.homeLoadMoreInProgress) {
      return
    }

    const alreadyPending = this.pendingLoadMoreForMode(mode)
    if (!alreadyPending) {
      this.setPendingLoadMoreForMode(mode, true)
      this.owner.logHomePerf(`loadMore enqueue mode=${mode} source=${source} interacting=${this.owner.isHomeScrollInteracting}`)
    }

    if (source === 'item-appear') {
      if (alreadyPending || this.owner.homeLoadMoreInProgress) {
        return
      }
      this.owner.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (source === 'scroll-progress') {
      if (alreadyPending || this.owner.homeLoadMoreInProgress) {
        return
      }
      this.owner.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (!this.owner.isHomeScrollInteracting) {
      this.flushPendingLoadMoreForMode(mode)
      return
    }
    if (source === 'footer-visible') {
      return
    }
  }

  flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
    if (!this.pendingLoadMoreForMode(mode)) {
      return
    }
    // 拖拽中不扩展列表，减少滚动卡顿。
    if (this.owner.isHomeScrollInteracting) {
      return
    }
    this.owner.runManagedTimeout(() => {
      if (!this.pendingLoadMoreForMode(mode)) {
        return
      }
      const handled = this.requestLoadMoreForMode(mode)
      if (handled) {
        this.setPendingLoadMoreForMode(mode, false)
        return
      }
      this.owner.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
    }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
  }

  private shouldPrefetchLoadMoreAtIndex(visibleCount: number, index: number): boolean {
    if (visibleCount <= 0) {
      return false
    }
    const remainingVisibleCount = visibleCount - index - 1
    const dynamicThreshold = Math.max(
      HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
      Math.floor(visibleCount / HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR),
    )
    return remainingVisibleCount <= dynamicThreshold
  }

  private shouldEnableLoadMorePrefetchForMode(mode: SubscriptionMode): boolean {
    // 只在用户真实滚动后启用预取，避免首屏装载阶段触发额外查询。
    return !this.shouldRenderAllEntriesForMode(mode) && this.hasRecentHomeScrollIntent()
  }

  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void {
    if (!HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED) {
      return
    }
    if (!this.shouldEnableLoadMorePrefetchForMode(mode)) {
      return
    }
    if (!this.shouldPrefetchLoadMoreAtIndex(totalCount, index)) {
      return
    }
    this.enqueueLoadMoreForMode(mode, 'item-appear')
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
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      merged.push(entry)
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

  ensureModeEntriesLoaded(mode: SubscriptionMode): void {
    const hasModeEntries = this.totalEntryCountFor(mode) > 0
    const fullModeReady = !this.shouldRenderAllEntriesForMode(mode)
      || this.candidateLimitForMode(mode) >= HOME_FULL_MODE_CANDIDATE_LIMIT
    if (this.isModeLoaded(mode) && hasModeEntries && fullModeReady) {
      return
    }
    if (this.isModeLoading(mode) || this.owner.homeLoadMoreInProgress) {
      return
    }
    this.setModeLoading(mode, true)
    const limit = this.resolveHomeCandidateLimitForMode(mode, HOME_MODE_SWITCH_CANDIDATE_LIMIT)
    void this.owner.reloadFeaturedEntriesFromLocal(limit, false, true, true, mode)
      .catch((error: Error | string | Object) => {
        this.owner.logHomeAsyncError(`ensure-mode-loaded mode=${mode}`, error)
      })
      .finally(() => {
        this.setModeLoading(mode, false)
      })
  }
}
