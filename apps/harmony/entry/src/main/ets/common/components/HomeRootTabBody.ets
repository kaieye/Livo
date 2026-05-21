import { Entry, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { IndexHomeRootContent, IndexHomeRootContentCallbacks } from './IndexHomeRootContent'
import { SubscriptionMode } from './HomeRootConfig'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'

@Component
export struct HomeRootTabBody {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop renderedMode: SubscriptionMode = 'articles'
  @Prop previousMode: SubscriptionMode = 'articles'
  @Prop isModeTransitioning: boolean = false
  @Prop modeTransitionDirection: number = 1
  @Prop homeInitialLoadPending: boolean = false
  @Prop isHomeStartupRefreshing: boolean = false
  @Prop homeLoadMoreInProgress: boolean = false
  @Prop homeListSwapAnimating: boolean = false
  @Prop homeListSwapMode: SubscriptionMode = 'articles'
  @Prop homeListSwapOpacity: number = 1
  @Prop homeContentVersion: number = 0
  @Prop showUnreadDot: boolean = true

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

  build() {
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
      homeLoadMoreInProgress: this.homeLoadMoreInProgress,
      homeListSwapAnimating: this.homeListSwapAnimating,
      homeListSwapMode: this.homeListSwapMode,
      homeListSwapOpacity: this.homeListSwapOpacity,
      homeContentVersion: this.homeContentVersion,
      callbacks: this.homeCallbacks,
    })
  }
}
