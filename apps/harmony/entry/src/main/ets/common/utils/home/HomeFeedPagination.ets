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
  homeLoadMoreTimestampValue,
  homeModeNumberValue,
  homeModePendingLoadMoreValue,
  withHomeLoadMoreTimestampValue,
  withHomeModeNumberValue,
  withHomePendingLoadMoreValue,
} from './HomeModeMapHelpers'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
  shouldPreloadHomeVisibleEntries,
} from './HomeVisibleEntryPolicy'
import { HomeFeedPaginationState } from './HomeFeedPaginationState'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'
import { HomeFeedLoadMorePrefetch } from './HomeFeedLoadMorePrefetch'
import { HomeFeedLoadMoreDrain } from './HomeFeedLoadMoreDrain'

export class HomeFeedPagination extends HomeFeedPaginationState {
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = createHomePendingLoadMoreMap()
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = createHomeLoadMoreTimestampMap()
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private readonly prefetcher: HomeFeedLoadMorePrefetch
  private readonly drainController: HomeFeedLoadMoreDrain

  constructor(session: HomeFeedSessionOwner) {
    super(session)
    // HomeFeedPagination(State) already exposes the trio of methods the prefetch
    // owner interface needs, so we pass `this` directly instead of an inline
    // object literal (ArkTS forbids untyped object literals).
    this.prefetcher = new HomeFeedLoadMorePrefetch(session, this)
    this.drainController = new HomeFeedLoadMoreDrain(session, this)
  }

  // === Prefetch (delegated to HomeFeedLoadMorePrefetch) ===
  canPrefetchHomeLoadMore(): boolean { return this.prefetcher.canPrefetch() }
  invalidateHomeLoadMorePrefetch(): void { this.prefetcher.invalidate() }
  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void { this.prefetcher.schedule(delayMs) }
  async prefetchHomeLoadMore(): Promise<void> { await this.prefetcher.run() }
  consumePrefetchedHomeEntries(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    return this.prefetcher.consume(mode, nextLimit)
  }

  private shouldUseLeanLoadMoreApply(mode: SubscriptionMode): boolean {
    return mode === 'articles' || mode === 'social' || mode === 'pictures' || mode === 'videos'
  }

  private resolveLoadMoreStepForMode(mode: SubscriptionMode): number {
    // 每个栏目的一页数量集中在 HomeVisibleEntryPolicy 中维护。
    return resolveHomeVisibleEntryLoadMoreStep(mode)
  }

  private applyEntriesForLoadMore(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    skipNotify: boolean,
  ): void {
    const leanApply = this.shouldUseLeanLoadMoreApply(mode)
    this.session.applyEntriesForMode(mode, entries, true, skipNotify, leanApply, leanApply)
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
    const previousEntries = this.session.filteredEntriesFor(mode)
    const previousTotal = previousEntries.length
    const currentLimit = this.candidateLimitForMode(mode)
    const appendCount = Math.max(1, nextLimit - currentLimit)
    const pageQueryStartedAt = Date.now()
    const nextPage = await FeaturedEntriesQuery.default.featuredEntriesFastPageByMode(mode, appendCount, previousTotal)
    this.session.logHomeLoadMore(
      `append-page mode=${mode} prevTotal=${previousTotal} appendCount=${appendCount} nextPage=${nextPage.length} queryMs=${Date.now() - pageQueryStartedAt}`,
    )

    if (nextPage.length === 0) {
      this.setCandidateLimitForMode(mode, nextLimit)
      this.session.logHomeLoadMore(
        `append-fast-empty mode=${mode} prevTotal=${previousTotal} appendCount=${appendCount} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await FeaturedEntriesQuery.default.featuredEntriesByMode(mode, nextLimit)
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
      this.session.logHomeLoadMore(
        `append-no-unique prevTotal=${previousTotal} appendCount=${appendCount} nextPage=${nextPage.length} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await FeaturedEntriesQuery.default.featuredEntriesByMode(mode, nextLimit)
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
    this.session.notifyHomeEntryDataAppendedForMode(mode, previousTotal)
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
        this.session.beginTweetPresentationDiagSession(mode, 'prefetch-resolve', previousTotal)
      }
      this.session.notifyHomeEntryDataAppendedForMode(mode, previousTotal)
      this.session.runManagedTimeout(() => {
        this.session.flushTweetPresentationDiagSession('prefetch-resolve-post-append')
      }, 600)
      this.session.logHomeLoadMore(
        `applyResolvedLoadMoreEntries mode=${mode} growth=true prevTotal=${previousTotal} nextEntries=${nextEntries.length} `
        + `syncMs=${syncedAt - startedAt} applyMs=${appliedAt - syncedAt} totalMs=${Date.now() - startedAt}`,
      )
      return
    }
    this.session.notifyHomeEntryDataReloadedForMode(mode)
    this.session.logHomeLoadMore(
      `applyResolvedLoadMoreEntries mode=${mode} growth=false prevTotal=${previousTotal} nextEntries=${nextEntries.length} `
      + `syncMs=${syncedAt - startedAt} applyMs=${appliedAt - syncedAt} totalMs=${Date.now() - startedAt}`,
    )
  }

