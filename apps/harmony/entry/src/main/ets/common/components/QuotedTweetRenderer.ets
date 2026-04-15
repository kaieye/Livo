import { ThemePalette, ThemeService } from '../services/ThemeService'
import { TweetQuotedPresentation } from '../utils/TweetEntryPresentation'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'

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
    return this.shouldShowQuotedExpandAction() ? 8 : 99
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
    if (lineBreakCount > 10) {
      return true
    }

    const threshold = 10 * 24
    return text.length > threshold
  }

  private mediaItemsFromUrls(urls: string[]): PictureCarouselMediaItem[] {
    const normalizedUrls = (urls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
    const fallbackImageUrl = normalizedUrls.find((url: string) => !this.isVideoLikeUrl(url)) || ''
    return resolvePictureCarouselMediaItems(normalizedUrls, fallbackImageUrl).slice(0, 4)
  }

  private quotedMediaItems(): PictureCarouselMediaItem[] {
    return this.mediaItemsFromUrls(this.quotedTweet.mediaUrls || [])
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

  private mediaTileWidth(index: number, count: number): string {
    if (count <= 1) {
      return '100%'
    }

    if (count === 3 && index === 0) {
      return '100%'
    }

    return '49.2%'
  }

  private mediaTileHeight(index: number, count: number): number {
    if (count <= 1) {
      return 208
    }

    if (count === 3 && index === 0) {
      return 148
    }

    return 136
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
                    .borderRadius(8)
                    .controls(true)
                    .autoPlay(true)
                    .muted(false)
                } else {
                  if ((item.imageUrl || '').trim()) {
                    Image(item.imageUrl)
                      .width(this.mediaTileWidth(index, this.quotedMediaItems().length))
                      .height(this.mediaTileHeight(index, this.quotedMediaItems().length))
                      .borderRadius(8)
                      .objectFit(ImageFit.Cover)
                      .backgroundColor(this.theme.elevated)
                  } else {
                    Column()
                      .width(this.mediaTileWidth(index, this.quotedMediaItems().length))
                      .height(this.mediaTileHeight(index, this.quotedMediaItems().length))
                      .borderRadius(8)
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
                .margin({ bottom: this.quotedMediaItems().length > 1 ? 6 : 0 })
                .onClick(() => {
                  this.onPlayInlineVideo(item, index)
                })
            }, (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`)
          }
          .width('100%')
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
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(this.flatMode ? this.theme.surface : '#00000000')
    .borderRadius(12)
    .border({ width: this.flatMode ? 0.8 : 0, color: this.theme.divider })
    .clip(true)
  }
}
