import { FeaturedEntriesQuery } from '../../data/FeaturedEntriesQuery'
import { EntryCardModel } from '../../models/LivoModels'
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
} from '../../components/HomeRootConfig'
import {
  createHomeLoadMoreTimestampMap,
  createHomePendingLoadMoreMap,
  createHomeScrollOffsetMap,
  perModeGet,
  perModeSet,
  perModeSetMut,
} from './HomeModeMapHelpers'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
  shouldPreloadHomeVisibleEntries,
} from './HomeVisibleEntryPolicy'
import { HomeFeedPaginationState } from './HomeFeedPaginationState'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { HomeFeedLoadMorePrefetch } from './HomeFeedLoadMorePrefetch'
import { HomeFeedLoadMoreDrain } from './HomeFeedLoadMoreDrain'
import { HomeFeedGuard, HomeFeedGuardProvider } from './HomeFeedGuard'
import { mergeUniqueEntries } from './HomeEntryUtils'

export class HomeFeedPagination extends HomeFeedPaginationState {
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = createHomePendingLoadMoreMap()
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = createHomeLoadMoreTimestampMap()
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private readonly featuredEntriesQuery: FeaturedEntriesQuery
  private readonly guard: HomeFeedGuard
  private readonly prefetcher: HomeFeedLoadMorePrefetch
  private readonly drainController: HomeFeedLoadMoreDrain

  constructor(
    state: HomeFeedState,
    actions: HomeFeedActions,
    featuredEntriesQuery?: FeaturedEntriesQuery,
  ) {
    super(state, actions)
    this.featuredEntriesQuery = featuredEntriesQuery ?? FeaturedEntriesQuery.default
    const provider = new HomeFeedGuardProvider(
      () => actions.isHomeRootTab(),
      () => actions.hasHomeInlineSearchQuery(),
      () => actions.hasRecentHomeScrollIntent(),
      (mode: SubscriptionMode) => actions.pendingLoadMoreForMode(mode),
      (mode: SubscriptionMode) => this.shouldRenderAllEntriesForMode(mode),
      (mode: SubscriptionMode) => this.hasBufferedEntriesForMode(mode),
      (mode: SubscriptionMode) => this.modeHasMoreEntries(mode),
      (mode: SubscriptionMode) => actions.readHomeModeScrollOffset(mode),
    )
    this.guard = new HomeFeedGuard(state, provider)
    // HomeFeedPagination(State) already exposes the trio of methods the prefetch
    // owner interface needs, so we pass `this` directly instead of an inline
    // object literal (ArkTS forbids untyped object literals).
    this.prefetcher = new HomeFeedLoadMorePrefetch(state, actions, this, this.featuredEntriesQuery)
    this.drainController = new HomeFeedLoadMoreDrain(state, actions, this)
  }

  // === Prefetch (delegated to HomeFeedLoadMorePrefetch) ===
  canPrefetchHomeLoadMore(): boolean { return this.prefetcher.canPrefetch() }
  invalidateHomeLoadMorePrefetch(): void { this.prefetcher.invalidate() }
  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void { this.prefetcher.schedule(delayMs) }
  async prefetchHomeLoadMore(): Promise<void> { await this.prefetcher.run() }
  consumePrefetchedHomeEntries(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    return this.prefetcher.consume(mode, nextLimit)
  }

  private resolveLoadMoreStepForMode(mode: SubscriptionMode): number {
    // 每个栏目的一页数量集中在 HomeVisibleEntryPolicy 中维护。
    return resolveHomeVisibleEntryLoadMoreStep(mode)
  }

  private shouldUseLeanLoadMoreApply(mode: SubscriptionMode): boolean {
    return mode === 'articles' || mode === 'social' || mode === 'pictures' || mode === 'videos'
  }

  private applyEntriesForLoadMore(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    skipNotify: boolean,
  ): void {
    const leanApply = this.shouldUseLeanLoadMoreApply(mode)
    this.actions.applyEntriesForMode(mode, entries, true, skipNotify, leanApply, leanApply)
  }

