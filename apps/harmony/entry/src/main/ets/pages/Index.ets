import { AppRepository } from '../common/data/AppRepository'
import { KeyboardAvoidMode } from '@kit.ArkUI'
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
const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
const MODE_SCENE_DURATION: number = 240

@Entry
@Component
struct Index {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @State featuredEntries: EntryCardModel[] = []
  @State feedSourceLabel: string = '准备加载本地内容'
  @State isRefreshing: boolean = false
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  private searchInputController: TextInputController = new TextInputController()
  @State mode: SubscriptionMode = 'articles'
  @State renderedMode: SubscriptionMode = 'articles'
  @State previousMode: SubscriptionMode = 'articles'
  @State isModeTransitioning: boolean = false
  @State modeTransitionDirection: number = 1
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State rootTabIndex: number = 0
  @State activeRootTabId: RootTabId = 'home'
  @State highlightedRootTabId: RootTabId = 'home'
  @State previousRootTabId: RootTabId = 'home'
  @State isRootTransitioning: boolean = false
  private pendingRootTabId: RootTabId = 'home'
  private rootTransitionVersion: number = 0
  private modeTransitionVersion: number = 0
  aboutToAppear(): void {
    console.info('Livo Harmony Index aboutToAppear')
    this.syncRequestedRootTab()
    this.updateKeyboardAvoidMode(KeyboardAvoidMode.OFFSET)
    void this.loadInitialData()
  }

  aboutToDisappear(): void {
    this.updateKeyboardAvoidMode(KeyboardAvoidMode.OFFSET)
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

  private modeIndex(mode: SubscriptionMode): number {
    return SUBSCRIPTION_MODES.indexOf(mode)
  }

  private requestModeSwitch(nextMode: SubscriptionMode): void {
    if (nextMode === this.mode) {
      return
    }

    this.mode = nextMode
    this.startModeTransition(nextMode)
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    const currentMode = this.renderedMode
    if (currentMode === nextMode) {
      this.previousMode = nextMode
      this.isModeTransitioning = false
      return
    }

    this.modeTransitionVersion += 1
    const version = this.modeTransitionVersion
    this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(currentMode) ? 1 : -1
    this.previousMode = currentMode
    this.renderedMode = nextMode
    this.isModeTransitioning = true

    setTimeout(() => {
      if (version !== this.modeTransitionVersion) {
        return
      }

      this.previousMode = nextMode
      this.isModeTransitioning = false
    }, MODE_SCENE_DURATION)
  }

  private filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    return this.featuredEntries.filter((entry: EntryCardModel) =>
      entry.viewLabel === this.getModeTitle(mode)
    )
  }

  private filteredEntries(): EntryCardModel[] {
    return this.filteredEntriesFor(this.mode)
  }

  private searchAllEntries(): EntryCardModel[] {
    const keyword = this.searchQuery.trim().toLowerCase()
    if (!keyword) {
      return []
    }

    return this.featuredEntries.filter((entry: EntryCardModel) =>
      entry.title.toLowerCase().includes(keyword)
      || entry.summary.toLowerCase().includes(keyword)
      || entry.feedTitle.toLowerCase().includes(keyword)
    )
  }

  private getMatchedContent(text: string, keyword: string, maxLength: number = 60): string {
    if (!keyword || !text) {
      return ''
    }
    const lowerText = text.toLowerCase()
    const lowerKeyword = keyword.toLowerCase()
    const index = lowerText.indexOf(lowerKeyword)
    if (index === -1) {
      return ''
    }
    const start = Math.max(0, index - 20)
    const end = Math.min(text.length, index + keyword.length + 30)
    let result = text.slice(start, end)
    if (start > 0) {
      result = '...' + result
    }
    if (end < text.length) {
      result = result + '...'
    }
    return result
  }

  private findHighlightIndex(text: string, keyword: string): number {
    if (!keyword || !text) {
      return -1
    }
    return text.toLowerCase().indexOf(keyword.toLowerCase())
  }

  private getMatchedContentPrefix(text: string, keyword: string): string {
    if (!keyword || !text) {
      return ''
    }
    const lowerText = text.toLowerCase()
    const lowerKeyword = keyword.toLowerCase()
    const index = lowerText.indexOf(lowerKeyword)
    if (index === -1) {
      return ''
    }
    const start = Math.max(0, index - 20)
    let prefix = text.slice(start, index)
    if (start > 0) {
      prefix = '...' + prefix
    }
    return prefix
  }

  private getMatchedContentSuffix(text: string, keyword: string): string {
    if (!keyword || !text) {
      return ''
    }
    const lowerText = text.toLowerCase()
    const lowerKeyword = keyword.toLowerCase()
    const index = lowerText.indexOf(lowerKeyword)
    if (index === -1) {
      return ''
    }
    const end = Math.min(text.length, index + keyword.length + 30)
    let suffix = text.slice(index + keyword.length, end)
    if (end < text.length) {
      suffix = suffix + '...'
    }
    return suffix
  }

