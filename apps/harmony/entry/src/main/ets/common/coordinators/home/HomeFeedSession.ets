import { EntryCardModel, HarmonySettings } from '../../models/LivoModels'
import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { SettingsStore } from '../../services/SettingsStore'
import { HomeEntrySnapshotStore } from '../../services/HomeEntrySnapshotStore'
import { RefreshLogStore } from '../../services/RefreshLogStore'
import { FeedRepository } from '../../repositories/FeedRepository'
import { FeaturedEntriesQuery } from '../../data/FeaturedEntriesQuery'
import { FeedRefreshCoordinator } from '../../data/FeedRefreshCoordinator'
import { groupHomeEntriesByMode } from './HomeEntryGroups'
import { resolveHomeVisibleEntryInitialLimit } from './HomeVisibleEntryPolicy'
import { HomeEntryDataManager, HomeEntryDataState, HomeEntryDataActions } from './HomeEntryDataManager'
import { HomeInlineSearchController, HomeInlineSearchState, HomeInlineSearchActions } from './HomeInlineSearchController'
import { HomeModeController, HomeModeState, HomeModeActions } from './HomeModeController'
import { HomeFeedRefresh } from './HomeFeedRefresh'
import { HomeFeedPagination } from './HomeFeedPagination'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { describeError, duplicateKeyCount, homeEntryRenderBaseKey } from './HomeEntryUtils'
import {
  HEADER_BLUR_SCROLL_RANGE,
  HOME_ASYNC_ERROR_DEBUG_ENABLED,
  HOME_ASYNC_ERROR_PREFIX,
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_GROUP_DEBUG_ENABLED,
  HOME_GROUP_DEBUG_PREFIX,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_LOAD_MORE_DEBUG_ENABLED,
  HOME_LOAD_MORE_DEBUG_PREFIX,
  HOME_LOAD_STATE_DIAG_ENABLED,
  HOME_LOAD_STATE_DIAG_PREFIX,
  HOME_MAX_CANDIDATE_LIMIT,
  HOME_PERF_DIAG_ENABLED,
  HOME_PERF_DIAG_PREFIX,
  SubscriptionMode,
} from '../../config/HomeRootConfig'
import { ModeSceneRenderState, resolveModeSceneRenderState } from '../../utils/ModeSceneTransition'
import { IndexHomeRailCoordinator, IndexHomeRailOwner } from '../../coordinators/index-home/IndexHomeRailCoordinator'
import { IndexHomeRuntimeCoordinator, IndexHomeRuntimeOwner } from '../../coordinators/index-home/IndexHomeRuntimeCoordinator'
import { IndexRootTabCoordinator, IndexRootTabOwner } from '../../coordinators/index-home/IndexRootTabCoordinator'
import { IndexPageLifecycleController, IndexPageLifecycleOwner } from '../../coordinators/index-home/IndexPageLifecycleController'
import { RootTabId } from '../../navigation/AppRouter'

/**
 * Combined owner interface satisfied by the Index page.
 *
 * HomeFeedSession and all its coordinators access state and actions through
 * this single owner reference. Index structurally satisfies every member.
 */
export interface HomeFeedSessionOwner
  extends
    HomeFeedState,
    HomeModeState,
    HomeInlineSearchState,
    HomeEntryDataState,
    IndexHomeRailOwner,
    IndexHomeRuntimeOwner,
    IndexRootTabOwner,
    IndexPageLifecycleOwner {
  /** Bumped whenever entry groups change — descendant components observe it via @Prop. */
  homeContentVersion: number

  // ── Methods session delegates to owner (inline logic on Index) ──

  beginTweetPresentationDiagSession(mode: SubscriptionMode, reason: string, expectedStartIndex: number): void
  flushTweetPresentationDiagSession(reason: string): void
  showToast(message: string, duration?: number): void
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[]
  notifyHomeEntryDataAppendedForMode(mode: SubscriptionMode, startIndex: number): void
  getItemRectForMode(mode: SubscriptionMode, index: number): RectResult
  bumpHomeContentVersion(): void
  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode): void
  resetModeScrollIntent(mode: SubscriptionMode): void
  getSearchInputController(): TextInputController
  resetTweetPresentationCache(): void
  animateWithUiContext(options: AnimateParam, event: () => void): void
}

