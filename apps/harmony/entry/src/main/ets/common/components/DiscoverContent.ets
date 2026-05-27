import { resolveDirectUrlResult } from './DiscoverCatalog'
import { DiscoverOverlayLayer } from './DiscoverOverlayLayer'
import { DiscoverSearchPanel } from './DiscoverSearchPanel'
import {
  DiscoverCandidateSection,
  DiscoverDirectUrlLoadingRow,
  DiscoverDirectUrlRow,
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
import {
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_MODE_TOP_OFFSET,
} from './FloatingRootPageLayout'
import { Feed, FeedViewType } from '../models/LivoModels'
import { DiscoverSearchPlatform, RecommendedFeed, ResolvedDiscoverCandidate } from '../services/discover/DiscoverTypes'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { FeedRefreshPayload, RssFeedService } from '../services/rss-feed/RssFeedService'
import { discoverViewLabel } from '../services/discover/DiscoverLabels'
import { resolveProfileCandidatesByPlatform } from '../services/discover/DiscoverProfileResolver'
import { resolveKeywordCandidatesByPlatform } from '../services/discover/DiscoverKeywordResolver'
import { searchedRecommendedFeedsByPlatform, trendingDiscoverFeedsFromJsonNow } from '../services/discover/DiscoverFeedCatalog'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { resolveDiscoverOverlayReturnLevel } from '../coordinators/discover/DiscoverNavigationPolicy'
import {
  candidateAvatarCacheKey, candidateAvatarFallbackUrls, platformColor,
  resolvedCandidateAvatarUrl, resolvedPlatformLabel, shouldHydrateCandidateAvatar,
} from '../coordinators/discover/DiscoverCandidatePresentation'
import { isSubscribedCandidate, isSubscribedRecommendedFeed } from '../coordinators/discover/DiscoverFeedIdentity'
import { BOTTOM_TAB_FLOAT_GAP, BOTTOM_TAB_TOTAL_HEIGHT, PAGE_BOTTOM_GAP, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { DiscoverInteractionCoordinator } from '../coordinators/discover/DiscoverInteractionCoordinator'
import {
  ROOT_TAB_SCROLL_TO_TOP_AT_KEY,
  ROOT_TAB_SCROLL_TO_TOP_TAB_KEY,
  scrollScrollerToTop,
} from '../coordinators/index-home/RootTabHelpers'

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
  @State directUrlPreviewPayload: FeedRefreshPayload | undefined = undefined
  @State isDirectUrlPreviewLoading: boolean = false
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
  directUrlPreviewSession: number = 0
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
  private readonly onDirectUrlOpen = (result: DirectUrlResult): void => {
    this.coordinator.openDirectUrlResult(result)
  }
  private readonly onCandidateSubscribe = (c: ResolvedDiscoverCandidate): void => {
    this.coordinator.openSubscribeConfigPage(c, resolveDiscoverOverlayReturnLevel('root'))
  }

  aboutToAppear(): void {
    this.coordinator.preventAutoKeyboardPopup('discover-about-to-appear')
    this.theme = this.inheritedTheme
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

  private syncInheritedTheme(): void {
    this.theme = this.inheritedTheme
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

  private resolvedDirectUrlResult(): DirectUrlResult | undefined {
    const result = this.directUrlResult()
    if (!result) {
      return undefined
    }

    const cachedPayload = this.directUrlPreviewPayload
      ?? DiscoverRemoteSearchService.cachedPreviewPayload(result.targetUrl)
      ?? DiscoverRemoteSearchService.cachedPreviewPayload(result.siteUrl)
    if (!cachedPayload) {
      return result
    }

    return {
      targetUrl: result.targetUrl,
      siteUrl: cachedPayload.siteUrl || result.siteUrl,
      title: cachedPayload.feedTitle || result.title,
      description: result.description,
    }
  }

  private shouldShowDirectUrlLoadingRow(): boolean {
    return !!this.directUrlResult()
      && this.isDirectUrlPreviewLoading
      && !this.resolvedDirectUrlResult()
  }

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

  private handleDiscoverQueryChange(value: string): void {
    this.coordinator.onQueryChange(value)
    void this.preloadDirectUrlPreview(value)
  }

  private async preloadDirectUrlPreview(query: string): Promise<void> {
    const result = resolveDirectUrlResult(query)
    this.directUrlPreviewSession += 1
    const session = this.directUrlPreviewSession

    if (!result) {
      this.directUrlPreviewPayload = undefined
      this.isDirectUrlPreviewLoading = false
      return
    }

    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(result.targetUrl)
      ?? DiscoverRemoteSearchService.cachedPreviewPayload(result.siteUrl)
    if (cachedPayload) {
      this.directUrlPreviewPayload = cachedPayload
      this.isDirectUrlPreviewLoading = false
      return
    }

    this.directUrlPreviewPayload = undefined
    this.isDirectUrlPreviewLoading = true
    try {
      const payload = await RssFeedService.previewFeedUrl(result.targetUrl)
      if (this.directUrlPreviewSession !== session) {
        return
      }
      DiscoverRemoteSearchService.rememberPreviewPayload(result.targetUrl, payload)
      this.directUrlPreviewPayload = payload
    } catch (_) {
      if (this.directUrlPreviewSession === session) {
        this.directUrlPreviewPayload = undefined
      }
    } finally {
      if (this.directUrlPreviewSession === session) {
        this.isDirectUrlPreviewLoading = false
      }
    }
  }

  // ── Builders ──

  @Builder
  private DiscoverScrollContent() {
    Column({ space: 8 }) {
      Blank().height(DISCOVER_TITLE_BAR_OVERLAY_SPACER)

      DiscoverSearchPanel({
        query: this.query, searchPlatform: this.searchPlatform,
        showPlatformChips: this.showPlatformChips, theme: this.theme,
        searchInputController: this.searchInputController,
        searchInputFocusable: this.searchInputFocusable,
        onQueryChange: (value: string) => { this.handleDiscoverQueryChange(value) },
        onClearQuery: () => { this.coordinator.onClearQuery() },
        onPlatformSwitch: (platform: DiscoverSearchPlatform) => { void this.coordinator.handlePlatformSwitch(platform) },
        onInputTouchDown: () => { this.coordinator.onInputTouchDown() },
        onInputClick: () => { this.coordinator.onInputClick() },
        onInputFocus: () => { this.coordinator.onInputFocus() },
        onInputBlur: () => { this.coordinator.onInputBlur() },
        onChipTouch: (isDown: boolean) => { this.coordinator.onChipTouch(isDown) },
      })

      if (this.isSearchModeActive()) {
        if (this.shouldShowDirectUrlLoadingRow()) {
          DiscoverDirectUrlLoadingRow({
            theme: this.theme,
          })
        } else if (this.resolvedDirectUrlResult()) {
          DiscoverDirectUrlRow({
            result: this.resolvedDirectUrlResult(),
            theme: this.theme,
            refreshToken: this.feedsChangedAt + this.overlayLevel,
            onOpen: this.onDirectUrlOpen,
            getCandidateAvatarFallbackUrls: this.candidateAvatarFallbackUrls,
          })
        }

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
          refreshToken: this.feedsChangedAt + this.overlayLevel,
          onOpen: this.onCandidateOpen, onSubscribe: this.onCandidateSubscribe,
          getActionLabel: this.rowActionLabel, getActionBackground: this.rowActionBg,
          getActionFontColor: this.rowActionColor, getAvatarUrl: this.rowAvatarUrl,
          getPlatformLabel: this.rowPlatformLabel, getMetaText: this.rowMetaText,
          getHasMetaText: this.rowHasMeta, getFallbackAvatarUrls: this.rowFallbackUrls,
          getPlatformColor: this.rowPlatformColor,
        })

        DiscoverCategoryBrowserSection({
          theme: this.theme,
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
    .transition(undefined)
  }

  private discoverListBottomPadding(): number {
    return PAGE_BOTTOM_GAP + BOTTOM_TAB_TOTAL_HEIGHT + BOTTOM_TAB_FLOAT_GAP + this.bottomAvoidArea
  }

  private discoverBottomSpacerHeight(): number {
    return 24
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

    }
    .width('100%').height('100%')
    .backgroundColor(this.theme.background)
    .onAppear(() => {
      this.coordinator.preventAutoKeyboardPopup('discover-root-appear')
      this.coordinator.settleDiscoverRootVisible()
    })
  }

  build() {
    this.DiscoverRoot()
  }
}
