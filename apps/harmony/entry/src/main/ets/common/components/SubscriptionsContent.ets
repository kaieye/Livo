import { AppRepository } from '../data/AppRepository'
import { AvatarTile } from './AvatarTile'
import { BottomTabs } from './BottomTabs'
import { openFeedDetail } from '../navigation/AppRouter'
import { ContentModeRail } from './ContentModeRail'
import { PageHeader } from './PageHeader'
import { FeedCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import {
  CARD_RADIUS_LG,
  CARD_RADIUS_MD,
  META_FONT_SIZE,
  PAGE_BOTTOM_GAP,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
  PAGE_HORIZONTAL_PADDING,
  PAGE_TOP_PADDING,
} from '../ui/UiTokens'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'

@Component
export struct SubscriptionsContent {
  @State feeds: FeedCardModel[] = []
  @State mode: SubscriptionMode = 'articles'
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State sourceHint: string = '正在加载订阅内容...'
  @State hasLoaded: boolean = false
  @State isLoading: boolean = false
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  onReady: () => void = () => {}

  aboutToAppear(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
      if (this.hasLoaded || this.isLoading) {
        this.onReady()
        return
      }
    }

    void this.loadPageData()
  }

  private async loadPageData(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      if (this.showBottomTabs) {
        const settings = await AppRepository.settings()
        this.theme = await ThemeService.resolvePalette(settings)
      } else {
        this.theme = this.inheritedTheme
      }

      this.feeds = await AppRepository.feeds()
      this.sourceHint = '已加载本地订阅内容'
      this.hasLoaded = true
      this.onReady()
    } finally {
      this.isLoading = false
    }
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
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
  private FeedAvatar(feed: FeedCardModel | undefined) {
    AvatarTile({
      imageUrl: this.iconSource(feed),
      fallbackLabel: feed ? feed.title : 'Livo',
      accent: this.theme.elevated,
      theme: this.theme,
      avatarSize: 22,
      radius: 6,
      textSize: 11,
    })
  }

  @Builder
  private FeedRow(feed: FeedCardModel, index: number, showDivider: boolean) {
    Column() {
      Row({ space: 12 }) {
        this.FeedAvatar(feed)

        Column({ space: 4 }) {
          Text(feed.title)
            .fontSize(LIST_ROW_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(feed.siteUrl.replace(/^https?:\/\//, ''))
            .fontSize(META_FONT_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Row()
          .width(4)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.textMuted)
      }
      .width('100%')
      .height(62)
      .padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => {
        void openFeedDetail(feed.id)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET })
      }
    }
    .width('100%')
    .transition(livoMotion.enterScale(index * 18 + 30))
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Column({ space: 16 }) {
          PageHeader({
            title: '订阅库',
            theme: this.theme,
          })

          ContentModeRail({
            mode: this.mode,
            theme: this.theme,
            onChange: (mode: SubscriptionMode) => {
              this.mode = mode
            },
          })

          Row() {
            Text(`${this.filteredFeeds().length} 个订阅源`)
              .fontSize(META_FONT_SIZE)
              .fontColor(this.theme.textSecondary)

            Blank()

            Text(this.sourceHint)
              .fontSize(META_FONT_SIZE)
              .fontColor(this.theme.textMuted)
          }
          .width('100%')
          .padding({ left: 4, right: 4 })
          .transition(livoMotion.enterRise(50))
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 6 })

        Scroll() {
          Column({ space: 14 }) {
            Text('订阅源')
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textMuted)
              .padding({ left: 4 })
              .width('100%')

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
              .borderRadius(CARD_RADIUS_MD)
              .border({ width: 0.8, color: this.theme.divider })
              .transition(livoMotion.enterScale(70))
            } else {
              Column() {
                ForEach(this.filteredFeeds(), (feed: FeedCardModel, index: number) => {
                  this.FeedRow(
                    feed,
                    index,
                    index < this.filteredFeeds().length - 1,
                  )
                }, (feed: FeedCardModel) => feed.id)
              }
              .width('100%')
              .backgroundColor(this.theme.surface)
              .borderRadius(CARD_RADIUS_LG)
              .border({ width: 0.8, color: this.theme.divider })
              .clip(true)
              .transition(livoMotion.enterScale(70))
            }

            Row().height(88).width('100%')
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .justifyContent(FlexAlign.Start)
          .constraintSize({ minHeight: '100%' })
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: PAGE_BOTTOM_GAP })
        }
        .width('100%')
        .layoutWeight(1)
        .nestedScroll({
          scrollForward: NestedScrollMode.SELF_FIRST,
          scrollBackward: NestedScrollMode.SELF_FIRST,
        })
        .scrollBar(BarState.Off)
        .backgroundColor(this.theme.background)
        .edgeEffect(EdgeEffect.Spring)
      }
      .width('100%')
      .height('100%')

      if (this.showBottomTabs) {
        BottomTabs({ activeTab: 'subscriptions', theme: this.theme })
          .align(Alignment.Bottom)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
