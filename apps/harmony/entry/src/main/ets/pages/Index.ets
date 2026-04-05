import { AppRepository } from '../common/data/AppRepository'
import { KeyboardAvoidMode, LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  HdsTabs,
  HdsTabsController,
  ScrollEffectType,
  SystemMaterialParams,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import window from '@ohos.window'
import { getRequestedRootTabId, openArticleDetail, RootTabId, rootTabIndexForId } from '../common/navigation/AppRouter'
import { ContentModeRail } from '../common/components/ContentModeRail'
import { HomeVideoGrid } from '../common/components/HomeVideoGrid'
import {
  ROOT_MODE_RAIL_TOP_GAP,
} from '../common/components/FloatingRootPageLayout'
import { PictureEntryCard } from '../common/components/PictureEntryCard'
import { TweetEntryCard } from '../common/components/TweetEntryCard'
import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  EntryCardModel,
  HarmonySettings,
  selectPictureMediaUrls,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { createEmptyHomeEntryGroups, groupHomeEntriesByMode, HomeEntryGroups } from '../common/utils/HomeEntryGroups'
import { rememberVisitedMode } from '../common/utils/HomeModeVisitedCache'
import { resolveHomeVideoSceneKind } from '../common/utils/HomeVideoGrid'
import { presentTweetEntryFromCard } from '../common/utils/TweetEntryPresentation'
import { livoMotion } from '../common/ui/Motion'
import { resolveModeSceneRenderState } from '../common/utils/ModeSceneTransition'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
  CARD_RADIUS_MD,
  INPUT_RADIUS,
  META_FONT_SIZE,
  PAGE_TOP_PADDING,
  PAGE_HORIZONTAL_PADDING,
} from '../common/ui/UiTokens'
import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { DiscoverContent } from '../common/components/DiscoverContent'
import { SettingsContent } from '../common/components/SettingsContent'
import {
  HdsBottomTabId,
  HdsBottomTabItem,
  resolveHdsBottomTabBarBottomMargin,
  resolveHdsBottomTabItems,
} from '../common/utils/HdsBottomTabConfig'
import { shouldRefreshThemeOnSystemColorModeChange } from '../common/utils/ThemeRefresh'
import { resolveSystemBarStyle } from '../common/utils/SystemBarStyle'
import { shouldAcceptModeSwitch } from '../common/utils/ModeSwitchGuard'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'
const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
const MODE_SWIPE_TRIGGER_OFFSET: number = 56
const HOME_MODE_CONTENT_GAP: number = 14
const HEADER_BLUR_SCROLL_RANGE: number = 72
const ROOT_TITLE_BAR_MINI_HEIGHT: number = 56
const ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = 36
const HOME_TITLE_BAR_OVERLAY_SPACER: number =
  ROOT_TITLE_BAR_MINI_HEIGHT + ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT
const HOME_MODE_CONTENT_TOP_SPACER_HEIGHT: number = HOME_TITLE_BAR_OVERLAY_SPACER
const ROOT_BOTTOM_TITLE_HEIGHT: number = 36

interface RootTabSymbolPair {
  normal: SymbolGlyphModifier
  selected: SymbolGlyphModifier
}

