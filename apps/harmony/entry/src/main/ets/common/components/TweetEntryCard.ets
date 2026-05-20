import { HighlightedInlineText } from './HighlightedInlineText'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { TweetEntryPresentation, TweetQuotedPresentation } from '../utils/social/TweetEntryPresentation'
import { AvatarTile } from './AvatarTile'
import { QuotedTweetRenderer } from './QuotedTweetRenderer'
import { InlineMediaGrid } from './quoted-tweet/InlineMediaGrid'
import { PictureCarouselMediaItem } from '../utils/PictureGallery'
import { inlineMediaItemsCacheKey, inlineMediaItemsFromUrls, MAIN_TILE_SIZE } from '../utils/InlineMediaLayout'

interface TweetEntryCardPadding {
  left: number
  right: number
  top: number
  bottom: number
}

const QUOTED_TWEET_COLLAPSED_LINES: number = 8

@Component
export struct TweetEntryCard {
  @Prop presentation: TweetEntryPresentation = {} as TweetEntryPresentation
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop isUnread: boolean = false
  @Prop flatMode: boolean = false
  @Prop showBottomDivider: boolean = false
  @StorageProp('showUnreadDot') showUnreadDot: boolean = true
  @Prop enableEnterTransition: boolean = true
  @Prop highlightQuery: string = ''
  @Prop collapsedTextLines: number = 0
  @State private isTextExpanded: boolean = false
  @State private isQuotedTextExpanded: boolean = false
  @State private activeInlineVideoKey: string = ''
  private readonly inlineVideoControllers: Map<string, VideoController> = new Map()
  private mainMediaItemsCacheKey: string = ''
  private mainMediaItemsCache: PictureCarouselMediaItem[] = []
  private quotedMediaItemsCacheKey: string = ''
  private quotedMediaItemsCache: PictureCarouselMediaItem[] = []

  onOpen: () => void = () => {}

  private usernameLabel(): string {
    return (this.presentation.username || '').trim()
  }

  private mediaItemsFromUrls(urls: string[]): PictureCarouselMediaItem[] {
    return inlineMediaItemsFromUrls(urls)
  }

  private mediaItemsCacheKey(urls: string[]): string {
    return inlineMediaItemsCacheKey(urls)
  }

  private normalizedMediaItems(): PictureCarouselMediaItem[] {
    const mediaUrls = this.presentation.mediaUrls || []
    const cacheKey = this.mediaItemsCacheKey(mediaUrls)
    if (cacheKey !== this.mainMediaItemsCacheKey) {
      this.mainMediaItemsCacheKey = cacheKey
      this.mainMediaItemsCache = this.mediaItemsFromUrls(mediaUrls)
    }
    return this.mainMediaItemsCache
  }

  private hasQuotedTweet(): boolean {
    return (
      (this.presentation.kind === 'quote' || this.presentation.kind === 'retweet')
      && !!this.presentation.quotedTweet
    )
  }

  private resolvedTweetTextMaxLines(): number {
    if (this.isTextExpanded || this.collapsedTextLines <= 0) {
      return 99
    }
    return this.collapsedTextLines
  }

  private shouldShowExpandAction(): boolean {
    if (this.isTextExpanded || this.collapsedTextLines <= 0) {
      return false
    }
    const text = (this.presentation.text || '').trim()
    if (!text) {
      return false
    }
    // 使用内容长度做轻量判断，避免引入额外测量节点带来抖动。
    const threshold = this.collapsedTextLines * 22
    return text.length > threshold || text.includes('\n')
  }