  @Builder
  private HighlightTitle(title: string, keyword: string) {
    if (!keyword || this.findHighlightIndex(title, keyword) < 0) {
      Text(title)
        .fontSize(14)
        .fontColor(this.theme.textPrimary)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
    } else {
      Text() {
        Span(title.slice(0, this.findHighlightIndex(title, keyword)))
          .fontSize(14)
          .fontColor(this.theme.textPrimary)
        Span(title.slice(
          this.findHighlightIndex(title, keyword),
          this.findHighlightIndex(title, keyword) + keyword.length
        ))
          .fontSize(14)
          .fontColor(this.theme.accent)
          .fontWeight(FontWeight.Medium)
        Span(title.slice(this.findHighlightIndex(title, keyword) + keyword.length))
          .fontSize(14)
          .fontColor(this.theme.textPrimary)
      }
      .maxLines(2)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .layoutWeight(1)
    }
  }

  @Builder
  private HighlightSummary(summary: string, keyword: string) {
    Text() {
      Span(this.getMatchedContentPrefix(summary, keyword))
        .fontSize(12)
        .fontColor(this.theme.textSecondary)
      Span(keyword)
        .fontSize(12)
        .fontColor(this.theme.accent)
        .fontWeight(FontWeight.Medium)
      Span(this.getMatchedContentSuffix(summary, keyword))
        .fontSize(12)
        .fontColor(this.theme.textSecondary)
    }
    .maxLines(2)
    .textOverflow({ overflow: TextOverflow.Ellipsis })
    .width('100%')
  }

  private modeSceneVisible(mode: SubscriptionMode): Visibility {
    if (mode === this.renderedMode) {
      return Visibility.Visible
    }

    if (this.isModeTransitioning && mode === this.previousMode) {
      return Visibility.Visible
    }

    return Visibility.Hidden
  }

  private modeSceneOpacity(mode: SubscriptionMode): number {
    return mode === this.renderedMode ? 1 : 0
  }

  private modeSceneOffset(mode: SubscriptionMode): number {
    if (mode === this.renderedMode) {
      return 0
    }

    if (!this.isModeTransitioning || mode !== this.previousMode) {
      return 0
    }

    return this.modeTransitionDirection > 0 ? -16 : 16
  }

