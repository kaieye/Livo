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
import { createEmptyHomeEntryGroups, HomeEntryGroups } from '../common/utils/HomeEntryGroups'
import { HomeEntryDataManager } from '../common/utils/HomeEntryDataManager'
import { HomeInlineSearchController } from '../common/utils/HomeInlineSearchController'
import { HomeModeController } from '../common/utils/HomeModeController'
import { TweetEntryPresentation } from '../common/utils/TweetEntryPresentation'
import { TweetEntryPresentationCache } from '../common/utils/TweetEntryPresentationCache'
import { PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'
import { IndexHomeOverlayLayer } from '../common/components/IndexHomeOverlayLayer'
import { IndexRootNavigationShell } from '../common/components/IndexRootNavigationShell'
import { HdsBottomTabId } from '../common/utils/HdsBottomTabConfig'
import {
  rootBlurEffectiveEndOffset,
  rootBlurStrategy,
  rootOriginalTitleBarBlurRadius,
  rootScrollEffectTitleBarBlurRadius,
  rootScrollEffectType,
  rootSystemMaterialEffect,
  rootTitleBarMaskExtraHeight,
  rootTransparentBackgroundColor,
} from '../common/utils/IndexRootChrome'
import { IndexHomeBootstrapCoordinator } from '../common/utils/IndexHomeBootstrapCoordinator'
import { IndexHomeRefreshCoordinator } from '../common/utils/IndexHomeRefreshCoordinator'
import { IndexHomePaginationCoordinator } from '../common/utils/IndexHomePaginationCoordinator'
import { IndexHomeRailCoordinator } from '../common/utils/IndexHomeRailCoordinator'
import { IndexHomeRuntimeCoordinator } from '../common/utils/IndexHomeRuntimeCoordinator'
import { IndexHomeReloadCoordinator } from '../common/utils/IndexHomeReloadCoordinator'
import { IndexHomeDiagnosticsLogger } from '../common/utils/IndexHomeDiagnosticsLogger'
import { IndexHomeModeScenePresenter } from '../common/utils/IndexHomeModeScenePresenter'
import { IndexHomeScrollerRegistry } from '../common/utils/IndexHomeScrollerRegistry'
import { IndexHomeLoadStateGate } from '../common/utils/IndexHomeLoadStateGate'
import { IndexPageLifecycleController } from '../common/utils/IndexPageLifecycleController'
import { IndexRootTabCoordinator } from '../common/utils/IndexRootTabCoordinator'
import {
  IndexHomeEntryDataDelegate,
  IndexHomeInlineSearchDelegate,
  IndexHomeModeDelegate,
} from '../common/utils/IndexHomeDelegates'
import { HomeScrollIntentTracker } from '../common/utils/HomeScrollIntentTracker'
import {
  createHomeCandidateLimitMap,
  createHomeLoadedMap,
  createHomeLoadingMap,
  createHomeModeBooleanMap,
  createHomeNoProgressCountMap,
  createHomeVisibleEntryLimitMap,
  pictureCaption,
  pictureCardEntry,
  pictureGalleryUrls,
} from '../common/utils/IndexHomeStateFactory'
import { createIndexHomeRootContentCallbacks } from '../common/utils/IndexHomeRootContentCallbacksFactory'
import {
  HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
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
  @State headerBlurProgress: number = 0
  @State currentHomeModeScrollOffset: number = 0
  @State homeModeRailDismissedByScroll: boolean = false
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
  private readonly rootTabsController: HdsTabsController = new HdsTabsController()
  private readonly scrollerRegistry: IndexHomeScrollerRegistry = new IndexHomeScrollerRegistry(this)
  private searchInputController: TextInputController = new TextInputController()
  readonly homeEntryDataSources: HomeEntryDataSourceMap = {
    articles: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.articles),
    social: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.social),
    pictures: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.pictures),
    videos: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.videos),
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
  private homeInlineSearchFocusRequestToken: number = 0
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
  private readonly tweetPresentationCache: TweetEntryPresentationCache = new TweetEntryPresentationCache()
  readonly diagnosticsLogger: IndexHomeDiagnosticsLogger = new IndexHomeDiagnosticsLogger(this)
  readonly loadStateGate: IndexHomeLoadStateGate = new IndexHomeLoadStateGate(this)
  readonly modeScenePresenter: IndexHomeModeScenePresenter = new IndexHomeModeScenePresenter(this)
  readonly homeRuntimeCoordinator: IndexHomeRuntimeCoordinator = new IndexHomeRuntimeCoordinator(this)
  readonly homeBootstrapCoordinator: IndexHomeBootstrapCoordinator = new IndexHomeBootstrapCoordinator(this)
  readonly homeModeController: HomeModeController = new HomeModeController(this.createHomeModeDelegate())
  readonly homeEntryDataManager: HomeEntryDataManager = new HomeEntryDataManager(this.createHomeEntryDataDelegate())
  readonly homeInlineSearchController: HomeInlineSearchController = new HomeInlineSearchController(this.createHomeInlineSearchDelegate())
  readonly homeRefreshCoordinator: IndexHomeRefreshCoordinator = new IndexHomeRefreshCoordinator(this)
  readonly homePaginationCoordinator: IndexHomePaginationCoordinator = new IndexHomePaginationCoordinator(this)
  readonly homeRailCoordinator: IndexHomeRailCoordinator = new IndexHomeRailCoordinator(this)
  readonly homeReloadCoordinator: IndexHomeReloadCoordinator = new IndexHomeReloadCoordinator(this)
  readonly rootTabCoordinator: IndexRootTabCoordinator = new IndexRootTabCoordinator(this)
  readonly pageLifecycle: IndexPageLifecycleController = new IndexPageLifecycleController(this)

  private createHomeModeDelegate(): IndexHomeModeDelegate { return new IndexHomeModeDelegate(this) }
  private createHomeEntryDataDelegate(): IndexHomeEntryDataDelegate { return new IndexHomeEntryDataDelegate(this) }
  private createHomeInlineSearchDelegate(): IndexHomeInlineSearchDelegate { return new IndexHomeInlineSearchDelegate(this) }

  aboutToAppear(): void { this.homeRuntimeCoordinator.aboutToAppear() }
  aboutToDisappear(): void { this.homeRuntimeCoordinator.aboutToDisappear() }
  onPageShow(): void { this.pageLifecycle.onPageShow() }
  onBackPress(): boolean { return this.pageLifecycle.onBackPress() }

  runManagedTimeout(callback: () => void, delayMs: number): void { this.homeRuntimeCoordinator.runManagedTimeout(callback, delayMs) }
  describeError(error: Error | string | Object): string { return this.diagnosticsLogger.describeError(error) }
  logHomeAsyncError(stage: string, error: Error | string | Object): void { this.diagnosticsLogger.logHomeAsyncError(stage, error) }
  logHomeLoadMore(message: string): void { this.diagnosticsLogger.logHomeLoadMore(message) }
  logHomePerf(message: string): void { this.diagnosticsLogger.logHomePerf(message) }
  logHomeLoadState(message: string): void { this.diagnosticsLogger.logHomeLoadState(message) }
  logHomeGroupStats(stage: string, entries: EntryCardModel[]): void { this.diagnosticsLogger.logHomeGroupStats(stage, entries) }

  async loadInitialData(): Promise<void> { await this.homeBootstrapCoordinator.loadInitialData() }
  resumeLoadedHome(): void { this.homeBootstrapCoordinator.resumeLoadedHome() }
  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> { await this.homeRefreshCoordinator.startStartupRefreshIfNeeded(snapshotRestored) }
  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> { await this.homeRefreshCoordinator.refreshFeaturedEntries(showResultToast) }
  clearRefreshPercentAnimation(): void { this.homeRefreshCoordinator.clearRefreshPercentAnimation() }

  showToast(message: string, duration: number = 2000): void {
    if (!this.isComponentActive) {
      return
    }
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  animateWithUiContext(options: AnimateParam, event: () => void): void {
    if (!this.isComponentActive) {
      event()
      return
    }
    this.getUIContext().animateTo(options, event)
  }

  settleInitialHomeLoadState(force: boolean = false): void { this.loadStateGate.settleInitialHomeLoadState(force) }
  homeEmptyStateTitle(): string { return this.loadStateGate.homeEmptyStateTitle() }
  updateHeaderBlurProgress(offset: number): void { this.loadStateGate.updateHeaderBlurProgress(offset) }

  readHomeModeScrollOffset(mode: SubscriptionMode): number { return this.homeRailCoordinator.readHomeModeScrollOffset(mode) }
  syncHomeModeRailState(mode: SubscriptionMode = this.mode): void { this.homeRailCoordinator.syncHomeModeRailState(mode) }
  primeHomeModeRailForRootActivation(): void { this.homeRailCoordinator.primeHomeModeRailForRootActivation() }

  markHomeUserScrollIntent(mode: SubscriptionMode, scrollSource: ScrollSource): void { this.homeScrollIntent.markUserScroll(this.mode, mode, scrollSource) }
  modeScrollIntentVersion(mode: SubscriptionMode): number { return this.homeScrollIntent.intentVersion(mode) }
  consumedModeScrollIntentVersion(mode: SubscriptionMode): number { return this.homeScrollIntent.consumedVersion(mode) }
  setConsumedModeScrollIntentVersion(mode: SubscriptionMode, value: number): void { this.homeScrollIntent.setConsumedVersion(mode, value) }
  resetModeScrollIntent(mode: SubscriptionMode): void {
    this.homeScrollIntent.reset(mode)
    this.homePaginationCoordinator.resetModeScrollProgressLoadMoreValue(mode)
  }
  setHomeScrollInteracting(interacting: boolean, _mode: SubscriptionMode = this.mode): void { this.homeScrollIntent.setInteracting(interacting) }

  currentSearchEntries(): EntryCardModel[] {
    if (this.rootSettings.searchAllHomeCategories) {
      return this.featuredEntries
    }
    return this.filteredEntriesFor(this.mode)
  }
  hasHomeInlineSearchQuery(): boolean { return !!this.homeInlineSearchController.normalizedQuery() }
  getHomeInlineSearchFocusRequestToken(): number { return this.homeInlineSearchFocusRequestToken }
  setHomeInlineSearchFocusRequestToken(token: number): void { this.homeInlineSearchFocusRequestToken = token }
  getSearchInputController(): TextInputController { return this.searchInputController }
  logHomeInlineSearchFocusDebug(stage: string, message: string): void { this.homeInlineSearchController.logFocusDebug(stage, message) }
  closeHomeInlineSearch(clearQuery: boolean): void { this.homeInlineSearchController.close(clearQuery) }

  isHomeRootTab(): boolean { return this.rootTabCoordinator.isHomeRootTab() }
  homeScrollerForMode(mode: SubscriptionMode): Scroller { return this.scrollerRegistry.homeScrollerForMode(mode) }

  private handleSystemThemeChanged(): void { void this.homeRuntimeCoordinator.handleSystemThemeChanged() }
  applySystemBarStyle(theme: ThemePalette): Promise<void> { return this.homeRuntimeCoordinator.applySystemBarStyle(theme) }
  syncRequestedRootTab(): void { this.rootTabCoordinator.syncRequestedRootTab() }
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

  openEntry(entry: EntryCardModel): void { this.pageLifecycle.openEntry(entry) }
  currentRootTabId(): RootTabId { return this.rootTabCoordinator.currentRootTabId() }
  handleModeSwipe(event: GestureEvent): void { this.homeModeController.handleModeSwipe(event) }

  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    switch (mode) {
      case 'social': return this.entryGroups.social
      case 'pictures': return this.entryGroups.pictures
      case 'videos': return this.entryGroups.videos
      default: return this.entryGroups.articles
    }
  }

  presentTweetEntry(entry: EntryCardModel): TweetEntryPresentation { return this.tweetPresentationCache.get(entry) }
  resetTweetPresentationCache(): void { this.tweetPresentationCache.clear() }

  private markDeferredFeedsChangedReload(reason: string): void { this.homeRefreshCoordinator.markDeferredFeedsChangedReload(reason) }
  private scheduleDeferredFeedsChangedRetry(delayMs: number): void { this.homeRefreshCoordinator.scheduleDeferredFeedsChangedRetry(delayMs) }
  private scheduleFeedsChangedReload(reason: string): void { this.homeRefreshCoordinator.scheduleFeedsChangedReload(reason) }
  tryFlushDeferredFeedsChangedReload(source: string): boolean { return this.homeRefreshCoordinator.tryFlushDeferredFeedsChangedReload(source) }
  private handleFeedsChanged(): void { this.homeRefreshCoordinator.handleFeedsChanged() }
  private shouldRunFinalHomeReloadNow(): boolean { return this.homeRefreshCoordinator.shouldRunFinalHomeReloadNow() }
  private scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void { this.homeRefreshCoordinator.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt) }
  private scheduleHomeReloadAfterRefresh(): void { this.homeRefreshCoordinator.scheduleHomeReloadAfterRefresh() }

  resolveHomeCandidateLimit(minimumLimit: number): number { return this.homePaginationCoordinator.resolveHomeCandidateLimit(minimumLimit) }
  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean { return this.homePaginationCoordinator.shouldRenderAllEntriesForMode(_mode) }
  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void { this.homePaginationCoordinator.setCandidateLimitForMode(mode, limit) }
  resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number { return this.homePaginationCoordinator.resolveHomeCandidateLimitForMode(mode, minimumLimit) }
  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void { this.homePaginationCoordinator.markModeLoaded(mode, loaded) }
  isModeLoaded(mode: SubscriptionMode): boolean { return this.homePaginationCoordinator.isModeLoaded(mode) }
  isModeLoading(mode: SubscriptionMode): boolean { return this.homePaginationCoordinator.isModeLoading(mode) }
  setModeLoading(mode: SubscriptionMode, loading: boolean): void { this.homePaginationCoordinator.setModeLoading(mode, loading) }
  totalEntryCountFor(mode: SubscriptionMode): number { return this.homePaginationCoordinator.totalEntryCountFor(mode) }
  private hasBufferedEntriesForMode(mode: SubscriptionMode): boolean { return this.homePaginationCoordinator.hasBufferedEntriesForMode(mode) }
  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] { return this.homePaginationCoordinator.visibleEntriesFor(mode) }
  private visibleEntryCountFor(mode: SubscriptionMode): number { return this.homePaginationCoordinator.visibleEntryCountFor(mode) }
  syncModePaginationFromReloadResult(mode: SubscriptionMode, entries: EntryCardModel[], candidateLimit: number): void { this.homePaginationCoordinator.syncModePaginationFromReloadResult(mode, entries, candidateLimit) }
  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void { this.homePaginationCoordinator.setModeHasMoreEntries(mode, next, reason) }
  resetModeLoadMoreStates(reason: string): void { this.homePaginationCoordinator.resetModeLoadMoreStates(reason) }
  hasRecentHomeScrollIntent(): boolean { return this.homePaginationCoordinator.hasRecentHomeScrollIntent() }
  invalidateHomeLoadMorePrefetch(): void { this.homePaginationCoordinator.invalidateHomeLoadMorePrefetch() }
  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void { this.homePaginationCoordinator.scheduleHomeLoadMorePrefetch(delayMs) }
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean { return this.homePaginationCoordinator.pendingLoadMoreForMode(mode) }
  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void { this.homePaginationCoordinator.maybeTriggerLoadMoreByScrollProgress(mode, currentOffset) }
  flushPendingLoadMoreForMode(mode: SubscriptionMode): void { this.homePaginationCoordinator.flushPendingLoadMoreForMode(mode) }
  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void { this.homePaginationCoordinator.handleHomeEntryAppear(mode, index, totalCount) }

  mergeFeaturedEntriesFromGroups(): EntryCardModel[] { return this.homeEntryDataManager.mergeFeaturedEntriesFromGroups() }
  applyEntriesForMode(mode: SubscriptionMode, entries: EntryCardModel[], deferredPersist: boolean, skipNotify: boolean = false, skipMerge: boolean = false): void { this.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge) }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void { this.homePaginationCoordinator.ensureModeEntriesLoaded(mode) }
  precacheNonActiveModes(): void { this.homeReloadCoordinator.precacheNonActiveModes() }
  async reloadFeaturedEntriesFromLocal(candidateLimit?: number, animated?: boolean, deferredGrouping?: boolean, preferFastPath?: boolean, targetMode?: SubscriptionMode): Promise<void> { await this.homeReloadCoordinator.reloadFeaturedEntriesFromLocal(candidateLimit, animated, deferredGrouping, preferFastPath, targetMode) }
  async reloadHomeEntriesFromLocal(candidateLimit?: number, animated?: boolean, deferredGrouping?: boolean, preferFastPath?: boolean): Promise<void> { await this.homeReloadCoordinator.reloadHomeEntriesFromLocal(candidateLimit, animated, deferredGrouping, preferFastPath) }
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void { this.homeEntryDataManager.schedulePersistSnapshot(entries) }
  persistHomeSnapshotNow(): void { this.homeEntryDataManager.persistSnapshotNow() }
  applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void { this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping) }
  modeListSwapTranslateY(mode: SubscriptionMode): number { return this.modeScenePresenter.modeListSwapTranslateY(mode) }
  notifyHomeEntryDataReloaded(): void { this.homeEntryDataManager.notifyAllReloaded() }
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void { this.homeEntryDataManager.notifyModeReloaded(mode) }
  pictureGalleryUrls(entry: EntryCardModel): string[] { return pictureGalleryUrls(entry) }
  pictureCaption(entry: EntryCardModel): string { return pictureCaption(entry) }
  pictureCardEntry(entry: EntryCardModel): Entry { return pictureCardEntry(entry) }
  modeSceneVisible(mode: SubscriptionMode): Visibility { return this.modeScenePresenter.modeSceneVisible(mode) }
  modeSceneOpacity(mode: SubscriptionMode): number { return this.modeScenePresenter.modeSceneOpacity(mode) }
  modeSceneOffset(mode: SubscriptionMode): number { return this.modeScenePresenter.modeSceneOffset(mode) }
  modeSceneZIndex(mode: SubscriptionMode): number { return this.modeScenePresenter.modeSceneZIndex(mode) }
  clearAutoRefreshTimer(): void { this.homeRuntimeCoordinator.clearAutoRefreshTimer() }
  configureAutoRefreshTimer(): void { this.homeRuntimeCoordinator.configureAutoRefreshTimer() }

  private requestExpandedModeRail(): void {
    this.homeInlineSearchController.close()
    this.homeRailCoordinator.requestExpandedModeRail()
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
        homeListSwapAnimating: this.homeListSwapAnimating,
        homeListSwapMode: this.homeListSwapMode,
        homeListSwapOpacity: this.homeListSwapOpacity,
        hideBottomTabs: this.rootTabCoordinator.shouldHideBottomTabs(),
        hideTitleBar: this.rootTabCoordinator.shouldHideRootTitleBar(),
        isHomeRootTab: this.rootTabCoordinator.isHomeRootTab(),
        isSettingsRootTab: this.rootTabCoordinator.isSettingsRootTab(),
        currentRootTitle: this.rootTabCoordinator.currentRootTitle(),
        scrollEffectType: rootScrollEffectType(),
        blurEffectiveEndOffset: rootBlurEffectiveEndOffset(),
        originalTitleBarBackgroundColor: rootTransparentBackgroundColor(),
        scrollEffectBackgroundColor: rootTransparentBackgroundColor(),
        originalTitleBarBlurRadius: rootOriginalTitleBarBlurRadius(),
        scrollEffectTitleBarBlurRadius: rootScrollEffectTitleBarBlurRadius(),
        originalTitleBarMaskExtraHeight: rootTitleBarMaskExtraHeight(),
        scrollEffectTitleBarMaskExtraHeight: rootTitleBarMaskExtraHeight(),
        blurStrategy: rootBlurStrategy(),
        systemMaterialEffect: rootSystemMaterialEffect(),
        bindScrollers: this.scrollerRegistry.currentRootBindScrollers(),
        homeCallbacks: createIndexHomeRootContentCallbacks(this),
        rootTabSymbolPair: (tabId: HdsBottomTabId): RootTabSymbolPair => this.rootTabCoordinator.rootTabSymbolPair(tabId),
        onRootTabChange: (index: number) => this.rootTabCoordinator.handleRootTabChange(index),
        onTabAppear: (tabId: RootTabId) => this.rootTabCoordinator.confirmRootTabSelection(tabId),
        onSettingsContentScrollerReady: (scroller: Scroller) => this.scrollerRegistry.handleSettingsContentScrollerReady(scroller),
        onSettingsChange: (settings: HarmonySettings) => this.pageLifecycle.handleRootSettingsChange(settings),
        onThemeChange: (theme: ThemePalette) => this.pageLifecycle.handleRootThemeChange(theme),
      })

      IndexHomeOverlayLayer({
        isHomeRootTab: this.rootTabCoordinator.isHomeRootTab(),
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
        collapsedModeRailTopPadding: this.homeRailCoordinator.homeCollapsedModeRailTopPadding(),
        collapseProgress: this.homeRailCoordinator.homeModeRailCollapseProgress(),
        modeRailTopPadding: this.homeRailCoordinator.homeModeRailTopPadding(),
        modeRailLeftPadding: this.homeRailCoordinator.homeModeRailLeftPadding(),
        modeRailRightInset: this.homeRailCoordinator.homeModeRailRightInset(),
        modeRailDismissTranslateY: this.homeRailCoordinator.homeModeRailDismissTranslateY(),
        modeRailDismissOpacity: this.homeRailCoordinator.homeModeRailDismissOpacity(),
        modeRailDismissScale: this.homeRailCoordinator.homeModeRailDismissScale(),
        modeRailCollapsed: this.homeRailCoordinator.isHomeModeRailCollapsed(),
        horizontalPadding: PAGE_HORIZONTAL_PADDING,
        searchFieldOffsetY: this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
        searchResultEntries: this.homeInlineSearchController.searchResultEntries(),
        searchShowEmptyState: this.homeInlineSearchController.hasSearchResultEmptyState(),
        inputController: this.searchInputController,
        onRefresh: () => { void this.refreshFeaturedEntries() },
        onSearchOpen: () => this.homeInlineSearchController.open(),
        onExpandRequest: () => this.requestExpandedModeRail(),
        onModeChange: (mode: SubscriptionMode) => this.homeModeController.requestModeSwitch(mode),
        onQueryChange: (value: string) => { this.searchQuery = value },
        onSearchClose: (clearQuery: boolean) => this.homeInlineSearchController.close(clearQuery),
        onEntryClick: (entry: EntryCardModel) => {
          this.openEntry(entry)
          this.homeInlineSearchController.close(true)
        },
        onSearchInputAppear: () => this.homeInlineSearchController.focus(),
        summaryTextForEntry: (entry: EntryCardModel): string => this.homeInlineSearchController.searchResultSummaryText(entry),
      })
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
