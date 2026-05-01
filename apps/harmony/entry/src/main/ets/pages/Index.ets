import { AppRepository } from '../common/data/AppRepository'
import { ArrayLazyDataSource } from '../common/data/ArrayLazyDataSource'
import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsTabsController,
  ScrollEffectType,
  SystemMaterialParams,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import window from '@ohos.window'
import { openArticleDetail, RootTabId } from '../common/navigation/AppRouter'
import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  EntryCardModel,
  HarmonySettings,
  articleDetailModelFromCard,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { createEmptyHomeEntryGroups, HomeEntryGroups } from '../common/utils/HomeEntryGroups'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
} from '../common/utils/HomeVisibleEntryPolicy'
import {
  cloneHomeSnapshotEntry,
  describeError,
  duplicateKeyCount,
  filterEntriesByMode,
  homeEntryListRenderKey,
  homeEntryRenderBaseKey,
  resolveEntryMode,
} from '../common/utils/HomeEntryUtils'
import { HomeEntryDataManager } from '../common/utils/HomeEntryDataManager'
import { HomeInlineSearchController } from '../common/utils/HomeInlineSearchController'
import { HomeModeController } from '../common/utils/HomeModeController'
import { presentTweetEntryFromCard, TweetEntryPresentation } from '../common/utils/TweetEntryPresentation'
import {
  PAGE_HORIZONTAL_PADDING,
} from '../common/ui/UiTokens'
import { IndexHomeOverlayLayer } from '../common/components/IndexHomeOverlayLayer'
import { IndexHomeRootContentCallbacks } from '../common/components/IndexHomeRootContent'
import { IndexRootNavigationShell } from '../common/components/IndexRootNavigationShell'
import {
  HdsBottomTabId,
} from '../common/utils/HdsBottomTabConfig'
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
import { shouldRefreshThemeOnSystemColorModeChange } from '../common/utils/ThemeRefresh'
import { resolveSystemBarStyle } from '../common/utils/SystemBarStyle'
import { resolveModeSceneRenderState } from '../common/utils/ModeSceneTransition'
import { IndexHomeBootstrapCoordinator } from '../common/utils/IndexHomeBootstrapCoordinator'
import { IndexHomeRefreshCoordinator } from '../common/utils/IndexHomeRefreshCoordinator'
import { IndexHomePaginationCoordinator } from '../common/utils/IndexHomePaginationCoordinator'
import { IndexHomeRailCoordinator } from '../common/utils/IndexHomeRailCoordinator'
import { IndexHomeRuntimeCoordinator } from '../common/utils/IndexHomeRuntimeCoordinator'
import { IndexRootTabCoordinator } from '../common/utils/IndexRootTabCoordinator'
import {
  IndexHomeEntryDataDelegate,
  IndexHomeInlineSearchDelegate,
  IndexHomeModeDelegate,
} from '../common/utils/IndexHomeDelegates'
import {
  createHomeCandidateLimitMap,
  createHomeLoadedMap,
  createHomeLoadingMap,
  createHomeModeBooleanMap,
  createHomeNoProgressCountMap,
  createHomeScrollOffsetMap,
  createHomeVisibleEntryLimitMap,
  homeModeNumberValue,
  pictureCaption,
  pictureCardEntry,
  pictureGalleryUrls,
  withHomeModeNumberValue,
} from '../common/utils/IndexHomeStateFactory'
import { createIndexHomeRootContentCallbacks } from '../common/utils/IndexHomeRootContentCallbacksFactory'
import {
  AUTO_REFRESH_MIN_INTERVAL_MINUTES,
  HEADER_BLUR_SCROLL_RANGE,
  HOME_ASYNC_ERROR_DEBUG_ENABLED,
  HOME_ASYNC_ERROR_PREFIX,
  HOME_ENTRY_GROUP_DEFER_DELAY_MS,
  HOME_GROUP_DEBUG_ENABLED,
  HOME_GROUP_DEBUG_PREFIX,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_LOAD_MORE_DEBUG_ENABLED,
  HOME_LOAD_MORE_DEBUG_PREFIX,
  HOME_LOAD_STATE_DIAG_ENABLED,
  HOME_LOAD_STATE_DIAG_PREFIX,
  HOME_MAX_CANDIDATE_LIMIT,
  HOME_MODE_CONTENT_GAP,
  HOME_MODE_DEBUG_ENABLED,
  HOME_MODE_DEBUG_PREFIX,
  HOME_MODE_INITIAL_CANDIDATE_LIMIT,
  HOME_MODE_SCENE_TRANSITION_DURATION,
  HOME_PERF_DIAG_ENABLED,
  HOME_PERF_DIAG_PREFIX,
  MODE_SWIPE_TRIGGER_OFFSET,
  SUBSCRIPTION_MODES,
  HomeEntryDataSourceMap,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeScrollOffsetMap,
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
  @State isHomeScrollInteracting: boolean = false
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
  private readonly articlesScroller: Scroller = new Scroller()
  private readonly socialScroller: Scroller = new Scroller()
  private readonly picturesScroller: Scroller = new Scroller()
  private readonly videosScroller: Scroller = new Scroller()
  private searchInputController: TextInputController = new TextInputController()
  readonly homeEntryDataSources: HomeEntryDataSourceMap = {
    articles: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.articles),
    social: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.social),
    pictures: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.pictures),
    videos: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.videos),
  }
  private settingsRootScroller?: Scroller
  private headerBlurOffset: number = 0
  refreshPercentAnimationTimer: number = -1
  pendingRefreshPercentTarget: number = 0
  private autoRefreshTimer: number = -1
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
  lastHomeUserScrollAt: number = 0
  private homeModeScrollIntentVersions: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private homeModeConsumedScrollIntentVersions: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap = createHomeNoProgressCountMap()
  homeModeLoaded: HomeModeLoadedMap = createHomeLoadedMap()
  homeModeLoading: HomeModeLoadingMap = createHomeLoadingMap()
  lastHomeLoadMoreCompletedAt: number = 0
  lastHomeRefreshFinishedAt: number = 0
  homePerfSessionId: number = 0
  homePerfSessionStartedAt: number = 0
  private readonly tweetPresentationCache: Map<string, TweetEntryPresentation> = new Map()
  private readonly homeRuntimeCoordinator: IndexHomeRuntimeCoordinator =
    new IndexHomeRuntimeCoordinator(this)
  private readonly homeBootstrapCoordinator: IndexHomeBootstrapCoordinator =
    new IndexHomeBootstrapCoordinator(this)
  private readonly homeModeController: HomeModeController = new HomeModeController(this.createHomeModeDelegate())
  private readonly homeEntryDataManager: HomeEntryDataManager = new HomeEntryDataManager(this.createHomeEntryDataDelegate())
  private readonly homeInlineSearchController: HomeInlineSearchController = new HomeInlineSearchController(
    this.createHomeInlineSearchDelegate(),
  )
  private readonly homeRefreshCoordinator: IndexHomeRefreshCoordinator = new IndexHomeRefreshCoordinator(this)
  private readonly homePaginationCoordinator: IndexHomePaginationCoordinator =
    new IndexHomePaginationCoordinator(this)
  private readonly homeRailCoordinator: IndexHomeRailCoordinator = new IndexHomeRailCoordinator(this)
  private readonly rootTabCoordinator: IndexRootTabCoordinator = new IndexRootTabCoordinator(this)

  private createHomeModeDelegate(): IndexHomeModeDelegate {
    return new IndexHomeModeDelegate(this)
  }

  private createHomeEntryDataDelegate(): IndexHomeEntryDataDelegate {
    return new IndexHomeEntryDataDelegate(this)
  }

  private createHomeInlineSearchDelegate(): IndexHomeInlineSearchDelegate {
    return new IndexHomeInlineSearchDelegate(this)
  }

  aboutToAppear(): void {
    this.homeRuntimeCoordinator.aboutToAppear()
  }

  aboutToDisappear(): void {
    this.homeRuntimeCoordinator.aboutToDisappear()
  }

  runManagedTimeout(callback: () => void, delayMs: number): void {
    this.homeRuntimeCoordinator.runManagedTimeout(callback, delayMs)
  }

  describeError(error: Error | string | Object): string {
    return describeError(error)
  }

  logHomeAsyncError(stage: string, error: Error | string | Object): void {
    if (!HOME_ASYNC_ERROR_DEBUG_ENABLED) {
      return
    }
    console.error(`${HOME_ASYNC_ERROR_PREFIX} stage=${stage} error=${this.describeError(error)}`)
  }

  async loadInitialData(): Promise<void> {
    await this.homeBootstrapCoordinator.loadInitialData()
  }

  resumeLoadedHome(): void {
    this.homeBootstrapCoordinator.resumeLoadedHome()
  }

  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> {
    await this.homeRefreshCoordinator.startStartupRefreshIfNeeded(snapshotRestored)
  }

  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {
    await this.homeRefreshCoordinator.refreshFeaturedEntries(showResultToast)
  }

  private resolveRefreshPercent(completedCount: number, totalCount: number): number {
    return this.homeRefreshCoordinator.resolveRefreshPercent(completedCount, totalCount)
  }

  clearRefreshPercentAnimation(): void {
    this.homeRefreshCoordinator.clearRefreshPercentAnimation()
  }

  private animateRefreshPercentTo(targetPercent: number): void {
    this.homeRefreshCoordinator.animateRefreshPercentTo(targetPercent)
  }

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

  private isHomeContentLoading(): boolean {
    if (this.featuredEntries.length > 0) {
      return false
    }
    return this.homeInitialLoadPending || this.isRefreshing || this.isHomeStartupRefreshing
  }

  settleInitialHomeLoadState(force: boolean = false): void {
    if (!this.homeInitialLoadPending) {
      return
    }

    if (this.isHomeStartupRefreshing) {
      return
    }

    if (this.featuredEntries.length > 0) {
      this.homeInitialLoadPending = false
      return
    }

    if (this.initialFeedCount === 0 && !this.isRefreshing) {
      this.homeInitialLoadPending = false
      return
    }

    if (force && !this.isRefreshing) {
      this.homeInitialLoadPending = false
    }
  }

  homeEmptyStateTitle(): string {
    return this.isHomeContentLoading()
      ? '正在加载订阅内容'
      : '未发现订阅推文，请先到发现页面添加或刷新订阅源'
  }

  private refreshRootTheme(): void {
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
  }

  updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.headerBlurOffset = clampedOffset
    this.headerBlurProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
  }

  readHomeModeScrollOffset(mode: SubscriptionMode): number {
    return this.homeRailCoordinator.readHomeModeScrollOffset(mode)
  }

  syncHomeModeRailState(mode: SubscriptionMode = this.mode): void {
    this.homeRailCoordinator.syncHomeModeRailState(mode)
  }

  primeHomeModeRailForRootActivation(): void {
    this.homeRailCoordinator.primeHomeModeRailForRootActivation()
  }

  private isUserDrivenHomeScrollSource(scrollSource: ScrollSource): boolean {
    return scrollSource === ScrollSource.DRAG
      || scrollSource === ScrollSource.FLING
      || scrollSource === ScrollSource.OTHER_USER_INPUT
      || scrollSource === ScrollSource.SCROLL_BAR
      || scrollSource === ScrollSource.SCROLL_BAR_FLING
  }

  markHomeUserScrollIntent(mode: SubscriptionMode, scrollSource: ScrollSource): void {
    if (mode !== this.mode || !this.isUserDrivenHomeScrollSource(scrollSource)) {
      return
    }
    this.lastHomeUserScrollAt = Date.now()
    if (scrollSource === ScrollSource.DRAG || scrollSource === ScrollSource.SCROLL_BAR) {
      if (!this.isHomeScrollInteracting) {
        this.bumpModeScrollIntentVersion(mode)
      }
      this.setHomeScrollInteracting(true, mode)
      return
    }
    if (scrollSource === ScrollSource.OTHER_USER_INPUT) {
      this.bumpModeScrollIntentVersion(mode)
    }
  }

  modeScrollIntentVersion(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeModeScrollIntentVersions)
  }

  consumedModeScrollIntentVersion(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeModeConsumedScrollIntentVersions)
  }

  private setModeScrollIntentVersion(mode: SubscriptionMode, value: number): void {
    this.homeModeScrollIntentVersions = withHomeModeNumberValue(mode, value, this.homeModeScrollIntentVersions)
  }

  setConsumedModeScrollIntentVersion(mode: SubscriptionMode, value: number): void {
    this.homeModeConsumedScrollIntentVersions =
      withHomeModeNumberValue(mode, value, this.homeModeConsumedScrollIntentVersions)
  }

  private bumpModeScrollIntentVersion(mode: SubscriptionMode): void {
    this.setModeScrollIntentVersion(mode, this.modeScrollIntentVersion(mode) + 1)
  }

  resetModeScrollIntent(mode: SubscriptionMode): void {
    this.lastHomeUserScrollAt = 0
    this.setModeScrollIntentVersion(mode, 0)
    this.setConsumedModeScrollIntentVersion(mode, 0)
    this.homePaginationCoordinator.resetModeScrollProgressLoadMoreValue(mode)
  }

  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode = this.mode): void {
    if (interacting) {
      this.lastHomeUserScrollAt = Date.now()
    }

    this.isHomeScrollInteracting = interacting
  }

  private currentRootTitle(): string {
    return this.rootTabCoordinator.currentRootTitle()
  }

  currentSearchEntries(): EntryCardModel[] {
    if (this.rootSettings.searchAllHomeCategories) {
      return this.featuredEntries
    }

    return this.filteredEntriesFor(this.mode)
  }

  hasHomeInlineSearchQuery(): boolean {
    return !!this.homeInlineSearchController.normalizedQuery()
  }

  getHomeInlineSearchFocusRequestToken(): number {
    return this.homeInlineSearchFocusRequestToken
  }

  setHomeInlineSearchFocusRequestToken(token: number): void {
    this.homeInlineSearchFocusRequestToken = token
  }

  getSearchInputController(): TextInputController {
    return this.searchInputController
  }

  logHomeInlineSearchFocusDebug(stage: string, message: string): void {
    this.homeInlineSearchController.logFocusDebug(stage, message)
  }

  closeHomeInlineSearch(clearQuery: boolean): void {
    this.homeInlineSearchController.close(clearQuery)
  }

  private homeInlineSearchVerticalOffset(): number {
    return this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL
  }

  isHomeRootTab(): boolean {
    return this.rootTabCoordinator.isHomeRootTab()
  }

  private shouldHideRootTitleBar(): boolean {
    return this.rootTabCoordinator.shouldHideRootTitleBar()
  }

  private currentRootScrollEffectType(): ScrollEffectType {
    return rootScrollEffectType()
  }

  private isSettingsRootTab(): boolean {
    return this.rootTabCoordinator.isSettingsRootTab()
  }

  private currentRootBlurEffectiveEndOffset(): LengthMetrics {
    return rootBlurEffectiveEndOffset()
  }

  private currentRootOriginalTitleBarBackgroundColor(): ResourceColor {
    return rootTransparentBackgroundColor()
  }

  private currentRootScrollEffectBackgroundColor(): ResourceColor {
    return rootTransparentBackgroundColor()
  }

  private currentRootOriginalTitleBarBlurRadius(): number {
    return rootOriginalTitleBarBlurRadius()
  }

  private currentRootScrollEffectTitleBarBlurRadius(): number {
    return rootScrollEffectTitleBarBlurRadius()
  }

  private currentRootOriginalTitleBarMaskExtraHeight(): number {
    return rootTitleBarMaskExtraHeight()
  }

  private currentRootScrollEffectTitleBarMaskExtraHeight(): number {
    return rootTitleBarMaskExtraHeight()
  }

  private currentRootBlurStrategy(): BlurStrategy | undefined {
    return rootBlurStrategy()
  }

  private currentRootSystemMaterialEffect(): SystemMaterialParams | undefined {
    return rootSystemMaterialEffect()
  }

  private currentRootBindScrollers(): Scroller[] {
    if (this.activeRootTabId === 'home') {
      return [
        this.articlesScroller,
        this.socialScroller,
        this.picturesScroller,
        this.videosScroller,
      ]
    }
    if (this.activeRootTabId === 'settings' && this.settingsRootScroller) {
      return [this.settingsRootScroller]
    }
    return []
  }

  homeScrollerForMode(mode: SubscriptionMode): Scroller {
    switch (mode) {
      case 'social':
        return this.socialScroller
      case 'pictures':
        return this.picturesScroller
      case 'videos':
        return this.videosScroller
      default:
        return this.articlesScroller
    }
  }

  private handleSettingsContentScrollerReady(scroller: Scroller): void {
    if (this.settingsRootScroller === scroller) {
      return
    }

    this.settingsRootScroller = scroller
    this.settingsScrollerBindingVersion += 1
  }

  private handleSystemThemeChanged(): void {
    void this.refreshThemeFromSystemChange()
  }

  private async refreshThemeFromSystemChange(): Promise<void> {
    const settings = await AppRepository.settings()
    if (!shouldRefreshThemeOnSystemColorModeChange(settings.themeMode)) {
      return
    }

    this.theme = await ThemeService.resolvePaletteForSystemChange(settings)
    void this.applySystemBarStyle(this.theme)
  }

  async applySystemBarStyle(theme: ThemePalette): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }

    try {
      const systemBarStyle = resolveSystemBarStyle(theme)
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: systemBarStyle.statusBarColor,
        navigationBarColor: systemBarStyle.navigationBarColor,
        isStatusBarLightIcon: systemBarStyle.isStatusBarLightIcon,
        statusBarContentColor: systemBarStyle.statusBarContentColor,
      })
    } catch (_) {
    }
  }

  syncRequestedRootTab(): void {
    this.rootTabCoordinator.syncRequestedRootTab()
  }

  isRootTabChangeSuppressed(): boolean {
    return this.suppressRootTabChange
  }

  syncRootTabsController(): void {
    try {
      this.suppressRootTabChange = true
      this.rootTabsController.changeIndex(this.rootTabIndex)
    } catch (_) {
    } finally {
      this.suppressRootTabChange = false
    }
  }

  openEntry(entry: EntryCardModel): void {
    this.runManagedTimeout(() => {
      this.markEntryReadLocally(entry)
    }, 120)

    if (entry.viewLabel === '图片' && (entry.rawMediaUrls ?? []).length > 0) {
      const model = articleDetailModelFromCard(entry)
      void openArticleDetail(entry.id, JSON.stringify(model))
      return
    }
    void openArticleDetail(entry.id)
  }

  private markEntryReadLocally(target: EntryCardModel): void {
    this.homeEntryDataManager.markEntryReadLocally(target)
  }

  private rootTabSymbolPair(tabId: HdsBottomTabId): RootTabSymbolPair {
    return this.rootTabCoordinator.rootTabSymbolPair(tabId)
  }

  private handleRootTabChange(index: number): void {
    this.rootTabCoordinator.handleRootTabChange(index)
  }

  private confirmRootTabSelection(tabId: RootTabId): void {
    this.rootTabCoordinator.confirmRootTabSelection(tabId)
  }

  currentRootTabId(): RootTabId {
    return this.rootTabCoordinator.currentRootTabId()
  }

  private modeIndex(mode: SubscriptionMode): number {
    return this.homeModeController.modeIndex(mode)
  }

  private requestModeSwitch(nextMode: SubscriptionMode): void {
    this.homeModeController.requestModeSwitch(nextMode)
  }

  private logModeSwitchSnapshot(stage: string, mode: SubscriptionMode): void {
    this.homeModeController.logModeSwitchSnapshot(stage, mode)
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    this.homeModeController.startModeTransition(nextMode)
  }

  private adjacentMode(offsetX: number): SubscriptionMode | undefined {
    return this.homeModeController.adjacentMode(offsetX)
  }

  handleModeSwipe(event: GestureEvent): void {
    this.homeModeController.handleModeSwipe(event)
  }

  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    switch (mode) {
      case 'social':
        return this.entryGroups.social
      case 'pictures':
        return this.entryGroups.pictures
      case 'videos':
        return this.entryGroups.videos
      default:
        return this.entryGroups.articles
    }
  }

  private tweetPresentationCacheKey(entry: EntryCardModel): string {
    const mediaUrls = (entry.mediaUrls ?? []).join('|')
    return [
      entry.id,
      entry.title,
      entry.summary,
      entry.content,
      entry.author,
      entry.articleUrl,
      entry.imageUrl,
      entry.feedImageUrl,
      entry.publishedAt,
      entry.publishedLabel,
      mediaUrls,
    ].join('|')
  }

  presentTweetEntry(entry: EntryCardModel): TweetEntryPresentation {
    const cacheKey = this.tweetPresentationCacheKey(entry)
    const cached = this.tweetPresentationCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const base = presentTweetEntryFromCard(entry)
    const presentation: TweetEntryPresentation = {
      kind: base.kind,
      retweetStyle: base.retweetStyle,
      displayName: base.displayName,
      username: '',
      avatarUrl: base.avatarUrl,
      text: base.text,
      mediaUrls: base.mediaUrls,
      publishedLabel: base.publishedLabel,
      articleUrl: base.articleUrl,
      replyCount: base.replyCount,
      repostCount: base.repostCount,
      likeCount: base.likeCount,
      viewCount: base.viewCount,
      retweetByLabel: base.retweetByLabel,
      quotedTweet: base.quotedTweet,
    }
    this.tweetPresentationCache.set(cacheKey, presentation)
    return presentation
  }

  resetTweetPresentationCache(): void {
    if (this.tweetPresentationCache.size === 0) {
      return
    }
    this.tweetPresentationCache.clear()
  }

  private markDeferredFeedsChangedReload(reason: string): void {
    this.homeRefreshCoordinator.markDeferredFeedsChangedReload(reason)
  }

  private scheduleDeferredFeedsChangedRetry(delayMs: number): void {
    this.homeRefreshCoordinator.scheduleDeferredFeedsChangedRetry(delayMs)
  }

  private scheduleFeedsChangedReload(reason: string): void {
    this.homeRefreshCoordinator.scheduleFeedsChangedReload(reason)
  }

  tryFlushDeferredFeedsChangedReload(source: string): boolean {
    return this.homeRefreshCoordinator.tryFlushDeferredFeedsChangedReload(source)
  }

  private handleFeedsChanged(): void {
    this.homeRefreshCoordinator.handleFeedsChanged()
  }

  private shouldRunFinalHomeReloadNow(): boolean {
    return this.homeRefreshCoordinator.shouldRunFinalHomeReloadNow()
  }

  private scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void {
    this.homeRefreshCoordinator.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt)
  }

  private scheduleHomeReloadAfterRefresh(): void {
    this.homeRefreshCoordinator.scheduleHomeReloadAfterRefresh()
  }

  resolveHomeCandidateLimit(minimumLimit: number): number {
    return this.homePaginationCoordinator.resolveHomeCandidateLimit(minimumLimit)
  }

  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.shouldRenderAllEntriesForMode(_mode)
  }

  private candidateLimitForMode(mode: SubscriptionMode): number {
    return this.homePaginationCoordinator.candidateLimitForMode(mode)
  }

  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void {
    this.homePaginationCoordinator.setCandidateLimitForMode(mode, limit)
  }

  private resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number {
    return this.homePaginationCoordinator.resolveHomeCandidateLimitForMode(mode, minimumLimit)
  }

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void {
    this.homePaginationCoordinator.markModeLoaded(mode, loaded)
  }

  private isModeLoaded(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.isModeLoaded(mode)
  }

  isModeLoading(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.isModeLoading(mode)
  }

  private setModeLoading(mode: SubscriptionMode, loading: boolean): void {
    this.homePaginationCoordinator.setModeLoading(mode, loading)
  }

  private visibleEntryLimitFor(mode: SubscriptionMode): number {
    return this.homePaginationCoordinator.visibleEntryLimitFor(mode)
  }

  private setVisibleEntryLimitFor(mode: SubscriptionMode, limit: number): void {
    this.homePaginationCoordinator.setVisibleEntryLimitFor(mode, limit)
  }

  totalEntryCountFor(mode: SubscriptionMode): number {
    return this.homePaginationCoordinator.totalEntryCountFor(mode)
  }

  private hasBufferedEntriesForMode(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.hasBufferedEntriesForMode(mode)
  }

  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    return this.homePaginationCoordinator.visibleEntriesFor(mode)
  }

  private visibleEntryCountFor(mode: SubscriptionMode): number {
    return this.homePaginationCoordinator.visibleEntryCountFor(mode)
  }

  private expandVisibleEntriesForMode(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.expandVisibleEntriesForMode(mode)
  }

  private syncHomePaginationFromReloadResult(entries: EntryCardModel[], candidateLimit: number): void {
    this.homePaginationCoordinator.syncHomePaginationFromReloadResult(entries, candidateLimit)
  }

  private syncModePaginationFromReloadResult(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    candidateLimit: number,
  ): void {
    this.homePaginationCoordinator.syncModePaginationFromReloadResult(mode, entries, candidateLimit)
  }

  private canLoadMoreForMode(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.canLoadMoreForMode(mode)
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
    const elapsed = this.homePerfSessionStartedAt > 0 ? Date.now() - this.homePerfSessionStartedAt : 0
    console.info(`${HOME_PERF_DIAG_PREFIX} sid=${this.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  logHomeLoadState(message: string): void {
    if (!HOME_LOAD_STATE_DIAG_ENABLED) {
      return
    }
    const elapsed = this.homePerfSessionStartedAt > 0 ? Date.now() - this.homePerfSessionStartedAt : 0
    console.info(`${HOME_LOAD_STATE_DIAG_PREFIX} sid=${this.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  private setHomeHasMoreEntries(next: boolean, reason: string): void {
    this.homePaginationCoordinator.setHomeHasMoreEntries(next, reason)
  }

  private modeHasMoreEntries(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.modeHasMoreEntries(mode)
  }

  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void {
    this.homePaginationCoordinator.setModeHasMoreEntries(mode, next, reason)
  }

  private modeNoProgressCount(mode: SubscriptionMode): number {
    return this.homePaginationCoordinator.modeNoProgressCount(mode)
  }

  private setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    this.homePaginationCoordinator.setModeNoProgressCount(mode, count)
  }

  resetModeLoadMoreStates(reason: string): void {
    this.homePaginationCoordinator.resetModeLoadMoreStates(reason)
  }

  private loadMoreBlockedReason(mode: SubscriptionMode): string {
    return this.homePaginationCoordinator.loadMoreBlockedReason(mode)
  }

  hasRecentHomeScrollIntent(): boolean {
    return this.homePaginationCoordinator.hasRecentHomeScrollIntent()
  }

  invalidateHomeLoadMorePrefetch(): void {
    this.homePaginationCoordinator.invalidateHomeLoadMorePrefetch()
  }

  private canPrefetchHomeLoadMore(): boolean {
    return this.homePaginationCoordinator.canPrefetchHomeLoadMore()
  }

  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void {
    this.homePaginationCoordinator.scheduleHomeLoadMorePrefetch(delayMs)
  }

  private async prefetchHomeLoadMore(): Promise<void> {
    await this.homePaginationCoordinator.prefetchHomeLoadMore()
  }

  private consumePrefetchedHomeEntries(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    return this.homePaginationCoordinator.consumePrefetchedHomeEntries(mode, nextLimit)
  }

  private shouldRetryLoadMoreBlockedReason(reason: string): boolean {
    return this.homePaginationCoordinator.shouldRetryLoadMoreBlockedReason(reason)
  }

  private requestLoadMoreForMode(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.requestLoadMoreForMode(mode)
  }

  private async appendFeaturedEntriesFromLocalFast(mode: SubscriptionMode, nextLimit: number): Promise<void> {
    await this.homePaginationCoordinator.appendFeaturedEntriesFromLocalFast(mode, nextLimit)
  }

  pendingLoadMoreForMode(mode: SubscriptionMode): boolean {
    return this.homePaginationCoordinator.pendingLoadMoreForMode(mode)
  }

  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void {
    this.homePaginationCoordinator.maybeTriggerLoadMoreByScrollProgress(mode, currentOffset)
  }

  flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
    this.homePaginationCoordinator.flushPendingLoadMoreForMode(mode)
  }

  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void {
    this.homePaginationCoordinator.handleHomeEntryAppear(mode, index, totalCount)
  }

  mergeFeaturedEntriesFromGroups(): EntryCardModel[] {
    return this.homeEntryDataManager.mergeFeaturedEntriesFromGroups()
  }

  applyEntriesForMode(mode: SubscriptionMode, entries: EntryCardModel[], deferredPersist: boolean, skipNotify: boolean = false, skipMerge: boolean = false): void {
    this.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge)
  }

  ensureModeEntriesLoaded(mode: SubscriptionMode): void {
    this.homePaginationCoordinator.ensureModeEntriesLoaded(mode)
  }

  precacheNonActiveModes(): void {
    const currentMode = this.mode
    const modes: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
    // Use smaller limit for precaching to reduce initial load overhead
    const precacheLimit = 20

    for (const mode of modes) {
      if (mode === currentMode) {
        continue
      }
      // Only precache if not already loaded and not currently loading
      if (!this.isModeLoaded(mode) && !this.isModeLoading(mode)) {
        this.setModeLoading(mode, true)
        void AppRepository.featuredEntriesFastByMode(mode, precacheLimit)
          .then((entries) => {
            this.applyEntriesForMode(mode, entries, true, true, true)
          })
          .catch((error: Error | string | Object) => {
            this.logHomeAsyncError(`precache-mode mode=${mode}`, error)
          })
          .finally(() => {
            this.setModeLoading(mode, false)
          })
      }
    }
  }

  async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = false,
    targetMode: SubscriptionMode = this.mode,
  ): Promise<void> {
    const startedAt = Date.now()
    const safeCandidateLimit = this.resolveHomeCandidateLimitForMode(targetMode, candidateLimit)
    const initialVisibleLimit = resolveHomeVisibleEntryInitialLimit(targetMode)
    const shouldUseFastPath = preferFastPath
      && !this.shouldRenderAllEntriesForMode(targetMode)
      && (targetMode !== 'pictures' || safeCandidateLimit < initialVisibleLimit)
    this.logHomePerf(
      `reload start mode=${targetMode} limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${shouldUseFastPath}`,
    )
    const nextEntries = shouldUseFastPath
      ? await AppRepository.featuredEntriesFastByMode(targetMode, safeCandidateLimit)
      : await AppRepository.featuredEntriesByMode(targetMode, safeCandidateLimit)
    this.syncModePaginationFromReloadResult(targetMode, nextEntries, safeCandidateLimit)
    this.logHomeGroupStats(
      `reloadFeaturedEntriesFromLocal mode=${targetMode} limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.mode)
      return
    }
    this.applyEntriesForMode(targetMode, nextEntries, deferredGrouping)
    this.logHomePerf(
      `reload done mode=${targetMode} limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`,
    )
  }

  async reloadHomeEntriesFromLocal(
    candidateLimit: number = HOME_MAX_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = true,
  ): Promise<void> {
    if (this.shouldRenderAllEntriesForMode(this.mode)) {
      await this.reloadFeaturedEntriesFromLocal(
        this.resolveHomeCandidateLimitForMode(this.mode, candidateLimit),
        animated,
        deferredGrouping,
        false,
        this.mode,
      )
      return
    }

    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(HOME_INITIAL_CANDIDATE_LIMIT, candidateLimit)
    this.logHomePerf(
      `reload-home start limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${preferFastPath}`,
    )
    const nextEntries = preferFastPath
      ? await AppRepository.featuredEntriesFast(safeCandidateLimit)
      : await AppRepository.featuredEntries(safeCandidateLimit)
    this.logHomeGroupStats(
      `reloadHomeEntriesFromLocal limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.mode)
      return
    }
    this.applyHomeEntries(nextEntries, deferredGrouping)
    this.logHomePerf(
      `reload-home done limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`,
    )
  }

  private cloneHomeSnapshotEntry(entry: EntryCardModel): EntryCardModel {
    return cloneHomeSnapshotEntry(entry)
  }

  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void {
    this.homeEntryDataManager.schedulePersistSnapshot(entries)
  }

  persistHomeSnapshotNow(): void {
    this.homeEntryDataManager.persistSnapshotNow()
  }

  private applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void {
    this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping)
  }

  private applyHomeEntriesForAnimatedMode(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
    token: number,
  ): void {
    this.homeEntryDataManager.applyHomeEntriesForAnimatedMode(nextEntries, mode, token)
  }

  private logHomeGroupStats(stage: string, entries: EntryCardModel[]): void {
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

      const renderBaseKey = this.homeEntryRenderBaseKey(entry)
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

    const duplicateIdCount = this.duplicateKeyCount(idCounter)
    const duplicateRenderBaseCount = this.duplicateKeyCount(renderBaseCounter)

    console.info(
      `${HOME_GROUP_DEBUG_PREFIX} ${stage} total=${entries.length} `
      + `articles=${articles} social=${social} pictures=${pictures} videos=${videos} `
      + `uniqueIds=${idCounter.size} dupIds=${duplicateIdCount} `
      + `uniqueRender=${renderBaseCounter.size} dupRender=${duplicateRenderBaseCount} `
      + `activeTab=${this.currentRootTabId()} mode=${this.mode}`,
    )
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

  private modeListSwapOpacity(mode: SubscriptionMode): number {
    if (this.homeListSwapAnimating && mode === this.homeListSwapMode) {
      return this.homeListSwapOpacity
    }
    return 1
  }

  modeListSwapTranslateY(mode: SubscriptionMode): number {
    if (this.homeListSwapAnimating && mode === this.homeListSwapMode) {
      return this.homeListSwapTranslateY
    }
    return 0
  }

  private modeListSwapScale(mode: SubscriptionMode): number {
    if (this.homeListSwapAnimating && mode === this.homeListSwapMode) {
      return this.homeListSwapScale
    }
    return 1
  }

  private resolveEntryMode(entry: EntryCardModel): SubscriptionMode {
    return resolveEntryMode(entry)
  }

  private filterEntriesByMode(mode: SubscriptionMode, entries: EntryCardModel[]): EntryCardModel[] {
    return filterEntriesByMode(mode, entries)
  }

  private homeEntryRenderBaseKey(entry: EntryCardModel): string {
    return homeEntryRenderBaseKey(entry)
  }

  private homeEntryListRenderKey(entry: EntryCardModel, index: number): string {
    return homeEntryListRenderKey(entry, index)
  }

  private duplicateKeyCount(counter: Map<string, number>): number {
    return duplicateKeyCount(counter)
  }

  notifyHomeEntryDataReloaded(): void {
    this.homeEntryDataManager.notifyAllReloaded()
  }

  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void {
    this.homeEntryDataManager.notifyModeReloaded(mode)
  }

  private notifyHomeEntryDataReloadedExcept(mode: SubscriptionMode): void {
    this.homeEntryDataManager.notifyAllReloadedExcept(mode)
  }

  private homeEntryDataSourceFor(mode: SubscriptionMode): ArrayLazyDataSource<EntryCardModel> {
    switch (mode) {
      case 'social':
        return this.homeEntryDataSources.social
      case 'pictures':
        return this.homeEntryDataSources.pictures
      case 'videos':
        return this.homeEntryDataSources.videos
      default:
        return this.homeEntryDataSources.articles
    }
  }

  private homeEntryCountFor(mode: SubscriptionMode): number {
    return this.visibleEntryCountFor(mode)
  }

  private filteredEntries(): EntryCardModel[] {
    return this.filteredEntriesFor(this.mode)
  }

  pictureGalleryUrls(entry: EntryCardModel): string[] {
    return pictureGalleryUrls(entry)
  }

  pictureCaption(entry: EntryCardModel): string {
    return pictureCaption(entry)
  }

  pictureCardEntry(entry: EntryCardModel): Entry {
    return pictureCardEntry(entry)
  }

  modeSceneVisible(mode: SubscriptionMode): Visibility {
    const state = resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    })
    return state.visibility === 'visible' ? Visibility.Visible : Visibility.Hidden
  }

  private shouldMountModeScene(mode: SubscriptionMode): boolean {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).shouldMount
  }

  modeSceneOpacity(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).opacity
  }

  modeSceneOffset(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).offset
  }

  modeSceneZIndex(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).zIndex
  }

  clearAutoRefreshTimer(): void {
    if (this.autoRefreshTimer < 0) {
      return
    }
    clearInterval(this.autoRefreshTimer)
    this.autoRefreshTimer = -1
  }

  private autoRefreshIntervalMs(): number {
    const configuredMinutes = Number(this.rootSettings.refreshIntervalMinutes)
    const normalizedMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes
    const safeMinutes = Math.max(AUTO_REFRESH_MIN_INTERVAL_MINUTES, Math.floor(normalizedMinutes))
    return safeMinutes * 60 * 1000
  }

  configureAutoRefreshTimer(): void {
    this.clearAutoRefreshTimer()
    if (!this.rootSettings.autoRefresh) {
      return
    }
    const intervalMs = this.autoRefreshIntervalMs()
    this.autoRefreshTimer = setInterval(() => {
      void this.refreshFeaturedEntries(false)
    }, intervalMs)
  }

  private requestExpandedModeRail(): void {
    this.homeInlineSearchController.close()
    this.homeRailCoordinator.requestExpandedModeRail()
  }

  private createHomeRootContentCallbacks(): IndexHomeRootContentCallbacks {
    return createIndexHomeRootContentCallbacks(this)
  }

  onPageShow(): void {
    console.info('Livo Harmony Index onPageShow')
    this.syncRequestedRootTab()
    this.restoreSettingsSheetIfNeeded()
  }

  private restoreSettingsSheetIfNeeded(): void {
    const storedSheet = AppStorage.get<string>('settingsActiveSheetKey')
    if (!storedSheet) {
      return
    }
    // 通过短暂清空再恢复来触发 @Watch，让 SettingsContent 重新打开 sheet
    AppStorage.setOrCreate('settingsActiveSheetKey', '')
    AppStorage.setOrCreate('settingsActiveSheetKey', storedSheet)
  }

  private shouldHideBottomTabs(): boolean {
    return this.rootTabCoordinator.shouldHideBottomTabs()
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
        hideBottomTabs: this.shouldHideBottomTabs(),
        hideTitleBar: this.shouldHideRootTitleBar(),
        isHomeRootTab: this.isHomeRootTab(),
        isSettingsRootTab: this.isSettingsRootTab(),
        currentRootTitle: this.currentRootTitle(),
        scrollEffectType: this.currentRootScrollEffectType(),
        blurEffectiveEndOffset: this.currentRootBlurEffectiveEndOffset(),
        originalTitleBarBackgroundColor: this.currentRootOriginalTitleBarBackgroundColor(),
        scrollEffectBackgroundColor: this.currentRootScrollEffectBackgroundColor(),
        originalTitleBarBlurRadius: this.currentRootOriginalTitleBarBlurRadius(),
        scrollEffectTitleBarBlurRadius: this.currentRootScrollEffectTitleBarBlurRadius(),
        originalTitleBarMaskExtraHeight: this.currentRootOriginalTitleBarMaskExtraHeight(),
        scrollEffectTitleBarMaskExtraHeight: this.currentRootScrollEffectTitleBarMaskExtraHeight(),
        blurStrategy: this.currentRootBlurStrategy(),
        systemMaterialEffect: this.currentRootSystemMaterialEffect(),
        bindScrollers: this.currentRootBindScrollers(),
        homeCallbacks: this.createHomeRootContentCallbacks(),
        rootTabSymbolPair: (tabId: HdsBottomTabId): RootTabSymbolPair => this.rootTabSymbolPair(tabId),
        onRootTabChange: (index: number) => {
          this.handleRootTabChange(index)
        },
        onTabAppear: (tabId: RootTabId) => {
          this.confirmRootTabSelection(tabId)
        },
        onSettingsContentScrollerReady: (scroller: Scroller) => {
          this.handleSettingsContentScrollerReady(scroller)
        },
        onSettingsChange: (settings: HarmonySettings) => {
          const previousSettings = this.rootSettings
          this.rootSettings = settings
          this.configureAutoRefreshTimer()
          if (
            settings.autoRefresh
            && (!previousSettings.autoRefresh
              || previousSettings.refreshIntervalMinutes !== settings.refreshIntervalMinutes)
          ) {
            void this.refreshFeaturedEntries(false)
          }
        },
        onThemeChange: (theme: ThemePalette) => {
          this.theme = theme
          void this.applySystemBarStyle(theme)
        },
      })

      IndexHomeOverlayLayer({
        isHomeRootTab: this.isHomeRootTab(),
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
        searchFieldOffsetY: this.homeInlineSearchVerticalOffset(),
        searchResultEntries: this.homeInlineSearchController.searchResultEntries(),
        searchShowEmptyState: this.homeInlineSearchController.hasSearchResultEmptyState(),
        inputController: this.searchInputController,
        onRefresh: () => {
          void this.refreshFeaturedEntries()
        },
        onSearchOpen: () => {
          this.homeInlineSearchController.open()
        },
        onExpandRequest: () => {
          this.requestExpandedModeRail()
        },
        onModeChange: (mode: SubscriptionMode) => {
          this.requestModeSwitch(mode)
        },
        onQueryChange: (value: string) => {
          this.searchQuery = value
        },
        onSearchClose: (clearQuery: boolean) => {
          this.homeInlineSearchController.close(clearQuery)
        },
        onEntryClick: (entry: EntryCardModel) => {
          this.openEntry(entry)
          this.homeInlineSearchController.close(true)
        },
        onSearchInputAppear: () => {
          this.homeInlineSearchController.focus()
        },
        summaryTextForEntry: (entry: EntryCardModel): string => {
          return this.homeInlineSearchController.searchResultSummaryText(entry)
        },
      })

    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  onBackPress(): boolean {
    if (this.currentRootTabId() === 'discover' && this.discoverOverlayLevel > 0) {
      AppStorage.setOrCreate('discoverOverlayBackAt', Date.now())
      return true
    }

    if (this.isHomeRootTab() && this.searchOverlayVisible) {
      this.homeInlineSearchController.close(true)
      return true
    }
    return false
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
