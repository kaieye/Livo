import { AppRepository } from '../data/AppRepository'
import {
  DirectUrlResult,
  DiscoverBrowseRouteParams,
  DiscoverConfigReturnTarget,
  DiscoverFlowRouteParams,
  DiscoverOverlayRoute,
  createDiscoverFlowRouteParams,
  createDiscoverResultFromFeed,
} from '../components/DiscoverTypes'
import { Feed, FeedViewType } from '../models/LivoModels'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import {
  DiscoverSearchPlatform,
  RecommendedFeed,
  ResolvedDiscoverCandidate,
  discoverPlatformLabel,
  preferredViewForPlatform,
  trendingDiscoverFeedsFromJsonNow,
} from '../services/DiscoverService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { isInstagramPlaceholderAvatar } from '../utils/DiscoverCandidatePresentation'
import { isSubscribedCandidate, isSubscribedRecommendedFeed } from '../utils/DiscoverFeedIdentity'
import { resolveDiscoverOverlayReturnLevel } from '../utils/DiscoverNavigationPolicy'
import { resolveSocialFeedDisplayImageUrl } from '../utils/SocialFeedPresentation'

const DISCOVER_SEARCH_INPUT_ID: string = 'discover-search-input'

export interface DiscoverInteractionOwner {
  query: string
  searchPlatform: DiscoverSearchPlatform
  showPlatformChips: boolean
  isInteractingWithPlatformChips: boolean
  keepPlatformChipsOnBlur: boolean
  isPlatformSwitchSearching: boolean
  remoteResults: ResolvedDiscoverCandidate[]
  isSearchingRemote: boolean
  avatarOverrideVersion: number
  hasLoaded: boolean
  isLoadingPage: boolean
  subscribedFeeds: Feed[]
  overlayLevel: number
  activeOverlayRoute: DiscoverOverlayRoute
  activeBrowseParams?: DiscoverBrowseRouteParams
  activePreviewParams?: DiscoverFlowRouteParams
  activeSubscribeConfigParams?: DiscoverFlowRouteParams
  subscribeConfigReturnTarget: DiscoverConfigReturnTarget
  searchSession: number
  platformSwitchSession: number
  searchFocusGuardToken: number
  searchInputFocusable: boolean
  searchInputHasFocus: boolean
  searchInputUserFocusArmed: boolean
  searchInputController: TextInputController
  avatarOverrideMap: Map<string, string>
  avatarHydratingKeys: Set<string>
  onReady: () => void
  showBottomTabs: boolean
  inheritedTheme: ThemePalette
  theme: ThemePalette
  featuredTrendingFeeds: RecommendedFeed[]
  headerBlurOffset: number

  discoverFeaturedFeeds(): RecommendedFeed[]
  directUrlResult(): DirectUrlResult | undefined
  resolvedCandidates(): ResolvedDiscoverCandidate[]
  keywordCandidates(): ResolvedDiscoverCandidate[]
  localRecommendedResults(): RecommendedFeed[]
  searchResults(): ResolvedDiscoverCandidate[]
  resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string
  candidateAvatarCacheKey(candidate: ResolvedDiscoverCandidate): string
  shouldHydrateCandidateAvatar(candidate: ResolvedDiscoverCandidate): boolean
  candidateAvatarFallbackUrls(imageUrl: string, targetUrl: string, siteUrl: string, title: string): string[]
  resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string
  viewLabel(view: FeedViewType): string
  isSubscribedRecommendedFeed(feed: RecommendedFeed): boolean
  isSubscribedCandidate(candidate: ResolvedDiscoverCandidate): boolean
  hasSearchResults(): boolean
  hasAnyResult(): boolean
  isSearchModeActive(): boolean
}

export class DiscoverInteractionCoordinator {
  private readonly owner: DiscoverInteractionOwner

  constructor(owner: DiscoverInteractionOwner) {
    this.owner = owner
  }

  // ── Focus management ──

