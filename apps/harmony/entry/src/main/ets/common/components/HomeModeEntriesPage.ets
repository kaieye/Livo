import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { EntryCardModel, selectPictureCarouselMediaUrls, Entry } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
import {
  SubscriptionMode,
  HOME_MODE_BOTTOM_TAB_SPACER,
  HOME_MODE_CONTENT_GAP,
  HOME_MODE_SCENE_TOP_INSET,
} from '../components/HomeRootConfig'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { homeEntryListRenderKey, homeVideoRowRenderKey, isTweetLikeEntry } from '../utils/home/HomeEntryUtils'
import { HomeArticleEntryCard } from './HomeArticleEntryCard'
import { HomeVideoEntryCard } from './HomeVideoEntryCard'
import { PictureEntryCard } from './PictureEntryCard'
import { TweetEntryCard } from './TweetEntryCard'
import { HomeEmptyStateCard } from './HomeEmptyStateCard'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { resolveHomeVideoGridColumns, resolveHomeVideoSceneKind } from '../utils/home/HomeVideoGrid'

// LazyForEach 默认 cachedCount=1 在双列视频网格里只缓存 2 张卡，快速滚动
// 时几乎每帧都要重新 build HomeVideoEntryCard（包含远程封面图解码），
// 这是视频模式滚动卡顿的核心原因。把缓存撑到 4 行（8 张卡）后，可视区
// 上下各有 2 行已经构建好的复用项，刚露出来直接命中复用池而不是走 build。
const HOME_VIDEO_LIST_CACHED_ROW_COUNT: number = 4
// 文章/图片是单列大卡，每屏元素少，缓存 3 个 ListItem 足够覆盖弹性滚动
// 区段，不至于在惯性滑动时频繁触发 ItemBuilder 重建。
const HOME_LIST_CACHED_ITEM_COUNT: number = 8
const HOME_PICTURE_LIST_CACHED_ITEM_COUNT: number = 6

class VideoRowLazyDataSource implements IDataSource {
  private readonly getEntryDataSource: () => ArrayLazyDataSource<EntryCardModel>
  private listeners: DataChangeListener[] = []

  constructor(getEntryDataSource: () => ArrayLazyDataSource<EntryCardModel>) {
    this.getEntryDataSource = getEntryDataSource
  }

  totalCount(): number {
    return Math.ceil(this.getEntryDataSource().totalCount() / resolveHomeVideoGridColumns())
  }

  getData(rowIndex: number): EntryCardModel[] {
    const source = this.getEntryDataSource()
    const columns = resolveHomeVideoGridColumns()
    const startIndex = rowIndex * columns
    const total = source.totalCount()
    const rowEntries: EntryCardModel[] = []
    for (let column = 0; column < columns; column++) {
      const itemIndex = startIndex + column
      if (itemIndex >= total) {
        break
      }
      rowEntries.push(source.getData(itemIndex))
    }
    return rowEntries
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener)
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const listenerIndex = this.listeners.indexOf(listener)
    if (listenerIndex >= 0) {
      this.listeners.splice(listenerIndex, 1)
    }
  }

  notifyDataReloaded(): void {
    this.listeners.forEach((listener: DataChangeListener) => {
      listener.onDataReloaded()
    })
  }

  notifyDataAddedByEntryIndex(entryIndex: number): void {
    const columns = resolveHomeVideoGridColumns()
    const safeEntryIndex = Math.max(0, entryIndex)
    const rowIndex = Math.floor(safeEntryIndex / columns)
    const previousRowCount = Math.ceil(safeEntryIndex / columns)
    const nextRowCount = this.totalCount()
    this.listeners.forEach((listener: DataChangeListener) => {
      // 若追加前是半行，第一条新视频会补齐旧行右侧。
      // 这不是新增一整行，而是旧行内容变化；否则 LazyForEach 会保留半行缓存，
      // 在中间留下一个右侧空白格。
      if (safeEntryIndex % columns !== 0) {
        if (listener.onDataChange) {
          listener.onDataChange(rowIndex)
        } else {
          listener.onDataReloaded()
          return
        }
        if (listener.onDataAdd) {
          for (let addRowIndex = previousRowCount; addRowIndex < nextRowCount; addRowIndex++) {
            listener.onDataAdd(addRowIndex)
          }
        }
        return
      }
      if (listener.onDataAdd) {
        for (let addRowIndex = rowIndex; addRowIndex < nextRowCount; addRowIndex++) {
          listener.onDataAdd(addRowIndex)
        }
        return
      }
      listener.onDataReloaded()
    })
  }
}

