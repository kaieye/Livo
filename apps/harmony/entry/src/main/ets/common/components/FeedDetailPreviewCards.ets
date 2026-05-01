import { Entry, formatPublishedAt } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'

@Component
export struct FeedDetailAvatar {
  @Prop imageUrl: string = ''
  @Prop fallbackLabel: string = '?'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop avatarSize: number = 32
  @Prop radius: number = 10
  @Prop fontSize: number = 14

  onImageLoaded: (imageUrl: string) => void = () => {}
  onImageError: () => void = () => {}

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.imageUrl) {
        Image(this.imageUrl)
          .width(this.avatarSize)
          .height(this.avatarSize)
          .borderRadius(this.radius)
          .backgroundColor(this.theme.elevated)
          .objectFit(ImageFit.Cover)
          .onComplete(() => {
            this.onImageLoaded(this.imageUrl)
          })
          .onError(() => {
            this.onImageError()
          })
      } else {
        Row()
          .width(this.avatarSize)
          .height(this.avatarSize)
          .borderRadius(this.radius)
          .backgroundColor(this.theme.accent)

        Text(this.fallbackLabel)
          .fontSize(this.fontSize)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
  }
}

@Component
export struct FeedDetailHeroCard {
  @Prop title: string = ''
  @Prop avatarUrl: string = ''
  @Prop fallbackLabel: string = '?'
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onAvatarLoaded: (imageUrl: string) => void = () => {}
  onAvatarError: () => void = () => {}

  build() {
    Column({ space: 14 }) {
      FeedDetailAvatar({
        imageUrl: this.avatarUrl,
        fallbackLabel: this.fallbackLabel,
        theme: this.theme,
        avatarSize: 88,
        radius: 26,
        fontSize: 28,
        onImageLoaded: this.onAvatarLoaded,
        onImageError: this.onAvatarError,
      })

      Column({ space: 6 }) {
        Text(this.title)
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .maxLines(2)
          .textAlign(TextAlign.Center)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 24 })
    .backgroundColor(this.theme.surface)
    .borderRadius(28)
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
export struct FeedDetailDescriptionCard {
  @Prop description: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  build() {
    Column({ space: 8 }) {
      Text('简介')
        .fontSize(14)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Text(this.description)
        .fontSize(14)
        .lineHeight(22)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct FeedDetailNoticeCard {
  @Prop notice: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  build() {
    Row({ space: 10 }) {
      Text('预览说明')
        .fontSize(12)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.accent)

      Text(this.notice)
        .layoutWeight(1)
        .fontSize(12)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(18)
    .border({ width: 0.8, color: this.theme.divider })
  }
}

@Component
export struct FeedDetailPreviewSectionHeader {
  @Prop entryCount: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  build() {
    Row() {
      Text('内容预览')
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Blank()

      Text(`${this.entryCount} 条`)
        .fontSize(12)
        .fontColor(this.theme.textMuted)
    }
    .width('100%')
  }
}

@Component
export struct FeedDetailPreviewEntryCard {
  @Prop entry: Entry = {} as Entry
  @Prop index: number = 0
  @Prop videoPreviewUrl: string = ''
  @Prop videoSourceLabel: string = ''
  @Prop enableTransition: boolean = true
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onOpen: () => void = () => {}

  build() {
    Column({ space: 8 }) {
      if (this.videoPreviewUrl) {
        Stack({ alignContent: Alignment.TopStart }) {
          Image(this.videoPreviewUrl)
            .width('100%')
            .height(172)
            .objectFit(ImageFit.Cover)
            .borderRadius(16)

          Text(this.videoSourceLabel || '视频')
            .fontSize(11)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .backgroundColor('rgba(17,24,39,0.72)')
            .borderRadius(999)
            .margin({ left: 12, top: 12 })
        }
        .width('100%')
        .clip(true)
      }

      Row({ space: 8 }) {
        Text(this.entry.author || '未知作者')
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(11)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(this.entry.publishedAt))
          .fontSize(11)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(this.entry.title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(22)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (this.entry.summary) {
        Text(this.entry.summary)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      if (this.videoSourceLabel) {
        Text(`${this.videoSourceLabel} 视频源`)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
      }
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .alignItems(HorizontalAlign.Start)
    .transition(this.enableTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpen()
    })
  }
}

@Component
export struct FeedDetailPicturePreviewEntryCard {
  @Prop entry: Entry = {} as Entry
  @Prop index: number = 0
  @Prop leadImageUrl: string = ''
  @Prop authorLabel: string = ''
  @Prop caption: string = ''
  @Prop enableTransition: boolean = true
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onOpen: () => void = () => {}

  build() {
    Column({ space: 10 }) {
      if (this.leadImageUrl) {
        Image(this.leadImageUrl)
          .width('100%')
          .height(220)
          .objectFit(ImageFit.Cover)
          .borderRadius(16)
          .backgroundColor(this.theme.elevated)
      }

      Row({ space: 8 }) {
        Text(this.entry.author || this.authorLabel || '未知作者')
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(11)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(this.entry.publishedAt))
          .fontSize(11)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(this.caption || this.entry.title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(22)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (this.entry.summary) {
        Text(this.entry.summary)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .alignItems(HorizontalAlign.Start)
    .transition(this.enableTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpen()
    })
  }
}

@Component
export struct FeedDetailPicturePreviewEmptyStateCard {
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  build() {
    Column({ space: 8 }) {
      Text('图片流预览暂不可用')
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Text('这个订阅源已识别为图片类来源。当前先展示订阅源信息，订阅后会在“图片”栏目按图片卡片方式展示。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }
}
