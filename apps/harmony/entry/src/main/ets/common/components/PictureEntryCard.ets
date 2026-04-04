import { Entry, formatPublishedAt, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { createPictureGalleryTiles, PictureGalleryTile } from '../utils/PictureGallery'

interface PictureEntryGalleryGridProps {
  galleryTiles: PictureGalleryTile[]
}

@Component
export struct PictureEntryCard {
  @Prop entry: Entry = {} as Entry
  @Prop index: number = 0
  @Prop enableEnterTransition: boolean = true
  @Prop authorLabel: string = ''
  @Prop feedImageUrl: string = ''
  @Prop caption: string = ''
  @Prop pictureUrl: string = ''
  @Prop galleryUrls: string[] = []
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onOpen: () => void = () => {}

  private displayAuthor(): string {
    return (this.authorLabel || this.entry.author || '').trim() || '未知来源'
  }

  @Builder
  private FeedAvatar() {
    if (this.feedImageUrl.trim()) {
      Image(this.feedImageUrl.trim())
        .width(28)
        .height(28)
        .borderRadius(14)
        .backgroundColor(this.theme.elevated)
    } else {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(28)
          .height(28)
          .borderRadius(14)
          .backgroundColor(this.theme.accent)

        Text(this.displayAuthor().substring(0, 1).toUpperCase())
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
  }

  private normalizedGalleryUrls(): string[] {
    return selectPictureMediaUrls(this.galleryUrls)
  }

  private galleryTiles(): PictureGalleryTile[] {
    return createPictureGalleryTiles(this.normalizedGalleryUrls())
  }

  @Builder
  private GalleryGrid(props: PictureEntryGalleryGridProps) {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(props.galleryTiles, (tile: PictureGalleryTile) => {
        Stack({ alignContent: Alignment.Center }) {
          Image(tile.url)
            .width('100%')
            .height('100%')
            .objectFit(ImageFit.Cover)
            .borderRadius(12)
            .backgroundColor(this.theme.elevated)

          if (tile.overflowCount > 0) {
            Row()
              .width('100%')
              .height('100%')
              .borderRadius(12)
              .backgroundColor('rgba(0,0,0,0.28)')

            Text(`+${tile.overflowCount}`)
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
          }
        }
        .width(tile.width)
        .aspectRatio(1)
        .clip(true)
        .margin({ bottom: 6 })
      }, (tile: PictureGalleryTile) => `${tile.url}-${tile.overflowCount}`)
    }
    .width('100%')
  }

  build() {

    Column({ space: 10 }) {
      Row({ space: 8 }) {
        this.FeedAvatar()

        Text(this.displayAuthor())
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(this.entry.publishedAt))
          .fontSize(12)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      if (this.caption) {
        Text(this.caption)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      if (this.normalizedGalleryUrls().length > 0) {
        this.GalleryGrid({ galleryTiles: this.galleryTiles() })
      } else if (this.pictureUrl) {
        Image(this.pictureUrl)
          .width('100%')
          .height(220)
          .objectFit(ImageFit.Cover)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
      }
    }
    .width('100%')
    .padding({ top: 8, bottom: 10 })
    .alignItems(HorizontalAlign.Start)
    .transition(this.enableEnterTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpen()
    })
  }
}
