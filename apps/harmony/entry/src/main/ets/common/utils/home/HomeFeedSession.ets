import { EntryCardModel, HarmonySettings } from '../../models/LivoModels'
import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { SettingsStore } from '../../services/SettingsStore'
import { HomeEntrySnapshotStore } from '../../services/HomeEntrySnapshotStore'
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
import {
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_MAX_CANDIDATE_LIMIT,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { IndexHomeDiagnosticsLogger, IndexHomeDiagnosticsOwner } from '../index-home/IndexHomeDiagnosticsLogger'
import { IndexHomeLoadStateGate, IndexHomeLoadStateOwner } from '../index-home/IndexHomeLoadStateGate'
import { IndexHomeModeScenePresenter, IndexHomeModeSceneOwner } from '../index-home/IndexHomeModeScenePresenter'
import { IndexHomeRailCoordinator, IndexHomeRailOwner } from '../index-home/IndexHomeRailCoordinator'
import { IndexHomeRuntimeCoordinator, IndexHomeRuntimeOwner } from '../index-home/IndexHomeRuntimeCoordinator'
import { IndexRootTabCoordinator, IndexRootTabOwner } from '../index-home/IndexRootTabCoordinator'
import { IndexPageLifecycleController, IndexPageLifecycleOwner } from '../index-home/IndexPageLifecycleController'
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
    IndexHomeDiagnosticsOwner,
    IndexHomeLoadStateOwner,
    IndexHomeModeSceneOwner,
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
  readonly diagnosticsLogger: IndexHomeDiagnosticsLogger
  readonly loadStateGate: IndexHomeLoadStateGate
  readonly modeScenePresenter: IndexHomeModeScenePresenter
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

    this.diagnosticsLogger = new IndexHomeDiagnosticsLogger(owner)
    this.loadStateGate = new IndexHomeLoadStateGate(owner)
    this.modeScenePresenter = new IndexHomeModeScenePresenter(owner)
    this.homeRailCoordinator = new IndexHomeRailCoordinator(owner)
    this.rootTabCoordinator = new IndexRootTabCoordinator(owner)
    this.homeModeController = new HomeModeController(owner, this)
    this.homeEntryDataManager = new HomeEntryDataManager(owner, this)
    this.homeInlineSearchController = new HomeInlineSearchController(owner, this)
    this.homeRuntimeCoordinator = new IndexHomeRuntimeCoordinator(owner)
    this.pageLifecycle = new IndexPageLifecycleController(owner)
    this.homeFeedRefresh = new HomeFeedRefresh(owner, this, this.feedRefreshCoordinator)
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
    this.diagnosticsLogger.logHomePerf('loadInitialData start')
    this.homeFeedPagination.resetModeLoadMoreStates('load-initial')
    this.owner.homeInitialLoadPending = true
    this.owner.theme = ThemeService.currentPalette()
    void this.homeRuntimeCoordinator.applySystemBarStyle(this.owner.theme)
    const settingsPromise = SettingsStore.load()
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
    this.loadStateGate.settleInitialHomeLoadState()
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
    this.diagnosticsLogger.logHomePerf(
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
    this.diagnosticsLogger.logHomePerf(
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
    this.diagnosticsLogger.logHomeGroupStats(
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
    this.diagnosticsLogger.logHomePerf(
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
    this.diagnosticsLogger.logHomePerf(
      `reload-home start limit=${safeCandidateLimit} animated=${animated} `
      + `deferredGrouping=${deferredGrouping} fast=${preferFastPath}`,
    )
    const nextEntries = preferFastPath
      ? await this.featuredEntriesQuery.featuredEntriesFast(safeCandidateLimit)
      : await this.featuredEntriesQuery.featuredEntries(safeCandidateLimit)
    this.diagnosticsLogger.logHomeGroupStats(
      `reloadHomeEntriesFromLocal limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping)
    this.primeActiveModeLoadMorePrefetch('reload-home')
    this.diagnosticsLogger.logHomePerf(
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
            this.diagnosticsLogger.logHomeAsyncError(
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
    this.diagnosticsLogger.logHomeLoadMore(
      `prefetch-prime mode=${this.owner.mode} reason=${reason} delayMs=${delayMs}`,
    )
    this.homeFeedPagination.scheduleHomeLoadMorePrefetch(delayMs)
  }

  // ── HomeFeedActions ──

  logHomePerf(message: string): void { this.diagnosticsLogger.logHomePerf(message) }
  logHomeAsyncError(stage: string, error: Error | string | Object): void { this.diagnosticsLogger.logHomeAsyncError(stage, error) }
  logHomeLoadMore(message: string): void { this.diagnosticsLogger.logHomeLoadMore(message) }
  logHomeLoadState(message: string): void { this.diagnosticsLogger.logHomeLoadState(message) }
  describeError(error: Error | string | Object): string { return this.diagnosticsLogger.describeError(error) }
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
  settleInitialHomeLoadState(force?: boolean): void { this.loadStateGate.settleInitialHomeLoadState(force) }
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
  // reloadFeaturedEntriesFromLocal / reloadHomeEntriesFromLocal — implemented by existing methods above

  // ── HomeModeActions ──

  // readHomeModeScrollOffset — already declared above (shared with HomeFeedActions)
  totalEntryCountFor(mode: SubscriptionMode): number { return this.homeFeedPagination.totalEntryCountFor(mode) }
  // filteredEntriesFor — already declared above
  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode): void { this.owner.setHomeScrollInteracting(interacting, mode) }
  updateHeaderBlurProgress(offset: number): void { this.loadStateGate.updateHeaderBlurProgress(offset) }
  resetModeScrollIntent(mode: SubscriptionMode): void { this.owner.resetModeScrollIntent(mode) }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void { this.homeFeedPagination.ensureModeEntriesLoaded(mode) }
  // runManagedTimeout — already declared above

  // ── HomeInlineSearchActions ──

  currentRootTabId(): RootTabId { return this.rootTabCoordinator.currentRootTabId() }
  currentSearchEntries(): EntryCardModel[] {
    if (this.owner.rootSettings.searchAllHomeCategories) {
      return this.owner.featuredEntries
    }
    return this.owner.filteredEntriesFor(this.owner.mode)
  }
  getSearchInputController(): TextInputController { return this.owner.getSearchInputController() }
  // runManagedTimeout — already declared above

  // ── HomeEntryDataActions ──

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void { this.homeFeedPagination.markModeLoaded(mode, loaded) }
  // settleInitialHomeLoadState — already declared above (shared with HomeFeedActions)
  resetTweetPresentationCache(): void { this.owner.resetTweetPresentationCache() }
  animateWithUiContext(options: AnimateParam, event: () => void): void { this.owner.animateWithUiContext(options, event) }
  // runManagedTimeout — already declared above
  // bumpHomeContentVersion — already declared above
  // logHomeLoadMore — already declared above
}