  private logDiscoverFocusDebug(event: string, detail: string = ''): void {
    const suffix = detail ? ` ${detail}` : ''
    console.info(
      `[DiscoverFocusDebug] ${event}${suffix} overlay=${this.owner.overlayLevel} chips=${this.owner.showPlatformChips} queryLength=${this.owner.query.length} token=${this.owner.searchFocusGuardToken}`,
    )
  }

  armSearchInputFocus(source: string): void {
    if (this.owner.searchInputHasFocus) {
      return
    }
    this.owner.searchInputUserFocusArmed = true
    this.owner.searchInputFocusable = true
    this.logDiscoverFocusDebug('arm-search-input-focus', `source=${source}`)
    this.requestDiscoverSearchInputFocus(`arm-${source}`)
  }

  disarmSearchInputFocus(reason: string): void {
    if (!this.owner.searchInputUserFocusArmed && !this.owner.searchInputFocusable) {
      return
    }
    this.owner.searchInputUserFocusArmed = false
    this.owner.searchInputFocusable = false
    this.logDiscoverFocusDebug('disarm-search-input-focus', `reason=${reason}`)
  }

  private requestDiscoverSearchInputFocus(source: string): void {
    const guardToken = this.owner.searchFocusGuardToken
    setTimeout(() => {
      if (this.owner.searchFocusGuardToken !== guardToken) {
        this.logDiscoverFocusDebug('skip-search-input-focus-request', `source=${source} reason=guard-changed`)
        return
      }
      if (!this.owner.searchInputUserFocusArmed || !this.owner.searchInputFocusable) {
        this.logDiscoverFocusDebug('skip-search-input-focus-request', `source=${source} reason=not-armed`)
        return
      }
      focusControl.requestFocus(DISCOVER_SEARCH_INPUT_ID)
      if (!this.owner.searchInputHasFocus) {
        this.owner.searchInputController.caretPosition(this.owner.query.length)
      }
      this.logDiscoverFocusDebug('apply-search-input-focus-request', `source=${source}`)
    }, 16)
  }

  handleSearchDismissSignal(): void {
    this.preventAutoKeyboardPopup('dismiss-signal')
  }

  preventAutoKeyboardPopup(source: string = 'unknown'): void {
    this.owner.searchFocusGuardToken += 1
    const guardToken = this.owner.searchFocusGuardToken
    this.logDiscoverFocusDebug('prevent-auto-keyboard-popup', `source=${source} guardToken=${guardToken}`)
    this.dismissSearchFocus('guard-initial')
    setTimeout(() => {
      if (this.owner.searchFocusGuardToken === guardToken) {
        this.logDiscoverFocusDebug('guard-dismiss', 'delayMs=80')
        this.dismissSearchFocus('guard-80ms')
      }
    }, 80)
    setTimeout(() => {
      if (this.owner.searchFocusGuardToken === guardToken) {
        this.logDiscoverFocusDebug('guard-dismiss', 'delayMs=220')
        this.dismissSearchFocus('guard-220ms')
      }
    }, 220)
    setTimeout(() => {
      if (this.owner.searchFocusGuardToken === guardToken) {
        this.logDiscoverFocusDebug('guard-dismiss', 'delayMs=420')
        this.dismissSearchFocus('guard-420ms')
      }
    }, 420)
  }

  dismissSearchFocus(reason: string = 'unknown'): void {
    this.logDiscoverFocusDebug('dismiss-search-focus', `reason=${reason}`)
    this.disarmSearchInputFocus(`dismiss-${reason}`)
    this.owner.searchInputController.stopEditing()
    this.owner.searchInputHasFocus = false
    this.owner.showPlatformChips = false
    this.owner.keepPlatformChipsOnBlur = false
  }

  // ── Search input events ──

  onInputTouchDown(): void {
    if (!this.owner.searchInputHasFocus) {
      this.armSearchInputFocus('input-touch-down')
    }
  }

