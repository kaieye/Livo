import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { PictureCarouselMediaItem } from '../../utils/PictureGallery'

@Component
export struct InlineMediaTile {
  @Prop item: PictureCarouselMediaItem = { kind: 'image', imageUrl: '', videoUrl: '' }
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop tileWidth: string = '100%'
  @Prop tileHeight: number = 0
  @Prop tileBorderRadius: number = 0
  @Prop isVideoActive: boolean = false
  videoController?: VideoController = undefined
  onLongPress?: () => void

  private hasVideo(): boolean {
    return !!(this.item.videoUrl || '').trim()
  }

  private hasImage(): boolean {
    return !!(this.item.imageUrl || '').trim()
  }

  private resolvedVideoController(): VideoController {
    return this.videoController || new VideoController()
  }

  private resolvedActiveVideoHeight(): number {
    if (this.tileHeight > 0) {
      return this.tileHeight
    }
    // 单视频模式原来依赖图片的自然高度；切到 Video 后若仍使用 0 高度，
    // 组件会塌陷，导致首次点击后看起来没有开始播放。
    return 208
  }

  private startVideoPlayback(): void {
    try {
      console.info(`[SOCIAL_VIDEO][InlineMediaTile] start playback videoUrl=${this.item.videoUrl}`)
      this.resolvedVideoController().start()
    } catch (error) {
      console.error(`Failed to start inline social video: ${error instanceof Error ? error.message : error}`)
    }
  }

  build() {
    if (this.tileHeight <= 0 && !(this.hasVideo() && this.isVideoActive)) {
      // Single image: original aspect ratio
      Stack({ alignContent: Alignment.Center }) {
        if (this.hasImage()) {
          Image(this.item.imageUrl)
            .width('100%')
            .borderRadius(this.tileBorderRadius)
            .backgroundColor(this.theme.elevated)
        }

        if (this.hasVideo()) {
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
      .onTouch((event: TouchEvent) => {
        event.stopPropagation()
      })
      .gesture(
        LongPressGesture({ repeat: false, duration: 500 })
          .onAction(() => {
            if (this.onLongPress) {
              this.onLongPress()
            }
          })
      )
    } else {
      // Video or multi-image grid: fixed cell size
      Stack({ alignContent: Alignment.Center }) {
        if (this.hasVideo() && this.isVideoActive) {
          Video({
            src: this.item.videoUrl,
            controller: this.resolvedVideoController(),
            previewUri: this.item.imageUrl,
          })
            .width('100%')
            .height('100%')
            .borderRadius(this.tileBorderRadius)
            .controls(true)
            .autoPlay(true)
            .muted(false)
            .objectFit(ImageFit.Contain)
            .onPrepared(() => {
              console.info(`[SOCIAL_VIDEO][InlineMediaTile] prepared videoUrl=${this.item.videoUrl}`)
              this.startVideoPlayback()
            })
            .onStart(() => {
              console.info(`[SOCIAL_VIDEO][InlineMediaTile] started videoUrl=${this.item.videoUrl}`)
            })
            .onError(() => {
              console.error(`[SOCIAL_VIDEO][InlineMediaTile] error videoUrl=${this.item.videoUrl}`)
            })
        } else {
          if (this.hasImage()) {
            Image(this.item.imageUrl)
              .width('100%')
              .height('100%')
              .borderRadius(this.tileBorderRadius)
              .objectFit(ImageFit.Cover)
              .backgroundColor(this.theme.elevated)
          } else {
            Column()
              .width('100%')
              .height('100%')
              .borderRadius(this.tileBorderRadius)
              .backgroundColor(this.theme.elevated)
          }

          if (this.hasVideo()) {
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
      .width(this.tileWidth)
      .height(this.hasVideo() && this.isVideoActive ? this.resolvedActiveVideoHeight() : this.tileHeight)
      .onTouch((event: TouchEvent) => {
        event.stopPropagation()
      })
      .gesture(
        LongPressGesture({ repeat: false, duration: 500 })
          .onAction(() => {
            if (this.onLongPress) {
              this.onLongPress()
            }
          })
      )
    }
  }
}
