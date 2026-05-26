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
import { homeEntryListRenderKey, homeVideoRowRenderKey, isTweetLikeEntry } from '../coordinators/home/HomeEntryUtils'
import { HomeArticleEntryCard } from './HomeArticleEntryCard'
import { HomeVideoEntryCard } from './HomeVideoEntryCard'
import { PictureEntryCard } from './PictureEntryCard'
import { TweetEntryCard } from './TweetEntryCard'
import { HomeEmptyStateCard } from './HomeEmptyStateCard'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { resolveHomeVideoGridColumns, resolveHomeVideoSceneKind } from '../coordinators/home/HomeVideoGrid'

// LazyForEach 默认 cachedCount=1 在双列视频网格里只缓存 2 张卡，快速滚动
// 时几乎每帧都要重新 build HomeVideoEntryCard（包含远程封面图解码），
// 这是视频模式滚动卡顿的核心原因。提高到 4 行(8 张卡)：覆盖视口上下各 2
// 行复用余量,显著减少快速回滚时"被截断的最后一行"和重复 mount。
const HOME_VIDEO_LIST_CACHED_ROW_COUNT: number = 4
// 文章是单列大卡,每屏元素少。cachedCount=4 足够覆盖滚动复用,
// load-more 完成后批量 build 卡片数减半,显著缓解"加载更多特别卡"。
const HOME_LIST_CACHED_ITEM_COUNT: number = 4
// 图片卡含 Swiper + Image 模糊层 + Video + 轮播指示器,单卡构建成本远
// 高于文章卡。cachedCount=4 让 load-more 后 LazyForEach 一次性 mount 的
// 卡片数从 12-13 张减到 ~6 张,主线程占用从几百 ms 降到百 ms 级。
const HOME_PICTURE_LIST_CACHED_ITEM_COUNT: number = 4

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

  // 文章流条目间距:此前在每个 ListItem 上读 dataSource.totalCount() 并算 margin,
  // LazyForEach itemBuilder 滑入新卡时每次都会再走一遍。改用 List({ space }) 让
  // 系统自动只在条目之间插入间距(末尾不会重复加),省掉 itemBuilder 内的查找。
  private articleListContainerSpace(): number {
    return this.mode === 'articles' ? HOME_MODE_CONTENT_GAP : 0
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
  private EmptyCard() {
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

  @Builder
  private ArticleOrSocialList() {
    // 文章模式给每个条目之间留 HOME_MODE_CONTENT_GAP；社交模式扁平流间距为 0。
    // 间距走 List 容器的 space,LazyForEach itemBuilder 不再每条都查 totalCount。
    List({ space: this.articleListContainerSpace(), scroller: this.scroller }) {
      if (this.dataSource.totalCount() === 0) {
        ListItem() {
          Column() {
            Blank().height(HOME_MODE_SCENE_TOP_INSET)
            Blank().height(HOME_MODE_CONTENT_GAP)
            this.EmptyCard()
          }
          .width('100%')
        }
        .width('100%')
      } else {
        ListItem() {
          Column() {
            Blank().height(HOME_MODE_SCENE_TOP_INSET)
          }
          .width('100%')
        }
        .width('100%')
        LazyForEach(this.dataSource, (entry: EntryCardModel, index: number) => {
          ListItem() {
            if (this.shouldRenderTweetCard(entry)) {
              TweetEntryCard({
                presentation: this.callbacks.getTweetPresentation(entry),
                theme: this.theme,
                isUnread: !entry.isRead,
                flatMode: this.mode === 'social',
                // 最后一条的分隔线被列表底部 BottomTabSpacer 覆盖,不再查 totalCount
                // 来跳过末尾,LazyForEach 复用时省掉一次 dataSource 访问。
                showBottomDivider: this.mode === 'social',
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
    .scrollBar(BarState.Off)
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
      if (this.dataSource.totalCount() === 0) {
        ListItem() {
          Column() {
            Blank().height(HOME_MODE_SCENE_TOP_INSET)
            Blank().height(HOME_MODE_CONTENT_GAP)
            this.EmptyCard()
          }
          .width('100%')
        }
        .width('100%')
      } else {
        ListItem() {
          Column() {
            Blank().height(HOME_MODE_SCENE_TOP_INSET)
          }
          .width('100%')
        }
        .width('100%')
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
              // 末尾分隔线被 BottomTabSpacer 遮挡;此前查 totalCount-1 的判断是
              // LazyForEach itemBuilder 滑入新卡时的固定开销,改为常量后省掉。
              showBottomDivider: true,
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
    .scrollBar(BarState.Off)
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
      // 首次进入视频栏目时,featured entries 可能先到 precache 的 1-2 条,
      // ensureModeEntriesLoaded 真正 reload 完成才会推满整页。如果直接渲染
      // videoRowDataSource,会出现"1 张卡 + 右列 Blank"的半行状态,体验上像
      // 应用卡住。所以在 isLoading 且数据不足一行(双列)时退化为 EmptyCard
      // (loading skeleton),等首页数据稳定再渲染网格。
      if (
        this.dataSource.totalCount() === 0
        || (this.isLoading && this.dataSource.totalCount() < resolveHomeVideoGridColumns())
      ) {
        ListItem() {
          Column() {
            Blank().height(HOME_MODE_SCENE_TOP_INSET)
            Blank().height(HOME_MODE_CONTENT_GAP)
            this.EmptyCard()
          }
          .width('100%')
        }
        .width('100%')
      } else {
        ListItem() {
          Column() {
            Blank().height(HOME_MODE_SCENE_TOP_INSET)
          }
          .width('100%')
        }
        .width('100%')
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
    .scrollBar(BarState.Off)
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
