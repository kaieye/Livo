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
import { getRequestedRootTabId, openArticleDetail, RootTabId, rootTabIndexForId } from '../common/navigation/AppRouter'
import {
  ROOT_MODE_RAIL_TOP_GAP,
} from '../common/components/FloatingRootPageLayout'
import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  EntryCardModel,
  HarmonySettings,
  articleDetailModelFromCard,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { createEmptyHomeEntryGroups, groupHomeEntriesByMode, HomeEntryGroups } from '../common/utils/HomeEntryGroups'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryLoadMoreStep,
  shouldPreloadHomeVisibleEntries,
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
  resolveHdsBottomTabItems,
} from '../common/utils/HdsBottomTabConfig'
import {
  rootBlurEffectiveEndOffset,
  rootBlurStrategy,
  rootOriginalTitleBarBlurRadius,
  rootScrollEffectTitleBarBlurRadius,
  rootScrollEffectType,
  rootSystemMaterialEffect,
  rootTabSymbolPair,
  rootTitleBarMaskExtraHeight,
  rootTitleFor,
  rootTransparentBackgroundColor,
} from '../common/utils/IndexRootChrome'
import { shouldRefreshThemeOnSystemColorModeChange } from '../common/utils/ThemeRefresh'
import { resolveSystemBarStyle } from '../common/utils/SystemBarStyle'
import { RefreshStateManager } from '../common/utils/RefreshStateManager'
import { shouldHideRootBottomBar, shouldHideRootTitleBar } from '../common/utils/RootTabVisibilityPolicy'
import { resolveModeSceneRenderState } from '../common/utils/ModeSceneTransition'
import {
  IndexHomeEntryDataDelegate,
  IndexHomeInlineSearchDelegate,
  IndexHomeModeDelegate,
} from '../common/utils/IndexHomeDelegates'
import {
  createHomeCandidateLimitMap,
  createHomeLoadedMap,
  createHomeLoadingMap,
  createHomeLoadMoreTimestampMap,
  createHomeModeBooleanMap,
  createHomeNoProgressCountMap,
  createHomePendingLoadMoreMap,
  createHomeScrollOffsetMap,
  createHomeVisibleEntryLimitMap,
  homeCandidateLimitValue,
  homeLoadMoreTimestampValue,
  homeModeBooleanValue,
  homeModeLoadedValue,
  homeModeLoadingValue,
  homeModeNumberValue,
  homeModePendingLoadMoreValue,
  homeNoProgressCountValue,
  homeVisibleEntryLimitValue,
  pictureCaption,
  pictureCardEntry,
  pictureGalleryUrls,
  withHomeCandidateLimitValue,
  withHomeLoadedValue,
  withHomeLoadingValue,
  withHomeLoadMoreTimestampValue,
  withHomeModeBooleanValue,
  withHomeModeNumberValue,
  withHomeNoProgressCountValue,
  withHomePendingLoadMoreValue,
  withHomeVisibleEntryLimitValue,
} from '../common/utils/IndexHomeStateFactory'
import { createIndexHomeRootContentCallbacks } from '../common/utils/IndexHomeRootContentCallbacksFactory'
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
  HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS,
  HOME_REFRESH_FINAL_RELOAD_DELAY_MS,
  HOME_REFRESH_FIRST_SWAP_DELAY_MS,
  HOME_REFRESH_PERCENT_COALESCE_MS,
  HOME_REFRESH_PROGRESS_UI_THROTTLE_MS,
  HOME_STARTUP_REFRESH_COOLDOWN_MS,
  MODE_SWIPE_TRIGGER_OFFSET,
  SUBSCRIPTION_MODES,
  HomeEntryDataSourceMap,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeLoadMoreTimestampMap,
  HomeModeNoProgressCountMap,
  HomeModePendingLoadMoreMap,
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
  private readonly homeModeScrollOffsets: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  readonly homeEntryDataSources: HomeEntryDataSourceMap = {
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
  private postRefreshReloadVersion: number = 0
  private homePostRefreshReloadPending: boolean = false
  private feedsChangedReloadVersion: number = 0
  private hasDeferredFeedsChangedReload: boolean = false
  private deferredFeedsChangedRetryToken: number = 0
  private suppressFeedsChangedUntilMs: number = 0
  homeListSwapToken: number = 0
  private lastRefreshProgressUiUpdateAt: number = 0
  isComponentActive: boolean = false
  private hasLoadedInitialData: boolean = false
  private initialFeedCount: number = 0
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
  private homePendingLoadMoreModes: HomeModePendingLoadMoreMap = createHomePendingLoadMoreMap()
  private homeLastItemAppearLoadMoreAt: HomeModeLoadMoreTimestampMap = createHomeLoadMoreTimestampMap()
  private homeLastScrollProgressLoadMoreAt: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private homeModeScrollIntentVersions: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private homeModeConsumedScrollIntentVersions: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap = createHomeNoProgressCountMap()
  private homeModeLoaded: HomeModeLoadedMap = createHomeLoadedMap()
  private homeModeLoading: HomeModeLoadingMap = createHomeLoadingMap()
  private lastHomeLoadMoreCompletedAt: number = 0
  private lastHomeRefreshFinishedAt: number = 0
  private homePerfSessionId: number = 0
  private homePerfSessionStartedAt: number = 0
  private readonly tweetPresentationCache: Map<string, TweetEntryPresentation> = new Map()
  private readonly homeModeController: HomeModeController = new HomeModeController(this.createHomeModeDelegate())
  private readonly homeEntryDataManager: HomeEntryDataManager = new HomeEntryDataManager(this.createHomeEntryDataDelegate())
  private readonly homeInlineSearchController: HomeInlineSearchController = new HomeInlineSearchController(
    this.createHomeInlineSearchDelegate(),
  )
  private lastHandledRequestedRootTabId: RootTabId | '' = ''

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

  runManagedTimeout(callback: () => void, delayMs: number): void {
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
    return describeError(error)
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

  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {
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

  private homeModeScrollOffsetFor(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeModeScrollOffsets)
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

  readHomeModeScrollOffset(mode: SubscriptionMode): number {
    try {
      return Math.max(0, this.homeScrollerForMode(mode).currentOffset().yOffset)
    } catch (_) {
      return this.homeModeScrollOffsetFor(mode)
    }
  }

  syncHomeModeRailState(mode: SubscriptionMode = this.mode): void {
    const previousOffset = this.currentHomeModeScrollOffset
    const nextOffset = this.readHomeModeScrollOffset(mode)
    this.updateHomeModeScrollOffset(mode, nextOffset)
    if (mode !== this.mode) {
      return
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

  private modeScrollIntentVersion(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeModeScrollIntentVersions)
  }

  private consumedModeScrollIntentVersion(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeModeConsumedScrollIntentVersions)
  }

  private setModeScrollIntentVersion(mode: SubscriptionMode, value: number): void {
    this.homeModeScrollIntentVersions = withHomeModeNumberValue(mode, value, this.homeModeScrollIntentVersions)
  }

  private setConsumedModeScrollIntentVersion(mode: SubscriptionMode, value: number): void {
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
    this.setModeScrollProgressLoadMoreValue(mode, 0)
  }

  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode = this.mode): void {
    if (interacting) {
      this.lastHomeUserScrollAt = Date.now()
    }

    this.isHomeScrollInteracting = interacting
  }

  private currentRootTitle(): string {
    return rootTitleFor(this.currentRootTabId())
  }

  currentSearchEntries(): EntryCardModel[] {
    if (this.rootSettings.searchAllHomeCategories) {
      return this.featuredEntries
    }

    return this.filteredEntriesFor(this.mode)
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

  private homeInlineSearchVerticalOffset(): number {
    return this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL
  }

  isHomeRootTab(): boolean {
    return this.currentRootTabId() === 'home'
  }

  private shouldHideRootTitleBar(): boolean {
    return shouldHideRootTitleBar(this.currentRootTabId())
  }

  private currentRootScrollEffectType(): ScrollEffectType {
    return rootScrollEffectType()
  }

  private isSettingsRootTab(): boolean {
    return this.currentRootTabId() === 'settings'
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
    return rootTabSymbolPair(tabId)
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
    this.homeInlineSearchController.logFocusDebug('root-tab-change', `nextTab=${tabId}`)
    if (previousTabId === 'discover' && tabId !== 'discover') {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
      AppStorage.setOrCreate('discoverOverlayLevel', 0)
      AppStorage.setOrCreate('discoverNavigationResetAt', Date.now())
    }
    if (tabId !== 'home') {
      this.homeInlineSearchController.close(true)
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

  currentRootTabId(): RootTabId {
    return this.activeRootTabId
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

  private shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean {
    return false
  }

  private candidateLimitForMode(mode: SubscriptionMode): number {
    return homeCandidateLimitValue(mode, this.homeCandidateLimitsByMode)
  }

  private setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, limit)
    this.homeCandidateLimitsByMode = withHomeCandidateLimitValue(mode, safeLimit, this.homeCandidateLimitsByMode)
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

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void {
    this.homeModeLoaded = withHomeLoadedValue(mode, loaded, this.homeModeLoaded)
  }

  private isModeLoaded(mode: SubscriptionMode): boolean {
    return homeModeLoadedValue(mode, this.homeModeLoaded)
  }

  isModeLoading(mode: SubscriptionMode): boolean {
    return homeModeLoadingValue(mode, this.homeModeLoading)
  }

  private setModeLoading(mode: SubscriptionMode, loading: boolean): void {
    this.homeModeLoading = withHomeLoadingValue(mode, loading, this.homeModeLoading)
  }

  private visibleEntryLimitFor(mode: SubscriptionMode): number {
    return homeVisibleEntryLimitValue(mode, this.homeVisibleEntryLimits)
  }

  private setVisibleEntryLimitFor(mode: SubscriptionMode, limit: number): void {
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    this.homeVisibleEntryLimits = withHomeVisibleEntryLimitValue(mode, safeLimit, this.homeVisibleEntryLimits)
  }

  totalEntryCountFor(mode: SubscriptionMode): number {
    return this.filteredEntriesFor(mode).length
  }

  private hasBufferedEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    return this.visibleEntryLimitFor(mode) < this.totalEntryCountFor(mode)
  }

  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
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
      && !this.homeInlineSearchController.normalizedQuery()
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
      this.homeHasMoreEntriesByMode = createHomeModeBooleanMap(false)
    }
    this.logHomeLoadState(
      `hasMore=${next ? 'true' : 'false'} reason=${reason} mode=${mode} `
      + `candidateLimit=${this.homeCandidateLimit} featured=${this.featuredEntries.length} `
      + `visible=${visible}/${total} inProgress=${this.homeLoadMoreInProgress}`,
    )
  }

  private modeHasMoreEntries(mode: SubscriptionMode): boolean {
    return homeModeBooleanValue(mode, this.homeHasMoreEntriesByMode)
  }

  private setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void {
    const previous = this.modeHasMoreEntries(mode)
    if (previous === next) {
      return
    }
    this.homeHasMoreEntriesByMode = withHomeModeBooleanValue(mode, next, this.homeHasMoreEntriesByMode)
    this.logHomeLoadState(
      `modeHasMore mode=${mode} next=${next ? 'true' : 'false'} reason=${reason} `
      + `globalHasMore=${this.homeHasMoreEntries} visible=${this.visibleEntryCountFor(mode)}/${this.totalEntryCountFor(mode)}`,
    )
    if (next) {
      this.setHomeHasMoreEntries(true, `mode-has-more mode=${mode}`)
    }
  }

  private modeNoProgressCount(mode: SubscriptionMode): number {
    return homeNoProgressCountValue(mode, this.homeModeNoProgressLoadMoreCount)
  }

  private setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    const safeCount = Math.max(0, count)
    this.homeModeNoProgressLoadMoreCount =
      withHomeNoProgressCountValue(mode, safeCount, this.homeModeNoProgressLoadMoreCount)
  }

  private resetModeLoadMoreStates(reason: string): void {
    this.homeHasMoreEntriesByMode = createHomeModeBooleanMap(true)
    this.homeModeNoProgressLoadMoreCount = createHomeNoProgressCountMap()
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
    if (!!this.homeInlineSearchController.normalizedQuery()) {
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
      && !this.homeInlineSearchController.normalizedQuery()
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
    this.homePendingLoadMoreModes = withHomePendingLoadMoreValue(mode, pending, this.homePendingLoadMoreModes)
  }

  private pendingLoadMoreForMode(mode: SubscriptionMode): boolean {
    return homeModePendingLoadMoreValue(mode, this.homePendingLoadMoreModes)
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
    this.homeLastScrollProgressLoadMoreAt =
      withHomeModeNumberValue(mode, value, this.homeLastScrollProgressLoadMoreAt)
  }

  private maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void {
    if (
      mode !== this.mode
      || !this.isHomeRootTab()
      || this.searchOverlayVisible
      || !!this.homeInlineSearchController.normalizedQuery()
    ) {
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

  flushPendingLoadMoreForMode(mode: SubscriptionMode): void {
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

  handleHomeEntryAppear(mode: SubscriptionMode, index: number, totalCount: number): void {
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
    return this.homeEntryDataManager.mergeFeaturedEntriesFromGroups()
  }

  private applyEntriesForMode(mode: SubscriptionMode, entries: EntryCardModel[], deferredPersist: boolean, skipNotify: boolean = false, skipMerge: boolean = false): void {
    this.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge)
  }

  ensureModeEntriesLoaded(mode: SubscriptionMode): void {
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
    return cloneHomeSnapshotEntry(entry)
  }

  private schedulePersistHomeSnapshot(entries: EntryCardModel[]): void {
    this.homeEntryDataManager.schedulePersistSnapshot(entries)
  }

  private persistHomeSnapshotNow(): void {
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

  private notifyHomeEntryDataReloaded(): void {
    this.homeEntryDataManager.notifyAllReloaded()
  }

  private notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void {
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

  private currentHomeModeScroller(): Scroller {
    return this.homeScrollerForMode(this.mode)
  }

  private requestExpandedModeRail(): void {
    this.homeInlineSearchController.close()
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
    return shouldHideRootBottomBar(this.currentRootTabId(), {
      discoverHasForegroundOverlay: this.discoverHasForegroundOverlay,
      subscriptionsOverlayLevel: this.subscriptionsOverlayLevel,
      settingsOverlayLevel: this.settingsOverlayLevel,
    })
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
        collapsedModeRailTopPadding: this.homeCollapsedModeRailTopPadding(),
        collapseProgress: this.homeModeRailCollapseProgress(),
        modeRailTopPadding: this.homeModeRailTopPadding(),
        modeRailLeftPadding: this.homeModeRailLeftPadding(),
        modeRailRightInset: this.homeModeRailRightInset(),
        modeRailDismissTranslateY: this.homeModeRailDismissTranslateY(),
        modeRailDismissOpacity: this.homeModeRailDismissOpacity(),
        modeRailDismissScale: this.homeModeRailDismissScale(),
        modeRailCollapsed: this.isHomeModeRailCollapsed(),
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
