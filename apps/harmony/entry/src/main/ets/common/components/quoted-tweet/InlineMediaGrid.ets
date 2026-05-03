import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { PictureCarouselMediaItem } from '../../utils/PictureGallery'
import {
  inlineMediaTileBottomMargin,
  inlineMediaTileHeight,
  inlineMediaTileWidth,
  InlineMediaTileSize,
  QUOTED_TILE_SIZE,
} from '../../utils/InlineMediaLayout'
import { InlineMediaTile } from './InlineMediaTile'

@Component
export struct InlineMediaGrid {
  @Prop items: PictureCarouselMediaItem[] = []
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop tileSize: InlineMediaTileSize = QUOTED_TILE_SIZE
  @Prop tileBorderRadius: number = 0
  @Prop containerBorderRadius: number = 10
  @Prop activeMediaKey: string = ''
  isVideoActive: (item: PictureCarouselMediaItem, index: number) => boolean = () => false
  controllerFor: (item: PictureCarouselMediaItem, index: number) => VideoController = () => new VideoController()
  onTap: (item: PictureCarouselMediaItem, index: number) => void = () => {}
  keyOf: (item: PictureCarouselMediaItem, index: number) => string =
    (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`

  build() {
    Column() {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        ForEach(this.items, (item: PictureCarouselMediaItem, index: number) => {
          InlineMediaTile({
            item: item,
            theme: this.theme,
            tileWidth: inlineMediaTileWidth(this.tileSize, index, this.items.length),
            tileHeight: inlineMediaTileHeight(this.tileSize, index, this.items.length),
            tileBorderRadius: this.tileBorderRadius,
            isVideoActive: this.isVideoActive(item, index),
            videoController: this.controllerFor(item, index),
          })
            .margin({ bottom: inlineMediaTileBottomMargin(index, this.items.length) })
            .onClick(() => {
              this.onTap(item, index)
            })
        }, (item: PictureCarouselMediaItem, index: number) => this.keyOf(item, index))
      }
      .width('100%')
    }
    .width('100%')
    .padding(1)
    .borderRadius(this.containerBorderRadius)
    .backgroundColor(this.theme.divider)
    .clip(true)
  }
}
