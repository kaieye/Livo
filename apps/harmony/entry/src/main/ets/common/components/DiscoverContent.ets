import { AppRepository } from '../data/AppRepository'
import { curves } from '@kit.ArkUI'
import { openArticleDetail } from '../navigation/AppRouter'
import { AvatarTile } from './AvatarTile'
import { BottomTabs } from './BottomTabs'
import { DiscoverBrowseDestination } from './DiscoverBrowseDestination'
import { categoryCardSymbol, discoverCategoryCards, resolveDirectUrlResult } from './DiscoverCatalog'
import { DiscoverPreviewDestination, DiscoverSubscribeConfigDestination } from './DiscoverDestinations'
import {
  DirectUrlResult,
  DiscoverBrowseRouteParams,
  DiscoverCategoryCard,
  DiscoverConfigReturnTarget,
  DiscoverFlowRouteParams,
  DiscoverOverlayRoute,
  createDiscoverFlowRouteParams,
  createDiscoverResultFromFeed,
} from './DiscoverTypes'
import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import {
  ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import { Entry, Feed, FeedViewType, toArticleDetailModel } from '../models/LivoModels'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import {
  discoverPlatformLabel,
  discoverViewLabel,
  DiscoverSearchPlatform,
  preferredViewForPlatform,
  RecommendedFeed,
  resolveKeywordCandidatesByPlatform,
  resolveProfileCandidatesByPlatform,
  ResolvedDiscoverCandidate,
  searchedRecommendedFeedsByPlatform,
  trendingDiscoverFeedsFromJsonNow,
} from '../services/DiscoverService'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import {
  resolveDiscoverOverlayReturnLevel,
} from '../utils/DiscoverNavigationPolicy'
import {
  candidateAvatarCacheKey,
  candidateAvatarFallbackUrls,
  isInstagramPlaceholderAvatar,
  platformColor,
  resolvedCandidateAvatarUrl,
  resolvedPlatformLabel,
  shouldHydrateCandidateAvatar,
} from '../utils/DiscoverCandidatePresentation'
import {
  isSubscribedCandidate,
  isSubscribedRecommendedFeed,
} from '../utils/DiscoverFeedIdentity'
import { resolveSocialFeedDisplayImageUrl } from '../utils/SocialFeedPresentation'
import {
  CARD_RADIUS_LG,
  CARD_RADIUS_XL,
  CHIP_FONT_SIZE,
  CHIP_RADIUS,
  LIST_ACTION_HEIGHT,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_META_SIZE,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
  PAGE_BOTTOM_GAP,
  PAGE_HORIZONTAL_PADDING,
  SECTION_TITLE_FONT_SIZE,
} from '../ui/UiTokens'

const HEADER_BLUR_SCROLL_RANGE: number = 72
const DISCOVER_TITLE_BAR_MINI_HEIGHT: number = 56
const DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const DISCOVER_TITLE_BAR_OVERLAY_SPACER: number =
  DISCOVER_TITLE_BAR_MINI_HEIGHT + DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
const DISCOVER_SEARCH_INPUT_ID: string = 'discover-search-input'

@Component
export struct DiscoverContent {
  @State query: string = ''
  @State searchPlatform: DiscoverSearchPlatform = 'all'
  @State showPlatformChips: boolean = false
  @State isInteractingWithPlatformChips: boolean = false
  @State keepPlatformChipsOnBlur: boolean = false
  @State isPlatformSwitchSearching: boolean = false
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State remoteResults: ResolvedDiscoverCandidate[] = []
  @State isSearchingRemote: boolean = false
  @State avatarOverrideVersion: number = 0
  @State hasLoaded: boolean = false
  @State isLoadingPage: boolean = false
  @State subscribedFeeds: Feed[] = []
  @State featuredTrendingFeeds: RecommendedFeed[] = trendingDiscoverFeedsFromJsonNow()
  @State overlayLevel: number = 0
  @State activeOverlayRoute: DiscoverOverlayRoute = 'none'
  @State activeBrowseParams?: DiscoverBrowseRouteParams = undefined
  @State activePreviewParams?: DiscoverFlowRouteParams = undefined
  @State activeSubscribeConfigParams?: DiscoverFlowRouteParams = undefined
  @State subscribeConfigReturnTarget: DiscoverConfigReturnTarget = 'root'
  @Prop showBottomTabs: boolean = true
  @Prop reserveBottomTabInset: boolean = false
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @StorageProp('discoverOverlayLevel') @Watch('handleDiscoverOverlayLevelChanged') discoverOverlayLevel: number = 0
  @StorageProp('discoverNavigationResetAt') @Watch('handleNavigationResetSignal') discoverNavigationResetAt: number = 0
  @StorageProp('discoverOverlayBackAt') @Watch('handleOverlayBackSignal') discoverOverlayBackAt: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @StorageProp('discoverSearchDismissAt') @Watch('handleSearchDismissSignal') discoverSearchDismissAt: number = 0
  onReady: () => void = () => {}
  private searchSession: number = 0
  private platformSwitchSession: number = 0
  private searchFocusGuardToken: number = 0
  @State private searchInputFocusable: boolean = false
  @State private searchInputHasFocus: boolean = false
  private searchInputUserFocusArmed: boolean = false
  private searchInputController: TextInputController = new TextInputController()
  private readonly contentScroller: Scroller = new Scroller()
  private headerBlurOffset: number = 0
  private readonly avatarOverrideMap: Map<string, string> = new Map<string, string>()
  private readonly avatarHydratingKeys: Set<string> = new Set<string>()

  private updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.headerBlurOffset = clampedOffset
  }

  private handleHeaderBlurScrollDelta(delta: number): void {
    this.updateHeaderBlurProgress(this.headerBlurOffset + delta)
  }

  private rootEnterTransition(delay: number) {
    return this.showBottomTabs ? livoMotion.enterScale(delay) : undefined
  }

  private overlayEnterTransition() {
    return livoMotion.enterSoft()
  }

  private syncRootOverlayLevel(level: number): void {
    this.overlayLevel = level
    this.activeOverlayRoute = level <= 0 ? 'none' : this.activeOverlayRoute
    AppStorage.setOrCreate('discoverOverlayLevel', level)
  }

  private syncOverlayRoute(route: DiscoverOverlayRoute, level: number): void {
    this.activeOverlayRoute = route
    this.overlayLevel = level
    AppStorage.setOrCreate('discoverOverlayLevel', level)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', level > 0)
  }

  private closeSubscribeConfigToTarget(): void {
    this.activeSubscribeConfigParams = undefined
    if (this.subscribeConfigReturnTarget === 'preview' && this.activePreviewParams) {
      this.syncOverlayRoute('preview', 2)
      return
    }
    if (this.subscribeConfigReturnTarget === 'browse' && this.activeBrowseParams) {
      this.syncOverlayRoute('browse', 1)
      return
    }
    this.activePreviewParams = undefined
    this.activeBrowseParams = undefined
    this.syncOverlayRoute('none', 0)
  }

  @Builder
  private DiscoverLowerTitleBuilder() {
    Row() {
      Text('发现')
        .fontSize(ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  aboutToAppear(): void {
    this.preventAutoKeyboardPopup('discover-about-to-appear')

    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }

    if (this.hasLoaded || this.isLoadingPage) {
      this.onReady()
      return
    }

    void this.loadData()
  }

  private async loadData(): Promise<void> {
    if (this.isLoadingPage) {
      return
    }

    this.isLoadingPage = true
    try {
      if (this.showBottomTabs) {
        const settings = await AppRepository.settings()
        this.theme = await ThemeService.resolvePalette(settings)
      } else {
        this.theme = this.inheritedTheme
      }
      this.subscribedFeeds = await AppRepository.feedEntities()
      this.featuredTrendingFeeds = trendingDiscoverFeedsFromJsonNow()

      this.hasLoaded = true
      this.onReady()
      void this.hydrateAvatarsForCandidates(this.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed)))
    } finally {
      this.isLoadingPage = false
    }
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
  }

  private handleDiscoverOverlayLevelChanged(): void {
    if (this.discoverOverlayLevel < this.overlayLevel) {
      this.overlayLevel = this.discoverOverlayLevel
    }
  }

  private viewLabel(view: FeedViewType): string {
    return discoverViewLabel(view)
  }

  private shouldShowPlatformChips(): boolean {
    return this.showPlatformChips || !this.query.trim()
  }

  private handleNavigationResetSignal(): void {
    this.dismissSearchFocus('navigation-reset')
    this.remoteResults = []
    this.isSearchingRemote = false
    this.isPlatformSwitchSearching = false
    this.activeBrowseParams = undefined
    this.activePreviewParams = undefined
    this.activeSubscribeConfigParams = undefined
    this.syncOverlayRoute('none', 0)
  }

  private handleOverlayBackSignal(): void {
    this.consumeOverlayBack()
  }

  private consumeOverlayBack(): boolean {
    if (this.activeSubscribeConfigParams) {
      this.closeSubscribeConfigToTarget()
      return true
    }

    if (this.activePreviewParams) {
      this.activePreviewParams = undefined
      if (this.activeBrowseParams) {
        this.syncOverlayRoute('browse', 1)
      } else {
        this.syncOverlayRoute('none', 0)
      }
      return true
    }

    if (this.activeBrowseParams) {
      this.activeBrowseParams = undefined
      this.activePreviewParams = undefined
      this.activeSubscribeConfigParams = undefined
      this.syncOverlayRoute('none', 0)
      return true
    }

    if (this.overlayLevel > 0) {
      this.syncOverlayRoute('none', 0)
      return true
    }

    return false
  }

  private discoverFeaturedFeeds(): RecommendedFeed[] {
    return this.featuredTrendingFeeds
      .slice(0, 7)
  }

  private openBrowsePage(view: FeedViewType, title: string, sourceKey: string = ''): void {
    this.scheduleOverlayNavigation(() => {
      const params = new DiscoverBrowseRouteParams()
      params.view = view
      params.title = title
      params.sourceKey = sourceKey
      params.restoreOverlayLevel = 0
      this.activeBrowseParams = params
      this.activePreviewParams = undefined
      this.activeSubscribeConfigParams = undefined
      this.subscribeConfigReturnTarget = 'root'
      this.syncOverlayRoute('browse', 1)
    })
  }

  private directUrlResult(): DirectUrlResult | undefined {
    return resolveDirectUrlResult(this.query)
  }

  private resolvedCandidates(): ResolvedDiscoverCandidate[] {
    return resolveProfileCandidatesByPlatform(this.query.trim(), this.searchPlatform)
  }

  private keywordCandidates(): ResolvedDiscoverCandidate[] {
    return resolveKeywordCandidatesByPlatform(this.query, this.searchPlatform)
  }

  private localRecommendedResults(): RecommendedFeed[] {
    if (!this.query.trim()) {
      return []
    }

    return searchedRecommendedFeedsByPlatform(this.query, this.searchPlatform)
      .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
      .slice(0, 10)
  }

  private logDiscoverFocusDebug(event: string, detail: string = ''): void {
    const suffix = detail ? ` ${detail}` : ''
    console.info(
      `[DiscoverFocusDebug] ${event}${suffix} overlay=${this.overlayLevel} chips=${this.showPlatformChips} queryLength=${this.query.length} token=${this.searchFocusGuardToken}`,
    )
  }

  private armSearchInputFocus(source: string): void {
    if (this.searchInputHasFocus) {
      return
    }
    this.searchInputUserFocusArmed = true
    this.searchInputFocusable = true
    this.logDiscoverFocusDebug('arm-search-input-focus', `source=${source}`)
    this.requestDiscoverSearchInputFocus(`arm-${source}`)
  }

  private disarmSearchInputFocus(reason: string): void {
    if (!this.searchInputUserFocusArmed && !this.searchInputFocusable) {
      return
    }
    this.searchInputUserFocusArmed = false
    this.searchInputFocusable = false
    this.logDiscoverFocusDebug('disarm-search-input-focus', `reason=${reason}`)
  }

  private requestDiscoverSearchInputFocus(source: string): void {
    const guardToken = this.searchFocusGuardToken
    setTimeout(() => {
      if (this.searchFocusGuardToken !== guardToken) {
        this.logDiscoverFocusDebug('skip-search-input-focus-request', `source=${source} reason=guard-changed`)
        return
      }

      if (!this.searchInputUserFocusArmed || !this.searchInputFocusable) {
        this.logDiscoverFocusDebug('skip-search-input-focus-request', `source=${source} reason=not-armed`)
        return
      }

      focusControl.requestFocus(DISCOVER_SEARCH_INPUT_ID)
      if (!this.searchInputHasFocus) {
        this.searchInputController.caretPosition(this.query.length)
      }
      this.logDiscoverFocusDebug('apply-search-input-focus-request', `source=${source}`)
    }, 16)
  }

  private handleSearchDismissSignal(): void {
    this.preventAutoKeyboardPopup('dismiss-signal')
  }

  private preventAutoKeyboardPopup(source: string = 'unknown'): void {
    this.searchFocusGuardToken += 1
    const guardToken = this.searchFocusGuardToken
    this.logDiscoverFocusDebug('prevent-auto-keyboard-popup', `source=${source} guardToken=${guardToken}`)
    this.dismissSearchFocus('guard-initial')
    setTimeout(() => {
      if (this.searchFocusGuardToken === guardToken) {
        this.logDiscoverFocusDebug('guard-dismiss', `delayMs=80 guardToken=${guardToken}`)
        this.dismissSearchFocus('guard-80ms')
      }
    }, 80)
    setTimeout(() => {
      if (this.searchFocusGuardToken === guardToken) {
        this.logDiscoverFocusDebug('guard-dismiss', `delayMs=220 guardToken=${guardToken}`)
        this.dismissSearchFocus('guard-220ms')
      }
    }, 220)
    setTimeout(() => {
      if (this.searchFocusGuardToken === guardToken) {
        this.logDiscoverFocusDebug('guard-dismiss', `delayMs=420 guardToken=${guardToken}`)
        this.dismissSearchFocus('guard-420ms')
      }
    }, 420)
  }

  private dismissSearchFocus(reason: string = 'unknown'): void {
    this.logDiscoverFocusDebug('dismiss-search-focus', `reason=${reason}`)
    this.disarmSearchInputFocus(`dismiss-${reason}`)
    this.searchInputController.stopEditing()
    this.searchInputHasFocus = false
    this.showPlatformChips = false
    this.keepPlatformChipsOnBlur = false
  }

  private scheduleOverlayNavigation(action: () => void): void {
    this.dismissSearchFocus('overlay-navigation')
    action()
    AppStorage.setOrCreate('discoverHasForegroundOverlay', this.overlayLevel > 0)
  }

  private settleDiscoverRootVisible(): void {
    AppStorage.setOrCreate('discoverRootVisibleSince', Date.now())
    if (this.activeOverlayRoute === 'none') {
      this.syncOverlayRoute('none', 0)
    }
  }

  private handleFeedsChanged(): void {
    void this.refreshSubscribedFeeds()
  }

  private async refreshSubscribedFeeds(): Promise<void> {
    this.subscribedFeeds = await AppRepository.feedEntities()
  }

  private searchResults(): ResolvedDiscoverCandidate[] {
    if (this.remoteResults.length > 0) {
      return this.remoteResults
    }

    return this.localRecommendedResults().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed))
  }

  private isSubscribedRecommendedFeed(feed: RecommendedFeed): boolean {
    return isSubscribedRecommendedFeed(this.subscribedFeeds, feed)
  }

  private isSubscribedCandidate(candidate: ResolvedDiscoverCandidate): boolean {
    return isSubscribedCandidate(this.subscribedFeeds, candidate)
  }

  private candidateActionLabel(candidate: ResolvedDiscoverCandidate): string {
    return this.isSubscribedCandidate(candidate) ? '已订阅' : '订阅'
  }

  private candidateActionBackground(candidate: ResolvedDiscoverCandidate): string {
    return this.isSubscribedCandidate(candidate) ? this.theme.elevated : this.theme.accent
  }

  private candidateActionFontColor(candidate: ResolvedDiscoverCandidate): string {
    return this.isSubscribedCandidate(candidate) ? this.theme.textPrimary : '#FFFFFF'
  }

  private candidateMetaText(candidate: ResolvedDiscoverCandidate): string {
    return (candidate.followers || candidate.description).trim()
  }

  private hasCandidateMetaText(candidate: ResolvedDiscoverCandidate): boolean {
    return !!this.candidateMetaText(candidate)
  }

  private hasSearchResults(): boolean {
    return this.searchResults().length > 0
  }

  private hasAnyResult(): boolean {
    return !!this.directUrlResult()
      || this.resolvedCandidates().length > 0
      || this.keywordCandidates().length > 0
      || this.hasSearchResults()
  }

  private async refreshRemoteResults(): Promise<void> {
    const trimmed = this.query.trim()
    this.searchSession += 1
    const session = this.searchSession

    if (!trimmed) {
      this.remoteResults = []
      this.isSearchingRemote = false
      void this.hydrateAvatarsForCandidates(this.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed)))
      return
    }

    if (this.directUrlResult()) {
      this.remoteResults = []
      this.isSearchingRemote = false
      return
    }

    this.isSearchingRemote = true
    try {
      const results = await DiscoverRemoteSearchService.search(trimmed, this.searchPlatform)
      if (this.searchSession !== session) {
        return
      }
      this.remoteResults = results
      void this.hydrateAvatarsForCandidates(results)
    } catch (_) {
      if (this.searchSession !== session) {
        return
      }
      this.remoteResults = []
    } finally {
      if (this.searchSession === session) {
        this.isSearchingRemote = false
      }
    }
  }

  private async handlePlatformSwitch(platform: DiscoverSearchPlatform): Promise<void> {
    if (this.searchPlatform === platform) {
      return
    }

    this.searchPlatform = platform
    this.remoteResults = []

    if (!this.query.trim()) {
      void this.hydrateAvatarsForCandidates(this.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed)))
      return
    }

    this.platformSwitchSession += 1
    const session = this.platformSwitchSession
    this.isPlatformSwitchSearching = true

    await Promise.all([
      this.refreshRemoteResults(),
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 220)
      }),
    ])

    if (this.platformSwitchSession === session) {
      this.isPlatformSwitchSearching = false
    }
  }

  private openPreviewPage(
    targetUrl: string,
    targetTitle: string,
    targetView: FeedViewType,
    siteUrl: string,
    imageUrl: string,
    description: string,
    sourceKind: string,
    category: string,
    restoreOverlayLevel: number = 0,
  ): void {
    this.scheduleOverlayNavigation(() => {
      this.activePreviewParams = createDiscoverFlowRouteParams(
        targetUrl,
        targetTitle,
        targetView,
        siteUrl,
        imageUrl,
        description,
        sourceKind,
        category,
        restoreOverlayLevel,
      )
      this.activeSubscribeConfigParams = undefined
      this.subscribeConfigReturnTarget = restoreOverlayLevel > 0 ? 'browse' : 'root'
      this.syncOverlayRoute('preview', restoreOverlayLevel > 0 ? 2 : 1)
    })
  }

  private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate, restoreOverlayLevel: number = 0): void {
    this.scheduleOverlayNavigation(() => {
      this.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
        candidate.targetUrl,
        candidate.targetTitle,
        candidate.targetView,
        candidate.siteUrl,
        this.resolvedCandidateAvatarUrl(candidate),
        candidate.description,
        candidate.sourceKind,
        this.resolvedPlatformLabel(candidate),
        restoreOverlayLevel,
      )
      this.subscribeConfigReturnTarget = restoreOverlayLevel > 0 ? 'browse' : (this.activePreviewParams ? 'preview' : 'root')
      this.syncOverlayRoute('subscribe-config', restoreOverlayLevel > 0 ? 2 : 1)
    })
  }

  private openDirectUrlResult(result: DirectUrlResult): void {
    this.openPreviewPage(
      result.targetUrl,
      result.title,
      preferredViewForPlatform(this.searchPlatform),
      result.siteUrl,
      '',
      result.description,
      '地址',
      discoverPlatformLabel(this.searchPlatform),
      resolveDiscoverOverlayReturnLevel('root'),
    )
  }

  private openCandidate(candidate: ResolvedDiscoverCandidate): void {
    this.openPreviewPage(
      candidate.targetUrl,
      candidate.targetTitle,
      candidate.targetView,
      candidate.siteUrl,
      this.resolvedCandidateAvatarUrl(candidate),
      candidate.description,
      candidate.sourceKind,
      this.resolvedPlatformLabel(candidate),
      resolveDiscoverOverlayReturnLevel('root'),
    )
  }

  private platformOptions(): DiscoverSearchPlatform[] {
    return ['all', 'youtube', 'bilibili', 'x', 'instagram']
  }

  private platformColor(label: string): string {
    return platformColor(label, this.theme.accent)
  }

  private resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string {
    return resolvedPlatformLabel(candidate, (view: FeedViewType) => this.viewLabel(view))
  }

  private resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string {
    const override = this.avatarOverrideMap.get(this.candidateAvatarCacheKey(candidate)) || ''
    return resolvedCandidateAvatarUrl(candidate, override, (view: FeedViewType) => this.viewLabel(view))
  }

  private candidateAvatarFallbackUrls(
    imageUrl: string,
    targetUrl: string,
    siteUrl: string,
    title: string,
  ): string[] {
    return candidateAvatarFallbackUrls(imageUrl, targetUrl, siteUrl, title)
  }

  private candidateAvatarCacheKey(candidate: ResolvedDiscoverCandidate): string {
    return candidateAvatarCacheKey(candidate)
  }

  private shouldHydrateCandidateAvatar(candidate: ResolvedDiscoverCandidate): boolean {
    return shouldHydrateCandidateAvatar(
      candidate,
      this.resolvedCandidateAvatarUrl(candidate),
      (view: FeedViewType) => this.viewLabel(view),
    )
  }

  private async hydrateAvatarsForCandidates(candidates: ResolvedDiscoverCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      const key = this.candidateAvatarCacheKey(candidate)
      if (this.avatarOverrideMap.has(key) || this.avatarHydratingKeys.has(key)) {
        continue
      }
      if (!this.shouldHydrateCandidateAvatar(candidate)) {
        continue
      }

      this.avatarHydratingKeys.add(key)
      try {
        const resolved = await SocialFeedAvatarService.resolveFeedAvatar(
          candidate.targetUrl,
          candidate.siteUrl,
          candidate.imageUrl ?? '',
          '',
        )
        const trimmedResolved = (resolved || '').trim()
        if (!trimmedResolved) {
          continue
        }

        const platform = this.resolvedPlatformLabel(candidate)
        const finalResolved = trimmedResolved
        if (platform === 'Instagram' && isInstagramPlaceholderAvatar(finalResolved)) {
          continue
        }

        const current = this.resolvedCandidateAvatarUrl(candidate).trim()
        if (!current || current !== finalResolved) {
          this.avatarOverrideMap.set(key, finalResolved)
          this.avatarOverrideVersion += 1
        }
      } catch (_) {
        // Keep original avatar URL when hydration fails.
      } finally {
        this.avatarHydratingKeys.delete(key)
      }
    }
  }

  @Builder
  private PlatformChip(platform: DiscoverSearchPlatform) {
    Text(discoverPlatformLabel(platform))
      .fontSize(CHIP_FONT_SIZE)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.searchPlatform === platform ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 13, right: 13, top: 8, bottom: 8 })
      .backgroundColor(this.searchPlatform === platform ? this.theme.accent : this.theme.surface)
      .border({ width: 0.8, color: this.searchPlatform === platform ? this.theme.accent : this.theme.divider })
      .borderRadius(CHIP_RADIUS)
      .shadow(this.searchPlatform === platform ? {
        radius: 8,
        color: this.theme.isDark ? 'rgba(219,39,119,0.24)' : 'rgba(219,39,119,0.18)',
        offsetY: 1,
      } : undefined)
      .animation({ duration: 180, curve: Curve.EaseInOut })
      .onTouch((event: TouchEvent) => {
        if (event.type === TouchType.Down) {
          this.isInteractingWithPlatformChips = true
          return
        }
        this.isInteractingWithPlatformChips = false
      })
      .onClick(() => {
        void this.handlePlatformSwitch(platform)
      })
  }

  @Builder
  private SearchPanel() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        SymbolGlyph($r('sys.symbol.magnifyingglass'))
          .fontSize(20)
          .fontColor([this.theme.textMuted])

        TextInput({ text: this.query, placeholder: '搜索订阅源 / RSS / 关键词或链接', controller: this.searchInputController })
          .defaultFocus(false)
          .id(DISCOVER_SEARCH_INPUT_ID)
          .focusable(this.searchInputFocusable)
          .backgroundColor('transparent')
          .fontColor(this.theme.textPrimary)
          .placeholderColor(this.theme.textMuted)
          .caretColor(this.theme.textPrimary)
          .padding(0)
          .layoutWeight(1)
          .onTouch((event: TouchEvent) => {
            if (event.type === TouchType.Down) {
              if (this.searchInputHasFocus) {
                return
              }
              this.armSearchInputFocus('input-touch-down')
            }
          })
          .onClick(() => {
            this.logDiscoverFocusDebug('search-input-click')
            if (!this.searchInputHasFocus) {
              this.armSearchInputFocus('input-click')
            }
            this.showPlatformChips = true
          })
          .onFocus(() => {
            this.searchInputHasFocus = true
            this.logDiscoverFocusDebug(
              'search-input-focus',
              `armed=${this.searchInputUserFocusArmed ? 'true' : 'false'} focusable=${this.searchInputFocusable ? 'true' : 'false'}`,
            )
            this.showPlatformChips = true
          })
          .onBlur(() => {
            this.searchInputHasFocus = false
            this.logDiscoverFocusDebug('search-input-blur', `keepChips=${this.keepPlatformChipsOnBlur ? 'true' : 'false'}`)
            this.disarmSearchInputFocus('input-blur')
            if (this.keepPlatformChipsOnBlur) {
              this.keepPlatformChipsOnBlur = false
              return
            }
            setTimeout(() => {
              if (!this.isInteractingWithPlatformChips) {
                this.showPlatformChips = false
                this.logDiscoverFocusDebug('hide-platform-chips-on-blur')
              }
            }, 80)
          })
          .onChange((value: string) => {
            this.query = value
            void this.refreshRemoteResults()
          })

        if (this.query.trim()) {
          Text('×')
            .fontSize(19)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textMuted)
            .width(30)
            .height(30)
            .textAlign(TextAlign.Center)
            .borderRadius(CHIP_RADIUS)
            .backgroundColor(this.theme.elevated)
            .onClick(() => {
              this.query = ''
              this.remoteResults = []
              this.isSearchingRemote = false
            })
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 13, bottom: 13 })
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_XL)
      .border({ width: 0.8, color: this.theme.divider })
      .shadow({
        radius: 14,
        color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.08)',
        offsetY: 3,
      })

      Column() {
        Row({ space: 10 }) {
          ForEach(this.platformOptions(), (platform: DiscoverSearchPlatform) => {
            this.PlatformChip(platform)
          }, (platform: DiscoverSearchPlatform) => platform)
        }
        .width('100%')
      }
      .width('100%')
      .height(this.shouldShowPlatformChips() ? 36 : 0)
      .opacity(this.shouldShowPlatformChips() ? 1 : 0)
      .translate({ y: this.shouldShowPlatformChips() ? 0 : -10 })
      .padding({ top: this.shouldShowPlatformChips() ? 6 : 0 })
      .clip(true)
      .animation({ duration: 260, curve: Curve.FastOutSlowIn })
    }
    .width('100%')
    .margin({ bottom: 4 })
    .transition(this.rootEnterTransition(40))
  }

  @Builder
  private SectionHeader(title: string, trailingText: string = '', showMoreButton: boolean = false, leadingIcon?: Resource) {
    Row() {
      if (leadingIcon) {
        Image(leadingIcon)
          .width(20)
          .height(20)
          .objectFit(ImageFit.Contain)
          .margin({ right: 6 })
      }

      Text(title)
        .fontSize(SECTION_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Blank()
        .layoutWeight(1)

      if (trailingText) {
        Text(trailingText)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
      }

      if (showMoreButton) {
        Text('更多')
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
          .padding({ left: 8, right: 4, top: 2, bottom: 2 })
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => {})
      }
    }
    .width('100%')
    .transition(this.showBottomTabs ? livoMotion.enterFromRight(20) : TransitionEffect.IDENTITY)
  }

  @Builder
  private AvatarBox(
    imageUrl: string,
    fallbackLabel: string,
    accent: string,
    compact: boolean = false,
    fallbackImageUrls: string[] = [],
  ) {
    AvatarTile({
      imageUrl,
      fallbackImageUrls,
      refreshToken: this.feedsChangedAt + this.overlayLevel,
      fallbackLabel,
      accent,
      theme: this.theme,
      avatarSize: compact ? 30 : 38,
      radius: compact ? 8 : 10,
      textSize: compact ? 12 : 14,
      useAccentFallback: true,
    })
  }

  @Builder
  private ResultMeta(primary: string, secondary: string, tertiary: string) {
    Row({ space: 6 }) {
      Text(primary)
        .fontSize(9)
        .fontColor('#FFFFFF')
        .padding({ left: 8, right: 8, top: 4, bottom: 4 })
        .backgroundColor(this.platformColor(primary))
        .borderRadius(999)

      Text(secondary)
        .fontSize(10)
        .fontColor(this.theme.textMuted)

      if (tertiary) {
        Text(tertiary)
          .fontSize(10)
          .fontColor(this.theme.textMuted)
      }
    }
    .width('100%')
  }

  @Builder
  private DirectUrlRow(result: DirectUrlResult | undefined) {
    if (result) {
      Row({ space: 12 }) {
        this.AvatarBox(
          '',
          result.title,
          this.theme.accent,
          false,
          this.candidateAvatarFallbackUrls('', result.targetUrl, result.siteUrl, result.title),
        )

        Column({ space: 4 }) {
          Text(result.title)
            .fontSize(LIST_ROW_TITLE_SIZE)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          this.ResultMeta('地址', discoverPlatformLabel(this.searchPlatform), '')

          Text(result.targetUrl)
            .fontSize(LIST_ROW_META_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING })
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_LG)
      .border({ width: 0.8, color: this.theme.divider })
      .shadow({
        radius: 8,
        color: this.theme.isDark ? 'rgba(0,0,0,0.14)' : 'rgba(15,23,42,0.05)',
        offsetY: 2,
      })
      .onClick(() => {
        this.openDirectUrlResult(result)
      })
    }
  }

  @Builder
  private CandidateRow(
    candidate: ResolvedDiscoverCandidate,
    showDivider: boolean,
    compact: boolean = false,
    showActionButton: boolean = true,
  ) {
    Column() {
      Row({ space: compact ? 10 : 12 }) {
        Row({ space: compact ? 10 : 12 }) {
          this.AvatarBox(
            this.resolvedCandidateAvatarUrl(candidate),
            candidate.targetTitle,
            this.platformColor(this.resolvedPlatformLabel(candidate)),
            compact,
            this.candidateAvatarFallbackUrls(
              this.resolvedCandidateAvatarUrl(candidate),
              candidate.targetUrl,
              candidate.siteUrl,
              candidate.targetTitle,
            ),
          )

          Column({ space: compact ? 2 : 6 }) {
            Text(candidate.targetTitle)
              .fontSize(LIST_ROW_TITLE_SIZE)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            if (this.hasCandidateMetaText(candidate)) {
              Text(this.candidateMetaText(candidate))
                .fontSize(LIST_ROW_META_SIZE)
                .fontColor(this.theme.textSecondary)
                .maxLines(compact ? 1 : 2)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .onClick(() => {
          this.openCandidate(candidate)
        })

        if (showActionButton) {
          Button(this.candidateActionLabel(candidate))
            .type(ButtonType.Capsule)
            .fontSize(LIST_ROW_META_SIZE)
          .fontWeight(FontWeight.Medium)
          .height(LIST_ACTION_HEIGHT)
          .backgroundColor(this.candidateActionBackground(candidate))
          .fontColor(this.candidateActionFontColor(candidate))
            .onClick(() => {
              this.openSubscribeConfigPage(candidate, resolveDiscoverOverlayReturnLevel('root'))
            })
        }
      }
      .width('100%')
      .padding({
        left: LIST_ROW_HORIZONTAL_PADDING,
        right: LIST_ROW_HORIZONTAL_PADDING,
        top: compact ? 8 : LIST_ROW_VERTICAL_PADDING,
        bottom: compact ? 8 : LIST_ROW_VERTICAL_PADDING,
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET })
      }
    }
    .width('100%')
  }

  @Builder
  private CandidateSection(
    title: string,
    items: ResolvedDiscoverCandidate[],
    compact: boolean = false,
    separateCards: boolean = false,
    showActionButton: boolean = true,
    showMoreButton: boolean = false,
    leadingIcon?: Resource,
  ) {
    if (items.length > 0) {
      Column({ space: 12 }) {
        this.SectionHeader(title, '', showMoreButton, leadingIcon)

        if (separateCards) {
          Column({ space: 6 }) {
            ForEach(items, (candidate: ResolvedDiscoverCandidate) => {
              Column() {
                this.CandidateRow(candidate, false, compact, showActionButton)
              }
              .width('100%')
              .backgroundColor(this.theme.surface)
              .borderRadius(14)
              .border({ width: 0.8, color: this.theme.divider })
              .clip(true)
            }, (candidate: ResolvedDiscoverCandidate) => `${title}-${candidate.targetUrl}`)
          }
          .width('100%')
        } else {
          Column() {
            ForEach(items, (candidate: ResolvedDiscoverCandidate, index: number) => {
              this.CandidateRow(candidate, index < items.length - 1, compact, showActionButton)
            }, (candidate: ResolvedDiscoverCandidate) => `${title}-${candidate.targetUrl}`)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_XL)
          .border({ width: 0.8, color: this.theme.divider })
          .clip(true)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private SearchResultSection() {
    if (this.hasSearchResults() || this.isSearchingRemote || this.isPlatformSwitchSearching) {
      Column({ space: 12 }) {
        this.SectionHeader('搜索结果', `${this.searchResults().length}`)

        if ((this.isSearchingRemote || this.isPlatformSwitchSearching) && this.searchResults().length === 0) {
          Row({ space: 10 }) {
            LoadingProgress()
              .width(20)
              .height(20)
              .color(this.theme.accent)

            Text('搜索中...')
              .fontSize(LIST_ROW_META_SIZE)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 16, bottom: 16 })
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
        } else {
          Column() {
            ForEach(this.searchResults(), (candidate: ResolvedDiscoverCandidate, index: number) => {
              this.CandidateRow(candidate, index < this.searchResults().length - 1)
            }, (candidate: ResolvedDiscoverCandidate) => `search-${candidate.targetUrl}`)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_XL)
          .border({ width: 0.8, color: this.theme.divider })
          .clip(true)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private CategoryBrowserSection() {
    if (discoverCategoryCards().length > 0) {
      Column({ space: 12 }) {
        this.SectionHeader('分类精选', '', false, $r('app.media.MingcuteClassify2Line'))

        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start }) {
          ForEach(discoverCategoryCards(), (card: DiscoverCategoryCard) => {
            Row({ space: 8 }) {
              if (card.icon) {
                Image(card.icon)
                  .width(18)
                  .height(18)
                  .objectFit(ImageFit.Contain)
              } else {
                SymbolGlyph(categoryCardSymbol(card.view))
                  .fontSize(19)
                  .fontColor([card.accent])
              }

              Text(card.label)
                .fontSize(13)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
            .width('24%')
            .height(46)
            .padding({ left: 10, right: 10, top: 8, bottom: 8 })
            .justifyContent(FlexAlign.Start)
            .alignItems(VerticalAlign.Center)
            .borderRadius(16)
            .backgroundColor(this.theme.surface)
            .border({ width: 0.8, color: this.theme.divider })
            .shadow({
              radius: 6,
              color: this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.04)',
              offsetY: 2,
            })
            .clickEffect({ level: ClickEffectLevel.MIDDLE })
            .onClick(() => {
              this.openBrowsePage(card.view, card.label, card.sourceKey || '')
            })
            .margin({ bottom: 6 })
          }, (card: DiscoverCategoryCard) => card.id)
        }
        .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private NoResultState() {
    Column({ space: 8 }) {
      Text('没有匹配结果')
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Text('换一个关键字，或者输入更完整的链接。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme.textSecondary)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 24 })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_XL)
    .border({ width: 0.8, color: this.theme.divider })
  }

  private isSearchModeActive(): boolean {
    return !!this.query.trim() || this.isSearchingRemote || this.isPlatformSwitchSearching
  }

  @Builder
  private DiscoverScrollContent() {
    Column({ space: 8 }) {
      Blank()
        .height(DISCOVER_TITLE_BAR_OVERLAY_SPACER)

      this.SearchPanel()

      if (this.isSearchModeActive()) {
        this.SearchResultSection()

        if (this.query.trim() && !this.hasAnyResult() && !this.isSearchingRemote && !this.isPlatformSwitchSearching) {
          this.NoResultState()
        }
      } else {
        this.CandidateSection(
          '热门推荐',
          this.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed)),
          true,
          true,
          false,
          true,
          $r('app.media.Flame'),
        )
        this.CategoryBrowserSection()
      }

      Row()
        .height(this.isSearchModeActive() ? 24 : this.discoverBottomSpacerHeight())
        .width('100%')
    }
    .width('100%')
    .constraintSize({ minHeight: '100%' })
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Start)
    .transition(this.rootEnterTransition(30))
  }

  private shouldReserveBottomDock(): boolean {
    if (this.overlayLevel > 0) {
      return false
    }

    if (this.showBottomTabs) {
      return true
    }

    return this.reserveBottomTabInset
  }

  private discoverListBottomPadding(): number {
    if (this.shouldReserveBottomDock()) {
      return 24
    }

    return PAGE_BOTTOM_GAP
  }

  private discoverBottomSpacerHeight(): number {
    if (this.shouldReserveBottomDock()) {
      return 108 + this.bottomAvoidArea
    }

    return 24
  }

  @Builder
  private DiscoverBrowseOverlay() {
    if (this.activeBrowseParams) {
      Stack() {
        DiscoverBrowseDestination({
          view: this.activeBrowseParams.view,
          title: this.activeBrowseParams.title,
          sourceKey: this.activeBrowseParams.sourceKey,
          restoreOverlayLevel: this.activeBrowseParams.restoreOverlayLevel,
          theme: this.theme,
          onBack: () => {
            this.activeBrowseParams = undefined
            this.activePreviewParams = undefined
            this.activeSubscribeConfigParams = undefined
            this.syncOverlayRoute('none', 0)
          },
          onOpenPreview: (feed: RecommendedFeed) => {
            const result = createDiscoverResultFromFeed(feed)
            this.activePreviewParams = createDiscoverFlowRouteParams(
              result.targetUrl,
              result.targetTitle,
              result.targetView,
              result.siteUrl,
              result.imageUrl || '',
              result.description,
              result.sourceKind,
              feed.category || '',
              1,
            )
            this.syncOverlayRoute('preview', 2)
          },
          onOpenSubscribeConfig: (feed: RecommendedFeed) => {
            const result = createDiscoverResultFromFeed(feed)
            this.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
              result.targetUrl,
              result.targetTitle,
              result.targetView,
              result.siteUrl,
              result.imageUrl || '',
              result.description,
              result.sourceKind,
              feed.category || '',
              1,
            )
            this.subscribeConfigReturnTarget = 'browse'
            this.syncOverlayRoute('subscribe-config', 2)
          },
        })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .transition(this.overlayEnterTransition())
      .zIndex(this.activeOverlayRoute === 'browse' ? 2 : 1)
    }
  }

  @Builder
  private DiscoverPreviewOverlay() {
    if (this.activePreviewParams) {
      Stack() {
        DiscoverPreviewDestination({
          targetUrl: this.activePreviewParams.targetUrl,
          initialTargetTitle: this.activePreviewParams.targetTitle,
          initialTargetSiteUrl: this.activePreviewParams.siteUrl,
          initialTargetImageUrl: this.activePreviewParams.imageUrl,
          initialTargetDescription: this.activePreviewParams.description,
          targetCategory: this.activePreviewParams.category,
          targetView: this.activePreviewParams.targetView,
          restoreOverlayLevel: this.activePreviewParams.restoreOverlayLevel,
          theme: this.theme,
          onBack: () => {
            this.activePreviewParams = undefined
            if (this.activeBrowseParams) {
              this.syncOverlayRoute('browse', 1)
              return
            }
            this.syncOverlayRoute('none', 0)
          },
          onEdit: (feed: Feed) => {
            const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
              feed.imageUrl || this.activePreviewParams?.imageUrl || '',
              feed.url || this.activePreviewParams?.targetUrl || '',
              feed.siteUrl || this.activePreviewParams?.siteUrl || '',
              feed.title || this.activePreviewParams?.targetTitle || '',
            )
            this.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
              this.activePreviewParams?.targetUrl || '',
              feed.title,
              feed.view,
              feed.siteUrl || this.activePreviewParams?.siteUrl || '',
              resolvedImageUrl,
              feed.description || this.activePreviewParams?.description || '',
              '编辑',
              feed.category || '',
              1,
            )
            this.subscribeConfigReturnTarget = 'preview'
            this.syncOverlayRoute('subscribe-config', 2)
          },
          onSubscribe: (payload: FeedRefreshPayload) => {
            DiscoverRemoteSearchService.rememberPreviewPayload(this.activePreviewParams?.targetUrl || '', payload)
            const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
              payload.imageUrl || this.activePreviewParams?.imageUrl || '',
              payload.resolvedFeedUrl || this.activePreviewParams?.targetUrl || '',
              payload.siteUrl || this.activePreviewParams?.siteUrl || '',
              payload.feedTitle || this.activePreviewParams?.targetTitle || '',
            )
            this.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
              this.activePreviewParams?.targetUrl || '',
              payload.feedTitle || this.activePreviewParams?.targetTitle || '',
              this.activePreviewParams?.targetView || FeedViewType.Articles,
              payload.siteUrl || this.activePreviewParams?.siteUrl || '',
              resolvedImageUrl,
              payload.description || this.activePreviewParams?.description || '',
              '',
              this.activePreviewParams?.category || '',
              1,
            )
            this.subscribeConfigReturnTarget = 'preview'
            this.syncOverlayRoute('subscribe-config', 2)
          },
          onOpenArticle: (entry: Entry, _feed: Feed) => {
            const tempFeed: Feed = {
              id: entry.feedId || 'preview',
              title: '',
              url: entry.url,
              siteUrl: entry.url,
              view: FeedViewType.Articles,
              showInAll: true,
              errorCount: 0,
              createdAt: 0,
              updatedAt: 0,
            }
            const model = toArticleDetailModel(entry, tempFeed)
            void openArticleDetail(entry.id || 'preview', JSON.stringify(model))
          },
        })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .transition(this.overlayEnterTransition())
      .zIndex(this.activeOverlayRoute === 'preview' ? 3 : 2)
    }
  }

  @Builder
  private DiscoverSubscribeConfigOverlay() {
    if (this.activeSubscribeConfigParams) {
      Stack() {
        DiscoverSubscribeConfigDestination({
          targetUrl: this.activeSubscribeConfigParams.targetUrl,
          targetTitle: this.activeSubscribeConfigParams.targetTitle,
          targetSiteUrl: this.activeSubscribeConfigParams.siteUrl,
          targetImageUrl: this.activeSubscribeConfigParams.imageUrl,
          targetDescription: this.activeSubscribeConfigParams.description,
          targetCategory: this.activeSubscribeConfigParams.category,
          sourceKind: this.activeSubscribeConfigParams.sourceKind,
          initialSelectedView: this.activeSubscribeConfigParams.targetView,
          restoreOverlayLevel: this.activeSubscribeConfigParams.restoreOverlayLevel,
          theme: this.theme,
          onBack: () => {
            this.closeSubscribeConfigToTarget()
          },
          onSubscribed: () => {
            AppStorage.setOrCreate('discoverSearchDismissAt', Date.now())
            this.closeSubscribeConfigToTarget()
          },
          onSaved: () => {
            this.closeSubscribeConfigToTarget()
          },
          onUnsubscribed: () => {
            this.activeBrowseParams = undefined
            this.activePreviewParams = undefined
            this.activeSubscribeConfigParams = undefined
            this.syncOverlayRoute('none', 0)
          },
        })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .transition(this.overlayEnterTransition())
      .zIndex(4)
    }
  }

  @Builder
  private DiscoverOverlayLayer() {
    this.DiscoverBrowseOverlay()
    this.DiscoverPreviewOverlay()
    this.DiscoverSubscribeConfigOverlay()
  }

  @Builder
  private DiscoverRoot() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.contentScroller) {
        this.DiscoverScrollContent()
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)
      .edgeEffect(EdgeEffect.Spring)
      .nestedScroll({
        scrollForward: NestedScrollMode.SELF_FIRST,
        scrollBackward: NestedScrollMode.SELF_FIRST,
      })
      .onWillScroll((_xOffset: number, yOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
        this.handleHeaderBlurScrollDelta(yOffset)
        this.keepPlatformChipsOnBlur = true
        this.logDiscoverFocusDebug('discover-scroll-stop-editing')
        this.searchInputController.stopEditing()
      })
      .padding({
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
        top: 0,
        bottom: this.isSearchModeActive() ? 16 : this.discoverListBottomPadding(),
      })

      this.DiscoverOverlayLayer()

      if (this.showBottomTabs && this.overlayLevel === 0) {
        BottomTabs({ activeTab: 'discover', theme: this.theme })
          .align(Alignment.Bottom)
      }

    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onAppear(() => {
      this.preventAutoKeyboardPopup('discover-root-appear')
      this.settleDiscoverRootVisible()
    })
  }


  build() {
    if (this.showBottomTabs) {
      this.DiscoverRoot()
    } else {
      HdsNavigation() {
        this.DiscoverRoot()
      }
      .titleBar({
        padding: {
          start: LengthMetrics.vp(2),
          end: LengthMetrics.vp(2),
        },
        style: {
          scrollEffectOpts: {
            enableScrollEffect: true,
            scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR,
            blurEffectiveStartOffset: LengthMetrics.vp(0),
            blurEffectiveEndOffset: LengthMetrics.vp(30),
          },
          blurStrategy: BlurStrategy.ENABLE,
          systemMaterialEffect: {
            materialType: hdsMaterial.MaterialType.IMMERSIVE,
            materialLevel: hdsMaterial.MaterialLevel.EXQUISITE,
          },
          originalStyle: {
            backgroundStyle: {
              backgroundColor: '#00000000',
              maskExtraHeight: 0,
              blurRadius: 28,
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
              backgroundColor: '#00000000',
              maskExtraHeight: 0,
              blurRadius: 48,
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
        },
        content: {
          title: {
            mainTitle: '',
          },
          bottomBuilder: {
            builder: (): void => this.DiscoverLowerTitleBuilder(),
          },
        },
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideBackButton(true)
      .hideTitleBar(this.overlayLevel > 0)
      .bindToScrollable([this.contentScroller])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
  }
}

