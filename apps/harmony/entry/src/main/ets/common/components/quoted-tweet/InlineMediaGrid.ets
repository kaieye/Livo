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
  @Prop renderVersion: number = 0
  isVideoActive: (item: PictureCarouselMediaItem, index: number) => boolean = () => false
  controllerFor: (item: PictureCarouselMediaItem, index: number) => VideoController = () => new VideoController()
  onTap: (item: PictureCarouselMediaItem, index: number) => void = () => {}
  onItemLongPress?: (item: PictureCarouselMediaItem, index: number) => void
  keyOf: (item: PictureCarouselMediaItem, index: number) => string =
    (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`

  private isActiveMediaItem(item: PictureCarouselMediaItem, index: number): boolean {
    return this.isVideoActive(item, index)
  }

  private hasVideo(item: PictureCarouselMediaItem): boolean {
    return !!(item.videoUrl || '').trim()
  }

  private renderKey(item: PictureCarouselMediaItem, index: number): string {
    return `${this.keyOf(item, index)}_${this.isActiveMediaItem(item, index) ? 'active' : 'idle'}_${this.renderVersion}`
  }

  @Builder
  private ActiveVideoTile(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Video({
        src: item.videoUrl,
        controller: this.controllerFor(item, index),
        previewUri: item.imageUrl,
      })
        .width('100%')
        .height('100%')
        .controls(true)
        .autoPlay(true)
        .muted(false)
        .objectFit(ImageFit.Contain)
        .onPrepared(() => {
          console.info(`[SOCIAL_VIDEO][InlineMediaGrid] prepared key=${this.renderKey(item, index)} videoUrl=${item.videoUrl}`)
          try {
            this.controllerFor(item, index).start()
          } catch (error) {
            console.error(`[SOCIAL_VIDEO][InlineMediaGrid] start failed: ${error instanceof Error ? error.message : error}`)
          }
        })
        .onStart(() => {
          console.info(`[SOCIAL_VIDEO][InlineMediaGrid] started key=${this.renderKey(item, index)} videoUrl=${item.videoUrl}`)
        })
        .onError(() => {
          console.error(`[SOCIAL_VIDEO][InlineMediaGrid] error key=${this.renderKey(item, index)} videoUrl=${item.videoUrl}`)
        })
    }
      .width(this.items.length <= 1 ? '100%' : inlineMediaTileWidth(this.tileSize, index, this.items.length))
      .height(this.items.length <= 1 ? this.tileSize.largeHeight : inlineMediaTileHeight(this.tileSize, index, this.items.length))
      .onTouch((event: TouchEvent) => {
        event.stopPropagation()
      })
      .gesture(
        LongPressGesture({ repeat: false, duration: 500 })
          .onAction(() => {
            if (this.onItemLongPress) {
              this.onItemLongPress(item, index)
            }
          })
      )
  }

  build() {
    Column() {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        ForEach(this.items, (item: PictureCarouselMediaItem, index: number) => {
          if (this.isActiveMediaItem(item, index) && this.hasVideo(item)) {
            Stack() {
              this.ActiveVideoTile(item, index)
            }
              .margin({ bottom: inlineMediaTileBottomMargin(index, this.items.length) })
              .onClick(() => {
                this.onTap(item, index)
              })
          } else {
            InlineMediaTile({
              item: item,
              theme: this.theme,
              tileWidth: this.items.length <= 1 ? '100%' : inlineMediaTileWidth(this.tileSize, index, this.items.length),
              tileHeight: this.items.length <= 1 ? 0 : inlineMediaTileHeight(this.tileSize, index, this.items.length),
              tileBorderRadius: this.tileBorderRadius,
              isVideoActive: false,
              videoController: undefined,
              onLongPress: this.onItemLongPress
                ? () => { this.onItemLongPress!(item, index) }
                : undefined,
            })
              .margin({ bottom: inlineMediaTileBottomMargin(index, this.items.length) })
              .onClick(() => {
                this.onTap(item, index)
              })
          }
        }, (item: PictureCarouselMediaItem, index: number) => this.renderKey(item, index))
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
