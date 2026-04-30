import { AppRepository } from '../common/data/AppRepository'
import { ArrayLazyDataSource } from '../common/data/ArrayLazyDataSource'
import { LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  HdsTabs,
  HdsTabsController,
  ScrollEffectType,
  SystemMaterialParams,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import window from '@ohos.window'
import { getRequestedRootTabId, openArticleDetail, RootTabId, rootTabIndexForId } from '../common/navigation/AppRouter'
import { ContentModeRail } from '../common/components/ContentModeRail'
import { HomeArticleEntryCard } from '../common/components/HomeArticleEntryCard'
import { HomeVideoGrid } from '../common/components/HomeVideoGrid'
import {
  ROOT_MODE_RAIL_TOP_GAP,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from '../common/components/FloatingRootPageLayout'
import { PictureEntryCard } from '../common/components/PictureEntryCard'
import { TweetEntryCard } from '../common/components/TweetEntryCard'
import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  EntryCardModel,
  HarmonySettings,
  articleDetailModelFromCard,
  selectPictureCarouselMediaUrls,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { createEmptyHomeEntryGroups, groupHomeEntriesByMode, HomeEntryGroups } from '../common/utils/HomeEntryGroups'
import { buildInlineHighlightSegments, normalizeInlineSearchQuery } from '../common/utils/HomeInlineSearch'
import { rememberVisitedMode } from '../common/utils/HomeModeVisitedCache'
import { resolveHomeVideoSceneKind } from '../common/utils/HomeVideoGrid'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
  shouldPreloadHomeVisibleEntries,
} from '../common/utils/HomeVisibleEntryPolicy'
import { presentTweetEntryFromCard, TweetEntryPresentation } from '../common/utils/TweetEntryPresentation'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
  PAGE_HORIZONTAL_PADDING,
} from '../common/ui/UiTokens'
import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { DiscoverContent } from '../common/components/DiscoverContent'
import { SettingsContent } from '../common/components/SettingsContent'
import { HomeEmptyStateCard } from '../common/components/HomeEmptyStateCard'
import { HomeInlineSearchOverlay, HOME_INLINE_SEARCH_INPUT_ID, HOME_INLINE_SEARCH_MOTION_DURATION } from '../common/components/HomeInlineSearchOverlay'
import {
  HdsBottomTabId,
  HdsBottomTabItem,
  resolveHdsBottomTabBarBottomMargin,
  resolveHdsBottomTabItems,
} from '../common/utils/HdsBottomTabConfig'
import { shouldRefreshThemeOnSystemColorModeChange } from '../common/utils/ThemeRefresh'
import { resolveSystemBarStyle } from '../common/utils/SystemBarStyle'
import { shouldAcceptModeSwitch } from '../common/utils/ModeSwitchGuard'
import { RefreshStateManager } from '../common/utils/RefreshStateManager'
import { shouldHideRootBottomBar, shouldHideRootTitleBar } from '../common/utils/RootTabVisibilityPolicy'
import { resolveHomeModeTitle } from '../common/utils/HomeModeMeta'
import { resolveModeSceneRenderState } from '../common/utils/ModeSceneTransition'
import {
  AUTO_REFRESH_MIN_INTERVAL_MINUTES,
  HEADER_BLUR_SCROLL_RANGE,
  HOME_ASYNC_ERROR_DEBUG_ENABLED,
  HOME_ASYNC_ERROR_PREFIX,
  HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT,
  HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA,
  HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET,
  HOME_COLLAPSED_MODE_RAIL_TOP_PADDING,
  HOME_ENTRY_GROUP_DEFER_DELAY_MS,
  HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS,
  HOME_FINAL_RELOAD_IDLE_MAX_RETRIES,
  HOME_FINAL_RELOAD_IDLE_RETRY_MS,
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_GROUP_DEBUG_ENABLED,
  HOME_GROUP_DEBUG_PREFIX,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_INLINE_SEARCH_ACTION_GAP,
  HOME_INLINE_SEARCH_ACTION_SIZE,
  HOME_INLINE_SEARCH_RESULT_LIMIT,
  HOME_INLINE_SEARCH_VERTICAL_TRAVEL,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_LOAD_MORE_AFTER_STOP_DELAY_MS,
  HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED,
  HOME_LOAD_MORE_DEBUG_ENABLED,
  HOME_LOAD_MORE_DEBUG_PREFIX,
  HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER,
  HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS,
  HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR,
  HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
  HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS,
  HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS,
  HOME_LOAD_MORE_MIN_INTERVAL_MS,
  HOME_LOAD_STATE_DIAG_ENABLED,
  HOME_LOAD_STATE_DIAG_PREFIX,
  HOME_MAX_CANDIDATE_LIMIT,
  HOME_MODE_CONTENT_GAP,
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT,
  HOME_MODE_DEBUG_ENABLED,
  HOME_MODE_DEBUG_PREFIX,
  HOME_MODE_INITIAL_CANDIDATE_LIMIT,
  HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL,
  HOME_MODE_RAIL_COLLAPSE_OFFSET,
  HOME_MODE_SCENE_TOP_INSET,
  HOME_MODE_SCENE_TRANSITION_DURATION,
  HOME_MODE_SWITCH_CANDIDATE_LIMIT,
  HOME_PERF_DIAG_ENABLED,
  HOME_PERF_DIAG_PREFIX,
  HOME_PULL_DEBUG_LOG_ENABLED,
  HOME_PULL_DEBUG_LOG_PREFIX,
  HOME_REFRESH_CONTENT_HOLD_DISTANCE,
  HOME_REFRESH_DISMISS_SCROLL_OFFSET,
  HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS,
  HOME_REFRESH_FINAL_RELOAD_DELAY_MS,
  HOME_REFRESH_FINALIZE_DEBOUNCE_MS,
  HOME_REFRESH_FIRST_SWAP_DELAY_MS,
  HOME_REFRESH_FOLLOW_RATIO,
  HOME_REFRESH_GAP_OPEN_PULL_DISTANCE,
  HOME_REFRESH_INDICATOR_BOTTOM_MARGIN,
  HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y,
  HOME_REFRESH_INDICATOR_SIZE,
  HOME_REFRESH_INDICATOR_VISUAL_OFFSET,
  HOME_REFRESH_MAX_PULL_DISTANCE,
  HOME_REFRESH_PERCENT_COALESCE_MS,
  HOME_REFRESH_PROGRESS_UI_THROTTLE_MS,
  HOME_REFRESH_PULL_DISTANCE,
  HOME_REFRESH_PULL_DISTANCE_STEP,
  HOME_REFRESH_RELEASE_FINALIZE_DEFER_MS,
  HOME_REFRESH_RESET_DEFER_MS,
  HOME_REFRESH_RESET_DURATION,
  HOME_REFRESH_TRIGGER_DEFER_MS,
  HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT,
  HOME_STARTUP_REFRESH_COOLDOWN_MS,
  MODE_SWIPE_TRIGGER_OFFSET,
  ROOT_BOTTOM_TITLE_HEIGHT,
  ROOT_TITLE_BAR_MINI_HEIGHT,
  SUBSCRIPTION_MODES,
  HomeEntryDataSourceMap,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeLoadMoreTimestampMap,
  HomeModeNoProgressCountMap,
  HomeModePendingLoadMoreMap,
  HomeModeRailOptions,
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
  @State homeRefreshPullDistance: number = 0
  @State homeRefreshIndicatorOffset: number = 0
  @State homeRefreshContentHoldOffset: number = 0
  @State homeRefreshIndicatorDismissed: boolean = false
  @State homeRefreshStatus: RefreshStatus = RefreshStatus.Inactive
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
  @State homeCandidateLimitsByMode: HomeModeCandidateLimitMap = {
    articles: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
    social: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
    pictures: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
    videos: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
  }
  @State homeHasMoreEntries: boolean = true
  @State homeHasMoreEntriesByMode: HomeModeHasMoreMap = {
    articles: true,
    social: true,
    pictures: true,
    videos: true,
  }
  @State homeLoadMoreInProgress: boolean = false
  @State homeVisibleEntryLimits: HomeModeVisibleEntryLimitMap = {
    articles: resolveHomeVisibleEntryInitialLimit('articles'),
    social: resolveHomeVisibleEntryInitialLimit('social'),
    pictures: resolveHomeVisibleEntryInitialLimit('pictures'),
    videos: resolveHomeVisibleEntryInitialLimit('videos'),
  }
  private readonly rootTabsController: HdsTabsController = new HdsTabsController()
  private readonly articlesScroller: Scroller = new Scroller()
  private readonly socialScroller: Scroller = new Scroller()
  private readonly picturesScroller: Scroller = new Scroller()
  private readonly videosScroller: Scroller = new Scroller()
  private searchInputController: TextInputController = new TextInputController()
  private readonly homeModeScrollOffsets: HomeModeScrollOffsetMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private readonly homeEntryDataSources: HomeEntryDataSourceMap = {
    articles: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.articles),
    social: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.social),
    pictures: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.pictures),
    videos: new ArrayLazyDataSource<EntryCardModel>(() => this.entryGroups.videos),
  }
  private settingsRootScroller?: Scroller
  private headerBlurOffset: number = 0
  private refreshPercentAnimationTimer: number = -1
  private pendingRefreshPercentTarget: number = 0
  private autoRefreshTimer: number = -1
  private homeEntryGroupVersion: number = 0
  private postRefreshReloadVersion: number = 0
  private homePostRefreshReloadPending: boolean = false
  private feedsChangedReloadVersion: number = 0
  private hasDeferredFeedsChangedReload: boolean = false
  private deferredFeedsChangedRetryToken: number = 0
  private suppressFeedsChangedUntilMs: number = 0
  private homeListSwapToken: number = 0
  private lastHomePullFinalizeAt: number = 0
  private homePullFinalizeQueued: boolean = false
  private lastRefreshProgressUiUpdateAt: number = 0
  private homePullDebugSessionId: number = 0
  private homePullDebugMode: SubscriptionMode = 'articles'
  private homePullDebugStartedAt: number = 0
  private homePullDebugReleasedAt: number = 0
  private homePullDebugWillScrollCount: number = 0
  private homePullDebugPostReleaseWillScrollCount: number = 0
  private homePullDebugIgnoredWillScrollCount: number = 0
  private homePullDebugStateWriteCount: number = 0
  private homePullDebugFinalizeScheduleCount: number = 0
  private homePullDebugFinalizeRunCount: number = 0
  private isComponentActive: boolean = false
  private hasLoadedInitialData: boolean = false
  private initialFeedCount: number = 0
  private homeSnapshotPersistVersion: number = 0
  private managedTimeoutIds: number[] = []
  private homeInlineSearchFocusRequestToken: number = 0
  private homeLoadMoreRequestToken: number = 0
  private lastHomeLoadMoreRequestedAt: number = 0
  private homeLoadMorePrefetchToken: number = 0
  private homeLoadMorePrefetchLimit: number = 0
  private homeLoadMorePrefetchEntries: EntryCardModel[] = []
  private homeLoadMorePrefetchMode: SubscriptionMode = 'articles'
  private homeLoadMorePrefetchInProgress: boolean = false
  private lastHomeUserScrollAt: number = 0
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = {
    articles: false,
    social: false,
    pictures: false,
    videos: false,
  }
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private homeModeScrollIntentVersions: HomeModeScrollOffsetMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private homeModeConsumedScrollIntentVersions: HomeModeScrollOffsetMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private homeModeLoaded: HomeModeLoadedMap = {
    articles: false,
    social: false,
    pictures: false,
    videos: false,
  }
  private homeModeLoading: HomeModeLoadingMap = {
    articles: false,
    social: false,
    pictures: false,
    videos: false,
  }
  private lastHomeLoadMoreCompletedAt: number = 0
  private lastHomeRefreshFinishedAt: number = 0
  private homePerfSessionId: number = 0
  private homePerfSessionStartedAt: number = 0
  private readonly tweetPresentationCache: Map<string, TweetEntryPresentation> = new Map()
  private lastHandledRequestedRootTabId: RootTabId | '' = ''

  aboutToAppear(): void {
    this.isComponentActive = true
    this.homePerfSessionId += 1
    this.homePerfSessionStartedAt = Date.now()
    console.info('Livo Harmony Index aboutToAppear')
    this.logHomePerf(`aboutToAppear mode=${this.mode} featured=${this.featuredEntries.length}`)
    this.syncRequestedRootTab()
    if (this.hasLoadedInitialData) {
      this.configureAutoRefreshTimer()
      this.tryFlushDeferredFeedsChangedReload('about-to-appear')
      if (this.featuredEntries.length === 0) {
        void this.reloadFeaturedEntriesFromLocal(
          this.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
          false,
          true,
          true,
        )
      }
      return
    }
    void this.loadInitialData()
  }

  aboutToDisappear(): void {
    this.isComponentActive = false
    this.invalidateHomeLoadMorePrefetch()
    this.persistHomeSnapshotNow()
    this.clearRefreshPercentAnimation()
    this.clearAutoRefreshTimer()
    this.clearManagedTimeouts()
    this.homePostRefreshReloadPending = false
    this.homeListSwapToken += 1
    this.homeListSwapAnimating = false
    this.homeListSwapOpacity = 1
    this.homeListSwapTranslateY = 0
    this.homeListSwapScale = 1
  }

  private runManagedTimeout(callback: () => void, delayMs: number): void {
    const timeoutId = setTimeout(() => {
      const pendingIndex = this.managedTimeoutIds.indexOf(timeoutId)
      if (pendingIndex >= 0) {
        this.managedTimeoutIds.splice(pendingIndex, 1)
      }
      if (!this.isComponentActive) {
        return
      }
      try {
        callback()
      } catch (error) {
        this.logHomeAsyncError(`managed-timeout delayMs=${delayMs}`, error)
      }
    }, delayMs)
    this.managedTimeoutIds.push(timeoutId)
  }

  private clearManagedTimeouts(): void {
    this.managedTimeoutIds.forEach((timeoutId: number) => {
      clearTimeout(timeoutId)
    })
    this.managedTimeoutIds = []
  }

  private describeError(error: Error | string | Object): string {
    if (error instanceof Error) {
      const stack = error.stack ? ` stack=${error.stack}` : ''
      return `${error.name}: ${error.message}${stack}`
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch (_) {
      return String(error)
    }
  }

  private logHomeAsyncError(stage: string, error: Error | string | Object): void {
    if (!HOME_ASYNC_ERROR_DEBUG_ENABLED) {
      return
    }
    console.error(`${HOME_ASYNC_ERROR_PREFIX} stage=${stage} error=${this.describeError(error)}`)
  }

  private async loadInitialData(): Promise<void> {
    const startedAt = Date.now()
    this.logHomePerf('loadInitialData start')
    this.resetModeLoadMoreStates('load-initial')
    this.homeInitialLoadPending = true
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
    const settingsPromise = AppRepository.settings()
    const feedsPromise = AppRepository.feedEntities()

    const currentMode = this.mode
    let restoredFromSnapshot: boolean = false
    const snapshotEntries = await AppRepository.homeEntrySnapshot()
    if (snapshotEntries.length > 0) {
      restoredFromSnapshot = true
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

      this.setCandidateLimitForMode('articles', restoredArticles.length)
      this.setCandidateLimitForMode('social', restoredSocial.length)
      this.setCandidateLimitForMode('pictures', restoredPictures.length)
      this.setCandidateLimitForMode('videos', restoredVideos.length)

      this.markModeLoaded('articles', restoredArticles.length > 0)
      this.markModeLoaded('social', restoredSocial.length > 0)
      this.markModeLoaded('pictures', restoredPictures.length > 0)
      this.markModeLoaded('videos', restoredVideos.length > 0)

      this.setModeHasMoreEntries('articles', true, 'snapshot-restore')
      this.setModeHasMoreEntries('social', true, 'snapshot-restore')
      this.setModeHasMoreEntries('pictures', true, 'snapshot-restore')
      this.setModeHasMoreEntries('videos', true, 'snapshot-restore')
      this.notifyHomeEntryDataReloaded()
      this.schedulePersistHomeSnapshot(this.featuredEntries)
      this.feedSourceLabel = '已恢复本地内容'
      // Snapshot already covers all modes; no precache needed.
    } else {
      // Use the faster recent-entry path first so first launch can paint sooner.
      this.featuredEntries = await AppRepository.featuredEntriesFast(HOME_INITIAL_CANDIDATE_LIMIT)
      if (this.featuredEntries.length === 0) {
        this.featuredEntries = await AppRepository.featuredEntries()
      }
      this.entryGroups = groupHomeEntriesByMode(this.featuredEntries)
      this.feedSourceLabel = '本地内容已加载'
      // Start precaching other modes immediately so they are ready before the user switches.
      this.precacheNonActiveModes()
    }
    this.settleInitialHomeLoadState()

    const settings = await settingsPromise
    const feeds = await feedsPromise
    this.initialFeedCount = feeds.length
    this.rootSettings = settings
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.theme = await ThemeService.resolvePalette(settings)
    void this.applySystemBarStyle(this.theme)

    void this.startStartupRefreshIfNeeded(restoredFromSnapshot)
    this.configureAutoRefreshTimer()
    this.hasLoadedInitialData = true
    this.ensureModeEntriesLoaded(currentMode)
    this.precacheNonActiveModes()

    this.scheduleHomeLoadMorePrefetch(800)
    this.logHomePerf(`loadInitialData done elapsedMs=${Date.now() - startedAt} featured=${this.featuredEntries.length}`)
  }

  private async shouldRunStartupRefresh(snapshotRestored: boolean): Promise<boolean> {
    if (!snapshotRestored) {
      return true
    }

    try {
      const logs = await AppRepository.refreshLogs()
      if (logs.length <= 0) {
        return true
      }

      const latestSuccessfulLog = logs.find((log) => {
        return Math.max(0, Number(log.successFeedCount) || 0) > 0
      })
      if (!latestSuccessfulLog) {
        return true
      }

      const latestRefreshAt = Math.max(0, Number(latestSuccessfulLog.refreshedAt) || 0)
      if (latestRefreshAt <= 0) {
        return true
      }

      const elapsedMs = Date.now() - latestRefreshAt
      if (elapsedMs < HOME_STARTUP_REFRESH_COOLDOWN_MS) {
        this.logHomePerf(
          `startup-refresh skip reason=cooldown elapsedMs=${elapsedMs} cooldownMs=${HOME_STARTUP_REFRESH_COOLDOWN_MS}`,
        )
        return false
      }
    } catch (error) {
      this.logHomeAsyncError('startup-refresh-check', error)
      return true
    }

    return true
  }

  private async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> {
    if (this.isHomeStartupRefreshing) {
      return
    }

    const shouldRun = await this.shouldRunStartupRefresh(snapshotRestored)
    if (!shouldRun) {
      return
    }

    this.isHomeStartupRefreshing = true
    void this.refreshFeaturedEntries(false).finally(() => {
      this.isHomeStartupRefreshing = false
      this.tryFlushDeferredFeedsChangedReload('startup-refresh-finally')
      this.settleInitialHomeLoadState()
      this.runManagedTimeout(() => {
        this.settleInitialHomeLoadState(true)
      }, 1200)
    })
  }

  private async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {
    if (this.isRefreshing || !this.isComponentActive) {
      return
    }

    const startedAt = Date.now()
    this.logHomePerf(`refresh start showToast=${showResultToast}`)
    this.invalidateHomeLoadMorePrefetch()
    this.resetModeLoadMoreStates('refresh-start')
    this.isRefreshing = true
    this.refreshCompletedCount = 0
    this.refreshTotalCount = 0
    this.lastRefreshProgressUiUpdateAt = 0
    this.clearRefreshPercentAnimation()
    this.displayRefreshPercent = 0

    try {
      const result = await AppRepository.refreshAllFeeds((completedCount: number, totalCount: number) => {
        if (!this.isComponentActive) {
          return
        }
        if (this.isHomeScrollInteracting && completedCount < totalCount) {
          return
        }

        const now = Date.now()
        const shouldFlushNow = completedCount >= totalCount
          || this.lastRefreshProgressUiUpdateAt === 0
          || now - this.lastRefreshProgressUiUpdateAt >= HOME_REFRESH_PROGRESS_UI_THROTTLE_MS
        if (!shouldFlushNow) {
          return
        }
        this.lastRefreshProgressUiUpdateAt = now

        this.refreshCompletedCount = completedCount
        this.refreshTotalCount = totalCount
        this.animateRefreshPercentTo(this.resolveRefreshPercent(completedCount, totalCount))
      })
      if (!this.isComponentActive) {
        return
      }
      this.feedSourceLabel = result.sourceLabel
      if (!result.allSkippedByCooldown) {
        this.scheduleHomeReloadAfterRefresh()
      }
      if (showResultToast) {
        this.showToast(result.sourceLabel)
      }
    } catch (error) {
      this.logHomeAsyncError('refresh-featured-entries', error)
      const errorMessage = this.describeError(error)
      this.feedSourceLabel = `刷新失败：${errorMessage}`
      if (showResultToast) {
        this.showToast('刷新失败，请查看日志')
      }
    } finally {
      this.isRefreshing = false
      this.refreshCompletedCount = 0
      this.refreshTotalCount = 0
      this.lastRefreshProgressUiUpdateAt = 0
      this.lastHomeRefreshFinishedAt = Date.now()
      this.clearRefreshPercentAnimation()
      this.displayRefreshPercent = 0
      this.runManagedTimeout(() => {
        this.animateHomePullRefreshReset()
      }, HOME_REFRESH_RESET_DEFER_MS)
      this.scheduleHomeLoadMorePrefetch()
      this.logHomePerf(`refresh done elapsedMs=${Date.now() - startedAt} featured=${this.featuredEntries.length}`)
    }
  }

  private resolveRefreshPercent(completedCount: number, totalCount: number): number {
    return RefreshStateManager.resolveRefreshPercent(completedCount, totalCount)
  }

  private clearRefreshPercentAnimation(): void {
    if (this.refreshPercentAnimationTimer < 0) {
      return
    }

    clearTimeout(this.refreshPercentAnimationTimer)
    this.refreshPercentAnimationTimer = -1
  }

  private animateRefreshPercentTo(targetPercent: number): void {
    const animationPlan = RefreshStateManager.createPercentAnimationPlan(this.displayRefreshPercent, targetPercent)
    const nextTarget = animationPlan.targetPercent
    if (nextTarget === this.displayRefreshPercent && this.refreshPercentAnimationTimer < 0) {
      return
    }

    this.pendingRefreshPercentTarget = nextTarget
    if (this.refreshPercentAnimationTimer >= 0) {
      return
    }

    this.refreshPercentAnimationTimer = setTimeout(() => {
      this.refreshPercentAnimationTimer = -1
      this.displayRefreshPercent = this.pendingRefreshPercentTarget
    }, HOME_REFRESH_PERCENT_COALESCE_MS)
  }

  private showToast(message: string, duration: number = 2000): void {
    if (!this.isComponentActive) {
      return
    }
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private animateWithUiContext(options: AnimateParam, event: () => void): void {
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

  private settleInitialHomeLoadState(force: boolean = false): void {
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

  private homeEmptyStateTitle(): string {
    return this.isHomeContentLoading()
      ? '正在加载订阅内容'
      : '未发现订阅推文，请先到发现页面添加或刷新订阅源'
  }

  @Builder
  private HomeModeStatusCard(message: string, showLoading: boolean = false) {
    HomeEmptyStateCard({
      message,
      loading: showLoading,
      loadingMessage: '正在加载内容...',
      theme: this.theme,
    })
  }

  private homeEmptyStateTopGap(mode: SubscriptionMode): number {
    return mode === 'social' ? HOME_MODE_CONTENT_GAP : 0
  }

  @Builder
  private HomeModeLoadingState(message: string = '正在加载内容...') {
    HomeEmptyStateCard({
      message: '',
      loading: true,
      loadingMessage: message,
      theme: this.theme,
    })
  }

  private updateHomePullRefreshState(offset: number): void {
    const rawOffset = RefreshStateManager.resolvePullDistance(offset, HOME_REFRESH_MAX_PULL_DISTANCE)
    const nextOffset = Math.round(rawOffset / HOME_REFRESH_PULL_DISTANCE_STEP) * HOME_REFRESH_PULL_DISTANCE_STEP
    if (!this.isRefreshing && Math.abs(nextOffset - this.homeRefreshPullDistance) < 0.5) {
      return
    }

    this.homeRefreshPullDistance = nextOffset
    this.homeRefreshIndicatorOffset = nextOffset
    this.homePullDebugStateWriteCount += 1
    if (this.isRefreshing) {
      this.homeRefreshStatus = RefreshStatus.Refresh
      return
    }

    if (nextOffset <= 0.5) {
      this.homeRefreshStatus = RefreshStatus.Inactive
    } else if (nextOffset >= HOME_REFRESH_PULL_DISTANCE) {
      this.homeRefreshStatus = RefreshStatus.OverDrag
    } else {
      this.homeRefreshStatus = RefreshStatus.Drag
    }
  }

  private resetHomePullRefreshState(): void {
    this.homeRefreshPullDistance = 0
    this.homeRefreshIndicatorOffset = 0
    this.homeRefreshContentHoldOffset = 0
    this.homeRefreshIndicatorDismissed = false
    this.homeRefreshStatus = RefreshStatus.Inactive
  }

  private dismissHomeRefreshIndicatorDuringRefresh(): void {
    if (!this.isRefreshing || this.homeRefreshIndicatorDismissed) {
      return
    }

    this.homeRefreshIndicatorDismissed = true
    this.homeRefreshPullDistance = 0
    this.homeRefreshIndicatorOffset = 0
    // Keep the same hold distance during dismiss so the rebound position stays fixed.
    this.homeRefreshContentHoldOffset = HOME_REFRESH_CONTENT_HOLD_DISTANCE
    this.homeRefreshStatus = RefreshStatus.Drag
    this.runManagedTimeout(() => {
      if (!this.isRefreshing || !this.homeRefreshIndicatorDismissed) {
        return
      }

      if (this.homeRefreshIndicatorOffset > 0.5 || this.homeRefreshContentHoldOffset > 0.5) {
        return
      }

      this.homeRefreshStatus = RefreshStatus.Inactive
    }, HOME_REFRESH_RESET_DURATION)
  }

  private reopenHomeRefreshGapDuringRefresh(): void {
    if (!this.isRefreshing || !this.homeRefreshIndicatorDismissed) {
      return
    }

    this.homeRefreshIndicatorDismissed = false
    this.homeRefreshIndicatorOffset = HOME_REFRESH_PULL_DISTANCE
    this.homeRefreshContentHoldOffset = HOME_REFRESH_CONTENT_HOLD_DISTANCE
    this.homeRefreshStatus = RefreshStatus.Refresh
  }

  private animateHomePullRefreshReset(): void {
    this.homeRefreshPullDistance = 0
    this.homeRefreshIndicatorOffset = 0
    this.homeRefreshContentHoldOffset = 0

    if (this.isRefreshing) {
      this.homeRefreshStatus = RefreshStatus.Refresh
      return
    }

    this.homeRefreshStatus = RefreshStatus.Drag
    this.runManagedTimeout(() => {
      if (this.isRefreshing) {
        return
      }

      if (this.homeRefreshIndicatorOffset > 0.5 || this.homeRefreshContentHoldOffset > 0.5) {
        return
      }

      this.homeRefreshStatus = RefreshStatus.Inactive
    }, HOME_REFRESH_RESET_DURATION)
  }

  private shouldConsumeHomePullScroll(mode: SubscriptionMode): boolean {
    return !this.shouldDisableHomePullRefresh()
      && this.currentRootTabId() === 'home'
      && mode === this.mode
      && !this.searchOverlayVisible
  }

  private consumeHomePullScroll(mode: SubscriptionMode, scrollOffset: number) {
    if (!this.shouldConsumeHomePullScroll(mode)) {
      return undefined
    }

    this.homePullDebugWillScrollCount += 1
    if (this.homePullDebugReleasedAt > 0) {
      this.homePullDebugPostReleaseWillScrollCount += 1
    }

    if (!this.isHomeScrollInteracting && !this.isRefreshing) {
      this.homePullDebugIgnoredWillScrollCount += 1
      return undefined
    }

    if (this.isRefreshing) {
      if (scrollOffset < 0 && this.homeModeScrollOffsetFor(mode) <= 0.5 && this.homeRefreshIndicatorDismissed) {
        this.reopenHomeRefreshGapDuringRefresh()
      }
      return undefined
    }

    const isAtTop = this.homeModeScrollOffsetFor(mode) <= 0.5
    const hasPullDistance = this.homeRefreshPullDistance > 0.5
    if (scrollOffset < 0 && (isAtTop || hasPullDistance)) {
      if (this.homeRefreshIndicatorDismissed) {
        this.homeRefreshIndicatorDismissed = false
      }
      this.updateHomePullRefreshState(
        this.homeRefreshPullDistance + (-1 * scrollOffset * HOME_REFRESH_FOLLOW_RATIO),
      )
      return undefined
    }

    if (scrollOffset > 0 && hasPullDistance) {
      this.updateHomePullRefreshState(this.homeRefreshPullDistance - scrollOffset)
      return undefined
    }

    return undefined
  }

  private consumeHomePullScrollOffset(mode: SubscriptionMode, yOffset: number) {
    this.consumeHomePullScroll(mode, yOffset)
    return undefined
  }

  private finalizeHomePullRefresh(): void {
    this.homePullDebugFinalizeRunCount += 1
    const now = Date.now()
    if (now - this.lastHomePullFinalizeAt < HOME_REFRESH_FINALIZE_DEBOUNCE_MS) {
      this.flushHomePullDebugSummary('debounced')
      return
    }
    this.lastHomePullFinalizeAt = now

    if (!this.shouldConsumeHomePullScroll(this.mode)) {
      this.flushHomePullDebugSummary('skip-not-consume')
      return
    }

    if (this.isRefreshing) {
      if (this.homeRefreshIndicatorDismissed) {
        this.homeRefreshIndicatorOffset = 0
      }
      this.flushHomePullDebugSummary('already-refreshing')
      return
    }

    if (this.homeRefreshPullDistance >= HOME_REFRESH_PULL_DISTANCE) {
      this.homeRefreshPullDistance = HOME_REFRESH_PULL_DISTANCE
      this.homeRefreshIndicatorOffset = HOME_REFRESH_PULL_DISTANCE
      this.homeRefreshContentHoldOffset = HOME_REFRESH_CONTENT_HOLD_DISTANCE
      this.homeRefreshIndicatorDismissed = false
      this.homeRefreshStatus = RefreshStatus.Refresh
      this.runManagedTimeout(() => {
        if (this.isRefreshing || this.homeRefreshStatus !== RefreshStatus.Refresh) {
          return
        }
        void this.refreshFeaturedEntries()
      }, HOME_REFRESH_TRIGGER_DEFER_MS)
      this.flushHomePullDebugSummary('trigger-refresh')
      return
    }

    if (this.homeRefreshPullDistance <= 0.5
      && this.homeRefreshIndicatorOffset <= 0.5
      && this.homeRefreshContentHoldOffset <= 0.5) {
      this.homeRefreshStatus = RefreshStatus.Inactive
      this.flushHomePullDebugSummary('inactive-no-distance')
      return
    }

    this.animateHomePullRefreshReset()
    this.flushHomePullDebugSummary('animate-reset')
  }

  private scheduleHomePullRefreshFinalizeForMode(mode: SubscriptionMode): void {
    if (mode !== this.mode || !this.isHomeRootTab()) {
      return
    }

    if (this.homePullFinalizeQueued) {
      return
    }

    this.homePullFinalizeQueued = true
    this.homePullDebugFinalizeScheduleCount += 1
    this.logHomePullDebug(`session=${this.homePullDebugSessionId} schedule-finalize mode=${mode} delay=${HOME_REFRESH_RELEASE_FINALIZE_DEFER_MS}ms`)
    this.runManagedTimeout(() => {
      this.homePullFinalizeQueued = false
      this.finalizeHomePullRefresh()
    }, HOME_REFRESH_RELEASE_FINALIZE_DEFER_MS)
  }

  private logHomePullDebug(message: string): void {
    if (!HOME_PULL_DEBUG_LOG_ENABLED) {
      return
    }
    console.info(`${HOME_PULL_DEBUG_LOG_PREFIX} ${message}`)
  }

  private startHomePullDebugSession(mode: SubscriptionMode): void {
    this.homePullDebugSessionId += 1
    this.homePullDebugMode = mode
    this.homePullDebugStartedAt = Date.now()
    this.homePullDebugReleasedAt = 0
    this.homePullDebugWillScrollCount = 0
    this.homePullDebugPostReleaseWillScrollCount = 0
    this.homePullDebugIgnoredWillScrollCount = 0
    this.homePullDebugStateWriteCount = 0
    this.homePullDebugFinalizeScheduleCount = 0
    this.homePullDebugFinalizeRunCount = 0
    this.logHomePullDebug(`session=${this.homePullDebugSessionId} start mode=${mode}`)
  }

  private markHomePullDebugReleased(mode: SubscriptionMode): void {
    if (this.homePullDebugStartedAt <= 0) {
      return
    }

    this.homePullDebugReleasedAt = Date.now()
    const activeDuration = this.homePullDebugReleasedAt - this.homePullDebugStartedAt
    this.logHomePullDebug(
      `session=${this.homePullDebugSessionId} release mode=${mode} activeMs=${activeDuration} `
      + `willScroll=${this.homePullDebugWillScrollCount} stateWrites=${this.homePullDebugStateWriteCount}`,
    )
  }

  private flushHomePullDebugSummary(outcome: string): void {
    if (this.homePullDebugStartedAt <= 0) {
      return
    }

    const now = Date.now()
    const totalMs = now - this.homePullDebugStartedAt
    const releaseToFinalizeMs = this.homePullDebugReleasedAt > 0 ? now - this.homePullDebugReleasedAt : -1
    this.logHomePullDebug(
      `session=${this.homePullDebugSessionId} summary mode=${this.homePullDebugMode} outcome=${outcome} `
      + `totalMs=${totalMs} releaseToFinalizeMs=${releaseToFinalizeMs} willScroll=${this.homePullDebugWillScrollCount} `
      + `postReleaseWillScroll=${this.homePullDebugPostReleaseWillScrollCount} ignoredWillScroll=${this.homePullDebugIgnoredWillScrollCount} `
      + `stateWrites=${this.homePullDebugStateWriteCount} finalizeScheduled=${this.homePullDebugFinalizeScheduleCount} `
      + `finalizeRun=${this.homePullDebugFinalizeRunCount}`,
    )

    this.homePullDebugStartedAt = 0
    this.homePullDebugReleasedAt = 0
  }

  private homeRefreshIndicatorProgress(): number {
    return RefreshStateManager.resolveIndicatorProgress(this.homeRefreshIndicatorOffset, HOME_REFRESH_PULL_DISTANCE)
  }

  private shouldShowHomeRefreshGap(mode: SubscriptionMode): boolean {
    if (this.shouldDisableHomePullRefresh() || !this.isHomeRootTab() || mode !== this.mode) {
      return false
    }

    if (this.homeRefreshIndicatorDismissed) {
      return this.homeRefreshContentHoldOffset > 0.5
    }

    return this.homeRefreshIndicatorOffset >= HOME_REFRESH_GAP_OPEN_PULL_DISTANCE
      || this.homeRefreshContentHoldOffset > 0.5
      || this.isRefreshing
  }

  private shouldShowHomeRefreshIndicator(mode: SubscriptionMode): boolean {
    if (this.shouldDisableHomePullRefresh() || !this.isHomeRootTab() || mode !== this.mode) {
      return false
    }

    if (this.homeRefreshIndicatorDismissed) {
      return false
    }

    if (this.homeRefreshGapHeight(mode) <= 0.5) {
      return false
    }

    return this.isRefreshing
      || this.homeRefreshStatus !== RefreshStatus.Inactive
      || this.homeRefreshIndicatorOffset > 0.5
  }

  private homeRefreshGapHeight(mode: SubscriptionMode): number {
    return RefreshStateManager.resolveGapHeight({
      shouldShowGap: this.shouldShowHomeRefreshGap(mode),
      indicatorOffset: this.homeRefreshIndicatorOffset,
      contentHoldOffset: this.homeRefreshContentHoldOffset,
      gapOpenPullDistance: HOME_REFRESH_GAP_OPEN_PULL_DISTANCE,
      followRatio: HOME_REFRESH_FOLLOW_RATIO,
      visualOffset: HOME_REFRESH_INDICATOR_VISUAL_OFFSET,
    })
  }

  private homeRefreshIndicatorOpacity(): number {
    return RefreshStateManager.resolveIndicatorOpacity(
      this.isRefreshing,
      this.homeRefreshStatus === RefreshStatus.Refresh,
      this.homeRefreshIndicatorProgress(),
    )
  }

  private homeRefreshIndicatorScale(): number {
    return RefreshStateManager.resolveIndicatorScale(this.homeRefreshIndicatorProgress())
  }

  private homeRefreshIndicatorTranslateY(): number {
    return HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y
  }

  private homeRefreshIndicatorBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(24,28,36,0.92)' : 'rgba(255,255,255,0.94)'
  }

  private homeRefreshIndicatorBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)'
  }

  private homeRefreshIndicatorShadow(): ShadowOptions {
    return {
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.22)' : 'rgba(15,23,42,0.08)',
      offsetX: 0,
      offsetY: 2,
    }
  }

  private refreshRootTheme(): void {
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
  }

  private updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.headerBlurOffset = clampedOffset
    this.headerBlurProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
  }

  private homeModeScrollOffsetFor(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeModeScrollOffsets.social
      case 'pictures':
        return this.homeModeScrollOffsets.pictures
      case 'videos':
        return this.homeModeScrollOffsets.videos
      default:
        return this.homeModeScrollOffsets.articles
    }
  }

  private updateHomeModeScrollOffset(mode: SubscriptionMode, offset: number): void {
    switch (mode) {
      case 'social':
        this.homeModeScrollOffsets.social = offset
        break
      case 'pictures':
        this.homeModeScrollOffsets.pictures = offset
        break
      case 'videos':
        this.homeModeScrollOffsets.videos = offset
        break
      default:
        this.homeModeScrollOffsets.articles = offset
        break
    }
  }

  private readHomeModeScrollOffset(mode: SubscriptionMode): number {
    try {
      return Math.max(0, this.homeScrollerForMode(mode).currentOffset().yOffset)
    } catch (_) {
      return this.homeModeScrollOffsetFor(mode)
    }
  }

  private syncHomeModeRailState(mode: SubscriptionMode = this.mode): void {
    const previousOffset = this.currentHomeModeScrollOffset
    const nextOffset = this.readHomeModeScrollOffset(mode)
    this.updateHomeModeScrollOffset(mode, nextOffset)
    if (mode !== this.mode) {
      return
    }

    if (this.isRefreshing && nextOffset > HOME_REFRESH_DISMISS_SCROLL_OFFSET) {
      this.dismissHomeRefreshIndicatorDuringRefresh()
    }

    const isReturningTowardsTop = nextOffset + 0.5 < previousOffset
    const isScrollingDeeper = nextOffset > previousOffset + 0.5

    if (this.homeModeRailExpandedOverride) {
      if (!isScrollingDeeper) {
        this.currentHomeModeScrollOffset = nextOffset
        this.updateHeaderBlurProgress(nextOffset)
        this.maybeTriggerLoadMoreByScrollProgress(mode, nextOffset)
        return
      }

      this.homeModeRailExpandedOverride = false
      this.homeModeRailExpandedLockOffset = -1
    }

    if (isReturningTowardsTop) {
      this.homeModeRailDismissedByScroll = false
    } else if (isScrollingDeeper && nextOffset >= HOME_MODE_RAIL_COLLAPSE_OFFSET) {
      this.homeModeRailDismissedByScroll = true
    }

    this.currentHomeModeScrollOffset = nextOffset
    this.updateHeaderBlurProgress(nextOffset)
    this.maybeTriggerLoadMoreByScrollProgress(mode, nextOffset)
  }

  private isUserDrivenHomeScrollSource(scrollSource: ScrollSource): boolean {
    return scrollSource === ScrollSource.DRAG
      || scrollSource === ScrollSource.FLING
      || scrollSource === ScrollSource.OTHER_USER_INPUT
      || scrollSource === ScrollSource.SCROLL_BAR
      || scrollSource === ScrollSource.SCROLL_BAR_FLING
  }

  private markHomeUserScrollIntent(mode: SubscriptionMode, scrollSource: ScrollSource): void {
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

  private modeScrollIntentVersion(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeModeScrollIntentVersions.social
      case 'pictures':
        return this.homeModeScrollIntentVersions.pictures
      case 'videos':
        return this.homeModeScrollIntentVersions.videos
      default:
        return this.homeModeScrollIntentVersions.articles
    }
  }

  private consumedModeScrollIntentVersion(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeModeConsumedScrollIntentVersions.social
      case 'pictures':
        return this.homeModeConsumedScrollIntentVersions.pictures
      case 'videos':
        return this.homeModeConsumedScrollIntentVersions.videos
      default:
        return this.homeModeConsumedScrollIntentVersions.articles
    }
  }

  private setModeScrollIntentVersion(mode: SubscriptionMode, value: number): void {
    this.homeModeScrollIntentVersions = {
      articles: mode === 'articles' ? value : this.homeModeScrollIntentVersions.articles,
      social: mode === 'social' ? value : this.homeModeScrollIntentVersions.social,
      pictures: mode === 'pictures' ? value : this.homeModeScrollIntentVersions.pictures,
      videos: mode === 'videos' ? value : this.homeModeScrollIntentVersions.videos,
    }
  }

  private setConsumedModeScrollIntentVersion(mode: SubscriptionMode, value: number): void {
    this.homeModeConsumedScrollIntentVersions = {
      articles: mode === 'articles' ? value : this.homeModeConsumedScrollIntentVersions.articles,
      social: mode === 'social' ? value : this.homeModeConsumedScrollIntentVersions.social,
      pictures: mode === 'pictures' ? value : this.homeModeConsumedScrollIntentVersions.pictures,
      videos: mode === 'videos' ? value : this.homeModeConsumedScrollIntentVersions.videos,
    }
  }

  private bumpModeScrollIntentVersion(mode: SubscriptionMode): void {
    this.setModeScrollIntentVersion(mode, this.modeScrollIntentVersion(mode) + 1)
  }

  private resetModeScrollIntent(mode: SubscriptionMode): void {
    this.lastHomeUserScrollAt = 0
    this.setModeScrollIntentVersion(mode, 0)
    this.setConsumedModeScrollIntentVersion(mode, 0)
    this.setModeScrollProgressLoadMoreValue(mode, 0)
  }

  private setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode = this.mode): void {
    if (interacting && !this.isHomeScrollInteracting) {
      this.startHomePullDebugSession(mode)
    }

    if (interacting) {
      this.lastHomeUserScrollAt = Date.now()
    }

    if (!interacting && this.isHomeScrollInteracting) {
      this.markHomePullDebugReleased(mode)
    }

    this.isHomeScrollInteracting = interacting
  }

  private currentRootTitle(): string {
    switch (this.currentRootTabId()) {
      case 'subscriptions':
        return '订阅库'
      case 'settings':
        return '设置'
      case 'discover':
        return '添加订阅'
      default:
        return '今日推荐'
    }
  }

  private normalizedSearchQuery(): string {
    return normalizeInlineSearchQuery(this.searchQuery)
  }

  private currentSearchEntries(): EntryCardModel[] {
    if (this.rootSettings.searchAllHomeCategories) {
      return this.featuredEntries
    }

    return this.filteredEntriesFor(this.mode)
  }

  private entrySearchTexts(entry: EntryCardModel): string[] {
    return [
      entry.feedTitle || '',
      entry.title || '',
      entry.summary || '',
      entry.author || '',
    ]
  }

  private hasSearchMatches(): boolean {
    const query = this.normalizedSearchQuery()
    if (!query) {
      return false
    }

    return this.currentSearchEntries().some((entry: EntryCardModel) => {
      return this.entrySearchTexts(entry).some((text: string) => {
        return buildInlineHighlightSegments(text, query).some((segment) => segment.matched)
      })
    })
  }

  private searchResultEntries(): EntryCardModel[] {
    const query = this.normalizedSearchQuery()
    if (!query) {
      return []
    }

    return this.currentSearchEntries()
      .filter((entry: EntryCardModel) => {
        return this.entrySearchTexts(entry).some((text: string) => {
          return buildInlineHighlightSegments(text, query).some((segment) => segment.matched)
        })
      })
      .slice(0, HOME_INLINE_SEARCH_RESULT_LIMIT)
  }

  private hasSearchResultEmptyState(): boolean {
    return !!this.normalizedSearchQuery() && this.searchResultEntries().length === 0
  }

  private searchResultSummaryText(entry: EntryCardModel): string {
    const candidates: string[] = [
      entry.summary || '',
      entry.author || '',
      entry.feedTitle || '',
      entry.title || '',
    ]

    for (const text of candidates) {
      const snippet = this.searchResultSnippet(text)
      if (snippet) {
        return snippet
      }
    }

    return ''
  }

  private searchResultSnippet(text: string): string {
    const query = this.normalizedSearchQuery()
    if (!query || !text) {
      return ''
    }

    const lowerText = text.toLocaleLowerCase()
    const index = lowerText.indexOf(query)
    if (index < 0) {
      return ''
    }

    const start = Math.max(0, index - 20)
    const end = Math.min(text.length, index + query.length + 30)
    let snippet = text.slice(start, end).trim()
    if (start > 0) {
      snippet = `...${snippet}`
    }
    if (end < text.length) {
      snippet = `${snippet}...`
    }
    return snippet
  }

  private logHomeSearchFocusDebug(event: string, detail: string = ''): void {
    const suffix = detail ? ` ${detail}` : ''
    console.info(
      `[HomeSearchFocusDebug] ${event}${suffix} tab=${this.currentRootTabId()} overlay=${this.searchOverlayVisible} visible=${this.showSearch} token=${this.homeInlineSearchFocusRequestToken}`,
    )
  }

  private openHomeInlineSearch(): void {
    this.logHomeSearchFocusDebug('open-search')
    if (!this.searchOverlayVisible) {
      this.searchOverlayVisible = true
      this.runManagedTimeout(() => {
        this.showSearch = true
        this.logHomeSearchFocusDebug('show-search-overlay')
        this.focusHomeInlineSearch()
      }, 16)
      return
    }

    this.showSearch = true
    this.focusHomeInlineSearch()
  }

  private focusHomeInlineSearch(): void {
    this.homeInlineSearchFocusRequestToken += 1
    const requestToken = this.homeInlineSearchFocusRequestToken
    this.logHomeSearchFocusDebug('schedule-focus-batch', `requestToken=${requestToken}`)
    this.requestHomeInlineSearchFocus(24, requestToken)
    this.requestHomeInlineSearchFocus(80, requestToken)
    this.requestHomeInlineSearchFocus(180, requestToken)
    this.requestHomeInlineSearchFocus(320, requestToken)
  }

  private requestHomeInlineSearchFocus(delayMs: number, requestToken: number): void {
    this.runManagedTimeout(() => {
      if (!this.canFocusHomeInlineSearch(requestToken)) {
        this.logHomeSearchFocusDebug('skip-focus-request', `delayMs=${delayMs} requestToken=${requestToken}`)
        return
      }

      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.searchInputController.caretPosition(this.searchQuery.length)
      this.logHomeSearchFocusDebug('apply-focus-request', `delayMs=${delayMs} requestToken=${requestToken}`)
    }, delayMs)
  }

  private canFocusHomeInlineSearch(requestToken: number): boolean {
    return requestToken === this.homeInlineSearchFocusRequestToken
      && this.currentRootTabId() === 'home'
      && this.searchOverlayVisible
      && this.showSearch
  }

  private cancelHomeInlineSearchFocusRequests(reason: string = 'unknown'): void {
    this.homeInlineSearchFocusRequestToken += 1
    this.logHomeSearchFocusDebug('cancel-focus-requests', `reason=${reason}`)
  }

  private closeHomeInlineSearch(clearQuery: boolean = true): void {
    this.cancelHomeInlineSearchFocusRequests('close-search')
    this.showSearch = false
    this.searchInputController.stopEditing()
    this.logHomeSearchFocusDebug('close-search', `clearQuery=${clearQuery ? 'true' : 'false'}`)
    if (clearQuery) {
      this.searchQuery = ''
    }
    this.runManagedTimeout(() => {
      this.finalizeHomeInlineSearchClose()
    }, HOME_INLINE_SEARCH_MOTION_DURATION)
  }

  private finalizeHomeInlineSearchClose(): void {
    if (this.showSearch) {
      return
    }

    this.searchOverlayVisible = false
  }

  @Builder
  private SettingsRootLowerTitleBuilder() {
    Row() {
      Text(this.currentRootTitle())
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(ROOT_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  @Builder
  private HomeRootLowerTitleBuilder() {
    Row() {
      Text('首页')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  @Builder
  private HomeRootTitleOverlayLayer() {
    Row() {
      Text('首页')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      top: ROOT_TITLE_BAR_MINI_HEIGHT,
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
    .opacity(Math.max(0, 1 - this.homeModeRailCollapseProgress()))
    .zIndex(121)
  }

  private homeInlineSearchVerticalOffset(): number {
    return this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL
  }

  private isHomeRootTab(): boolean {
    return this.currentRootTabId() === 'home'
  }

  private shouldHideRootTitleBar(): boolean {
    return shouldHideRootTitleBar(this.currentRootTabId())
  }

  private currentRootScrollEffectType(): ScrollEffectType {
    return ScrollEffectType.IMMERSIVE_GRADIENT_BLUR
  }

  private isSettingsRootTab(): boolean {
    return this.currentRootTabId() === 'settings'
  }

  private currentRootBlurEffectiveEndOffset(): LengthMetrics {
    return LengthMetrics.vp(30)
  }

  private currentRootOriginalTitleBarBackgroundColor(): ResourceColor {
    return '#00000000'
  }

  private currentRootScrollEffectBackgroundColor(): ResourceColor {
    return '#00000000'
  }

  private currentRootOriginalTitleBarBlurRadius(): number {
    return 28
  }

  private currentRootScrollEffectTitleBarBlurRadius(): number {
    return 48
  }

  private currentRootOriginalTitleBarMaskExtraHeight(): number {
    return 0
  }

  private currentRootScrollEffectTitleBarMaskExtraHeight(): number {
    return 0
  }

  private currentRootBlurStrategy(): BlurStrategy | undefined {
    return BlurStrategy.ENABLE
  }

  private currentRootSystemMaterialEffect(): SystemMaterialParams | undefined {
    return {
      materialType: hdsMaterial.MaterialType.IMMERSIVE,
      materialLevel: hdsMaterial.MaterialLevel.EXQUISITE,
    }
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

  private homeScrollerForMode(mode: SubscriptionMode): Scroller {
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

  private async applySystemBarStyle(theme: ThemePalette): Promise<void> {
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

  private syncRequestedRootTab(): void {
    const requestedTab = getRequestedRootTabId()
    if (!requestedTab) {
      return
    }

    if (requestedTab === this.lastHandledRequestedRootTabId) {
      return
    }

    this.highlightedRootTabId = requestedTab
    this.activeRootTabId = requestedTab
    this.rootTabIndex = rootTabIndexForId(requestedTab)
    this.lastHandledRequestedRootTabId = requestedTab
    this.syncRootTabsController()
  }

  private syncRootTabsController(): void {
    try {
      this.suppressRootTabChange = true
      this.rootTabsController.changeIndex(this.rootTabIndex)
    } catch (_) {
    } finally {
      this.suppressRootTabChange = false
    }
  }

  private openEntry(entry: EntryCardModel): void {
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
    const targetId = (target.id || '').trim()
    const targetArticleUrl = (target.articleUrl || '').trim()
    const targetFeedId = (target.feedId || '').trim()
    const targetPublishedAt = target.publishedAt
    const targetTitle = (target.title || '').trim()

    let updated = false
    const updatedEntries = this.featuredEntries.map((item: EntryCardModel) => {
      if (item.isRead) {
        return item
      }

      const itemId = (item.id || '').trim()
      const itemArticleUrl = (item.articleUrl || '').trim()
      const itemFeedId = (item.feedId || '').trim()
      const itemTitle = (item.title || '').trim()

      const matchById = !!targetId && itemId === targetId
      const matchByUrl = !targetId && !!targetArticleUrl && itemArticleUrl === targetArticleUrl
      const matchBySnapshot = !targetId
        && !targetArticleUrl
        && !!targetFeedId
        && itemFeedId === targetFeedId
        && item.publishedAt === targetPublishedAt
        && itemTitle === targetTitle

      if (!matchById && !matchByUrl && !matchBySnapshot) {
        return item
      }

      updated = true
      return {
        id: item.id,
        feedId: item.feedId,
        title: item.title,
        summary: item.summary,
        content: item.content,
        imageUrl: item.imageUrl,
        feedImageUrl: item.feedImageUrl,
        author: item.author,
        articleUrl: item.articleUrl,
        publishedAt: item.publishedAt,
        publishedLabel: item.publishedLabel,
        readingLabel: item.readingLabel,
        tags: item.tags,
        mediaUrls: item.mediaUrls,
        rawMediaUrls: item.rawMediaUrls,
        feedTitle: item.feedTitle,
        feedCategory: item.feedCategory,
        viewLabel: item.viewLabel,
        viewBadgeColor: item.viewBadgeColor,
        hasVideoMedia: item.hasVideoMedia,
        isRead: true,
        isStarred: item.isStarred,
      }
    })

    if (!updated) {
      return
    }

    this.featuredEntries = updatedEntries
    this.schedulePersistHomeSnapshot(updatedEntries)
    const regrouped = groupHomeEntriesByMode(this.featuredEntries)
    this.entryGroups = {
      articles: [...regrouped.articles],
      social: [...regrouped.social],
      pictures: [...regrouped.pictures],
      videos: [...regrouped.videos],
    }
  }

  private bottomTabSymbol(
    symbol: Resource,
    colors: ResourceColor[],
  ): SymbolGlyphModifier {
    return new SymbolGlyphModifier(symbol)
      .renderingStrategy(SymbolRenderingStrategy.MULTIPLE_COLOR)
      .fontColor(colors)
  }

  private rootTabSymbolPair(tabId: HdsBottomTabId): RootTabSymbolPair {
    const normalColors: ResourceColor[] = [
      $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
      $r('sys.color.ohos_id_color_bottom_tab_icon_auxcolor_off02'),
    ]
    const selectedColors: ResourceColor[] = [
      $r('sys.color.ohos_id_color_activated'),
      $r('sys.color.ohos_id_color_primary_contrary'),
    ]

    switch (tabId) {
      case 'subscriptions':
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.folder_fill'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.folder_fill'), selectedColors),
        } as RootTabSymbolPair
      case 'discover':
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.magnifyingglass'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.magnifyingglass'), selectedColors),
        } as RootTabSymbolPair
      case 'settings':
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.gearshape'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.gearshape_fill'), selectedColors),
        } as RootTabSymbolPair
      default:
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.house'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.house_fill'), selectedColors),
        } as RootTabSymbolPair
    }
  }

  private handleRootTabChange(index: number): void {
    if (this.suppressRootTabChange) {
      return
    }

    const previousTabId = this.currentRootTabId()
    const item = resolveHdsBottomTabItems()[index]
    if (!item) {
      return
    }

    const tabId = item.id as RootTabId
    this.rootTabIndex = index
    this.highlightedRootTabId = tabId
    this.activeRootTabId = tabId
    this.logHomeSearchFocusDebug('root-tab-change', `nextTab=${tabId}`)
    if (previousTabId === 'discover' && tabId !== 'discover') {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
      AppStorage.setOrCreate('discoverOverlayLevel', 0)
      AppStorage.setOrCreate('discoverNavigationResetAt', Date.now())
    }
    if (tabId !== 'home') {
      this.resetHomePullRefreshState()
      this.closeHomeInlineSearch(true)
      return
    }

    this.syncHomeModeRailState(this.mode)
    this.primeHomeModeRailForRootActivation()
    const flushedDeferredReload = this.tryFlushDeferredFeedsChangedReload('tab-change')
    if (!flushedDeferredReload
      && this.hasLoadedInitialData
      && this.featuredEntries.length === 0
      && !this.isRefreshing
      && !this.isHomeStartupRefreshing
    ) {
      this.runManagedTimeout(() => {
        void this.reloadFeaturedEntriesFromLocal(
          this.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
          false,
          true,
          true,
        )
      }, 0)
    }
  }

  private confirmRootTabSelection(tabId: RootTabId): void {
    if (tabId !== this.highlightedRootTabId) {
      return
    }

    if (this.activeRootTabId === tabId) {
      return
    }

    this.activeRootTabId = tabId
    if (tabId === 'home') {
      this.syncHomeModeRailState(this.mode)
      this.primeHomeModeRailForRootActivation()
      this.tryFlushDeferredFeedsChangedReload('tab-home')
    }
  }

  private currentRootTabId(): RootTabId {
    return this.activeRootTabId
  }

  private modeIndex(mode: SubscriptionMode): number {
    return SUBSCRIPTION_MODES.indexOf(mode)
  }

  private requestModeSwitch(nextMode: SubscriptionMode): void {
    if (!shouldAcceptModeSwitch({
      currentMode: this.mode,
      nextMode,
      isTransitioning: this.isModeTransitioning,
    })) {
      return
    }

    const nextModeOffset = this.homeModeScrollOffsetFor(nextMode)

    this.mode = nextMode
    this.visitedModes = rememberVisitedMode(this.visitedModes, nextMode)
    this.setHomeScrollInteracting(false, nextMode)
    this.resetModeScrollIntent(nextMode)
    this.resetHomePullRefreshState()
    this.homeModeRailExpandedLockOffset = nextModeOffset
    this.homeModeRailExpandedOverride = true
    this.currentHomeModeScrollOffset = nextModeOffset
    this.homeModeRailDismissedByScroll = false
    this.updateHeaderBlurProgress(nextModeOffset)
    this.startModeTransition(nextMode)
    this.ensureModeEntriesLoaded(nextMode)
  }

  private logModeSwitchSnapshot(stage: string, mode: SubscriptionMode): void {
    if (!HOME_MODE_DEBUG_ENABLED) {
      return
    }

    const entries = this.filteredEntriesFor(mode)
    const firstEntry = entries.length > 0 ? entries[0] : undefined
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : undefined
    const firstId = firstEntry ? firstEntry.id : ''
    const lastId = lastEntry ? lastEntry.id : ''
    const currentOffset = this.homeModeScrollOffsetFor(mode)

    console.info(
      `${HOME_MODE_DEBUG_PREFIX} stage=${stage} target=${mode} count=${entries.length} `
      + `activeMode=${this.mode} renderedMode=${this.renderedMode} offset=${currentOffset.toFixed(1)} `
      + `firstId=${firstId} lastId=${lastId}`,
    )
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    const previousRenderedMode = this.renderedMode
    this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(previousRenderedMode) ? 1 : -1
    this.previousMode = previousRenderedMode
    this.renderedMode = nextMode
    this.isModeTransitioning = true
    this.runManagedTimeout(() => {
      if (this.renderedMode !== nextMode || this.previousMode !== previousRenderedMode) {
        return
      }

      this.isModeTransitioning = false
    }, HOME_MODE_SCENE_TRANSITION_DURATION)
  }

  private adjacentMode(offsetX: number): SubscriptionMode | undefined {
    const currentIndex = this.modeIndex(this.mode)
    if (currentIndex < 0) {
      return undefined
    }

    const nextIndex = offsetX < 0 ? currentIndex + 1 : currentIndex - 1
    if (nextIndex < 0 || nextIndex >= SUBSCRIPTION_MODES.length) {
      return undefined
    }

    return SUBSCRIPTION_MODES[nextIndex]
  }

  private handleModeSwipe(event: GestureEvent): void {
    if (this.isModeTransitioning) {
      return
    }

    const offsetX = event.offsetX
    const offsetY = event.offsetY
    if (Math.abs(offsetX) < MODE_SWIPE_TRIGGER_OFFSET || Math.abs(offsetX) <= Math.abs(offsetY)) {
      return
    }

    const nextMode = this.adjacentMode(offsetX)
    if (nextMode) {
      this.requestModeSwitch(nextMode)
    }
  }

  private filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
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

  private presentTweetEntry(entry: EntryCardModel): TweetEntryPresentation {
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

  private resetTweetPresentationCache(): void {
    if (this.tweetPresentationCache.size === 0) {
      return
    }
    this.tweetPresentationCache.clear()
  }

  private markDeferredFeedsChangedReload(reason: string): void {
    this.hasDeferredFeedsChangedReload = true
    this.logHomePerf(`feedsChanged deferred reason=${reason}`)
  }

  private scheduleDeferredFeedsChangedRetry(delayMs: number): void {
    const safeDelayMs = Math.max(16, delayMs)
    const retryToken = this.deferredFeedsChangedRetryToken + 1
    this.deferredFeedsChangedRetryToken = retryToken
    this.runManagedTimeout(() => {
      if (this.deferredFeedsChangedRetryToken !== retryToken) {
        return
      }
      this.tryFlushDeferredFeedsChangedReload('retry')
    }, safeDelayMs)
  }

  private scheduleFeedsChangedReload(reason: string): void {
    const currentVersion = this.feedsChangedReloadVersion + 1
    this.feedsChangedReloadVersion = currentVersion
    this.logHomePerf(`feedsChanged reload reason=${reason} version=${currentVersion}`)
    this.invalidateHomeLoadMorePrefetch()
    this.runManagedTimeout(() => {
      void this.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, false, false)
    }, 0)
  }

  private tryFlushDeferredFeedsChangedReload(source: string): boolean {
    if (!this.hasDeferredFeedsChangedReload) {
      return false
    }
    if (!this.isComponentActive || !this.isHomeRootTab()) {
      return false
    }
    if (this.homePostRefreshReloadPending) {
      return false
    }

    const now = Date.now()
    if (this.isRefreshing || this.isHomeStartupRefreshing || this.homeLoadMoreInProgress || this.isHomeScrollInteracting) {
      return false
    }
    if (now < this.suppressFeedsChangedUntilMs) {
      this.scheduleDeferredFeedsChangedRetry(this.suppressFeedsChangedUntilMs - now + 16)
      return true
    }

    this.hasDeferredFeedsChangedReload = false
    this.scheduleFeedsChangedReload(`deferred-${source}`)
    return true
  }

  private handleFeedsChanged(): void {
    if (!this.isComponentActive) {
      return
    }

    const now = Date.now()
    if (!this.isHomeRootTab()) {
      this.markDeferredFeedsChangedReload('not-home-tab')
      return
    }

    if (this.isRefreshing || this.isHomeStartupRefreshing || this.homeLoadMoreInProgress || this.isHomeScrollInteracting) {
      this.markDeferredFeedsChangedReload('busy')
      return
    }
    if (this.homePostRefreshReloadPending) {
      this.markDeferredFeedsChangedReload('post-refresh-pending')
      return
    }

    if (now < this.suppressFeedsChangedUntilMs) {
      this.markDeferredFeedsChangedReload('suppressed-until')
      this.scheduleDeferredFeedsChangedRetry(this.suppressFeedsChangedUntilMs - now + 16)
      return
    }

    if (now - this.lastHomeRefreshFinishedAt < HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS) {
      this.markDeferredFeedsChangedReload('post-refresh-suppress')
      const remainingSuppressMs = HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS - (now - this.lastHomeRefreshFinishedAt)
      this.scheduleDeferredFeedsChangedRetry(remainingSuppressMs + 16)
      return
    }

    this.scheduleFeedsChangedReload('watch-event')
  }

  private shouldRunFinalHomeReloadNow(): boolean {
    const currentOffset = this.readHomeModeScrollOffset(this.mode)
    const shouldApplyLengthGuard = !this.shouldRenderAllEntriesForMode(this.mode)
    return this.isComponentActive
      && this.isHomeRootTab()
      && !this.isRefreshing
      && !this.isHomeStartupRefreshing
      && !this.isModeTransitioning
      && !this.homeListSwapAnimating
      && !this.searchOverlayVisible
      && !this.isHomeScrollInteracting
      && !this.homeLoadMoreInProgress
      && !this.pendingLoadMoreForMode(this.mode)
      && !this.hasRecentHomeScrollIntent()
      && currentOffset < HOME_MODE_RAIL_COLLAPSE_OFFSET
      && (!shouldApplyLengthGuard || this.featuredEntries.length <= HOME_MAX_CANDIDATE_LIMIT)
  }

  private scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void {
    this.runManagedTimeout(() => {
      if (this.postRefreshReloadVersion !== currentVersion) {
        return
      }

      if (!this.shouldRunFinalHomeReloadNow()) {
        if (attempt >= HOME_FINAL_RELOAD_IDLE_MAX_RETRIES) {
          void this.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
          return
        }
        this.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt + 1)
        return
      }

      void this.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
    }, attempt === 0 ? HOME_REFRESH_FINAL_RELOAD_DELAY_MS : HOME_FINAL_RELOAD_IDLE_RETRY_MS)
  }

  private scheduleHomeReloadAfterRefresh(): void {
    const currentVersion = this.postRefreshReloadVersion + 1
    this.postRefreshReloadVersion = currentVersion
    this.homePostRefreshReloadPending = true
    this.suppressFeedsChangedUntilMs = Date.now()
      + HOME_REFRESH_FINAL_RELOAD_DELAY_MS
      + HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS

    this.runManagedTimeout(() => {
      if (this.postRefreshReloadVersion !== currentVersion) {
        return
      }
      if (!this.shouldRunFinalHomeReloadNow()) {
        this.homePostRefreshReloadPending = false
        return
      }
      this.hasDeferredFeedsChangedReload = false
      void this.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, true, true).finally(() => {
        if (this.postRefreshReloadVersion === currentVersion) {
          this.homePostRefreshReloadPending = false
        }
      })
    }, HOME_REFRESH_FIRST_SWAP_DELAY_MS)
  }

  private resolveHomeCandidateLimit(minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(this.mode)) {
      return this.resolveHomeCandidateLimitForMode(this.mode, minimumLimit)
    }
    return Math.max(minimumLimit, this.homeCandidateLimit)
  }

  private shouldDisableHomePullRefresh(): boolean {
    return true
  }

  private shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean {
    return false
  }

  private candidateLimitForMode(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeCandidateLimitsByMode.social
      case 'pictures':
        return this.homeCandidateLimitsByMode.pictures
      case 'videos':
        return this.homeCandidateLimitsByMode.videos
      default:
        return this.homeCandidateLimitsByMode.articles
    }
  }

  private setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, limit)
    this.homeCandidateLimitsByMode = {
      articles: mode === 'articles' ? safeLimit : this.homeCandidateLimitsByMode.articles,
      social: mode === 'social' ? safeLimit : this.homeCandidateLimitsByMode.social,
      pictures: mode === 'pictures' ? safeLimit : this.homeCandidateLimitsByMode.pictures,
      videos: mode === 'videos' ? safeLimit : this.homeCandidateLimitsByMode.videos,
    }
    if (mode === this.mode) {
      this.homeCandidateLimit = safeLimit
    }
  }

  private resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return Math.max(HOME_FULL_MODE_CANDIDATE_LIMIT, minimumLimit)
    }
    return Math.max(minimumLimit, this.candidateLimitForMode(mode))
  }

  private markModeLoaded(mode: SubscriptionMode, loaded: boolean): void {
    this.homeModeLoaded = {
      articles: mode === 'articles' ? loaded : this.homeModeLoaded.articles,
      social: mode === 'social' ? loaded : this.homeModeLoaded.social,
      pictures: mode === 'pictures' ? loaded : this.homeModeLoaded.pictures,
      videos: mode === 'videos' ? loaded : this.homeModeLoaded.videos,
    }
  }

  private isModeLoaded(mode: SubscriptionMode): boolean {
    switch (mode) {
      case 'social':
        return this.homeModeLoaded.social
      case 'pictures':
        return this.homeModeLoaded.pictures
      case 'videos':
        return this.homeModeLoaded.videos
      default:
        return this.homeModeLoaded.articles
    }
  }

  private isModeLoading(mode: SubscriptionMode): boolean {
    switch (mode) {
      case 'social':
        return this.homeModeLoading.social
      case 'pictures':
        return this.homeModeLoading.pictures
      case 'videos':
        return this.homeModeLoading.videos
      default:
        return this.homeModeLoading.articles
    }
  }

  private setModeLoading(mode: SubscriptionMode, loading: boolean): void {
    this.homeModeLoading = {
      articles: mode === 'articles' ? loading : this.homeModeLoading.articles,
      social: mode === 'social' ? loading : this.homeModeLoading.social,
      pictures: mode === 'pictures' ? loading : this.homeModeLoading.pictures,
      videos: mode === 'videos' ? loading : this.homeModeLoading.videos,
    }
  }

  private visibleEntryLimitFor(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeVisibleEntryLimits.social
      case 'pictures':
        return this.homeVisibleEntryLimits.pictures
      case 'videos':
        return this.homeVisibleEntryLimits.videos
      default:
        return this.homeVisibleEntryLimits.articles
    }
  }

  private setVisibleEntryLimitFor(mode: SubscriptionMode, limit: number): void {
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    this.homeVisibleEntryLimits = {
      articles: mode === 'articles' ? safeLimit : this.homeVisibleEntryLimits.articles,
      social: mode === 'social' ? safeLimit : this.homeVisibleEntryLimits.social,
      pictures: mode === 'pictures' ? safeLimit : this.homeVisibleEntryLimits.pictures,
      videos: mode === 'videos' ? safeLimit : this.homeVisibleEntryLimits.videos,
    }
  }

  private totalEntryCountFor(mode: SubscriptionMode): number {
    return this.filteredEntriesFor(mode).length
  }

  private hasBufferedEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    return this.visibleEntryLimitFor(mode) < this.totalEntryCountFor(mode)
  }

  private visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    const entries = this.filteredEntriesFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return entries
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    return entries.slice(0, Math.min(entries.length, safeLimit))
  }

  private visibleEntryCountFor(mode: SubscriptionMode): number {
    const totalCount = this.totalEntryCountFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return totalCount
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    return Math.min(totalCount, safeLimit)
  }

  private expandVisibleEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const total = this.totalEntryCountFor(mode)
    const currentLimit = this.visibleEntryLimitFor(mode)
    if (currentLimit >= total) {
      return false
    }

    const nextLimit = Math.min(total, currentLimit + resolveHomeVisibleEntryLoadMoreStep(mode))
    this.setVisibleEntryLimitFor(mode, nextLimit)
    this.logHomeLoadMore(
      `expand-visible mode=${mode} currentLimit=${currentLimit} nextLimit=${nextLimit} total=${total}`,
    )
    return true
  }

  private syncHomePaginationFromReloadResult(entries: EntryCardModel[], candidateLimit: number): void {
    this.syncModePaginationFromReloadResult(this.mode, entries, candidateLimit)
  }

  private syncModePaginationFromReloadResult(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    candidateLimit: number,
  ): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, candidateLimit)
    const currentEntries = this.filteredEntriesFor(mode)
    const currentCount = currentEntries.length
    this.setCandidateLimitForMode(mode, safeLimit)
    if (entries.length >= safeLimit) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-full entries=${entries.length} limit=${safeLimit}`)
      return
    }

    if (entries.length > currentCount) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-growth entries=${entries.length} current=${currentCount} limit=${safeLimit}`)
      return
    }

    const visibleCount = this.visibleEntryCountFor(mode)
    const currentCandidateLimit = this.candidateLimitForMode(mode)
    const reachedCurrentBoundary = visibleCount >= currentCount && safeLimit > currentCandidateLimit
    if (currentCount > 0 && reachedCurrentBoundary) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-boundary visible=${visibleCount} current=${currentCount} limit=${safeLimit}`)
      return
    }

    this.setModeHasMoreEntries(mode, false, `sync-pagination-short entries=${entries.length} limit=${safeLimit}`)
    this.logHomeLoadMore(
      `stop-hasMore mode=${mode} entries=${entries.length} limit=${safeLimit} candidateLimit=${this.candidateLimitForMode(mode)}`,
    )
    if (!this.modeHasMoreEntries('articles')
      && !this.modeHasMoreEntries('social')
      && !this.modeHasMoreEntries('pictures')
      && !this.modeHasMoreEntries('videos')
    ) {
      this.setHomeHasMoreEntries(false, `all-modes-exhausted mode=${mode}`)
    }
  }

  private canLoadMoreForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    return this.isHomeRootTab()
      && mode === this.mode
      && (hasBufferedEntries || this.modeHasMoreEntries(mode))
      && !this.searchOverlayVisible
      && !this.normalizedSearchQuery()
      && !this.homeInitialLoadPending
      && !this.homeLoadMoreInProgress
      && (hasBufferedEntries || this.homeHasMoreEntries)
  }

  private logHomeLoadMore(message: string): void {
    if (!HOME_LOAD_MORE_DEBUG_ENABLED) {
      return
    }
    console.info(`${HOME_LOAD_MORE_DEBUG_PREFIX} ${message}`)
  }

  private logHomePerf(message: string): void {
    if (!HOME_PERF_DIAG_ENABLED) {
      return
    }
    const elapsed = this.homePerfSessionStartedAt > 0 ? Date.now() - this.homePerfSessionStartedAt : 0
    console.info(`${HOME_PERF_DIAG_PREFIX} sid=${this.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  private logHomeLoadState(message: string): void {
    if (!HOME_LOAD_STATE_DIAG_ENABLED) {
      return
    }
    const elapsed = this.homePerfSessionStartedAt > 0 ? Date.now() - this.homePerfSessionStartedAt : 0
    console.info(`${HOME_LOAD_STATE_DIAG_PREFIX} sid=${this.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  private setHomeHasMoreEntries(next: boolean, reason: string): void {
    if (this.homeHasMoreEntries === next) {
      return
    }

    const mode = this.mode
    const total = this.totalEntryCountFor(mode)
    const visible = this.visibleEntryCountFor(mode)
    this.homeHasMoreEntries = next
    if (!next) {
      this.homeHasMoreEntriesByMode = {
        articles: false,
        social: false,
        pictures: false,
        videos: false,
      }
    }
    this.logHomeLoadState(
      `hasMore=${next ? 'true' : 'false'} reason=${reason} mode=${mode} `
      + `candidateLimit=${this.homeCandidateLimit} featured=${this.featuredEntries.length} `
      + `visible=${visible}/${total} inProgress=${this.homeLoadMoreInProgress}`,
    )
  }

  private modeHasMoreEntries(mode: SubscriptionMode): boolean {
    switch (mode) {
      case 'social':
        return this.homeHasMoreEntriesByMode.social
      case 'pictures':
        return this.homeHasMoreEntriesByMode.pictures
      case 'videos':
        return this.homeHasMoreEntriesByMode.videos
      default:
        return this.homeHasMoreEntriesByMode.articles
    }
  }

  private setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void {
    const previous = this.modeHasMoreEntries(mode)
    if (previous === next) {
      return
    }
    this.homeHasMoreEntriesByMode = {
      articles: mode === 'articles' ? next : this.homeHasMoreEntriesByMode.articles,
      social: mode === 'social' ? next : this.homeHasMoreEntriesByMode.social,
      pictures: mode === 'pictures' ? next : this.homeHasMoreEntriesByMode.pictures,
      videos: mode === 'videos' ? next : this.homeHasMoreEntriesByMode.videos,
    }
    this.logHomeLoadState(
      `modeHasMore mode=${mode} next=${next ? 'true' : 'false'} reason=${reason} `
      + `globalHasMore=${this.homeHasMoreEntries} visible=${this.visibleEntryCountFor(mode)}/${this.totalEntryCountFor(mode)}`,
    )
    if (next) {
      this.setHomeHasMoreEntries(true, `mode-has-more mode=${mode}`)
    }
  }

  private modeNoProgressCount(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeModeNoProgressLoadMoreCount.social
      case 'pictures':
        return this.homeModeNoProgressLoadMoreCount.pictures
      case 'videos':
        return this.homeModeNoProgressLoadMoreCount.videos
      default:
        return this.homeModeNoProgressLoadMoreCount.articles
    }
  }

  private setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    const safeCount = Math.max(0, count)
    this.homeModeNoProgressLoadMoreCount = {
      articles: mode === 'articles' ? safeCount : this.homeModeNoProgressLoadMoreCount.articles,
      social: mode === 'social' ? safeCount : this.homeModeNoProgressLoadMoreCount.social,
      pictures: mode === 'pictures' ? safeCount : this.homeModeNoProgressLoadMoreCount.pictures,
      videos: mode === 'videos' ? safeCount : this.homeModeNoProgressLoadMoreCount.videos,
    }
  }

  private resetModeLoadMoreStates(reason: string): void {
    this.homeHasMoreEntriesByMode = {
      articles: true,
      social: true,
      pictures: true,
      videos: true,
    }
    this.homeModeNoProgressLoadMoreCount = {
      articles: 0,
      social: 0,
      pictures: 0,
      videos: 0,
    }
    this.logHomeLoadState(`mode loadMore state reset reason=${reason}`)
  }

  private loadMoreBlockedReason(mode: SubscriptionMode): string {
    const hasBufferedEntries = this.hasBufferedEntriesForMode(mode)
    if (!this.isHomeRootTab()) {
      return 'not-home-tab'
    }
    if (mode !== this.mode) {
      return 'inactive-mode'
    }
    if (this.searchOverlayVisible) {
      return 'search-overlay'
    }
    if (!!this.normalizedSearchQuery()) {
      return 'search-query-active'
    }
    if (this.homeInitialLoadPending) {
      return 'initial-load-pending'
    }
    if (this.homeLoadMoreInProgress) {
      return 'load-more-in-progress'
    }
    if (!hasBufferedEntries && !this.modeHasMoreEntries(mode)) {
      return 'mode-no-more'
    }
    if (!hasBufferedEntries && !this.homeHasMoreEntries) {
      return 'no-buffer-and-no-more'
    }
    if (!this.hasRecentHomeScrollIntent()) {
      return 'no-recent-scroll-intent'
    }
    return ''
  }

  private hasRecentHomeScrollIntent(): boolean {
    return Date.now() - this.lastHomeUserScrollAt <= HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS
  }

  private invalidateHomeLoadMorePrefetch(): void {
    this.homeLoadMorePrefetchToken += 1
    this.homeLoadMorePrefetchInProgress = false
    this.homeLoadMorePrefetchLimit = 0
    this.homeLoadMorePrefetchEntries = []
    this.homeLoadMorePrefetchMode = this.mode
  }

  private canPrefetchHomeLoadMore(): boolean {
    if (!HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED) {
      return false
    }
    return this.isComponentActive
      && this.isHomeRootTab()
      && !this.shouldRenderAllEntriesForMode(this.mode)
      && !this.searchOverlayVisible
      && !this.normalizedSearchQuery()
      && !this.isRefreshing
      && !this.isHomeStartupRefreshing
      && !this.homeInitialLoadPending
      && !this.homeLoadMoreInProgress
      && this.homeHasMoreEntries
      && this.modeHasMoreEntries(this.mode)
  }

  private scheduleHomeLoadMorePrefetch(delayMs: number = 220): void {
    this.runManagedTimeout(() => {
      void this.prefetchHomeLoadMore()
    }, delayMs)
  }

  private async prefetchHomeLoadMore(): Promise<void> {
    if (!this.canPrefetchHomeLoadMore()) {
      return
    }

    const mode = this.mode
    const currentLimit = this.candidateLimitForMode(mode)
    const targetLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentLimit + resolveHomeVisibleEntryLoadMoreStep(mode),
    )
    if (targetLimit <= currentLimit) {
      return
    }

    if (this.homeLoadMorePrefetchLimit >= targetLimit && this.homeLoadMorePrefetchEntries.length > 0) {
      return
    }

    if (this.homeLoadMorePrefetchInProgress) {
      return
    }

    this.homeLoadMorePrefetchInProgress = true
    const token = this.homeLoadMorePrefetchToken + 1
    this.homeLoadMorePrefetchToken = token
    this.logHomeLoadMore(
      `prefetch start mode=${mode} currentLimit=${currentLimit} targetLimit=${targetLimit}`,
    )

    try {
      const entries = await AppRepository.featuredEntriesByMode(mode, targetLimit)
      if (!this.isComponentActive || this.homeLoadMorePrefetchToken !== token) {
        return
      }

      this.homeLoadMorePrefetchLimit = targetLimit
      this.homeLoadMorePrefetchEntries = entries
      this.homeLoadMorePrefetchMode = mode
      this.logHomeLoadMore(
      `prefetch done mode=${mode} targetLimit=${targetLimit} entries=${entries.length}`,
      )
    } catch (_error) {
      this.logHomeLoadMore(`prefetch failed targetLimit=${targetLimit}`)
    } finally {
      if (this.homeLoadMorePrefetchToken === token) {
        this.homeLoadMorePrefetchInProgress = false
      }
    }
  }

  private consumePrefetchedHomeEntries(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    if (this.homeLoadMorePrefetchMode !== mode) {
      return undefined
    }
    if (this.homeLoadMorePrefetchLimit < nextLimit || this.homeLoadMorePrefetchEntries.length === 0) {
      return undefined
    }

    const entries = this.homeLoadMorePrefetchEntries
    this.homeLoadMorePrefetchLimit = 0
    this.homeLoadMorePrefetchEntries = []
    this.homeLoadMorePrefetchInProgress = false
    this.logHomeLoadMore(`consume-prefetch nextLimit=${nextLimit} entries=${entries.length}`)
    return entries
  }

  private shouldRetryLoadMoreBlockedReason(reason: string): boolean {
    return reason === 'load-more-in-progress' || reason === 'initial-load-pending'
  }

  private requestLoadMoreForMode(mode: SubscriptionMode): boolean {
    const blockedReason = this.loadMoreBlockedReason(mode)
    if (!!blockedReason || !this.canLoadMoreForMode(mode)) {
      this.logHomePerf(`loadMore skip mode=${mode} reason=${blockedReason || 'canLoadMore=false'}`)
      return !!blockedReason ? !this.shouldRetryLoadMoreBlockedReason(blockedReason) : true
    }

    const now = Date.now()
    if (this.lastHomeLoadMoreCompletedAt > 0 && now - this.lastHomeLoadMoreCompletedAt < HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS) {
      this.logHomePerf(`loadMore skip mode=${mode} reason=post-complete-cooldown`)
      return false
    }
    if (now - this.lastHomeLoadMoreRequestedAt < HOME_LOAD_MORE_MIN_INTERVAL_MS) {
      this.logHomePerf(`loadMore skip mode=${mode} reason=min-interval`)
      return false
    }
    this.lastHomeLoadMoreRequestedAt = now

    const expandedVisible = this.expandVisibleEntriesForMode(mode)
    const totalCount = this.totalEntryCountFor(mode)
    const visibleLimit = this.visibleEntryLimitFor(mode)
    const remainingBufferedCount = Math.max(0, totalCount - visibleLimit)
    const fetchAheadBufferThreshold = resolveHomeVisibleEntryLoadMoreStep(mode) * HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER
    if (expandedVisible && remainingBufferedCount > fetchAheadBufferThreshold) {
      return true
    }

    if (!this.homeHasMoreEntries) {
      return true
    }

    const previousTotal = this.featuredEntries.length
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

    this.homeLoadMoreInProgress = true
    const requestToken = this.homeLoadMoreRequestToken + 1
    this.homeLoadMoreRequestToken = requestToken
    const prefetchedEntries = this.consumePrefetchedHomeEntries(mode, nextLimit)
    const requestStartedAt = Date.now()
    this.logHomePerf(
      `loadMore start mode=${mode} nextLimit=${nextLimit} hasPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
    )
    this.logHomeLoadMore(
      `request start mode=${mode} prevTotal=${previousTotal} currentLimit=${currentModeLimit} nextLimit=${nextLimit}`,
    )

    const loadPromise = prefetchedEntries
      ? (async () => {
          this.syncModePaginationFromReloadResult(mode, prefetchedEntries, nextLimit)
          this.applyEntriesForMode(mode, prefetchedEntries, true)
        })()
      : this.appendFeaturedEntriesFromLocalFast(mode, nextLimit)

    void loadPromise
      .then(() => {
        if (this.homeLoadMoreRequestToken !== requestToken) {
          return
        }

        const currentTotal = this.featuredEntries.length
        const currentModeTotal = this.totalEntryCountFor(mode)
        const modeHasGrowth = currentModeTotal > previousModeTotal
        if (modeHasGrowth) {
          this.setModeNoProgressCount(mode, 0)
        } else if (!this.hasBufferedEntriesForMode(mode)) {
          const nextNoProgressCount = this.modeNoProgressCount(mode) + 1
          this.setModeNoProgressCount(mode, nextNoProgressCount)
        }
        if (this.candidateLimitForMode(mode) >= HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT) {
          this.setModeHasMoreEntries(mode, false, `candidate-limit-max mode=${mode} limit=${this.candidateLimitForMode(mode)}`)
        }

        if (expandedVisible && !this.hasBufferedEntriesForMode(mode)) {
          this.expandVisibleEntriesForMode(mode)
        }
        this.logHomeLoadMore(
          `request done mode=${mode} prevTotal=${previousTotal} currentTotal=${currentTotal} `
          + `prevModeTotal=${previousModeTotal} currentModeTotal=${currentModeTotal} `
          + `candidateLimit=${this.candidateLimitForMode(mode)} hasMore=${this.homeHasMoreEntries} `
          + `modeHasMore=${this.modeHasMoreEntries(mode)} noProgress=${this.modeNoProgressCount(mode)} `
          + `usedPrefetch=${prefetchedEntries ? 'true' : 'false'}`,
        )
      })
      .catch((error: Error | string | Object) => {
        this.logHomeLoadMore(`request failed mode=${mode} error=${this.describeError(error)}`)
        this.logHomeAsyncError(`load-more-request mode=${mode}`, error)
      })
      .finally(() => {
        if (this.homeLoadMoreRequestToken !== requestToken) {
          return
        }
        this.homeLoadMoreInProgress = false
        this.lastHomeLoadMoreCompletedAt = Date.now()
        this.scheduleHomeLoadMorePrefetch()
        this.logHomePerf(
          `loadMore done mode=${mode} elapsedMs=${Date.now() - requestStartedAt} total=${this.featuredEntries.length}`,
        )
        if (this.pendingLoadMoreForMode(mode)) {
          this.flushPendingLoadMoreForMode(mode)
        }
      })
    return true
  }

  private async appendFeaturedEntriesFromLocalFast(mode: SubscriptionMode, nextLimit: number): Promise<void> {
    const previousEntries = this.filteredEntriesFor(mode)
    const previousTotal = previousEntries.length
    const currentLimit = this.candidateLimitForMode(mode)
    const appendCount = Math.max(1, nextLimit - currentLimit)
    const nextPage = await AppRepository.featuredEntriesFastPageByMode(mode, appendCount, previousTotal)

    if (nextPage.length === 0) {
      this.setCandidateLimitForMode(mode, nextLimit)
      this.logHomeLoadMore(
        `append-fast-empty mode=${mode} prevTotal=${previousTotal} appendCount=${appendCount} nextLimit=${nextLimit}`,
      )
      const fallbackEntries = await AppRepository.featuredEntriesByMode(mode, nextLimit)
      this.syncModePaginationFromReloadResult(mode, fallbackEntries, nextLimit)
      if (fallbackEntries.length <= previousTotal) {
        this.setModeHasMoreEntries(
          mode,
          false,
          `append-empty-fallback prevTotal=${previousTotal} fallback=${fallbackEntries.length} nextLimit=${nextLimit}`,
        )
      }
      this.applyEntriesForMode(mode, fallbackEntries, true)
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
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      merged.push(entry)
    })

    const appendedUniqueCount = Math.max(0, merged.length - previousTotal)
    if (appendedUniqueCount === 0) {
      this.logHomeLoadMore(
        `append-no-unique prevTotal=${previousTotal} appendCount=${appendCount} nextPage=${nextPage.length} nextLimit=${nextLimit}`,
      )

      const fallbackEntries = await AppRepository.featuredEntriesByMode(mode, nextLimit)
      this.syncModePaginationFromReloadResult(mode, fallbackEntries, nextLimit)
      if (fallbackEntries.length <= previousTotal) {
        this.setModeHasMoreEntries(
          mode,
          false,
          `append-no-progress prevTotal=${previousTotal} fallback=${fallbackEntries.length} nextLimit=${nextLimit}`,
        )
      }
      this.applyEntriesForMode(mode, fallbackEntries, true)
      return
    }

    this.setCandidateLimitForMode(mode, nextLimit)
    if (mode === 'articles') {
      this.entryGroups = {
        articles: merged,
        social: this.entryGroups.social,
        pictures: this.entryGroups.pictures,
        videos: this.entryGroups.videos,
      }
      this.featuredEntries = this.mergeFeaturedEntriesFromGroups()
      this.markModeLoaded(mode, true)
      this.settleInitialHomeLoadState()
      this.schedulePersistHomeSnapshot(this.featuredEntries)
      this.notifyHomeEntryDataReloadedForMode(mode)
      return
    }
    this.applyEntriesForMode(mode, merged, true)
  }

  private setPendingLoadMoreForMode(mode: SubscriptionMode, pending: boolean): void {
    this.homePendingLoadMoreModes = {
      articles: mode === 'articles' ? pending : this.homePendingLoadMoreModes.articles,
      social: mode === 'social' ? pending : this.homePendingLoadMoreModes.social,
      pictures: mode === 'pictures' ? pending : this.homePendingLoadMoreModes.pictures,
      videos: mode === 'videos' ? pending : this.homePendingLoadMoreModes.videos,
    }
  }

  private pendingLoadMoreForMode(mode: SubscriptionMode): boolean {
    switch (mode) {
      case 'social':
        return this.homePendingLoadMoreModes.social
      case 'pictures':
        return this.homePendingLoadMoreModes.pictures
      case 'videos':
        return this.homePendingLoadMoreModes.videos
      default:
        return this.homePendingLoadMoreModes.articles
    }
  }

  private modeLoadMoreTimestampValue(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeLastItemAppearLoadMoreAt.social
      case 'pictures':
        return this.homeLastItemAppearLoadMoreAt.pictures
      case 'videos':
        return this.homeLastItemAppearLoadMoreAt.videos
      default:
        return this.homeLastItemAppearLoadMoreAt.articles
    }
  }

  private setModeLoadMoreTimestamp(mode: SubscriptionMode, value: number): void {
    this.homeLastItemAppearLoadMoreAt = {
      articles: mode === 'articles' ? value : this.homeLastItemAppearLoadMoreAt.articles,
      social: mode === 'social' ? value : this.homeLastItemAppearLoadMoreAt.social,
      pictures: mode === 'pictures' ? value : this.homeLastItemAppearLoadMoreAt.pictures,
      videos: mode === 'videos' ? value : this.homeLastItemAppearLoadMoreAt.videos,
    }
  }

  private modeScrollProgressLoadMoreValue(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeLastScrollProgressLoadMoreAt.social
      case 'pictures':
        return this.homeLastScrollProgressLoadMoreAt.pictures
      case 'videos':
        return this.homeLastScrollProgressLoadMoreAt.videos
      default:
        return this.homeLastScrollProgressLoadMoreAt.articles
    }
  }

  private setModeScrollProgressLoadMoreValue(mode: SubscriptionMode, value: number): void {
    this.homeLastScrollProgressLoadMoreAt = {
      articles: mode === 'articles' ? value : this.homeLastScrollProgressLoadMoreAt.articles,
      social: mode === 'social' ? value : this.homeLastScrollProgressLoadMoreAt.social,
      pictures: mode === 'pictures' ? value : this.homeLastScrollProgressLoadMoreAt.pictures,
      videos: mode === 'videos' ? value : this.homeLastScrollProgressLoadMoreAt.videos,
    }
  }

  private maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void {
    if (mode !== this.mode || !this.isHomeRootTab() || this.searchOverlayVisible || !!this.normalizedSearchQuery()) {
      return
    }
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return
    }
    if (this.homeInitialLoadPending || this.homeLoadMoreInProgress || this.pendingLoadMoreForMode(mode)) {
      return
    }
    const totalCount = this.totalEntryCountFor(mode)
    const visibleCount = this.visibleEntryCountFor(mode)
    const hasBufferedEntries = visibleCount < totalCount
    if (!hasBufferedEntries && (!this.homeHasMoreEntries || !this.modeHasMoreEntries(mode))) {
      return
    }
    if (!shouldPreloadHomeVisibleEntries(mode, currentOffset, totalCount, visibleCount)) {
      return
    }
    if (this.isHomeScrollInteracting && !this.hasRecentHomeScrollIntent()) {
      return
    }
    const scrollIntentVersion = this.modeScrollIntentVersion(mode)
    if (this.isHomeScrollInteracting && scrollIntentVersion <= this.consumedModeScrollIntentVersion(mode)) {
      return
    }

    const previousOffset = this.modeScrollProgressLoadMoreValue(mode)
    if (currentOffset <= previousOffset && visibleCount >= resolveHomeVisibleEntryLoadMoreStep(mode)) {
      return
    }

    this.setModeScrollProgressLoadMoreValue(mode, currentOffset)
    this.setConsumedModeScrollIntentVersion(mode, scrollIntentVersion)
    this.enqueueLoadMoreForMode(mode, 'scroll-progress')
  }

  private shouldAcceptItemAppearLoadMore(mode: SubscriptionMode): boolean {
    const now = Date.now()
    const previousAt = this.modeLoadMoreTimestampValue(mode)
    if (now - previousAt < HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS) {
      return false
    }
    this.setModeLoadMoreTimestamp(mode, now)
    return true
  }

  private enqueueLoadMoreForMode(mode: SubscriptionMode, source: string): void {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return
    }
    if (source === 'item-appear' && !this.shouldAcceptItemAppearLoadMore(mode)) {
      return
    }

    if (source === 'item-appear' && this.homeLoadMoreInProgress) {
      return
    }

    const alreadyPending = this.pendingLoadMoreForMode(mode)
    if (!alreadyPending) {
      this.setPendingLoadMoreForMode(mode, true)
      this.logHomePerf(`loadMore enqueue mode=${mode} source=${source} interacting=${this.isHomeScrollInteracting}`)
    }

    if (source === 'item-appear') {
      if (alreadyPending || this.homeLoadMoreInProgress) {
        return
      }
      this.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (source === 'scroll-progress') {
      if (alreadyPending || this.homeLoadMoreInProgress) {
        return
      }
      this.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS)
      return
    }
    if (!this.isHomeScrollInteracting) {
      this.flushPendingLoadMoreForMode(mode)
      return
    }
    if (source === 'footer-visible') {
      return
    }
  }

  private flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
    if (!this.pendingLoadMoreForMode(mode)) {
      return
    }
    // Avoid scheduling list growth while finger is dragging to reduce scroll hitching.
    if (this.isHomeScrollInteracting) {
      return
    }
    this.runManagedTimeout(() => {
      if (!this.pendingLoadMoreForMode(mode)) {
        return
      }
      const handled = this.requestLoadMoreForMode(mode)
      if (handled) {
        this.setPendingLoadMoreForMode(mode, false)
        return
      }
      this.runManagedTimeout(() => {
        this.flushPendingLoadMoreForMode(mode)
      }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
    }, HOME_LOAD_MORE_AFTER_STOP_DELAY_MS)
  }

  private shouldPrefetchLoadMoreAtIndex(visibleCount: number, index: number): boolean {
    if (visibleCount <= 0) {
      return false
    }
    const remainingVisibleCount = visibleCount - index - 1
    const dynamicThreshold = Math.max(
      HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT,
      Math.floor(visibleCount / HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR),
    )
    return remainingVisibleCount <= dynamicThreshold
  }

  private shouldEnableLoadMorePrefetchForMode(mode: SubscriptionMode): boolean {
    // Only arm prefetch after user initiates a real scroll gesture.
    return !this.shouldRenderAllEntriesForMode(mode) && this.hasRecentHomeScrollIntent()
  }

  private handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void {
    if (!HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED) {
      return
    }
    if (!this.shouldEnableLoadMorePrefetchForMode(mode)) {
      return
    }
    if (!this.shouldPrefetchLoadMoreAtIndex(totalCount, index)) {
      return
    }
    this.enqueueLoadMoreForMode(mode, 'item-appear')
  }

  private mergeFeaturedEntriesFromGroups(): EntryCardModel[] {
    const merged = [
      ...this.entryGroups.articles,
      ...this.entryGroups.social,
      ...this.entryGroups.pictures,
      ...this.entryGroups.videos,
    ]
    merged.sort((left: EntryCardModel, right: EntryCardModel) => (right.publishedAt || 0) - (left.publishedAt || 0))
    return merged
  }

  private applyEntriesForMode(mode: SubscriptionMode, entries: EntryCardModel[], deferredPersist: boolean, skipNotify: boolean = false, skipMerge: boolean = false): void {
    const scopedEntries = this.filterEntriesByMode(mode, entries)
    this.entryGroups = {
      articles: mode === 'articles' ? scopedEntries : this.entryGroups.articles,
      social: mode === 'social' ? scopedEntries : this.entryGroups.social,
      pictures: mode === 'pictures' ? scopedEntries : this.entryGroups.pictures,
      videos: mode === 'videos' ? scopedEntries : this.entryGroups.videos,
    }
    if (!skipMerge) {
      this.featuredEntries = this.mergeFeaturedEntriesFromGroups()
    }
    this.markModeLoaded(mode, true)
    this.settleInitialHomeLoadState()
    if (deferredPersist) {
      this.schedulePersistHomeSnapshot(this.featuredEntries)
    } else {
      this.persistHomeSnapshotNow()
    }
    if (!skipNotify) {
      this.notifyHomeEntryDataReloadedForMode(mode)
    }
  }

  private ensureModeEntriesLoaded(mode: SubscriptionMode): void {
    const hasModeEntries = this.totalEntryCountFor(mode) > 0
    const fullModeReady = !this.shouldRenderAllEntriesForMode(mode)
      || this.candidateLimitForMode(mode) >= HOME_FULL_MODE_CANDIDATE_LIMIT
    if (this.isModeLoaded(mode) && hasModeEntries && fullModeReady) {
      return
    }
    if (this.isModeLoading(mode) || this.homeLoadMoreInProgress) {
      return
    }
    this.setModeLoading(mode, true)
    const limit = this.resolveHomeCandidateLimitForMode(mode, HOME_MODE_SWITCH_CANDIDATE_LIMIT)
    void this.reloadFeaturedEntriesFromLocal(limit, false, true, true, mode)
      .catch((error: Error | string | Object) => {
        this.logHomeAsyncError(`ensure-mode-loaded mode=${mode}`, error)
      })
      .finally(() => {
        this.setModeLoading(mode, false)
      })
  }

  private precacheNonActiveModes(): void {
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

  private async reloadFeaturedEntriesFromLocal(
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

  private async reloadHomeEntriesFromLocal(
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
    return {
      id: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      imageUrl: entry.imageUrl,
      feedImageUrl: entry.feedImageUrl,
      author: entry.author,
      articleUrl: entry.articleUrl,
      publishedAt: entry.publishedAt,
      publishedLabel: entry.publishedLabel,
      readingLabel: entry.readingLabel,
      tags: [...entry.tags],
      mediaUrls: entry.mediaUrls ? [...entry.mediaUrls] : undefined,
      rawMediaUrls: entry.rawMediaUrls ? [...entry.rawMediaUrls] : undefined,
      feedTitle: entry.feedTitle,
      feedCategory: entry.feedCategory,
      viewLabel: entry.viewLabel,
      viewBadgeColor: entry.viewBadgeColor,
      hasVideoMedia: entry.hasVideoMedia,
      isRead: entry.isRead,
      isStarred: entry.isStarred,
    }
  }

  private schedulePersistHomeSnapshot(entries: EntryCardModel[]): void {
    if (entries.length === 0) {
      return
    }

    const snapshotEntries = entries.map((entry: EntryCardModel) => this.cloneHomeSnapshotEntry(entry))
    const persistVersion = this.homeSnapshotPersistVersion + 1
    this.homeSnapshotPersistVersion = persistVersion
    this.runManagedTimeout(() => {
      if (this.homeSnapshotPersistVersion !== persistVersion) {
        return
      }

      void AppRepository.persistHomeEntrySnapshot(snapshotEntries)
    }, 180)
  }

  private persistHomeSnapshotNow(): void {
    if (this.featuredEntries.length === 0) {
      return
    }

    const snapshotEntries = this.featuredEntries.map((entry: EntryCardModel) => this.cloneHomeSnapshotEntry(entry))
    void AppRepository.persistHomeEntrySnapshot(snapshotEntries)
  }

  private applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void {
    this.resetTweetPresentationCache()
    this.featuredEntries = nextEntries
    this.schedulePersistHomeSnapshot(nextEntries)
    this.settleInitialHomeLoadState()

    if (!deferredGrouping) {
      this.entryGroups = groupHomeEntriesByMode(nextEntries)
      this.logHomeGroupStats('applyHomeEntries immediate-group', nextEntries)
      this.notifyHomeEntryDataReloaded()
      return
    }

    const currentGroupVersion = this.homeEntryGroupVersion + 1
    this.homeEntryGroupVersion = currentGroupVersion
    this.runManagedTimeout(() => {
      if (this.homeEntryGroupVersion !== currentGroupVersion) {
        return
      }
      this.entryGroups = groupHomeEntriesByMode(nextEntries)
      this.logHomeGroupStats('applyHomeEntries deferred-group', nextEntries)
      this.notifyHomeEntryDataReloaded()
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
  }

  private applyHomeEntriesForAnimatedMode(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
    token: number,
  ): void {
    this.resetTweetPresentationCache()
    this.featuredEntries = nextEntries
    this.schedulePersistHomeSnapshot(nextEntries)
    const currentModeEntries = nextEntries.filter((entry: EntryCardModel) => this.resolveEntryMode(entry) === mode)
    this.entryGroups = {
      articles: mode === 'articles' ? currentModeEntries : this.entryGroups.articles,
      social: mode === 'social' ? currentModeEntries : this.entryGroups.social,
      pictures: mode === 'pictures' ? currentModeEntries : this.entryGroups.pictures,
      videos: mode === 'videos' ? currentModeEntries : this.entryGroups.videos,
    }
    this.notifyHomeEntryDataReloadedForMode(mode)
    this.logHomeGroupStats(`applyHomeEntriesForAnimatedMode mode=${mode} current-slice`, currentModeEntries)

    const currentGroupVersion = this.homeEntryGroupVersion + 1
    this.homeEntryGroupVersion = currentGroupVersion
    this.runManagedTimeout(() => {
      if (this.homeEntryGroupVersion !== currentGroupVersion || this.homeListSwapToken !== token) {
        return
      }

      const regrouped = groupHomeEntriesByMode(nextEntries)

      this.entryGroups = {
        articles: [...regrouped.articles],
        social: [...regrouped.social],
        pictures: [...regrouped.pictures],
        videos: [...regrouped.videos],
      }
      this.logHomeGroupStats(`applyHomeEntriesForAnimatedMode mode=${mode} regrouped`, nextEntries)
      this.notifyHomeEntryDataReloadedExcept(mode)
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
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
    if (!this.isComponentActive) {
      this.applyHomeEntries(nextEntries)
      return
    }

    if (this.homeListSwapAnimating || this.featuredEntries.length === 0) {
      this.applyHomeEntries(nextEntries)
      this.homeListSwapOpacity = 1
      this.homeListSwapTranslateY = 0
      this.homeListSwapScale = 1
      return
    }

    this.homeListSwapAnimating = true
    this.homeListSwapMode = mode
    const currentToken = this.homeListSwapToken + 1
    this.homeListSwapToken = currentToken

    // Apply refreshed data once, then play a gentle fade + slight settle on the current mode only.
    this.applyHomeEntries(nextEntries, false)

    if (!HOME_LIST_SWAP_ANIMATION_ENABLED) {
      this.homeListSwapOpacity = 1
      this.homeListSwapTranslateY = 0
      this.homeListSwapScale = 1
      this.homeListSwapAnimating = false
      return
    }

    this.homeListSwapOpacity = HOME_LIST_SWAP_ENTRY_MIN_OPACITY
    this.homeListSwapTranslateY = HOME_LIST_SWAP_ENTRY_OFFSET_Y
    this.homeListSwapScale = 1

    this.animateWithUiContext({
      duration: HOME_LIST_SWAP_ENTER_DURATION,
      curve: Curve.EaseOut,
      onFinish: () => {
        if (this.homeListSwapToken !== currentToken) {
          return
        }
        this.homeListSwapOpacity = 1
        this.homeListSwapTranslateY = 0
        this.homeListSwapScale = 1
        this.homeListSwapAnimating = false
      },
    }, () => {
      this.homeListSwapOpacity = 1
      this.homeListSwapTranslateY = 0
      this.homeListSwapScale = 1
    })
  }

  private modeListSwapOpacity(mode: SubscriptionMode): number {
    if (this.homeListSwapAnimating && mode === this.homeListSwapMode) {
      return this.homeListSwapOpacity
    }
    return 1
  }

  private modeListSwapTranslateY(mode: SubscriptionMode): number {
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
    if (entry.viewLabel === '图片' && entry.hasVideoMedia && (!entry.mediaUrls || entry.mediaUrls.length === 0)) {
      return 'videos'
    }
    switch (entry.viewLabel) {
      case '社交':
        return 'social'
      case '图片':
        return 'pictures'
      case '视频':
        return 'videos'
      default:
        return 'articles'
    }
  }

  private filterEntriesByMode(mode: SubscriptionMode, entries: EntryCardModel[]): EntryCardModel[] {
    return entries.filter((entry: EntryCardModel) => this.resolveEntryMode(entry) === mode)
  }

  private homeEntryRenderBaseKey(entry: EntryCardModel): string {
    const id = (entry.id || '').trim()
    const feedId = (entry.feedId || '').trim()
    const articleUrl = (entry.articleUrl || '').trim()
    const title = (entry.title || '').trim()
    const publishedAt = entry.publishedAt > 0 ? String(entry.publishedAt) : '0'
    return `${id}|${feedId}|${articleUrl}|${title}|${publishedAt}`
  }

  private homeEntryListRenderKey(entry: EntryCardModel, index: number): string {
    const readFlag = entry.isRead ? '1' : '0'
    return `${this.homeEntryRenderBaseKey(entry)}|${readFlag}|${index}`
  }

  private duplicateKeyCount(counter: Map<string, number>): number {
    let duplicateCount = 0
    counter.forEach((count: number) => {
      if (count > 1) {
        duplicateCount += count - 1
      }
    })
    return duplicateCount
  }

  private notifyHomeEntryDataReloaded(): void {
    this.homeEntryDataSources.articles.notifyDataReloaded()
    this.homeEntryDataSources.social.notifyDataReloaded()
    this.homeEntryDataSources.pictures.notifyDataReloaded()
    this.homeEntryDataSources.videos.notifyDataReloaded()
  }

  private notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void {
    this.homeEntryDataSourceFor(mode).notifyDataReloaded()
  }

  private notifyHomeEntryDataReloadedExcept(mode: SubscriptionMode): void {
    if (mode !== 'articles') {
      this.homeEntryDataSources.articles.notifyDataReloaded()
    }
    if (mode !== 'social') {
      this.homeEntryDataSources.social.notifyDataReloaded()
    }
    if (mode !== 'pictures') {
      this.homeEntryDataSources.pictures.notifyDataReloaded()
    }
    if (mode !== 'videos') {
      this.homeEntryDataSources.videos.notifyDataReloaded()
    }
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

  private pictureGalleryUrls(entry: EntryCardModel): string[] {
    return entry.mediaUrls ?? []
  }

  private pictureCaption(entry: EntryCardModel): string {
    const title = (entry.title || '').trim()
    if (title && title !== '远程条目') {
      return title
    }
    return (entry.summary || '').trim()
  }

  private pictureCardEntry(entry: EntryCardModel): Entry {
    return {
      id: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      url: entry.articleUrl,
      summary: entry.summary,
      content: '',
      author: entry.author,
      publishedAt: entry.publishedAt,
      readingTimeMinutes: 0,
      tags: entry.tags,
      mediaUrls: entry.rawMediaUrls ?? selectPictureCarouselMediaUrls(entry.mediaUrls ?? []),
      isRead: entry.isRead,
      isStarred: entry.isStarred,
      createdAt: entry.publishedAt,
      updatedAt: entry.publishedAt,
    }
  }

  private modeSceneVisible(mode: SubscriptionMode): Visibility {
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

  private modeSceneOpacity(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).opacity
  }

  private modeSceneOffset(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).offset
  }

  private modeSceneZIndex(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).zIndex
  }

  @Builder
  private EntryCard(entry: EntryCardModel) {
    HomeArticleEntryCard({
      entry,
      theme: this.theme,
      showUnreadDot: this.showUnreadDot,
      highlightQuery: this.searchQuery,
      onOpen: () => this.openEntry(entry),
    })
  }

  private clearAutoRefreshTimer(): void {
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

  private configureAutoRefreshTimer(): void {
    this.clearAutoRefreshTimer()
    if (!this.rootSettings.autoRefresh) {
      return
    }
    const intervalMs = this.autoRefreshIntervalMs()
    this.autoRefreshTimer = setInterval(() => {
      void this.refreshFeaturedEntries(false)
    }, intervalMs)
  }

  private isXSocialEntry(entry: EntryCardModel): boolean {
    const articleUrl = (entry.articleUrl || '').toLowerCase()
    const feedTitle = (entry.feedTitle || '').toLowerCase()
    return articleUrl.includes('x.com/')
      || articleUrl.includes('twitter.com/')
      || feedTitle.includes('x / twitter')
  }

  private isTweetLikeEntry(entry: EntryCardModel): boolean {
    if (this.isXSocialEntry(entry)) {
      return true
    }

    const articleUrl = (entry.articleUrl || '').toLowerCase()
    const feedTitle = (entry.feedTitle || '').toLowerCase()
    const author = (entry.author || '').toLowerCase()
    const title = (entry.title || '').toLowerCase()
    const summary = (entry.summary || '').toLowerCase()
    const content = (entry.content || '').toLowerCase()
    const combinedText = `${title}\n${summary}\n${content}`
    return articleUrl.includes('/status/')
      || articleUrl.includes('x.com/')
      || articleUrl.includes('twitter.com/')
      || articleUrl.includes('nitter.')
      || articleUrl.includes('/x/user/')
      || feedTitle.includes('twitter')
      || feedTitle.includes('x.com')
      || feedTitle.includes('nitter')
      || feedTitle.includes(' on x')
      || author.startsWith('@')
      || /(^|\s)rt\s+@[a-z0-9_]{1,15}\s*:/i.test(combinedText)
      || combinedText.includes('/twitter/user/')
      || combinedText.includes('/x/user/')
  }

  @Builder
  private SocialEntryCard(entry: EntryCardModel, index: number = 0) {
    if (this.isTweetLikeEntry(entry)) {
      TweetEntryCard({
        presentation: this.presentTweetEntry(entry),
        theme: this.theme,
        isUnread: !entry.isRead,
        flatMode: true,
        showBottomDivider: index < this.homeEntryCountFor('social') - 1,
        highlightQuery: this.searchQuery,
        collapsedTextLines: 7,
        enableEnterTransition: false,
        onOpen: () => this.openEntry(entry),
      })
    } else {
      this.EntryCard(entry)
    }
  }

  @Builder
  private HomeModeRail(options: HomeModeRailOptions = {}) {
    if (options.collapsed ?? false) {
      if (this.mode === 'articles') {
        ContentModeRail({
          mode: 'articles',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      } else if (this.mode === 'social') {
        ContentModeRail({
          mode: 'social',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      } else if (this.mode === 'pictures') {
        ContentModeRail({
          mode: 'pictures',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      } else {
        ContentModeRail({
          mode: 'videos',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      }
    } else {
      ContentModeRail({
        mode: this.mode,
        theme: this.theme,
        interactionLocked: this.isModeTransitioning,
        enableEnterTransition: false,
        collapsed: false,
        collapseProgress: options.collapseProgress ?? 0,
        onExpandRequest: () => {
          this.requestExpandedModeRail()
        },
        onChange: (mode: SubscriptionMode) => {
          this.requestModeSwitch(mode)
        },
      })
    }
  }

  private currentHomeModeScroller(): Scroller {
    return this.homeScrollerForMode(this.mode)
  }

  private requestExpandedModeRail(): void {
    this.closeHomeInlineSearch()
    this.homeModeRailExpandedLockOffset = this.readHomeModeScrollOffset(this.mode)
    this.homeModeRailExpandedOverride = true
    this.homeModeRailDismissedByScroll = false
    this.currentHomeModeScrollOffset = this.homeModeRailExpandedLockOffset
    this.updateHeaderBlurProgress(this.homeModeRailExpandedLockOffset)
  }

  private primeHomeModeRailForRootActivation(): void {
    this.homeModeRailExpandedOverride = false
    this.homeModeRailExpandedLockOffset = -1
    this.homeModeRailDismissedByScroll = false
    this.currentHomeModeScrollOffset = 0
    this.updateHeaderBlurProgress(0)
  }

  private homeFirstCardTopBoundary(): number {
    return HOME_MODE_SCENE_TOP_INSET - this.currentHomeModeScrollOffset
  }

  private homeModeRailTopBoundary(): number {
    return HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
  }

  private homeModeRailCollapseReady(): boolean {
    return this.homeFirstCardTopBoundary() <= this.homeModeRailTopBoundary()
  }

  private homeModeRailCollapseProgress(): number {
    if (this.homeModeRailExpandedOverride) {
      return 0
    }

    if (!this.homeModeRailCollapseReady()) {
      return 0
    }

    return this.homeModeRailDismissedByScroll ? 1 : 0
  }

  private isHomeModeRailCollapsed(): boolean {
    return this.homeModeRailCollapseProgress() >= 1
  }

  private resolvedHomeCollapsedModeRailTopAvoidArea(): number {
    return HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA
  }

  private homeCollapsedModeRailTopPadding(): number {
    return this.resolvedHomeCollapsedModeRailTopAvoidArea()
      + HOME_COLLAPSED_MODE_RAIL_TOP_PADDING
      + HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT
      - ROOT_MODE_RAIL_TOP_GAP
      + HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET
  }

  private homeModeRailRightInset(): number {
    return PAGE_HORIZONTAL_PADDING
      + HOME_INLINE_SEARCH_ACTION_SIZE * 2
      + HOME_INLINE_SEARCH_ACTION_GAP * 2
  }

  private homeModeRailLeftPadding(): number {
    return PAGE_HORIZONTAL_PADDING
  }

  private homeModeRailTopPadding(): number {
    const progress = this.homeModeRailCollapseProgress()
    const interpolatedTopPadding = HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
      + (this.homeCollapsedModeRailTopPadding() - HOME_MODE_CONTENT_TOP_SPACER_HEIGHT) * progress
    // Keep the collapsing rail below the "今日推荐" title area to avoid visual overlap while scrolling.
    return Math.max(HOME_MODE_CONTENT_TOP_SPACER_HEIGHT, interpolatedTopPadding)
  }

  private homeModeRailDismissTranslateY(): number {
    return -1 * HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL * this.homeModeRailCollapseProgress()
  }

  private homeModeRailDismissOpacity(): number {
    const progress = this.homeModeRailCollapseProgress()
    return Math.max(0, 1 - progress)
  }

  private homeModeRailDismissScale(): number {
    const progress = this.homeModeRailCollapseProgress()
    return 1 - (progress * 0.12)
  }

  @Builder
  private HomeCollapsingModeRailLayer() {
    Stack({ alignContent: Alignment.Top }) {
      Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
        Row()
          .width('100%')
          .height(0)

        Row() {
          this.HomeModeRail({
            collapsed: false,
            collapseProgress: this.homeModeRailCollapseProgress(),
          })
        }
          .width('100%')
          .justifyContent(FlexAlign.Start)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .align(Alignment.Top)
    }
    .width('100%')
    .padding({
      top: this.homeModeRailTopPadding(),
      left: this.homeModeRailLeftPadding(),
      right: PAGE_HORIZONTAL_PADDING,
    })
    .translate({ y: this.homeModeRailDismissTranslateY() })
    .opacity(this.homeModeRailDismissOpacity())
    .scale({ x: this.homeModeRailDismissScale(), y: this.homeModeRailDismissScale() })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
    .enabled(!this.isHomeModeRailCollapsed())
    .zIndex(100)
  }

  @Builder
  private HomeCollapsedModeRailLayer() {
    Row({ space: HOME_INLINE_SEARCH_ACTION_GAP }) {
      this.HomeModeRail({
        collapsed: true,
        collapseProgress: this.homeModeRailCollapseProgress(),
      })
    }
    .width('100%')
    .justifyContent(FlexAlign.End)
    .alignItems(VerticalAlign.Top)
    .padding({
      top: this.homeCollapsedModeRailTopPadding(),
      left: PAGE_HORIZONTAL_PADDING,
      right: this.homeModeRailRightInset(),
    })
    .opacity(this.showSearch ? 0 : this.homeModeRailCollapseProgress())
    .translate({
      x: this.showSearch ? 10 : 0,
      y: (1 - this.homeModeRailCollapseProgress()) * 14,
    })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
    .enabled(this.isHomeModeRailCollapsed() && !this.showSearch)
    .zIndex(132)
  }

  @Builder
  private HomeRefreshGapSlot(mode: SubscriptionMode) {
    Column()
    .width('100%')
    .height(this.homeRefreshGapHeight(mode))
    .animation({ duration: 180, curve: Curve.EaseOut })
  }

  @Builder
  private HomeRefreshIndicatorLayer() {
    if (this.shouldShowHomeRefreshIndicator(this.mode)) {
      Column() {
        LoadingProgress()
          .width(HOME_REFRESH_INDICATOR_SIZE)
          .height(HOME_REFRESH_INDICATOR_SIZE)
          .margin({ bottom: HOME_REFRESH_INDICATOR_BOTTOM_MARGIN })
          .color(this.theme.accent)
      }
      .opacity(this.homeRefreshIndicatorOpacity())
      .scale({
        x: this.homeRefreshIndicatorScale(),
        y: this.homeRefreshIndicatorScale(),
      })
      .translate({ y: this.homeRefreshIndicatorTranslateY() })
      .animation({ duration: 160, curve: Curve.EaseOut })
      .width('100%')
      .alignItems(HorizontalAlign.Center)
      .padding({ top: HOME_MODE_SCENE_TOP_INSET })
      .align(Alignment.Top)
      .zIndex(-1)
    }
  }

  @Builder
  private EntryList(mode: SubscriptionMode) {
    List({ space: mode === 'social' ? 0 : HOME_MODE_CONTENT_GAP, scroller: this.homeScrollerForMode(mode) }) {
      ListItem() {
        Column() {
          Blank()
            .height(HOME_MODE_SCENE_TOP_INSET)

          this.HomeRefreshGapSlot(mode)
        }
        .width('100%')
      }
      .width('100%')

      if (this.totalEntryCountFor(mode) === 0) {
        ListItem() {
          Column({ space: 0 }) {
            if (this.homeEmptyStateTopGap(mode) > 0) {
              Blank().height(this.homeEmptyStateTopGap(mode))
            }

            if (this.homeInitialLoadPending || this.isHomeStartupRefreshing || this.isModeLoading(mode)) {
              this.HomeModeLoadingState()
            } else {
              this.HomeModeStatusCard(this.homeEmptyStateTitle(), false)
            }
          }
          .width('100%')
        }
        .width('100%')
      } else {
        ForEach(this.visibleEntriesFor(mode), (entry: EntryCardModel, index: number) => {
          ListItem() {
            if (mode === 'social') {
              this.SocialEntryCard(entry, index)
            } else {
              this.EntryCard(entry)
            }
          }
          .width('100%')
        }, (entry: EntryCardModel, index: number) => this.homeEntryListRenderKey(entry, index))
      }

      ListItem() {
        Row().height(100).width('100%')
      }

    }
    .width('100%')
    .height('100%')
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
      this.markHomeUserScrollIntent(mode, scrollSource)
      return this.consumeHomePullScroll(mode, scrollOffset)
    })
    .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
      this.syncHomeModeRailState(mode)
      this.flushPendingLoadMoreForMode(mode)
    })
    .onDidStopDragging((_willFling: boolean) => {
      this.setHomeScrollInteracting(false, mode)
      this.flushPendingLoadMoreForMode(mode)
      this.finalizeHomePullRefresh()
    })
  }

  @Builder
  private PictureEntryList() {
    List({ space: 0, scroller: this.picturesScroller }) {
      ListItem() {
        Column() {
          Blank()
            .height(HOME_MODE_SCENE_TOP_INSET)

          this.HomeRefreshGapSlot('pictures')
        }
        .width('100%')
      }
      .width('100%')

      if (this.totalEntryCountFor('pictures') === 0) {
        ListItem() {
          Column({ space: 0 }) {
            if (this.homeInitialLoadPending || this.isHomeStartupRefreshing || this.isModeLoading('pictures')) {
              this.HomeModeLoadingState()
            } else {
              this.HomeModeStatusCard(this.homeEmptyStateTitle(), false)
            }
          }
          .width('100%')
        }
        .width('100%')
      } else {
        ForEach(this.visibleEntriesFor('pictures'), (entry: EntryCardModel, index: number) => {
          ListItem() {
            PictureEntryCard({
              entry: this.pictureCardEntry(entry),
              index,
              authorLabel: entry.author || entry.feedTitle,
              feedImageUrl: entry.feedImageUrl,
              caption: this.pictureCaption(entry),
              pictureUrl: entry.imageUrl,
              galleryUrls: this.pictureGalleryUrls(entry),
              theme: this.theme,
              highlightQuery: this.searchQuery,
              enableEnterTransition: false,
              flatMode: true,
              showBottomDivider: index < this.homeEntryCountFor('pictures') - 1,
              onOpen: () => this.openEntry(entry),
            })
          }
          .width('100%')
        }, (entry: EntryCardModel) => entry.id)
      }

      ListItem() {
        Row().height(100).width('100%')
      }

    }
    .width('100%')
    .height('100%')
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring)
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
      this.markHomeUserScrollIntent('pictures', scrollSource)
      return this.consumeHomePullScroll('pictures', scrollOffset)
    })
    .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
      this.syncHomeModeRailState('pictures')
      this.flushPendingLoadMoreForMode('pictures')
    })
    .onDidStopDragging((_willFling: boolean) => {
      this.setHomeScrollInteracting(false, 'pictures')
      this.flushPendingLoadMoreForMode('pictures')
      this.finalizeHomePullRefresh()
    })
  }

  @Builder
  private ModeEntriesScene(mode: SubscriptionMode) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        if (resolveHomeVideoSceneKind(mode) === 'grid') {
          Scroll(this.homeScrollerForMode(mode)) {
            Column({ space: HOME_MODE_CONTENT_GAP }) {
              Column() {
                Blank()
                  .height(HOME_MODE_SCENE_TOP_INSET)

                this.HomeRefreshGapSlot(mode)
              }
              .width('100%')

              HomeVideoGrid({
                entries: this.visibleEntriesFor(mode),
                highlightQuery: this.searchQuery,
                inheritedTheme: this.theme,
                isLoading: this.isModeLoading(mode) || this.homeInitialLoadPending || this.isHomeStartupRefreshing,
                onOpenEntry: (entry: EntryCardModel) => {
                  this.openEntry(entry)
                },
              })

              Row()
                .width('100%')
                .height(100)

            }
            .width('100%')
            .constraintSize({ minHeight: '100%' })
            .alignItems(HorizontalAlign.Start)
            .justifyContent(FlexAlign.Start)
            .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 100 })
          }
          .width('100%')
          .height('100%')
          .scrollBar(BarState.On)
          .edgeEffect(EdgeEffect.Spring)
          .onWillScroll((_xOffset: number, yOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
            this.markHomeUserScrollIntent(mode, scrollSource)
            return this.consumeHomePullScrollOffset(mode, yOffset)
          })
            .onDidScroll((_xOffset: number, _yOffset: number, _scrollState: ScrollState) => {
            this.syncHomeModeRailState(mode)
            this.flushPendingLoadMoreForMode(mode)
          })
          .onDidStopDragging((_willFling: boolean) => {
            this.setHomeScrollInteracting(false, mode)
            this.flushPendingLoadMoreForMode(mode)
            this.finalizeHomePullRefresh()
          })
        } else if (mode === 'pictures') {
          this.PictureEntryList()
        } else {
          this.EntryList(mode)
        }
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height('100%')
    .visibility(this.modeSceneVisible(mode))
    .opacity(this.homeListSwapAnimating && mode === this.homeListSwapMode
      ? this.homeListSwapOpacity
      : this.modeSceneOpacity(mode))
    .translate({
      x: this.modeSceneOffset(mode),
      y: this.modeListSwapTranslateY(mode),
    })
    .zIndex(this.modeSceneZIndex(mode))
  }

  @Builder
  private HomeRootPage() {
    // Build all mode scenes up front so first-time switches stay warm.
    Stack({ alignContent: Alignment.TopStart }) {
      this.HomeRefreshIndicatorLayer()

      this.ModeEntriesScene('articles')
      this.ModeEntriesScene('social')
      this.ModeEntriesScene('pictures')
      this.ModeEntriesScene('videos')
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onAppear(() => {
      console.info('首页显示')
    })
    .gesture(
      PanGesture({ direction: PanDirection.Horizontal })
        .onActionEnd((event: GestureEvent) => {
          this.handleModeSwipe(event)
        })
    )
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
    return shouldHideRootBottomBar(this.currentRootTabId(), {
      discoverHasForegroundOverlay: this.discoverHasForegroundOverlay,
      subscriptionsOverlayLevel: this.subscriptionsOverlayLevel,
      settingsOverlayLevel: this.settingsOverlayLevel,
    })
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      HdsNavigation() {
        HdsTabs({ controller: this.rootTabsController }) {
          ForEach(resolveHdsBottomTabItems(), (item: HdsBottomTabItem) => {
            TabContent() {
              Stack() {
                if (item.id === 'home') {
                  this.HomeRootPage()
                } else if (item.id === 'subscriptions') {
                  SubscriptionsContent({
                    showBottomTabs: false,
                    inheritedTheme: this.theme,
                  })
                } else if (item.id === 'discover') {
                  DiscoverContent({
                    showBottomTabs: false,
                    reserveBottomTabInset: true,
                    inheritedTheme: this.theme,
                  })
                } else {
                  SettingsContent({
                    showBottomTabs: false,
                    inheritedTheme: this.theme,
                    inheritedSettings: this.rootSettings,
                    onContentScrollerReady: (scroller: Scroller) => {
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
                }
              }
              .width('100%')
              .height('100%')
              .onAppear(() => {
                this.confirmRootTabSelection(item.id as RootTabId)
              })
            }
            .tabBar(BottomTabBarStyle.of({
              normal: this.rootTabSymbolPair(item.id).normal,
              selected: this.rootTabSymbolPair(item.id).selected,
            }, item.label))
          }, (item: HdsBottomTabItem) => item.id)
        }
        .vertical(false)
        .scrollable(false)
        .cachedMaxCount(4, TabsCacheMode.CACHE_BOTH_SIDE)
        .animationDuration(0)
        .barPosition(BarPosition.End)
        .barOverlap(true)
        .barHeight(this.shouldHideBottomTabs() ? 0 : BOTTOM_TAB_BAR_HEIGHT)
        .barFloatingStyle({
          barBottomMargin: resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP),
          systemMaterialEffect: {
            materialType: hdsMaterial.MaterialType.ADAPTIVE,
            materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
          },
        })
        .onChange((index: number) => {
          this.handleRootTabChange(index)
        })
      }
      .mode(NavigationMode.Stack)
      .titleBar({
        content: {
          title: {
            mainTitle: this.isHomeRootTab() || this.isSettingsRootTab() ? '' : this.currentRootTitle(),
          },
          bottomBuilder: this.isHomeRootTab()
            ? {
                builder: (): void => this.HomeRootLowerTitleBuilder(),
              }
            : this.isSettingsRootTab()
            ? {
                builder: (): void => this.SettingsRootLowerTitleBuilder(),
              }
            : undefined,
        },
        style: {
          scrollEffectOpts: {
            enableScrollEffect: true,
            scrollEffectType: this.currentRootScrollEffectType(),
            blurEffectiveStartOffset: LengthMetrics.vp(0),
            blurEffectiveEndOffset: this.currentRootBlurEffectiveEndOffset(),
          },
          blurStrategy: this.currentRootBlurStrategy(),
          originalStyle: {
            backgroundStyle: {
              backgroundColor: this.currentRootOriginalTitleBarBackgroundColor(),
              maskExtraHeight: this.currentRootOriginalTitleBarMaskExtraHeight(),
              blurRadius: this.currentRootOriginalTitleBarBlurRadius(),
            },
            contentStyle: {
              titleStyle: {
                mainTitleColor: $r('sys.color.font_primary'),
                subTitleColor: $r('sys.color.font_secondary'),
              },
              menuStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
              backIconStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
            },
          },
          scrollEffectStyle: {
            backgroundStyle: {
              backgroundColor: this.currentRootScrollEffectBackgroundColor(),
              maskExtraHeight: this.currentRootScrollEffectTitleBarMaskExtraHeight(),
              blurRadius: this.currentRootScrollEffectTitleBarBlurRadius(),
            },
            contentStyle: {
              titleStyle: {
                mainTitleColor: $r('sys.color.font_primary'),
                subTitleColor: $r('sys.color.font_secondary'),
              },
              menuStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
              backIconStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
            },
          },
          systemMaterialEffect: this.currentRootSystemMaterialEffect(),
        },
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideTitleBar(this.shouldHideRootTitleBar())
      .hideBackButton(true)
      .bindToScrollable(this.currentRootBindScrollers())
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
      .width('100%')
      .height('100%')

      if (this.isHomeRootTab()) {
        this.HomeCollapsingModeRailLayer()
      }

      if (this.isHomeRootTab()) {
        this.HomeCollapsedModeRailLayer()
      }

      if (this.isHomeRootTab()) {
        HomeInlineSearchOverlay({
          visible: this.searchOverlayVisible,
          showSearch: this.showSearch,
          query: this.searchQuery,
          placeholder: this.rootSettings.searchAllHomeCategories ? '搜索全部内容' : `搜索「${resolveHomeModeTitle(this.mode)}」`,
          topPadding: this.homeCollapsedModeRailTopPadding(),
          horizontalPadding: PAGE_HORIZONTAL_PADDING,
          searchFieldOffsetY: this.homeInlineSearchVerticalOffset(),
          isRefreshing: this.isRefreshing,
          refreshTotalCount: this.refreshTotalCount,
          displayRefreshPercent: this.displayRefreshPercent,
          theme: this.theme,
          resultEntries: this.searchResultEntries(),
          showEmptyState: this.hasSearchResultEmptyState(),
          inputController: this.searchInputController,
          onQueryChange: (value: string) => {
            this.searchQuery = value
          },
          onClose: (clearQuery: boolean) => {
            this.closeHomeInlineSearch(clearQuery)
          },
          onOpen: () => {
            this.openHomeInlineSearch()
          },
          onRefresh: () => {
            void this.refreshFeaturedEntries()
          },
          onEntryClick: (entry: EntryCardModel) => {
            this.openEntry(entry)
            this.closeHomeInlineSearch(true)
          },
          onInputAppear: () => {
            this.focusHomeInlineSearch()
          },
          summaryTextForEntry: (entry: EntryCardModel) => this.searchResultSummaryText(entry),
        })
      }

    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  onBackPress(): boolean {
    if (this.isHomeRootTab() && this.searchOverlayVisible) {
      this.closeHomeInlineSearch(true)
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
