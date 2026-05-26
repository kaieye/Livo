import {
  DirectUrlResult,
  DiscoverBrowseRouteParams,
  DiscoverConfigReturnTarget,
  DiscoverFlowRouteParams,
  DiscoverOverlayRoute,
  createDiscoverFlowRouteParams,
  createDiscoverResultFromFeed,
} from '../../components/DiscoverTypes'
import { Feed, FeedViewType } from '../../models/LivoModels'
import { DiscoverRemoteSearchService } from '../../services/DiscoverRemoteSearchService'
import { DiscoverSearchPlatform, RecommendedFeed, ResolvedDiscoverCandidate } from '../../services/discover/DiscoverTypes'
import { discoverPlatformLabel, preferredViewForPlatform } from '../../services/discover/DiscoverLabels'
import { FeedRefreshPayload } from '../../services/RssFeedService'
import { resolveDiscoverOverlayReturnLevel } from './DiscoverNavigationPolicy'
import { resolveSocialFeedDisplayImageUrl } from '../../utils/social/SocialFeedPresentation'
import { DiscoverFocusController } from './DiscoverFocusController'
import {
  discoverHasForegroundOverlay,
  discoverOverlayLevel,
  discoverRootVisibleSince,
  discoverSearchDismissAt,
} from '../../utils/AppSignals'

export interface DiscoverOverlayOwner {
  searchPlatform: DiscoverSearchPlatform
  overlayLevel: number
  activeOverlayRoute: DiscoverOverlayRoute
  activeBrowseParams?: DiscoverBrowseRouteParams
  activePreviewParams?: DiscoverFlowRouteParams
  activeSubscribeConfigParams?: DiscoverFlowRouteParams
  subscribeConfigReturnTarget: DiscoverConfigReturnTarget

  resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string
  resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string
}

export class DiscoverOverlayController {
  private readonly owner: DiscoverOverlayOwner
  private readonly focus: DiscoverFocusController

  constructor(owner: DiscoverOverlayOwner, focus: DiscoverFocusController) {
    this.owner = owner
    this.focus = focus
  }

  // ── Route bookkeeping ──

  private syncRoute(route: DiscoverOverlayRoute, level: number): void {
    this.owner.activeOverlayRoute = route
    this.owner.overlayLevel = level
    discoverOverlayLevel.write(level)
    discoverHasForegroundOverlay.write(level > 0)
  }

  private scheduleNavigation(action: () => void): void {
    this.focus.dismissSearchFocus('overlay-navigation')
    action()
    discoverHasForegroundOverlay.write(this.owner.overlayLevel > 0)
  }

  private resetOverlayToRoot(): void {
    this.owner.activeBrowseParams = undefined
    this.owner.activePreviewParams = undefined
    this.owner.activeSubscribeConfigParams = undefined
    this.syncRoute('none', 0)
  }

  private closeSubscribeConfigToTarget(): void {
    this.owner.activeSubscribeConfigParams = undefined
    if (this.owner.subscribeConfigReturnTarget === 'preview' && this.owner.activePreviewParams) {
      this.syncRoute('preview', 2)
      return
    }
    if (this.owner.subscribeConfigReturnTarget === 'browse' && this.owner.activeBrowseParams) {
      this.syncRoute('browse', 1)
      return
    }
    this.resetOverlayToRoot()
  }