export interface HomeModeEntriesPageCallbacks {
  onWillScroll: (scrollOffset: number, scrollSource: ScrollSource) => ScrollResult | void
  onDidScroll: () => void
  onStopDragging: () => void
  onEntryOpen: (entry: EntryCardModel) => void
  onItemAppear: (index: number, total: number) => void
  onListEndReach: (total: number) => void
  getTweetPresentation: (entry: EntryCardModel) => TweetEntryPresentation
  getPictureEntry: (entry: EntryCardModel) => Entry
  getPictureCaption: (entry: EntryCardModel) => string
  getPictureGalleryUrls: (entry: EntryCardModel) => string[]
  onOpenTweetGallery: (imageUrls: string[], initialIndex: number) => void
}

@Component
export struct HomeModeEntriesPage {
  @Prop mode: SubscriptionMode = 'articles'
  // dataSource is a class instance (with closures + listener registry) and is
  // therefore passed as a plain field rather than @Prop. ArkUI @Prop deep-copy
  // would otherwise strip its prototype methods. The parent always supplies a
  // mode-specific instance at construction; the listener registered in
  // aboutToAppear keeps this component in sync with notifyDataReloaded.
  dataSource: ArrayLazyDataSource<EntryCardModel> = new ArrayLazyDataSource<EntryCardModel>(() => [])
  @Prop isLoading: boolean = false
  @Prop isLoadingMore: boolean = false
  @Prop emptyStateTitle: string = ''
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop showUnreadDot: boolean = true
  @Prop sceneOpacity: number = 1
  @Prop sceneOffsetX: number = 0
  @Prop sceneZIndex: number = 0
  @Prop sceneVisible: Visibility = Visibility.Visible
  @Prop listSwapOpacity: number = 1
  @Prop listSwapTranslateY: number = 0
  scroller: Scroller = new Scroller()
  callbacks: HomeModeEntriesPageCallbacks = {
    onWillScroll: () => {},
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
  private dataChangeListener: DataChangeListener | undefined = undefined
  private readonly videoRowDataSource: VideoRowLazyDataSource = new VideoRowLazyDataSource(() => this.dataSource)

  private shouldRenderTweetCard(entry: EntryCardModel): boolean {
    return isTweetLikeEntry(entry) && (this.mode === 'social' || this.mode === 'articles')
  }

  private articleListItemBottomGap(entry: EntryCardModel, index: number): number {
    if (this.mode !== 'articles' || index >= this.dataSource.totalCount() - 1) {
      return 0
    }
    return HOME_MODE_CONTENT_GAP
  }

  aboutToAppear(): void {
    const notifyVideoRowsReloaded = (): void => {
      if (resolveHomeVideoSceneKind(this.mode) === 'grid') {
        this.videoRowDataSource.notifyDataReloaded()
      }
    }
    const notifyVideoRowsAdded = (index: number): void => {
      if (resolveHomeVideoSceneKind(this.mode) === 'grid') {
        this.videoRowDataSource.notifyDataAddedByEntryIndex(index)
      }
    }
    this.dataChangeListener = {
      onDataReloaded: notifyVideoRowsReloaded,
      onDataAdd: (index: number) => notifyVideoRowsAdded(index),
      onDataAdded: (index: number) => notifyVideoRowsAdded(index),
      onDataMove: (_from: number, _to: number) => notifyVideoRowsReloaded(),
      onDataMoved: (_from: number, _to: number) => notifyVideoRowsReloaded(),
      onDataDelete: (_index: number) => notifyVideoRowsReloaded(),
      onDataDeleted: (_index: number) => notifyVideoRowsReloaded(),
      onDataChange: (_index: number) => notifyVideoRowsReloaded(),
      onDataChanged: (_index: number) => notifyVideoRowsReloaded(),
      onDatasetChange: (_operations: Object[]) => notifyVideoRowsReloaded(),
    } as DataChangeListener
    this.dataSource.registerDataChangeListener(this.dataChangeListener)
  }

  aboutToDisappear(): void {
    const listener = this.dataChangeListener
    if (listener) {
      this.dataSource.unregisterDataChangeListener(listener)
      this.dataChangeListener = undefined
    }
  }

  @Builder
  private BottomTabSpacer() {
    Blank().height(HOME_MODE_BOTTOM_TAB_SPACER)
  }

  @Builder
  private LoadMoreFooter() {
    Column({ space: 10 }) {
      Row({ space: 10 }) {
        LoadingProgress()
          .width(22)
          .height(22)
          .color(this.theme.textMuted)

        Column({ space: 8 }) {
          Blank()
            .width(96)
            .height(14)
            .backgroundColor(this.theme.elevated)
            .borderRadius(7)
          Blank()
            .width('72%')
            .height(14)
            .backgroundColor(this.theme.elevated)
            .borderRadius(7)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Blank()
          .width(68)
          .height(58)
          .backgroundColor(this.theme.elevated)
          .borderRadius(8)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Text('正在加载更多')
        .fontSize(12)
        .fontColor(this.theme.textMuted)
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 18, bottom: 18 })
    .margin({ top: HOME_MODE_CONTENT_GAP })
    .backgroundColor(this.theme.surface)
    .borderRadius(8)
    .border({ width: 0.8, color: this.theme.divider })
  }

  @Builder
  private EmptyOrLoadingState() {
    Column({ space: 0 }) {
      if (this.mode !== 'articles') {
        Blank().height(HOME_MODE_CONTENT_GAP)
      }
      if (this.isLoading) {
        HomeEmptyStateCard({
          message: '',
          loading: true,
          loadingMessage: '正在加载内容...',
          theme: this.theme,
        })
      } else {
        HomeEmptyStateCard({
          message: this.emptyStateTitle,
          loading: false,
          loadingMessage: '',
          theme: this.theme,
        })
      }
    }
    .width('100%')
  }

  @Builder
  private ArticleOrSocialList() {
    // 统一把列表容器间距收回到 0。社交流本来就是扁平流；
    // 文章流里的推文也对齐这套布局，只给普通文章卡单独补间距。
    List({ space: 0, scroller: this.scroller }) {
      ListItem() {
        Column() {
          Blank().height(HOME_MODE_SCENE_TOP_INSET)
        }
        .width('100%')
      }
      .width('100%')

      if (this.dataSource.totalCount() === 0) {
        ListItem() {
          this.EmptyOrLoadingState()
        }
        .width('100%')
      } else {
        LazyForEach(this.dataSource, (entry: EntryCardModel, index: number) => {
          ListItem() {
            if (this.shouldRenderTweetCard(entry)) {
              TweetEntryCard({
                presentation: this.callbacks.getTweetPresentation(entry),
                theme: this.theme,
                isUnread: !entry.isRead,
                flatMode: this.mode === 'social',
                showBottomDivider: this.mode === 'social' && index < this.dataSource.totalCount() - 1,
                highlightQuery: '',
                collapsedTextLines: 7,
                enableEnterTransition: false,
                onOpen: () => this.callbacks.onEntryOpen(entry),
                onOpenGallery: (urls: string[], idx: number): void => {
                  this.callbacks.onOpenTweetGallery(urls, idx)
                },
              })
            } else {
              HomeArticleEntryCard({
                entry,
                theme: this.theme,
                showUnreadDot: this.showUnreadDot,
                highlightQuery: '',
                onOpen: () => this.callbacks.onEntryOpen(entry),
              })
            }
          }
          .width('100%')
          .margin({ bottom: this.articleListItemBottomGap(entry, index) })
          .onAppear(() => this.callbacks.onItemAppear(index, this.dataSource.totalCount()))
        }, (entry: EntryCardModel, index: number) => homeEntryListRenderKey(entry, index))
      }

      if (this.isLoadingMore) {
        ListItem() {
          this.LoadMoreFooter()
        }
        .width('100%')
      }

      ListItem() {
        this.BottomTabSpacer()
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .cachedCount(HOME_LIST_CACHED_ITEM_COUNT)
    .clipContent(ContentClipMode.SAFE_AREA)
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
      this.callbacks.onWillScroll(scrollOffset, scrollSource)
      return undefined
    })
    .onDidScroll(() => {
      this.callbacks.onDidScroll()
    })
    .onDidStopDragging(() => {
      this.callbacks.onStopDragging()
    })
    .onReachEnd(() => {
      this.callbacks.onListEndReach(this.dataSource.totalCount())
    })
  }

  @Builder
  private PictureList() {
    List({ space: 0, scroller: this.scroller }) {
      ListItem() {
        Column() {
          Blank().height(HOME_MODE_SCENE_TOP_INSET)
        }
        .width('100%')
      }
      .width('100%')

      if (this.dataSource.totalCount() === 0) {
        ListItem() {
          this.EmptyOrLoadingState()
        }
        .width('100%')
      } else {
        LazyForEach(this.dataSource, (entry: EntryCardModel, index: number) => {
          ListItem() {
            PictureEntryCard({
              entry: this.callbacks.getPictureEntry(entry),
              index,
              authorLabel: entry.author || entry.feedTitle,
              feedImageUrl: entry.feedImageUrl,
              caption: this.callbacks.getPictureCaption(entry),
              pictureUrl: entry.imageUrl,
              galleryUrls: this.callbacks.getPictureGalleryUrls(entry),
              theme: this.theme,
              highlightQuery: '',
              enableEnterTransition: false,
              flatMode: true,
              showBottomDivider: index < this.dataSource.totalCount() - 1,
              onOpen: () => this.callbacks.onEntryOpen(entry),
            })
          }
          .width('100%')
          .onAppear(() => this.callbacks.onItemAppear(index, this.dataSource.totalCount()))
        }, (entry: EntryCardModel, index: number) => homeEntryListRenderKey(entry, index))
      }

      if (this.isLoadingMore) {
        ListItem() {
          this.LoadMoreFooter()
        }
        .width('100%')
      }

      ListItem() {
        this.BottomTabSpacer()
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .cachedCount(HOME_PICTURE_LIST_CACHED_ITEM_COUNT)
    .clipContent(ContentClipMode.SAFE_AREA)
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
      this.callbacks.onWillScroll(scrollOffset, scrollSource)
      return undefined
    })
    .onDidScroll(() => {
      this.callbacks.onDidScroll()
    })
    .onDidStopDragging(() => {
      this.callbacks.onStopDragging()
    })
    .onReachEnd(() => {
      this.callbacks.onListEndReach(this.dataSource.totalCount())
    })
  }

  @Builder
  private VideoGrid() {
    List({ space: 12, scroller: this.scroller }) {
      ListItem() {
        Column() {
          Blank().height(HOME_MODE_SCENE_TOP_INSET)
        }
        .width('100%')
      }
      .width('100%')

      if (this.dataSource.totalCount() === 0) {
        ListItem() {
          this.EmptyOrLoadingState()
        }
        .width('100%')
      } else {
        LazyForEach(this.videoRowDataSource, (rowEntries: EntryCardModel[], rowIndex: number) => {
          ListItem() {
            Row({ space: 12 }) {
              ForEach(rowEntries, (entry: EntryCardModel, entryIndex: number) => {
                HomeVideoEntryCard({
                  entry,
                  theme: this.theme,
                  highlightQuery: '',
                  showUnreadDot: this.showUnreadDot,
                  onOpen: () => this.callbacks.onEntryOpen(entry),
                })
                  .layoutWeight(1)
              }, (entry: EntryCardModel, entryIndex: number) => {
                return homeEntryListRenderKey(entry, (rowIndex * resolveHomeVideoGridColumns()) + entryIndex)
              })

              if (rowEntries.length < resolveHomeVideoGridColumns()) {
                Blank()
                  .layoutWeight(1)
              }
            }
            .width('100%')
          }
          .width('100%')
          .onAppear(() => {
            const total = this.dataSource.totalCount()
            const rowTailIndex = Math.min(total - 1, ((rowIndex + 1) * resolveHomeVideoGridColumns()) - 1)
            if (rowTailIndex >= 0) {
              this.callbacks.onItemAppear(rowTailIndex, total)
            }
          })
        }, (rowEntries: EntryCardModel[], rowIndex: number) => homeVideoRowRenderKey(rowEntries, rowIndex))
      }

      if (this.isLoadingMore) {
        ListItem() {
          this.LoadMoreFooter()
        }
        .width('100%')
      }

      ListItem() {
        this.BottomTabSpacer()
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .cachedCount(HOME_VIDEO_LIST_CACHED_ROW_COUNT)
    .clipContent(ContentClipMode.SAFE_AREA)
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
      this.callbacks.onWillScroll(scrollOffset, scrollSource)
      return undefined
    })
    .onDidScroll(() => {
      this.callbacks.onDidScroll()
    })
    .onDidStopDragging(() => {
      this.callbacks.onStopDragging()
    })
    .onReachEnd(() => {
      this.callbacks.onListEndReach(this.dataSource.totalCount())
    })
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        if (resolveHomeVideoSceneKind(this.mode) === 'grid') {
          this.VideoGrid()
        } else if (this.mode === 'pictures') {
          this.PictureList()
        } else {
          this.ArticleOrSocialList()
        }
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height('100%')
    .visibility(this.sceneVisible)
    .opacity(this.listSwapOpacity !== 1 ? this.listSwapOpacity : this.sceneOpacity)
    .translate({ x: this.sceneOffsetX, y: this.listSwapTranslateY })
    .zIndex(this.sceneZIndex)
  }
}
