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
import { HomeVideoGrid } from '../common/components/HomeVideoGrid'
import {
  ROOT_MODE_RAIL_TOP_GAP,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
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
  selectPictureMediaUrls,
} from '../common/models/LivoModels'
import { HighlightedInlineText } from '../common/components/HighlightedInlineText'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { createEmptyHomeEntryGroups, groupHomeEntriesByMode, HomeEntryGroups } from '../common/utils/HomeEntryGroups'
import { buildInlineHighlightSegments, normalizeInlineSearchQuery } from '../common/utils/HomeInlineSearch'
import { rememberVisitedMode } from '../common/utils/HomeModeVisitedCache'
import { resolveHomeVideoSceneKind } from '../common/utils/HomeVideoGrid'
import { presentTweetEntryFromCard } from '../common/utils/TweetEntryPresentation'
import { livoMotion } from '../common/ui/Motion'
import { resolveModeSceneRenderState } from '../common/utils/ModeSceneTransition'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
  CARD_RADIUS_MD,
  META_FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
} from '../common/ui/UiTokens'
import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { DiscoverContent } from '../common/components/DiscoverContent'
import { SettingsContent } from '../common/components/SettingsContent'
import { AvatarTile } from '../common/components/AvatarTile'
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

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'
const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
const MODE_SWIPE_TRIGGER_OFFSET: number = 56
const HOME_MODE_CONTENT_GAP: number = 6
const HOME_REFRESH_PULL_DISTANCE: number = 40
const HOME_REFRESH_MAX_PULL_DISTANCE: number = 120
const HOME_REFRESH_FOLLOW_RATIO: number = 0.72
const HOME_REFRESH_CONTENT_HOLD_DISTANCE: number = 44
const HOME_REFRESH_INDICATOR_VISUAL_OFFSET: number = 32
const HOME_REFRESH_GAP_OPEN_PULL_DISTANCE: number = 12
const HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y: number = 12
const HOME_REFRESH_INDICATOR_SIZE: number = 40
const HOME_REFRESH_INDICATOR_BOTTOM_MARGIN: number = 15
const HOME_REFRESH_RESET_DURATION: number = 220
const HOME_REFRESH_DISMISS_SCROLL_OFFSET: number = 18
const HOME_LIST_SWAP_EXIT_DURATION: number = 120
const HOME_LIST_SWAP_ENTER_DURATION: number = 150
const HOME_LIST_SWAP_OFFSET_Y: number = 0
const HOME_LIST_SWAP_ENTRY_OFFSET_Y: number = 0
const HOME_LIST_SWAP_EXIT_SCALE: number = 1
const HOME_LIST_SWAP_ENTRY_SCALE: number = 1
const HOME_LIST_SWAP_EXIT_MIN_OPACITY: number = 0.56
const HOME_LIST_SWAP_ENTRY_MIN_OPACITY: number = 0.9
const HOME_LIST_SWAP_ANIMATION_ENABLED: boolean = true
const HEADER_BLUR_SCROLL_RANGE: number = 72
const ROOT_TITLE_BAR_MINI_HEIGHT: number = 56
const HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const HOME_TITLE_BAR_OVERLAY_SPACER: number =
  ROOT_TITLE_BAR_MINI_HEIGHT + HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
const HOME_MODE_CONTENT_TOP_SPACER_HEIGHT: number = HOME_TITLE_BAR_OVERLAY_SPACER
const HOME_MODE_RAIL_HEIGHT: number = 46
const HOME_MODE_SCENE_TOP_INSET: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT + ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
const HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL: number = 32
const ROOT_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET: number = 0
const HOME_COLLAPSED_MODE_RAIL_SIZE: number = 40
const HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA: number = 14
const HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT: number = -6
const HOME_COLLAPSED_MODE_RAIL_TOP_PADDING: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT - HOME_COLLAPSED_MODE_RAIL_SIZE - ROOT_MODE_RAIL_TOP_GAP
const HOME_INLINE_SEARCH_ACTION_SIZE: number = 40
const HOME_INLINE_SEARCH_ACTION_GAP: number = 8
const HOME_INLINE_SEARCH_INPUT_HEIGHT: number = 40
const HOME_INLINE_SEARCH_MAX_WIDTH: number = 360
const HOME_INLINE_SEARCH_RESULT_MAX_WIDTH: number = 360
const HOME_INLINE_SEARCH_RESULT_LIMIT: number = 6
const HOME_INLINE_SEARCH_MOTION_DURATION: number = 240
const HOME_INLINE_SEARCH_VERTICAL_TRAVEL: number = 18
const HOME_INLINE_SEARCH_INPUT_ID: string = 'home-inline-search-input'
const HOME_REFRESH_FIRST_SWAP_DELAY_MS: number = 72
const HOME_REFRESH_MEDIUM_RELOAD_DELAY_MS: number = 220
const HOME_REFRESH_FINAL_RELOAD_DELAY_MS: number = 460
const HOME_FINAL_RELOAD_IDLE_RETRY_MS: number = 120
const HOME_FINAL_RELOAD_IDLE_MAX_RETRIES: number = 10
const HOME_REFRESH_RESET_DEFER_MS: number = 32
const HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS: number = 260
const HOME_FEEDS_CHANGED_RELOAD_DELAY_MS: number = 280
const HOME_ENTRY_GROUP_DEFER_DELAY_MS: number = 96
const HOME_SWAP_PRIME_CANDIDATE_LIMIT: number = 48
const HOME_SWAP_CANDIDATE_LIMIT: number = 120
const HOME_MAX_CANDIDATE_LIMIT: number = 240
const HOME_INITIAL_CANDIDATE_LIMIT: number = 24
const AUTO_REFRESH_MIN_INTERVAL_MINUTES: number = 1