  onInputClick(): void {
    this.logDiscoverFocusDebug('search-input-click')
    if (!this.owner.searchInputHasFocus) {
      this.armSearchInputFocus('input-click')
    }
    this.owner.showPlatformChips = true
  }

  onInputFocus(): void {
    this.owner.searchInputHasFocus = true
    this.logDiscoverFocusDebug(
      'search-input-focus',
      `armed=${this.owner.searchInputUserFocusArmed ? 'true' : 'false'} focusable=${this.owner.searchInputFocusable ? 'true' : 'false'}`,
    )
    this.owner.showPlatformChips = true
  }

  onInputBlur(): void {
    this.owner.searchInputHasFocus = false
    this.logDiscoverFocusDebug('search-input-blur', `keepChips=${this.owner.keepPlatformChipsOnBlur ? 'true' : 'false'}`)
    this.disarmSearchInputFocus('input-blur')
    if (this.owner.keepPlatformChipsOnBlur) {
      this.owner.keepPlatformChipsOnBlur = false
      return
    }
    setTimeout(() => {
      if (!this.owner.isInteractingWithPlatformChips) {
        this.owner.showPlatformChips = false
        this.logDiscoverFocusDebug('hide-platform-chips-on-blur')
      }
    }, 80)
  }

  onQueryChange(value: string): void {
    this.owner.query = value
    void this.refreshRemoteResults()
  }

  onClearQuery(): void {
    this.owner.query = ''
    this.owner.remoteResults = []
    this.owner.isSearchingRemote = false
  }

  onChipTouch(isDown: boolean): void {
    this.owner.isInteractingWithPlatformChips = isDown
  }

  // ── Search execution ──

  async refreshRemoteResults(): Promise<void> {
    const trimmed = this.owner.query.trim()
    this.owner.searchSession += 1
    const session = this.owner.searchSession

    if (!trimmed) {
      this.owner.remoteResults = []
      this.owner.isSearchingRemote = false
      void this.hydrateAvatarsForCandidates(this.owner.discoverFeaturedFeeds().map((feed: RecommendedFeed): ResolvedDiscoverCandidate => createDiscoverResultFromFeed(feed)))
      return
    }

    if (this.owner.directUrlResult()) {
      this.owner.remoteResults = []
      this.owner.isSearchingRemote = false
      return
    }

    this.owner.isSearchingRemote = true
    try {
      const results = await DiscoverRemoteSearchService.search(trimmed, this.owner.searchPlatform)
      if (this.owner.searchSession !== session) {
        return
      }
      this.owner.remoteResults = results
      void this.hydrateAvatarsForCandidates(results)
    } catch (_) {
      if (this.owner.searchSession !== session) {
        return
      }
      this.owner.remoteResults = []
    } finally {
      if (this.owner.searchSession === session) {
        this.owner.isSearchingRemote = false
      }
    }
  }