export class HomeFeedSession implements HomeFeedActions, HomeModeActions, HomeInlineSearchActions, HomeEntryDataActions {
  readonly homeRailCoordinator: IndexHomeRailCoordinator
  readonly rootTabCoordinator: IndexRootTabCoordinator
  readonly homeModeController: HomeModeController
  readonly homeEntryDataManager: HomeEntryDataManager
  readonly homeInlineSearchController: HomeInlineSearchController
  readonly homeRuntimeCoordinator: IndexHomeRuntimeCoordinator
  readonly pageLifecycle: IndexPageLifecycleController
  readonly homeFeedRefresh: HomeFeedRefresh
  readonly homeFeedPagination: HomeFeedPagination

  private readonly featuredEntriesQuery: FeaturedEntriesQuery
  private readonly feedRefreshCoordinator: FeedRefreshCoordinator
  private precacheModeToken: number = 0
  private readonly owner: HomeFeedSessionOwner

  private static readonly ACTIVE_MODE_PREFETCH_DELAY_MS: number = 80

  constructor(
    owner: HomeFeedSessionOwner,
    featuredEntriesQuery?: FeaturedEntriesQuery,
    feedRefreshCoordinator?: FeedRefreshCoordinator,
  ) {
    this.owner = owner
    this.featuredEntriesQuery = featuredEntriesQuery ?? FeaturedEntriesQuery.default
    this.feedRefreshCoordinator = feedRefreshCoordinator ?? FeedRefreshCoordinator.default

    this.homeRailCoordinator = new IndexHomeRailCoordinator(owner)
    this.rootTabCoordinator = new IndexRootTabCoordinator(owner)
    this.homeModeController = new HomeModeController(owner, this)
    this.homeEntryDataManager = new HomeEntryDataManager(owner, this)
    this.homeInlineSearchController = new HomeInlineSearchController(owner, this)
    this.homeRuntimeCoordinator = new IndexHomeRuntimeCoordinator(owner)
    this.pageLifecycle = new IndexPageLifecycleController(owner)
    this.homeFeedRefresh = new HomeFeedRefresh(owner, this, this.feedRefreshCoordinator, RefreshLogStore.default)
    this.homeFeedPagination = new HomeFeedPagination(owner, this, this.featuredEntriesQuery)
  }

  // ── Bootstrap ──

  async loadInitialData(): Promise<void> {
    await this.bootstrapHomeFeed()
  }

  resumeHomeFeed(): void {
    this.homeRuntimeCoordinator.configureAutoRefreshTimer()
    this.homeFeedRefresh.tryFlushDeferredFeedsChangedReload('about-to-appear')
    if (this.owner.featuredEntries.length === 0) {
      void this.reloadHomeEntriesFromLocal(
        this.homeFeedPagination.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
        false,
        true,
        true,
      )
    }
  }

  private async bootstrapHomeFeed(): Promise<void> {
    const startedAt = Date.now()
    this.logHomePerf('loadInitialData start')
    this.homeFeedPagination.resetModeLoadMoreStates('load-initial')
    this.owner.homeInitialLoadPending = true
    this.owner.theme = ThemeService.currentPalette()
    void this.homeRuntimeCoordinator.applySystemBarStyle(this.owner.theme)
    const settingsPromise = SettingsStore.default.load()
    const feedsPromise = FeedRepository.default.list()
    const currentMode = this.owner.mode
    let restoredFromSnapshot: boolean = false
    const snapshotEntries = await HomeEntrySnapshotStore.load()
    if (snapshotEntries.length > 0) {
      restoredFromSnapshot = true
      this.restoreSnapshot(snapshotEntries)
    } else {
      await this.loadFastLocalEntries()
    }
    this.settleInitialHomeLoadState()
    const settings = await settingsPromise
    const feeds = await feedsPromise
    this.owner.initialFeedCount = feeds.length
    this.owner.rootSettings = settings
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.owner.theme = await ThemeService.resolvePalette(settings)
    void this.homeRuntimeCoordinator.applySystemBarStyle(this.owner.theme)
    void this.homeFeedRefresh.startStartupRefreshIfNeeded(restoredFromSnapshot)
    this.homeRuntimeCoordinator.configureAutoRefreshTimer()
    this.owner.hasLoadedInitialData = true
    this.homeFeedPagination.ensureModeEntriesLoaded(currentMode)
    this.precacheNonActiveModes()
    this.primeActiveModeLoadMorePrefetch('bootstrap')
    this.logHomePerf(
      `loadInitialData done elapsedMs=${Date.now() - startedAt} featured=${this.owner.featuredEntries.length}`,
    )
  }

