import { Entry, formatPublishedAt, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'

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
  @State private activeMediaIndex: number = 0

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

  private carouselMediaUrls(): string[] {
    const galleryMediaUrls = this.normalizedGalleryUrls()
    if (galleryMediaUrls.length > 0) {
      return galleryMediaUrls
    }

    const singleMediaUrl = (this.pictureUrl || '').trim()
    return singleMediaUrl ? [singleMediaUrl] : []
  }

  @Builder
  private CarouselIndicator(total: number) {
    if (total > 1) {
      Row({ space: 6 }) {
        ForEach(this.carouselMediaUrls(), (_url: string, index: number) => {
          Row()
            .width(index === this.activeMediaIndex ? 16 : 6)
            .height(6)
            .borderRadius(6)
            .backgroundColor(index === this.activeMediaIndex ? '#FFFFFF' : 'rgba(255,255,255,0.45)')
            .animation({ duration: 180, curve: Curve.EaseOut })
        }, (_url: string, index: number) => `dot-${index}`)
      }
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor('rgba(0,0,0,0.28)')
      .borderRadius(999)
    }
  }

  @Builder
  private MediaCarousel() {
    if (this.carouselMediaUrls().length > 0) {
      Stack({ alignContent: Alignment.Bottom }) {
        Swiper() {
          ForEach(this.carouselMediaUrls(), (mediaUrl: string, index: number) => {
            Image(mediaUrl)
              .width('100%')
              .objectFit(ImageFit.Contain)
              .borderRadius(18)
              .backgroundColor(this.theme.elevated)
          }, (mediaUrl: string, index: number) => `${mediaUrl}-${index}`)
        }
        .width('100%')
        .layoutWeight(1)
        .indicator(false)
        .loop(this.carouselMediaUrls().length > 1)
        .duration(260)
        .onChange((index: number) => {
          this.activeMediaIndex = index
        })

        this.CarouselIndicator(this.carouselMediaUrls().length)
      }
      .width('100%')
      .constraintSize({ minHeight: 120, maxHeight: 640 })
      .clip(true)
      .borderRadius(18)
      .backgroundColor(this.theme.elevated)
    }
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

      if (this.carouselMediaUrls().length > 0) {
        this.MediaCarousel()
      }
    }
    .width('100%')
    .padding({ top: 8, bottom: 10 })
    .alignItems(HorizontalAlign.Start)
    .transition(this.enableEnterTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
    .onClick(() => {
      this.onOpen()
    })
  }
}