interface RootTabSymbolPair {
  normal: SymbolGlyphModifier
  selected: SymbolGlyphModifier
}

interface HomeModeRailOptions {
  collapsed?: boolean
  collapseProgress?: number
}

interface HomeModeScrollOffsetMap {
  articles: number
  social: number
  pictures: number
  videos: number
}

interface HomeEntryDataSourceMap {
  articles: ArrayLazyDataSource<EntryCardModel>
  social: ArrayLazyDataSource<EntryCardModel>
  pictures: ArrayLazyDataSource<EntryCardModel>
  videos: ArrayLazyDataSource<EntryCardModel>
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
  private autoRefreshTimer: number = -1
  private homeEntryGroupVersion: number = 0
  private postRefreshReloadVersion: number = 0
  private feedsChangedReloadVersion: number = 0
  private suppressFeedsChangedUntilMs: number = 0
  private homeListSwapToken: number = 0
  private isComponentActive: boolean = false
  private initialFeedCount: number = 0
  private managedTimeoutIds: number[] = []

  aboutToAppear(): void {
    this.isComponentActive = true
    console.info('Livo Harmony Index aboutToAppear')
    this.syncRequestedRootTab()
    void this.loadInitialData()
  }

  aboutToDisappear(): void {
    this.isComponentActive = false
    this.clearRefreshPercentAnimation()
    this.clearAutoRefreshTimer()
    this.clearManagedTimeouts()
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
      callback()
    }, delayMs)
    this.managedTimeoutIds.push(timeoutId)
  }

  private clearManagedTimeouts(): void {
    this.managedTimeoutIds.forEach((timeoutId: number) => {
      clearTimeout(timeoutId)
    })
    this.managedTimeoutIds = []
  }

  private async loadInitialData(): Promise<void> {
    this.homeInitialLoadPending = true
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
    const settingsPromise = AppRepository.settings()
    const feedsPromise = AppRepository.feedEntities()
    const initialEntriesPromise = AppRepository.featuredEntries(HOME_INITIAL_CANDIDATE_LIMIT)

    const initialEntries = await initialEntriesPromise
    this.applyHomeEntries(initialEntries, false)
    this.settleInitialHomeLoadState()

    const settings = await settingsPromise
    const feeds = await feedsPromise
    this.initialFeedCount = feeds.length
    this.rootSettings = settings
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.theme = await ThemeService.resolvePalette(settings)
    void this.applySystemBarStyle(this.theme)

    void this.reloadFeaturedEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
    this.feedSourceLabel = '本地内容已加载'
    this.startStartupRefreshIfNeeded()
    this.configureAutoRefreshTimer()
  }

  private startStartupRefreshIfNeeded(): void {
    if (this.isHomeStartupRefreshing) {
      return
    }

    this.isHomeStartupRefreshing = true
    void this.refreshFeaturedEntries(false).finally(() => {
      this.isHomeStartupRefreshing = false
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

    this.isRefreshing = true
    this.refreshCompletedCount = 0
    this.refreshTotalCount = 0
    this.clearRefreshPercentAnimation()
    this.displayRefreshPercent = 0

    try {
      const result = await AppRepository.refreshAllFeeds((completedCount: number, totalCount: number) => {
        if (!this.isComponentActive) {
          return
        }
        this.refreshCompletedCount = completedCount
        this.refreshTotalCount = totalCount
        this.animateRefreshPercentTo(this.resolveRefreshPercent(completedCount, totalCount))
      })
      if (!this.isComponentActive) {
        return
      }
      this.feedSourceLabel = result.sourceLabel
      await this.reloadFeaturedEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
      if (showResultToast) {
        this.showToast(result.sourceLabel)
      }
    } finally {
      this.isRefreshing = false
      this.refreshCompletedCount = 0
      this.refreshTotalCount = 0
      this.clearRefreshPercentAnimation()
      this.displayRefreshPercent = 0
      this.runManagedTimeout(() => {
        this.animateHomePullRefreshReset()
      }, HOME_REFRESH_RESET_DEFER_MS)
    }
  }

  private resolveRefreshPercent(completedCount: number, totalCount: number): number {
    return RefreshStateManager.resolveRefreshPercent(completedCount, totalCount)
  }

  private clearRefreshPercentAnimation(): void {
    if (this.refreshPercentAnimationTimer < 0) {
      return
    }

    clearInterval(this.refreshPercentAnimationTimer)
    this.refreshPercentAnimationTimer = -1
  }

  private animateRefreshPercentTo(targetPercent: number): void {
    const animationPlan = RefreshStateManager.createPercentAnimationPlan(this.displayRefreshPercent, targetPercent)
    const nextTarget = animationPlan.targetPercent
    this.clearRefreshPercentAnimation()

    if (nextTarget === this.displayRefreshPercent) {
      return
    }

    const startPercent = animationPlan.startPercent
    const delta = nextTarget - startPercent
    const steps = animationPlan.steps
    let currentStep = 0

    this.refreshPercentAnimationTimer = setInterval(() => {
      currentStep += 1
      const progress = currentStep / steps
      this.displayRefreshPercent = Math.round(startPercent + delta * progress)

      if (currentStep >= steps) {
        this.displayRefreshPercent = nextTarget
        this.clearRefreshPercentAnimation()
      }
    }, 32)
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

    if (this.featuredEntries.length > 0) {
      this.homeInitialLoadPending = false
      return
    }

    if (this.initialFeedCount === 0 && !this.isRefreshing && !this.isHomeStartupRefreshing) {
      this.homeInitialLoadPending = false
      return
    }

    if (force && !this.isRefreshing && !this.isHomeStartupRefreshing) {
      this.homeInitialLoadPending = false
    }
  }

  private homeEmptyStateTitle(): string {
    return this.isHomeContentLoading() ? '正在加载订阅内容' : '还没有可展示的条目'
  }

  private homeEmptyStateSubtitle(): string {
    return this.isHomeContentLoading()
      ? '正在后台刷新订阅源，请稍候。'
      : '请先到订阅页添加或刷新订阅源，然后回到首页查看整理后的内容流。'
  }

  private updateHomePullRefreshState(offset: number): void {
    const nextOffset = RefreshStateManager.resolvePullDistance(offset, HOME_REFRESH_MAX_PULL_DISTANCE)
    this.homeRefreshPullDistance = nextOffset
    this.homeRefreshIndicatorOffset = nextOffset
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
    return this.currentRootTabId() === 'home'
      && mode === this.mode
      && !this.searchOverlayVisible
  }

  private consumeHomePullScroll(mode: SubscriptionMode, scrollOffset: number) {
    if (!this.shouldConsumeHomePullScroll(mode)) {
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
    if (!this.shouldConsumeHomePullScroll(this.mode)) {
      return
    }

    if (this.isRefreshing) {
      if (this.homeRefreshIndicatorDismissed) {
        this.homeRefreshIndicatorOffset = 0
      }
      return
    }

    if (this.homeRefreshPullDistance >= HOME_REFRESH_PULL_DISTANCE) {
      this.homeRefreshPullDistance = HOME_REFRESH_PULL_DISTANCE
      this.homeRefreshIndicatorOffset = HOME_REFRESH_PULL_DISTANCE
      this.homeRefreshContentHoldOffset = HOME_REFRESH_CONTENT_HOLD_DISTANCE
      this.homeRefreshIndicatorDismissed = false
      this.homeRefreshStatus = RefreshStatus.Refresh
      void this.refreshFeaturedEntries()
      return
    }

    this.animateHomePullRefreshReset()
  }

  private homeRefreshIndicatorProgress(): number {
    return RefreshStateManager.resolveIndicatorProgress(this.homeRefreshIndicatorOffset, HOME_REFRESH_PULL_DISTANCE)
  }

  private shouldShowHomeRefreshGap(mode: SubscriptionMode): boolean {
    if (!this.isHomeRootTab() || mode !== this.mode) {
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
    if (!this.isHomeRootTab() || mode !== this.mode) {
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

    if (this.homeModeRailExpandedOverride) {
      if (Math.abs(nextOffset - this.homeModeRailExpandedLockOffset) < 2) {
        return
      }

      this.homeModeRailExpandedOverride = false
      this.homeModeRailExpandedLockOffset = -1
    }

    if (!this.homeModeRailExpandedOverride) {
      this.homeModeRailDismissedByScroll = nextOffset >= HOME_MODE_RAIL_COLLAPSE_OFFSET
    }

    this.currentHomeModeScrollOffset = nextOffset
    this.updateHeaderBlurProgress(nextOffset)
  }

  private setHomeScrollInteracting(interacting: boolean): void {
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

  private openHomeInlineSearch(): void {
    if (!this.searchOverlayVisible) {
      this.searchOverlayVisible = true
      this.runManagedTimeout(() => {
        this.showSearch = true
        this.focusHomeInlineSearch()
      }, 16)
      return
    }

    this.showSearch = true
    this.focusHomeInlineSearch()
  }

  private focusHomeInlineSearch(): void {
    this.runManagedTimeout(() => {
      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.searchInputController.caretPosition(this.searchQuery.length)
    }, 24)
    this.runManagedTimeout(() => {
      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.searchInputController.caretPosition(this.searchQuery.length)
    }, 80)
    this.runManagedTimeout(() => {
      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.searchInputController.caretPosition(this.searchQuery.length)
    }, 180)
    this.runManagedTimeout(() => {
      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.searchInputController.caretPosition(this.searchQuery.length)
    }, 320)
  }

  private closeHomeInlineSearch(clearQuery: boolean = true): void {
    this.showSearch = false
    this.searchInputController.stopEditing()
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

  private homeCollapsedModeRailBackdropBlur(): number {
    return this.theme.isDark ? 10 : 18
  }

  private homeCollapsedModeRailBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.74)' : 'rgba(255,255,255,0.84)'
  }

  private homeCollapsedModeRailBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'
  }

  private homeCollapsedModeRailShadow(): ShadowOptions {
    return {
      radius: 10,
      color: this.theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.12)',
      offsetX: 0,
      offsetY: 2,
    }
  }

  private homeCollapsedModeSymbol(): Resource {
    switch (this.mode) {
      case 'articles':
        return $r('sys.symbol.doc_text')
      case 'social':
        return $r('sys.symbol.ellipsis_bubble')
      case 'pictures':
        return $r('sys.symbol.picture_2')
      case 'videos':
      default:
        return $r('sys.symbol.media_center')
    }
  }

  @Builder
  private HomeCollapsedModeRailIcon() {
    SymbolGlyph(this.homeCollapsedModeSymbol())
      .fontSize(18)
      .fontColor([this.theme.textPrimary])
  }

  @Builder
  private HomeCollapsedModeRailButton() {
    Row() {
      this.HomeCollapsedModeRailIcon()
    }
    .width(HOME_INLINE_SEARCH_ACTION_SIZE)
    .height(HOME_INLINE_SEARCH_ACTION_SIZE)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.homeCollapsedModeRailBackgroundColor())
    .backdropBlur(this.homeCollapsedModeRailBackdropBlur())
    .borderRadius(HOME_INLINE_SEARCH_ACTION_SIZE / 2)
    .border({ width: 0.8, color: this.homeCollapsedModeRailBorderColor() })
    .shadow(this.homeCollapsedModeRailShadow())
    .onClick(() => {
      this.requestExpandedModeRail()
    })
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

  @Builder
  private HomeInlineSearchField() {
    Row({ space: 8 }) {
      SymbolGlyph($r('sys.symbol.magnifyingglass'))
        .fontSize(16)
        .fontColor([this.theme.textSecondary])

      TextInput({ text: this.searchQuery, placeholder: this.rootSettings.searchAllHomeCategories ? '搜索全部内容' : `搜索「${this.getModeTitle(this.mode)}」`, controller: this.searchInputController })
        .layoutWeight(1)
        .backgroundColor('transparent')
        .fontColor(this.theme.textPrimary)
        .placeholderColor(this.theme.textMuted)
        .caretColor(this.theme.accent)
        .padding(0)
        .id(HOME_INLINE_SEARCH_INPUT_ID)
        .focusable(true)
        .defaultFocus(this.searchOverlayVisible)
        .onAppear(() => {
          this.focusHomeInlineSearch()
        })
        .onChange((value: string) => {
          this.searchQuery = value
        })
        .onEditChange((isEditing: boolean) => {
          if (!isEditing && this.searchOverlayVisible) {
            this.closeHomeInlineSearch(false)
          }
        })

      Text('×')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textMuted)
        .width(24)
        .height(24)
        .textAlign(TextAlign.Center)
        .borderRadius(999)
        .onClick(() => {
          this.closeHomeInlineSearch(true)
        })
    }
    .width('100%')
    .height(HOME_INLINE_SEARCH_INPUT_HEIGHT)
    .constraintSize({ maxWidth: HOME_INLINE_SEARCH_MAX_WIDTH })
    .padding({ left: 12, right: 8 })
    .backgroundColor(this.homeCollapsedModeRailBackgroundColor())
    .backdropBlur(this.homeCollapsedModeRailBackdropBlur())
    .borderRadius(HOME_INLINE_SEARCH_INPUT_HEIGHT)
    .border({ width: 0.8, color: this.homeCollapsedModeRailBorderColor() })
    .shadow(this.homeCollapsedModeRailShadow())
    .clip(true)
    .opacity(this.showSearch ? 1 : 0)
    .scale({
      x: this.showSearch ? 1 : 0.12,
      y: this.showSearch ? 1 : 0.88,
    })
    .translate({
      x: 0,
      y: this.homeInlineSearchVerticalOffset(),
    })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
  }

  @Builder
  private HomeInlineSearchActionRow() {
    Row({ space: HOME_INLINE_SEARCH_ACTION_GAP }) {
      Row() {
        if (this.isRefreshing && this.refreshTotalCount > 0) {
          Text(`${this.displayRefreshPercent}%`)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
        } else {
          SymbolGlyph($r('sys.symbol.arrow_clockwise'))
            .fontSize(18)
            .fontColor([this.theme.textPrimary])
        }
      }
      .width(HOME_INLINE_SEARCH_ACTION_SIZE)
      .height(HOME_INLINE_SEARCH_ACTION_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.homeCollapsedModeRailBackgroundColor())
      .backdropBlur(this.isRefreshing ? this.homeCollapsedModeRailBackdropBlur() + 2 : this.homeCollapsedModeRailBackdropBlur())
      .borderRadius(HOME_INLINE_SEARCH_ACTION_SIZE / 2)
      .border({ width: 0.8, color: this.homeCollapsedModeRailBorderColor() })
      .shadow(this.homeCollapsedModeRailShadow())
      .opacity(this.showSearch ? 0 : 1)
      .translate({ x: this.showSearch ? 10 : 0 })
      .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
      .enabled(!this.showSearch)
      .onClick(() => {
        void this.refreshFeaturedEntries()
      })

      Row() {
        SymbolGlyph($r('sys.symbol.magnifyingglass'))
          .fontSize(18)
          .fontColor([this.theme.textPrimary])
      }
      .width(HOME_INLINE_SEARCH_ACTION_SIZE)
      .height(HOME_INLINE_SEARCH_ACTION_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.homeCollapsedModeRailBackgroundColor())
      .backdropBlur(this.homeCollapsedModeRailBackdropBlur())
      .borderRadius(HOME_INLINE_SEARCH_ACTION_SIZE / 2)
      .border({ width: 0.8, color: this.homeCollapsedModeRailBorderColor() })
      .shadow(this.homeCollapsedModeRailShadow())
      .opacity(this.showSearch ? 0 : 1)
      .translate({ x: this.showSearch ? 10 : 0 })
      .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
      .enabled(!this.showSearch)
      .onClick(() => {
        this.openHomeInlineSearch()
      })
    }
  }

  private homeInlineSearchVerticalOffset(): number {
    return this.showSearch ? 0 : -1 * HOME_INLINE_SEARCH_VERTICAL_TRAVEL
  }

  private isHomeRootTab(): boolean {
    return this.currentRootTabId() === 'home'
  }

  private shouldHideRootTitleBar(): boolean {
    return this.currentRootTabId() === 'subscriptions'
      || this.currentRootTabId() === 'discover'
      || this.currentRootTabId() === 'settings'
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

    this.highlightedRootTabId = requestedTab
    this.activeRootTabId = requestedTab
    this.rootTabIndex = rootTabIndexForId(requestedTab)
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

    const item = resolveHdsBottomTabItems()[index]
    if (!item) {
      return
    }

    const tabId = item.id as RootTabId
    this.rootTabIndex = index
    this.highlightedRootTabId = tabId
    if (tabId !== 'home') {
      this.resetHomePullRefreshState()
      this.closeHomeInlineSearch(true)
    }
  }

  private confirmRootTabSelection(tabId: RootTabId): void {
    if (this.activeRootTabId === tabId) {
      return
    }

    this.activeRootTabId = tabId
    if (tabId === 'home') {
      this.syncHomeModeRailState(this.mode)
    }
  }

  private currentRootTabId(): RootTabId {
    return this.highlightedRootTabId
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

    this.mode = nextMode
    this.visitedModes = rememberVisitedMode(this.visitedModes, nextMode)
    this.resetHomePullRefreshState()
    this.homeModeRailExpandedOverride = false
    this.homeModeRailExpandedLockOffset = -1
    const nextModeOffset = this.homeModeScrollOffsetFor(nextMode)
    this.currentHomeModeScrollOffset = nextModeOffset
    this.homeModeRailDismissedByScroll = nextModeOffset > 0.5
    this.updateHeaderBlurProgress(nextModeOffset)
    this.startModeTransition(nextMode)
    this.requestExpandedModeRail()
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(this.renderedMode) ? 1 : -1
    this.previousMode = this.renderedMode
    this.renderedMode = nextMode
    this.isModeTransitioning = false
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

  private handleFeedsChanged(): void {
    if (!this.isComponentActive || this.isRefreshing || this.isHomeStartupRefreshing) {
      return
    }

    const now = Date.now()
    if (now < this.suppressFeedsChangedUntilMs) {
      return
    }

    const currentVersion = this.feedsChangedReloadVersion + 1
    this.feedsChangedReloadVersion = currentVersion
    void this.reloadFeaturedEntriesFromLocal(HOME_SWAP_PRIME_CANDIDATE_LIMIT)

    this.runManagedTimeout(() => {
      if (this.feedsChangedReloadVersion !== currentVersion) {
        return
      }
      void this.reloadFeaturedEntriesFromLocal(HOME_SWAP_CANDIDATE_LIMIT)
    }, HOME_FEEDS_CHANGED_RELOAD_DELAY_MS)
  }

  private shouldRunFinalHomeReloadNow(): boolean {
    return this.isComponentActive
      && this.isHomeRootTab()
      && !this.isRefreshing
      && !this.isHomeStartupRefreshing
      && !this.isModeTransitioning
      && !this.homeListSwapAnimating
      && !this.searchOverlayVisible
      && !this.isHomeScrollInteracting
  }

  private scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void {
    this.runManagedTimeout(() => {
      if (this.postRefreshReloadVersion !== currentVersion) {
        return
      }

      if (!this.shouldRunFinalHomeReloadNow()) {
        if (attempt >= HOME_FINAL_RELOAD_IDLE_MAX_RETRIES) {
          void this.reloadFeaturedEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
          return
        }
        this.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt + 1)
        return
      }

      void this.reloadFeaturedEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
    }, attempt === 0 ? HOME_REFRESH_FINAL_RELOAD_DELAY_MS : HOME_FINAL_RELOAD_IDLE_RETRY_MS)
  }

  private scheduleHomeReloadAfterRefresh(): void {
    const currentVersion = this.postRefreshReloadVersion + 1
    this.postRefreshReloadVersion = currentVersion
    this.suppressFeedsChangedUntilMs = Date.now()
      + HOME_REFRESH_FINAL_RELOAD_DELAY_MS
      + HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS

    this.runManagedTimeout(() => {
      if (this.postRefreshReloadVersion !== currentVersion) {
        return
      }
      void this.reloadFeaturedEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, true)
    }, HOME_REFRESH_FIRST_SWAP_DELAY_MS)
  }

  private async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
  ): Promise<void> {
    const nextEntries = await AppRepository.featuredEntries(candidateLimit)
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.mode)
      return
    }

    this.applyHomeEntries(nextEntries)
  }

  private applyHomeEntries(nextEntries: EntryCardModel[], deferredGrouping: boolean = true): void {
    this.featuredEntries = nextEntries
    this.settleInitialHomeLoadState()

    if (!deferredGrouping) {
      this.entryGroups = groupHomeEntriesByMode(nextEntries)
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
      this.notifyHomeEntryDataReloaded()
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
  }

  private applyHomeEntriesForAnimatedMode(
    nextEntries: EntryCardModel[],
    mode: SubscriptionMode,
    token: number,
  ): void {
    this.featuredEntries = nextEntries
    const currentModeEntries = nextEntries.filter((entry: EntryCardModel) => this.resolveEntryMode(entry) === mode)
    this.entryGroups = {
      articles: mode === 'articles' ? currentModeEntries : this.entryGroups.articles,
      social: mode === 'social' ? currentModeEntries : this.entryGroups.social,
      pictures: mode === 'pictures' ? currentModeEntries : this.entryGroups.pictures,
      videos: mode === 'videos' ? currentModeEntries : this.entryGroups.videos,
    }
    this.notifyHomeEntryDataReloadedForMode(mode)

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
      this.notifyHomeEntryDataReloadedExcept(mode)
    }, HOME_ENTRY_GROUP_DEFER_DELAY_MS)
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

    // Apply refreshed data once, then play a fade-only update with no translate or scale changes.
    this.applyHomeEntries(nextEntries, false)

    if (!HOME_LIST_SWAP_ANIMATION_ENABLED) {
      this.homeListSwapOpacity = 1
      this.homeListSwapTranslateY = 0
      this.homeListSwapScale = 1
      this.homeListSwapAnimating = false
      return
    }

    // Refresh animation only fades content; no vertical movement or scaling.
    this.homeListSwapOpacity = HOME_LIST_SWAP_ENTRY_MIN_OPACITY
    this.homeListSwapTranslateY = 0
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
    return this.homeEntryDataSourceFor(mode).totalCount()
  }

  private filteredEntries(): EntryCardModel[] {
    return this.filteredEntriesFor(this.mode)
  }

  private pictureCaption(entry: EntryCardModel): string {
    const title = (entry.title || '').trim()
    if (title && title !== '远程条目') {
      return title
    }
    return (entry.summary || '').trim()
  }

  private pictureGalleryUrls(entry: EntryCardModel): string[] {
    return selectPictureMediaUrls(entry.mediaUrls ?? [])
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

  private shouldMountModeScene(mode: SubscriptionMode): boolean {
    const renderState = resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    })

    return renderState.shouldMount
  }

  private getModeTitle(mode: SubscriptionMode): string {
    switch (mode) {
      case 'articles': return '文章'
      case 'social': return '社交'
      case 'pictures': return '图片'
      case 'videos': return '视频'
      default: return ''
    }
  }

  @Builder
  private EntryCard(entry: EntryCardModel) {
    Stack({ alignContent: Alignment.TopEnd }) {
      Row({ space: this.articleTweetPreviewImage(entry) ? 10 : 0 }) {
        Column({ space: 6 }) {
          Row({ space: 6 }) {
            AvatarTile({
              imageUrl: entry.feedImageUrl,
              fallbackLabel: entry.feedTitle || entry.author,
              theme: this.theme,
              avatarSize: 16,
              radius: 8,
              textSize: 9,
            })
              .width(16)
              .height(16)

            Row({ space: 6 }) {
              HighlightedInlineText({
                text: entry.feedTitle,
                query: this.searchQuery,
                theme: this.theme,
                fontSize: 12,
                lineHeight: 16,
                fontWeight: FontWeight.Medium,
                defaultColor: this.theme.accent,
                maxLines: 1,
              })

              Text('·')
                .fontSize(12)
                .fontColor(this.theme.textMuted)

              Text(entry.publishedLabel)
                .fontSize(12)
                .fontColor(this.theme.textMuted)
            }
            .layoutWeight(1)
          }
          .width('100%')
          .alignItems(VerticalAlign.Center)

          HighlightedInlineText({
            text: entry.title,
            query: this.searchQuery,
            theme: this.theme,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: FontWeight.Bold,
            defaultColor: this.theme.textPrimary,
            maxLines: 2,
          })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        if (this.articleTweetPreviewImage(entry)) {
          Image(this.articleTweetPreviewImage(entry))
            .width(72)
            .height(72)
            .borderRadius(8)
            .objectFit(ImageFit.Cover)
            .backgroundColor(this.theme.elevated)
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (!entry.isRead && this.showUnreadDot) {
        Row()
          .width(8)
          .height(8)
          .borderRadius(999)
          .backgroundColor(this.theme.accent)
          .margin({ right: 8, top: 8 })
      }
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(14)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .onClick(() => this.openEntry(entry))
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

  private articleTweetPreviewImage(entry: EntryCardModel): string {
    const candidateUrls = [
      ...(entry.mediaUrls ?? []),
      entry.imageUrl || '',
      entry.feedImageUrl || '',
      this.extractFirstImageUrlFromText(entry.summary || ''),
      this.extractFirstImageUrlFromText(entry.title || ''),
    ].filter((url: string) => !!url.trim())

    const pictureMediaCandidates = selectPictureMediaUrls(candidateUrls)
    if (pictureMediaCandidates.length > 0) {
      return pictureMediaCandidates[0]
    }

    const firstLikelyImage = candidateUrls.find((url: string) => this.isLikelyImageUrl(url))
    return firstLikelyImage || ''
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

  private extractFirstImageUrlFromText(text: string): string {
    const raw = (text || '').trim()
    if (!raw) {
      return ''
    }

    const htmlMatch = raw.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
    if (htmlMatch?.[1]) {
      return htmlMatch[1].trim()
    }

    const twimgMatch = raw.match(/https?:\/\/pbs\.twimg\.com\/[^\s"'<>]+/i)
    if (twimgMatch?.[0]) {
      return twimgMatch[0].trim()
    }

    const imageMatch = raw.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|bmp|avif)(?:\?[^\s"'<>]*)?/i)
    return imageMatch?.[0]?.trim() || ''
  }

  private isLikelyImageUrl(url: string): boolean {
    const normalized = (url || '').trim().toLowerCase()
    if (!normalized) {
      return false
    }
    return /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized)
      || normalized.includes('pbs.twimg.com/media/')
      || normalized.includes('twimg.com/media/')
      || normalized.includes('scontent.')
  }

  @Builder
  private SocialEntryCard(entry: EntryCardModel, index: number = 0) {
    if (this.isXSocialEntry(entry)) {
      TweetEntryCard({
        presentation: presentTweetEntryFromCard(entry),
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

  private homeCollapsedModeRailWidth(): number {
    return HOME_COLLAPSED_MODE_RAIL_SIZE
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
    .enabled(!this.isHomeModeRailCollapsed())
    .zIndex(100)
  }

  @Builder
  private HomeCollapsedModeRailLayer() {
    Row({ space: HOME_INLINE_SEARCH_ACTION_GAP }) {
      this.HomeCollapsedModeRailButton()
    }
    .width('100%')
    .justifyContent(FlexAlign.End)
    .alignItems(VerticalAlign.Top)
    .padding({
      top: this.homeCollapsedModeRailTopPadding(),
      left: PAGE_HORIZONTAL_PADDING,
      right: this.homeModeRailRightInset(),
    })
    .opacity(this.homeModeRailCollapseProgress())
    .translate({ y: (1 - this.homeModeRailCollapseProgress()) * 14 })
    .enabled(this.isHomeModeRailCollapsed())
    .zIndex(132)
  }

  @Builder
  private HomeSearchActionLayer() {
    Row() {
      this.HomeInlineSearchActionRow()
    }
    .width('100%')
    .justifyContent(FlexAlign.End)
    .alignItems(VerticalAlign.Top)
    .padding({
      top: this.homeCollapsedModeRailTopPadding(),
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
    })
    .zIndex(130)
  }

  @Builder
  private HomeSearchFieldLayer() {
    Column({ space: 10 }) {
      if (this.searchOverlayVisible) {
        this.HomeInlineSearchField()

        if (this.normalizedSearchQuery()) {
          this.HomeInlineSearchResults()
        }
      }
    }
    .width('100%')
    .align(Alignment.Top)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding({
      top: this.homeCollapsedModeRailTopPadding(),
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
    })
    .zIndex(131)
  }

  @Builder
  private HomeInlineSearchResults() {
    List({ space: 0 }) {
      if (this.searchResultEntries().length > 0) {
        ForEach(this.searchResultEntries(), (entry: EntryCardModel, index: number) => {
          ListItem() {
            Column({ space: 0 }) {
              Column({ space: 6 }) {
                Flex({ justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start }) {
                  HighlightedInlineText({
                    text: entry.title,
                    query: this.searchQuery,
                    theme: this.theme,
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: FontWeight.Bold,
                    defaultColor: this.theme.textPrimary,
                    maxLines: 2,
                  })

                  Text(entry.feedTitle || entry.author || '')
                    .fontSize(11)
                    .fontColor(this.theme.textMuted)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                    .flexShrink(0)
                    .margin({ left: 8, top: 2 })
                }
                .width('100%')

                if (this.searchResultSummaryText(entry)) {
                  HighlightedInlineText({
                    text: this.searchResultSummaryText(entry),
                    query: this.searchQuery,
                    theme: this.theme,
                    fontSize: 12,
                    lineHeight: 18,
                    fontWeight: FontWeight.Regular,
                    defaultColor: this.theme.textSecondary,
                    maxLines: 2,
                  })
                }
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
              .padding({ left: 16, right: 16, top: 10, bottom: 10 })
              .backgroundColor(this.theme.surface)
              .borderRadius(12)
              .clickEffect({ level: ClickEffectLevel.LIGHT })
              .onClick(() => {
                this.openEntry(entry)
                this.closeHomeInlineSearch(true)
              })

              if (index < this.searchResultEntries().length - 1) {
                Row()
                  .width('100%')
                  .height(0.5)
                  .margin({ left: 16, right: 16 })
                  .backgroundColor(this.theme.divider)
                  .opacity(this.theme.isDark ? 0.36 : 0.6)
              }
            }
            .width('100%')
          }
        }, (entry: EntryCardModel) => `${entry.id}_${this.searchQuery}`)
      } else if (this.hasSearchResultEmptyState()) {
        ListItem() {
          Column({ space: 8 }) {
            Text('当前分段没有匹配内容')
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)

            Text('试试标题、摘要、来源或作者相关关键词')
              .fontSize(12)
              .lineHeight(18)
              .fontColor(this.theme.textSecondary)
              .textAlign(TextAlign.Center)
              .maxLines(2)
          }
          .width('100%')
          .padding({ left: 20, right: 20, top: 24, bottom: 24 })
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .backgroundColor(this.theme.surface)
          .borderRadius(12)
        }
      }
    }
    .width('100%')
    .constraintSize({ maxWidth: HOME_INLINE_SEARCH_RESULT_MAX_WIDTH })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(15,23,42,0.08)',
      offsetY: 2,
    })
    .padding({ left: 8, right: 8, top: 8, bottom: 8 })
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .alignListItem(ListItemAlign.Start)
    .clip(true)
  }

  @Builder
  private HomeSearchDismissLayer() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor(this.showSearch ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.001)')
      .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
      .onClick(() => {
        this.closeHomeInlineSearch(true)
      })
      .zIndex(125)
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

      LazyForEach(this.homeEntryDataSourceFor(mode), (entry: EntryCardModel, index: number) => {
        ListItem() {
          if (mode === 'social') {
            this.SocialEntryCard(entry, index)
          } else {
            this.EntryCard(entry)
          }
        }
        .width('100%')
      }, (entry: EntryCardModel) => `${entry.id}-${entry.isRead}`)

      if (this.homeEntryCountFor(mode) === 0) {
        ListItem() {
          Column({ space: 8 }) {
            Text(this.homeEmptyStateTitle())
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)

            Text(this.homeEmptyStateSubtitle())
              .fontSize(14)
              .lineHeight(22)
              .fontColor(this.theme.textSecondary)
          }
          .alignItems(HorizontalAlign.Start)
          .padding(20)
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_MD)
          .border({ width: 0.8, color: this.theme.divider })
          .width('100%')
        }
      }

      ListItem() {
        Row().height(100).width('100%')
      }

    }
    .width('100%')
    .height('100%')
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
      this.setHomeScrollInteracting(true)
      return this.consumeHomePullScroll(mode, scrollOffset)
    })
    .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
      this.syncHomeModeRailState(mode)
    })
    .onDidStopDragging((_willFling: boolean) => {
      this.setHomeScrollInteracting(false)
      this.finalizeHomePullRefresh()
    })
  }

  @Builder
  private PictureEntryList() {
    List({ space: HOME_MODE_CONTENT_GAP, scroller: this.picturesScroller }) {
      ListItem() {
        Column() {
          Blank()
            .height(HOME_MODE_SCENE_TOP_INSET)

          this.HomeRefreshGapSlot('pictures')
        }
        .width('100%')
      }
      .width('100%')

      LazyForEach(this.homeEntryDataSourceFor('pictures'), (entry: EntryCardModel, index: number) => {
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
            isUnread: !entry.isRead,
            enableEnterTransition: false,
            onOpen: () => this.openEntry(entry),
          })
        }
        .width('100%')
      }, (entry: EntryCardModel) => `${entry.id}-${entry.isRead}`)

      if (this.homeEntryCountFor('pictures') === 0) {
        ListItem() {
          Column({ space: 8 }) {
            Text(this.homeEmptyStateTitle())
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)

            Text(this.homeEmptyStateSubtitle())
              .fontSize(14)
              .lineHeight(22)
              .fontColor(this.theme.textSecondary)
          }
          .alignItems(HorizontalAlign.Start)
          .padding(20)
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_MD)
          .border({ width: 0.8, color: this.theme.divider })
          .width('100%')
        }
      }

      ListItem() {
        Row().height(100).width('100%')
      }

    }
    .width('100%')
    .height('100%')
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
      this.setHomeScrollInteracting(true)
      return this.consumeHomePullScroll('pictures', scrollOffset)
    })
    .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
      this.syncHomeModeRailState('pictures')
    })
    .onDidStopDragging((_willFling: boolean) => {
      this.setHomeScrollInteracting(false)
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
                entries: this.filteredEntriesFor(mode),
                highlightQuery: this.searchQuery,
                isLoading: this.isHomeContentLoading(),
                inheritedTheme: this.theme,
                onOpenEntry: (entry: EntryCardModel) => {
                  this.openEntry(entry)
                },
              })

            }
            .width('100%')
            .constraintSize({ minHeight: '100%' })
            .alignItems(HorizontalAlign.Start)
            .justifyContent(FlexAlign.Start)
            .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 100 })
          }
          .width('100%')
          .height('100%')
          .scrollBar(BarState.Off)
          .edgeEffect(EdgeEffect.Spring)
          .onWillScroll((_xOffset: number, yOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
            this.setHomeScrollInteracting(true)
            return this.consumeHomePullScrollOffset(mode, yOffset)
          })
            .onDidScroll((_xOffset: number, _yOffset: number, _scrollState: ScrollState) => {
            this.syncHomeModeRailState(mode)
          })
          .onDidStopDragging((_willFling: boolean) => {
            this.setHomeScrollInteracting(false)
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
      .opacity(this.modeListSwapOpacity(mode))
      .translate({ y: this.modeListSwapTranslateY(mode) })
      .scale({ x: this.modeListSwapScale(mode), y: this.modeListSwapScale(mode) })
      .onAppear(() => {
        console.info(`频道 ${mode} 场景显示`)
      })
    }
    .width('100%')
    .height('100%')
    .visibility(this.modeSceneVisible(mode))
    .opacity(this.modeSceneOpacity(mode))
    .translate({ x: this.modeSceneOffset(mode) })
    .zIndex(this.modeSceneZIndex(mode))
  }

  @Builder
  private HomeRootPage() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.HomeRefreshIndicatorLayer()

      if (this.shouldMountModeScene('articles')) {
        this.ModeEntriesScene('articles')
      }
      if (this.shouldMountModeScene('social')) {
        this.ModeEntriesScene('social')
      }
      if (this.shouldMountModeScene('pictures')) {
        this.ModeEntriesScene('pictures')
      }
      if (this.shouldMountModeScene('videos')) {
        this.ModeEntriesScene('videos')
      }
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
    return (
      (this.currentRootTabId() === 'discover' && this.discoverHasForegroundOverlay)
      || (this.currentRootTabId() === 'subscriptions' && this.subscriptionsOverlayLevel > 0)
      || (this.currentRootTabId() === 'settings' && this.settingsOverlayLevel > 0)
    )
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
        .cachedMaxCount(2, TabsCacheMode.CACHE_BOTH_SIDE)
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

      if (this.isHomeRootTab() && this.searchOverlayVisible) {
        this.HomeSearchDismissLayer()
      }

      if (this.isHomeRootTab()) {
        this.HomeSearchFieldLayer()
      }

      if (this.isHomeRootTab()) {
        this.HomeSearchActionLayer()
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
}
