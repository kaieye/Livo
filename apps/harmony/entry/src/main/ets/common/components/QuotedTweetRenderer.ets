import { ThemePalette, ThemeService } from '../services/ThemeService'
import { TweetQuotedPresentation } from '../utils/TweetEntryPresentation'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'

const QUOTED_TWEET_COLLAPSED_LINES: number = 8

@Component
export struct QuotedTweetRenderer {
  @Prop quotedTweet: TweetQuotedPresentation = {
    displayName: '',
    username: '',
    avatarUrl: '',
    text: '',
    mediaUrls: [],
  }
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop flatMode: boolean = false
  @Prop isTextExpanded: boolean = false

  onExpandText: () => void = () => {}
  isInlineVideoActive: (item: PictureCarouselMediaItem, index: number) => boolean = () => false
  inlineVideoControllerFor: (item: PictureCarouselMediaItem, index: number) => VideoController = () => new VideoController()
  onPlayInlineVideo: (item: PictureCarouselMediaItem, index: number) => void = () => {}
  private quotedMediaItemsCacheKey: string = ''
  private quotedMediaItemsCache: PictureCarouselMediaItem[] = []

  private quotedUsernameLabel(): string {
    return (this.quotedTweet.username || '').trim()
  }

  private quotedInlineNameLabel(): string {
    const name = (this.quotedTweet.displayName || '').trim()
      || this.quotedUsernameLabel()
      || '未知来源'
    return name.endsWith(':') ? name : `${name}:`
  }

  private resolvedQuotedTextMaxLines(): number {
    if (this.isTextExpanded) {
      return 99
    }
    return this.shouldShowQuotedExpandAction() ? QUOTED_TWEET_COLLAPSED_LINES : 99
  }