  private restoreSnapshot(snapshotEntries: EntryCardModel[]): void {
    const groupedSnapshot = groupHomeEntriesByMode(snapshotEntries)
    const restoredArticles = groupedSnapshot.articles.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredSocial = groupedSnapshot.social.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredPictures = groupedSnapshot.pictures.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredVideos = groupedSnapshot.videos.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    this.owner.entryGroups = {
      articles: [...restoredArticles],
      social: [...restoredSocial],
      pictures: [...restoredPictures],
      videos: [...restoredVideos],
    }
    this.owner.featuredEntries = this.homeEntryDataManager.mergeFeaturedEntriesFromGroups()
    this.homeFeedPagination.setCandidateLimitForMode('articles', restoredArticles.length)
    this.homeFeedPagination.setCandidateLimitForMode('social', restoredSocial.length)
    this.homeFeedPagination.setCandidateLimitForMode('pictures', restoredPictures.length)
    this.homeFeedPagination.setCandidateLimitForMode('videos', restoredVideos.length)
    this.homeFeedPagination.markModeLoaded('articles', restoredArticles.length > 0)
    this.homeFeedPagination.markModeLoaded('social', restoredSocial.length > 0)
    this.homeFeedPagination.markModeLoaded('pictures', restoredPictures.length > 0)
    this.homeFeedPagination.markModeLoaded('videos', restoredVideos.length > 0)
    this.homeFeedPagination.setModeHasMoreEntries('articles', true, 'snapshot-restore')
    this.homeFeedPagination.setModeHasMoreEntries('social', true, 'snapshot-restore')
    this.homeFeedPagination.setModeHasMoreEntries('pictures', true, 'snapshot-restore')
    this.homeFeedPagination.setModeHasMoreEntries('videos', true, 'snapshot-restore')
    this.homeEntryDataManager.notifyAllReloaded()
    this.homeEntryDataManager.schedulePersistSnapshot(this.owner.featuredEntries)
    this.owner.feedSourceLabel = '已恢复本地内容'
    if (this.owner.mode === 'articles') {
      this.primeActiveModeLoadMorePrefetch('restore-snapshot')
    }
  }

  private async loadFastLocalEntries(): Promise<void> {
    this.owner.featuredEntries = await this.featuredEntriesQuery.featuredEntriesFast(
      HOME_INITIAL_CANDIDATE_LIMIT,
    )
    if (this.owner.featuredEntries.length === 0) {
      this.owner.featuredEntries = await this.featuredEntriesQuery.featuredEntries()
    }
    this.owner.entryGroups = groupHomeEntriesByMode(this.owner.featuredEntries)
    this.owner.feedSourceLabel = '本地内容已加载'
    this.owner.homeContentVersion = (this.owner.homeContentVersion + 1) | 0
    this.precacheNonActiveModes()
    if (this.owner.mode === 'articles') {
      this.primeActiveModeLoadMorePrefetch('fast-local-load')
    }
  }

  // ── Reload ──

