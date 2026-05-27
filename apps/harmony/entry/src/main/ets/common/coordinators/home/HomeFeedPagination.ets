import { FeaturedEntriesQuery } from '../../data/FeaturedEntriesQuery'
import { EntryCardModel } from '../../models/LivoModels'
import {
  HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED,
  HOME_LOAD_MORE_AFTER_STOP_DELAY_MS,
  HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER,
  HOME_LOAD_MORE_FOOTER_MIN_VISIBLE_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  HOME_LOAD_MORE_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
  HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS,
  HOME_LOAD_MORE_SCROLL_QUIESCENT_MS,
  HOME_LOAD_MORE_SCROLL_PROGRESS_TRIGGER_ENABLED,
  HOME_MODE_SWITCH_CANDIDATE_LIMIT,
  HomeModeLoadMoreTimestampMap,
  HomeModePendingLoadMoreMap,
  HomeModeScrollOffsetMap,
  SubscriptionMode,
} from '../../config/HomeRootConfig'
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
  resolveHomeVisibleEntryRevealStep,
  shouldPreloadHomeVisibleEntries,
} from './HomeVisibleEntryPolicy'
import { HomeFeedPaginationState } from './HomeFeedPaginationState'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { HomeFeedGuard, HomeFeedGuardProvider } from './HomeFeedGuard'
import { mergeUniqueEntries } from './HomeEntryUtils'
import { writeHomeLoadMoreInProgress } from '../../coordinators/index-home/HomeChromeProgressStore'

const HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS: number = 90
const HOME_LOAD_MORE_DRAIN_START_COOLDOWN_MS: number = 400

