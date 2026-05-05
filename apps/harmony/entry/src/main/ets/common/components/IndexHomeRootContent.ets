import { Entry, EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ModeSceneRenderState, resolveModeSceneRenderState } from '../utils/ModeSceneTransition'
import { HomeModeEntriesPage } from './HomeModeEntriesPage'
import { SubscriptionMode } from './HomeRootConfig'
import { TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'

export interface IndexHomeRootContentCallbacks {
  onModeSwipe: (event: GestureEvent) => void
  getEntries: (mode: SubscriptionMode) => EntryCardModel[]
  getDataSource: (mode: SubscriptionMode) => ArrayLazyDataSource<EntryCardModel>
  getTotalCount: (mode: SubscriptionMode) => number
  isModeLoading: (mode: SubscriptionMode) => boolean
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
  @Prop homeListSwapAnimating: boolean = false
  @Prop homeListSwapMode: SubscriptionMode = 'articles'
  @Prop homeListSwapOpacity: number = 1
  // 仅在整页数据重组时作为备用刷新信号传入，分页增量刷新主要依赖
  // ArrayLazyDataSource 的数据变更通知，避免 load-more 时整层重建。
  @Prop homeContentVersion: number = 0

  callbacks: IndexHomeRootContentCallbacks = {
    onModeSwipe: () => {},
    getEntries: () => [],
    getDataSource: () => new ArrayLazyDataSource<EntryCardModel>(() => []),
    getTotalCount: () => 0,
    isModeLoading: () => false,
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

  private getSceneProps(mode: SubscriptionMode): ModeSceneRenderState {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    })
  }

  @Builder
  private ModeEntriesScene(mode: SubscriptionMode) {
    HomeModeEntriesPage({
      mode,
      entries: this.callbacks.getEntries(mode),
      dataSource: this.callbacks.getDataSource(mode),
      totalCount: this.callbacks.getTotalCount(mode),
      isLoading: this.callbacks.isModeLoading(mode) || this.homeInitialLoadPending || this.isHomeStartupRefreshing,
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
    // 预先挂载四个分段场景，避免首次切换时重新建树。
    Stack({ alignContent: Alignment.TopStart }) {
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
          this.callbacks.onModeSwipe(event)
        })
    )
  }
}
