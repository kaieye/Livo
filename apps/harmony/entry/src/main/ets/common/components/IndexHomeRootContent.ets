import { Entry, EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ModeSceneRenderState, resolveModeSceneRenderState } from '../utils/ModeSceneTransition'
import { HomeModeEntriesPage } from './HomeModeEntriesPage'
import { SubscriptionMode } from './HomeRootConfig'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'

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
  @Prop homeLoadMoreInProgress: boolean = false
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
  }
  @State private scenesPrewarmed: boolean = false
  private prewarmTimerId: number = -1

  aboutToAppear(): void {
    // 首屏渲染稳定后再预挂载其余 mode scene。挂载本身不会绘制（visibility=hidden、
    // opacity=0），但让组件树就位可避免首次切换时现场构造 List/LazyForEach 引起的卡顿。
    this.prewarmTimerId = setTimeout(() => {
      this.scenesPrewarmed = true
      this.prewarmTimerId = -1
    }, 800)
  }

  aboutToDisappear(): void {
    if (this.prewarmTimerId >= 0) {
      clearTimeout(this.prewarmTimerId)
      this.prewarmTimerId = -1
    }
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
    return this.getSceneProps(mode).shouldMount || this.scenesPrewarmed
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
      },
    })
  }

  build() {
    // 当前模式与动画中的前一模式立即挂载；其余 mode scene 在 aboutToAppear 安排的
    // 800ms 后预挂载，并以 visibility=hidden 隐藏，避免首次跨模式切换时现场建树卡顿。
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
