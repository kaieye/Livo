import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { EntryCardModel, selectPictureCarouselMediaUrls, Entry } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
import { SubscriptionMode, HOME_MODE_CONTENT_GAP, HOME_MODE_SCENE_TOP_INSET } from '../components/HomeRootConfig'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { homeEntryListRenderKey, isTweetLikeEntry } from '../utils/HomeEntryUtils'
import { HomeArticleEntryCard } from './HomeArticleEntryCard'
import { HomeVideoGrid } from './HomeVideoGrid'
import { PictureEntryCard } from './PictureEntryCard'
import { TweetEntryCard } from './TweetEntryCard'
import { HomeEmptyStateCard } from './HomeEmptyStateCard'
import { TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { resolveHomeVideoSceneKind } from '../utils/HomeVideoGrid'

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
}

@Component
export struct HomeModeEntriesPage {
  @Prop mode: SubscriptionMode = 'articles'
  @Prop entries: EntryCardModel[] = []
  // dataSource is a class instance (with closures + listener registry) and is
  // therefore passed as a plain field rather than @Prop. ArkUI @Prop deep-copy
  // would otherwise strip its prototype methods. The parent always supplies a
  // mode-specific instance at construction; the listener registered in
  // aboutToAppear keeps this component in sync with notifyDataReloaded.
  dataSource: ArrayLazyDataSource<EntryCardModel> = new ArrayLazyDataSource<EntryCardModel>(() => [])
  @Prop totalCount: number = 0
  @Prop isLoading: boolean = false
  @Prop emptyStateTitle: string = ''
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop showUnreadDot: boolean = true
  @Prop sceneOpacity: number = 1
  @Prop sceneOffsetX: number = 0
  @Prop sceneZIndex: number = 0
  @Prop sceneVisible: Visibility = Visibility.Visible
  @Prop listSwapOpacity: number = 1
  @Prop listSwapTranslateY: number = 0
  // Bumped whenever the bound dataSource emits a change notification. Forces
  // ArkUI to re-evaluate build() so the video branch (which derives its
  // entries from dataSource on each render) picks up new items even though
  // the entries @Prop chain may not propagate through cached TabContent.
  @State private dataChangeTrigger: number = 0
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
  }
  private dataChangeListener: DataChangeListener | undefined = undefined

  aboutToAppear(): void {
    const bump = (): void => {
      this.dataChangeTrigger = (this.dataChangeTrigger + 1) | 0
    }
    const bumpOnlyForVideo = (): void => {
      if (resolveHomeVideoSceneKind(this.mode) === 'grid') {
        bump()
      }
    }
    this.dataChangeListener = {
      onDataReloaded: bump,
      onDataAdd: (_index: number) => bumpOnlyForVideo(),
      onDataAdded: (_index: number) => bumpOnlyForVideo(),
      onDataMove: (_from: number, _to: number) => bump(),
      onDataMoved: (_from: number, _to: number) => bump(),
      onDataDelete: (_index: number) => bump(),
      onDataDeleted: (_index: number) => bump(),
      onDataChange: (_index: number) => bump(),
      onDataChanged: (_index: number) => bump(),
      onDatasetChange: (_operations: Object[]) => bump(),
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

  // Read every item from the data source. Used by the video branch which
  // can't consume LazyForEach directly (its grid layout needs all entries
  // up-front). Reading dataChangeTrigger here registers an ArkUI dependency
  // so this method's callers re-run whenever the underlying data changes.
  private currentEntries(): EntryCardModel[] {
    const _trigger = this.dataChangeTrigger
    const total = this.dataSource.totalCount()
    const items: EntryCardModel[] = []
    for (let index = 0; index < total; index++) {
      items.push(this.dataSource.getData(index))
    }
    return items
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
    List({ space: this.mode === 'social' ? 0 : HOME_MODE_CONTENT_GAP, scroller: this.scroller }) {
      ListItem() {
        Column() {
          Blank().height(HOME_MODE_SCENE_TOP_INSET)
        }
        .width('100%')
      }
      .width('100%')

      if (this.totalCount === 0) {
        ListItem() {
          this.EmptyOrLoadingState()
        }
        .width('100%')
      } else {
        LazyForEach(this.dataSource, (entry: EntryCardModel, index: number) => {
          ListItem() {
            if (this.mode === 'social' && isTweetLikeEntry(entry)) {
              TweetEntryCard({
                presentation: this.callbacks.getTweetPresentation(entry),
                theme: this.theme,
                isUnread: !entry.isRead,
                flatMode: true,
                showBottomDivider: index < this.totalCount - 1,
                highlightQuery: '',
                collapsedTextLines: 7,
                enableEnterTransition: false,
                onOpen: () => this.callbacks.onEntryOpen(entry),
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

      ListItem() {
        Row().height(100).width('100%')
      }
      .onAppear(() => this.callbacks.onListEndReach(this.dataSource.totalCount()))
    }
    .width('100%')
    .height('100%')
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

      if (this.totalCount === 0) {
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
              showBottomDivider: index < this.totalCount - 1,
              onOpen: () => this.callbacks.onEntryOpen(entry),
            })
          }
          .width('100%')
          .onAppear(() => this.callbacks.onItemAppear(index, this.dataSource.totalCount()))
        }, (entry: EntryCardModel, index: number) => homeEntryListRenderKey(entry, index))
      }

      ListItem() {
        Row().height(100).width('100%')
      }
      .onAppear(() => this.callbacks.onListEndReach(this.dataSource.totalCount()))
    }
    .width('100%')
    .height('100%')
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring)
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
  }

  @Builder
  private VideoGrid() {
    Scroll(this.scroller) {
      Column({ space: HOME_MODE_CONTENT_GAP }) {
        Blank().height(HOME_MODE_SCENE_TOP_INSET)

        HomeVideoGrid({
          entries: this.currentEntries(),
          highlightQuery: '',
          inheritedTheme: this.theme,
          isLoading: this.isLoading,
          onTailAppear: (totalCount: number) => {
            if (totalCount > 0) {
              this.callbacks.onItemAppear(totalCount - 1, totalCount)
            }
            this.callbacks.onListEndReach(totalCount)
          },
          onOpenEntry: (entry: EntryCardModel) => {
            this.callbacks.onEntryOpen(entry)
          },
        })

        Row().width('100%').height(100)
          .onAppear(() => this.callbacks.onListEndReach(this.dataSource.totalCount()))
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .alignItems(HorizontalAlign.Start)
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring)
    .onWillScroll((_xOffset: number, yOffset: number, _scrollState: ScrollState, scrollSource: ScrollSource) => {
      this.callbacks.onWillScroll(yOffset, scrollSource)
      return undefined
    })
    .onDidScroll(() => {
      this.callbacks.onDidScroll()
    })
    .onDidStopDragging(() => {
      this.callbacks.onStopDragging()
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