  async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = false,
    targetMode: SubscriptionMode = this.owner.mode,
  ): Promise<void> {
    const startedAt = Date.now()
    const safeCandidateLimit = this.homeFeedPagination.resolveHomeCandidateLimitForMode(
      targetMode,
      candidateLimit,
    )
    const shouldUseFastPath = preferFastPath
      && !this.homeFeedPagination.shouldRenderAllEntriesForMode(targetMode)
    this.logHomePerf(
      `reload start mode=${targetMode} limit=${safeCandidateLimit} animated=${animated} `
      + `deferredGrouping=${deferredGrouping} fast=${shouldUseFastPath}`,
    )
    const nextEntries = shouldUseFastPath
      ? await this.featuredEntriesQuery.featuredEntriesFastByMode(targetMode, safeCandidateLimit)
      : await this.featuredEntriesQuery.featuredEntriesByMode(targetMode, safeCandidateLimit)
    this.homeFeedPagination.syncModePaginationFromReloadResult(
      targetMode,
      nextEntries,
      safeCandidateLimit,
    )
    this.logHomeGroupStats(
      `reloadFeaturedEntriesFromLocal mode=${targetMode} limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.homeEntryDataManager.applyEntriesForMode(targetMode, nextEntries, deferredGrouping)
    if (targetMode === this.owner.mode) {
      this.primeActiveModeLoadMorePrefetch(`reload-featured mode=${targetMode}`)
    }
    this.logHomePerf(
      `reload done mode=${targetMode} limit=${safeCandidateLimit} `
      + `elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`,
    )
  }

  async reloadHomeEntriesFromLocal(
    candidateLimit: number = HOME_MAX_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = true,
  ): Promise<void> {
    if (this.homeFeedPagination.shouldRenderAllEntriesForMode(this.owner.mode)) {
      await this.reloadFeaturedEntriesFromLocal(
        this.homeFeedPagination.resolveHomeCandidateLimitForMode(
          this.owner.mode,
          candidateLimit,
        ),
        animated,
        deferredGrouping,
        false,
        this.owner.mode,
      )
      return
    }
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(HOME_INITIAL_CANDIDATE_LIMIT, candidateLimit)
    this.logHomePerf(
      `reload-home start limit=${safeCandidateLimit} animated=${animated} `
      + `deferredGrouping=${deferredGrouping} fast=${preferFastPath}`,
    )
    const nextEntries = preferFastPath
      ? await this.featuredEntriesQuery.featuredEntriesFast(safeCandidateLimit)
      : await this.featuredEntriesQuery.featuredEntries(safeCandidateLimit)
    this.logHomeGroupStats(
      `reloadHomeEntriesFromLocal limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping)
    this.primeActiveModeLoadMorePrefetch('reload-home')
    this.logHomePerf(
      `reload-home done limit=${safeCandidateLimit} `
      + `elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`,
    )
  }

  // ── Precache ──

  precacheNonActiveModes(): void {
    const currentMode = this.owner.mode
    const modes: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
    const token = this.precacheModeToken + 1
    this.precacheModeToken = token
    for (let index = 0; index < modes.length; index += 1) {
      const mode = modes[index]
      if (mode === currentMode) {
        continue
      }
      if (
        this.homeFeedPagination.isModeLoaded(mode) ||
        this.homeFeedPagination.isModeLoading(mode)
      ) {
        continue
      }
      this.homeRuntimeCoordinator.runManagedTimeout(() => {
        if (this.precacheModeToken !== token || mode === this.owner.mode) {
          return
        }
        if (
          this.homeFeedPagination.isModeLoaded(mode) ||
          this.homeFeedPagination.isModeLoading(mode)
        ) {
          return
        }
        this.homeFeedPagination.setModeLoading(mode, true)
        const precacheLimit = resolveHomeVisibleEntryInitialLimit(mode)
        void this.featuredEntriesQuery
          .featuredEntriesFastByMode(mode, precacheLimit)
          .then((entries: EntryCardModel[]) => {
            if (this.precacheModeToken !== token || mode === this.owner.mode) {
              return
            }
            this.homeEntryDataManager.applyEntriesForMode(
              mode,
              entries,
              true,
              true,
              true,
            )
          })
          .catch((error: Error | string | Object) => {
            this.logHomeAsyncError(
              `precache-mode mode=${mode}`,
              error,
            )
          })
          .finally(() => {
            this.homeFeedPagination.setModeLoading(mode, false)
          })
      }, 180 * (index + 1))
    }
  }

  // ── Helpers ──

  private playHomeListSwapTransition(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
  ): void {
    this.owner.homeListSwapMode = mode
    this.owner.homeListSwapToken += 1
    this.homeEntryDataManager.playListSwapTransition(
      nextEntries,
      mode,
      this.owner.homeListSwapToken,
      HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
      HOME_LIST_SWAP_ENTRY_OFFSET_Y,
      HOME_LIST_SWAP_ENTER_DURATION,
      HOME_LIST_SWAP_ANIMATION_ENABLED,
    )
  }

  primeActiveModeLoadMorePrefetch(
    reason: string,
    delayMs: number = HomeFeedSession.ACTIVE_MODE_PREFETCH_DELAY_MS,
  ): void {
    this.logHomeLoadMore(
      `prefetch-prime mode=${this.owner.mode} reason=${reason} delayMs=${delayMs}`,
    )
    this.homeFeedPagination.scheduleHomeLoadMorePrefetch(delayMs)
  }

  // ── Diagnostics (inlined from former IndexHomeDiagnosticsLogger) ──

  describeError(error: Error | string | Object): string {
    return describeError(error)
  }

  logHomeAsyncError(stage: string, error: Error | string | Object): void {
    if (!HOME_ASYNC_ERROR_DEBUG_ENABLED) {
      return
    }
    console.error(`${HOME_ASYNC_ERROR_PREFIX} stage=${stage} error=${this.describeError(error)}`)
  }

  logHomeLoadMore(message: string): void {
    if (!HOME_LOAD_MORE_DEBUG_ENABLED) {
      return
    }
    console.info(`${HOME_LOAD_MORE_DEBUG_PREFIX} ${message}`)
  }

  logHomePerf(message: string): void {
    if (!HOME_PERF_DIAG_ENABLED) {
      return
    }
    const elapsed = this.owner.homePerfSessionStartedAt > 0 ? Date.now() - this.owner.homePerfSessionStartedAt : 0
    console.info(`${HOME_PERF_DIAG_PREFIX} sid=${this.owner.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  logHomeLoadState(message: string): void {
    if (!HOME_LOAD_STATE_DIAG_ENABLED) {
      return
    }
    const elapsed = this.owner.homePerfSessionStartedAt > 0 ? Date.now() - this.owner.homePerfSessionStartedAt : 0
    console.info(`${HOME_LOAD_STATE_DIAG_PREFIX} sid=${this.owner.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  logHomeGroupStats(stage: string, entries: EntryCardModel[]): void {
    if (!HOME_GROUP_DEBUG_ENABLED) {
      return
    }

    const idCounter: Map<string, number> = new Map<string, number>()
    const renderBaseCounter: Map<string, number> = new Map<string, number>()
    let articles = 0
    let social = 0
    let pictures = 0
    let videos = 0

    entries.forEach((entry: EntryCardModel) => {
      const idKey = (entry.id || '').trim()
      const idCount = idCounter.get(idKey) ?? 0
      idCounter.set(idKey, idCount + 1)

      const renderBaseKey = homeEntryRenderBaseKey(entry)
      const renderBaseCount = renderBaseCounter.get(renderBaseKey) ?? 0
      renderBaseCounter.set(renderBaseKey, renderBaseCount + 1)

      switch (entry.viewLabel) {
        case '社交':
          social += 1
          break
        case '图片':
          pictures += 1
          break
        case '视频':
          videos += 1
          break
        default:
          articles += 1
          break
      }
    })

    const duplicateIdCount = duplicateKeyCount(idCounter)
    const duplicateRenderBaseCount = duplicateKeyCount(renderBaseCounter)

    console.info(
      `${HOME_GROUP_DEBUG_PREFIX} ${stage} total=${entries.length} `
      + `articles=${articles} social=${social} pictures=${pictures} videos=${videos} `
      + `uniqueIds=${idCounter.size} dupIds=${duplicateIdCount} `
      + `uniqueRender=${renderBaseCounter.size} dupRender=${duplicateRenderBaseCount} `
      + `activeTab=${this.rootTabCoordinator.currentRootTabId()} mode=${this.owner.mode}`,
    )
  }

  // ── Load state (inlined from former IndexHomeLoadStateGate) ──

  isHomeContentLoading(): boolean {
    if (this.owner.featuredEntries.length > 0) {
      return false
    }
    return this.owner.homeInitialLoadPending || this.owner.isRefreshing || this.owner.isHomeStartupRefreshing
  }

  settleInitialHomeLoadState(force: boolean = false): void {
    if (!this.owner.homeInitialLoadPending) {
      return
    }
    if (this.owner.isHomeStartupRefreshing) {
      return
    }
    if (this.owner.featuredEntries.length > 0) {
      this.owner.homeInitialLoadPending = false
      return
    }
    if (this.owner.initialFeedCount === 0 && !this.owner.isRefreshing) {
      this.owner.homeInitialLoadPending = false
      return
    }
    if (force && !this.owner.isRefreshing) {
      this.owner.homeInitialLoadPending = false
    }
  }

  homeEmptyStateTitle(): string {
    return this.isHomeContentLoading()
      ? '正在加载订阅内容'
      : '未发现订阅推文，请先到发现页面添加或刷新订阅源'
  }

  updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    const nextProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
    if (Math.abs(nextProgress - this.owner.headerBlurProgress) < 0.005) {
      return
    }
    this.owner.headerBlurProgress = nextProgress
  }

  // ── Mode scene (inlined from former IndexHomeModeScenePresenter) ──

  getModeSceneProps(mode: SubscriptionMode): ModeSceneRenderState {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.owner.renderedMode,
      previousMode: this.owner.previousMode,
      isTransitioning: this.owner.isModeTransitioning,
      direction: this.owner.modeTransitionDirection,
    })
  }

  modeListSwapTranslateY(mode: SubscriptionMode): number {
    if (this.owner.homeListSwapAnimating && mode === this.owner.homeListSwapMode) {
      return this.owner.homeListSwapTranslateY
    }
    return 0
  }

  // ── HomeFeedActions ──

  beginTweetPresentationDiagSession(mode: SubscriptionMode, reason: string, expectedStartIndex: number): void { this.owner.beginTweetPresentationDiagSession(mode, reason, expectedStartIndex) }
  flushTweetPresentationDiagSession(reason: string): void { this.owner.flushTweetPresentationDiagSession(reason) }
  runManagedTimeout(callback: () => void, delayMs: number): void { this.homeRuntimeCoordinator.runManagedTimeout(callback, delayMs) }
  showToast(message: string, duration?: number): void { this.owner.showToast(message, duration) }
  isHomeRootTab(): boolean { return this.rootTabCoordinator.isHomeRootTab() }
  hasHomeInlineSearchQuery(): boolean { return !!this.homeInlineSearchController.normalizedQuery() }
  readHomeModeScrollOffset(mode: SubscriptionMode): number { return this.homeRailCoordinator.readHomeModeScrollOffset(mode) }
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] { return this.owner.filteredEntriesFor(mode) }
  mergeFeaturedEntriesFromGroups(): EntryCardModel[] { return this.homeEntryDataManager.mergeFeaturedEntriesFromGroups() }
  applyEntriesForMode(mode: SubscriptionMode, entries: EntryCardModel[], deferredPersist: boolean, skipNotify?: boolean, skipMerge?: boolean, skipPersist?: boolean): void { this.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge, skipPersist) }
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void { this.homeEntryDataManager.schedulePersistSnapshot(entries) }
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void { this.homeEntryDataManager.notifyModeReloaded(mode) }
  notifyHomeEntryDataAppendedForMode(mode: SubscriptionMode, startIndex: number): void { this.owner.notifyHomeEntryDataAppendedForMode(mode, startIndex) }
  getItemRectForMode(mode: SubscriptionMode, index: number): RectResult { return this.owner.getItemRectForMode(mode, index) }
  bumpHomeContentVersion(): void { this.owner.bumpHomeContentVersion() }
  invalidateHomeLoadMorePrefetch(): void { this.homeFeedPagination.invalidateHomeLoadMorePrefetch() }
  resetModeLoadMoreStates(reason: string): void { this.homeFeedPagination.resetModeLoadMoreStates(reason) }
  scheduleHomeLoadMorePrefetch(delayMs?: number): void { this.homeFeedPagination.scheduleHomeLoadMorePrefetch(delayMs) }
  shouldRenderAllEntriesForMode(mode: SubscriptionMode): boolean { return this.homeFeedPagination.shouldRenderAllEntriesForMode(mode) }
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean { return this.homeFeedPagination.pendingLoadMoreForMode(mode) }
  hasRecentHomeScrollIntent(): boolean { return this.homeFeedPagination.hasRecentHomeScrollIntent() }
  handleHomeListEndReach(mode: SubscriptionMode, totalCount: number): void { this.homeFeedPagination.handleHomeListEndReach(mode, totalCount) }
  // reloadFeaturedEntriesFromLocal / reloadHomeEntriesFromLocal — implemented by methods above

  // ── HomeModeActions ──

  totalEntryCountFor(mode: SubscriptionMode): number { return this.homeFeedPagination.totalEntryCountFor(mode) }
  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode): void { this.owner.setHomeScrollInteracting(interacting, mode) }
  resetModeScrollIntent(mode: SubscriptionMode): void { this.owner.resetModeScrollIntent(mode) }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void { this.homeFeedPagination.ensureModeEntriesLoaded(mode) }
  syncHomeModeRailEffectiveProgress(): void { this.owner.syncHomeModeRailEffectiveProgress() }

  // ── HomeInlineSearchActions ──

  currentRootTabId(): RootTabId { return this.rootTabCoordinator.currentRootTabId() }
  currentSearchEntries(): EntryCardModel[] {
    if (this.owner.rootSettings.searchAllHomeCategories) {
      return this.owner.featuredEntries
    }
    return this.owner.filteredEntriesFor(this.owner.mode)
  }
  getSearchInputController(): TextInputController { return this.owner.getSearchInputController() }

  // ── HomeEntryDataActions ──

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void { this.homeFeedPagination.markModeLoaded(mode, loaded) }
  resetTweetPresentationCache(): void { this.owner.resetTweetPresentationCache() }
  animateWithUiContext(options: AnimateParam, event: () => void): void { this.owner.animateWithUiContext(options, event) }
}
