import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { AvatarTile } from './AvatarTile'

interface TweetMetricItem {
  label: string
  value: string
}

@Component
export struct TweetEntryCard {
  @Prop presentation: TweetEntryPresentation = {} as TweetEntryPresentation
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onOpen: () => void = () => {}

  private normalizedMediaUrls(): string[] {
    return (this.presentation.mediaUrls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
  }

  private hasMetrics(): boolean {
    return !!(
      this.presentation.replyCount ||
      this.presentation.repostCount ||
      this.presentation.likeCount ||
      this.presentation.viewCount
    )
  }

  private metricItems(): TweetMetricItem[] {
    return [
      { label: '回复', value: this.presentation.replyCount },
      { label: '转发', value: this.presentation.repostCount },
      { label: '喜欢', value: this.presentation.likeCount },
      { label: '浏览', value: this.presentation.viewCount },
    ].filter((item: TweetMetricItem) => !!item.value)
  }

  @Builder
  private MetricChip(item: TweetMetricItem) {
    Row({ space: 6 }) {
      Text(item.label)
        .fontSize(11)
        .fontColor(this.theme.textMuted)

      Text(item.value)
        .fontSize(12)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
    }
    .padding({ left: 10, right: 10, top: 6, bottom: 6 })
    .borderRadius(999)
    .backgroundColor(this.theme.elevated)
  }

  @Builder
  private MediaGrid() {
    const mediaUrls = this.normalizedMediaUrls()
    if (mediaUrls.length > 0) {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        ForEach(mediaUrls.slice(0, 4), (mediaUrl: string) => {
          Image(mediaUrl)
            .width(mediaUrls.length === 1 ? '100%' : mediaUrls.length === 2 ? '49%' : '48.5%')
            .height(mediaUrls.length === 1 ? 220 : 160)
            .borderRadius(16)
            .objectFit(ImageFit.Cover)
            .backgroundColor(this.theme.elevated)
            .margin({ bottom: 8 })
        }, (mediaUrl: string) => mediaUrl)
      }
      .width('100%')
    }
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 12 }) {
        AvatarTile({
          imageUrl: this.presentation.avatarUrl,
          fallbackLabel: this.presentation.displayName,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 44,
          radius: 14,
          textSize: 16,
        })

        Column({ space: 2 }) {
          Text(this.presentation.displayName || '未知来源')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (this.presentation.username.trim()) {
            Text(this.presentation.username)
              .fontSize(12)
              .fontColor(this.theme.textMuted)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        if (this.presentation.publishedLabel) {
          Text(this.presentation.publishedLabel)
            .fontSize(11)
            .fontColor(this.theme.textMuted)
        }
      }
      .width('100%')

      if (this.presentation.text) {
        Text(this.presentation.text)
          .fontSize(15)
          .lineHeight(22)
          .fontColor(this.theme.textPrimary)
          .maxLines(8)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      this.MediaGrid()

      if (this.hasMetrics()) {
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
          ForEach(this.metricItems(), (item: TweetMetricItem) => {
            this.MetricChip(item)
          }, (item: TweetMetricItem) => `${item.label}-${item.value}`)
        }
        .width('100%')
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(24)
    .alignItems(HorizontalAlign.Start)
    .transition(livoMotion.enterSoft(32))
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpen()
    })
  }
}