export class HomeFeedPagination extends HomeFeedPaginationState {
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = createHomePendingLoadMoreMap()
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = createHomeLoadMoreTimestampMap()
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private readonly featuredEntriesQuery: FeaturedEntriesQuery
  private readonly guard: HomeFeedGuard
  private readonly prefetchGuard: HomeFeedGuard
  private readonly drainGuard: HomeFeedGuard
  private drainToken: number = 0
  private drainingMode: SubscriptionMode | '' = ''
  private stuckDrainRetryCount: number = 0
  private lastDrainStartedAt: number = 0
  private footerHintedByDrain: boolean = false

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
    const prefetchProvider = new HomeFeedGuardProvider(
      () => actions.isHomeRootTab(),
      () => actions.hasHomeInlineSearchQuery(),
      () => false,
      (_mode: SubscriptionMode) => false,
      (mode: SubscriptionMode) => this.shouldRenderAllEntriesForMode(mode),
      (_mode: SubscriptionMode) => false,
      (mode: SubscriptionMode) => this.modeHasMoreEntries(mode),
      (_mode: SubscriptionMode) => 0,
    )
    this.prefetchGuard = new HomeFeedGuard(state, prefetchProvider)
    const drainProvider = new HomeFeedGuardProvider(
      () => actions.isHomeRootTab(),
      () => actions.hasHomeInlineSearchQuery(),
      () => false,
      (_mode: SubscriptionMode) => false,
      (_mode: SubscriptionMode) => false,
      (mode: SubscriptionMode) => this.hasBufferedEntriesForMode(mode),
      (mode: SubscriptionMode) => this.modeHasMoreEntries(mode),
      (_mode: SubscriptionMode) => 0,
    )
    this.drainGuard = new HomeFeedGuard(state, drainProvider)
  }

  // === Load-more prefetch ===
  canPrefetchHomeLoadMore(): boolean {
    if (!HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED) {
      return false
    }
    return this.prefetchGuard.canPrefetch()
  }

  invalidateHomeLoadMorePrefetch(): void {
    this.state.homeLoadMorePrefetchToken += 1
    this.state.homeLoadMorePrefetchInProgress = false
    this.state.homeLoadMorePrefetchLimit = 0
    this.state.homeLoadMorePrefetchEntries = []
    this.state.homeLoadMorePrefetchMode = this.state.mode
  }

  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void {
    this.actions.runManagedTimeout(() => {
      void this.prefetchHomeLoadMore()
    }, delayMs)
  }

  private prefetchPageMultiplier(mode: SubscriptionMode): number {
    if (mode === 'articles') {
      return Math.max(2, HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER)
    }
    return HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER
  }

  async prefetchHomeLoadMore(): Promise<void> {
    if (!this.canPrefetchHomeLoadMore()) {
      return
    }
    const mode = this.state.mode
    const currentLimit = this.candidateLimitForMode(mode)
    const step = resolveHomeVisibleEntryLoadMoreStep(mode)
    const targetLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentLimit + step * this.prefetchPageMultiplier(mode),
    )
    if (targetLimit <= currentLimit) {
      return
    }
    if (this.state.homeLoadMorePrefetchLimit >= targetLimit && this.state.homeLoadMorePrefetchEntries.length > 0) {
      return
    }
    if (this.state.homeLoadMorePrefetchInProgress) {
      return
    }

    this.state.homeLoadMorePrefetchInProgress = true
    const token = this.state.homeLoadMorePrefetchToken + 1
    this.state.homeLoadMorePrefetchToken = token
    this.actions.logHomeLoadMore(`prefetch start mode=${mode} currentLimit=${currentLimit} targetLimit=${targetLimit}`)

    try {
      const previousEntries = this.actions.filteredEntriesFor(mode)
      const appendCount = Math.max(1, targetLimit - previousEntries.length)
      const nextPage = await this.featuredEntriesQuery.featuredEntriesFastPageByMode(mode, appendCount, previousEntries.length)
      if (!this.state.isComponentActive || this.state.homeLoadMorePrefetchToken !== token) {
        return
      }
      const entries = mergeUniqueEntries(previousEntries, nextPage, targetLimit)
      if (entries.length <= previousEntries.length) {
        this.actions.logHomeLoadMore(
          `prefetch skip-no-growth mode=${mode} targetLimit=${targetLimit} previous=${previousEntries.length} page=${nextPage.length}`,
        )
        return
      }
      this.state.homeLoadMorePrefetchLimit = targetLimit
      this.state.homeLoadMorePrefetchEntries = entries
      this.state.homeLoadMorePrefetchMode = mode
      this.actions.logHomeLoadMore(`prefetch done mode=${mode} targetLimit=${targetLimit} entries=${entries.length}`)
    } catch (_error) {
      this.actions.logHomeLoadMore(`prefetch failed targetLimit=${targetLimit}`)
    } finally {
      if (this.state.homeLoadMorePrefetchToken === token) {
        this.state.homeLoadMorePrefetchInProgress = false
      }
    }
  }

  consumePrefetchedHomeEntries(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    if (this.state.homeLoadMorePrefetchMode !== mode) {
      return undefined
    }
    if (this.state.homeLoadMorePrefetchLimit < nextLimit || this.state.homeLoadMorePrefetchEntries.length === 0) {
      return undefined
    }
    const entries = this.state.homeLoadMorePrefetchEntries.slice(0, nextLimit)
    const remainingPrefetchedLimit = this.state.homeLoadMorePrefetchLimit
    this.state.homeLoadMorePrefetchEntries = this.state.homeLoadMorePrefetchEntries
    this.state.homeLoadMorePrefetchInProgress = false
    this.actions.logHomeLoadMore(
      `consume-prefetch nextLimit=${nextLimit} entries=${entries.length} prefetchedLimit=${remainingPrefetchedLimit}`,
    )
    if (remainingPrefetchedLimit === nextLimit) {
      this.state.homeLoadMorePrefetchLimit = 0
      this.state.homeLoadMorePrefetchEntries = []
    }
    return entries
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
    // 用 reveal step（小于 load-more step）控制每次 load-more 后 visibleLimit 的
    // 增长幅度。否则视频栏目一次 reveal 24 张 = 12 行,LazyForEach 同帧 mount
    // 太多卡片,造成"最后一张被截断"和滚动卡顿。
    const nextVisibleLimit = Math.min(
      nextTotal,
      Math.max(this.visibleEntryLimitFor(mode), previousVisibleTotal + resolveHomeVisibleEntryRevealStep(mode)),
    )
    this.setVisibleEntryLimitFor(mode, nextVisibleLimit)
  }

  async appendFeaturedEntriesFromLocalFast(mode: SubscriptionMode, nextLimit: number): Promise<void> {
    const previousEntries = this.actions.filteredEntriesFor(mode)
    const previousTotal = previousEntries.length
    // LazyForEach 看到的是 visibleEntriesFor(mode) 的切片,长度是 visibleEntryCount。
    // 当 visibleEntryLimit < filteredEntries.length(有 buffered entries)时,
    // notify 必须传 previousVisibleTotal 而不是 previousTotal,否则 LazyForEach
    // 收到越界 index 会回退到全量 reloadData,引发"加载更多特别卡"。
    const previousVisibleTotal = this.visibleEntryCountFor(mode)
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
      // skipNotify=true → in-place 替换,避免替换 entryGroups 整对象触发 Index
      // 重建,同时避开 LazyForEach 的全量 reloadData。仅在数据真的缩短时才
      // 手动 reload;增长时走 appended;长度未变则不通知。
      this.applyEntriesForLoadMore(mode, fallbackEntries, true)
      if (fallbackEntries.length > previousTotal) {
        this.revealLoadedEntriesForLoadMore(mode, previousVisibleTotal, fallbackEntries.length)
        this.actions.notifyHomeEntryDataAppendedForMode(mode, previousVisibleTotal)
      } else if (fallbackEntries.length < previousTotal) {
        this.actions.notifyHomeEntryDataReloadedForMode(mode)
      }
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
      // 同 nextPage.length===0 分支:in-place + 按变化决定通知方式,避免不必要的 reloadData。
      this.applyEntriesForLoadMore(mode, fallbackEntries, true)
      if (fallbackEntries.length > previousTotal) {
        this.revealLoadedEntriesForLoadMore(mode, previousVisibleTotal, fallbackEntries.length)
        this.actions.notifyHomeEntryDataAppendedForMode(mode, previousVisibleTotal)
      } else if (fallbackEntries.length < previousTotal) {
        this.actions.notifyHomeEntryDataReloadedForMode(mode)
      }
      return
    }

    this.setCandidateLimitForMode(mode, nextLimit)
    // reveal 按 visible 数量比较(参数名 previousVisibleTotal),传 mode 总数会
    // 让条件 `nextTotal <= previousVisibleTotal` 错判,直接 return 不增长 visible。
    this.revealLoadedEntriesForLoadMore(mode, previousVisibleTotal, merged.length)
    this.applyEntriesForLoadMore(mode, merged, true)
    this.actions.notifyHomeEntryDataAppendedForMode(mode, previousVisibleTotal)
  }

  private applyResolvedLoadMoreEntries(
    mode: SubscriptionMode,
    nextEntries: EntryCardModel[],
    previousTotal: number,
    nextLimit: number,
  ): void {
    const startedAt = Date.now()
    // 同 appendFeaturedEntriesFromLocalFast:notify 必须传 LazyForEach 旧可见数量
    // 而不是 mode 总数,否则越界 index 触发全量 reloadData。
    const previousVisibleTotal = this.visibleEntryCountFor(mode)
    this.syncModePaginationFromReloadResult(mode, nextEntries, nextLimit)
    const syncedAt = Date.now()
    this.revealLoadedEntriesForLoadMore(mode, previousVisibleTotal, nextEntries.length)
    this.applyEntriesForLoadMore(mode, nextEntries, true)
    const appliedAt = Date.now()
    if (nextEntries.length > previousTotal) {
      if (mode === 'articles' || mode === 'social') {
        this.actions.beginTweetPresentationDiagSession(mode, 'prefetch-resolve', previousTotal)
      }
      this.actions.notifyHomeEntryDataAppendedForMode(mode, previousVisibleTotal)
      this.actions.runManagedTimeout(() => {
        this.actions.flushTweetPresentationDiagSession('prefetch-resolve-post-append')
      }, 600)
      this.actions.logHomeLoadMore(
        `applyResolvedLoadMoreEntries mode=${mode} growth=true prevTotal=${previousTotal} prevVisible=${previousVisibleTotal} nextEntries=${nextEntries.length} `
        + `syncMs=${syncedAt - startedAt} applyMs=${appliedAt - syncedAt} totalMs=${Date.now() - startedAt}`,
      )
      return
    }
    this.actions.notifyHomeEntryDataReloadedForMode(mode)
    this.actions.logHomeLoadMore(
      `applyResolvedLoadMoreEntries mode=${mode} growth=false prevTotal=${previousTotal} prevVisible=${previousVisibleTotal} nextEntries=${nextEntries.length} `
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
    // mode 级初始 reload (ensureModeEntriesLoaded) 进行中时,LazyForEach 仍可能展示
    // precache 的少量数据;此时第一条 onAppear 会触发 load-more 抢跑,导致用户看到
    // "切到栏目就开始加载更多"。等 reload 完成、hasMore 被正确同步后再让 load-more 跑。
    if (this.isModeLoading(mode)) { return 'mode-initial-loading' }
    if (this.state.homeLoadMoreInProgress) { return 'load-more-in-progress' }
    if (!hasBufferedEntries && !this.modeHasMoreEntries(mode)) { return 'mode-no-more' }
    if (!hasBufferedEntries && !this.state.homeHasMoreEntries) { return 'no-buffer-and-no-more' }
    if (!allowStaleScrollIntent && !this.hasRecentHomeScrollIntent()) { return 'no-recent-scroll-intent' }
    return ''
  }

  private shouldRetryLoadMoreBlockedReason(reason: string): boolean {
    // 'no-recent-scroll-intent' is transient: once another scroll arrives the
    // pending request can succeed, so keep it queued instead of dropping it.
    // 'mode-initial-loading' 也是临时的:等 reload 完成,pending 请求应被允许继续。
    return reason === 'load-more-in-progress'
      || reason === 'initial-load-pending'
      || reason === 'mode-initial-loading'
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
    // 不论是否命中预取,都让 LoadMoreFooter 可见至少一段时间(footer-min-visible)。
    // 此前仅在没有预取时显示 footer,导致用户滑到底瞬间数据已就绪却看不到
    // "加载中"动画,觉得"按了没反应"。footer 通过 AppStorage 驱动,Index 顶层
    // 不会因此 rebuild,显示成本可控。
    const footerShownAt = Date.now()
    this.state.homeLoadMoreInProgress = true
    writeHomeLoadMoreInProgress(true)
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
        const clearFooter = (): void => {
          if (this.state.homeLoadMoreRequestToken !== requestToken) { return }
          this.state.homeLoadMoreInProgress = false
          writeHomeLoadMoreInProgress(false)
        }
        const elapsed = Date.now() - footerShownAt
        const remaining = HOME_LOAD_MORE_FOOTER_MIN_VISIBLE_MS - elapsed
        if (remaining > 0) {
          this.actions.runManagedTimeout(clearFooter, remaining)
        } else {
          clearFooter()
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
    if (!this.shouldStartHomeLoadMoreDrain(mode, totalCount)) {
      return
    }
    const now = Date.now()
    if (now - this.lastDrainStartedAt < HOME_LOAD_MORE_DRAIN_START_COOLDOWN_MS) {
      return
    }
    this.lastDrainStartedAt = now
    this.drainToken += 1
    this.drainingMode = mode
    this.stuckDrainRetryCount = 0
    const token = this.drainToken
    // onReachEnd 先点亮 footer,真正的 request 等滚动静止后再执行。
    if (!this.footerHintedByDrain) {
      this.footerHintedByDrain = true
      writeHomeLoadMoreInProgress(true)
    }
    this.actions.logHomeLoadMore(`drain start mode=${mode} total=${totalCount}`)
    this.scheduleHomeLoadMoreDrainStep(mode, token)
  }

  private shouldStartHomeLoadMoreDrain(mode: SubscriptionMode, totalCount: number): boolean {
    if (this.drainingMode === mode || this.state.homeLoadMoreInProgress || this.pendingLoadMoreForMode(mode)) {
      return false
    }
    return this.canRunHomeLoadMoreDrain(mode, totalCount)
  }

  private canRunHomeLoadMoreDrain(mode: SubscriptionMode, totalCount: number): boolean {
    return this.drainGuard.canDrain(mode, totalCount)
  }

  private scheduleHomeLoadMoreDrainStep(mode: SubscriptionMode, token: number): void {
    this.actions.runManagedTimeout(() => {
      this.stepHomeLoadMoreDrain(mode, token, 0)
    }, 0)
  }

  private stepHomeLoadMoreDrain(mode: SubscriptionMode, token: number, attempt: number): void {
    if (token !== this.drainToken) {
      return
    }
    if (!this.canRunHomeLoadMoreDrain(mode, 1)) {
      this.finishHomeLoadMoreDrain(mode, `drain stop mode=${mode} reason=inactive-or-exhausted`, true)
      return
    }
    // fling 期间 lastUserScrollAt 会持续刷新;等 QUIESCENT_MS 内没有滚动事件,
    // 再执行 visibleLimit 增长和 LazyForEach 增量通知，避免打断末尾惯性滚动。
    const sinceLastScroll = Date.now() - this.state.homeScrollIntent.lastUserScrollAt
    if (
      this.state.homeScrollIntent.isInteracting
      || sinceLastScroll < HOME_LOAD_MORE_SCROLL_QUIESCENT_MS
      || this.state.homeLoadMoreInProgress
      || this.pendingLoadMoreForMode(mode)
    ) {
      this.actions.runManagedTimeout(() => {
        this.stepHomeLoadMoreDrain(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    const handled = this.requestLoadMoreForMode(mode, true)
    if (!handled) {
      if (this.stuckDrainRetryCount >= 3) {
        this.finishHomeLoadMoreDrain(mode, `drain stuck-bottom-exhausted mode=${mode} attempts=${attempt + 1}`, true)
        return
      }
      this.stuckDrainRetryCount += 1
      this.actions.runManagedTimeout(() => {
        this.stepHomeLoadMoreDrain(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    this.finishHomeLoadMoreDrain(mode, `drain page-done mode=${mode} attempts=${attempt + 1} stuckRetries=${this.stuckDrainRetryCount}`, false)
  }

  private finishHomeLoadMoreDrain(mode: SubscriptionMode, message: string, clearHintedFooter: boolean): void {
    if (this.drainingMode === mode) {
      this.drainingMode = ''
    }
    if (clearHintedFooter && this.footerHintedByDrain) {
      writeHomeLoadMoreInProgress(false)
    }
    this.footerHintedByDrain = false
    this.actions.logHomeLoadMore(message)
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
    // 用户反馈"加载更多触发过早":scroll-progress 在 ~46% 滚动位置就预读下一页,
    // 体感是"还没滑到底就开始加载"。改为只用 onReachEnd 真触底触发,留下函数
    // 体便于后续如需重新启用。
    if (!HOME_LOAD_MORE_SCROLL_PROGRESS_TRIGGER_ENABLED) { return }
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
    // 视口内数据量未达初始期望时,该栏目要么还在初始 reload,要么数据本来就不够;
    // onItemAppear 在这种"接近末尾"假象下触发 load-more 会让用户切到栏目立刻看到
    // LoadMoreFooter 闪一下,且 load-more 多半因数据不够返回 hasMore=false。
    // 直接 short-circuit 避免误触发。
    if (visibleCount < resolveHomeVisibleEntryInitialLimit(mode)) { return false }
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
