import { Entry, Feed, FeedViewType, formatPublishedAt } from '../models/LivoModels'
import { FeedRefreshPayload } from '../services/rss-feed/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { FeedDetailView } from './FeedDetailView'
import { FeedSubscribeConfigView } from './FeedSubscribeConfigView'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'

@Component
export struct DiscoverSubscribeConfigDestination {
  @Prop targetUrl: string = ''
  @Prop targetTitle: string = ''
  @Prop targetSiteUrl: string = ''
  @Prop targetImageUrl: string = ''
  @Prop targetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop sourceKind: string = ''
  @Prop initialSelectedView: FeedViewType = FeedViewType.Articles
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  onBack: () => void = () => {}
  onSubscribed: () => void = () => {}
  onSaved: () => void = () => {}
  onUnsubscribed: () => void = () => {}

  build() {
    FeedSubscribeConfigView({
      targetUrl: this.targetUrl,
      targetTitle: this.targetTitle,
      targetSiteUrl: this.targetSiteUrl,
      targetImageUrl: this.targetImageUrl,
      targetDescription: this.targetDescription,
      targetCategory: this.targetCategory,
      sourceKind: this.sourceKind,
      initialSelectedView: this.initialSelectedView,
      theme: this.theme,
      onBack: this.onBack,
      onSubscribed: this.onSubscribed,
      onSaved: this.onSaved,
      onUnsubscribed: this.onUnsubscribed,
    })
  }
}

@Component
export struct DiscoverPreviewDestination {
  @Prop targetUrl: string = ''
  @Prop initialTargetTitle: string = ''
  @Prop initialTargetSiteUrl: string = ''
  @Prop initialTargetImageUrl: string = ''
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  onBack: () => void = () => {}
  onEdit: (feed: Feed) => void = (_feed: Feed) => {}
  onSubscribe: (payload: FeedRefreshPayload) => void = (_payload: FeedRefreshPayload) => {}
  onOpenArticle: (entry: Entry, feed: Feed) => void = (_entry: Entry, _feed: Feed) => {}

  build() {
    FeedDetailView({
      targetUrl: this.targetUrl,
      initialTargetTitle: this.initialTargetTitle,
      initialTargetSiteUrl: this.initialTargetSiteUrl,
      initialTargetImageUrl: this.initialTargetImageUrl,
      initialTargetDescription: this.initialTargetDescription,
      targetCategory: this.targetCategory,
      targetView: this.targetView,
      theme: this.theme,
      onBack: this.onBack,
      onEdit: this.onEdit,
      onSubscribe: this.onSubscribe,
      onOpenArticle: this.onOpenArticle,
    })
  }
}




@Component
export struct DiscoverEntryDetailDestination {
  @Prop entry?: Entry = undefined
  @Prop feedTitle: string = ''
  @Prop feedImageUrl: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  private publishedLabel(): string {
    return this.entry ? formatPublishedAt(this.entry.publishedAt) : ''
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.feedTitle || '文章详情',
        theme: this.theme,
        showBackButton: true,
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => {
        },
      })
        .width('100%')
    }
  }

  @Builder
  private MetaBadge(text: string, active?: boolean) {
    Text(text)
      .fontSize(11)
      .fontWeight(FontWeight.Medium)
      .fontColor(active ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor(active ? this.theme.accent : this.theme.elevated)
      .borderRadius(999)
  }

  build() {
    Column() {
      this.HeaderSection()

      if (this.entry) {
        Scroll() {
          Column({ space: 18 }) {
            Column({ space: 12 }) {

              Text(this.entry!.title)
                .fontSize(28)
                .lineHeight(38)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
                .width('100%')

              Text(`${this.entry!.author || '未知作者'} · ${this.publishedLabel()}`)
                .fontSize(13)
                .lineHeight(20)
                .fontColor(this.theme.textSecondary)
                .width('100%')
            }
            .width('100%')
            .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 })
            .alignItems(HorizontalAlign.Start)

            Column({ space: 20 }) {
              if (this.entry!.summary) {
                Text(this.entry!.summary)
                  .fontSize(16)
                  .lineHeight(27)
                  .fontColor(this.theme.textSecondary)
                  .fontWeight(FontWeight.Medium)
                  .width('100%')
              }

              if (this.entry!.content) {
                ForEach(this.entry!.content.split('\n\n'), (paragraph: string) => {
                  if (paragraph.trim()) {
                    Text(paragraph)
                      .fontSize(16)
                      .lineHeight(29)
                      .fontColor(this.theme.textPrimary)
                      .width('100%')
                      .textAlign(TextAlign.Start)
                  }
                }, (paragraph: string, index: number) => `${index}-${paragraph}`)
              }

              if (this.entry!.url) {
                Text(`原始来源：${this.entry!.url}`)
                  .fontSize(13)
                  .fontColor(this.theme.textMuted)
                  .width('100%')
              }
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding({ left: 18, right: 18, top: 12, bottom: 22 })
            .margin({ top: 4, bottom: 16 })
          }
          .width('100%')
          .padding({ bottom: 12 })
          .alignItems(HorizontalAlign.Start)
        }
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      } else {
        Column({ space: 12 }) {
          Text('未找到内容')
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('无法加载文章内容')
            .fontSize(15)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}

