import { AppRepository } from '../common/data/AppRepository'
import { BottomTabs, rootTabsController } from '../common/components/BottomTabs'
import { getRequestedRootTabId, openArticleDetail, RootTabId, rootTabIdForIndex, rootTabIndexForId } from '../common/navigation/AppRouter'
import { ContentModeRail } from '../common/components/ContentModeRail'
import { PageHeader } from '../common/components/PageHeader'
import { EntryCardModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { livoMotion } from '../common/ui/Motion'
import {
  CARD_RADIUS_MD,
  INPUT_RADIUS,
  META_FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
} from '../common/ui/UiTokens'
import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { DiscoverContent } from '../common/components/DiscoverContent'
import { SettingsContent } from '../common/components/SettingsContent'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'

@Entry
@Component
struct Index {
  @State featuredEntries: EntryCardModel[] = []
  @State feedSourceLabel: string = '准备加载本地内容'
  @State isRefreshing: boolean = false
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  @State mode: SubscriptionMode = 'articles'
  @State theme: ThemePalette = ThemeService.darkPalette()
  @State activeRootTabId: RootTabId = 'home'

  aboutToAppear(): void {
    console.info('Livo Harmony Index aboutToAppear')
    this.syncRequestedRootTab()
    void this.loadInitialData()
  }

  private async loadInitialData(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    this.featuredEntries = await AppRepository.featuredEntries()
    this.feedSourceLabel = '本地内容已加载'
    if (settings.autoRefresh) {
      await this.refreshFeaturedEntries()
    }
  }

  private async refreshFeaturedEntries(): Promise<void> {
    this.isRefreshing = true

    try {
      const result = await AppRepository.refreshAllFeeds()
      this.featuredEntries = result.entries
      this.feedSourceLabel = result.sourceLabel
    } finally {
      this.isRefreshing = false
    }
  }

  private async refreshRootTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  private visibleRootTabId(): RootTabId {
    return this.activeRootTabId
  }

  private visibleRootTabIndex(): number {
    return rootTabIndexForId(this.visibleRootTabId())
  }

  private syncRequestedRootTab(): void {
    const requestedTab = getRequestedRootTabId()
    if (!requestedTab) {
      return
    }

    this.activeRootTabId = requestedTab
    rootTabsController.changeIndex(rootTabIndexForId(requestedTab))
  }

  private requestRootTabSwitch(tabId: RootTabId): void {
    if (tabId === this.activeRootTabId) {
      return
    }

    this.activeRootTabId = tabId
    rootTabsController.changeIndex(rootTabIndexForId(tabId))
  }

  private commitVisibleTabIfNeeded(tabId: RootTabId): void {
    this.activeRootTabId = tabId
  }

  private openEntry(entryId: string): void {
    void openArticleDetail(entryId)
  }

  private filteredEntries(): EntryCardModel[] {
    let list = this.featuredEntries.filter((entry: EntryCardModel) =>
      entry.viewLabel === this.getModeTitle(this.mode)
    )

    const keyword = this.searchQuery.trim().toLowerCase()
    if (keyword) {
      list = list.filter((entry: EntryCardModel) =>
        entry.title.toLowerCase().includes(keyword)
        || entry.summary.toLowerCase().includes(keyword)
        || entry.feedTitle.toLowerCase().includes(keyword)
      )
    }

    return list
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

  private headerSubtitle(): string {
    switch (this.mode) {
      case 'social': return 'Social Stream'
      case 'pictures': return 'Visual Digest'
      case 'videos': return 'Video Radar'
      default: return 'Daily Brief'
    }
  }

  @Builder
  private EmptyTabBar() {
    Row()
      .width(0)
      .height(0)
  }

  @Builder
  private EntryCard(entry: EntryCardModel) {
    Column({ space: 10 }) {
      Row({ space: 6 }) {
        Text(entry.feedTitle)
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Text(entry.publishedLabel)
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        if (entry.readingLabel) {
          Row({ space: 4 }) {
            Text('·')
              .fontSize(12)
              .fontColor(this.theme.textMuted)
            Text(entry.readingLabel)
              .fontSize(12)
              .fontColor(this.theme.textMuted)
          }
        }
      }
      .width('100%')

      Text(entry.title)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(24)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (entry.summary && entry.summary.length > 50) {
        Text(entry.summary)
          .fontSize(14)
          .lineHeight(22)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      Row({ space: 8 }) {
        if (entry.tags.length > 0) {
          ForEach(entry.tags.slice(0, 2), (tag: string) => {
            Text(`#${tag}`)
              .fontSize(12)
              .fontColor(this.theme.textSecondary)
              .padding({ left: 8, right: 8, top: 4, bottom: 4 })
              .backgroundColor(this.theme.elevated)
              .borderRadius(8)
          }, (tag: string) => tag)
        }

        if (entry.author) {
          Text(entry.author)
            .fontSize(12)
            .fontColor(this.theme.textSecondary)
            .margin({ left: 8 })
        }
      }
    }
    .alignItems(HorizontalAlign.Start)
    .padding(18)
    .backgroundColor(this.theme.surface)
    .borderRadius(24)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 12 : 18,
      color: this.theme.isDark ? 'rgba(0,0,0,0.22)' : 'rgba(15,23,42,0.06)',
      offsetX: 0,
      offsetY: 6,
    })
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => this.openEntry(entry.id))
  }

  @Builder
  private EntrySeparator() {
    Row()
      .width('100%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
      .margin({ left: 16, right: 16 })
  }

  @Builder
  private HomeRootPage() {
    Column() {
      Column({ space: 14 }) {
        PageHeader({
          title: '今日推荐',
          subtitle: this.headerSubtitle(),
          theme: this.theme,
          trailingSymbol: $r('sys.symbol.magnifyingglass'),
          onTrailingClick: () => {
            this.showSearch = !this.showSearch
          },
        })

        ContentModeRail({
          mode: this.mode,
          theme: this.theme,
          onChange: (mode: SubscriptionMode) => {
            this.mode = mode
          },
        })

        Row() {
          Text(this.isRefreshing ? '正在刷新内容...' : this.feedSourceLabel)
            .fontSize(META_FONT_SIZE)
            .fontColor(this.theme.textSecondary)
            .layoutWeight(1)

          Text(`${this.filteredEntries().length} 条`)
            .fontSize(META_FONT_SIZE)
            .fontColor(this.theme.textMuted)
        }
        .width('100%')
        .padding({ left: 4, right: 4 })
        .transition(livoMotion.enterRise(60))

        if (this.showSearch) {
          TextInput({ text: this.searchQuery, placeholder: '搜索标题、摘要或来源' })
            .backgroundColor(this.theme.surface)
            .fontColor(this.theme.textPrimary)
            .borderRadius(INPUT_RADIUS)
            .padding({ left: 14, right: 14, top: 12, bottom: 12 })
            .border({ width: 0.8, color: this.theme.divider })
            .onChange((value: string) => {
              this.searchQuery = value
            })
            .transition(livoMotion.enterSoft(80))

          if (this.searchQuery.trim()) {
            Text(`搜索结果：${this.filteredEntries().length} 条`)
              .fontSize(META_FONT_SIZE)
              .fontColor(this.theme.textSecondary)
          }
        }
      }
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 12, bottom: 6 })

      Refresh({ refreshing: $$this.isRefreshing }) {
        List({ space: 14 }) {
          ForEach(this.filteredEntries(), (entry: EntryCardModel, index: number) => {
            ListItem() {
              Column() {
                this.EntryCard(entry)
                if (index < this.filteredEntries().length - 1) {
                  this.EntrySeparator()
                }
              }
            }
            .width('100%')
            .transition(livoMotion.enterSoft(index * 18 + 40))
          }, (entry: EntryCardModel) => entry.id)

          if (this.filteredEntries().length === 0) {
            ListItem() {
              Column({ space: 8 }) {
                Text('还没有可展示的条目')
                  .fontSize(18)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textPrimary)

                Text('请先到订阅页添加或刷新订阅源，然后回到首页查看整理后的内容流。')
                  .fontSize(14)
                  .lineHeight(22)
                  .fontColor(this.theme.textSecondary)
              }
              .alignItems(HorizontalAlign.Start)
              .padding(20)
              .backgroundColor(this.theme.surface)
              .borderRadius(CARD_RADIUS_MD)
              .border({ width: 0.8, color: this.theme.divider })
              .width('100%')
            }
          }

          ListItem() {
            Row().height(100).width('100%')
          }
        }
        .width('100%')
        .height('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      }
      .width('100%')
      .layoutWeight(1)
      .onRefreshing(() => {
        if (!this.isRefreshing) {
          void this.refreshFeaturedEntries()
        }
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }

  onPageShow(): void {
    this.syncRequestedRootTab()
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Tabs({ index: this.visibleRootTabIndex(), controller: rootTabsController }) {
        TabContent() {
          this.HomeRootPage()
        }
        .tabBar(this.EmptyTabBar())

        TabContent() {
          SubscriptionsContent({
            showBottomTabs: false,
            inheritedTheme: this.theme,
            onReady: () => {
              this.commitVisibleTabIfNeeded('subscriptions')
            },
          })
        }
        .tabBar(this.EmptyTabBar())

        TabContent() {
          DiscoverContent({
            showBottomTabs: false,
            inheritedTheme: this.theme,
            onReady: () => {
              this.commitVisibleTabIfNeeded('discover')
            },
          })
        }
        .tabBar(this.EmptyTabBar())

        TabContent() {
          SettingsContent({
            showBottomTabs: false,
            inheritedTheme: this.theme,
            onReady: () => {
              this.commitVisibleTabIfNeeded('settings')
            },
            onThemeChange: (theme: ThemePalette) => {
              this.theme = theme
            },
          })
        }
        .tabBar(this.EmptyTabBar())
      }
      .vertical(false)
      .barPosition(BarPosition.End)
      .barHeight(0)
      .scrollable(false)
      .onChange((index: number) => {
        const nextTabId = rootTabIdForIndex(index)
        this.activeRootTabId = nextTabId
        void this.refreshRootTheme()
      })
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)

      BottomTabs({
        activeTab: this.activeRootTabId,
        theme: this.theme,
        useTabsController: true,
        onTabRequest: (tabId: RootTabId) => {
          this.requestRootTabSwitch(tabId)
        },
      })
      .align(Alignment.Bottom)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
}
