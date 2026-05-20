import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { PictureCarouselMediaItem } from '../../utils/PictureGallery'
import { InlineMediaTile } from './InlineMediaTile'

@Component
export struct InlineMediaSingleVideo {
  @Prop item: PictureCarouselMediaItem = { kind: 'image', imageUrl: '', videoUrl: '' }
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop videoHeight: number = 208
  @Prop containerBorderRadius: number = 0
  @Prop containerPadding: number = 0
  @Prop isVideoActive: boolean = false
  @Prop renderVersion: number = 0
  videoController?: VideoController = undefined
  onTap: () => void = () => {}
  onLongPress?: () => void

  private renderKey(): string {
    return `${this.item.imageUrl}_${this.item.videoUrl}_${this.isVideoActive ? 'active' : 'idle'}_${this.renderVersion}`
  }

  private hasVideo(): boolean {
    return !!(this.item.videoUrl || '').trim()
  }

  build() {
    Column() {
      if (this.isVideoActive && this.hasVideo() && this.videoController) {
        Stack({ alignContent: Alignment.Center }) {
          Video({
            src: this.item.videoUrl,
            controller: this.videoController,
            previewUri: this.item.imageUrl,
          })
            .width('100%')
            .height(this.videoHeight)
            .controls(true)
            .autoPlay(true)
            .muted(false)
            .objectFit(ImageFit.Contain)
            .onPrepared(() => {
              console.info(`[SOCIAL_VIDEO][InlineMediaSingleVideo] prepared key=${this.renderKey()} videoUrl=${this.item.videoUrl}`)
              try {
                this.videoController!.start()
              } catch (error) {
                console.error(`[SOCIAL_VIDEO][InlineMediaSingleVideo] start failed: ${error instanceof Error ? error.message : error}`)
              }
            })
            .onStart(() => {
              console.info(`[SOCIAL_VIDEO][InlineMediaSingleVideo] started key=${this.renderKey()} videoUrl=${this.item.videoUrl}`)
            })
            .onError(() => {
              console.error(`[SOCIAL_VIDEO][InlineMediaSingleVideo] error key=${this.renderKey()} videoUrl=${this.item.videoUrl}`)
            })
        }
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
        InlineMediaTile({
          item: this.item,
          theme: this.theme,
          tileWidth: '100%',
          tileHeight: this.videoHeight,
          tileBorderRadius: 0,
          isVideoActive: false,
          videoController: undefined,
          onLongPress: this.onLongPress,
        })
      }
    }
    .width('100%')
    .padding(this.containerPadding)
    .borderRadius(this.containerBorderRadius)
    .backgroundColor(this.containerPadding > 0 ? this.theme.divider : '#00000000')
    .clip(true)
    .onClick(() => {
      this.onTap()
    })
  }
}
