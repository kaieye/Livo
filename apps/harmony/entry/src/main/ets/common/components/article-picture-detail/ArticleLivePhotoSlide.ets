import { PictureCarouselMediaItem } from '../../utils/PictureGallery'
import { ThemePalette, ThemeService } from '../../services/ThemeService'

@Component
export struct ArticleLivePhotoSlide {
  @Prop item: PictureCarouselMediaItem
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop isMounted: boolean = false
  @Prop shouldShowVideo: boolean = false
  @Prop shouldShowLoading: boolean = false
  @Prop shouldWarm: boolean = false
  @Prop isMuted: boolean = true
  @Prop slideAspectRatio: number = 4 / 5
  controller: VideoController = new VideoController()
  onPrepared: () => void = () => {}
  onStart: () => void = () => {}
  onPause: () => void = () => {}
  onStop: () => void = () => {}
  onError: () => void = () => {}
  onSlideClick: () => void = () => {}
  onMutedToggle: () => void = () => {}
  onAspectChange: (width: number, height: number) => void = (_w: number, _h: number) => {}
  onVisibilityChange: (currentRatio: number) => void = (_r: number) => {}

  @Builder
  private LiveBadge() {
    Row({ space: 4 }) {
      Image($r('app.media.ic_gallery_frame_overlay_camera_livephoto'))
        .width(16)
        .height(16)
        .fillColor('#FFFFFF')
    }
    .padding({ left: 2, right: 2, top: 2, bottom: 2 })
    .margin({ top: 10, right: 10 })
  }

  @Builder
  private LiveSoundToggle() {
    Row() {
      SymbolGlyph($r(this.isMuted ? 'sys.symbol.speaker_slash_fill' : 'sys.symbol.speaker_wave_2_fill'))
        .fontSize(13)
        .fontColor(['rgba(255,255,255,0.92)'])
    }
    .padding({ left: 7, right: 7, top: 6, bottom: 6 })
    .margin({ right: 10, bottom: 10 })
    .backgroundColor('rgba(0,0,0,0.28)')
    .borderRadius(999)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onMutedToggle()
    })
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.item.imageUrl)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
          .draggable(false)
          .onComplete((event) => {
            if (event) {
              this.onAspectChange(event.width, event.height)
            }
          })
          .visibility(this.shouldShowVideo ? Visibility.Hidden : Visibility.Visible)

        if (this.item.videoUrl && this.isMounted) {
          Video({
            src: this.item.videoUrl,
            controller: this.controller,
            previewUri: this.item.imageUrl,
          })
            .width('100%')
            .height('100%')
            .borderRadius(18)
            .controls(false)
            .autoPlay(this.shouldWarm)
            .loop(true)
            .muted(this.isMuted)
            .objectFit(ImageFit.Cover)
            .opacity(this.shouldShowVideo ? 1 : 0)
            .onPrepared(() => {
              this.onPrepared()
            })
            .onStart(() => {
              this.onStart()
            })
            .onPause(() => {
              this.onPause()
            })
            .onStop(() => {
              this.onStop()
            })
            .onError(() => {
              this.onError()
            })
        }
      }
      .width('100%')
      .height('100%')
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        this.onSlideClick()
      })

      if (this.shouldShowLoading) {
        Stack() {
          LoadingProgress()
            .width(28)
            .height(28)
            .color(this.theme.accent)
        }
        .width('100%')
        .height('100%')
        .align(Alignment.Center)
      }

      Stack() {
        this.LiveBadge()
      }
      .width('100%')
      .height('100%')
      .align(Alignment.TopEnd)

      Stack() {
        this.LiveSoundToggle()
      }
      .width('100%')
      .height('100%')
      .align(Alignment.BottomEnd)
    }
    .width('100%')
    .aspectRatio(this.slideAspectRatio)
    .onVisibleAreaChange([0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0], (_isVisible: boolean, currentRatio: number) => {
      this.onVisibilityChange(currentRatio)
    })
  }
}
