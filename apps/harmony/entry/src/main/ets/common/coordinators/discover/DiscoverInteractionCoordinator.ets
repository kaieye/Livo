import { FeedRepository } from '../../repositories/FeedRepository'
import { Feed, FeedViewType } from '../../models/LivoModels'
import { DiscoverSearchPlatform, RecommendedFeed, ResolvedDiscoverCandidate } from '../../services/discover/DiscoverTypes'
import { trendingDiscoverFeedsFromJsonNow } from '../../services/discover/DiscoverFeedCatalog'
import { FeedRefreshPayload } from '../../services/rss-feed/RssFeedService'
import { ThemePalette } from '../../services/ThemeService'
import { DiscoverFocusController, DiscoverFocusOwner } from './DiscoverFocusController'
import { DiscoverOverlayController, DiscoverOverlayOwner } from './DiscoverOverlayController'
import { DiscoverSearchExecutor, DiscoverSearchOwner } from './DiscoverSearchExecutor'
import { DirectUrlResult } from '../../components/DiscoverTypes'

export interface DiscoverDataOwner {
  hasLoaded: boolean
  isLoadingPage: boolean
  subscribedFeeds: Feed[]
  featuredTrendingFeeds: RecommendedFeed[]
  inheritedTheme: ThemePalette
  theme: ThemePalette
  onReady: () => void
}

export interface DiscoverInteractionOwner
  extends DiscoverFocusOwner, DiscoverSearchOwner, DiscoverOverlayOwner, DiscoverDataOwner {}

export class DiscoverInteractionCoordinator {
  private readonly owner: DiscoverInteractionOwner
  private readonly focus: DiscoverFocusController
  private readonly search: DiscoverSearchExecutor
  private readonly overlay: DiscoverOverlayController

  constructor(owner: DiscoverInteractionOwner) {
    this.owner = owner
    this.focus = new DiscoverFocusController(owner)
    this.search = new DiscoverSearchExecutor(owner)
    this.overlay = new DiscoverOverlayController(owner, this.focus)
  }

  // ── Data loading ──

  async loadData(): Promise<void> {
    if (this.owner.isLoadingPage) {
      return
    }
    this.owner.isLoadingPage = true
    try {
      this.owner.theme = this.owner.inheritedTheme
      this.owner.subscribedFeeds = await FeedRepository.default.list()
      this.owner.featuredTrendingFeeds = trendingDiscoverFeedsFromJsonNow()

      this.owner.hasLoaded = true
      this.owner.onReady()
      void this.search.hydrateAvatarsForCandidates(this.search.featuredFeedCandidates())
    } finally {
      this.owner.isLoadingPage = false
    }
  }

  async refreshSubscribedFeeds(): Promise<void> {
    this.owner.subscribedFeeds = await FeedRepository.default.list()
  }

  // ── Cross-cutting signals ──

  handleFeedsChanged(): void {
    void this.refreshSubscribedFeeds()
  }

  handleNavigationResetSignal(): void {
    this.focus.dismissSearchFocus('navigation-reset')
    this.search.resetSearchState()
    this.overlay.resetToRoot()
  }

  // ── Focus delegates ──

  preventAutoKeyboardPopup(source: string = 'unknown'): void { this.focus.preventAutoKeyboardPopup(source) }
  handleSearchDismissSignal(): void { this.focus.handleSearchDismissSignal() }
  onInputTouchDown(): void { this.focus.onInputTouchDown() }
  onInputClick(): void { this.focus.onInputClick() }
  onInputFocus(): void { this.focus.onInputFocus() }
  onInputBlur(): void { this.focus.onInputBlur() }
  onChipTouch(isDown: boolean): void { this.focus.onChipTouch(isDown) }

  // ── Search delegates ──

  onQueryChange(value: string): void { this.search.onQueryChange(value) }
  onClearQuery(): void { this.search.onClearQuery() }
  handlePlatformSwitch(platform: DiscoverSearchPlatform): Promise<void> {
    return this.search.handlePlatformSwitch(platform)
  }

  // ── Overlay delegates ──

  handleDiscoverOverlayLevelChanged(currentOverlayLevel: number): void {
    this.overlay.handleDiscoverOverlayLevelChanged(currentOverlayLevel)
  }
  handleOverlayBackSignal(): void { this.overlay.consumeOverlayBack() }
  settleDiscoverRootVisible(): void { this.overlay.settleDiscoverRootVisible() }

  openBrowsePage(view: FeedViewType, title: string, sourceKey: string = ''): void {
    this.overlay.openBrowsePage(view, title, sourceKey)
  }
  openDirectUrlResult(result: DirectUrlResult): void { this.overlay.openDirectUrlResult(result) }
  openCandidate(candidate: ResolvedDiscoverCandidate): void { this.overlay.openCandidate(candidate) }
  openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate, restoreOverlayLevel: number = 0): void {
    this.overlay.openSubscribeConfigPage(candidate, restoreOverlayLevel)
  }

  onBrowseBack(): void { this.overlay.onBrowseBack() }
  onBrowseOpenPreview(feed: RecommendedFeed): void { this.overlay.onBrowseOpenPreview(feed) }
  onBrowseOpenSubscribeConfig(feed: RecommendedFeed): void { this.overlay.onBrowseOpenSubscribeConfig(feed) }

  onPreviewBack(): void { this.overlay.onPreviewBack() }
  onPreviewEdit(feed: Feed): void { this.overlay.onPreviewEdit(feed) }
  onPreviewSubscribe(payload: FeedRefreshPayload): void { this.overlay.onPreviewSubscribe(payload) }

  onSubscribeConfigBack(): void { this.overlay.onSubscribeConfigBack() }
  onSubscribeConfigSubscribed(): void { this.overlay.onSubscribeConfigSubscribed() }
  onSubscribeConfigSaved(): void { this.overlay.onSubscribeConfigSaved() }
  onSubscribeConfigUnsubscribed(): void { this.overlay.onSubscribeConfigUnsubscribed() }
}
