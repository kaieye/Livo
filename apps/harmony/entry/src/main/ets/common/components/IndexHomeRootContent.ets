import { Entry, EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ModeSceneRenderState, resolveModeSceneRenderState } from '../utils/ModeSceneTransition'
import { HomeModeEntriesPage } from './HomeModeEntriesPage'
import { SubscriptionMode } from './HomeRootConfig'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { HOME_LOAD_MORE_IN_PROGRESS_KEY } from '../utils/index-home/HomeChromeProgressStore'

export interface IndexHomeRootContentCallbacks {
  onModeSwipe: (event: GestureEvent) => void
  getDataSource: (mode: SubscriptionMode) => ArrayLazyDataSource<EntryCardModel>
  isModeLoading: (mode: SubscriptionMode) => boolean
  isModeLoadingMore: (mode: SubscriptionMode) => boolean
  getEmptyStateTitle: () => string
  getSceneOpacity: (mode: SubscriptionMode) => number
  getSceneOffsetX: (mode: SubscriptionMode) => number
  getSceneZIndex: (mode: SubscriptionMode) => number
  getSceneVisible: (mode: SubscriptionMode) => Visibility
  getListSwapTranslateY: (mode: SubscriptionMode) => number
  getScroller: (mode: SubscriptionMode) => Scroller
  onWillScroll: (mode: SubscriptionMode, scrollOffset: number, scrollSource: ScrollSource) => ScrollResult | void
  onDidScroll: (mode: SubscriptionMode) => void
  onStopDragging: (mode: SubscriptionMode) => void
  onEntryOpen: (entry: EntryCardModel) => void
  onItemAppear: (mode: SubscriptionMode, index: number, totalCount: number) => void
  onListEndReach: (mode: SubscriptionMode, totalCount: number) => void
  getTweetPresentation: (entry: EntryCardModel) => TweetEntryPresentation
  getPictureEntry: (entry: EntryCardModel) => Entry
  getPictureCaption: (entry: EntryCardModel) => string
  getPictureGalleryUrls: (entry: EntryCardModel) => string[]
  onOpenTweetGallery: (imageUrls: string[], initialIndex: number) => void
}

@Component
export struct IndexHomeRootContent {
  @Prop mode: SubscriptionMode = 'articles'
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop showUnreadDot: boolean = true
  @Prop renderedMode: SubscriptionMode = 'articles'
  @Prop previousMode: SubscriptionMode = 'articles'
  @Prop isModeTransitioning: boolean = false
  @Prop modeTransitionDirection: number = 1
  @Prop homeInitialLoadPending: boolean = false
  @Prop isHomeStartupRefreshing: boolean = false
  // 直接订阅 AppStorage,不再走 4 层 @Prop 透传。HomeFeedPagination 切换 load-more
  // 状态时只更新这里,父级 Index/Shell/TabBody 不会因此 rebuild。
  @StorageProp(HOME_LOAD_MORE_IN_PROGRESS_KEY) homeLoadMoreInProgress: boolean = false
  @Prop homeListSwapAnimating: boolean = false
  @Prop homeListSwapMode: SubscriptionMode = 'articles'
  @Prop homeListSwapOpacity: number = 1
  // 仅在整页数据重组时作为备用刷新信号传入，分页增量刷新主要依赖
  // ArrayLazyDataSource 的数据变更通知，避免 load-more 时整层重建。
  @Prop homeContentVersion: number = 0

  callbacks: IndexHomeRootContentCallbacks = {
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
  private getSceneProps(mode: SubscriptionMode): ModeSceneRenderState {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    })
  }

  private shouldMountScene(mode: SubscriptionMode): boolean {
    return this.getSceneProps(mode).shouldMount
  }

  @Builder
  private ModeEntriesScene(mode: SubscriptionMode) {
    HomeModeEntriesPage({
      mode,
      dataSource: this.callbacks.getDataSource(mode),
      isLoading: this.callbacks.isModeLoading(mode) || this.homeInitialLoadPending || this.isHomeStartupRefreshing,
      isLoadingMore: this.callbacks.isModeLoadingMore(mode) || (mode === this.mode && this.homeLoadMoreInProgress),
      emptyStateTitle: this.callbacks.getEmptyStateTitle(),
      theme: this.theme,
      showUnreadDot: this.showUnreadDot,
      sceneOpacity: this.getSceneProps(mode).opacity,
      sceneOffsetX: this.getSceneProps(mode).offset,
      sceneZIndex: this.getSceneProps(mode).zIndex,
      sceneVisible: this.getSceneProps(mode).visibility === 'visible' ? Visibility.Visible : Visibility.Hidden,
      listSwapOpacity: this.homeListSwapAnimating && mode === this.homeListSwapMode ? this.homeListSwapOpacity : 1,
      listSwapTranslateY: this.callbacks.getListSwapTranslateY(mode),
      scroller: this.callbacks.getScroller(mode),
      callbacks: {
        onWillScroll: (scrollOffset: number, scrollSource: ScrollSource): ScrollResult | void => {
          return this.callbacks.onWillScroll(mode, scrollOffset, scrollSource)
        },
        onDidScroll: (): void => {
          this.callbacks.onDidScroll(mode)
        },
        onStopDragging: (): void => {
          this.callbacks.onStopDragging(mode)
        },
        onEntryOpen: (entry: EntryCardModel): void => {
          this.callbacks.onEntryOpen(entry)
        },
        onItemAppear: (index: number, totalCount: number): void => {
          this.callbacks.onItemAppear(mode, index, totalCount)
        },
        onListEndReach: (totalCount: number): void => {
          this.callbacks.onListEndReach(mode, totalCount)
        },
        getTweetPresentation: (entry: EntryCardModel): TweetEntryPresentation => this.callbacks.getTweetPresentation(entry),
        getPictureEntry: (entry: EntryCardModel): Entry => this.callbacks.getPictureEntry(entry),
        getPictureCaption: (entry: EntryCardModel): string => this.callbacks.getPictureCaption(entry),
        getPictureGalleryUrls: (entry: EntryCardModel): string[] => this.callbacks.getPictureGalleryUrls(entry),
        onOpenTweetGallery: (imageUrls: string[], initialIndex: number): void => {
          this.callbacks.onOpenTweetGallery(imageUrls, initialIndex)
        },
      },
    })
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.shouldMountScene('articles')) {
        this.ModeEntriesScene('articles')
      }
      if (this.shouldMountScene('social')) {
        this.ModeEntriesScene('social')
      }
      if (this.shouldMountScene('pictures')) {
        this.ModeEntriesScene('pictures')
      }
      if (this.shouldMountScene('videos')) {
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
          this.callbacks.onModeSwipe(event)
        })
    )
  }
}
