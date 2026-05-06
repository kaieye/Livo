import { BottomTabs } from './BottomTabs'
import { resolveDirectUrlResult } from './DiscoverCatalog'
import { DiscoverOverlayLayer } from './DiscoverOverlayLayer'
import { DiscoverSearchPanel } from './DiscoverSearchPanel'
import {
  DiscoverCandidateSection,
  DiscoverSearchResultSection,
  DiscoverCategoryBrowserSection,
} from './DiscoverResultSections'
import { DiscoverNoResultState } from './DiscoverNoResultState'
import {
  DirectUrlResult,
  DiscoverBrowseRouteParams,
  DiscoverFlowRouteParams,
  DiscoverOverlayRoute,
  createDiscoverResultFromFeed,
} from './DiscoverTypes'
import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation, HdsNavigationTitleMode, ScrollEffectType, hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import {
  ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import { Feed, FeedViewType } from '../models/LivoModels'
import { DiscoverSearchPlatform, RecommendedFeed, ResolvedDiscoverCandidate } from '../services/discover/DiscoverTypes'
import { discoverViewLabel } from '../services/discover/DiscoverLabels'
import { resolveProfileCandidatesByPlatform } from '../services/discover/DiscoverProfileResolver'
import { resolveKeywordCandidatesByPlatform } from '../services/discover/DiscoverKeywordResolver'
import { searchedRecommendedFeedsByPlatform, trendingDiscoverFeedsFromJsonNow } from '../services/discover/DiscoverFeedCatalog'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { resolveDiscoverOverlayReturnLevel } from '../utils/DiscoverNavigationPolicy'
import {
  candidateAvatarCacheKey, candidateAvatarFallbackUrls, platformColor,
  resolvedCandidateAvatarUrl, resolvedPlatformLabel, shouldHydrateCandidateAvatar,
} from '../utils/DiscoverCandidatePresentation'
import { isSubscribedCandidate, isSubscribedRecommendedFeed } from '../utils/DiscoverFeedIdentity'
import { PAGE_BOTTOM_GAP, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { DiscoverInteractionCoordinator } from '../utils/DiscoverInteractionCoordinator'
import {
  ROOT_TAB_SCROLL_TO_TOP_AT_KEY,
  ROOT_TAB_SCROLL_TO_TOP_TAB_KEY,
  scrollScrollerToTop,
} from '../utils/RootTabScrollToTopSignal'

const HEADER_BLUR_SCROLL_RANGE: number = 72
const DISCOVER_TITLE_BAR_MINI_HEIGHT: number = 56
const DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const DISCOVER_TITLE_BAR_OVERLAY_SPACER: number =
  DISCOVER_TITLE_BAR_MINI_HEIGHT + DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET

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
  @State subscribeConfigReturnTarget: import('./DiscoverTypes').DiscoverConfigReturnTarget = 'root'
  @Prop showBottomTabs: boolean = true
  @Prop reserveBottomTabInset: boolean = false
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @StorageProp(ROOT_TAB_SCROLL_TO_TOP_AT_KEY) @Watch('handleRootTabScrollToTopSignal') rootTabScrollToTopAt: number = 0
  @StorageProp(ROOT_TAB_SCROLL_TO_TOP_TAB_KEY) rootTabScrollToTopTab: string = ''
  @StorageProp('discoverOverlayLevel') @Watch('handleDiscoverOverlayLevelChanged') discoverOverlayLevel: number = 0
  @StorageProp('discoverNavigationResetAt') @Watch('handleNavigationResetSignal') discoverNavigationResetAt: number = 0
  @StorageProp('discoverOverlayBackAt') @Watch('handleOverlayBackSignal') discoverOverlayBackAt: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @StorageProp('discoverSearchDismissAt') @Watch('handleSearchDismissSignal') discoverSearchDismissAt: number = 0
  onReady: () => void = () => {}
  searchSession: number = 0
  platformSwitchSession: number = 0
  searchFocusGuardToken: number = 0
  searchInputFocusable: boolean = false
  searchInputHasFocus: boolean = false
  searchInputUserFocusArmed: boolean = false
  searchInputController: TextInputController = new TextInputController()
  headerBlurOffset: number = 0
  avatarOverrideMap: Map<string, string> = new Map<string, string>()
  avatarHydratingKeys: Set<string> = new Set<string>()
  private readonly contentScroller: Scroller = new Scroller()
  private readonly coordinator: DiscoverInteractionCoordinator = new DiscoverInteractionCoordinator(this)

  // ── Candidate display callbacks (reused across sections) ──
  private readonly rowActionLabel = (c: ResolvedDiscoverCandidate): string => this.candidateActionLabel(c)
  private readonly rowActionBg = (c: ResolvedDiscoverCandidate): string => this.candidateActionBackground(c)
  private readonly rowActionColor = (c: ResolvedDiscoverCandidate): string => this.candidateActionFontColor(c)
  private readonly rowAvatarUrl = (c: ResolvedDiscoverCandidate): string => this.resolvedCandidateAvatarUrl(c)
  private readonly rowPlatformLabel = (c: ResolvedDiscoverCandidate): string => this.resolvedPlatformLabel(c)
  private readonly rowMetaText = (c: ResolvedDiscoverCandidate): string => this.candidateMetaText(c)
  private readonly rowHasMeta = (c: ResolvedDiscoverCandidate): boolean => this.hasCandidateMetaText(c)
  private readonly rowFallbackUrls = (c: ResolvedDiscoverCandidate): string[] =>
    this.candidateAvatarFallbackUrls(this.resolvedCandidateAvatarUrl(c), c.targetUrl, c.siteUrl, c.targetTitle)
  private readonly rowPlatformColor = (label: string): string => platformColor(label, this.theme.accent)
  private readonly onCandidateOpen = (c: ResolvedDiscoverCandidate): void => {
    this.coordinator.openCandidate(c)
  }
  private readonly onCandidateSubscribe = (c: ResolvedDiscoverCandidate): void => {
    this.coordinator.openSubscribeConfigPage(c, resolveDiscoverOverlayReturnLevel('root'))
  }

  aboutToAppear(): void {
    this.coordinator.preventAutoKeyboardPopup('discover-about-to-appear')
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
    if (this.hasLoaded || this.isLoadingPage) {
      this.onReady()
      return
    }
    void this.coordinator.loadData()
  }

  private updateHeaderBlurProgress(offset: number): void {
    this.headerBlurOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
  }

  private handleHeaderBlurScrollDelta(delta: number): void {
    this.updateHeaderBlurProgress(this.headerBlurOffset + delta)
  }

  private rootEnterTransition(delay: number) {
    return this.showBottomTabs ? livoMotion.enterScale(delay) : undefined
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
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING })
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
  }

  private handleDiscoverOverlayLevelChanged(): void { this.coordinator.handleDiscoverOverlayLevelChanged(this.discoverOverlayLevel) }
  private handleNavigationResetSignal(): void { this.coordinator.handleNavigationResetSignal() }
  private handleOverlayBackSignal(): void { this.coordinator.handleOverlayBackSignal() }
  private handleFeedsChanged(): void { this.coordinator.handleFeedsChanged() }
  private handleSearchDismissSignal(): void { this.coordinator.handleSearchDismissSignal() }
  private handleRootTabScrollToTopSignal(): void {
    if (this.rootTabScrollToTopTab !== 'discover' || this.overlayLevel > 0) {
      return
    }

    this.updateHeaderBlurProgress(0)
    scrollScrollerToTop(this.contentScroller, '发现')
  }

  // ── Owner interface (called by coordinator) ──

  discoverFeaturedFeeds(): RecommendedFeed[] { return this.featuredTrendingFeeds.slice(0, 7) }

  directUrlResult(): DirectUrlResult | undefined { return resolveDirectUrlResult(this.query) }

  resolvedCandidates(): ResolvedDiscoverCandidate[] {
    return resolveProfileCandidatesByPlatform(this.query.trim(), this.searchPlatform)
  }

  keywordCandidates(): ResolvedDiscoverCandidate[] {
    return resolveKeywordCandidatesByPlatform(this.query, this.searchPlatform)
  }

  localRecommendedResults(): RecommendedFeed[] {
    if (!this.query.trim()) {
      return []
    }
    return searchedRecommendedFeedsByPlatform(this.query, this.searchPlatform)
      .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
      .slice(0, 10)
  }

  searchResults(): ResolvedDiscoverCandidate[] {
    if (this.remoteResults.length > 0) {
      return this.remoteResults
    }
    return this.localRecommendedResults().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed))
  }

  viewLabel(view: FeedViewType): string { return discoverViewLabel(view) }

  isSubscribedRecommendedFeed(feed: RecommendedFeed): boolean {
    return isSubscribedRecommendedFeed(this.subscribedFeeds, feed)
  }

  isSubscribedCandidate(candidate: ResolvedDiscoverCandidate): boolean {
    return isSubscribedCandidate(this.subscribedFeeds, candidate)
  }

  hasSearchResults(): boolean { return this.searchResults().length > 0 }

  hasAnyResult(): boolean {
    return !!this.directUrlResult()
      || this.resolvedCandidates().length > 0
      || this.keywordCandidates().length > 0
      || this.hasSearchResults()
  }

  isSearchModeActive(): boolean {
    return !!this.query.trim() || this.isSearchingRemote || this.isPlatformSwitchSearching
  }

  resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string {
    return resolvedPlatformLabel(candidate, (view: FeedViewType) => this.viewLabel(view))
  }

  resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string {
    const override = this.avatarOverrideMap.get(this.candidateAvatarCacheKey(candidate)) || ''
    return resolvedCandidateAvatarUrl(candidate, override, (view: FeedViewType) => this.viewLabel(view))
  }

  candidateAvatarCacheKey(candidate: ResolvedDiscoverCandidate): string {
    return candidateAvatarCacheKey(candidate)
  }

  candidateAvatarFallbackUrls(
    imageUrl: string, targetUrl: string, siteUrl: string, title: string,
  ): string[] {
    return candidateAvatarFallbackUrls(imageUrl, targetUrl, siteUrl, title)
  }

  shouldHydrateCandidateAvatar(candidate: ResolvedDiscoverCandidate): boolean {
    return shouldHydrateCandidateAvatar(
      candidate, this.resolvedCandidateAvatarUrl(candidate), (view: FeedViewType) => this.viewLabel(view))
  }

  // ── Presentation helpers ──

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

  private featuredCandidates(): ResolvedDiscoverCandidate[] {
    return this.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed))
  }

  // ── Builders ──

  @Builder
  private DiscoverScrollContent() {
    Column({ space: 8 }) {
      Blank().height(DISCOVER_TITLE_BAR_OVERLAY_SPACER)

      DiscoverSearchPanel({
        query: this.query, searchPlatform: this.searchPlatform,
        showPlatformChips: this.showPlatformChips, theme: this.theme,
        showBottomTabs: this.showBottomTabs,
        searchInputController: this.searchInputController,
        searchInputFocusable: this.searchInputFocusable,
        onQueryChange: (value: string) => { this.coordinator.onQueryChange(value) },
        onClearQuery: () => { this.coordinator.onClearQuery() },
        onPlatformSwitch: (platform: DiscoverSearchPlatform) => { void this.coordinator.handlePlatformSwitch(platform) },
        onInputTouchDown: () => { this.coordinator.onInputTouchDown() },
        onInputClick: () => { this.coordinator.onInputClick() },
        onInputFocus: () => { this.coordinator.onInputFocus() },
        onInputBlur: () => { this.coordinator.onInputBlur() },
        onChipTouch: (isDown: boolean) => { this.coordinator.onChipTouch(isDown) },
      })

      if (this.isSearchModeActive()) {
        if (this.hasSearchResults() || this.isSearchingRemote || this.isPlatformSwitchSearching) {
          DiscoverSearchResultSection({
            items: this.searchResults(), theme: this.theme,
            isLoading: this.isSearchingRemote,
            isPlatformSwitchSearching: this.isPlatformSwitchSearching,
            refreshToken: this.feedsChangedAt + this.overlayLevel,
            onOpen: this.onCandidateOpen, onSubscribe: this.onCandidateSubscribe,
            getActionLabel: this.rowActionLabel, getActionBackground: this.rowActionBg,
            getActionFontColor: this.rowActionColor, getAvatarUrl: this.rowAvatarUrl,
            getPlatformLabel: this.rowPlatformLabel, getMetaText: this.rowMetaText,
            getHasMetaText: this.rowHasMeta, getFallbackAvatarUrls: this.rowFallbackUrls,
            getPlatformColor: this.rowPlatformColor,
          })
        }

        if (this.query.trim() && !this.hasAnyResult() && !this.isSearchingRemote && !this.isPlatformSwitchSearching) {
          DiscoverNoResultState({ theme: this.theme })
        }
      } else {
        DiscoverCandidateSection({
          title: '热门推荐', items: this.featuredCandidates(),
          compact: true, separateCards: true, showActionButton: false, showMoreButton: true,
          leadingIcon: $r('app.media.Flame'), theme: this.theme,
          showBottomTabs: this.showBottomTabs,
          refreshToken: this.feedsChangedAt + this.overlayLevel,
          onOpen: this.onCandidateOpen, onSubscribe: this.onCandidateSubscribe,
          getActionLabel: this.rowActionLabel, getActionBackground: this.rowActionBg,
          getActionFontColor: this.rowActionColor, getAvatarUrl: this.rowAvatarUrl,
          getPlatformLabel: this.rowPlatformLabel, getMetaText: this.rowMetaText,
          getHasMetaText: this.rowHasMeta, getFallbackAvatarUrls: this.rowFallbackUrls,
          getPlatformColor: this.rowPlatformColor,
        })

        DiscoverCategoryBrowserSection({
          theme: this.theme, showBottomTabs: this.showBottomTabs,
          onOpenBrowse: (view: number, label: string, sourceKey: string) => {
            this.coordinator.openBrowsePage(view as FeedViewType, label, sourceKey)
          },
        })
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
    return this.showBottomTabs || this.reserveBottomTabInset
  }

  private discoverListBottomPadding(): number {
    return this.shouldReserveBottomDock() ? 24 : PAGE_BOTTOM_GAP
  }

  private discoverBottomSpacerHeight(): number {
    return this.shouldReserveBottomDock() ? 108 + this.bottomAvoidArea : 24
  }

  @Builder
  private DiscoverRoot() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.contentScroller) {
        this.DiscoverScrollContent()
      }
      .width('100%').height('100%')
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
        this.searchInputController.stopEditing()
      })
      .padding({
        left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0,
        bottom: this.isSearchModeActive() ? 16 : this.discoverListBottomPadding(),
      })

      DiscoverOverlayLayer({
        activeBrowseParams: this.activeBrowseParams,
        activePreviewParams: this.activePreviewParams,
        activeSubscribeConfigParams: this.activeSubscribeConfigParams,
        activeOverlayRoute: this.activeOverlayRoute,
        theme: this.theme,
        onBrowseBack: () => { this.coordinator.onBrowseBack() },
        onBrowseOpenPreview: (feed: RecommendedFeed) => { this.coordinator.onBrowseOpenPreview(feed) },
        onBrowseOpenSubscribeConfig: (feed: RecommendedFeed) => { this.coordinator.onBrowseOpenSubscribeConfig(feed) },
        onPreviewBack: () => { this.coordinator.onPreviewBack() },
        onPreviewEdit: (feed: Feed) => { this.coordinator.onPreviewEdit(feed) },
        onPreviewSubscribe: (payload) => { this.coordinator.onPreviewSubscribe(payload) },
        onSubscribeConfigBack: () => { this.coordinator.onSubscribeConfigBack() },
        onSubscribeConfigSubscribed: () => { this.coordinator.onSubscribeConfigSubscribed() },
        onSubscribeConfigSaved: () => { this.coordinator.onSubscribeConfigSaved() },
        onSubscribeConfigUnsubscribed: () => { this.coordinator.onSubscribeConfigUnsubscribed() },
      })

      if (this.showBottomTabs && this.overlayLevel === 0) {
        BottomTabs({ activeTab: 'discover', theme: this.theme }).align(Alignment.Bottom)
      }
    }
    .width('100%').height('100%')
    .backgroundColor(this.theme.background)
    .onAppear(() => {
      this.coordinator.preventAutoKeyboardPopup('discover-root-appear')
      this.coordinator.settleDiscoverRootVisible()
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
        padding: { start: LengthMetrics.vp(2), end: LengthMetrics.vp(2) },
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
            backgroundStyle: { backgroundColor: '#00000000', maskExtraHeight: 0, blurRadius: 28 },
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
            backgroundStyle: { backgroundColor: '#00000000', maskExtraHeight: 0, blurRadius: 48 },
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
          title: { mainTitle: '' },
          bottomBuilder: { builder: (): void => this.DiscoverLowerTitleBuilder() },
        },
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideBackButton(true)
      .hideTitleBar(this.overlayLevel > 0)
      .bindToScrollable([this.contentScroller])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
      .width('100%').height('100%')
      .backgroundColor(this.theme.background)
    }
  }
}
