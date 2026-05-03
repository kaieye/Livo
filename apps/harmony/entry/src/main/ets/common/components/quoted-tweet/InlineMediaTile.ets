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
  videoController: VideoController = new VideoController()

  private hasVideo(): boolean {
    return !!(this.item.videoUrl || '').trim()
  }

  private hasImage(): boolean {
    return !!(this.item.imageUrl || '').trim()
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.hasVideo() && this.isVideoActive) {
        Video({
          src: this.item.videoUrl,
          controller: this.videoController,
          previewUri: this.item.imageUrl,
        })
          .width(this.tileWidth)
          .height(this.tileHeight)
          .borderRadius(this.tileBorderRadius)
          .controls(true)
          .autoPlay(true)
          .muted(false)
      } else {
        if (this.hasImage()) {
          Image(this.item.imageUrl)
            .width(this.tileWidth)
            .height(this.tileHeight)
            .borderRadius(this.tileBorderRadius)
            .objectFit(ImageFit.Cover)
            .backgroundColor(this.theme.elevated)
        } else {
          Column()
            .width(this.tileWidth)
            .height(this.tileHeight)
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
  }
}
