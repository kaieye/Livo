import { AppRepository } from '../common/data/AppRepository'
import { LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
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
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from '../common/components/FloatingRootPageLayout'
import { PictureEntryCard } from '../common/components/PictureEntryCard'
import { TweetEntryCard } from '../common/components/TweetEntryCard'
import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  EntryCardModel,
  HarmonySettings,
  articleDetailModelFromCard,
  selectPictureCarouselMediaUrls,
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
  META_FONT_SIZE,
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
const HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const HOME_TITLE_BAR_OVERLAY_SPACER: number =
  ROOT_TITLE_BAR_MINI_HEIGHT + HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
const HOME_MODE_CONTENT_TOP_SPACER_HEIGHT: number = HOME_TITLE_BAR_OVERLAY_SPACER
const HOME_MODE_RAIL_HEIGHT: number = 46
const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
const HOME_MODE_HEADER_SPACER_HEIGHT: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT + ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
const ROOT_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET: number = 0
const HOME_COLLAPSED_MODE_RAIL_SIZE: number = 40
const HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA: number = 14
const HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT: number = -6
const HOME_COLLAPSED_MODE_RAIL_TOP_PADDING: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT - HOME_COLLAPSED_MODE_RAIL_SIZE - ROOT_MODE_RAIL_TOP_GAP

interface RootTabSymbolPair {
  normal: SymbolGlyphModifier
  selected: SymbolGlyphModifier
}

interface HomeModeRailOptions {
  collapsed?: boolean
  collapseProgress?: number
}

interface HomeModeScrollOffsetMap {
  articles: number
  social: number
  pictures: number
  videos: number
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
  @State mode: SubscriptionMode = 'articles'
  @State renderedMode: SubscriptionMode = 'articles'
  @State previousMode: SubscriptionMode = 'articles'
  @State visitedModes: SubscriptionMode[] = ['articles']
  @State isModeTransitioning: boolean = false
  @State modeTransitionDirection: number = 1
  @State headerBlurProgress: number = 0
  @State currentHomeModeScrollOffset: number = 0
  @State homeModeRailExpandedOverride: boolean = false
  @State homeModeRailExpandedLockOffset: number = -1
  @State homeCollapsedModeRailPressed: boolean = false
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
  private readonly homeModeScrollOffsets: HomeModeScrollOffsetMap = {
    articles: 0,
    social: 0,
    pictures: 0,
    videos: 0,
  }
  private settingsRootScroller?: Scroller
  private headerBlurOffset: number = 0

  aboutToAppear(): void {
    console.info('Livo Harmony Index aboutToAppear')
    this.syncRequestedRootTab()
    void this.loadInitialData()
  }

  aboutToDisappear(): void {
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

  private homeModeScrollOffsetFor(mode: SubscriptionMode): number {
    switch (mode) {
      case 'social':
        return this.homeModeScrollOffsets.social
      case 'pictures':
        return this.homeModeScrollOffsets.pictures
      case 'videos':
        return this.homeModeScrollOffsets.videos
      default:
        return this.homeModeScrollOffsets.articles
    }
  }

  private updateHomeModeScrollOffset(mode: SubscriptionMode, offset: number): void {
    switch (mode) {
      case 'social':
        this.homeModeScrollOffsets.social = offset
        break
      case 'pictures':
        this.homeModeScrollOffsets.pictures = offset
        break
      case 'videos':
        this.homeModeScrollOffsets.videos = offset
        break
      default:
        this.homeModeScrollOffsets.articles = offset
        break
    }
  }

  private readHomeModeScrollOffset(mode: SubscriptionMode): number {
    try {
      return Math.max(0, this.homeScrollerForMode(mode).currentOffset().yOffset)
    } catch (_) {
      return this.homeModeScrollOffsetFor(mode)
    }
  }

  private syncHomeModeRailState(mode: SubscriptionMode = this.mode): void {
    const nextOffset = this.readHomeModeScrollOffset(mode)
    this.updateHomeModeScrollOffset(mode, nextOffset)
    if (mode !== this.mode) {
      return
    }

    if (this.homeModeRailExpandedOverride) {
      if (Math.abs(nextOffset - this.homeModeRailExpandedLockOffset) < 0.5) {
        return
      }

      this.homeModeRailExpandedOverride = false
      this.homeModeRailExpandedLockOffset = -1
    }

    this.currentHomeModeScrollOffset = nextOffset
    this.updateHeaderBlurProgress(nextOffset)
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

  private homeCollapsedModeRailBackdropBlur(): number {
    return this.theme.isDark ? 10 : 18
  }

  private homeCollapsedModeRailBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.74)' : 'rgba(255,255,255,0.84)'
  }

  private homeCollapsedModeRailBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'
  }

  private homeCollapsedModeRailShadow(): ShadowOptions {
    return {
      radius: 10,
      color: this.theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.12)',
      offsetX: 0,
      offsetY: 2,
    }
  }

  @Builder
  private HomeCollapsedModeRailIcon() {
    if (this.mode === 'articles') {
      Image($r('app.media.sub_articles_inactive'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    } else if (this.mode === 'social') {
      Image($r('app.media.sub_social_inactive'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    } else if (this.mode === 'pictures') {
      Image($r('app.media.sub_pictures_inactive'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    } else {
      Image($r('app.media.sub_videos_inactive'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    }
  }

  @Builder
  private HomeCollapsedModeRailButton() {
    Row() {
      this.HomeCollapsedModeRailIcon()
    }
    .width(this.homeCollapsedModeRailWidth())
    .height(this.homeCollapsedModeRailWidth())
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.homeCollapsedModeRailBackgroundColor())
    .backdropBlur(this.homeCollapsedModeRailBackdropBlur())
    .borderRadius(this.homeCollapsedModeRailWidth())
    .border({ width: 0.8, color: this.homeCollapsedModeRailBorderColor() })
    .shadow(this.homeCollapsedModeRailShadow())
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .scale({
      x: this.homeCollapsedModeRailPressed ? 0.92 : 1,
      y: this.homeCollapsedModeRailPressed ? 0.92 : 1,
    })
    .opacity(this.homeCollapsedModeRailPressed ? 0.82 : 1)
    .animation({ duration: 140, curve: Curve.EaseOut })
    .onTouch((event: TouchEvent) => {
      if (event.type === TouchType.Down) {
        this.homeCollapsedModeRailPressed = true
        return
      }

      this.homeCollapsedModeRailPressed = false
    })
    .onClick(() => {
      this.requestExpandedModeRail()
    })
  }

  @Builder
  private SettingsRootLowerTitleBuilder() {
    Row() {
      Text(this.currentRootTitle())
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(ROOT_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  @Builder
  private HomeRootLowerTitleBuilder() {
    Row() {
      Text('今日推荐')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .layoutWeight(1)
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  private isHomeRootTab(): boolean {
    return this.activeRootTabId === 'home'
  }

  private shouldHideRootTitleBar(): boolean {
    return this.activeRootTabId === 'subscriptions'
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
    return 28
  }

  private currentRootScrollEffectTitleBarBlurRadius(): number {
    return 48
  }

  private currentRootOriginalTitleBarMaskExtraHeight(): number {
    return 0
  }

  private currentRootScrollEffectTitleBarMaskExtraHeight(): number {
    return 0
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
    Column() {
      Blank()
        .height(HOME_MODE_HEADER_SPACER_HEIGHT)
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

  private openEntry(entry: EntryCardModel): void {
    if (entry.viewLabel === '图片' && (entry.rawMediaUrls ?? []).length > 0) {
      const model = articleDetailModelFromCard(entry)
      void openArticleDetail(entry.id, JSON.stringify(model))
      return
    }
    void openArticleDetail(entry.id)
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
    this.homeModeRailExpandedOverride = false
    this.homeModeRailExpandedLockOffset = -1
    this.currentHomeModeScrollOffset = this.homeModeScrollOffsetFor(nextMode)
    this.updateHeaderBlurProgress(this.homeModeScrollOffsetFor(nextMode))
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
      mediaUrls: entry.rawMediaUrls ?? selectPictureCarouselMediaUrls(entry.mediaUrls ?? []),
      isRead: entry.isRead,
      isStarred: entry.isStarred,
      createdAt: entry.publishedAt,
      updatedAt: entry.publishedAt,
    }
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
    .onClick(() => this.openEntry(entry))
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
        onOpen: () => this.openEntry(entry),
      })
    } else {
      this.EntryCard(entry)
    }
  }

  @Builder
  private HomeModeRail(options: HomeModeRailOptions = {}) {
    if (options.collapsed ?? false) {
      if (this.mode === 'articles') {
        ContentModeRail({
          mode: 'articles',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      } else if (this.mode === 'social') {
        ContentModeRail({
          mode: 'social',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      } else if (this.mode === 'pictures') {
        ContentModeRail({
          mode: 'pictures',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      } else {
        ContentModeRail({
          mode: 'videos',
          theme: this.theme,
          interactionLocked: this.isModeTransitioning,
          enableEnterTransition: false,
          collapsed: true,
          collapseProgress: options.collapseProgress ?? 0,
          onExpandRequest: () => {
            this.requestExpandedModeRail()
          },
          onChange: (mode: SubscriptionMode) => {
            this.requestModeSwitch(mode)
          },
        })
      }
    } else {
      ContentModeRail({
        mode: this.mode,
        theme: this.theme,
        interactionLocked: this.isModeTransitioning,
        enableEnterTransition: false,
        collapsed: false,
        collapseProgress: options.collapseProgress ?? 0,
        onExpandRequest: () => {
          this.requestExpandedModeRail()
        },
        onChange: (mode: SubscriptionMode) => {
          this.requestModeSwitch(mode)
        },
      })
    }
  }

  private currentHomeModeScroller(): Scroller {
    return this.homeScrollerForMode(this.mode)
  }

  private requestExpandedModeRail(): void {
    this.homeModeRailExpandedLockOffset = this.readHomeModeScrollOffset(this.mode)
    this.homeModeRailExpandedOverride = true
    this.currentHomeModeScrollOffset = 0
    this.updateHeaderBlurProgress(0)
  }

  private homeModeRailCollapseProgress(): number {
    if (this.homeModeRailExpandedOverride) {
      return 0
    }

    const collapseStartBoundary = HOME_MODE_CONTENT_TOP_SPACER_HEIGHT + HOME_MODE_RAIL_COLLAPSE_OFFSET
    const traveledDistance = collapseStartBoundary - this.homeFirstCardTopBoundary()
    return Math.max(0, Math.min(traveledDistance / HOME_MODE_RAIL_COLLAPSE_OFFSET, 1))
  }

  private isHomeModeRailCollapsed(): boolean {
    return this.homeModeRailCollapseProgress() >= 1
  }

  private resolvedHomeCollapsedModeRailTopAvoidArea(): number {
    return HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA
  }

  private homeCollapsedModeRailTopPadding(): number {
    return this.resolvedHomeCollapsedModeRailTopAvoidArea()
      + HOME_COLLAPSED_MODE_RAIL_TOP_PADDING
      + HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT
      - ROOT_MODE_RAIL_TOP_GAP
      + HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET
  }

  private homeCollapsedModeRailWidth(): number {
    return HOME_COLLAPSED_MODE_RAIL_SIZE
  }

  private homeModeRailRightInset(): number {
    if (this.homeModeRailCollapseProgress() >= 1) {
      return PAGE_HORIZONTAL_PADDING + HOME_COLLAPSED_MODE_RAIL_SIZE + ROOT_MODE_RAIL_TOP_GAP
    }

    return PAGE_HORIZONTAL_PADDING
  }

  private homeModeRailLeftPadding(): number {
    return PAGE_HORIZONTAL_PADDING
  }

  private homeModeRailTopPadding(): number {
    const progress = this.homeModeRailCollapseProgress()
    return HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
      + (this.homeCollapsedModeRailTopPadding() - HOME_MODE_CONTENT_TOP_SPACER_HEIGHT) * progress
  }

  private homeFirstCardTopBoundary(): number {
    return Math.max(0, HOME_MODE_HEADER_SPACER_HEIGHT - this.currentHomeModeScrollOffset)
  }

  @Builder
  private HomeCollapsingModeRailLayer() {
    if (!this.isHomeModeRailCollapsed()) {
      Stack({ alignContent: Alignment.Top }) {
        Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
          Row()
            .width('100%')
            .height(0)

          Row() {
            this.HomeModeRail({
              collapsed: false,
              collapseProgress: this.homeModeRailCollapseProgress(),
            })
          }
            .width('100%')
            .justifyContent(FlexAlign.Start)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .align(Alignment.Top)
      }
      .width('100%')
      .padding({
        top: this.homeModeRailTopPadding(),
        left: this.homeModeRailLeftPadding(),
        right: this.homeModeRailRightInset(),
      })
      .zIndex(100)
    }
  }

  @Builder
  private HomeCollapsedModeRailLayer() {
    if (this.homeModeRailCollapseProgress() > 0) {
      Column() {
        this.HomeCollapsedModeRailButton()
      }
      .width('100%')
      .alignItems(HorizontalAlign.End)
      .padding({
        top: this.homeCollapsedModeRailTopPadding(),
        left: PAGE_HORIZONTAL_PADDING,
        right: this.homeModeRailRightInset(),
      })
      .opacity(this.homeModeRailCollapseProgress())
      .translate({ y: (1 - this.homeModeRailCollapseProgress()) * -6 })
      .animation({ duration: 180, curve: Curve.EaseOut })
      .enabled(this.isHomeModeRailCollapsed())
      .zIndex(120)
    }
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
    .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
      this.syncHomeModeRailState(mode)
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
            onOpen: () => this.openEntry(entry),
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
    .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
      this.syncHomeModeRailState('pictures')
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
                this.openEntry(entry)
              },
            })
          }
          .width('100%')
          .constraintSize({ minHeight: '100%' })
          .alignItems(HorizontalAlign.Start)
          .justifyContent(FlexAlign.Start)
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 100 })
        }
        .width('100%')
        .height('100%')
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
        .onDidScroll((_xOffset: number, _yOffset: number, _scrollState: ScrollState) => {
          this.syncHomeModeRailState(mode)
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
    .backgroundColor(this.theme.background)
    .gesture(
      PanGesture({ direction: PanDirection.Horizontal })
        .onActionEnd((event: GestureEvent) => {
          this.handleModeSwipe(event)
        })
    )
  }

  onPageShow(): void {
    this.syncRequestedRootTab()
    this.restoreSettingsSheetIfNeeded()
  }

  private restoreSettingsSheetIfNeeded(): void {
    const storedSheet = AppStorage.get<string>('settingsActiveSheetKey')
    if (!storedSheet) {
      return
    }
    // 通过短暂清空再恢复来触发 @Watch，让 SettingsContent 重新打开 sheet
    AppStorage.setOrCreate('settingsActiveSheetKey', '')
    AppStorage.setOrCreate('settingsActiveSheetKey', storedSheet)
  }

  private shouldHideBottomTabs(): boolean {
    return (
      (this.activeRootTabId === 'discover' && this.discoverHasForegroundOverlay)
      || (this.activeRootTabId === 'subscriptions' && this.subscriptionsOverlayLevel > 0)
      || (this.activeRootTabId === 'settings' && this.settingsOverlayLevel > 0)
    )
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
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

      if (this.isHomeRootTab()) {
        this.HomeCollapsingModeRailLayer()
      }

      if (this.isHomeRootTab()) {
        this.HomeCollapsedModeRailLayer()
      }

    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