  async handlePlatformSwitch(platform: DiscoverSearchPlatform): Promise<void> {
    if (this.owner.searchPlatform === platform) {
      return
    }

    this.owner.searchPlatform = platform
    this.owner.remoteResults = []

    if (!this.owner.query.trim()) {
      void this.hydrateAvatarsForCandidates(this.owner.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed)))
      return
    }

    this.owner.platformSwitchSession += 1
    const session = this.owner.platformSwitchSession
    this.owner.isPlatformSwitchSearching = true

    await Promise.all([
      this.refreshRemoteResults(),
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 220)
      }),
    ])

    if (this.owner.platformSwitchSession === session) {
      this.owner.isPlatformSwitchSearching = false
    }
  }

  // ── Avatar hydration ──

  async hydrateAvatarsForCandidates(candidates: ResolvedDiscoverCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      const key = this.owner.candidateAvatarCacheKey(candidate)
      if (this.owner.avatarOverrideMap.has(key) || this.owner.avatarHydratingKeys.has(key)) {
        continue
      }
      if (!this.owner.shouldHydrateCandidateAvatar(candidate)) {
        continue
      }

      this.owner.avatarHydratingKeys.add(key)
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

        const platform = this.owner.resolvedPlatformLabel(candidate)
        const finalResolved = trimmedResolved
        if (platform === 'Instagram' && isInstagramPlaceholderAvatar(finalResolved)) {
          continue
        }

        const current = this.owner.resolvedCandidateAvatarUrl(candidate).trim()
        if (!current || current !== finalResolved) {
          this.owner.avatarOverrideMap.set(key, finalResolved)
          this.owner.avatarOverrideVersion += 1
        }
      } catch (_) {
        // Keep original avatar URL when hydration fails.
      } finally {
        this.owner.avatarHydratingKeys.delete(key)
      }
    }
  }

  // ── Data loading ──

  async loadData(): Promise<void> {
    if (this.owner.isLoadingPage) {
      return
    }

    this.owner.isLoadingPage = true
    try {
      if (this.owner.showBottomTabs) {
        const settings = await AppRepository.settings()
        this.owner.theme = await ThemeService.resolvePalette(settings)
      } else {
        this.owner.theme = this.owner.inheritedTheme
      }
      this.owner.subscribedFeeds = await AppRepository.feedEntities()
      this.owner.featuredTrendingFeeds = trendingDiscoverFeedsFromJsonNow()

      this.owner.hasLoaded = true
      this.owner.onReady()
      void this.hydrateAvatarsForCandidates(this.owner.discoverFeaturedFeeds().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed)))
    } finally {
      this.owner.isLoadingPage = false
    }
  }

  async refreshSubscribedFeeds(): Promise<void> {
    this.owner.subscribedFeeds = await AppRepository.feedEntities()
  }

  // ── Overlay navigation ──

  private syncOverlayRoute(route: DiscoverOverlayRoute, level: number): void {
    this.owner.activeOverlayRoute = route
    this.owner.overlayLevel = level
    AppStorage.setOrCreate('discoverOverlayLevel', level)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', level > 0)
  }

  private scheduleOverlayNavigation(action: () => void): void {
    this.dismissSearchFocus('overlay-navigation')
    action()
    AppStorage.setOrCreate('discoverHasForegroundOverlay', this.owner.overlayLevel > 0)
  }

  private closeSubscribeConfigToTarget(): void {
    this.owner.activeSubscribeConfigParams = undefined
    if (this.owner.subscribeConfigReturnTarget === 'preview' && this.owner.activePreviewParams) {
      this.syncOverlayRoute('preview', 2)
      return
    }
    if (this.owner.subscribeConfigReturnTarget === 'browse' && this.owner.activeBrowseParams) {
      this.syncOverlayRoute('browse', 1)
      return
    }
    this.owner.activePreviewParams = undefined
    this.owner.activeBrowseParams = undefined
    this.syncOverlayRoute('none', 0)
  }

  settleDiscoverRootVisible(): void {
    AppStorage.setOrCreate('discoverRootVisibleSince', Date.now())
    if (this.owner.activeOverlayRoute === 'none') {
      this.syncOverlayRoute('none', 0)
    }
  }

  // ── Overlay event handlers ──

  handleNavigationResetSignal(): void {
    this.dismissSearchFocus('navigation-reset')
    this.owner.remoteResults = []
    this.owner.isSearchingRemote = false
    this.owner.isPlatformSwitchSearching = false
    this.owner.activeBrowseParams = undefined
    this.owner.activePreviewParams = undefined
    this.owner.activeSubscribeConfigParams = undefined
    this.syncOverlayRoute('none', 0)
  }

  handleOverlayBackSignal(): void {
    this.consumeOverlayBack()
  }

  consumeOverlayBack(): boolean {
    if (this.owner.activeSubscribeConfigParams) {
      this.closeSubscribeConfigToTarget()
      return true
    }

    if (this.owner.activePreviewParams) {
      this.owner.activePreviewParams = undefined
      if (this.owner.activeBrowseParams) {
        this.syncOverlayRoute('browse', 1)
      } else {
        this.syncOverlayRoute('none', 0)
      }
      return true
    }

    if (this.owner.activeBrowseParams) {
      this.owner.activeBrowseParams = undefined
      this.owner.activePreviewParams = undefined
      this.owner.activeSubscribeConfigParams = undefined
      this.syncOverlayRoute('none', 0)
      return true
    }

    if (this.owner.overlayLevel > 0) {
      this.syncOverlayRoute('none', 0)
      return true
    }

    return false
  }

  handleFeedsChanged(): void {
    void this.refreshSubscribedFeeds()
  }

  handleDiscoverOverlayLevelChanged(currentOverlayLevel: number): void {
    if (currentOverlayLevel < this.owner.overlayLevel) {
      this.owner.overlayLevel = currentOverlayLevel
    }
  }

  // ── Navigation actions ──

  openBrowsePage(view: FeedViewType, title: string, sourceKey: string = ''): void {
    this.scheduleOverlayNavigation(() => {
      const params = new DiscoverBrowseRouteParams()
      params.view = view
      params.title = title
      params.sourceKey = sourceKey
      params.restoreOverlayLevel = 0
      this.owner.activeBrowseParams = params
      this.owner.activePreviewParams = undefined
      this.owner.activeSubscribeConfigParams = undefined
      this.owner.subscribeConfigReturnTarget = 'root'
      this.syncOverlayRoute('browse', 1)
    })
  }

  openPreviewPage(
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
      this.owner.activePreviewParams = createDiscoverFlowRouteParams(
        targetUrl, targetTitle, targetView, siteUrl, imageUrl, description, sourceKind, category, restoreOverlayLevel,
      )
      this.owner.activeSubscribeConfigParams = undefined
      this.owner.subscribeConfigReturnTarget = restoreOverlayLevel > 0 ? 'browse' : 'root'
      this.syncOverlayRoute('preview', restoreOverlayLevel > 0 ? 2 : 1)
    })
  }

  openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate, restoreOverlayLevel: number = 0): void {
    this.scheduleOverlayNavigation(() => {
      this.owner.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
        candidate.targetUrl, candidate.targetTitle, candidate.targetView, candidate.siteUrl,
        this.owner.resolvedCandidateAvatarUrl(candidate), candidate.description, candidate.sourceKind,
        this.owner.resolvedPlatformLabel(candidate), restoreOverlayLevel,
      )
      this.owner.subscribeConfigReturnTarget = restoreOverlayLevel > 0 ? 'browse' : (this.owner.activePreviewParams ? 'preview' : 'root')
      this.syncOverlayRoute('subscribe-config', restoreOverlayLevel > 0 ? 2 : 1)
    })
  }

  openDirectUrlResult(result: DirectUrlResult): void {
    this.openPreviewPage(
      result.targetUrl, result.title, preferredViewForPlatform(this.owner.searchPlatform),
      result.siteUrl, '', result.description, '地址', discoverPlatformLabel(this.owner.searchPlatform),
      resolveDiscoverOverlayReturnLevel('root'),
    )
  }

  openCandidate(candidate: ResolvedDiscoverCandidate): void {
    this.openPreviewPage(
      candidate.targetUrl, candidate.targetTitle, candidate.targetView, candidate.siteUrl,
      this.owner.resolvedCandidateAvatarUrl(candidate), candidate.description, candidate.sourceKind,
      this.owner.resolvedPlatformLabel(candidate), resolveDiscoverOverlayReturnLevel('root'),
    )
  }

  // ── Browse overlay callbacks ──

  onBrowseBack(): void {
    this.owner.activeBrowseParams = undefined
    this.owner.activePreviewParams = undefined
    this.owner.activeSubscribeConfigParams = undefined
    this.syncOverlayRoute('none', 0)
  }

  onBrowseOpenPreview(feed: RecommendedFeed): void {
    const result = createDiscoverResultFromFeed(feed)
    const imageUrl: string = result.imageUrl || ''
    const category: string = feed.category || ''
    this.owner.activePreviewParams = createDiscoverFlowRouteParams(
      result.targetUrl, result.targetTitle, result.targetView, result.siteUrl,
      imageUrl, result.description, result.sourceKind, category, 1,
    )
    this.syncOverlayRoute('preview', 2)
  }

  onBrowseOpenSubscribeConfig(feed: RecommendedFeed): void {
    const result = createDiscoverResultFromFeed(feed)
    const imageUrl: string = result.imageUrl || ''
    const category: string = feed.category || ''
    this.owner.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
      result.targetUrl, result.targetTitle, result.targetView, result.siteUrl,
      imageUrl, result.description, result.sourceKind, category, 1,
    )
    this.owner.subscribeConfigReturnTarget = 'browse'
    this.syncOverlayRoute('subscribe-config', 2)
  }

  // ── Preview overlay callbacks ──

  onPreviewBack(): void {
    this.owner.activePreviewParams = undefined
    if (this.owner.activeBrowseParams) {
      this.syncOverlayRoute('browse', 1)
      return
    }
    this.syncOverlayRoute('none', 0)
  }

  onPreviewEdit(feed: Feed): void {
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      feed.imageUrl || this.owner.activePreviewParams?.imageUrl || '',
      feed.url || this.owner.activePreviewParams?.targetUrl || '',
      feed.siteUrl || this.owner.activePreviewParams?.siteUrl || '',
      feed.title || this.owner.activePreviewParams?.targetTitle || '',
    )
    this.owner.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
      this.owner.activePreviewParams?.targetUrl || '', feed.title, feed.view,
      feed.siteUrl || this.owner.activePreviewParams?.siteUrl || '', resolvedImageUrl,
      feed.description || this.owner.activePreviewParams?.description || '', '编辑', feed.category || '', 1,
    )
    this.owner.subscribeConfigReturnTarget = 'preview'
    this.syncOverlayRoute('subscribe-config', 2)
  }

  onPreviewSubscribe(payload: FeedRefreshPayload): void {
    DiscoverRemoteSearchService.rememberPreviewPayload(this.owner.activePreviewParams?.targetUrl || '', payload)
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      payload.imageUrl || this.owner.activePreviewParams?.imageUrl || '',
      payload.resolvedFeedUrl || this.owner.activePreviewParams?.targetUrl || '',
      payload.siteUrl || this.owner.activePreviewParams?.siteUrl || '',
      payload.feedTitle || this.owner.activePreviewParams?.targetTitle || '',
    )
    this.owner.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
      this.owner.activePreviewParams?.targetUrl || '',
      payload.feedTitle || this.owner.activePreviewParams?.targetTitle || '',
      this.owner.activePreviewParams?.targetView || FeedViewType.Articles,
      payload.siteUrl || this.owner.activePreviewParams?.siteUrl || '',
      resolvedImageUrl, payload.description || this.owner.activePreviewParams?.description || '',
      '', this.owner.activePreviewParams?.category || '', 1,
    )
    this.owner.subscribeConfigReturnTarget = 'preview'
    this.syncOverlayRoute('subscribe-config', 2)
  }

  // ── Subscribe config callbacks ──

  onSubscribeConfigBack(): void {
    this.closeSubscribeConfigToTarget()
  }

  onSubscribeConfigSubscribed(): void {
    AppStorage.setOrCreate('discoverSearchDismissAt', Date.now())
    this.closeSubscribeConfigToTarget()
  }

  onSubscribeConfigSaved(): void {
    this.closeSubscribeConfigToTarget()
  }

  onSubscribeConfigUnsubscribed(): void {
    this.owner.activeBrowseParams = undefined
    this.owner.activePreviewParams = undefined
    this.owner.activeSubscribeConfigParams = undefined
    this.syncOverlayRoute('none', 0)
  }
}
