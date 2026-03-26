import router from '@ohos.router'
import { AppRepository } from '../common/data/AppRepository'
import { BottomTabs } from '../common/components/BottomTabs'
import { EntryCardModel, FeedCardModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'

@Entry
@Component
struct Subscriptions {
  @State feeds: FeedCardModel[] = []
  @State mode: SubscriptionMode = 'articles'
  @State theme: ThemePalette = ThemeService.darkPalette()
  @State sourceHint: string = '正在加载订阅内容...'

  aboutToAppear(): void {
    void this.loadPageData()
  }

  private async loadPageData(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    this.feeds = await AppRepository.feeds()
    this.sourceHint = '已加载本地订阅内容'
  }

  private headerTitle(): string {
    switch (this.mode) {
      case 'social':
        return '社交'
      case 'pictures':
        return '图片'
      case 'videos':
        return '视频'
      default:
        return '文章'
    }
  }

  private modeIndex(): number {
    switch (this.mode) {
      case 'social':
        return 1
      case 'pictures':
        return 2
      case 'videos':
        return 3
      default:
        return 0
    }
  }

  private modeHighlightOffsetPercent(): string {
    return `${this.modeIndex() * 25}%`
  }

  private getModeTitle(mode: SubscriptionMode): string {
    switch (mode) {
      case 'articles': return '文章'
      case 'social': return '社交'
      case 'pictures': return '图片'
      case 'videos': return '视频'
      default: return ''
    }
  }

  private modeLabel(): string {
    return this.headerTitle()
  }

  private filteredFeeds(): FeedCardModel[] {
    return this.feeds.filter((feed: FeedCardModel) => feed.viewLabel === this.modeLabel())
  }

  private deriveFallbackIcon(siteUrl: string): string {
    const trimmed = siteUrl.trim()
    if (!trimmed) {
      return ''
    }

    try {
      const protocolMatch = trimmed.match(/^(https?:)/)
      const protocol = protocolMatch ? protocolMatch[1] : 'https:'
      const withoutProtocol = trimmed.replace(/^https?:\/\//, '')
      const host = withoutProtocol.split('/')[0]
      return `${protocol}//${host}/favicon.ico`
    } catch (_) {
      return ''
    }
  }

  private iconSource(feed: FeedCardModel | undefined): string {
    if (!feed) {
      return ''
    }

    if (feed.imageUrl.trim().length > 0) {
      return feed.imageUrl.trim()
    }

    return this.deriveFallbackIcon(feed.siteUrl)
  }



  @Builder
  private ModeIcon(mode: SubscriptionMode, active: boolean) {
    if (mode === 'articles') {
      Image(active ? $r('app.media.sub_articles_active') : $r('app.media.sub_articles_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else if (mode === 'social') {
      Image(active ? $r('app.media.sub_social_active') : $r('app.media.sub_social_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else if (mode === 'pictures') {
      Image(active ? $r('app.media.sub_pictures_active') : $r('app.media.sub_pictures_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else {
      Image(active ? $r('app.media.sub_videos_active') : $r('app.media.sub_videos_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    }
  }

  @Builder
  private ModeTab(mode: SubscriptionMode) {
    Row({ space: 6 }) {
      this.ModeIcon(mode, this.mode === mode)
      
      Text(this.getModeTitle(mode))
        .fontSize(14)
        .fontWeight(this.mode === mode ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.mode === mode ? '#FFFFFF' : this.theme.textSecondary)
        .animation({ duration: 220, curve: Curve.EaseInOut })
    }
    .layoutWeight(1)
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .onClick(() => { this.mode = mode })
  }

  @Builder
  private ModeRail() {
    Stack({ alignContent: Alignment.Start }) {
      Row() {
        Row()
          .width('100%')
          .height('100%')
          .borderRadius(14)
          .backgroundColor(this.theme.accent)
          .shadow({ radius: 8, color: 'rgba(255, 106, 0, 0.25)', offsetY: 2 })
      }
      .width('25%')
      .height('100%')
      .padding(4)
      .offset({ x: this.modeHighlightOffsetPercent(), y: 0 })
      .animation({ duration: 280, curve: Curve.FastOutSlowIn })

      Row() {
        this.ModeTab('articles')
        this.ModeTab('social')
        this.ModeTab('pictures')
        this.ModeTab('videos')
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height(46)
    .backgroundColor(this.theme.surface)
    .borderRadius(18)
  }

  @Builder
  private FeedAvatar(feed: FeedCardModel | undefined) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(22)
        .height(22)
        .borderRadius(6)
        .backgroundColor(this.theme.elevated)

      if (this.iconSource(feed).length > 0) {
        Image(this.iconSource(feed))
          .width(22)
          .height(22)
          .borderRadius(6)
          .objectFit(ImageFit.Cover)
      } else {
        Text(feed ? feed.title.substring(0, 1) : 'L')
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
      }
    }
  }

  @Builder
  private FeedRow(feed: FeedCardModel, showDivider: boolean) {
    Column() {
      Row({ space: 12 }) {
        this.FeedAvatar(feed)

        Text(feed.title)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Row()
          .width(4)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.textMuted)
      }
      .width('100%')
      .height(52)
      .padding({ left: 16, right: 16, top: 14, bottom: 14 })
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        router.pushUrl({ url: 'pages/FeedDetail', params: { feedId: feed.id } })
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 16 })
      }
    }
    .width('100%')
  }

  @Builder
  private FeedSection() {
    Column({ space: 12 }) {
      Text('订阅源')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textMuted)
        .padding({ left: 4 })

      if (this.filteredFeeds().length === 0) {
        Column({ space: 10 }) {
          Text(`您还没有收藏任何${this.headerTitle()}源`)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('先添加对应类型的订阅源，或者刷新现有订阅后再回来看看。')
            .fontSize(14)
            .lineHeight(22)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(18)
        .backgroundColor(this.theme.surface)
        .borderRadius(22)
      } else {
        Column() {
          ForEach(this.filteredFeeds(), (feed: FeedCardModel, index: number) => {
            this.FeedRow(feed, index < this.filteredFeeds().length - 1)
          }, (feed: FeedCardModel) => feed.id)
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(22)
        .clip(true)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      List({ space: 18 }) {
        ListItem() {
          Column({ space: 22 }) {
            Row() {
              Text('订阅库')
                .fontSize(28)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
              
              Blank()
            }
            .width('100%')
            .padding({ top: 12 })

            this.ModeRail()

            Row() {
              Text(`${this.filteredFeeds().length} 个订阅源`)
                .fontSize(12)
                .fontColor(this.theme.textSecondary)

              Blank()

              Text(this.sourceHint)
                .fontSize(12)
                .fontColor(this.theme.textMuted)
            }
            .width('100%')
            .padding({ left: 4, right: 4 })
          }
          .width('100%')
        }
        .width('100%')

        ListItem() {
          this.FeedSection()
        }

        ListItem() {
          Row().height(100).width('100%')
        }
      }
      .width('100%')
      .height('100%')
      .padding({ left: 18, right: 18 })
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)
      .edgeEffect(EdgeEffect.Spring)

      BottomTabs({ activeTab: 'subscriptions', theme: this.theme })
        .align(Alignment.Bottom)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