  private shouldShowQuotedExpandAction(): boolean {
    if (this.isTextExpanded) {
      return false
    }

    const text = (this.quotedTweet.text || '').trim()
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

  private mediaItemsFromUrls(urls: string[]): PictureCarouselMediaItem[] {
    const normalizedUrls = (urls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
    const fallbackImageUrl = normalizedUrls.find((url: string) => !this.isVideoLikeUrl(url)) || ''
    return resolvePictureCarouselMediaItems(normalizedUrls, fallbackImageUrl).slice(0, 4)
  }

  private mediaItemsCacheKey(urls: string[]): string {
    return (urls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
      .join('|')
  }

  private quotedMediaItems(): PictureCarouselMediaItem[] {
    const mediaUrls = this.quotedTweet.mediaUrls || []
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

  private hasNestedQuotedTweet(): boolean {
    return !!this.quotedTweet.nestedQuotedTweet
  }

  private nestedQuotedTweet(): TweetQuotedPresentation {
    return this.quotedTweet.nestedQuotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private nestedInlineNameLabel(): string {
    const nested = this.nestedQuotedTweet()
    const name = (nested.displayName || '').trim()
      || (nested.username || '').trim()
      || '未知来源'
    return name.endsWith(':') ? name : `${name}:`
  }

  private nestedQuotedMediaItems(): PictureCarouselMediaItem[] {
    const nested = this.nestedQuotedTweet()
    return this.mediaItemsFromUrls(nested.mediaUrls || [])
  }

  private hasSingleNestedQuotedVideoMedia(): boolean {
    const items = this.nestedQuotedMediaItems()
    return items.length === 1 && !!(items[0].videoUrl || '').trim()
  }

  private nestedQuotedPrimaryMediaItem(): PictureCarouselMediaItem {
    const items = this.nestedQuotedMediaItems()
    if (items.length > 0) {
      return items[0]
    }
    return { kind: 'image', imageUrl: '', videoUrl: '' }
  }

  private nestedMediaIndex(index: number): number {
    return index + 1000
  }

  private mediaTileWidth(index: number, count: number): string {
    if (count <= 1) {
      return '100%'
    }

    if (count === 3 && index === 0) {
      return '100%'
    }

    return '49.75%'
  }

  private mediaTileHeight(index: number, count: number): number {
    if (count <= 1) {
      return 208
    }

    if (count === 3 && index === 0) {
      return 144
    }

    return 112
  }

  private mediaTileBottomMargin(index: number, count: number): number {
    if (count <= 2) {
      return 0
    }

    if (count === 3) {
      return index === 0 ? 2 : 0
    }

    return index < 2 ? 2 : 0
  }

  private isVideoLikeUrl(url: string): boolean {
    const normalized = (url || '').trim().toLowerCase()
    if (!normalized) {
      return false
    }

    if (/\.(mp4|m4v|mov|webm|m3u8|mpd|avi|mkv)(\?|#|$)/i.test(normalized)) {
      return true
    }

    if (
      normalized.includes('youtube.com/watch') ||
      normalized.includes('youtu.be/') ||
      normalized.includes('bilibili.com/video/') ||
      normalized.includes('x.com/i/status/') ||
      normalized.includes('twitter.com/i/status/')
    ) {
      return true
    }

    return false
  }

  build() {
    Column({ space: 0 }) {
      Column({ space: 8 }) {
        Text('RT')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textMuted)
          .width('100%')

        Text() {
          Span(this.quotedInlineNameLabel())
            .fontWeight(FontWeight.Bold)

          if ((this.quotedTweet.text || '').trim()) {
            Span(` ${(this.quotedTweet.text || '').trim()}`)
              .fontWeight(FontWeight.Regular)
          }
        }
          .fontSize(16)
          .lineHeight(24)
          .fontColor(this.theme.textPrimary)
          .width('100%')
          .maxLines(this.resolvedQuotedTextMaxLines())
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        if (this.shouldShowQuotedExpandAction()) {
          Text('显示更多')
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .fontColor('#1677FF')
            .margin({ top: -2 })
            .onClick(() => {
              this.onExpandText()
            })
        }

        if (!this.hasSingleQuotedVideoMedia() && this.quotedMediaItems().length > 0) {
          Column() {
            Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
              ForEach(this.quotedMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
                Stack({ alignContent: Alignment.Center }) {
                  if ((item.videoUrl || '').trim() && this.isInlineVideoActive(item, index)) {
                    Video({
                      src: item.videoUrl,
                      controller: this.inlineVideoControllerFor(item, index),
                      previewUri: item.imageUrl,
                    })
                      .width(this.mediaTileWidth(index, this.quotedMediaItems().length))
                      .height(this.mediaTileHeight(index, this.quotedMediaItems().length))
                      .borderRadius(0)
                      .controls(true)
                      .autoPlay(true)
                      .muted(false)
                  } else {
                    if ((item.imageUrl || '').trim()) {
                      Image(item.imageUrl)
                        .width(this.mediaTileWidth(index, this.quotedMediaItems().length))
                        .height(this.mediaTileHeight(index, this.quotedMediaItems().length))
                        .borderRadius(0)
                        .objectFit(ImageFit.Cover)
                        .backgroundColor(this.theme.elevated)
                    } else {
                      Column()
                        .width(this.mediaTileWidth(index, this.quotedMediaItems().length))
                        .height(this.mediaTileHeight(index, this.quotedMediaItems().length))
                        .borderRadius(0)
                        .backgroundColor(this.theme.elevated)
                    }

                    if ((item.videoUrl || '').trim()) {
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
                  .margin({ bottom: this.mediaTileBottomMargin(index, this.quotedMediaItems().length) })
                  .onClick(() => {
                    this.onPlayInlineVideo(item, index)
                  })
              }, (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`)
            }
            .width('100%')
          }
          .width('100%')
          .padding(1)
          .borderRadius(10)
          .backgroundColor(this.theme.divider)
          .clip(true)
        }
      }
      .width('100%')
      .padding({
        left: 12,
        right: 12,
        top: 12,
        bottom: this.hasSingleQuotedVideoMedia() ? 10 : 12,
      })

      if (this.hasSingleQuotedVideoMedia()) {
        Stack({ alignContent: Alignment.Center }) {
          if (this.isInlineVideoActive(this.quotedPrimaryMediaItem(), 0)) {
            Video({
              src: this.quotedPrimaryMediaItem().videoUrl,
              controller: this.inlineVideoControllerFor(this.quotedPrimaryMediaItem(), 0),
              previewUri: this.quotedPrimaryMediaItem().imageUrl,
            })
              .width('100%')
              .height(208)
              .controls(true)
              .autoPlay(true)
              .muted(false)
          } else {
            if ((this.quotedPrimaryMediaItem().imageUrl || '').trim()) {
              Image(this.quotedPrimaryMediaItem().imageUrl)
                .width('100%')
                .height(208)
                .objectFit(ImageFit.Cover)
                .backgroundColor(this.theme.elevated)
            } else {
              Column()
                .width('100%')
                .height(208)
                .backgroundColor(this.theme.elevated)
            }

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
        .width('100%')
        .clip(true)
        .onClick(() => {
          this.onPlayInlineVideo(this.quotedPrimaryMediaItem(), 0)
        })
      }

      if (this.hasNestedQuotedTweet()) {
        Column() {
          Column({ space: 0 }) {
          Column({ space: 8 }) {
            Text('RT')
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textMuted)
              .width('100%')

            Text() {
              Span(this.nestedInlineNameLabel())
                .fontWeight(FontWeight.Bold)

              if ((this.nestedQuotedTweet().text || '').trim()) {
                Span(` ${(this.nestedQuotedTweet().text || '').trim()}`)
                  .fontWeight(FontWeight.Regular)
              }
            }
              .fontSize(15)
              .lineHeight(22)
              .fontColor(this.theme.textPrimary)
              .width('100%')
          }
          .width('100%')
          .padding({
            left: 10,
            right: 10,
            top: 10,
            bottom: this.nestedQuotedMediaItems().length > 0 ? 8 : 10,
          })

          if (!this.hasSingleNestedQuotedVideoMedia() && this.nestedQuotedMediaItems().length > 0) {
            Column() {
              Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
                ForEach(this.nestedQuotedMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
                  Stack({ alignContent: Alignment.Center }) {
                    if ((item.videoUrl || '').trim() && this.isInlineVideoActive(item, this.nestedMediaIndex(index))) {
                      Video({
                        src: item.videoUrl,
                        controller: this.inlineVideoControllerFor(item, this.nestedMediaIndex(index)),
                        previewUri: item.imageUrl,
                      })
                        .width(this.mediaTileWidth(index, this.nestedQuotedMediaItems().length))
                        .height(this.mediaTileHeight(index, this.nestedQuotedMediaItems().length))
                        .borderRadius(0)
                        .controls(true)
                        .autoPlay(true)
                        .muted(false)
                    } else {
                      if ((item.imageUrl || '').trim()) {
                        Image(item.imageUrl)
                          .width(this.mediaTileWidth(index, this.nestedQuotedMediaItems().length))
                          .height(this.mediaTileHeight(index, this.nestedQuotedMediaItems().length))
                          .borderRadius(0)
                          .objectFit(ImageFit.Cover)
                          .backgroundColor(this.theme.elevated)
                      } else {
                        Column()
                          .width(this.mediaTileWidth(index, this.nestedQuotedMediaItems().length))
                          .height(this.mediaTileHeight(index, this.nestedQuotedMediaItems().length))
                          .borderRadius(0)
                          .backgroundColor(this.theme.elevated)
                      }

                      if ((item.videoUrl || '').trim()) {
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
                    .margin({ bottom: this.mediaTileBottomMargin(index, this.nestedQuotedMediaItems().length) })
                    .onClick(() => {
                      this.onPlayInlineVideo(item, this.nestedMediaIndex(index))
                    })
                }, (item: PictureCarouselMediaItem, index: number) => `nested_${item.imageUrl}_${item.videoUrl}_${index}`)
              }
              .width('100%')
            }
            .width('100%')
            .padding(1)
            .backgroundColor(this.theme.divider)
            .clip(true)
          }

          if (this.hasSingleNestedQuotedVideoMedia()) {
            Stack({ alignContent: Alignment.Center }) {
              if (this.isInlineVideoActive(this.nestedQuotedPrimaryMediaItem(), this.nestedMediaIndex(0))) {
                Video({
                  src: this.nestedQuotedPrimaryMediaItem().videoUrl,
                  controller: this.inlineVideoControllerFor(this.nestedQuotedPrimaryMediaItem(), this.nestedMediaIndex(0)),
                  previewUri: this.nestedQuotedPrimaryMediaItem().imageUrl,
                })
                  .width('100%')
                  .height(192)
                  .borderRadius(0)
                  .controls(true)
                  .autoPlay(true)
                  .muted(false)
              } else {
                if ((this.nestedQuotedPrimaryMediaItem().imageUrl || '').trim()) {
                  Image(this.nestedQuotedPrimaryMediaItem().imageUrl)
                    .width('100%')
                    .height(192)
                    .borderRadius(0)
                    .objectFit(ImageFit.Cover)
                    .backgroundColor(this.theme.elevated)
                } else {
                  Column()
                    .width('100%')
                    .height(192)
                    .borderRadius(0)
                    .backgroundColor(this.theme.elevated)
                }

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
            .width('100%')
            .padding(1)
            .backgroundColor(this.theme.divider)
            .clip(true)
            .onClick(() => {
              this.onPlayInlineVideo(this.nestedQuotedPrimaryMediaItem(), this.nestedMediaIndex(0))
            })
          }
          }
          .width('100%')
          .borderRadius(10)
          .border({ width: 0.8, color: this.theme.divider })
          .backgroundColor(this.theme.surface)
          .clip(true)
        }
        .width('100%')
        .padding({ left: 12, right: 12, top: 10, bottom: 12 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(this.flatMode ? this.theme.surface : '#00000000')
    .borderRadius(12)
    .border({ width: this.flatMode ? 0.8 : 0, color: this.theme.divider })
    .clip(true)
  }
}
