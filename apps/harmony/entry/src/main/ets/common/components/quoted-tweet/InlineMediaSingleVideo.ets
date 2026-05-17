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
  videoController?: VideoController = undefined
  onTap: () => void = () => {}

  build() {
    Column() {
      InlineMediaTile({
        item: this.item,
        theme: this.theme,
        tileWidth: '100%',
        tileHeight: this.videoHeight,
        tileBorderRadius: 0,
        isVideoActive: this.isVideoActive,
        videoController: this.videoController,
      })
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