@Entry
@Component
struct Index {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('systemThemeChangedAt') @Watch('handleSystemThemeChanged') systemThemeChangedAt: number = 0
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @StorageProp('discoverHasForegroundOverlay') discoverHasForegroundOverlay: boolean = false
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @StorageProp('settingsOverlayLevel') settingsOverlayLevel: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @State featuredEntries: EntryCardModel[] = []
  @State entryGroups: HomeEntryGroups<EntryCardModel> = createEmptyHomeEntryGroups<EntryCardModel>()
  @State feedSourceLabel: string = '准备加载本地内容'
  @State isRefreshing: boolean = false
  @State searchQuery: string = ''
  @State showSearch: boolean = false
  @State searchExpanded: boolean = false
  private searchInputController: TextInputController = new TextInputController()
  @State mode: SubscriptionMode = 'articles'
  @State renderedMode: SubscriptionMode = 'articles'
  @State previousMode: SubscriptionMode = 'articles'
  @State visitedModes: SubscriptionMode[] = ['articles']
  @State isModeTransitioning: boolean = false
  @State modeTransitionDirection: number = 1
  @State headerBlurProgress: number = 0
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State rootSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State rootTabIndex: number = 0
  @State activeRootTabId: RootTabId = 'home'
  @State highlightedRootTabId: RootTabId = 'home'
  @State private suppressRootTabChange: boolean = false
  @State settingsScrollerBindingVersion: number = 0
  private readonly rootTabsController: HdsTabsController = new HdsTabsController()
  private readonly articlesScroller: Scroller = new Scroller()
  private readonly socialScroller: Scroller = new Scroller()
  private readonly picturesScroller: Scroller = new Scroller()
  private readonly videosScroller: Scroller = new Scroller()
  private settingsRootScroller?: Scroller
  private headerBlurOffset: number = 0

