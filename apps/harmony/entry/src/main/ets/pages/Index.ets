import { ArrayLazyDataSource } from '../common/data/ArrayLazyDataSource'
import { HdsTabsController } from '@kit.UIDesignKit'
import { RootTabId } from '../common/navigation/AppRouter'
import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  EntryCardModel,
  HarmonySettings,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { showToast } from '../common/utils/PageToastHelper'
import { createEmptyHomeEntryGroups, HomeEntryGroups } from '../common/utils/home/HomeEntryGroups'
import { HomeFeedSession } from '../common/utils/home/HomeFeedSession'
import { HomeInlineSearchController } from '../common/utils/home/HomeInlineSearchController'
import { HomeEntryDataManager } from '../common/utils/home/HomeEntryDataManager'
import { TweetEntryPresentation } from '../common/utils/social/TweetEntryPresentation'
import {
  TweetEntryPresentationCache,
  TweetEntryPresentationCacheDiagnostics,
} from '../common/utils/social/TweetEntryPresentationCache'
import { PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'
import { IndexHomeOverlayLayer } from '../common/components/IndexHomeOverlayLayer'
import { IndexRootNavigationShell } from '../common/components/IndexRootNavigationShell'
import { MiniAudioPlayer } from '../common/components/MiniAudioPlayer'
import { HdsBottomTabId } from '../common/utils/index-home/HdsBottomTabConfig'
import { IndexHomeScrollerRegistry } from '../common/utils/index-home/IndexHomeScrollerRegistry'
import { emitRootTabScrollToTop, scrollScrollerToTop } from '../common/utils/index-home/RootTabScrollToTopSignal'
import { HomeScrollIntentTracker } from '../common/utils/home/HomeScrollIntentTracker'
import { resolveHomeVisibleEntryInitialLimit } from '../common/utils/home/HomeVisibleEntryPolicy'
import {
  createHomeCandidateLimitMap,
  createHomeLoadedMap,
  createHomeLoadingMap,
  createHomeModeBooleanMap,
  createHomeNoProgressCountMap,
  createHomeVisibleEntryLimitMap,
} from '../common/utils/home/HomeModeMapHelpers'
import { pictureCaption, pictureCardEntry, pictureGalleryUrls } from '../common/utils/home/HomePictureHelpers'
import { IndexHomeRootContentCallbacks } from '../common/components/IndexHomeRootContent'
import {
  AUTO_REFRESH_MIN_INTERVAL_MINUTES,
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_MAX_CANDIDATE_LIMIT,
  HOME_MODE_INITIAL_CANDIDATE_LIMIT,
  HomeEntryDataSourceMap,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeVisibleEntryLimitMap,
  RootTabSymbolPair,
  SubscriptionMode,
} from '../common/components/HomeRootConfig'

class IndexTweetPresentationCacheDiagnostics implements TweetEntryPresentationCacheDiagnostics {
  private readonly owner: Index

  constructor(owner: Index) {
    this.owner = owner
  }

  onAccess(hit: boolean, elapsedMs: number): void {
    if (!this.owner.tweetPresentationDiagStartedAt) {
      return
    }
    if (hit) {
      this.owner.tweetPresentationDiagHits += 1
      return
    }
    this.owner.tweetPresentationDiagMisses += 1
    this.owner.tweetPresentationDiagMissCostMs += elapsedMs
  }
}

@Entry
@Component
struct Index {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('systemThemeChangedAt') @Watch('handleSystemThemeChanged') systemThemeChangedAt: number = 0
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @StorageProp('discoverHasForegroundOverlay') discoverHasForegroundOverlay: boolean = false
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @StorageProp('settingsOverlayLevel') settingsOverlayLevel: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @StorageProp('showUnreadDot') showUnreadDot: boolean = true
  @State featuredEntries: EntryCardModel[] = []
  @State entryGroups: HomeEntryGroups<EntryCardModel> = createEmptyHomeEntryGroups<EntryCardModel>()
  @State feedSourceLabel: string = '本地内容已加载'
  @State isRefreshing: boolean = false
  @State refreshCompletedCount: number = 0
  @State refreshTotalCount: number = 0
  @State displayRefreshPercent: number = 0
  @State mode: SubscriptionMode = 'articles'
  @State renderedMode: SubscriptionMode = 'articles'
  @State previousMode: SubscriptionMode = 'articles'
  @State visitedModes: SubscriptionMode[] = ['articles']
  @State isModeTransitioning: boolean = false
  @State modeTransitionDirection: number = 1
  headerBlurProgress: number = 0
  @State currentHomeModeScrollOffset: number = 0
  @State homeModeRailDismissedByScroll: boolean = false
  @State homeModeRailDismissProgress: number = 0
  @State homeModeRailExpandedOverride: boolean = false
  @State homeModeRailExpandedLockOffset: number = -1
  @State homeListSwapOpacity: number = 1
  @State homeListSwapTranslateY: number = 0
  @State homeListSwapScale: number = 1
  @State homeListSwapMode: SubscriptionMode = 'articles'
  @State homeListSwapAnimating: boolean = false
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  @State searchOverlayVisible: boolean = false
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State rootSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State rootTabIndex: number = 0
  @State activeRootTabId: RootTabId = 'home'
  @State highlightedRootTabId: RootTabId = 'home'
  @State private suppressRootTabChange: boolean = false
  @State settingsScrollerBindingVersion: number = 0
  @State isHomeStartupRefreshing: boolean = false
  @State homeInitialLoadPending: boolean = true
  @State homeCandidateLimit: number = HOME_MODE_INITIAL_CANDIDATE_LIMIT
  @State homeCandidateLimitsByMode: HomeModeCandidateLimitMap = createHomeCandidateLimitMap()
  @State homeHasMoreEntries: boolean = true
  @State homeHasMoreEntriesByMode: HomeModeHasMoreMap = createHomeModeBooleanMap(true)
  @State homeLoadMoreInProgress: boolean = false
  @State homeVisibleEntryLimits: HomeModeVisibleEntryLimitMap = createHomeVisibleEntryLimitMap()
  // Bumped whenever entry groups or visible-entry limits change so that
  // descendant components (Shell → TabBody → IndexHomeRootContent → HomeModeEntriesPage)
  // re-evaluate their @Builder children and pull fresh entries through callbacks.
  @State homeContentVersion: number = 0
  private readonly rootTabsController: HdsTabsController = new HdsTabsController()
  private readonly scrollerRegistry: IndexHomeScrollerRegistry = new IndexHomeScrollerRegistry(this)
  private searchInputController: TextInputController = new TextInputController()
  readonly homeEntryDataSources: HomeEntryDataSourceMap = {
    articles: new ArrayLazyDataSource<EntryCardModel>(() => this.visibleEntriesFor('articles')),
    social: new ArrayLazyDataSource<EntryCardModel>(() => this.visibleEntriesFor('social')),
    pictures: new ArrayLazyDataSource<EntryCardModel>(() => this.visibleEntriesFor('pictures')),
    videos: new ArrayLazyDataSource<EntryCardModel>(() => this.visibleEntriesFor('videos')),
  }
  refreshPercentAnimationTimer: number = -1
  pendingRefreshPercentTarget: number = 0
  postRefreshReloadVersion: number = 0
  homePostRefreshReloadPending: boolean = false
  feedsChangedReloadVersion: number = 0
  hasDeferredFeedsChangedReload: boolean = false
  deferredFeedsChangedRetryToken: number = 0
  suppressFeedsChangedUntilMs: number = 0
  homeListSwapToken: number = 0
  lastRefreshProgressUiUpdateAt: number = 0
  isComponentActive: boolean = false
  hasLoadedInitialData: boolean = false
  initialFeedCount: number = 0
  homeInlineSearchFocusRequestToken: number = 0
  homeLoadMoreRequestToken: number = 0
  lastHomeLoadMoreRequestedAt: number = 0
  homeLoadMorePrefetchToken: number = 0
  homeLoadMorePrefetchLimit: number = 0
  homeLoadMorePrefetchEntries: EntryCardModel[] = []
  homeLoadMorePrefetchMode: SubscriptionMode = 'articles'
  homeLoadMorePrefetchInProgress: boolean = false
  readonly homeScrollIntent: HomeScrollIntentTracker = new HomeScrollIntentTracker()
  homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap = createHomeNoProgressCountMap()
  homeModeLoaded: HomeModeLoadedMap = createHomeLoadedMap()
  homeModeLoading: HomeModeLoadingMap = createHomeLoadingMap()
  lastHomeLoadMoreCompletedAt: number = 0
  lastHomeRefreshFinishedAt: number = 0
  homePerfSessionId: number = 0
  homePerfSessionStartedAt: number = 0
  tweetPresentationDiagToken: number = 0
  tweetPresentationDiagMode: SubscriptionMode = 'articles'
  tweetPresentationDiagReason: string = ''
  tweetPresentationDiagExpectedStartIndex: number = 0
  tweetPresentationDiagStartedAt: number = 0
  tweetPresentationDiagHits: number = 0
  tweetPresentationDiagMisses: number = 0
  tweetPresentationDiagMissCostMs: number = 0
  private precacheModeToken: number = 0
  private readonly tweetPresentationCacheDiagnostics: TweetEntryPresentationCacheDiagnostics =
    new IndexTweetPresentationCacheDiagnostics(this)
  private readonly tweetPresentationCache: TweetEntryPresentationCache =
    new TweetEntryPresentationCache(this.tweetPresentationCacheDiagnostics)
  // HomeFeedSession owns all coordinators and bootstrap logic.
  // Index still holds every @State field (ArkUI reactivity), but the wiring,
  // bootstrap, reload, and precache logic lives in the session.
  readonly session: HomeFeedSession = new HomeFeedSession(this)
  // Accessors required by IndexPageLifecycleOwner (HomeFeedSessionOwner).
  get homeInlineSearchController(): HomeInlineSearchController { return this.session.homeInlineSearchController }
  get homeEntryDataManager(): HomeEntryDataManager { return this.session.homeEntryDataManager }

  aboutToAppear(): void { this.session.homeRuntimeCoordinator.aboutToAppear() }
  aboutToDisappear(): void { this.session.homeRuntimeCoordinator.aboutToDisappear() }
  onPageShow(): void { this.session.pageLifecycle.onPageShow() }
  onBackPress(): boolean { return this.session.pageLifecycle.onBackPress() }

  // --- Infra (delegated to runtime coordinator — single source for managed timeouts & timers) ---
  runManagedTimeout(callback: () => void, delayMs: number): void { this.session.homeRuntimeCoordinator.runManagedTimeout(callback, delayMs) }

  describeError(error: Error | string | Object): string { return this.session.diagnosticsLogger.describeError(error) }
  logHomeAsyncError(stage: string, error: Error | string | Object): void { this.session.diagnosticsLogger.logHomeAsyncError(stage, error) }
  logHomeLoadMore(message: string): void { this.session.diagnosticsLogger.logHomeLoadMore(message) }
  logHomePerf(message: string): void { this.session.diagnosticsLogger.logHomePerf(message) }
  logHomeLoadState(message: string): void { this.session.diagnosticsLogger.logHomeLoadState(message) }
  logHomeGroupStats(stage: string, entries: EntryCardModel[]): void { this.session.diagnosticsLogger.logHomeGroupStats(stage, entries) }
  beginTweetPresentationDiagSession(mode: SubscriptionMode, reason: string, expectedStartIndex: number): void {
    this.tweetPresentationDiagToken += 1
    this.tweetPresentationDiagMode = mode
    this.tweetPresentationDiagReason = reason
    this.tweetPresentationDiagExpectedStartIndex = expectedStartIndex
    this.tweetPresentationDiagStartedAt = Date.now()
    this.tweetPresentationDiagHits = 0
    this.tweetPresentationDiagMisses = 0
    this.tweetPresentationDiagMissCostMs = 0
    this.logHomeLoadMore(
      `tweet-presentation-diag-start token=${this.tweetPresentationDiagToken} mode=${mode} reason=${reason} startIndex=${expectedStartIndex}`,
    )
  }
  flushTweetPresentationDiagSession(reason: string): void {
    if (!this.tweetPresentationDiagStartedAt) {
      return
    }
    this.logHomeLoadMore(
      `tweet-presentation-diag-done token=${this.tweetPresentationDiagToken} mode=${this.tweetPresentationDiagMode} `
      + `reason=${reason} source=${this.tweetPresentationDiagReason} startIndex=${this.tweetPresentationDiagExpectedStartIndex} `
      + `elapsedMs=${Date.now() - this.tweetPresentationDiagStartedAt} hits=${this.tweetPresentationDiagHits} `
      + `misses=${this.tweetPresentationDiagMisses} missCostMs=${this.tweetPresentationDiagMissCostMs}`,
    )
    this.tweetPresentationDiagStartedAt = 0
    this.tweetPresentationDiagHits = 0
    this.tweetPresentationDiagMisses = 0
    this.tweetPresentationDiagMissCostMs = 0
  }

  // === Bootstrap (logic lives in HomeFeedSession) ===
  async loadInitialData(): Promise<void> { await this.session.loadInitialData() }
  resumeLoadedHome(): void { this.session.resumeHomeFeed() }
  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> { await this.session.homeFeedRefresh.startStartupRefreshIfNeeded(snapshotRestored) }
  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> { await this.session.homeFeedRefresh.refreshFeaturedEntries(showResultToast) }
  clearRefreshPercentAnimation(): void { this.session.homeFeedRefresh.clearRefreshPercentAnimation() }

  // === Reload (logic lives in HomeFeedSession) ===
  async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = false,
    targetMode: SubscriptionMode = this.mode,
  ): Promise<void> {
    await this.session.reloadFeaturedEntriesFromLocal(candidateLimit, animated, deferredGrouping, preferFastPath, targetMode)
  }

  async reloadHomeEntriesFromLocal(
    candidateLimit: number = HOME_MAX_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = true,
  ): Promise<void> {
    await this.session.reloadHomeEntriesFromLocal(candidateLimit, animated, deferredGrouping, preferFastPath)
  }

  precacheNonActiveModes(): void { this.session.precacheNonActiveModes() }

  showToast(message: string, duration: number = 2000): void {
    if (!this.isComponentActive) {
      return
    }
    showToast(this.getUIContext(), message, duration)
  }

  animateWithUiContext(options: AnimateParam, event: () => void): void {
    if (!this.isComponentActive) {
      event()
      return
    }
    this.getUIContext().animateTo(options, event)
  }

  settleInitialHomeLoadState(force: boolean = false): void { this.session.loadStateGate.settleInitialHomeLoadState(force) }
  homeEmptyStateTitle(): string { return this.session.loadStateGate.homeEmptyStateTitle() }
  updateHeaderBlurProgress(offset: number): void { this.session.loadStateGate.updateHeaderBlurProgress(offset) }

  readHomeModeScrollOffset(mode: SubscriptionMode): number { return this.session.homeRailCoordinator.readHomeModeScrollOffset(mode) }
  syncHomeModeRailState(mode: SubscriptionMode = this.mode): void { this.session.homeRailCoordinator.syncHomeModeRailState(mode) }
  primeHomeModeRailForRootActivation(): void { this.session.homeRailCoordinator.primeHomeModeRailForRootActivation() }

  animateModeRailDismiss(show: boolean): void {
    this.homeModeRailDismissedByScroll = !show
    const target = show ? 0 : 1
    this.animateWithUiContext({ duration: 80, curve: Curve.EaseInOut }, () => {
      this.homeModeRailDismissProgress = target
    })
  }

  resetModeRailProgress(): void {
    this.homeModeRailDismissedByScroll = false
    this.homeModeRailDismissProgress = 0
  }

  markHomeUserScrollIntent(mode: SubscriptionMode, scrollSource: ScrollSource): void { this.homeScrollIntent.markUserScroll(this.mode, mode, scrollSource) }
  modeScrollIntentVersion(mode: SubscriptionMode): number { return this.homeScrollIntent.intentVersion(mode) }
  consumedModeScrollIntentVersion(mode: SubscriptionMode): number { return this.homeScrollIntent.consumedVersion(mode) }
  setConsumedModeScrollIntentVersion(mode: SubscriptionMode, value: number): void { this.homeScrollIntent.setConsumedVersion(mode, value) }
  resetModeScrollIntent(mode: SubscriptionMode): void {
    this.homeScrollIntent.reset(mode)
    this.session.homeFeedPagination.resetModeScrollProgressLoadMoreValue(mode)
  }
  setHomeScrollInteracting(interacting: boolean, _mode: SubscriptionMode = this.mode): void { this.homeScrollIntent.setInteracting(interacting) }

  bumpHomeContentVersion(): void {
    // Wraparound is safe; only the change matters for @Prop diffing.
    this.homeContentVersion = (this.homeContentVersion + 1) | 0
  }

  currentSearchEntries(): EntryCardModel[] {
    if (this.rootSettings.searchAllHomeCategories) {
      return this.featuredEntries
    }
    return this.filteredEntriesFor(this.mode)
  }
  hasHomeInlineSearchQuery(): boolean { return !!this.session.homeInlineSearchController.normalizedQuery() }
  getSearchInputController(): TextInputController { return this.searchInputController }
  logHomeInlineSearchFocusDebug(stage: string, message: string): void { this.session.homeInlineSearchController.logFocusDebug(stage, message) }
  closeHomeInlineSearch(clearQuery: boolean): void { this.session.homeInlineSearchController.close(clearQuery) }

  isHomeRootTab(): boolean { return this.session.rootTabCoordinator.isHomeRootTab() }
  homeScrollerForMode(mode: SubscriptionMode): Scroller { return this.scrollerRegistry.homeScrollerForMode(mode) }

  private handleSystemThemeChanged(): void { void this.session.homeRuntimeCoordinator.handleSystemThemeChanged() }
  applySystemBarStyle(theme: ThemePalette): Promise<void> { return this.session.homeRuntimeCoordinator.applySystemBarStyle(theme) }
  syncRequestedRootTab(): void { this.session.rootTabCoordinator.syncRequestedRootTab() }
  isRootTabChangeSuppressed(): boolean { return this.suppressRootTabChange }
  syncRootTabsController(): void {
    try {
      this.suppressRootTabChange = true
      this.rootTabsController.changeIndex(this.rootTabIndex)
    } catch (_) {
    } finally {
      this.suppressRootTabChange = false
    }
  }

  openEntry(entry: EntryCardModel): void { this.session.pageLifecycle.openEntry(entry) }
  currentRootTabId(): RootTabId { return this.session.rootTabCoordinator.currentRootTabId() }
  scrollRootTabToTop(tabId: RootTabId): void {
    if (tabId === 'home') {
      scrollScrollerToTop(this.homeScrollerForMode(this.mode), '首页')
      this.updateHeaderBlurProgress(0)
      this.syncHomeModeRailState(this.mode)
      return
    }

    emitRootTabScrollToTop(tabId)
  }
  handleModeSwipe(event: GestureEvent): void { this.session.homeModeController.handleModeSwipe(event) }

  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    switch (mode) {
      case 'social': return this.entryGroups.social
      case 'pictures': return this.entryGroups.pictures
      case 'videos': return this.entryGroups.videos
      default: return this.entryGroups.articles
    }
  }

  private homeEntryDataSourceFor(mode: SubscriptionMode): ArrayLazyDataSource<EntryCardModel> {
    switch (mode) {
      case 'social': return this.homeEntryDataSources.social
      case 'pictures': return this.homeEntryDataSources.pictures
      case 'videos': return this.homeEntryDataSources.videos
      default: return this.homeEntryDataSources.articles
    }
  }

  presentTweetEntry(entry: EntryCardModel): TweetEntryPresentation { return this.tweetPresentationCache.get(entry) }
  resetTweetPresentationCache(): void { this.tweetPresentationCache.clear() }

  // === Feeds-changed handling ===
  private markDeferredFeedsChangedReload(reason: string): void { this.session.homeFeedRefresh.markDeferredFeedsChangedReload(reason) }
  private scheduleDeferredFeedsChangedRetry(delayMs: number): void { this.session.homeFeedRefresh.scheduleDeferredFeedsChangedRetry(delayMs) }
  private scheduleFeedsChangedReload(reason: string): void { this.session.homeFeedRefresh.scheduleFeedsChangedReload(reason) }
  tryFlushDeferredFeedsChangedReload(source: string): boolean { return this.session.homeFeedRefresh.tryFlushDeferredFeedsChangedReload(source) }
  private handleFeedsChanged(): void { this.session.homeFeedRefresh.handleFeedsChanged() }
  private shouldRunFinalHomeReloadNow(): boolean { return this.session.homeFeedRefresh.shouldRunFinalHomeReloadNow() }
  private scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void { this.session.homeFeedRefresh.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt) }
  private scheduleHomeReloadAfterRefresh(): void { this.session.homeFeedRefresh.scheduleHomeReloadAfterRefresh() }

  // === Pagination delegation ===
  resolveHomeCandidateLimit(minimumLimit: number): number { return this.session.homeFeedPagination.resolveHomeCandidateLimit(minimumLimit) }
  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean { return this.session.homeFeedPagination.shouldRenderAllEntriesForMode(_mode) }
  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void { this.session.homeFeedPagination.setCandidateLimitForMode(mode, limit) }
  resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number { return this.session.homeFeedPagination.resolveHomeCandidateLimitForMode(mode, minimumLimit) }
  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void { this.session.homeFeedPagination.markModeLoaded(mode, loaded) }
  isModeLoaded(mode: SubscriptionMode): boolean { return this.session.homeFeedPagination.isModeLoaded(mode) }
  isModeLoading(mode: SubscriptionMode): boolean { return this.session.homeFeedPagination.isModeLoading(mode) }
  setModeLoading(mode: SubscriptionMode, loading: boolean): void { this.session.homeFeedPagination.setModeLoading(mode, loading) }
  totalEntryCountFor(mode: SubscriptionMode): number { return this.session.homeFeedPagination.totalEntryCountFor(mode) }
  private hasBufferedEntriesForMode(mode: SubscriptionMode): boolean { return this.session.homeFeedPagination.hasBufferedEntriesForMode(mode) }
  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] { return this.session.homeFeedPagination.visibleEntriesFor(mode) }
  private visibleEntryCountFor(mode: SubscriptionMode): number { return this.session.homeFeedPagination.visibleEntryCountFor(mode) }
  syncModePaginationFromReloadResult(mode: SubscriptionMode, entries: EntryCardModel[], candidateLimit: number): void { this.session.homeFeedPagination.syncModePaginationFromReloadResult(mode, entries, candidateLimit) }
  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void { this.session.homeFeedPagination.setModeHasMoreEntries(mode, next, reason) }
  resetModeLoadMoreStates(reason: string): void { this.session.homeFeedPagination.resetModeLoadMoreStates(reason) }
  hasRecentHomeScrollIntent(): boolean { return this.session.homeFeedPagination.hasRecentHomeScrollIntent() }
  invalidateHomeLoadMorePrefetch(): void { this.session.homeFeedPagination.invalidateHomeLoadMorePrefetch() }
  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void { this.session.homeFeedPagination.scheduleHomeLoadMorePrefetch(delayMs) }
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean { return this.session.homeFeedPagination.pendingLoadMoreForMode(mode) }
  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void { this.session.homeFeedPagination.maybeTriggerLoadMoreByScrollProgress(mode, currentOffset) }
  flushPendingLoadMoreForMode(mode: SubscriptionMode): void { this.session.homeFeedPagination.flushPendingLoadMoreForMode(mode) }
  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void { this.session.homeFeedPagination.handleHomeEntryAppear(mode, index, totalCount) }
  handleHomeListEndReach(mode: SubscriptionMode, totalCount: number): void {
    this.session.homeFeedPagination.handleHomeListEndReach(mode, totalCount)
  }

  // === Data management delegation ===
  mergeFeaturedEntriesFromGroups(): EntryCardModel[] { return this.session.homeEntryDataManager.mergeFeaturedEntriesFromGroups() }
  applyEntriesForMode(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    deferredPersist: boolean,
    skipNotify: boolean = false,
    skipMerge: boolean = false,
    skipPersist: boolean = false,
  ): void {
    this.session.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge, skipPersist)
  }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void { this.session.homeFeedPagination.ensureModeEntriesLoaded(mode) }
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void { this.session.homeEntryDataManager.schedulePersistSnapshot(entries) }
  persistHomeSnapshotNow(): void { this.session.homeEntryDataManager.persistSnapshotNow() }
  applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void { this.session.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping) }
  modeListSwapTranslateY(mode: SubscriptionMode): number { return this.session.modeScenePresenter.modeListSwapTranslateY(mode) }
  notifyHomeEntryDataReloaded(): void { this.session.homeEntryDataManager.notifyAllReloaded() }
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void { this.session.homeEntryDataManager.notifyModeReloaded(mode) }
  notifyHomeEntryDataAppendedForMode(mode: SubscriptionMode, startIndex: number): void {
    this.homeEntryDataSourceFor(mode).notifyDataAdded(startIndex)
  }

  getItemRectForMode(mode: SubscriptionMode, index: number): RectResult {
    try {
      return this.homeScrollerForMode(mode).getItemRect(index)
    } catch (_) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }
  }

  pictureGalleryUrls(entry: EntryCardModel): string[] { return pictureGalleryUrls(entry) }
  pictureCaption(entry: EntryCardModel): string { return pictureCaption(entry) }
  pictureCardEntry(entry: EntryCardModel): Entry { return pictureCardEntry(entry) }
  modeSceneVisible(mode: SubscriptionMode): Visibility { return this.session.modeScenePresenter.getSceneProps(mode).visibility === 'visible' ? Visibility.Visible : Visibility.Hidden }
  modeSceneOpacity(mode: SubscriptionMode): number { return this.session.modeScenePresenter.getSceneProps(mode).opacity }
  modeSceneOffset(mode: SubscriptionMode): number { return this.session.modeScenePresenter.getSceneProps(mode).offset }
  modeSceneZIndex(mode: SubscriptionMode): number { return this.session.modeScenePresenter.getSceneProps(mode).zIndex }
  clearAutoRefreshTimer(): void { this.session.homeRuntimeCoordinator.clearAutoRefreshTimer() }
  configureAutoRefreshTimer(): void { this.session.homeRuntimeCoordinator.configureAutoRefreshTimer() }

  private indexHomeRootContentCallbacks(): IndexHomeRootContentCallbacks {
    return {
      onModeSwipe: (event: GestureEvent): void => { this.handleModeSwipe(event) },
      getDataSource: (mode: SubscriptionMode): ArrayLazyDataSource<EntryCardModel> => this.homeEntryDataSourceFor(mode),
      isModeLoading: (mode: SubscriptionMode): boolean => this.isModeLoading(mode),
      isModeLoadingMore: (_mode: SubscriptionMode): boolean => false,
      getEmptyStateTitle: (): string => this.homeEmptyStateTitle(),
      getSceneOpacity: (mode: SubscriptionMode): number => this.modeSceneOpacity(mode),
      getSceneOffsetX: (mode: SubscriptionMode): number => this.modeSceneOffset(mode),
      getSceneZIndex: (mode: SubscriptionMode): number => this.modeSceneZIndex(mode),
      getSceneVisible: (mode: SubscriptionMode): Visibility => this.modeSceneVisible(mode),
      getListSwapTranslateY: (mode: SubscriptionMode): number => this.modeListSwapTranslateY(mode),
      getScroller: (mode: SubscriptionMode): Scroller => this.homeScrollerForMode(mode),
      onWillScroll: (mode: SubscriptionMode, _scrollOffset: number, scrollSource: ScrollSource): ScrollResult | void => {
        this.markHomeUserScrollIntent(mode, scrollSource)
        return undefined
      },
      onDidScroll: (mode: SubscriptionMode): void => {
        if (mode !== 'videos') {
          this.syncHomeModeRailState(mode)
        }
        this.maybeTriggerLoadMoreByScrollProgress(mode, this.readHomeModeScrollOffset(mode))
        this.flushPendingLoadMoreForMode(mode)
      },
      onStopDragging: (mode: SubscriptionMode): void => {
        if (mode === 'videos') {
          this.syncHomeModeRailState(mode)
        }
        this.setHomeScrollInteracting(false, mode)
        this.flushPendingLoadMoreForMode(mode)
        this.scheduleHomeLoadMorePrefetch(160)
      },
      onEntryOpen: (entry: EntryCardModel): void => { this.openEntry(entry) },
      onItemAppear: (mode: SubscriptionMode, index: number, totalCount: number): void => {
        this.handleHomeEntryAppear(mode, index, totalCount)
      },
      onListEndReach: (mode: SubscriptionMode, totalCount: number): void => {
        this.handleHomeListEndReach(mode, totalCount)
      },
      getTweetPresentation: (entry: EntryCardModel): TweetEntryPresentation => this.presentTweetEntry(entry),
      getPictureEntry: (entry: EntryCardModel): Entry => this.pictureCardEntry(entry),
      getPictureCaption: (entry: EntryCardModel): string => this.pictureCaption(entry),
      getPictureGalleryUrls: (entry: EntryCardModel): string[] => this.pictureGalleryUrls(entry),
    }
  }

  private handleHomeRefreshAction(): void {
    if (this.isRefreshing || this.isHomeStartupRefreshing) {
      this.showToast('正在刷新，请稍候', 1200)
      return
    }

    this.showToast('正在刷新订阅...', 1200)
    void this.refreshFeaturedEntries()
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      IndexRootNavigationShell({
        controller: this.rootTabsController,
        theme: this.theme,
        rootSettings: this.rootSettings,
        showUnreadDot: this.showUnreadDot,
        mode: this.mode,
        renderedMode: this.renderedMode,
        previousMode: this.previousMode,
        isModeTransitioning: this.isModeTransitioning,
        modeTransitionDirection: this.modeTransitionDirection,
        homeInitialLoadPending: this.homeInitialLoadPending,
        isHomeStartupRefreshing: this.isHomeStartupRefreshing,
        homeLoadMoreInProgress: this.homeLoadMoreInProgress,
        homeListSwapAnimating: this.homeListSwapAnimating,
        homeListSwapMode: this.homeListSwapMode,
        homeListSwapOpacity: this.homeListSwapOpacity,
        homeContentVersion: this.homeContentVersion,
        hideBottomTabs: this.session.rootTabCoordinator.shouldHideBottomTabs(),
        hideTitleBar: this.session.rootTabCoordinator.shouldHideRootTitleBar(),
        showHomeTitleActions: this.session.rootTabCoordinator.isHomeRootTab() && !this.showSearch,
        isHomeRootTab: this.session.rootTabCoordinator.isHomeRootTab(),
        currentRootTitle: this.session.rootTabCoordinator.currentRootTitle(),
        bindScrollers: this.scrollerRegistry.currentRootBindScrollers(),
        homeCallbacks: this.indexHomeRootContentCallbacks(),
        rootTabSymbolPair: (tabId: HdsBottomTabId): RootTabSymbolPair => this.session.rootTabCoordinator.rootTabSymbolPair(tabId),
        onRootTabChange: (index: number) => this.session.rootTabCoordinator.handleRootTabChange(index),
        onRootTabBarClick: (index: number) => this.session.rootTabCoordinator.handleRootTabBarClick(index),
        onTabAppear: (tabId: RootTabId) => this.session.rootTabCoordinator.confirmRootTabSelection(tabId),
        onSettingsContentScrollerReady: (scroller: Scroller) => this.scrollerRegistry.handleSettingsContentScrollerReady(scroller),
        onSettingsChange: (settings: HarmonySettings) => this.session.pageLifecycle.handleRootSettingsChange(settings),
        onThemeChange: (theme: ThemePalette) => this.session.pageLifecycle.handleRootThemeChange(theme),
        onHomeRefresh: () => this.handleHomeRefreshAction(),
        onHomeSearchOpen: () => this.session.homeInlineSearchController.open(),
      })

      IndexHomeOverlayLayer({
        isHomeRootTab: this.session.rootTabCoordinator.isHomeRootTab(),
        theme: this.theme,
        mode: this.mode,
        interactionLocked: this.isModeTransitioning,
        isRefreshing: this.isRefreshing,
        refreshTotalCount: this.refreshTotalCount,
        displayRefreshPercent: this.displayRefreshPercent,
        showSearch: this.showSearch,
        searchOverlayVisible: this.searchOverlayVisible,
        searchQuery: this.searchQuery,
        searchAllHomeCategories: this.rootSettings.searchAllHomeCategories,
        collapsedModeRailTopPadding: this.session.homeRailCoordinator.homeCollapsedModeRailTopPadding(),
        horizontalPadding: PAGE_HORIZONTAL_PADDING,
        searchFieldOffsetY: this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
        searchResultEntries: this.session.homeInlineSearchController.searchResultEntries(),
        searchShowEmptyState: this.session.homeInlineSearchController.hasSearchResultEmptyState(),
        inputController: this.searchInputController,
        modeRailDismissOffset: this.session.homeRailCoordinator.homeModeRailDismissTranslateY(),
        modeRailDismissOpacity: Math.max(0, 1 - this.homeModeRailDismissProgress),
        onModeChange: (mode: SubscriptionMode) => this.session.homeModeController.requestModeSwitch(mode),
        onQueryChange: (value: string) => { this.searchQuery = value },
        onSearchClose: (clearQuery: boolean) => this.session.homeInlineSearchController.close(clearQuery),
        onEntryClick: (entry: EntryCardModel) => {
          this.openEntry(entry)
          this.session.homeInlineSearchController.close(true)
        },
        onSearchInputAppear: () => this.session.homeInlineSearchController.focus(),
        summaryTextForEntry: (entry: EntryCardModel): string => this.session.homeInlineSearchController.searchResultSummaryText(entry),
      })

      MiniAudioPlayer({ theme: this.theme })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut }).opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut }).opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut }).opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut }).opacity(0)
  }
}