  private revealLoadedEntriesForLoadMore(
    mode: SubscriptionMode,
    previousVisibleTotal: number,
    nextTotal: number,
  ): void {
    if (nextTotal <= previousVisibleTotal) {
      return
    }
    const nextVisibleLimit = Math.min(
      nextTotal,
      Math.max(this.visibleEntryLimitFor(mode), previousVisibleTotal + resolveHomeVisibleEntryLoadMoreStep(mode)),
    )
    this.setVisibleEntryLimitFor(mode, nextVisibleLimit)
  }

  async appendFeaturedEntriesFromLocalFast(mode: SubscriptionMode, nextLimit: number): Promise<void> {
    const previousEntries = this.actions.filteredEntriesFor(mode)
    const previousTotal = previousEntries.length
    const currentLimit = this.candidateLimitForMode(mode)
    const appendCount = Math.max(1, nextLimit - currentLimit)
    const pageQueryStartedAt = Date.now()
    const nextPage = await this.featuredEntriesQuery.featuredEntriesFastPageByMode(mode, appendCount, previousTotal)
    this.actions.logHomeLoadMore(
      `append-page mode=${mode} prevTotal=${previousTotal} appendCount=${appendCount} nextPage=${nextPage.length} queryMs=${Date.now() - pageQueryStartedAt}`,
    )

    if (nextPage.length === 0) {
      this.setCandidateLimitForMode(mode, nextLimit)
      this.actions.logHomeLoadMore(
        `append-fast-empty mode=${mode} prevTotal=${previousTotal} appendCount=${appendCount} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await this.featuredEntriesQuery.featuredEntriesByMode(mode, nextLimit)
      this.syncModePaginationFromReloadResult(mode, fallbackEntries, nextLimit)
      if (fallbackEntries.length <= previousTotal) {
        this.setModeHasMoreEntries(
          mode,
          false,
          `append-empty-fallback prevTotal=${previousTotal} fallback=${fallbackEntries.length} nextLimit=${nextLimit}`,
        )
      }
      this.applyEntriesForLoadMore(mode, fallbackEntries, false)
      return
    }

    const merged = mergeUniqueEntries(previousEntries, nextPage)

    const appendedUniqueCount = Math.max(0, merged.length - previousTotal)
    if (appendedUniqueCount === 0) {
      this.actions.logHomeLoadMore(
        `append-no-unique prevTotal=${previousTotal} appendCount=${appendCount} nextPage=${nextPage.length} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await this.featuredEntriesQuery.featuredEntriesByMode(mode, nextLimit)
      this.syncModePaginationFromReloadResult(mode, fallbackEntries, nextLimit)
      if (fallbackEntries.length <= previousTotal) {
        this.setModeHasMoreEntries(
          mode,
          false,
          `append-no-progress prevTotal=${previousTotal} fallback=${fallbackEntries.length} nextLimit=${nextLimit}`,
        )
      }
      this.applyEntriesForLoadMore(mode, fallbackEntries, false)
      return
    }

    this.setCandidateLimitForMode(mode, nextLimit)
    this.revealLoadedEntriesForLoadMore(mode, previousTotal, merged.length)
    this.applyEntriesForLoadMore(mode, merged, true)
    this.actions.notifyHomeEntryDataAppendedForMode(mode, previousTotal)
  }

  private applyResolvedLoadMoreEntries(
    mode: SubscriptionMode,
    nextEntries: EntryCardModel[],
    previousTotal: number,
    nextLimit: number,
  ): void {
    const startedAt = Date.now()
    this.syncModePaginationFromReloadResult(mode, nextEntries, nextLimit)
    const syncedAt = Date.now()
    this.revealLoadedEntriesForLoadMore(mode, previousTotal, nextEntries.length)
    this.applyEntriesForLoadMore(mode, nextEntries, true)
    const appliedAt = Date.now()
    if (nextEntries.length > previousTotal) {
      if (mode === 'articles' || mode === 'social') {
        this.actions.beginTweetPresentationDiagSession(mode, 'prefetch-resolve', previousTotal)
      }
      this.actions.notifyHomeEntryDataAppendedForMode(mode, previousTotal)
      this.actions.runManagedTimeout(() => {
        this.actions.flushTweetPresentationDiagSession('prefetch-resolve-post-append')
      }, 600)
      this.actions.logHomeLoadMore(
        `applyResolvedLoadMoreEntries mode=${mode} growth=true prevTotal=${previousTotal} nextEntries=${nextEntries.length} `
        + `syncMs=${syncedAt - startedAt} applyMs=${appliedAt - syncedAt} totalMs=${Date.now() - startedAt}`,
      )
      return
    }
    this.actions.notifyHomeEntryDataReloadedForMode(mode)
    this.actions.logHomeLoadMore(
      `applyResolvedLoadMoreEntries mode=${mode} growth=false prevTotal=${previousTotal} nextEntries=${nextEntries.length} `
      + `syncMs=${syncedAt - startedAt} applyMs=${appliedAt - syncedAt} totalMs=${Date.now() - startedAt}`,
    )
  }

  // === Load-more triggers ===
  resetModeLoadMoreStates(reason: string): void {
    this.state.homeHasMoreEntriesByMode = { articles: true, social: true, pictures: true, videos: true }
    this.state.homeModeNoProgressLoadMoreCount = { articles: 0, social: 0, pictures: 0, videos: 0 }
    this.homePendingLoadMoreModes = createHomePendingLoadMoreMap()
    this.homeLastItemAppearLoadMoreAt = createHomeLoadMoreTimestampMap()
    this.homeLastScrollProgressLoadMoreAt = createHomeScrollOffsetMap()
    this.actions.logHomeLoadState(`mode loadMore state reset reason=${reason}`)
  }

  hasRecentHomeScrollIntent(): boolean {
    return this.state.homeScrollIntent.hasRecentIntent()
  }

  canLoadMoreForMode(mode: SubscriptionMode): boolean {
    return this.guard.canLoadMore(mode)
  }

  loadMoreBlockedReason(mode: SubscriptionMode, allowStaleScrollIntent: boolean = false): string {
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    if (!this.actions.isHomeRootTab()) { return 'not-home-tab' }
    if (mode !== this.state.mode) { return 'inactive-mode' }
    if (this.state.searchOverlayVisible) { return 'search-overlay' }
    if (this.actions.hasHomeInlineSearchQuery()) { return 'search-query-active' }
    if (this.state.homeInitialLoadPending) { return 'initial-load-pending' }
    if (this.state.homeLoadMoreInProgress) { return 'load-more-in-progress' }
    if (!hasBufferedEntries && !this.modeHasMoreEntries(mode)) { return 'mode-no-more' }
    if (!hasBufferedEntries && !this.state.homeHasMoreEntries) { return 'no-buffer-and-no-more' }
    if (!allowStaleScrollIntent && !this.hasRecentHomeScrollIntent()) { return 'no-recent-scroll-intent' }
    return ''
  }

  private shouldRetryLoadMoreBlockedReason(reason: string): boolean {
    // 'no-recent-scroll-intent' is transient: once another scroll arrives the
    // pending request can succeed, so keep it queued instead of dropping it.
    return reason === 'load-more-in-progress'
      || reason === 'initial-load-pending'
      || reason === 'no-recent-scroll-intent'
  }

  requestLoadMoreForMode(mode: SubscriptionMode, allowStaleScrollIntent: boolean = false): boolean {
    const blockedReason = this.loadMoreBlockedReason(mode, allowStaleScrollIntent)
    if (!!blockedReason || !this.canLoadMoreForMode(mode)) {
      this.actions.logHomePerf(`loadMore skip mode=${mode} reason=${blockedReason || 'canLoadMore=false'}`)
      return !!blockedReason ? !this.shouldRetryLoadMoreBlockedReason(blockedReason) : true
    }

    const now = Date.now()
    if (
      this.state.lastHomeLoadMoreCompletedAt > 0
      && now - this.state.lastHomeLoadMoreCompletedAt < HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS
    ) {
      this.actions.logHomePerf(`loadMore skip mode=${mode} reason=post-complete-cooldown`)
      return false
    }
    if (now - this.state.lastHomeLoadMoreRequestedAt < HOME_LOAD_MORE_MIN_INTERVAL_MS) {
      this.actions.logHomePerf(`loadMore skip mode=${mode} reason=min-interval`)
      return false
    }
    this.state.lastHomeLoadMoreRequestedAt = now

    const expandedVisible = this.expandVisibleEntriesForMode(mode)
    const totalCount = this.totalEntryCountFor(mode)
    const visibleLimit = this.visibleEntryLimitFor(mode)
    const remainingBufferedCount = Math.max(0, totalCount - visibleLimit)
    const fetchAheadBufferThreshold =
      Math.max(1, Math.floor(resolveHomeVisibleEntryLoadMoreStep(mode) / HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER))
    if (expandedVisible && remainingBufferedCount > fetchAheadBufferThreshold) {
      console.info(
        `[LIVO-PERF] loadMore expand-only mode=${mode} visibleLimit=${visibleLimit} totalCount=${totalCount} remainingBuffered=${remainingBufferedCount}`,
      )
      return true
    }
    if (!this.state.homeHasMoreEntries) {
      return true
    }

    console.info(
      `[LIVO-PERF] loadMore full-fetch mode=${mode} expandedVisible=${String(expandedVisible)} remainingBuffered=${remainingBufferedCount} totalCount=${totalCount}`,
    )
    const previousTotal = this.state.featuredEntries.length
    const previousModeTotal = this.totalEntryCountFor(mode)
    const currentModeLimit = this.candidateLimitForMode(mode)
    const loadMoreStep = this.resolveLoadMoreStepForMode(mode)
    const nextLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentModeLimit + loadMoreStep,
    )
    if (nextLimit <= currentModeLimit) {
      this.setModeHasMoreEntries(mode, false, `next-limit-clamped nextLimit=${nextLimit} currentLimit=${currentModeLimit}`)
      return true
    }

    const requestToken = this.state.homeLoadMoreRequestToken + 1
    this.state.homeLoadMoreRequestToken = requestToken
    const prefetchedEntries = this.consumePrefetchedHomeEntries(mode, nextLimit)
    const shouldShowLoadMoreFooter = !prefetchedEntries
    if (shouldShowLoadMoreFooter) {
      this.state.homeLoadMoreInProgress = true
    }
    const requestStartedAt = Date.now()
    this.actions.logHomePerf(
      `loadMore start mode=${mode} nextLimit=${nextLimit} hasPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
    )
    this.actions.logHomeLoadMore(
      `request start mode=${mode} prevTotal=${previousTotal} currentLimit=${currentModeLimit} nextLimit=${nextLimit}`,
    )
    if (mode === 'articles' || mode === 'social') {
      this.actions.beginTweetPresentationDiagSession(mode, 'request-start', previousModeTotal)
    }

    const loadPromise = prefetchedEntries
      ? (async () => {
          this.applyResolvedLoadMoreEntries(mode, prefetchedEntries, previousModeTotal, nextLimit)
        })()
      : this.appendFeaturedEntriesFromLocalFast(mode, nextLimit)

    void loadPromise
      .then(() => {
        if (this.state.homeLoadMoreRequestToken !== requestToken) { return }
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
        this.actions.logHomeLoadMore(
          `request done mode=${mode} prevTotal=${previousTotal} currentTotal=${this.state.featuredEntries.length} `
          + `prevModeTotal=${previousModeTotal} currentModeTotal=${currentModeTotal} `
          + `candidateLimit=${this.candidateLimitForMode(mode)} hasMore=${this.state.homeHasMoreEntries} `
          + `modeHasMore=${this.modeHasMoreEntries(mode)} noProgress=${this.modeNoProgressCount(mode)} `
          + `usedPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
        )
      })
      .catch((error: Error | string | Object) => {
        this.actions.logHomeLoadMore(`request failed mode=${mode} error=${this.actions.describeError(error)}`)
        this.actions.logHomeAsyncError(`load-more-request mode=${mode}`, error)
      })
      .finally(() => {
        if (this.state.homeLoadMoreRequestToken !== requestToken) { return }
        if (shouldShowLoadMoreFooter) {
          this.state.homeLoadMoreInProgress = false
        }
        this.state.lastHomeLoadMoreCompletedAt = Date.now()
        this.scheduleHomeLoadMorePrefetch()
        this.actions.logHomePerf(
          `loadMore done mode=${mode} elapsedMs=${Date.now() - requestStartedAt} total=${this.state.featuredEntries.length}`,
        )
        if (mode === 'articles' || mode === 'social') {
          this.actions.runManagedTimeout(() => {
            this.actions.flushTweetPresentationDiagSession('request-finally')
          }, 900)
        }
        if (this.pendingLoadMoreForMode(mode)) {
          this.flushPendingLoadMoreForMode(mode)
        }
      })
    return true
  }

  handleHomeListEndReach(mode: SubscriptionMode, totalCount: number): void {
    this.drainController.handleListEndReach(mode, totalCount)
  }

  pendingLoadMoreForMode(mode: SubscriptionMode): boolean {
    return perModeGet(mode, this.homePendingLoadMoreModes)
  }
  private setPendingLoadMoreForMode(mode: SubscriptionMode, pending: boolean): void {
    if (this.pendingLoadMoreForMode(mode) === pending) {
      return
    }
    this.homePendingLoadMoreModes = perModeSet(mode, pending, this.homePendingLoadMoreModes)
  }
  private modeLoadMoreTimestampValue(mode: SubscriptionMode): number {
    return perModeGet(mode, this.homeLastItemAppearLoadMoreAt)
  }
  private setModeLoadMoreTimestamp(mode: SubscriptionMode, value: number): void {
    this.homeLastItemAppearLoadMoreAt = perModeSet(mode, value, this.homeLastItemAppearLoadMoreAt)
  }

  private modeScrollProgressLoadMoreValue(mode: SubscriptionMode): number {
    return perModeGet(mode, this.homeLastScrollProgressLoadMoreAt)
  }

  private setModeScrollProgressLoadMoreValue(mode: SubscriptionMode, value: number): void {
    perModeSetMut(mode, value, this.homeLastScrollProgressLoadMoreAt)
  }

  resetModeScrollProgressLoadMoreValue(mode: SubscriptionMode): void {
    this.setModeScrollProgressLoadMoreValue(mode, 0)
  }

  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void {
    if (
      mode !== this.state.mode
      || !this.actions.isHomeRootTab()
      || this.state.searchOverlayVisible
      || this.actions.hasHomeInlineSearchQuery()
    ) { return }
    if (this.shouldRenderAllEntriesForMode(mode)) { return }
    if (this.state.homeInitialLoadPending || this.state.homeLoadMoreInProgress || this.pendingLoadMoreForMode(mode)) {
      return
    }
    const totalCount = this.totalEntryCountFor(mode)
    const visibleCount = this.visibleEntryCountFor(mode)

    if (!shouldPreloadHomeVisibleEntries(mode, currentOffset, totalCount, visibleCount)) { return }

    const hasBufferedEntries = visibleCount < totalCount
    if (!hasBufferedEntries && (!this.state.homeHasMoreEntries || !this.modeHasMoreEntries(mode))) { return }
    if (this.state.homeScrollIntent.isInteracting && !this.hasRecentHomeScrollIntent()) { return }
    const scrollIntentVersion = this.state.homeScrollIntent.intentVersion(mode)
    if (
      this.state.homeScrollIntent.isInteracting
      && scrollIntentVersion <= this.state.homeScrollIntent.consumedVersion(mode)
    ) { return }
    const previousOffset = this.modeScrollProgressLoadMoreValue(mode)
    if (currentOffset <= previousOffset && visibleCount >= resolveHomeVisibleEntryLoadMoreStep(mode)) { return }
    this.setModeScrollProgressLoadMoreValue(mode, currentOffset)
    this.state.homeScrollIntent.setConsumedVersion(mode, scrollIntentVersion)
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
    if (source === 'item-appear' && this.state.homeLoadMoreInProgress) { return }

    const alreadyPending = this.pendingLoadMoreForMode(mode)
    if (!alreadyPending) {
      this.setPendingLoadMoreForMode(mode, true)
      this.actions.logHomePerf(`loadMore enqueue mode=${mode} source=${source} interacting=${this.state.homeScrollIntent.isInteracting}`)
    }

    if (source === 'item-appear' || source === 'scroll-progress') {
      if (alreadyPending || this.state.homeLoadMoreInProgress) { return }
      this.actions.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (!this.state.homeScrollIntent.isInteracting) {
      this.flushPendingLoadMoreForMode(mode)
    }
  }

  flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
    if (!this.pendingLoadMoreForMode(mode)) { return }
    if (this.state.homeScrollIntent.isInteracting) { return }
    this.actions.runManagedTimeout(() => {
      if (!this.pendingLoadMoreForMode(mode)) { return }
      const handled = this.requestLoadMoreForMode(mode)
      if (handled) {
        this.setPendingLoadMoreForMode(mode, false)
        return
      }
      this.actions.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
    }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
  }
  private shouldPrefetchLoadMoreAtIndex(visibleCount: number, index: number): boolean {
    return this.shouldPrefetchLoadMoreAtIndexForMode(this.state.mode, visibleCount, index)
  }

  private shouldPrefetchLoadMoreAtIndexForMode(
    mode: SubscriptionMode,
    visibleCount: number,
    index: number,
  ): boolean {
    if (visibleCount <= 0) { return false }
    const remainingVisibleCount = visibleCount - index - 1
    // item-appear 回调在滚动期间高频触发（每张卡片进入可见区即执行一次），
    // 必须保持极轻量。此处仅根据 mode 字面量选择固定阈值；高度估算精确性由
    // maybeTriggerLoadMoreByScrollProgress 的 scroll-progress 分支负责。
    let dynamicThreshold = Math.max(
      HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
      Math.floor(visibleCount / HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR),
    )
    if (mode === 'articles') {
      dynamicThreshold = Math.max(6, Math.min(12, Math.floor(visibleCount / 4)))
    } else if (mode === 'social') {
      dynamicThreshold = Math.max(1, Math.min(2, Math.floor(visibleCount / 12)))
    } else if (mode === 'pictures') {
      dynamicThreshold = Math.max(5, Math.min(10, Math.floor(visibleCount / 3)))
    } else if (mode === 'videos') {
      // 视频每页加载 24 条（12 行），初始 36 条（18 行）。阈值用 visibleCount/3
      // 让触发点落在"剩 4-5 行"位置，避免在视频还充满视口时就预取下一页，
      // 配合 scroll-progress 触发器形成"远端预读 + 近端兜底"两层。
      dynamicThreshold = Math.max(8, Math.min(14, Math.floor(visibleCount / 3)))
    }
    return remainingVisibleCount <= dynamicThreshold
  }
  private shouldEnableLoadMorePrefetchForMode(mode: SubscriptionMode): boolean {
    return !this.shouldRenderAllEntriesForMode(mode) && this.hasRecentHomeScrollIntent()
  }
  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void {
    if (!HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED) { return }
    if (!this.shouldEnableLoadMorePrefetchForMode(mode)) { return }
    if (!this.shouldPrefetchLoadMoreAtIndexForMode(mode, totalCount, index)) { return }
    this.enqueueLoadMoreForMode(mode, 'item-appear')
  }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void {
    const hasModeEntries = this.totalEntryCountFor(mode) > 0
    const initialModeReady = this.shouldRenderAllEntriesForMode(mode)
      ? this.candidateLimitForMode(mode) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT
      : this.totalEntryCountFor(mode) >= resolveHomeVisibleEntryInitialLimit(mode)
    if (this.isModeLoaded(mode) && hasModeEntries && initialModeReady) {
      this.scheduleHomeLoadMorePrefetch(120)
      return
    }
    if (this.isModeLoading(mode) || this.state.homeLoadMoreInProgress) { return }
    this.setModeLoading(mode, true)
    const limit = this.resolveHomeCandidateLimitForMode(mode, HOME_MODE_SWITCH_CANDIDATE_LIMIT)
    void this.actions.reloadFeaturedEntriesFromLocal(limit, false, true, true, mode)
      .catch((error: Error | string | Object) => {
        this.actions.logHomeAsyncError(`ensure-mode-loaded mode=${mode}`, error)
      })
      .finally(() => {
        this.setModeLoading(mode, false)
        this.scheduleHomeLoadMorePrefetch(120)
      })
  }
}