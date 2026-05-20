import { AvatarTile } from './AvatarTile'
import { HighlightedInlineText } from './HighlightedInlineText'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'
import { TweetEntryPresentation, TweetQuotedPresentation } from '../utils/social/TweetEntryPresentation'
import { QuotedTweetRenderer } from './QuotedTweetRenderer'

@Component
export struct ArticleSocialDetail {
  @Prop presentation: TweetEntryPresentation = {} as TweetEntryPresentation
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  isInlineVideoActive: (section: string, item: PictureCarouselMediaItem, index: number) => boolean = () => false
  inlineVideoControllerFor: (section: string, item: PictureCarouselMediaItem, index: number) => VideoController = () => new VideoController()
  onPlayInlineVideo: (section: string, item: PictureCarouselMediaItem, index: number) => void = () => {}
  onOpenGallery: (url: string) => void = () => {}
  onOpenVideoFullscreen?: (item: PictureCarouselMediaItem, index: number) => void

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

  private startInlineVideo(section: string, item: PictureCarouselMediaItem, index: number): void {
    try {
      console.info(
        `[SOCIAL_VIDEO][ArticleSocialDetail] start playback section=${section} index=${index} videoUrl=${item.videoUrl}`,
      )
      this.inlineVideoControllerFor(section, item, index).start()
    } catch (error) {
      console.error(`Failed to start article social video: ${error instanceof Error ? error.message : error}`)
    }
  }

  private openMediaItem(section: string, item: PictureCarouselMediaItem, index: number): void {
    if (this.isTweetMediaVideo(item)) {
      this.onPlayInlineVideo(section, item, index)
      return
    }
    this.onOpenGallery(item.imageUrl)
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
          .objectFit(ImageFit.Contain)
          .onPrepared(() => {
            console.info(
              `[SOCIAL_VIDEO][ArticleSocialDetail] prepared section=${section} index=${index} videoUrl=${item.videoUrl}`,
            )
            this.startInlineVideo(section, item, index)
          })
          .onStart(() => {
            console.info(
              `[SOCIAL_VIDEO][ArticleSocialDetail] started section=${section} index=${index} videoUrl=${item.videoUrl}`,
            )
          })
          .onError(() => {
            console.error(
              `[SOCIAL_VIDEO][ArticleSocialDetail] error section=${section} index=${index} videoUrl=${item.videoUrl}`,
            )
          })
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
    .onTouch((event: TouchEvent) => {
      event.stopPropagation()
    })
    .onClick(() => {
      console.info(
        `[SOCIAL_VIDEO][ArticleSocialDetail] tap media section=${section} index=${index} isVideo=${this.isTweetMediaVideo(item)} videoUrl=${item.videoUrl}`,
      )
      this.openMediaItem(section, item, index)
    })
    .gesture(
      LongPressGesture({ repeat: false, duration: 500 })
        .onAction(() => {
          if (this.isTweetMediaVideo(item) && this.onOpenVideoFullscreen) {
            this.onOpenVideoFullscreen(item, index)
          }
        })
    )
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
        QuotedTweetRenderer({
          quotedTweet: this.quotedTweetPresentation(),
          theme: this.theme,
          flatMode: false,
          isTextExpanded: true,
          isInlineVideoActive: (sectionTag: string, item: PictureCarouselMediaItem, index: number): boolean => {
            return this.isInlineVideoActive(sectionTag, item, index)
          },
          inlineVideoControllerFor: (sectionTag: string, item: PictureCarouselMediaItem, index: number): VideoController => {
            return this.inlineVideoControllerFor(sectionTag, item, index)
          },
          onPlayInlineVideo: (sectionTag: string, item: PictureCarouselMediaItem, index: number): void => {
            this.onPlayInlineVideo(sectionTag, item, index)
          },
          onOpenGallery: (url: string): void => {
            this.onOpenGallery(url)
          },
          onOpenVideoFullscreen: this.onOpenVideoFullscreen,
        })
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