  private modeSceneZIndex(mode: SubscriptionMode): number {
    if (mode === this.renderedMode) {
      return 2
    }

    if (this.isModeTransitioning && mode === this.previousMode) {
      return 1
    }

    return 0
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

  private updateKeyboardAvoidMode(mode: KeyboardAvoidMode): void {
    try {
      this.getUIContext().setKeyboardAvoidMode(mode)
    } catch (_) {
    }
  }

  private openSearch(): void {
    if (this.showSearch) {
      return
    }

    this.updateKeyboardAvoidMode(KeyboardAvoidMode.NONE)
    this.showSearch = true

    setTimeout(() => {
      const focusController = this.getUIContext().getFocusController()
      focusController.requestFocus('home_search_input')
    }, 140)
  }

  private closeSearch(): void {
    if (!this.showSearch) {
      return
    }

    this.updateKeyboardAvoidMode(KeyboardAvoidMode.OFFSET)
    animateTo({ duration: 260, curve: Curve.EaseIn }, () => {
      this.showSearch = false
      this.searchQuery = ''
    })
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
  private EntryList(mode: SubscriptionMode) {
    List({ space: 10 }) {
      ForEach(this.filteredEntriesFor(mode), (entry: EntryCardModel, index: number) => {
        ListItem() {
          this.EntryCard(entry)
        }
        .width('100%')
        .transition(livoMotion.enterSoft(index * 18 + 40))
      }, (entry: EntryCardModel) => entry.id)

      if (this.filteredEntriesFor(mode).length === 0) {
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

  @Builder
  private ModeEntriesScene(mode: SubscriptionMode) {
    Stack() {
      this.EntryList(mode)
    }
    .width('100%')
    .height('100%')
    .visibility(this.modeSceneVisible(mode))
    .opacity(this.modeSceneOpacity(mode))
    .translate({ x: this.modeSceneOffset(mode) })
    .zIndex(this.modeSceneZIndex(mode))
    .animation({
      duration: MODE_SCENE_DURATION,
      curve: Curve.EaseInOut,
    })
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
            if (this.showSearch) {
              this.closeSearch()
              return
            }
            this.openSearch()
          },
        })

        ContentModeRail({
          mode: this.mode,
          theme: this.theme,
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
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
      }
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 6 })

      Refresh({ refreshing: $$this.isRefreshing }) {
        Stack() {
          this.ModeEntriesScene('articles')
          this.ModeEntriesScene('social')
          this.ModeEntriesScene('pictures')
          this.ModeEntriesScene('videos')
        }
        .width('100%')
        .height('100%')
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

      if (!(this.activeRootTabId === 'discover' && this.discoverOverlayLevel > 0)) {
        BottomTabs({
          activeTab: this.highlightedRootTabId,
          theme: this.theme,
          useTabsController: true,
          onTabRequest: (tabId: RootTabId) => {
            this.requestRootTabSwitch(tabId)
          },
        })
      }

      if (this.showSearch) {
        Column() {
          Column({ space: 10 }) {
            Row({ space: 8 }) {
              SymbolGlyph($r('sys.symbol.magnifyingglass'))
                .fontSize(20)
                .fontColor([this.theme.textSecondary])
              TextInput({ text: this.searchQuery, placeholder: '搜索标题、摘要或来源', controller: this.searchInputController })
                .backgroundColor('transparent')
                .fontColor(this.theme.textPrimary)
                .padding(0)
                .layoutWeight(1)
                .defaultFocus(true)
                .id('home_search_input')
                .textAlign(TextAlign.Center)
                .onChange((value: string) => {
                  this.searchQuery = value
                })
            }
            .width('100%')
            .padding({ left: 16, right: 16, top: 14, bottom: 14 })
            .backgroundColor(this.theme.surface)
            .borderRadius(INPUT_RADIUS)
            .border({ width: 0.8, color: this.theme.divider })
            .shadow({ radius: 14, color: 'rgba(0,0,0,0.08)', offsetY: 4 })
            .gesture(
              PanGesture({ direction: PanDirection.Down })
                .onActionEnd((event: GestureEvent) => {
                  if (event.offsetY > 30) {
                    this.closeSearch()
                  }
                })
            )

            if (this.searchQuery.trim()) {
              List({ space: 8 }) {
                ForEach(this.searchAllEntries(), (entry: EntryCardModel, index: number) => {
                  ListItem() {
                    Column({ space: 6 }) {
                      Flex({ justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start }) {
                        this.HighlightTitle(entry.title, this.searchQuery.trim())

                        Text(entry.feedTitle)
                          .fontSize(11)
                          .fontColor(this.theme.textMuted)
                          .maxLines(1)
                          .textOverflow({ overflow: TextOverflow.Ellipsis })
                          .flexShrink(0)
                          .margin({ left: 8, top: 2 })
                      }
                      .width('100%')

                      if (entry.summary && entry.summary.trim()) {
                        if (this.getMatchedContent(entry.summary, this.searchQuery.trim())) {
                          this.HighlightSummary(entry.summary, this.searchQuery.trim())
                        } else {
                          Text(entry.summary)
                            .fontSize(12)
                            .fontColor(this.theme.textSecondary)
                            .maxLines(2)
                            .textOverflow({ overflow: TextOverflow.Ellipsis })
                            .width('100%')
                        }
                      }
                    }
                    .width('100%')
                    .alignItems(HorizontalAlign.Start)
                    .padding({ left: 16, right: 16, top: 10, bottom: 10 })
                    .backgroundColor(this.theme.surface)
                    .borderRadius(12)
                    .clickEffect({ level: ClickEffectLevel.LIGHT })
                    .onClick(() => {
                      this.closeSearch()
                      this.openEntry(entry.id)
                    })
                  }
                }, (entry: EntryCardModel) => `${entry.id}_${this.searchQuery}`)

                if (this.searchAllEntries().length === 0) {
                  ListItem() {
                    Text('没有找到相关内容')
                      .fontSize(14)
                      .fontColor(this.theme.textSecondary)
                      .padding(16)
                  }
                }
              }
              .width('100%')
              .height(Math.min(this.searchAllEntries().length, 3) * 90 + (Math.min(this.searchAllEntries().length, 3) - 1) * 8 + 16)
              .backgroundColor(this.theme.surface)
              .borderRadius(INPUT_RADIUS)
              .border({ width: 0.8, color: this.theme.divider })
              .shadow({ radius: 14, color: 'rgba(0,0,0,0.08)', offsetY: 4 })
              .padding({ left: 8, right: 8, top: 8, bottom: 8 })
              .scrollBar(BarState.Off)
              .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
              .alignListItem(ListItemAlign.Start)
            }
          }
          .width('100%')
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING })
          .transition(
            TransitionEffect.asymmetric(
              TransitionEffect.translate({ y: -20 })
                .combine(TransitionEffect.opacity(0))
                .animation({ duration: 260, curve: Curve.EaseOut }),
              TransitionEffect.translate({ y: -20 })
                .combine(TransitionEffect.opacity(0))
                .animation({ duration: 260, curve: Curve.EaseIn })
            )
          )
        }
        .width('100%')
        .height('100%')
        .padding({ top: this.topAvoidArea })
        .justifyContent(FlexAlign.Start)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor('rgba(0,0,0,0.15)')
        .onClick(() => {
          this.closeSearch()
        })
        .zIndex(10)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
