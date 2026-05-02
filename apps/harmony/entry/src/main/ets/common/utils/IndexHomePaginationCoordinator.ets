import { EntryCardModel } from '../models/LivoModels'
import {
  HOME_LOAD_MORE_AFTER_STOP_DELAY_MS,
  HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER,
  HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  HOME_LOAD_MORE_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
  HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS,
  HOME_MODE_SWITCH_CANDIDATE_LIMIT,
  HomeModeLoadMoreTimestampMap,
  HomeModePendingLoadMoreMap,
  HomeModeScrollOffsetMap,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import {
  createHomeLoadMoreTimestampMap,
  createHomePendingLoadMoreMap,
  createHomeScrollOffsetMap,
  homeLoadMoreTimestampValue,
  homeModeNumberValue,
  homeModePendingLoadMoreValue,
  withHomeLoadMoreTimestampValue,
  withHomeModeNumberValue,
  withHomePendingLoadMoreValue,
} from './IndexHomeStateFactory'
import { resolveHomeVisibleEntryLoadMoreStep, shouldPreloadHomeVisibleEntries } from './HomeVisibleEntryPolicy'
import { HomePrefetchCoordinator } from './HomePrefetchCoordinator'
export { IndexHomePaginationOwner } from './HomePaginationState'

export class IndexHomePaginationCoordinator extends HomePrefetchCoordinator {
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = createHomePendingLoadMoreMap()
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = createHomeLoadMoreTimestampMap()
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()

  resetModeLoadMoreStates(reason: string): void {
    this.owner.homeHasMoreEntriesByMode = { articles: true, social: true, pictures: true, videos: true }
    this.owner.homeModeNoProgressLoadMoreCount = { articles: 0, social: 0, pictures: 0, videos: 0 }
    this.homePendingLoadMoreModes = createHomePendingLoadMoreMap()
    this.homeLastItemAppearLoadMoreAt = createHomeLoadMoreTimestampMap()
    this.homeLastScrollProgressLoadMoreAt = createHomeScrollOffsetMap()
    this.owner.logHomeLoadState(`mode loadMore state reset reason=${reason}`)
  }

  hasRecentHomeScrollIntent(): boolean {
    return this.owner.homeScrollIntent.hasRecentIntent()
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

  loadMoreBlockedReason(mode: SubscriptionMode): string {
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    if (!this.owner.isHomeRootTab()) { return 'not-home-tab' }
    if (mode !== this.owner.mode) { return 'inactive-mode' }
    if (this.owner.searchOverlayVisible) { return 'search-overlay' }
    if (this.owner.hasHomeInlineSearchQuery()) { return 'search-query-active' }
    if (this.owner.homeInitialLoadPending) { return 'initial-load-pending' }
    if (this.owner.homeLoadMoreInProgress) { return 'load-more-in-progress' }
    if (!hasBufferedEntries && !this.modeHasMoreEntries(mode)) { return 'mode-no-more' }
    if (!hasBufferedEntries && !this.owner.homeHasMoreEntries) { return 'no-buffer-and-no-more' }
    if (!this.hasRecentHomeScrollIntent()) { return 'no-recent-scroll-intent' }
    return ''
  }

  private shouldRetryLoadMoreBlockedReason(reason: string): boolean {
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
      this.setModeHasMoreEntries(mode, false, `next-limit-clamped nextLimit=${nextLimit} currentLimit=${currentModeLimit}`)
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
        if (this.owner.homeLoadMoreRequestToken !== requestToken) { return }
        const currentModeTotal = this.totalEntryCountFor(mode)
        const modeHasGrowth = currentModeTotal > previousModeTotal
        if (modeHasGrowth) {
          this.setModeNoProgressCount(mode, 0)
        } else if (!this.hasBufferedEntriesForMode(mode)) {
          this.setModeNoProgressCount(mode, this.modeNoProgressCount(mode) + 1)
        }
        if (this.candidateLimitForMode(mode) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT) {
          this.setModeHasMoreEntries(mode, false, `candidate-limit-max mode=${mode} limit=${this.candidateLimitForMode(mode)}`)
        }
        if (expandedVisible && !this.hasBufferedEntriesForMode(mode)) {
          this.expandVisibleEntriesForMode(mode)
        }
        this.owner.logHomeLoadMore(
          `request done mode=${mode} prevTotal=${previousTotal} currentTotal=${this.owner.featuredEntries.length} `
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
        if (this.owner.homeLoadMoreRequestToken !== requestToken) { return }
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

  pendingLoadMoreForMode(mode: SubscriptionMode): boolean {
    return homeModePendingLoadMoreValue(mode, this.homePendingLoadMoreModes)
  }

  private setPendingLoadMoreForMode(mode: SubscriptionMode, pending: boolean): void {
    this.homePendingLoadMoreModes = withHomePendingLoadMoreValue(mode, pending, this.homePendingLoadMoreModes)
  }

  private modeLoadMoreTimestampValue(mode: SubscriptionMode): number {
    return homeLoadMoreTimestampValue(mode, this.homeLastItemAppearLoadMoreAt)
  }

  private setModeLoadMoreTimestamp(mode: SubscriptionMode, value: number): void {
    this.homeLastItemAppearLoadMoreAt = withHomeLoadMoreTimestampValue(mode, value, this.homeLastItemAppearLoadMoreAt)
  }

  private modeScrollProgressLoadMoreValue(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeLastScrollProgressLoadMoreAt)
  }

  private setModeScrollProgressLoadMoreValue(mode: SubscriptionMode, value: number): void {
    this.homeLastScrollProgressLoadMoreAt = withHomeModeNumberValue(mode, value, this.homeLastScrollProgressLoadMoreAt)
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
    ) { return }
    if (this.shouldRenderAllEntriesForMode(mode)) { return }
    if (this.owner.homeInitialLoadPending || this.owner.homeLoadMoreInProgress || this.pendingLoadMoreForMode(mode)) {
      return
    }
    const totalCount = this.totalEntryCountFor(mode)
    const visibleCount = this.visibleEntryCountFor(mode)
    const hasBufferedEntries = visibleCount < totalCount
    if (!hasBufferedEntries && (!this.owner.homeHasMoreEntries || !this.modeHasMoreEntries(mode))) { return }
    if (!shouldPreloadHomeVisibleEntries(mode, currentOffset, totalCount, visibleCount)) { return }
    if (this.owner.homeScrollIntent.isInteracting && !this.hasRecentHomeScrollIntent()) { return }
    const scrollIntentVersion = this.owner.homeScrollIntent.intentVersion(mode)
    if (
      this.owner.homeScrollIntent.isInteracting
      && scrollIntentVersion <= this.owner.homeScrollIntent.consumedVersion(mode)
    ) { return }
    const previousOffset = this.modeScrollProgressLoadMoreValue(mode)
    if (currentOffset <= previousOffset && visibleCount >= resolveHomeVisibleEntryLoadMoreStep(mode)) { return }
    this.setModeScrollProgressLoadMoreValue(mode, currentOffset)
    this.owner.homeScrollIntent.setConsumedVersion(mode, scrollIntentVersion)
    this.enqueueLoadMoreForMode(mode, 'scroll-progress')
  }

  private shouldAcceptItemAppearLoadMore(mode: SubscriptionMode): boolean {
    const now = Date.now()
    const previousAt = this.modeLoadMoreTimestampValue(mode)
    if (now - previousAt < HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS) { return false }
    this.setModeLoadMoreTimestamp(mode, now)
    return true
  }

  private enqueueLoadMoreForMode(mode: SubscriptionMode, source: string): void {
    if (this.shouldRenderAllEntriesForMode(mode)) { return }
    if (source === 'item-appear' && !this.shouldAcceptItemAppearLoadMore(mode)) { return }
    if (source === 'item-appear' && this.owner.homeLoadMoreInProgress) { return }

    const alreadyPending = this.pendingLoadMoreForMode(mode)
    if (!alreadyPending) {
      this.setPendingLoadMoreForMode(mode, true)
      this.owner.logHomePerf(`loadMore enqueue mode=${mode} source=${source} interacting=${this.owner.homeScrollIntent.isInteracting}`)
    }

    if (source === 'item-appear' || source === 'scroll-progress') {
      if (alreadyPending || this.owner.homeLoadMoreInProgress) { return }
      this.owner.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (!this.owner.homeScrollIntent.isInteracting) {
      this.flushPendingLoadMoreForMode(mode)
    }
  }

  flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
    if (!this.pendingLoadMoreForMode(mode)) { return }
    // 拖拽中不扩展列表，减少滚动卡顿。
    if (this.owner.homeScrollIntent.isInteracting) { return }
    this.owner.runManagedTimeout(() => {
      if (!this.pendingLoadMoreForMode(mode)) { return }
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
    if (visibleCount <= 0) { return false }
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
    if (!HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED) { return }
    if (!this.shouldEnableLoadMorePrefetchForMode(mode)) { return }
    if (!this.shouldPrefetchLoadMoreAtIndex(totalCount, index)) { return }
    this.enqueueLoadMoreForMode(mode, 'item-appear')
  }

  ensureModeEntriesLoaded(mode: SubscriptionMode): void {
    const hasModeEntries = this.totalEntryCountFor(mode) > 0
    const fullModeReady = !this.shouldRenderAllEntriesForMode(mode)
      || this.candidateLimitForMode(mode) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT
    if (this.isModeLoaded(mode) && hasModeEntries && fullModeReady) { return }
    if (this.isModeLoading(mode) || this.owner.homeLoadMoreInProgress) { return }
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
