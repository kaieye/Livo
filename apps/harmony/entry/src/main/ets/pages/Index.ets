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
import { SettingsStore } from '../common/services/SettingsStore'
import { HomeEntrySnapshotStore } from '../common/services/HomeEntrySnapshotStore'
import { FeedRepository } from '../common/repositories/FeedRepository'
import { FeaturedEntriesQuery } from '../common/data/FeaturedEntriesQuery'
import { showToast } from '../common/utils/PageToastHelper'
import { createEmptyHomeEntryGroups, groupHomeEntriesByMode, HomeEntryGroups } from '../common/utils/home/HomeEntryGroups'
import { HomeEntryDataManager } from '../common/utils/home/HomeEntryDataManager'
import { HomeInlineSearchController } from '../common/utils/home/HomeInlineSearchController'
import { HomeModeController } from '../common/utils/home/HomeModeController'
import { HomeFeedRefresh } from '../common/utils/home/HomeFeedRefresh'
import { HomeFeedPagination } from '../common/utils/home/HomeFeedPagination'
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
import { IndexHomeRailCoordinator } from '../common/utils/index-home/IndexHomeRailCoordinator'
import { IndexHomeRuntimeCoordinator } from '../common/utils/index-home/IndexHomeRuntimeCoordinator'
import { IndexHomeDiagnosticsLogger } from '../common/utils/index-home/IndexHomeDiagnosticsLogger'
import { IndexHomeModeScenePresenter } from '../common/utils/index-home/IndexHomeModeScenePresenter'
import { IndexHomeScrollerRegistry } from '../common/utils/index-home/IndexHomeScrollerRegistry'
import { IndexHomeLoadStateGate } from '../common/utils/index-home/IndexHomeLoadStateGate'
import { IndexPageLifecycleController } from '../common/utils/index-home/IndexPageLifecycleController'
import { IndexRootTabCoordinator } from '../common/utils/index-home/IndexRootTabCoordinator'
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
  @State headerBlurProgress: number = 0
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
  readonly diagnosticsLogger: IndexHomeDiagnosticsLogger = new IndexHomeDiagnosticsLogger(this)
  readonly loadStateGate: IndexHomeLoadStateGate = new IndexHomeLoadStateGate(this)
  readonly modeScenePresenter: IndexHomeModeScenePresenter = new IndexHomeModeScenePresenter(this)
  readonly homeRailCoordinator: IndexHomeRailCoordinator = new IndexHomeRailCoordinator(this)
  readonly rootTabCoordinator: IndexRootTabCoordinator = new IndexRootTabCoordinator(this)
  readonly homeModeController: HomeModeController = new HomeModeController(this, this)
  readonly homeEntryDataManager: HomeEntryDataManager = new HomeEntryDataManager(this, this)
  readonly homeInlineSearchController: HomeInlineSearchController = new HomeInlineSearchController(this, this)
  readonly homeRuntimeCoordinator: IndexHomeRuntimeCoordinator = new IndexHomeRuntimeCoordinator(this)
  readonly pageLifecycle: IndexPageLifecycleController = new IndexPageLifecycleController(this)
  // HomeFeedRefresh / HomeFeedPagination are wired directly instead of through a
  // pass-through HomeFeedSession mediator. Index satisfies the HomeFeedSessionOwner
  // contract structurally — all state and methods the coordinators need live here.
  readonly homeFeedRefresh: HomeFeedRefresh = new HomeFeedRefresh(this)
  readonly homeFeedPagination: HomeFeedPagination = new HomeFeedPagination(this)

  aboutToAppear(): void { this.homeRuntimeCoordinator.aboutToAppear() }
  aboutToDisappear(): void { this.homeRuntimeCoordinator.aboutToDisappear() }
  onPageShow(): void { this.pageLifecycle.onPageShow() }
  onBackPress(): boolean { return this.pageLifecycle.onBackPress() }

  // --- Infra (delegated to runtime coordinator — single source for managed timeouts & timers) ---
  runManagedTimeout(callback: () => void, delayMs: number): void { this.homeRuntimeCoordinator.runManagedTimeout(callback, delayMs) }

  describeError(error: Error | string | Object): string { return this.diagnosticsLogger.describeError(error) }
  logHomeAsyncError(stage: string, error: Error | string | Object): void { this.diagnosticsLogger.logHomeAsyncError(stage, error) }
  logHomeLoadMore(message: string): void { this.diagnosticsLogger.logHomeLoadMore(message) }
  logHomePerf(message: string): void { this.diagnosticsLogger.logHomePerf(message) }
  logHomeLoadState(message: string): void { this.diagnosticsLogger.logHomeLoadState(message) }
  logHomeGroupStats(stage: string, entries: EntryCardModel[]): void { this.diagnosticsLogger.logHomeGroupStats(stage, entries) }
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

  // === Bootstrap ===
  async loadInitialData(): Promise<void> { await this.bootstrapHomeFeed() }
  resumeLoadedHome(): void { this.resumeHomeFeed() }
  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> { await this.homeFeedRefresh.startStartupRefreshIfNeeded(snapshotRestored) }
  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> { await this.homeFeedRefresh.refreshFeaturedEntries(showResultToast) }
  clearRefreshPercentAnimation(): void { this.homeFeedRefresh.clearRefreshPercentAnimation() }

  private static readonly ACTIVE_MODE_PREFETCH_DELAY_MS: number = 80

  private async bootstrapHomeFeed(): Promise<void> {
    const startedAt = Date.now()
    this.logHomePerf('loadInitialData start')
    this.homeFeedPagination.resetModeLoadMoreStates('load-initial')
    this.homeInitialLoadPending = true
    this.theme = ThemeService.currentPalette()
    void this.homeRuntimeCoordinator.applySystemBarStyle(this.theme)
    const settingsPromise = SettingsStore.load()
    const feedsPromise = FeedRepository.list()
    const currentMode = this.mode
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
    this.initialFeedCount = feeds.length
    this.rootSettings = settings
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.theme = await ThemeService.resolvePalette(settings)
    void this.homeRuntimeCoordinator.applySystemBarStyle(this.theme)
    void this.homeFeedRefresh.startStartupRefreshIfNeeded(restoredFromSnapshot)
    this.homeRuntimeCoordinator.configureAutoRefreshTimer()
    this.hasLoadedInitialData = true
    this.homeFeedPagination.ensureModeEntriesLoaded(currentMode)
    this.precacheNonActiveModes()
    this.primeActiveModeLoadMorePrefetch('bootstrap')
    this.logHomePerf(`loadInitialData done elapsedMs=${Date.now() - startedAt} featured=${this.featuredEntries.length}`)
  }

  private resumeHomeFeed(): void {
    this.homeRuntimeCoordinator.configureAutoRefreshTimer()
    this.homeFeedRefresh.tryFlushDeferredFeedsChangedReload('about-to-appear')
    if (this.featuredEntries.length === 0) {
      void this.reloadFeaturedEntriesFromLocal(
        this.homeFeedPagination.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
        false,
        true,
        true,
      )
    }
  }

  private restoreSnapshot(snapshotEntries: EntryCardModel[]): void {
    const groupedSnapshot = groupHomeEntriesByMode(snapshotEntries)
    const restoredArticles = groupedSnapshot.articles.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredSocial = groupedSnapshot.social.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredPictures = groupedSnapshot.pictures.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredVideos = groupedSnapshot.videos.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    this.entryGroups = {
      articles: [...restoredArticles],
      social: [...restoredSocial],
      pictures: [...restoredPictures],
      videos: [...restoredVideos],
    }
    this.featuredEntries = this.mergeFeaturedEntriesFromGroups()
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
    this.schedulePersistHomeSnapshot(this.featuredEntries)
    this.feedSourceLabel = '已恢复本地内容'
    if (this.mode === 'articles') {
      this.primeActiveModeLoadMorePrefetch('restore-snapshot')
    }
  }

  private async loadFastLocalEntries(): Promise<void> {
    this.featuredEntries = await FeaturedEntriesQuery.featuredEntriesFast(HOME_INITIAL_CANDIDATE_LIMIT)
    if (this.featuredEntries.length === 0) {
      this.featuredEntries = await FeaturedEntriesQuery.featuredEntries()
    }
    this.entryGroups = groupHomeEntriesByMode(this.featuredEntries)
    this.feedSourceLabel = '本地内容已加载'
    this.bumpHomeContentVersion()
    this.precacheNonActiveModes()
    if (this.mode === 'articles') {
      this.primeActiveModeLoadMorePrefetch('fast-local-load')
    }
  }

  // === Reload ===
  async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = false,
    targetMode: SubscriptionMode = this.mode,
  ): Promise<void> {
    const startedAt = Date.now()
    const safeCandidateLimit = this.homeFeedPagination.resolveHomeCandidateLimitForMode(targetMode, candidateLimit)
    const initialVisibleLimit = resolveHomeVisibleEntryInitialLimit(targetMode)
    const shouldUseFastPath = preferFastPath
      && !this.homeFeedPagination.shouldRenderAllEntriesForMode(targetMode)
      && (targetMode !== 'pictures' || safeCandidateLimit < initialVisibleLimit)
    this.logHomePerf(`reload start mode=${targetMode} limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${shouldUseFastPath}`)
    const nextEntries = shouldUseFastPath
      ? await FeaturedEntriesQuery.featuredEntriesFastByMode(targetMode, safeCandidateLimit)
      : await FeaturedEntriesQuery.featuredEntriesByMode(targetMode, safeCandidateLimit)
    this.homeFeedPagination.syncModePaginationFromReloadResult(targetMode, nextEntries, safeCandidateLimit)
    this.logHomeGroupStats(`reloadFeaturedEntriesFromLocal mode=${targetMode} limit=${safeCandidateLimit} animated=${animated}`, nextEntries)
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.mode)
      return
    }
    this.applyEntriesForMode(targetMode, nextEntries, deferredGrouping)
    if (targetMode === this.mode) {
      this.primeActiveModeLoadMorePrefetch(`reload-featured mode=${targetMode}`)
    }
    this.logHomePerf(`reload done mode=${targetMode} limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`)
  }

  async reloadHomeEntriesFromLocal(
    candidateLimit: number = HOME_MAX_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = true,
  ): Promise<void> {
    if (this.homeFeedPagination.shouldRenderAllEntriesForMode(this.mode)) {
      await this.reloadFeaturedEntriesFromLocal(
        this.homeFeedPagination.resolveHomeCandidateLimitForMode(this.mode, candidateLimit),
        animated,
        deferredGrouping,
        false,
        this.mode,
      )
      return
    }
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(HOME_INITIAL_CANDIDATE_LIMIT, candidateLimit)
    this.logHomePerf(`reload-home start limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${preferFastPath}`)
    const nextEntries = preferFastPath
      ? await FeaturedEntriesQuery.featuredEntriesFast(safeCandidateLimit)
      : await FeaturedEntriesQuery.featuredEntries(safeCandidateLimit)
    this.logHomeGroupStats(`reloadHomeEntriesFromLocal limit=${safeCandidateLimit} animated=${animated}`, nextEntries)
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.mode)
      return
    }
    this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping)
    this.primeActiveModeLoadMorePrefetch('reload-home')
    this.logHomePerf(`reload-home done limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`)
  }

  precacheNonActiveModes(): void {
    const currentMode = this.mode
    const modes: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
    const token = this.precacheModeToken + 1
    this.precacheModeToken = token
    for (let index = 0; index < modes.length; index += 1) {
      const mode = modes[index]
      if (mode === currentMode) { continue }
      if (this.homeFeedPagination.isModeLoaded(mode) || this.homeFeedPagination.isModeLoading(mode)) { continue }
      this.runManagedTimeout(() => {
        if (this.precacheModeToken !== token || mode === this.mode) { return }
        if (this.homeFeedPagination.isModeLoaded(mode) || this.homeFeedPagination.isModeLoading(mode)) { return }
        this.homeFeedPagination.setModeLoading(mode, true)
        const precacheLimit = resolveHomeVisibleEntryInitialLimit(mode)
        void FeaturedEntriesQuery.featuredEntriesFastByMode(mode, precacheLimit)
          .then((entries: EntryCardModel[]) => {
            if (this.precacheModeToken !== token || mode === this.mode) { return }
            this.applyEntriesForMode(mode, entries, true, true, true)
          })
          .catch((error: Error | string | Object) => {
            this.logHomeAsyncError(`precache-mode mode=${mode}`, error)
          })
          .finally(() => {
            this.homeFeedPagination.setModeLoading(mode, false)
          })
      }, 180 * (index + 1))
    }
  }

  private playHomeListSwapTransition(nextEntries: EntryCardModel[], mode: SubscriptionMode): void {
    this.homeListSwapMode = mode
    this.homeListSwapToken += 1
    this.homeEntryDataManager.playListSwapTransition(
      nextEntries,
      mode,
      this.homeListSwapToken,
      HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
      HOME_LIST_SWAP_ENTRY_OFFSET_Y,
      HOME_LIST_SWAP_ENTER_DURATION,
      HOME_LIST_SWAP_ANIMATION_ENABLED,
    )
  }

  private primeActiveModeLoadMorePrefetch(
    reason: string,
    delayMs: number = Index.ACTIVE_MODE_PREFETCH_DELAY_MS,
  ): void {
    this.logHomeLoadMore(`prefetch-prime mode=${this.mode} reason=${reason} delayMs=${delayMs}`)
    this.homeFeedPagination.scheduleHomeLoadMorePrefetch(delayMs)
  }

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

  settleInitialHomeLoadState(force: boolean = false): void { this.loadStateGate.settleInitialHomeLoadState(force) }
  homeEmptyStateTitle(): string { return this.loadStateGate.homeEmptyStateTitle() }
  updateHeaderBlurProgress(offset: number): void { this.loadStateGate.updateHeaderBlurProgress(offset) }

  readHomeModeScrollOffset(mode: SubscriptionMode): number { return this.homeRailCoordinator.readHomeModeScrollOffset(mode) }
  syncHomeModeRailState(mode: SubscriptionMode = this.mode): void { this.homeRailCoordinator.syncHomeModeRailState(mode) }
  primeHomeModeRailForRootActivation(): void { this.homeRailCoordinator.primeHomeModeRailForRootActivation() }

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
    this.homeFeedPagination.resetModeScrollProgressLoadMoreValue(mode)
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
  hasHomeInlineSearchQuery(): boolean { return !!this.homeInlineSearchController.normalizedQuery() }
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
  scrollRootTabToTop(tabId: RootTabId): void {
    if (tabId === 'home') {
      scrollScrollerToTop(this.homeScrollerForMode(this.mode), '首页')
      this.updateHeaderBlurProgress(0)
      this.syncHomeModeRailState(this.mode)
      return
    }

    emitRootTabScrollToTop(tabId)
  }
  handleModeSwipe(event: GestureEvent): void { this.homeModeController.handleModeSwipe(event) }

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
  private markDeferredFeedsChangedReload(reason: string): void { this.homeFeedRefresh.markDeferredFeedsChangedReload(reason) }
  private scheduleDeferredFeedsChangedRetry(delayMs: number): void { this.homeFeedRefresh.scheduleDeferredFeedsChangedRetry(delayMs) }
  private scheduleFeedsChangedReload(reason: string): void { this.homeFeedRefresh.scheduleFeedsChangedReload(reason) }
  tryFlushDeferredFeedsChangedReload(source: string): boolean { return this.homeFeedRefresh.tryFlushDeferredFeedsChangedReload(source) }
  private handleFeedsChanged(): void { this.homeFeedRefresh.handleFeedsChanged() }
  private shouldRunFinalHomeReloadNow(): boolean { return this.homeFeedRefresh.shouldRunFinalHomeReloadNow() }
  private scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void { this.homeFeedRefresh.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt) }
  private scheduleHomeReloadAfterRefresh(): void { this.homeFeedRefresh.scheduleHomeReloadAfterRefresh() }

  // === Pagination delegation ===
  resolveHomeCandidateLimit(minimumLimit: number): number { return this.homeFeedPagination.resolveHomeCandidateLimit(minimumLimit) }
  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean { return this.homeFeedPagination.shouldRenderAllEntriesForMode(_mode) }
  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void { this.homeFeedPagination.setCandidateLimitForMode(mode, limit) }
  resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number { return this.homeFeedPagination.resolveHomeCandidateLimitForMode(mode, minimumLimit) }
  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void { this.homeFeedPagination.markModeLoaded(mode, loaded) }
  isModeLoaded(mode: SubscriptionMode): boolean { return this.homeFeedPagination.isModeLoaded(mode) }
  isModeLoading(mode: SubscriptionMode): boolean { return this.homeFeedPagination.isModeLoading(mode) }
  setModeLoading(mode: SubscriptionMode, loading: boolean): void { this.homeFeedPagination.setModeLoading(mode, loading) }
  totalEntryCountFor(mode: SubscriptionMode): number { return this.homeFeedPagination.totalEntryCountFor(mode) }
  private hasBufferedEntriesForMode(mode: SubscriptionMode): boolean { return this.homeFeedPagination.hasBufferedEntriesForMode(mode) }
  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] { return this.homeFeedPagination.visibleEntriesFor(mode) }
  private visibleEntryCountFor(mode: SubscriptionMode): number { return this.homeFeedPagination.visibleEntryCountFor(mode) }
  syncModePaginationFromReloadResult(mode: SubscriptionMode, entries: EntryCardModel[], candidateLimit: number): void { this.homeFeedPagination.syncModePaginationFromReloadResult(mode, entries, candidateLimit) }
  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void { this.homeFeedPagination.setModeHasMoreEntries(mode, next, reason) }
  resetModeLoadMoreStates(reason: string): void { this.homeFeedPagination.resetModeLoadMoreStates(reason) }
  hasRecentHomeScrollIntent(): boolean { return this.homeFeedPagination.hasRecentHomeScrollIntent() }
  invalidateHomeLoadMorePrefetch(): void { this.homeFeedPagination.invalidateHomeLoadMorePrefetch() }
  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void { this.homeFeedPagination.scheduleHomeLoadMorePrefetch(delayMs) }
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean { return this.homeFeedPagination.pendingLoadMoreForMode(mode) }
  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void { this.homeFeedPagination.maybeTriggerLoadMoreByScrollProgress(mode, currentOffset) }
  flushPendingLoadMoreForMode(mode: SubscriptionMode): void { this.homeFeedPagination.flushPendingLoadMoreForMode(mode) }
  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void { this.homeFeedPagination.handleHomeEntryAppear(mode, index, totalCount) }
  handleHomeListEndReach(mode: SubscriptionMode, totalCount: number): void {
    this.homeFeedPagination.handleHomeListEndReach(mode, totalCount)
  }

  // === Data management delegation ===
  mergeFeaturedEntriesFromGroups(): EntryCardModel[] { return this.homeEntryDataManager.mergeFeaturedEntriesFromGroups() }
  applyEntriesForMode(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    deferredPersist: boolean,
    skipNotify: boolean = false,
    skipMerge: boolean = false,
    skipPersist: boolean = false,
  ): void {
    this.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge, skipPersist)
  }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void { this.homeFeedPagination.ensureModeEntriesLoaded(mode) }
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void { this.homeEntryDataManager.schedulePersistSnapshot(entries) }
  persistHomeSnapshotNow(): void { this.homeEntryDataManager.persistSnapshotNow() }
  applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void { this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping) }
  modeListSwapTranslateY(mode: SubscriptionMode): number { return this.modeScenePresenter.modeListSwapTranslateY(mode) }
  notifyHomeEntryDataReloaded(): void { this.homeEntryDataManager.notifyAllReloaded() }
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void { this.homeEntryDataManager.notifyModeReloaded(mode) }
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
  modeSceneVisible(mode: SubscriptionMode): Visibility { return this.modeScenePresenter.getSceneProps(mode).visibility === 'visible' ? Visibility.Visible : Visibility.Hidden }
  modeSceneOpacity(mode: SubscriptionMode): number { return this.modeScenePresenter.getSceneProps(mode).opacity }
  modeSceneOffset(mode: SubscriptionMode): number { return this.modeScenePresenter.getSceneProps(mode).offset }
  modeSceneZIndex(mode: SubscriptionMode): number { return this.modeScenePresenter.getSceneProps(mode).zIndex }
  clearAutoRefreshTimer(): void { this.homeRuntimeCoordinator.clearAutoRefreshTimer() }
  configureAutoRefreshTimer(): void { this.homeRuntimeCoordinator.configureAutoRefreshTimer() }

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
        hideBottomTabs: this.rootTabCoordinator.shouldHideBottomTabs(),
        hideTitleBar: this.rootTabCoordinator.shouldHideRootTitleBar(),
        showHomeTitleActions: this.rootTabCoordinator.isHomeRootTab() && !this.showSearch,
        isHomeRootTab: this.rootTabCoordinator.isHomeRootTab(),
        currentRootTitle: this.rootTabCoordinator.currentRootTitle(),
        bindScrollers: this.scrollerRegistry.currentRootBindScrollers(),
        homeCallbacks: this.indexHomeRootContentCallbacks(),
        rootTabSymbolPair: (tabId: HdsBottomTabId): RootTabSymbolPair => this.rootTabCoordinator.rootTabSymbolPair(tabId),
        onRootTabChange: (index: number) => this.rootTabCoordinator.handleRootTabChange(index),
        onRootTabBarClick: (index: number) => this.rootTabCoordinator.handleRootTabBarClick(index),
        onTabAppear: (tabId: RootTabId) => this.rootTabCoordinator.confirmRootTabSelection(tabId),
        onSettingsContentScrollerReady: (scroller: Scroller) => this.scrollerRegistry.handleSettingsContentScrollerReady(scroller),
        onSettingsChange: (settings: HarmonySettings) => this.pageLifecycle.handleRootSettingsChange(settings),
        onThemeChange: (theme: ThemePalette) => this.pageLifecycle.handleRootThemeChange(theme),
        onHomeRefresh: () => this.handleHomeRefreshAction(),
        onHomeSearchOpen: () => this.homeInlineSearchController.open(),
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
        horizontalPadding: PAGE_HORIZONTAL_PADDING,
        searchFieldOffsetY: this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
        searchResultEntries: this.homeInlineSearchController.searchResultEntries(),
        searchShowEmptyState: this.homeInlineSearchController.hasSearchResultEmptyState(),
        inputController: this.searchInputController,
        modeRailDismissOffset: this.homeRailCoordinator.homeModeRailDismissTranslateY(),
        modeRailDismissOpacity: Math.max(0, 1 - this.homeModeRailDismissProgress),
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