  // === Load-more triggers ===
  resetModeLoadMoreStates(reason: string): void {
    this.session.homeHasMoreEntriesByMode = { articles: true, social: true, pictures: true, videos: true }
    this.session.homeModeNoProgressLoadMoreCount = { articles: 0, social: 0, pictures: 0, videos: 0 }
    this.homePendingLoadMoreModes = createHomePendingLoadMoreMap()
    this.homeLastItemAppearLoadMoreAt = createHomeLoadMoreTimestampMap()
    this.homeLastScrollProgressLoadMoreAt = createHomeScrollOffsetMap()
    this.session.logHomeLoadState(`mode loadMore state reset reason=${reason}`)
  }

  hasRecentHomeScrollIntent(): boolean {
    return this.session.homeScrollIntent.hasRecentIntent()
  }

  canLoadMoreForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    return this.session.isHomeRootTab()
      && mode === this.session.mode
      && (hasBufferedEntries || this.modeHasMoreEntries(mode))
      && !this.session.searchOverlayVisible
      && !this.session.hasHomeInlineSearchQuery()
      && !this.session.homeInitialLoadPending
      && !this.session.homeLoadMoreInProgress
      && (hasBufferedEntries || this.session.homeHasMoreEntries)
  }

  loadMoreBlockedReason(mode: SubscriptionMode, allowStaleScrollIntent: boolean = false): string {
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    if (!this.session.isHomeRootTab()) { return 'not-home-tab' }
    if (mode !== this.session.mode) { return 'inactive-mode' }
    if (this.session.searchOverlayVisible) { return 'search-overlay' }
    if (this.session.hasHomeInlineSearchQuery()) { return 'search-query-active' }
    if (this.session.homeInitialLoadPending) { return 'initial-load-pending' }
    if (this.session.homeLoadMoreInProgress) { return 'load-more-in-progress' }
    if (!hasBufferedEntries && !this.modeHasMoreEntries(mode)) { return 'mode-no-more' }
    if (!hasBufferedEntries && !this.session.homeHasMoreEntries) { return 'no-buffer-and-no-more' }
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
      this.session.logHomePerf(`loadMore skip mode=${mode} reason=${blockedReason || 'canLoadMore=false'}`)
      return !!blockedReason ? !this.shouldRetryLoadMoreBlockedReason(blockedReason) : true
    }

    const now = Date.now()
    if (
      this.session.lastHomeLoadMoreCompletedAt > 0
      && now - this.session.lastHomeLoadMoreCompletedAt < HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS
    ) {
      this.session.logHomePerf(`loadMore skip mode=${mode} reason=post-complete-cooldown`)
      return false
    }
    if (now - this.session.lastHomeLoadMoreRequestedAt < HOME_LOAD_MORE_MIN_INTERVAL_MS) {
      this.session.logHomePerf(`loadMore skip mode=${mode} reason=min-interval`)
      return false
    }
    this.session.lastHomeLoadMoreRequestedAt = now

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
    if (!this.session.homeHasMoreEntries) {
      return true
    }

    console.info(
      `[LIVO-PERF] loadMore full-fetch mode=${mode} expandedVisible=${String(expandedVisible)} remainingBuffered=${remainingBufferedCount} totalCount=${totalCount}`,
    )
    const previousTotal = this.session.featuredEntries.length
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

    const requestToken = this.session.homeLoadMoreRequestToken + 1
    this.session.homeLoadMoreRequestToken = requestToken
    const prefetchedEntries = this.consumePrefetchedHomeEntries(mode, nextLimit)
    const shouldShowLoadMoreFooter = !prefetchedEntries
    if (shouldShowLoadMoreFooter) {
      this.session.homeLoadMoreInProgress = true
    }
    const requestStartedAt = Date.now()
    this.session.logHomePerf(
      `loadMore start mode=${mode} nextLimit=${nextLimit} hasPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
    )
    this.session.logHomeLoadMore(
      `request start mode=${mode} prevTotal=${previousTotal} currentLimit=${currentModeLimit} nextLimit=${nextLimit}`,
    )
    if (mode === 'articles' || mode === 'social') {
      this.session.beginTweetPresentationDiagSession(mode, 'request-start', previousModeTotal)
    }

    const loadPromise = prefetchedEntries
      ? (async () => {
          this.applyResolvedLoadMoreEntries(mode, prefetchedEntries, previousModeTotal, nextLimit)
        })()
      : this.appendFeaturedEntriesFromLocalFast(mode, nextLimit)

    void loadPromise
      .then(() => {
        if (this.session.homeLoadMoreRequestToken !== requestToken) { return }
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
        this.session.logHomeLoadMore(
          `request done mode=${mode} prevTotal=${previousTotal} currentTotal=${this.session.featuredEntries.length} `
          + `prevModeTotal=${previousModeTotal} currentModeTotal=${currentModeTotal} `
          + `candidateLimit=${this.candidateLimitForMode(mode)} hasMore=${this.session.homeHasMoreEntries} `
          + `modeHasMore=${this.modeHasMoreEntries(mode)} noProgress=${this.modeNoProgressCount(mode)} `
          + `usedPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
        )
      })
      .catch((error: Error | string | Object) => {
        this.session.logHomeLoadMore(`request failed mode=${mode} error=${this.session.describeError(error)}`)
        this.session.logHomeAsyncError(`load-more-request mode=${mode}`, error)
      })
      .finally(() => {
        if (this.session.homeLoadMoreRequestToken !== requestToken) { return }
        if (shouldShowLoadMoreFooter) {
          this.session.homeLoadMoreInProgress = false
        }
        this.session.lastHomeLoadMoreCompletedAt = Date.now()
        this.scheduleHomeLoadMorePrefetch()
        this.session.logHomePerf(
          `loadMore done mode=${mode} elapsedMs=${Date.now() - requestStartedAt} total=${this.session.featuredEntries.length}`,
        )
        if (mode === 'articles' || mode === 'social') {
          this.session.runManagedTimeout(() => {
            this.session.flushTweetPresentationDiagSession('request-finally')
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
    return homeModePendingLoadMoreValue(mode, this.homePendingLoadMoreModes)
  }
  private setPendingLoadMoreForMode(mode: SubscriptionMode, pending: boolean): void {
    if (this.pendingLoadMoreForMode(mode) === pending) {
      return
    }
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
      mode !== this.session.mode
      || !this.session.isHomeRootTab()
      || this.session.searchOverlayVisible
      || this.session.hasHomeInlineSearchQuery()
    ) { return }
    if (this.shouldRenderAllEntriesForMode(mode)) { return }
    if (this.session.homeInitialLoadPending || this.session.homeLoadMoreInProgress || this.pendingLoadMoreForMode(mode)) {
      return
    }
    const totalCount = this.totalEntryCountFor(mode)
    const visibleCount = this.visibleEntryCountFor(mode)

    if (!shouldPreloadHomeVisibleEntries(mode, currentOffset, totalCount, visibleCount)) { return }

    const hasBufferedEntries = visibleCount < totalCount
    if (!hasBufferedEntries && (!this.session.homeHasMoreEntries || !this.modeHasMoreEntries(mode))) { return }
    if (this.session.homeScrollIntent.isInteracting && !this.hasRecentHomeScrollIntent()) { return }
    const scrollIntentVersion = this.session.homeScrollIntent.intentVersion(mode)
    if (
      this.session.homeScrollIntent.isInteracting
      && scrollIntentVersion <= this.session.homeScrollIntent.consumedVersion(mode)
    ) { return }
    const previousOffset = this.modeScrollProgressLoadMoreValue(mode)
    if (currentOffset <= previousOffset && visibleCount >= resolveHomeVisibleEntryLoadMoreStep(mode)) { return }
    this.setModeScrollProgressLoadMoreValue(mode, currentOffset)
    this.session.homeScrollIntent.setConsumedVersion(mode, scrollIntentVersion)
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
    if (source === 'item-appear' && this.session.homeLoadMoreInProgress) { return }

    const alreadyPending = this.pendingLoadMoreForMode(mode)
    if (!alreadyPending) {
      this.setPendingLoadMoreForMode(mode, true)
      this.session.logHomePerf(`loadMore enqueue mode=${mode} source=${source} interacting=${this.session.homeScrollIntent.isInteracting}`)
    }

    if (source === 'item-appear' || source === 'scroll-progress') {
      if (alreadyPending || this.session.homeLoadMoreInProgress) { return }
      this.session.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (!this.session.homeScrollIntent.isInteracting) {
      this.flushPendingLoadMoreForMode(mode)
    }
  }

  flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
    if (!this.pendingLoadMoreForMode(mode)) { return }
    if (this.session.homeScrollIntent.isInteracting) { return }
    this.session.runManagedTimeout(() => {
      if (!this.pendingLoadMoreForMode(mode)) { return }
      const handled = this.requestLoadMoreForMode(mode)
      if (handled) {
        this.setPendingLoadMoreForMode(mode, false)
        return
      }
      this.session.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
    }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
  }
  private shouldPrefetchLoadMoreAtIndex(visibleCount: number, index: number): boolean {
    return this.shouldPrefetchLoadMoreAtIndexForMode(this.session.mode, visibleCount, index)
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
    if (this.isModeLoading(mode) || this.session.homeLoadMoreInProgress) { return }
    this.setModeLoading(mode, true)
    const limit = this.resolveHomeCandidateLimitForMode(mode, HOME_MODE_SWITCH_CANDIDATE_LIMIT)
    void this.session.reloadFeaturedEntriesFromLocal(limit, false, true, true, mode)
      .catch((error: Error | string | Object) => {
        this.session.logHomeAsyncError(`ensure-mode-loaded mode=${mode}`, error)
      })
      .finally(() => {
        this.setModeLoading(mode, false)
        this.scheduleHomeLoadMorePrefetch(120)
      })
  }
}