  private openSubscribeConfigFromPreview(
    title: string,
    view: FeedViewType,
    siteUrl: string,
    imageUrl: string,
    description: string,
    sourceKind: string,
    category: string,
    feedUrl: string,
  ): void {
    const preview = this.owner.activePreviewParams
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      imageUrl || preview?.imageUrl || '',
      feedUrl || preview?.targetUrl || '',
      siteUrl || preview?.siteUrl || '',
      title || preview?.targetTitle || '',
    )
    this.owner.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
      preview?.targetUrl || '',
      title || preview?.targetTitle || '',
      view,
      siteUrl || preview?.siteUrl || '',
      resolvedImageUrl,
      description || preview?.description || '',
      sourceKind,
      category || preview?.category || '',
      1,
    )
    this.owner.subscribeConfigReturnTarget = 'preview'
    this.syncRoute('subscribe-config', 2)
  }

  // ── Lifecycle / signals ──

  settleDiscoverRootVisible(): void {
    discoverRootVisibleSince.write(Date.now())
    if (this.owner.activeOverlayRoute === 'none') {
      this.syncRoute('none', 0)
    }
  }

  handleDiscoverOverlayLevelChanged(currentOverlayLevel: number): void {
    if (currentOverlayLevel < this.owner.overlayLevel) {
      this.owner.overlayLevel = currentOverlayLevel
    }
  }

  resetToRoot(): void {
    this.resetOverlayToRoot()
  }

  consumeOverlayBack(): boolean {
    if (this.owner.activeSubscribeConfigParams) {
      this.closeSubscribeConfigToTarget()
      return true
    }

    if (this.owner.activePreviewParams) {
      this.owner.activePreviewParams = undefined
      if (this.owner.activeBrowseParams) {
        this.syncRoute('browse', 1)
      } else {
        this.syncRoute('none', 0)
      }
      return true
    }

    if (this.owner.activeBrowseParams) {
      this.resetOverlayToRoot()
      return true
    }

    if (this.owner.overlayLevel > 0) {
      this.syncRoute('none', 0)
      return true
    }

    return false
  }

  // ── Open actions ──

  openBrowsePage(view: FeedViewType, title: string, sourceKey: string = ''): void {
    this.scheduleNavigation(() => {
      const params = new DiscoverBrowseRouteParams()
      params.view = view
      params.title = title
      params.sourceKey = sourceKey
      params.restoreOverlayLevel = 0
      this.owner.activeBrowseParams = params
      this.owner.activePreviewParams = undefined
      this.owner.activeSubscribeConfigParams = undefined
      this.owner.subscribeConfigReturnTarget = 'root'
      this.syncRoute('browse', 1)
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
    this.scheduleNavigation(() => {
      this.owner.activePreviewParams = createDiscoverFlowRouteParams(
        targetUrl, targetTitle, targetView, siteUrl, imageUrl, description, sourceKind, category, restoreOverlayLevel,
      )
      this.owner.activeSubscribeConfigParams = undefined
      this.owner.subscribeConfigReturnTarget = restoreOverlayLevel > 0 ? 'browse' : 'root'
      this.syncRoute('preview', restoreOverlayLevel > 0 ? 2 : 1)
    })
  }

  openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate, restoreOverlayLevel: number = 0): void {
    this.scheduleNavigation(() => {
      this.owner.activeSubscribeConfigParams = createDiscoverFlowRouteParams(
        candidate.targetUrl, candidate.targetTitle, candidate.targetView, candidate.siteUrl,
        this.owner.resolvedCandidateAvatarUrl(candidate), candidate.description, candidate.sourceKind,
        this.owner.resolvedPlatformLabel(candidate), restoreOverlayLevel,
      )
      this.owner.subscribeConfigReturnTarget = restoreOverlayLevel > 0 ? 'browse' : (this.owner.activePreviewParams ? 'preview' : 'root')
      this.syncRoute('subscribe-config', restoreOverlayLevel > 0 ? 2 : 1)
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
    this.resetOverlayToRoot()
  }

  onBrowseOpenPreview(feed: RecommendedFeed): void {
    const result = createDiscoverResultFromFeed(feed)
    const imageUrl: string = result.imageUrl || ''
    const category: string = feed.category || ''
    this.owner.activePreviewParams = createDiscoverFlowRouteParams(
      result.targetUrl, result.targetTitle, result.targetView, result.siteUrl,
      imageUrl, result.description, result.sourceKind, category, 1,
    )
    this.syncRoute('preview', 2)
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
    this.syncRoute('subscribe-config', 2)
  }

  // ── Preview overlay callbacks ──

  onPreviewBack(): void {
    this.owner.activePreviewParams = undefined
    if (this.owner.activeBrowseParams) {
      this.syncRoute('browse', 1)
      return
    }
    this.syncRoute('none', 0)
  }

  onPreviewEdit(feed: Feed): void {
    this.openSubscribeConfigFromPreview(
      feed.title, feed.view, feed.siteUrl || '', feed.imageUrl || '',
      feed.description || '', '编辑', feed.category || '', feed.url || '',
    )
  }

  onPreviewSubscribe(payload: FeedRefreshPayload): void {
    const preview = this.owner.activePreviewParams
    DiscoverRemoteSearchService.rememberPreviewPayload(preview?.targetUrl || '', payload)
    this.openSubscribeConfigFromPreview(
      payload.feedTitle || '',
      preview?.targetView || FeedViewType.Articles,
      payload.siteUrl || '', payload.imageUrl || '',
      payload.description || '', '', '', payload.resolvedFeedUrl || '',
    )
  }

  // ── Subscribe-config callbacks ──

  onSubscribeConfigBack(): void {
    this.closeSubscribeConfigToTarget()
  }

  onSubscribeConfigSubscribed(): void {
    discoverSearchDismissAt.write(Date.now())
    this.closeSubscribeConfigToTarget()
  }

  onSubscribeConfigSaved(): void {
    this.closeSubscribeConfigToTarget()
  }

  onSubscribeConfigUnsubscribed(): void {
    this.resetOverlayToRoot()
  }
}