  private quotedTweet(): TweetQuotedPresentation {
    return this.presentation.quotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private quotedUsernameLabel(): string {
    return (this.quotedTweet().username || '').trim()
  }

  private quotedInlineNameLabel(): string {
    const name = (this.quotedTweet().displayName || '').trim()
      || this.quotedUsernameLabel()
      || '未知来源'
    return name.endsWith(':') ? name : `${name}:`
  }

  private resolvedQuotedTextMaxLines(): number {
    if (this.isQuotedTextExpanded) {
      return 99
    }
    return this.shouldShowQuotedExpandAction() ? QUOTED_TWEET_COLLAPSED_LINES : 99
  }

  private shouldShowQuotedExpandAction(): boolean {
    if (this.isQuotedTextExpanded) {
      return false
    }
    const text = (this.quotedTweet().text || '').trim()
    if (!text) {
      return false
    }
    const lineBreakCount = (text.match(/\n/g) || []).length + 1
    if (lineBreakCount > QUOTED_TWEET_COLLAPSED_LINES) {
      return true
    }
    const threshold = QUOTED_TWEET_COLLAPSED_LINES * 24
    return text.length > threshold
  }

  private quotedMediaItems(): PictureCarouselMediaItem[] {
    const mediaUrls = this.quotedTweet().mediaUrls || []
    const cacheKey = this.mediaItemsCacheKey(mediaUrls)
    if (cacheKey !== this.quotedMediaItemsCacheKey) {
      this.quotedMediaItemsCacheKey = cacheKey
      this.quotedMediaItemsCache = this.mediaItemsFromUrls(mediaUrls)
    }
    return this.quotedMediaItemsCache
  }

  private hasSingleQuotedVideoMedia(): boolean {
    const items = this.quotedMediaItems()
    return items.length === 1 && !!(items[0].videoUrl || '').trim()
  }

  private quotedPrimaryMediaItem(): PictureCarouselMediaItem {
    const items = this.quotedMediaItems()
    if (items.length > 0) {
      return items[0]
    }
    return { kind: 'image', imageUrl: '', videoUrl: '' }
  }

  private mediaRenderKey(section: string, item: PictureCarouselMediaItem, index: number): string {
    return `${section}_${index}_${item.imageUrl}_${item.videoUrl}`
  }

  private isInlineVideoActive(section: string, item: PictureCarouselMediaItem, index: number): boolean {
    return this.activeInlineVideoKey === this.mediaRenderKey(section, item, index)
  }

  private inlineVideoControllerFor(section: string, item: PictureCarouselMediaItem, index: number): VideoController {
    const key = this.mediaRenderKey(section, item, index)
    const existing = this.inlineVideoControllers.get(key)
    if (existing) {
      return existing
    }
    const controller = new VideoController()
    this.inlineVideoControllers.set(key, controller)
    return controller
  }

  private playInlineVideo(section: string, item: PictureCarouselMediaItem, index: number): void {
    if (!(item.videoUrl || '').trim()) {
      return
    }
    this.activeInlineVideoKey = this.mediaRenderKey(section, item, index)
  }

  private cardPadding(): TweetEntryCardPadding {
    if (this.flatMode) {
      return { left: 0, right: 0, top: 12, bottom: 12 }
    }
    return { left: 14, right: 14, top: 12, bottom: 10 }
  }

  private cardBackgroundColor(): string {
    return this.flatMode ? '#00000000' : this.theme.surface
  }

  private cardBorderWidth(): number {
    return this.flatMode ? 0 : 0.8
  }

  private cardBorderRadius(): number {
    return this.flatMode ? 0 : 14
  }

  @Builder
  private RetweetBanner() {
  }

  @Builder
  private MediaGrid() {
    if (this.normalizedMediaItems().length > 0) {
      InlineMediaGrid({
        items: this.normalizedMediaItems(),
        theme: this.theme,
        tileSize: MAIN_TILE_SIZE,
        tileBorderRadius: 0,
        containerBorderRadius: 12,
        isVideoActive: (item: PictureCarouselMediaItem, index: number): boolean => {
          return this.isInlineVideoActive('main', item, index)
        },
        controllerFor: (item: PictureCarouselMediaItem, index: number): VideoController => {
          return this.inlineVideoControllerFor('main', item, index)
        },
        onTap: (item: PictureCarouselMediaItem, index: number): void => {
          if ((item.videoUrl || '').trim()) {
            this.playInlineVideo('main', item, index)
          }
        },
      })
    }
  }

  @Builder
  private RtSection() {
    if (this.hasQuotedTweet()) {
      QuotedTweetRenderer({
        quotedTweet: this.quotedTweet(),
        theme: this.theme,
        flatMode: this.flatMode,
        isTextExpanded: this.isQuotedTextExpanded,
        onExpandText: () => {
          this.isQuotedTextExpanded = true
        },
        isInlineVideoActive: (sectionTag: string, item: PictureCarouselMediaItem, index: number): boolean => {
          return this.isInlineVideoActive(sectionTag, item, index)
        },
        inlineVideoControllerFor: (sectionTag: string, item: PictureCarouselMediaItem, index: number): VideoController => {
          return this.inlineVideoControllerFor(sectionTag, item, index)
        },
        onPlayInlineVideo: (sectionTag: string, item: PictureCarouselMediaItem, index: number): void => {
          this.playInlineVideo(sectionTag, item, index)
        },
      })
    }
  }

  @Builder
  private UnreadDot() {
    if (this.isUnread && this.showUnreadDot) {
      Row()
        .width(8)
        .height(8)
        .borderRadius(999)
        .backgroundColor(this.theme.accent)
        .margin({ right: 8, top: 8 })
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column({ space: 8 }) {
        this.RetweetBanner()

        Row({ space: 8 }) {
          AvatarTile({
            imageUrl: this.presentation.avatarUrl,
            fallbackLabel: this.presentation.displayName,
            accent: this.theme.accent,
            theme: this.theme,
            avatarSize: 17,
            radius: 999,
            textSize: 11,
            showFallbackLabel: false,
          })

          Row({ space: 4 }) {
            HighlightedInlineText({
              text: this.presentation.displayName || '未知来源',
              query: this.highlightQuery,
              theme: this.theme,
              fontSize: 16,
              lineHeight: 20,
              fontWeight: FontWeight.Bold,
              defaultColor: this.theme.textPrimary,
              maxLines: 1,
            })

            if (this.usernameLabel()) {
              HighlightedInlineText({
                text: this.usernameLabel(),
                query: this.highlightQuery,
                theme: this.theme,
                fontSize: 14,
                lineHeight: 18,
                defaultColor: this.theme.textMuted,
                maxLines: 1,
              })
            }

            if (this.presentation.publishedLabel) {
              Text(`· ${this.presentation.publishedLabel}`)
                .fontSize(13)
                .fontColor(this.theme.textMuted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .layoutWeight(1)
            }
          }
          .layoutWeight(1)
        }
        .width('100%')
        .alignItems(VerticalAlign.Top)

        if (this.presentation.text) {
          HighlightedInlineText({
            text: this.presentation.text,
            query: this.highlightQuery,
            theme: this.theme,
            fontSize: 16,
            lineHeight: 24,
            defaultColor: this.theme.textPrimary,
            maxLines: this.resolvedTweetTextMaxLines(),
          })
            .width('100%')

          if (this.shouldShowExpandAction()) {
            Text('显示更多')
              .fontSize(14)
              .fontWeight(FontWeight.Medium)
              .fontColor('#1677FF')
              .margin({ top: -2 })
              .onClick(() => {
                this.isTextExpanded = true
              })
          }
        }

        this.RtSection()
        this.MediaGrid()

        if (this.flatMode && this.showBottomDivider) {
          Row()
            .width('100%')
            .height(0.8)
            .backgroundColor(this.theme.divider)
            .margin({ top: 10 })
        }
      }
      .width('100%')

      this.UnreadDot()
    }
    .width('100%')
    .padding(this.cardPadding())
    .backgroundColor(this.cardBackgroundColor())
    .borderRadius(this.cardBorderRadius())
    .border({ width: this.cardBorderWidth(), color: this.theme.divider })
    .transition(this.enableEnterTransition ? livoMotion.enterSoft(24) : TransitionEffect.IDENTITY)
    .onClick(() => {
      this.onOpen()
    })
  }
}
