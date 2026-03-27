import { AppRepository } from '../common/data/AppRepository'
import window from '@ohos.window'
import { BottomTabs } from '../common/components/BottomTabs'
import { getRequestedRootTabId, openArticleDetail, RootTabId, rootTabIndexForId } from '../common/navigation/AppRouter'
import { ContentModeRail } from '../common/components/ContentModeRail'
import { PageHeader } from '../common/components/PageHeader'
import { EntryCardModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { livoMotion } from '../common/ui/Motion'
import {
  CARD_RADIUS_MD,
  INPUT_RADIUS,
  META_FONT_SIZE,
  PAGE_TOP_PADDING,
  PAGE_HORIZONTAL_PADDING,
} from '../common/ui/UiTokens'
import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { DiscoverContent } from '../common/components/DiscoverContent'
import { SettingsContent } from '../common/components/SettingsContent'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'

@Entry
@Component
struct Index {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @State featuredEntries: EntryCardModel[] = []
  @State feedSourceLabel: string = '准备加载本地内容'
  @State isRefreshing: boolean = false
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  @State mode: SubscriptionMode = 'articles'
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State rootTabIndex: number = 0
  @State activeRootTabId: RootTabId = 'home'
  @State highlightedRootTabId: RootTabId = 'home'
  @State previousRootTabId: RootTabId = 'home'
  @State isRootTransitioning: boolean = false
  private pendingRootTabId: RootTabId = 'home'
  private rootTransitionVersion: number = 0

  aboutToAppear(): void {
    console.info('Livo Harmony Index aboutToAppear')
    this.syncRequestedRootTab()
    void this.loadInitialData()
  }

  private async loadInitialData(): Promise<void> {
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    void this.applySystemBarStyle(this.theme)
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

  private refreshRootTheme(): void {
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
  }

  private async applySystemBarStyle(theme: ThemePalette): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }

    try {
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: '#00000000',
        navigationBarColor: '#00000000',
        isStatusBarLightIcon: theme.isDark,
      })
    } catch (_) {
    }
  }

  private syncRequestedRootTab(): void {
    const requestedTab = getRequestedRootTabId()
    if (!requestedTab) {
      return
    }

    this.previousRootTabId = requestedTab
    this.isRootTransitioning = false
    this.activeRootTabId = requestedTab
    this.highlightedRootTabId = requestedTab
    this.pendingRootTabId = requestedTab
    this.rootTabIndex = rootTabIndexForId(requestedTab)
  }

  private requestRootTabSwitch(tabId: RootTabId): void {
    const nextIndex = rootTabIndexForId(tabId)
    if (tabId === this.highlightedRootTabId && nextIndex === this.rootTabIndex) {
      return
    }

    this.highlightedRootTabId = tabId
    this.pendingRootTabId = tabId
    this.startRootTabTransition(tabId, nextIndex)
  }

  private startRootTabTransition(tabId: RootTabId, nextIndex: number): void {
    const currentTabId = this.activeRootTabId
    const currentIndex = this.rootTabIndex
    if (currentTabId === tabId && currentIndex === nextIndex) {
      return
    }

    this.rootTransitionVersion += 1
    const version = this.rootTransitionVersion
    this.previousRootTabId = currentTabId
    this.isRootTransitioning = true
    this.activeRootTabId = tabId
    this.rootTabIndex = nextIndex
    this.refreshRootTheme()

    setTimeout(() => {
      if (version !== this.rootTransitionVersion) {
        return
      }

      this.previousRootTabId = tabId
      this.isRootTransitioning = false
      if (this.highlightedRootTabId !== this.activeRootTabId) {
        this.highlightedRootTabId = this.activeRootTabId
      }
    }, livoMotion.rootSceneDuration())
  }

  private openEntry(entryId: string): void {
    void openArticleDetail(entryId)
  }

  private sceneVisible(tabId: RootTabId): Visibility {
    if (tabId === this.activeRootTabId) {
      return Visibility.Visible
    }

    if (this.isRootTransitioning && tabId === this.previousRootTabId) {
      return Visibility.Visible
    }

    return Visibility.Hidden
  }

  private sceneOffset(tabId: RootTabId): number {
    return livoMotion.rootSceneOffset(this.rootTabIndex, rootTabIndexForId(tabId))
  }

  private sceneOpacity(tabId: RootTabId): number {
    return livoMotion.rootSceneOpacity(tabId === this.activeRootTabId)
  }

  private sceneScale(tabId: RootTabId): number {
    return livoMotion.rootSceneScale(tabId === this.activeRootTabId)
  }

  private sceneZIndex(tabId: RootTabId): number {
    if (tabId === this.activeRootTabId) {
      return 2
    }

    if (this.isRootTransitioning && tabId === this.previousRootTabId) {
      return 1
    }

    return 0
  }

  @Builder
  private RootScene(tabId: RootTabId) {
    Stack() {
      if (tabId === 'home') {
        this.HomeRootPage()
      } else if (tabId === 'subscriptions') {
        SubscriptionsContent({
          showBottomTabs: false,
          inheritedTheme: this.theme,
        })
      } else if (tabId === 'discover') {
        DiscoverContent({
          showBottomTabs: false,
          inheritedTheme: this.theme,
        })
      } else {
        SettingsContent({
          showBottomTabs: false,
          inheritedTheme: this.theme,
          onThemeChange: (theme: ThemePalette) => {
            this.theme = theme
            void this.applySystemBarStyle(theme)
          },
        })
      }
    }
    .width('100%')
    .height('100%')
    .visibility(this.sceneVisible(tabId))
    .opacity(this.sceneOpacity(tabId))
    .translate({ x: this.sceneOffset(tabId) })
    .zIndex(this.sceneZIndex(tabId))
    .animation({
      duration: livoMotion.rootSceneDuration(),
      curve: livoMotion.rootSceneCurve(),
    })
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

  @Builder
  private EntryCard(entry: EntryCardModel) {
    Column({ space: 8 }) {
      Row({ space: 6 }) {
        Text(entry.feedTitle)
          .fontSize(12)
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
      }
      .width('100%')

      Text(entry.title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(22)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 14, right: 14, top: 14, bottom: 14 })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => this.openEntry(entry.id))
  }

  @Builder
  private HomeRootPage() {
    Column() {
      Column({ space: 14 }) {
        PageHeader({
          title: '今日推荐',
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
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 6 })

      Refresh({ refreshing: $$this.isRefreshing }) {
        List({ space: 10 }) {
          ForEach(this.filteredEntries(), (entry: EntryCardModel, index: number) => {
            ListItem() {
              this.EntryCard(entry)
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
  }

  onPageShow(): void {
    this.syncRequestedRootTab()
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Stack() {
        this.RootScene('home')
        this.RootScene('subscriptions')
        this.RootScene('discover')
        this.RootScene('settings')
      }
      .width('100%')
      .height('100%')
      .padding({ top: this.topAvoidArea })
      .backgroundColor(this.theme.background)

      BottomTabs({
        activeTab: this.highlightedRootTabId,
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
  }
}
