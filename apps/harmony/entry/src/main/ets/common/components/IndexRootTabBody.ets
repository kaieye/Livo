import { Entry, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { RootTabId } from '../navigation/AppRouter'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { DiscoverContent } from './DiscoverContent'
import { IndexHomeRootContent, IndexHomeRootContentCallbacks } from './IndexHomeRootContent'
import { SettingsContent } from './SettingsContent'
import { SubscriptionMode } from '../config/HomeRootConfig'
import { SubscriptionsContent } from './SubscriptionsContent'
import { SubscriptionsAnimatedModeRail } from './SubscriptionsAnimatedModeRail'
import { SubscriptionsModeRail } from './SubscriptionsModeRail'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'

@Component
export struct IndexRootTabBody {
  @Prop tabId: RootTabId = 'home'
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop rootSettings: HarmonySettings = {} as HarmonySettings
  @Prop showUnreadDot: boolean = true
  @Prop mode: SubscriptionMode = 'articles'
  @State subscriptionsMode: SubscriptionMode = 'articles'
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @Prop renderedMode: SubscriptionMode = 'articles'
  @Prop previousMode: SubscriptionMode = 'articles'
  @Prop isModeTransitioning: boolean = false
  @Prop modeTransitionDirection: number = 1
  @Prop homeInitialLoadPending: boolean = false
  @Prop isHomeStartupRefreshing: boolean = false
  @Prop homeListSwapAnimating: boolean = false
  @Prop homeListSwapMode: SubscriptionMode = 'articles'
  @Prop homeListSwapOpacity: number = 1
  @Prop homeContentVersion: number = 0

  homeCallbacks: IndexHomeRootContentCallbacks = {
    onModeSwipe: () => {},
    getDataSource: () => new ArrayLazyDataSource<EntryCardModel>(() => []),
    isModeLoading: () => false,
    isModeLoadingMore: () => false,
    getEmptyStateTitle: () => '',
    getSceneOpacity: () => 1,
    getSceneOffsetX: () => 0,
    getSceneZIndex: () => 0,
    getSceneVisible: () => Visibility.Visible,
    getListSwapTranslateY: () => 0,
    getScroller: () => new Scroller(),
    onWillScroll: () => undefined,
    onDidScroll: () => {},
    onStopDragging: () => {},
    onEntryOpen: () => {},
    onItemAppear: () => {},
    onListEndReach: () => {},
    getTweetPresentation: () => ({} as TweetEntryPresentation),
    getPictureEntry: () => ({} as Entry),
    getPictureCaption: () => '',
    getPictureGalleryUrls: () => [],
    onOpenTweetGallery: () => {},
  }
  onTabAppear: (tabId: RootTabId) => void = () => {}
  onSettingsContentScrollerReady: (scroller: Scroller) => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onThemeChange: (theme: ThemePalette) => void = () => {}

  build() {
    Stack() {
      if (this.tabId === 'home') {
        IndexHomeRootContent({
          mode: this.mode,
          renderedMode: this.renderedMode,
          previousMode: this.previousMode,
          isModeTransitioning: this.isModeTransitioning,
          modeTransitionDirection: this.modeTransitionDirection,
          theme: this.theme,
          showUnreadDot: this.showUnreadDot,
          homeInitialLoadPending: this.homeInitialLoadPending,
          isHomeStartupRefreshing: this.isHomeStartupRefreshing,
          homeListSwapAnimating: this.homeListSwapAnimating,
          homeListSwapMode: this.homeListSwapMode,
          homeListSwapOpacity: this.homeListSwapOpacity,
          homeContentVersion: this.homeContentVersion,
          callbacks: this.homeCallbacks,
        })
      } else if (this.tabId === 'subscriptions') {
        SubscriptionsContent({
          inheritedTheme: this.theme,
          mode: this.subscriptionsMode,
          onModeChange: (mode: SubscriptionMode) => {
            this.subscriptionsMode = mode
          },
        })
      } else if (this.tabId === 'discover') {
        DiscoverContent({
          inheritedTheme: this.theme,
        })
      } else {
        SettingsContent({
          inheritedTheme: this.theme,
          inheritedSettings: this.rootSettings,
          onContentScrollerReady: (scroller: Scroller) => {
            this.onSettingsContentScrollerReady(scroller)
          },
          onSettingsChange: (settings: HarmonySettings) => {
            this.onSettingsChange(settings)
          },
          onThemeChange: (theme: ThemePalette) => {
            this.onThemeChange(theme)
          },
        })
      }

      if (this.tabId === 'subscriptions' && this.subscriptionsOverlayLevel === 0) {
        SubscriptionsAnimatedModeRail({
          mode: this.subscriptionsMode,
          onModeChange: (mode: SubscriptionMode) => {
            this.subscriptionsMode = mode
          },
        })
        .width('100%')
        .hitTestBehavior(HitTestMode.Transparent)
      }
    }
    .width('100%')
    .height('100%')
    .onAppear(() => {
      this.onTabAppear(this.tabId)
    })
  }
}
