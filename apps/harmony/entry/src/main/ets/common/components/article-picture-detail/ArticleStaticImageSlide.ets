import { PictureCarouselMediaItem } from '../../utils/PictureGallery'
import { ThemePalette, ThemeService } from '../../services/ThemeService'

@Component
export struct ArticleStaticImageSlide {
  @Prop item: PictureCarouselMediaItem
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop slideAspectRatio: number = 4 / 5
  onAspectChange: (width: number, height: number) => void = (_w: number, _h: number) => {}
  onOpenGallery: (url: string) => void = () => {}

  build() {
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
    }
    .width('100%')
    .aspectRatio(this.slideAspectRatio)
    .clip(true)
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
    .onClick(() => {
      this.onOpenGallery(this.item.imageUrl)
    })
  }
}
