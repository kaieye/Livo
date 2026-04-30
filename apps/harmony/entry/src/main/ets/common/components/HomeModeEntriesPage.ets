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
  getTweetPresentation: (entry: EntryCardModel) => TweetEntryPresentation
  getPictureEntry: (entry: EntryCardModel) => Entry
  getPictureCaption: (entry: EntryCardModel) => string
  getPictureGalleryUrls: (entry: EntryCardModel) => string[]
}

@Component
export struct HomeModeEntriesPage {
  @Prop mode: SubscriptionMode = 'articles'
  @Prop entries: EntryCardModel[] = []
  @Prop totalCount: number = 0
  @Prop isLoading: boolean = false
  @Prop emptyStateTitle: string = ''
  @Prop refreshGapHeight: number = 0
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop searchQuery: string = ''
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
    getTweetPresentation: () => ({} as TweetEntryPresentation),
    getPictureEntry: () => ({} as Entry),
    getPictureCaption: () => '',
    getPictureGalleryUrls: () => [],
  }

  @Builder
  private RefreshGapSlot() {
    Column()
      .width('100%')
      .height(this.refreshGapHeight)
      .animation({ duration: 180, curve: Curve.EaseOut })
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
          this.RefreshGapSlot()
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
        ForEach(this.entries, (entry: EntryCardModel, index: number) => {
          ListItem() {
            if (this.mode === 'social' && isTweetLikeEntry(entry)) {
              TweetEntryCard({
                presentation: this.callbacks.getTweetPresentation(entry),
                theme: this.theme,
                isUnread: !entry.isRead,
                flatMode: true,
                showBottomDivider: index < this.entries.length - 1,
                highlightQuery: this.searchQuery,
                collapsedTextLines: 7,
                enableEnterTransition: false,
                onOpen: () => this.callbacks.onEntryOpen(entry),
              })
            } else {
              HomeArticleEntryCard({
                entry,
                theme: this.theme,
                showUnreadDot: this.showUnreadDot,
                highlightQuery: this.searchQuery,
                onOpen: () => this.callbacks.onEntryOpen(entry),
              })
            }
          }
          .width('100%')
          .onAppear(() => this.callbacks.onItemAppear(index, this.entries.length))
        }, (entry: EntryCardModel, index: number) => homeEntryListRenderKey(entry, index))
      }

      ListItem() {
        Row().height(100).width('100%')
      }
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
          this.RefreshGapSlot()
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
        ForEach(this.entries, (entry: EntryCardModel, index: number) => {
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
              highlightQuery: this.searchQuery,
              enableEnterTransition: false,
              flatMode: true,
              showBottomDivider: index < this.entries.length - 1,
              onOpen: () => this.callbacks.onEntryOpen(entry),
            })
          }
          .width('100%')
          .onAppear(() => this.callbacks.onItemAppear(index, this.entries.length))
        }, (entry: EntryCardModel) => entry.id)
      }

      ListItem() {
        Row().height(100).width('100%')
      }
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
        Column() {
          Blank().height(HOME_MODE_SCENE_TOP_INSET)
          this.RefreshGapSlot()
        }
        .width('100%')

        HomeVideoGrid({
          entries: this.entries,
          highlightQuery: this.searchQuery,
          inheritedTheme: this.theme,
          isLoading: this.isLoading,
          onOpenEntry: (entry: EntryCardModel) => {
            this.callbacks.onEntryOpen(entry)
          },
        })

        Row().width('100%').height(100)
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