  private animateWithUiContext(options: AnimateParam, event: () => void): void {
    this.getUIContext().animateTo(options, event)
  }
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
    this.rootSettings = settings
    this.theme = await ThemeService.resolvePalette(settings)
    void this.applySystemBarStyle(this.theme)
    this.featuredEntries = await AppRepository.featuredEntries()
    this.entryGroups = groupHomeEntriesByMode(this.featuredEntries)
    this.feedSourceLabel = '本地内容已加载'
  }

  private async refreshFeaturedEntries(): Promise<void> {
    this.isRefreshing = true

    try {
      const result = await AppRepository.refreshAllFeeds()
      this.featuredEntries = result.entries
      this.entryGroups = groupHomeEntriesByMode(result.entries)
      this.feedSourceLabel = result.sourceLabel
    } finally {
      this.isRefreshing = false
    }
  }

  private refreshRootTheme(): void {
    this.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.theme)
  }

  private updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.headerBlurOffset = clampedOffset
    this.headerBlurProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
  }

  private handleHeaderBlurScrollDelta(delta: number): void {
    this.updateHeaderBlurProgress(this.headerBlurOffset + delta)
  }

  private toggleHomeSearch(): void {
    if (this.showSearch) {
      this.closeSearch()
      return
    }

    this.openSearch()
  }

  private currentRootTitle(): string {
    switch (this.activeRootTabId) {
      case 'subscriptions':
        return '订阅库'
      case 'settings':
        return '设置'
      case 'discover':
        return '添加订阅'
      default:
        return '今日推荐'
    }
  }

  private homeTitleSearchButtonBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.72)' : 'rgba(255,255,255,0.72)'
  }

  private homeTitleSearchButtonBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'
  }

  private homeTitleSearchButtonShadow(): ShadowOptions {
    return {
      radius: 10,
      color: this.theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.12)',
      offsetX: 0,
      offsetY: 2,
    }
  }

  private homeTitleSearchButtonBackdropBlur(): number {
    return this.theme.isDark ? 10 : 18
  }

  @Builder
  private HomeTitleSearchButton() {
    Row() {
      SymbolGlyph($r('sys.symbol.magnifyingglass'))
        .fontSize(20)
        .fontColor([$r('sys.color.icon_primary')])
    }
    .width(34)
    .height(34)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.homeTitleSearchButtonBackgroundColor())
    .backdropBlur(this.homeTitleSearchButtonBackdropBlur())
    .borderRadius(17)
    .border({ width: 0.8, color: this.homeTitleSearchButtonBorderColor() })
    .shadow(this.homeTitleSearchButtonShadow())
    .margin({ top: -20 })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => {
      this.toggleHomeSearch()
    })
  }

  @Builder
  private SettingsRootLowerTitleBuilder() {
    Row() {
      Text(this.currentRootTitle())
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
    }
    .width('100%')
    .height(ROOT_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Center)
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
  }

  @Builder
  private HomeRootLowerTitleBuilder() {
    Row({ space: 12 }) {
      Text('今日推荐')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .layoutWeight(1)
        .margin({ top: -20 })

      this.HomeTitleSearchButton()
    }
    .width('100%')
    .height(ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Center)
    .justifyContent(FlexAlign.SpaceBetween)
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
  }

  private isHomeRootTab(): boolean {
    return this.activeRootTabId === 'home'
  }

  private shouldHideRootTitleBar(): boolean {
    return this.showSearch
      || this.activeRootTabId === 'subscriptions'
      || this.activeRootTabId === 'discover'
      || this.activeRootTabId === 'settings'
  }

  private currentRootScrollEffectType(): ScrollEffectType {
    return ScrollEffectType.IMMERSIVE_GRADIENT_BLUR
  }

  private isSettingsRootTab(): boolean {
    return this.activeRootTabId === 'settings'
  }

  private currentRootBlurEffectiveEndOffset(): LengthMetrics {
    return LengthMetrics.vp(30)
  }

  private currentRootOriginalTitleBarBackgroundColor(): ResourceColor {
    return '#00000000'
  }

  private currentRootScrollEffectBackgroundColor(): ResourceColor {
    return '#00000000'
  }

  private currentRootOriginalTitleBarBlurRadius(): number {
    return 42
  }

  private currentRootScrollEffectTitleBarBlurRadius(): number {
    return 42
  }

  private currentRootOriginalTitleBarMaskExtraHeight(): number {
    return 134
  }

  private currentRootScrollEffectTitleBarMaskExtraHeight(): number {
    return 138
  }

  private currentRootBlurStrategy(): BlurStrategy | undefined {
    return BlurStrategy.ENABLE
  }

  private currentRootSystemMaterialEffect(): SystemMaterialParams | undefined {
    return {
      materialType: hdsMaterial.MaterialType.IMMERSIVE,
      materialLevel: hdsMaterial.MaterialLevel.EXQUISITE,
    }
  }

  private currentRootBindScrollers(): Scroller[] {
    if (this.activeRootTabId === 'home') {
      return [
        this.articlesScroller,
        this.socialScroller,
        this.picturesScroller,
        this.videosScroller,
      ]
    }
    if (this.isSettingsRootTab() && this.settingsRootScroller) {
      return [this.settingsRootScroller]
    }
    return []
  }

  private homeScrollerForMode(mode: SubscriptionMode): Scroller {
    switch (mode) {
      case 'social':
        return this.socialScroller
      case 'pictures':
        return this.picturesScroller
      case 'videos':
        return this.videosScroller
      default:
        return this.articlesScroller
    }
  }

  private handleSettingsContentScrollerReady(scroller: Scroller): void {
    if (this.settingsRootScroller === scroller) {
      return
    }

    this.settingsRootScroller = scroller
    this.settingsScrollerBindingVersion += 1
  }

  @Builder
  private HomeModeHeaderSection() {
    Column({ space: 0 }) {
      Blank()
        .height(HOME_MODE_CONTENT_TOP_SPACER_HEIGHT)

      Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
        Row()
          .width('100%')
          .height(0)

        this.HomeModeRail()
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  private handleSystemThemeChanged(): void {
    void this.refreshThemeFromSystemChange()
  }

  private async refreshThemeFromSystemChange(): Promise<void> {
    const settings = await AppRepository.settings()
    if (!shouldRefreshThemeOnSystemColorModeChange(settings.themeMode)) {
      return
    }

    this.theme = await ThemeService.resolvePaletteForSystemChange(settings)
    void this.applySystemBarStyle(this.theme)
  }

  private async applySystemBarStyle(theme: ThemePalette): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }

    try {
      const systemBarStyle = resolveSystemBarStyle(theme)
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: systemBarStyle.statusBarColor,
        navigationBarColor: systemBarStyle.navigationBarColor,
        isStatusBarLightIcon: systemBarStyle.isStatusBarLightIcon,
        statusBarContentColor: systemBarStyle.statusBarContentColor,
      })
    } catch (_) {
    }
  }

  private syncRequestedRootTab(): void {
    const requestedTab = getRequestedRootTabId()
    if (!requestedTab) {
      return
    }

    this.activeRootTabId = requestedTab
    this.highlightedRootTabId = requestedTab
    this.rootTabIndex = rootTabIndexForId(requestedTab)
    this.syncRootTabsController()
  }

  private syncRootTabsController(): void {
    try {
      this.suppressRootTabChange = true
      this.rootTabsController.changeIndex(this.rootTabIndex)
    } catch (_) {
    } finally {
      this.suppressRootTabChange = false
    }
  }

  private openEntry(entryId: string): void {
    void openArticleDetail(entryId)
  }

  private bottomTabSymbol(
    symbol: Resource,
    colors: ResourceColor[],
  ): SymbolGlyphModifier {
    return new SymbolGlyphModifier(symbol)
      .renderingStrategy(SymbolRenderingStrategy.MULTIPLE_COLOR)
      .fontColor(colors)
  }

  private rootTabSymbolPair(tabId: HdsBottomTabId): RootTabSymbolPair {
    const normalColors: ResourceColor[] = [
      $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
      $r('sys.color.ohos_id_color_bottom_tab_icon_auxcolor_off02'),
    ]
    const selectedColors: ResourceColor[] = [
      $r('sys.color.ohos_id_color_activated'),
      $r('sys.color.ohos_id_color_primary_contrary'),
    ]

    switch (tabId) {
      case 'subscriptions':
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.folder_fill'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.folder_fill'), selectedColors),
        } as RootTabSymbolPair
      case 'discover':
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.magnifyingglass'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.magnifyingglass'), selectedColors),
        } as RootTabSymbolPair
      case 'settings':
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.gearshape'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.gearshape_fill'), selectedColors),
        } as RootTabSymbolPair
      default:
        return {
          normal: this.bottomTabSymbol($r('sys.symbol.house'), normalColors),
          selected: this.bottomTabSymbol($r('sys.symbol.house_fill'), selectedColors),
        } as RootTabSymbolPair
    }
  }

  private handleRootTabChange(index: number): void {
    if (this.suppressRootTabChange) {
      return
    }

    const item = resolveHdsBottomTabItems()[index]
    if (!item) {
      return
    }

    const tabId = item.id as RootTabId
    this.rootTabIndex = index
    this.activeRootTabId = tabId
    this.highlightedRootTabId = tabId
    this.refreshRootTheme()
  }

  private modeIndex(mode: SubscriptionMode): number {
    return SUBSCRIPTION_MODES.indexOf(mode)
  }

  private requestModeSwitch(nextMode: SubscriptionMode): void {
    if (!shouldAcceptModeSwitch({
      currentMode: this.mode,
      nextMode,
      isTransitioning: this.isModeTransitioning,
    })) {
      return
    }

    this.mode = nextMode
    this.visitedModes = rememberVisitedMode(this.visitedModes, nextMode)
    this.startModeTransition(nextMode)
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(this.renderedMode) ? 1 : -1
    this.previousMode = nextMode
    this.renderedMode = nextMode
    this.isModeTransitioning = false
  }

  private adjacentMode(offsetX: number): SubscriptionMode | undefined {
    const currentIndex = this.modeIndex(this.mode)
    if (currentIndex < 0) {
      return undefined
    }

    const nextIndex = offsetX < 0 ? currentIndex + 1 : currentIndex - 1
    if (nextIndex < 0 || nextIndex >= SUBSCRIPTION_MODES.length) {
      return undefined
    }

    return SUBSCRIPTION_MODES[nextIndex]
  }

  private handleModeSwipe(event: GestureEvent): void {
    if (this.isModeTransitioning) {
      return
    }

    const offsetX = event.offsetX
    const offsetY = event.offsetY
    if (Math.abs(offsetX) < MODE_SWIPE_TRIGGER_OFFSET || Math.abs(offsetX) <= Math.abs(offsetY)) {
      return
    }

    const nextMode = this.adjacentMode(offsetX)
    if (nextMode) {
      this.requestModeSwitch(nextMode)
    }
  }

  private filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    switch (mode) {
      case 'social':
        return this.entryGroups.social
      case 'pictures':
        return this.entryGroups.pictures
      case 'videos':
        return this.entryGroups.videos
      default:
        return this.entryGroups.articles
    }
  }

  private handleFeedsChanged(): void {
    void this.reloadFeaturedEntriesFromLocal()
  }

  private async reloadFeaturedEntriesFromLocal(): Promise<void> {
    this.featuredEntries = await AppRepository.featuredEntries()
    this.entryGroups = groupHomeEntriesByMode(this.featuredEntries)
    this.feedSourceLabel = '本地内容已同步'
  }

  private filteredEntries(): EntryCardModel[] {
    return this.filteredEntriesFor(this.mode)
  }

  private pictureCaption(entry: EntryCardModel): string {
    const title = (entry.title || '').trim()
    if (title && title !== '远程条目') {
      return title
    }
    return (entry.summary || '').trim()
  }

  private pictureGalleryUrls(entry: EntryCardModel): string[] {
    return selectPictureMediaUrls(entry.mediaUrls ?? [])
  }

  private pictureCardEntry(entry: EntryCardModel): Entry {
    return {
      id: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      url: entry.articleUrl,
      summary: entry.summary,
      content: '',
      author: entry.author,
      publishedAt: entry.publishedAt,
      readingTimeMinutes: 0,
      tags: entry.tags,
      mediaUrls: entry.mediaUrls ?? [],
      isRead: entry.isRead,
      isStarred: entry.isStarred,
      createdAt: entry.publishedAt,
      updatedAt: entry.publishedAt,
    }
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

  private hasSearchEmptyState(): boolean {
    return !!this.searchQuery.trim() && this.searchAllEntries().length === 0
  }

  private searchPanelHeight(): number {
    const resultCount = this.searchAllEntries().length
    if (resultCount === 0) {
      return 132
    }

    const visibleCount = this.searchExpanded ? Math.min(resultCount, 6) : Math.min(resultCount, 3)
    return visibleCount * 90 + (visibleCount - 1) * 8 + 16
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

  private searchPanelIcon(): Resource {
    return this.theme.isDark ? $r('app.media.nav_discover_active') : $r('app.media.nav_discover_inactive')
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
    const state = resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    })
    return state.visibility === 'visible' ? Visibility.Visible : Visibility.Hidden
  }

  private modeSceneOpacity(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).opacity
  }

  private modeSceneOffset(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).offset
  }

  private modeSceneZIndex(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    }).zIndex
  }

  private shouldMountModeScene(mode: SubscriptionMode): boolean {
    const renderState = resolveModeSceneRenderState({
      mode,
      renderedMode: this.renderedMode,
      previousMode: this.previousMode,
      isTransitioning: this.isModeTransitioning,
      direction: this.modeTransitionDirection,
    })

    return renderState.shouldMount || this.visitedModes.includes(mode)
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
    this.animateWithUiContext({ duration: 260, curve: Curve.EaseIn }, () => {
      this.showSearch = false
      this.searchQuery = ''
      this.searchExpanded = false
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
    .onClick(() => this.openEntry(entry.id))
  }

  private isXSocialEntry(entry: EntryCardModel): boolean {
    const articleUrl = (entry.articleUrl || '').toLowerCase()
    const feedTitle = (entry.feedTitle || '').toLowerCase()
    return articleUrl.includes('x.com/')
      || articleUrl.includes('twitter.com/')
      || feedTitle.includes('x / twitter')
  }

  @Builder
  private SocialEntryCard(entry: EntryCardModel) {
    if (this.isXSocialEntry(entry)) {
      TweetEntryCard({
        presentation: presentTweetEntryFromCard(entry),
        theme: this.theme,
        enableEnterTransition: false,
        onOpen: () => this.openEntry(entry.id),
      })
    } else {
      this.EntryCard(entry)
    }
  }

  @Builder
  private HomeModeRail() {
    ContentModeRail({
      mode: this.mode,
      theme: this.theme,
      interactionLocked: this.isModeTransitioning,
      enableEnterTransition: false,
      onChange: (mode: SubscriptionMode) => {
        this.requestModeSwitch(mode)
      },
    })
  }

  @Builder
  private EntryList(mode: SubscriptionMode) {
    List({ space: HOME_MODE_CONTENT_GAP, scroller: this.homeScrollerForMode(mode) }) {
      ListItem() {
        this.HomeModeHeaderSection()
      }
      .width('100%')

      ForEach(this.filteredEntriesFor(mode), (entry: EntryCardModel) => {
        ListItem() {
          if (mode === 'social') {
            this.SocialEntryCard(entry)
          } else {
            this.EntryCard(entry)
          }
        }
        .width('100%')
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
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
      this.handleHeaderBlurScrollDelta(scrollOffset)
    })
  }

  @Builder
  private PictureEntryList() {
    List({ space: HOME_MODE_CONTENT_GAP, scroller: this.picturesScroller }) {
      ListItem() {
        this.HomeModeHeaderSection()
      }
      .width('100%')

      ForEach(this.filteredEntriesFor('pictures'), (entry: EntryCardModel, index: number) => {
        ListItem() {
          PictureEntryCard({
            entry: this.pictureCardEntry(entry),
            index,
            authorLabel: entry.author || entry.feedTitle,
            feedImageUrl: entry.feedImageUrl,
            caption: this.pictureCaption(entry),
            pictureUrl: entry.imageUrl,
            galleryUrls: this.pictureGalleryUrls(entry),
            theme: this.theme,
            enableEnterTransition: false,
            onOpen: () => this.openEntry(entry.id),
          })
        }
        .width('100%')
      }, (entry: EntryCardModel) => entry.id)

      if (this.filteredEntriesFor('pictures').length === 0) {
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
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .onWillScroll((scrollOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
      this.handleHeaderBlurScrollDelta(scrollOffset)
    })
  }

  @Builder
  private ModeEntriesScene(mode: SubscriptionMode) {
    Stack() {
      if (resolveHomeVideoSceneKind(mode) === 'grid') {
        Scroll(this.homeScrollerForMode(mode)) {
          Column({ space: HOME_MODE_CONTENT_GAP }) {
            this.HomeModeHeaderSection()

            HomeVideoGrid({
              entries: this.filteredEntriesFor(mode),
              inheritedTheme: this.theme,
              onOpenEntry: (entry: EntryCardModel) => {
                this.openEntry(entry.id)
              },
            })
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 100 })
        }
        .width('100%')
        .height('100%')
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
        .onWillScroll((scrollOffset: number, _scrollSource: ScrollSource, _scrollState: ScrollState) => {
          this.handleHeaderBlurScrollDelta(scrollOffset)
        })
      } else if (mode === 'pictures') {
        this.PictureEntryList()
      } else {
        this.EntryList(mode)
      }
    }
    .width('100%')
    .height('100%')
    .visibility(this.modeSceneVisible(mode))
    .opacity(this.modeSceneOpacity(mode))
    .translate({ x: this.modeSceneOffset(mode) })
    .zIndex(this.modeSceneZIndex(mode))
  }

  @Builder
  private HomeRootPage() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack() {
        if (this.shouldMountModeScene('articles')) {
          this.ModeEntriesScene('articles')
        }
        if (this.shouldMountModeScene('social')) {
          this.ModeEntriesScene('social')
        }
        if (this.shouldMountModeScene('pictures')) {
          this.ModeEntriesScene('pictures')
        }
        if (this.shouldMountModeScene('videos')) {
          this.ModeEntriesScene('videos')
        }
      }
      .width('100%')
      .height('100%')
      .gesture(
        PanGesture({ direction: PanDirection.Horizontal })
          .onActionEnd((event: GestureEvent) => {
            this.handleModeSwipe(event)
          })
      )
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  onPageShow(): void {
    this.syncRequestedRootTab()
  }

  private shouldHideBottomTabs(): boolean {
    return (
      (this.activeRootTabId === 'discover' && this.discoverHasForegroundOverlay)
      || (this.activeRootTabId === 'subscriptions' && this.subscriptionsOverlayLevel > 0)
      || (this.activeRootTabId === 'settings' && this.settingsOverlayLevel > 0)
    )
  }

  build() {
    Stack() {
      HdsNavigation() {
        HdsTabs({ controller: this.rootTabsController }) {
          ForEach(resolveHdsBottomTabItems(), (item: HdsBottomTabItem) => {
            TabContent() {
              Stack() {
                if (item.id === 'home') {
                  this.HomeRootPage()
                } else if (item.id === 'subscriptions') {
                  SubscriptionsContent({
                    showBottomTabs: false,
                    inheritedTheme: this.theme,
                  })
                } else if (item.id === 'discover') {
                  DiscoverContent({
                    showBottomTabs: false,
                    reserveBottomTabInset: true,
                    inheritedTheme: this.theme,
                  })
                } else {
                  SettingsContent({
                    showBottomTabs: false,
                    inheritedTheme: this.theme,
                    inheritedSettings: this.rootSettings,
                    onContentScrollerReady: (scroller: Scroller) => {
                      this.handleSettingsContentScrollerReady(scroller)
                    },
                    onSettingsChange: (settings: HarmonySettings) => {
                      this.rootSettings = settings
                    },
                    onThemeChange: (theme: ThemePalette) => {
                      this.theme = theme
                      void this.applySystemBarStyle(theme)
                    },
                  })
                }
              }
              .width('100%')
              .height('100%')
            }
            .tabBar(BottomTabBarStyle.of({
              normal: this.rootTabSymbolPair(item.id).normal,
              selected: this.rootTabSymbolPair(item.id).selected,
            }, item.label))
          }, (item: HdsBottomTabItem) => item.id)
        }
        .vertical(false)
        .scrollable(false)
        .animationDuration(0)
        .barPosition(BarPosition.End)
        .barOverlap(true)
        .barHeight(this.shouldHideBottomTabs() ? 0 : BOTTOM_TAB_BAR_HEIGHT)
        .barFloatingStyle({
          barBottomMargin: resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP),
          systemMaterialEffect: {
            materialType: hdsMaterial.MaterialType.ADAPTIVE,
            materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
          },
        })
        .onChange((index: number) => {
          this.handleRootTabChange(index)
        })
      }
      .mode(NavigationMode.Stack)
      .titleBar({
        content: {
          title: {
            mainTitle: this.isHomeRootTab() || this.isSettingsRootTab() ? '' : this.currentRootTitle(),
          },
          bottomBuilder: this.isHomeRootTab()
            ? {
                builder: (): void => this.HomeRootLowerTitleBuilder(),
              }
            : this.isSettingsRootTab()
            ? {
                builder: (): void => this.SettingsRootLowerTitleBuilder(),
              }
            : undefined,
        },
        style: {
          scrollEffectOpts: {
            enableScrollEffect: true,
            scrollEffectType: this.currentRootScrollEffectType(),
            blurEffectiveStartOffset: LengthMetrics.vp(0),
            blurEffectiveEndOffset: this.currentRootBlurEffectiveEndOffset(),
          },
          blurStrategy: this.currentRootBlurStrategy(),
          originalStyle: {
            backgroundStyle: {
              backgroundColor: this.currentRootOriginalTitleBarBackgroundColor(),
              maskExtraHeight: this.currentRootOriginalTitleBarMaskExtraHeight(),
              blurRadius: this.currentRootOriginalTitleBarBlurRadius(),
            },
            contentStyle: {
              titleStyle: {
                mainTitleColor: $r('sys.color.font_primary'),
                subTitleColor: $r('sys.color.font_secondary'),
              },
              menuStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
              backIconStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
            },
          },
          scrollEffectStyle: {
            backgroundStyle: {
              backgroundColor: this.currentRootScrollEffectBackgroundColor(),
              maskExtraHeight: this.currentRootScrollEffectTitleBarMaskExtraHeight(),
              blurRadius: this.currentRootScrollEffectTitleBarBlurRadius(),
            },
            contentStyle: {
              titleStyle: {
                mainTitleColor: $r('sys.color.font_primary'),
                subTitleColor: $r('sys.color.font_secondary'),
              },
              menuStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
              backIconStyle: {
                backgroundColor: $r('sys.color.comp_background_tertiary'),
                iconColor: $r('sys.color.icon_primary'),
              },
            },
          },
          systemMaterialEffect: this.currentRootSystemMaterialEffect(),
        },
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideTitleBar(this.shouldHideRootTitleBar())
      .hideBackButton(true)
      .bindToScrollable(this.currentRootBindScrollers())
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
      .width('100%')
      .height('100%')

      if (this.showSearch) {
        Column() {
          Column({ space: 10 }) {
            Row({ space: 8 }) {
              Image(this.searchPanelIcon())
                .width(20)
                .height(20)
                .objectFit(ImageFit.Contain)
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
                .onClick(() => {
                  if (this.searchExpanded) {
                    this.animateWithUiContext({ duration: 300, curve: Curve.EaseOut }, () => {
                      this.searchExpanded = false
                    })
                  }
                })
                .onBlur(() => {
                  if (!this.searchExpanded && this.searchQuery.trim()) {
                    this.animateWithUiContext({ duration: 300, curve: Curve.EaseOut }, () => {
                      this.searchExpanded = true
                    })
                  }
                })
            }
            .width('100%')
            .padding({ left: 16, right: 16, top: 14, bottom: 14 })
            .backgroundColor(this.theme.elevated)
            .borderRadius(INPUT_RADIUS)
            .border({ width: 0.8, color: this.theme.divider })
            .shadow({
              radius: 10,
              color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)',
              offsetY: 2,
            })
            .gesture(
              PanGesture({ direction: PanDirection.Down })
                .onActionEnd((event: GestureEvent) => {
                  if (event.offsetY > 30) {
                    this.closeSearch()
                  }
                })
            )

            if (this.searchQuery.trim()) {
              Stack({ alignContent: Alignment.Bottom }) {
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
                    .transition(
                      TransitionEffect.OPACITY.animation({ duration: 200, curve: Curve.EaseOut, delay: index * 30 })
                    )
                  }, (entry: EntryCardModel) => `${entry.id}_${this.searchQuery}`)

                  if (this.hasSearchEmptyState()) {
                    ListItem() {
                      Column({ space: 8 }) {
                        Image(this.searchPanelIcon())
                          .width(24)
                          .height(24)
                          .objectFit(ImageFit.Contain)

                        Text('搜索不到内容')
                          .fontSize(15)
                          .fontWeight(FontWeight.Medium)
                          .fontColor(this.theme.textPrimary)

                        Text('换个关键词试试，或者搜索标题、摘要和来源')
                          .fontSize(12)
                          .fontColor(this.theme.textSecondary)
                          .textAlign(TextAlign.Center)
                          .maxLines(2)
                      }
                      .width('100%')
                      .padding({ left: 20, right: 20, top: 24, bottom: 24 })
                      .justifyContent(FlexAlign.Center)
                      .alignItems(HorizontalAlign.Center)
                      .backgroundColor(this.theme.surface)
                      .borderRadius(12)
                    }
                  }
                }
                .width('100%')
                .height(this.searchPanelHeight())
                .backgroundColor(this.theme.surface)
                .borderRadius(this.searchExpanded ? 16 : INPUT_RADIUS)
                .border({ width: 0.8, color: this.theme.divider })
                .shadow({
                  radius: 10,
                  color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)',
                  offsetY: 2,
                })
                .padding({ left: 8, right: 8, top: 8, bottom: 8 })
                .scrollBar(BarState.Off)
                .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
                .alignListItem(ListItemAlign.Start)
                .onWillScroll((_scrollOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
                  if (!this.searchExpanded) {
                    this.searchInputController.stopEditing()
                    this.animateWithUiContext({ duration: 400, curve: Curve.FastOutSlowIn }, () => {
                      this.searchExpanded = true
                    })
                  }
                })
              }
              .clip(true)
              .animation({ duration: 400, curve: Curve.FastOutSlowIn })
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
