import { AvatarTile } from './AvatarTile'
import { HighlightedInlineText } from './HighlightedInlineText'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'
import { TweetEntryPresentation, TweetQuotedPresentation } from '../utils/TweetEntryPresentation'

@Component
export struct ArticleSocialDetail {
  @Prop presentation: TweetEntryPresentation = {} as TweetEntryPresentation
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  isInlineVideoActive: (section: string, item: PictureCarouselMediaItem, index: number) => boolean = () => false
  inlineVideoControllerFor: (section: string, item: PictureCarouselMediaItem, index: number) => VideoController = () => new VideoController()
  onPlayInlineVideo: (section: string, item: PictureCarouselMediaItem, index: number) => void = () => {}
  onOpenImage: (item: PictureCarouselMediaItem) => void = () => {}

  private usernameLabel(): string {
    return (this.presentation.username || '').trim()
  }

  private mediaItemsFromUrls(urls: string[]): PictureCarouselMediaItem[] {
    const normalizedUrls = (urls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
    const fallbackImage = normalizedUrls.find((url: string) => !isDirectVideoUrl(url)) || ''
    return resolvePictureCarouselMediaItems(normalizedUrls, fallbackImage).slice(0, 4)
  }

  private tweetMediaItems(): PictureCarouselMediaItem[] {
    return this.mediaItemsFromUrls(this.presentation.mediaUrls || [])
  }

  private hasQuotedTweet(): boolean {
    return (
      (this.presentation.kind === 'quote' || this.presentation.kind === 'retweet')
      && !!this.presentation.quotedTweet
    )
  }

  private quotedTweetPresentation(): TweetQuotedPresentation {
    return this.presentation.quotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private quotedTweetMediaItems(): PictureCarouselMediaItem[] {
    return this.mediaItemsFromUrls(this.quotedTweetPresentation().mediaUrls || [])
  }

  private quotedTweetHeaderLabel(): string {
    const baseLabel = (this.quotedTweetPresentation().displayName || '').trim()
      || (this.quotedTweetPresentation().username || '').trim()
      || '未知来源'
    return baseLabel.endsWith(':') ? baseLabel : `${baseLabel}:`
  }

  private hasNestedQuotedTweet(): boolean {
    return this.hasQuotedTweet() && !!this.quotedTweetPresentation().nestedQuotedTweet
  }

  private nestedQuotedTweetPresentation(): TweetQuotedPresentation {
    return this.quotedTweetPresentation().nestedQuotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private nestedQuotedTweetMediaItems(): PictureCarouselMediaItem[] {
    return this.mediaItemsFromUrls(this.nestedQuotedTweetPresentation().mediaUrls || [])
  }

  private nestedQuotedTweetHeaderLabel(): string {
    const baseLabel = (this.nestedQuotedTweetPresentation().displayName || '').trim()
      || (this.nestedQuotedTweetPresentation().username || '').trim()
      || '未知来源'
    return baseLabel.endsWith(':') ? baseLabel : `${baseLabel}:`
  }

  private isTweetMediaVideo(item: PictureCarouselMediaItem): boolean {
    return !!(item.videoUrl || '').trim()
  }

  private tweetMediaTileWidth(index: number, count: number): string {
    if (count <= 1) {
      return '100%'
    }
    if (count === 3 && index === 0) {
      return '100%'
    }
    return '49.2%'
  }

  private tweetMediaTileHeight(index: number, count: number): number {
    if (count <= 1) {
      return 208
    }
    if (count === 3 && index === 0) {
      return 148
    }
    return 136
  }

  private openMediaItem(section: string, item: PictureCarouselMediaItem, index: number): void {
    if (this.isTweetMediaVideo(item)) {
      this.onPlayInlineVideo(section, item, index)
      return
    }
    this.onOpenImage(item)
  }

  @Builder
  private TweetMediaTile(section: string, item: PictureCarouselMediaItem, index: number, count: number, radius: number) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.isTweetMediaVideo(item) && this.isInlineVideoActive(section, item, index)) {
        Video({
          src: item.videoUrl,
          controller: this.inlineVideoControllerFor(section, item, index),
          previewUri: item.imageUrl,
        })
          .width(this.tweetMediaTileWidth(index, count))
          .height(this.tweetMediaTileHeight(index, count))
          .borderRadius(radius)
          .controls(true)
          .autoPlay(true)
          .muted(false)
      } else {
        if ((item.imageUrl || '').trim()) {
          if (count <= 1) {
            Image(item.imageUrl)
              .width('100%')
              .borderRadius(radius)
              .backgroundColor(this.theme.elevated)
          } else {
            Image(item.imageUrl)
              .width(this.tweetMediaTileWidth(index, count))
              .height(this.tweetMediaTileHeight(index, count))
              .borderRadius(radius)
              .objectFit(ImageFit.Cover)
              .backgroundColor(this.theme.elevated)
          }
        } else {
          Column()
            .width(this.tweetMediaTileWidth(index, count))
            .height(this.tweetMediaTileHeight(index, count))
            .borderRadius(radius)
            .backgroundColor(this.theme.elevated)
        }

        if (this.isTweetMediaVideo(item)) {
          Row() {
            SymbolGlyph($r('sys.symbol.play_fill'))
              .fontSize(28)
              .fontColor(['#F5F5F5'])
          }
          .width(56)
          .height(56)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .borderRadius(999)
          .backgroundColor('rgba(168,168,168,0.58)')
        }
      }
    }
    .width(count <= 1 ? '100%' : this.tweetMediaTileWidth(index, count))
    .margin({ bottom: count > 1 ? 6 : 0 })
    .onClick(() => {
      this.openMediaItem(section, item, index)
    })
  }

  @Builder
  private QuotedTweetDetail() {
    Column({ space: 8 }) {
      Text('RT')
        .fontSize(12)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textMuted)
        .width('100%')

      Text() {
        Span(this.quotedTweetHeaderLabel())
          .fontWeight(FontWeight.Bold)

        if ((this.quotedTweetPresentation().text || '').trim()) {
          Span(` ${(this.quotedTweetPresentation().text || '').trim()}`)
            .fontWeight(FontWeight.Regular)
        }
      }
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme.textPrimary)
        .width('100%')

      if (this.quotedTweetMediaItems().length > 0) {
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          ForEach(this.quotedTweetMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
            this.TweetMediaTile('quoted', item, index, this.quotedTweetMediaItems().length, 8)
          }, (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`)
        }
        .width('100%')
        .clip(true)
      }

      if (this.hasNestedQuotedTweet()) {
        this.NestedQuotedTweetDetail()
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 2, right: 2, top: 2, bottom: 2 })
  }

  @Builder
  private NestedQuotedTweetDetail() {
    Column({ space: 0 }) {
      Column({ space: 8 }) {
        Text('RT')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textMuted)
          .width('100%')

        Text() {
          Span(this.nestedQuotedTweetHeaderLabel())
            .fontWeight(FontWeight.Bold)

          if ((this.nestedQuotedTweetPresentation().text || '').trim()) {
            Span(` ${(this.nestedQuotedTweetPresentation().text || '').trim()}`)
              .fontWeight(FontWeight.Regular)
          }
        }
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textPrimary)
          .width('100%')
      }
      .width('100%')
      .padding({
        left: 10,
        right: 10,
        top: 10,
        bottom: this.nestedQuotedTweetMediaItems().length > 0 ? 8 : 10,
      })

      if (this.nestedQuotedTweetMediaItems().length > 0) {
        Column() {
          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
            ForEach(this.nestedQuotedTweetMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
              this.TweetMediaTile('nested', item, index, this.nestedQuotedTweetMediaItems().length, 0)
            }, (item: PictureCarouselMediaItem, index: number) => `nested_${item.imageUrl}_${item.videoUrl}_${index}`)
          }
          .width('100%')
        }
        .width('100%')
        .padding(1)
        .backgroundColor(this.theme.divider)
        .clip(true)
      }
    }
    .width('100%')
    .borderRadius(10)
    .border({ width: 0.8, color: this.theme.divider })
    .backgroundColor(this.theme.surface)
    .clip(true)
  }

  build() {
    Column({ space: 8 }) {
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
            query: '',
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
              query: '',
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
          query: '',
          theme: this.theme,
          fontSize: 16,
          lineHeight: 24,
          defaultColor: this.theme.textPrimary,
          maxLines: 99,
        })
          .width('100%')
      }

      if (this.hasQuotedTweet()) {
        this.QuotedTweetDetail()
      }

      if (this.tweetMediaItems().length > 0) {
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          ForEach(this.tweetMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
            this.TweetMediaTile('main', item, index, this.tweetMediaItems().length, 10)
          }, (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`)
        }
        .width('100%')
        .clip(true)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
