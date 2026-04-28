import { AppRepository } from '../data/AppRepository'
import { builtinDiscoverInsGroups, InsGroupFeed, DiscoverBuiltinFeedSeed, resolveDescription } from '../data/DiscoverBuiltinFeeds'
import { openArticleDetail } from '../navigation/AppRouter'
import { AvatarTile } from './AvatarTile'
import { BottomTabs } from './BottomTabs'
import { FeedSubscribeConfigView } from './FeedSubscribeConfigView'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import {
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import { Entry, Feed, FeedViewType, formatPublishedAt, toArticleDetailModel } from '../models/LivoModels'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import {
  discoverPlatformLabel,
  discoverViewLabel,
  DiscoverSearchPlatform,
  filteredRecommendedFeeds,
  normalizeDiscoverInput,
  preferredViewForPlatform,
  RecommendedFeed,
  resolveKeywordCandidatesByPlatform,
  resolveProfileCandidatesByPlatform,
  ResolvedDiscoverCandidate,
  searchedRecommendedFeedsByPlatform,
  trendingDiscoverFeeds,
  trendingDiscoverFeedsFromJson,
  trendingDiscoverFeedsFromJsonNow,
} from '../services/DiscoverService'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { AppPreferenceService, DiscoverAvatarCacheEntry } from '../services/AppPreferenceService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import {
  resolveDiscoverOverlayLevelAfterDestinationDisappear,
  resolveDiscoverOverlayReturnLevel,
  shouldApplyDiscoverOverlayAfterDestinationAppear,
  shouldSkipDiscoverOverlayRestoreAfterRootVisible,
  shouldShowDiscoverForegroundOverlay,
} from '../utils/DiscoverNavigationPolicy'
import {
  initialDiscoverBrowseVisibleCount,
  nextDiscoverBrowseVisibleCount,
  shouldPreloadDiscoverBrowseMore,
} from '../utils/DiscoverBrowsePagination'
import { FeedDetailView } from './FeedDetailView'
import { extractInstagramUsername, extractXUsername } from '../utils/SocialFeedTitles'
import {
  discoverAvatarCacheKey,
  discoverAvatarCacheKeys,
  isDiscoverAvatarCacheableImageUrl,
  isDiscoverAvatarPlaceholderUrl,
  resolveDiscoverAvatarImageUrl,
} from '../utils/DiscoverAvatarPresentation'
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

const DISCOVER_ROUTE_PREVIEW: string = 'discover-preview'
const DISCOVER_ROUTE_SUBSCRIBE_CONFIG: string = 'discover-subscribe-config'
const DISCOVER_ROUTE_BROWSE: string = 'discover-browse'
const DISCOVER_ROUTE_ENTRY_DETAIL: string = 'entry-detail'
const HEADER_BLUR_SCROLL_RANGE: number = 72
const DISCOVER_TITLE_BAR_MINI_HEIGHT: number = 56
const DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const DISCOVER_TITLE_BAR_OVERLAY_SPACER: number =
  DISCOVER_TITLE_BAR_MINI_HEIGHT + DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
const DISCOVER_SEARCH_INPUT_ID: string = 'discover-search-input'

interface DirectUrlResult {
  targetUrl: string
  siteUrl: string
  title: string
  description: string
}

class DiscoverFlowRouteParams {
  targetUrl: string = ''
  targetTitle: string = ''
  targetView: FeedViewType = FeedViewType.Articles
  siteUrl: string = ''
  imageUrl: string = ''
  description: string = ''
  sourceKind: string = ''
  category: string = ''
  restoreOverlayLevel: number = 0
}

class EntryDetailParams {
  entry: Entry | undefined = undefined
  feedTitle: string = ''
  feedImageUrl: string = ''
}

class DiscoverBrowseRouteParams {
  view: FeedViewType = FeedViewType.Articles
  title: string = ''
  sourceKey: string = ''
  restoreOverlayLevel: number = 0
}

interface ConfigOption {
  view: FeedViewType
  label: string
  description: string
}

interface DiscoverCategoryCard {
  id: string
  view: FeedViewType
  label: string
  accent: string
  sourceKey?: string
  icon?: Resource
}

interface DiscoverBrowseAvatarHydrationTask {
  key: string
  title: string
  targetUrl: string
  siteUrl: string
  imageUrl: string
  currentImageUrl: string
}

function createDiscoverResultFromFeed(feed: RecommendedFeed): ResolvedDiscoverCandidate {
  return {
    targetUrl: feed.url,
    targetTitle: feed.title,
    targetView: feed.view,
    description: feed.description,
    siteUrl: feed.siteUrl,
    sourceKind: '推荐',
    imageUrl: feed.imageUrl || '',
    followers: feed.followers || '',
  }
}

function isBilibiliDiscoverTarget(targetUrl: string, siteUrl: string): boolean {
  const normalizedTargetUrl = targetUrl.toLowerCase()
  const normalizedSiteUrl = siteUrl.toLowerCase()
  return normalizedTargetUrl.includes('/bilibili/')
    || normalizedSiteUrl.includes('space.bilibili.com')
    || normalizedSiteUrl.includes('bilibili.com')
}

function resolveDiscoverDefaultTargetView(targetUrl: string, siteUrl: string, targetView: FeedViewType): FeedViewType {
  if (isBilibiliDiscoverTarget(targetUrl, siteUrl)) {
    return FeedViewType.Videos
  }
  return targetView
}

function createDiscoverFlowRouteParams(
  targetUrl: string,
  targetTitle: string,
  targetView: FeedViewType,
  siteUrl: string,
  imageUrl: string,
  description: string,
  sourceKind: string,
  category: string,
  restoreOverlayLevel: number = 0,
): DiscoverFlowRouteParams {
  const params = new DiscoverFlowRouteParams()
  params.targetUrl = targetUrl
  params.targetTitle = targetTitle
  params.targetView = resolveDiscoverDefaultTargetView(targetUrl, siteUrl, targetView)
  params.siteUrl = siteUrl
  params.imageUrl = imageUrl
  params.description = description
  params.sourceKind = sourceKind
  params.category = category
  params.restoreOverlayLevel = restoreOverlayLevel
  return params
}

function normalizeDiscoverFlowRouteParams(params?: DiscoverFlowRouteParams): DiscoverFlowRouteParams {
  if (params) {
    return params
  }

  return new DiscoverFlowRouteParams()
}

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
  @Prop showBottomTabs: boolean = true
  @Prop reserveBottomTabInset: boolean = false
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @StorageProp('discoverOverlayLevel') @Watch('handleDiscoverOverlayLevelChanged') discoverOverlayLevel: number = 0
  @StorageProp('discoverNavigationResetAt') @Watch('handleNavigationResetSignal') discoverNavigationResetAt: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @StorageProp('discoverSearchDismissAt') @Watch('handleSearchDismissSignal') discoverSearchDismissAt: number = 0
  @Provide('DiscoverNavPathStack') discoverPathStack: NavPathStack = new NavPathStack()
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

  private rootEnterTransition(delay: number): TransitionEffect {
    return this.showBottomTabs ? livoMotion.enterSoft(delay) : TransitionEffect.IDENTITY
  }

  @Builder
  private DiscoverLowerTitleBuilder() {
    Row() {
      Text('发现')
        .fontSize(30)
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
    if (this.discoverOverlayLevel <= this.overlayLevel) {
      this.overlayLevel = this.discoverOverlayLevel
      if (this.overlayLevel === 0) {
        AppStorage.setOrCreate('discoverRootVisibleSince', Date.now())
      }
      AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(this.overlayLevel))
      return
    }

    const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
    if (shouldApplyDiscoverOverlayAfterDestinationAppear(rootVisibleSince)) {
      this.overlayLevel = this.discoverOverlayLevel
      AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(this.overlayLevel))
      return
    }

    // 根页已可见后出现的升高值来自晚到的子页生命周期回调，必须回写当前根页状态。
    AppStorage.setOrCreate('discoverOverlayLevel', this.overlayLevel)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(this.overlayLevel))
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
    this.syncRootOverlayLevel(0)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
    this.discoverPathStack.clear()
  }

  private discoverFeaturedFeeds(): RecommendedFeed[] {
    return this.featuredTrendingFeeds
      .slice(0, 7)
  }

  private discoverCategoryCards(): DiscoverCategoryCard[] {
    return [
      {
        id: 'articles',
        view: FeedViewType.Articles,
        label: '文章',
        accent: '#2563EB',
      },
      {
        id: 'social',
        view: FeedViewType.SocialMedia,
        label: '社交',
        accent: '#0F766E',
      },
      {
        id: 'pictures',
        view: FeedViewType.Pictures,
        label: '图片',
        accent: '#DB2777',
      },
      {
        id: 'videos',
        view: FeedViewType.Videos,
        label: '视频',
        accent: '#F97316',
      },
      {
        id: 'ai',
        view: FeedViewType.Articles,
        label: 'AI',
        accent: '#6C63FF',
        sourceKey: 'ai',
        icon: $r('app.media.HugeiconsAiCloud01'),
      },
      {
        id: 'ins-2',
        view: FeedViewType.Pictures,
        label: 'Ins',
        accent: '#C13584',
        sourceKey: 'ins',
        icon: $r('app.media.account_instagram'),
      },
      {
        id: 'ins-3',
        view: FeedViewType.Pictures,
        label: 'Ins',
        accent: '#C13584',
        sourceKey: 'ins',
        icon: $r('app.media.account_instagram'),
      },
      {
        id: 'ins-4',
        view: FeedViewType.Pictures,
        label: 'Ins',
        accent: '#C13584',
        sourceKey: 'ins',
        icon: $r('app.media.account_instagram'),
      },
    ]
  }

  private openBrowsePage(view: FeedViewType, title: string, sourceKey: string = ''): void {
    this.scheduleOverlayNavigation(() => {
      const params = new DiscoverBrowseRouteParams()
      params.view = view
      params.title = title
      params.sourceKey = sourceKey
      params.restoreOverlayLevel = resolveDiscoverOverlayReturnLevel('root')
      this.discoverPathStack.pushPathByName(DISCOVER_ROUTE_BROWSE, params, true)
    })
  }

  private categoryCardSymbol(view: FeedViewType): Resource {
    if (view === FeedViewType.SocialMedia) {
      return $r('sys.symbol.ellipsis_bubble')
    }
    if (view === FeedViewType.Pictures) {
      return $r('sys.symbol.picture_2')
    }
    if (view === FeedViewType.Videos) {
      return $r('sys.symbol.media_center')
    }
    return $r('sys.symbol.doc_text')
  }

  private validateInputUrl(targetUrl: string): boolean {
    return /^https?:\/\/\S+$/i.test(targetUrl)
  }

  private hostOf(url: string): string {
    const matched = url.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private directUrlResult(): DirectUrlResult | undefined {
    const normalized = normalizeDiscoverInput(this.query)
    if (!this.validateInputUrl(normalized)) {
      return undefined
    }

    const host = this.hostOf(normalized)
    return {
      targetUrl: normalized,
      siteUrl: host ? `https://${host}` : normalized,
      title: host || normalized,
      description: '直接使用这个地址进入订阅预览，并在下一页校验内容。',
    }
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
    AppStorage.setOrCreate('discoverRootVisibleSince', 0)
    this.syncRootOverlayLevel(1)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
    action()
  }

  private syncRootOverlayLevel(level: number): void {
    this.overlayLevel = level
    AppStorage.setOrCreate('discoverOverlayLevel', level)
  }

  private settleDiscoverRootVisible(): void {
    // 根视图已经重新成为可见页面时，导航栈中不再有发现页前景覆盖层。
    // 这里必须主动清零，避免子页面 onDisAppear 与根视图 onAppear 的回调顺序
    // 让旧的 overlay level 短暂保留下来，导致页头和底部栏闪烁或延迟出现。
    AppStorage.setOrCreate('discoverRootVisibleSince', Date.now())
    this.syncRootOverlayLevel(0)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
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

  private normalizeFeedIdentity(value: string): string {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return ''
    }

    return normalized
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
  }

  private pushIdentityKey(keys: string[], value: string): void {
    const trimmed = value.trim()
    if (!trimmed || keys.includes(trimmed)) {
      return
    }
    keys.push(trimmed)
  }

  private extractBilibiliIdentity(value: string): string {
    const matched = value.match(/\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i)
    return matched?.[1]?.trim() ? `bilibili:${matched[1].trim()}` : ''
  }

  private extractYouTubeIdentity(value: string): string {
    const channelId = value.match(/[?&]channel_id=([^&]+)/i)?.[1]
      || value.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1]
      || value.match(/\/channel\/([^/?#]+)/i)?.[1]
    if (channelId?.trim()) {
      return `youtube:channel:${decodeURIComponent(channelId).trim().toLowerCase()}`
    }

    const handle = value.match(/\/youtube\/user\/(@[^/?#]+)/i)?.[1]
      || value.match(/\/(@[^/?#]+)/i)?.[1]
    if (handle?.trim()) {
      return `youtube:handle:${decodeURIComponent(handle).trim().replace(/^@/, '').toLowerCase()}`
    }

    const user = value.match(/\/youtube\/user\/([^/?#]+)/i)?.[1]
      || value.match(/\/(?:user|c)\/([^/?#]+)/i)?.[1]
    if (user?.trim()) {
      return `youtube:user:${decodeURIComponent(user).trim().toLowerCase()}`
    }

    return ''
  }

  private extractCanonicalFeedIdentity(primaryUrl: string, secondaryUrl: string): string {
    const xUsername = extractXUsername(primaryUrl) || extractXUsername(secondaryUrl)
    if (xUsername) {
      return `x:${xUsername}`
    }

    const instagramUsername = extractInstagramUsername(primaryUrl) || extractInstagramUsername(secondaryUrl)
    if (instagramUsername) {
      return `instagram:${instagramUsername}`
    }

    const bilibiliIdentity = this.extractBilibiliIdentity(primaryUrl) || this.extractBilibiliIdentity(secondaryUrl)
    if (bilibiliIdentity) {
      return bilibiliIdentity
    }

    const youTubeIdentity = this.extractYouTubeIdentity(primaryUrl) || this.extractYouTubeIdentity(secondaryUrl)
    if (youTubeIdentity) {
      return youTubeIdentity
    }

    return ''
  }

  private collectFeedIdentityKeys(url: string, siteUrl: string, title: string): string[] {
    const keys: string[] = []
    const normalizedUrl = this.normalizeFeedIdentity(url)
    const normalizedSiteUrl = this.normalizeFeedIdentity(siteUrl)
    const normalizedTitle = title.trim().toLowerCase()
    const canonicalIdentity = this.extractCanonicalFeedIdentity(url, siteUrl)

    this.pushIdentityKey(keys, normalizedUrl)
    this.pushIdentityKey(keys, normalizedSiteUrl)
    this.pushIdentityKey(keys, canonicalIdentity)
    this.pushIdentityKey(keys, normalizedTitle)

    return keys
  }

  private identityKeysOverlap(left: string[], right: string[]): boolean {
    for (const leftKey of left) {
      if (leftKey && right.includes(leftKey)) {
        return true
      }
    }
    return false
  }

  private isSubscribedFeedIdentity(url: string, siteUrl: string, title: string): boolean {
    const candidateKeys = this.collectFeedIdentityKeys(url, siteUrl, title)

    for (const subscribedFeed of this.subscribedFeeds) {
      const subscribedKeys = this.collectFeedIdentityKeys(
        subscribedFeed.url,
        subscribedFeed.siteUrl ?? '',
        subscribedFeed.title,
      )

      if (this.identityKeysOverlap(candidateKeys, subscribedKeys)) {
        return true
      }

      const subscribedUrl = this.normalizeFeedIdentity(subscribedFeed.url)
      const subscribedSiteUrl = this.normalizeFeedIdentity(subscribedFeed.siteUrl ?? '')
      if (
        (candidateKeys.includes(subscribedUrl) && !!subscribedUrl)
        || (candidateKeys.includes(subscribedSiteUrl) && !!subscribedSiteUrl)
      ) {
        return true
      }
    }

    return false
  }

  private isSubscribedRecommendedFeed(feed: RecommendedFeed): boolean {
    return this.isSubscribedFeedIdentity(feed.url, feed.siteUrl, feed.title)
  }

  private isSubscribedCandidate(candidate: ResolvedDiscoverCandidate): boolean {
    return this.isSubscribedFeedIdentity(candidate.targetUrl, candidate.siteUrl, candidate.targetTitle)
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
      this.discoverPathStack.pushPathByName(
        DISCOVER_ROUTE_PREVIEW,
        createDiscoverFlowRouteParams(
          targetUrl,
          targetTitle,
          targetView,
          siteUrl,
          imageUrl,
          description,
          sourceKind,
          category,
          restoreOverlayLevel,
        ),
        true,
      )
    })
  }

  private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate, restoreOverlayLevel: number = 0): void {
    this.scheduleOverlayNavigation(() => {
      this.discoverPathStack.pushPathByName(
        DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
        createDiscoverFlowRouteParams(
          candidate.targetUrl,
          candidate.targetTitle,
          candidate.targetView,
          candidate.siteUrl,
          this.resolvedCandidateAvatarUrl(candidate),
          candidate.description,
          candidate.sourceKind,
          this.resolvedPlatformLabel(candidate),
          restoreOverlayLevel,
        ),
        true,
      )
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
    if (label === 'YouTube') {
      return '#FF3B30'
    }
    if (label === 'Instagram') {
      return '#E1306C'
    }
    if (label === 'Bilibili') {
      return '#00A1D6'
    }
    if (label === 'GitHub') {
      return '#111827'
    }
    if (label === 'X') {
      return '#111111'
    }
    if (label === '官方 RSS') {
      return '#16A34A'
    }
    if (label === 'RSSHub') {
      return '#2563EB'
    }
    if (label === 'Nitter') {
      return '#475569'
    }
    if (label === '关键词') {
      return '#7C3AED'
    }
    if (label === '推荐') {
      return '#F97316'
    }
    if (label === '精选') {
      return '#0EA5E9'
    }
    if (label === '博客') {
      return '#8B5CF6'
    }
    if (label === '科技') {
      return '#2563EB'
    }
    if (label === '开发') {
      return '#0F766E'
    }
    if (label === '社区') {
      return '#D97706'
    }
    if (label === '图文') {
      return '#F59E0B'
    }
    if (label === '摄影') {
      return '#14B8A6'
    }
    if (label === '演讲') {
      return '#7C3AED'
    }
    if (label === '资讯') {
      return '#14A44D'
    }
    return this.theme.accent
  }

  private faviconUrl(siteUrl: string): string {
    const host = this.hostOf(siteUrl)
    return host ? `https://${host}/favicon.ico` : ''
  }

  private isInstagramPlaceholderAvatar(url: string): boolean {
    const normalized = (url || '').trim().toLowerCase()
    if (!normalized) {
      return true
    }

    return normalized.includes('unavatar.io/instagram/')
      || normalized.includes('instagram.com/static/images/ico')
      || normalized.includes('instagram_static/images/ico')
      || normalized.includes('instagram_logo')
      || normalized.includes('instagram-logo')
      || normalized.includes('favicon')
      || normalized.includes('/logo')
  }

  private resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string {
    if (candidate.targetUrl.includes('/youtube/') || candidate.targetUrl.includes('youtube.com/feeds/videos.xml')) {
      return 'YouTube'
    }
    if (candidate.targetUrl.includes('/instagram/')) {
      return 'Instagram'
    }
    if (candidate.targetUrl.includes('/bilibili/')) {
      return 'Bilibili'
    }
    if (candidate.targetUrl.includes('/github/')) {
      return 'GitHub'
    }
    if (candidate.targetUrl.includes('/x/user/') || candidate.targetUrl.includes('/twitter/user/') || candidate.targetUrl.includes('nitter.')) {
      return 'X'
    }
    return this.viewLabel(candidate.targetView)
  }

  private resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string {
    const override = this.avatarOverrideMap.get(this.candidateAvatarCacheKey(candidate)) || ''
    if (override.trim()) {
      return override.trim()
    }

    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      candidate.imageUrl ?? '',
      candidate.targetUrl,
      candidate.siteUrl,
      candidate.targetTitle,
    )
    if (resolvedImageUrl) {
      if (this.resolvedPlatformLabel(candidate) === 'Instagram' && this.isInstagramPlaceholderAvatar(resolvedImageUrl)) {
        return ''
      }
      return resolvedImageUrl
    }

    const platform = this.resolvedPlatformLabel(candidate)
    if (platform === 'GitHub') {
      return 'https://github.githubassets.com/favicons/favicon.svg'
    }
    return this.faviconUrl(candidate.siteUrl)
  }

  private normalizeSiteUrl(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed.replace(/^\/\/+/, '')}`
    }
    return trimmed
  }

  private hostOfAny(primaryUrl: string, secondaryUrl: string): string {
    const primaryHost = this.hostOf(this.normalizeSiteUrl(primaryUrl))
    if (primaryHost) {
      return primaryHost
    }
    return this.hostOf(this.normalizeSiteUrl(secondaryUrl))
  }

  private candidateAvatarFallbackUrls(
    imageUrl: string,
    targetUrl: string,
    siteUrl: string,
    title: string,
  ): string[] {
    const candidates: string[] = []
    const pushCandidate = (value: string): void => {
      const trimmed = (value || '').trim()
      if (!trimmed || candidates.includes(trimmed)) {
        return
      }
      candidates.push(trimmed)
    }

    pushCandidate(imageUrl)

    const normalizedTargetUrl = this.normalizeSiteUrl(targetUrl)
    const normalizedSiteUrl = this.normalizeSiteUrl(siteUrl)
    const host = this.hostOfAny(normalizedSiteUrl, normalizedTargetUrl)

    const xUsername = extractXUsername(normalizedTargetUrl) || extractXUsername(normalizedSiteUrl) || extractXUsername(title || '')
    if (xUsername) {
      pushCandidate(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
    }

    const instagramUsername = extractInstagramUsername(normalizedTargetUrl)
      || extractInstagramUsername(normalizedSiteUrl)
      || extractInstagramUsername(title || '')
    if (instagramUsername) {
      pushCandidate(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`)
    }

    const bilibiliIdentity = this.extractBilibiliIdentity(normalizedTargetUrl) || this.extractBilibiliIdentity(normalizedSiteUrl)
    if (bilibiliIdentity.startsWith('bilibili:')) {
      pushCandidate(`https://unavatar.io/bilibili/${encodeURIComponent(bilibiliIdentity.replace(/^bilibili:/, ''))}?fallback=false`)
    }

    const youtubeIdentity = this.extractYouTubeIdentity(normalizedTargetUrl) || this.extractYouTubeIdentity(normalizedSiteUrl)
    if (youtubeIdentity.startsWith('youtube:channel:')) {
      pushCandidate(`https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:channel:/, ''))}?fallback=false`)
    } else if (youtubeIdentity.startsWith('youtube:handle:')) {
      pushCandidate(`https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:handle:/, ''))}?fallback=false`)
    } else if (youtubeIdentity.startsWith('youtube:user:')) {
      pushCandidate(`https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:user:/, ''))}?fallback=false`)
    }

    if (host) {
      pushCandidate(`https://icons.duckduckgo.com/ip3/${host}.ico`)
      pushCandidate(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
      pushCandidate(`https://${host}/favicon.ico`)
      pushCandidate(`https://www.${host}/favicon.ico`)
    }

    return candidates
  }

  private candidateAvatarCacheKey(candidate: ResolvedDiscoverCandidate): string {
    return `${candidate.targetUrl.trim()}|${candidate.siteUrl.trim()}`
  }

  private shouldHydrateCandidateAvatar(candidate: ResolvedDiscoverCandidate): boolean {
    const platform = this.resolvedPlatformLabel(candidate)
    if (platform !== 'Instagram' && platform !== 'YouTube' && platform !== 'Bilibili') {
      return false
    }

    const currentUrl = this.resolvedCandidateAvatarUrl(candidate).toLowerCase()
    if (!currentUrl) {
      return true
    }

    return currentUrl.includes('unavatar.io/instagram/')
      || currentUrl.includes('unavatar.io/youtube/')
      || currentUrl.includes('unavatar.io/bilibili/')
      || currentUrl.includes('favicon')
      || currentUrl.includes('apple-touch-icon')
      || currentUrl.includes('/logo')
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
        if (platform === 'Instagram' && this.isInstagramPlaceholderAvatar(finalResolved)) {
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
    if (this.discoverCategoryCards().length > 0) {
      Column({ space: 12 }) {
        this.SectionHeader('分类精选', '', false, $r('app.media.MingcuteClassify2Line'))

        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start }) {
          ForEach(this.discoverCategoryCards(), (card: DiscoverCategoryCard) => {
            Row({ space: 8 }) {
              if (card.icon) {
                Image(card.icon)
                  .width(18)
                  .height(18)
                  .objectFit(ImageFit.Contain)
              } else {
                SymbolGlyph(this.categoryCardSymbol(card.view))
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
      .onWillScroll((scrollOffset: number, _scrollSource: ScrollSource, _scrollState: ScrollState) => {
        this.handleHeaderBlurScrollDelta(scrollOffset)
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

  @Builder
  private DiscoverDestinations(name: string, params?: DiscoverFlowRouteParams | DiscoverBrowseRouteParams | EntryDetailParams) {
    if (name === DISCOVER_ROUTE_PREVIEW) {
      NavDestination() {
        DiscoverPreviewDestination({
          targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
          initialTargetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
          initialTargetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
          initialTargetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
          initialTargetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
          targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
          targetView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
          restoreOverlayLevel: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).restoreOverlayLevel,
          theme: this.theme,
        })
      }
      .hideTitleBar(true)
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    } else if (name === DISCOVER_ROUTE_BROWSE) {
      NavDestination() {
        DiscoverBrowseDestination({
          view: (params as DiscoverBrowseRouteParams)?.view ?? FeedViewType.Articles,
          title: (params as DiscoverBrowseRouteParams)?.title ?? '',
          sourceKey: (params as DiscoverBrowseRouteParams)?.sourceKey ?? '',
          restoreOverlayLevel: (params as DiscoverBrowseRouteParams)?.restoreOverlayLevel ?? 0,
          theme: this.theme,
        })
      }
      .hideTitleBar(true)
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    } else if (name === DISCOVER_ROUTE_SUBSCRIBE_CONFIG) {
      NavDestination() {
        DiscoverSubscribeConfigDestination({
          targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
          targetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
          targetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
          targetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
          targetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
          targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
          sourceKind: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).sourceKind,
          initialSelectedView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
          restoreOverlayLevel: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).restoreOverlayLevel,
          theme: this.theme,
        })
      }
      .hideTitleBar(true)
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    } else if (name === DISCOVER_ROUTE_ENTRY_DETAIL) {
      NavDestination() {
        DiscoverEntryDetailDestination({
          entry: (params as EntryDetailParams)?.entry,
          feedTitle: (params as EntryDetailParams)?.feedTitle ?? '',
          feedImageUrl: (params as EntryDetailParams)?.feedImageUrl ?? '',
          theme: this.theme,
        })
      }
      .hideTitleBar(true)
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    }
  }

  build() {
    if (this.showBottomTabs) {
      Navigation(this.discoverPathStack) {
        this.DiscoverRoot()
      }
      .hideToolBar(true)
      .hideTitleBar(true)
      .hideBackButton(true)
      .mode(NavigationMode.Stack)
      .navDestination(this.DiscoverDestinations)
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    } else {
      HdsNavigation() {
        Navigation(this.discoverPathStack) {
          this.DiscoverRoot()
        }
        .hideToolBar(true)
        .hideTitleBar(true)
        .hideBackButton(true)
        .mode(NavigationMode.Stack)
        .navDestination(this.DiscoverDestinations)
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
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

@Component
struct DiscoverSubscribeConfigDestination {
  @Consume('DiscoverNavPathStack') discoverPathStack: NavPathStack
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @Prop targetUrl: string = ''
  @Prop targetTitle: string = ''
  @Prop targetSiteUrl: string = ''
  @Prop targetImageUrl: string = ''
  @Prop targetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop sourceKind: string = ''
  @Prop initialSelectedView: FeedViewType = FeedViewType.Articles
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  private destinationVisibleSince: number = 0

  private settleRootOverlayClosed(): void {
    AppStorage.setOrCreate('discoverRootVisibleSince', Date.now())
    AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
    AppStorage.setOrCreate('discoverOverlayLevel', 0)
  }

  private restoreOverlayAfterConfigClose(): void {
    AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(this.restoreOverlayLevel))
    AppStorage.setOrCreate('discoverOverlayLevel', this.restoreOverlayLevel)
  }

  private restoreOverlayAfterDisappearIfNeeded(): void {
    const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
    if (shouldSkipDiscoverOverlayRestoreAfterRootVisible(this.destinationVisibleSince, rootVisibleSince)) {
      return
    }
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    const nextLevel = resolveDiscoverOverlayLevelAfterDestinationDisappear(currentLevel, this.restoreOverlayLevel)
    AppStorage.setOrCreate('discoverOverlayLevel', nextLevel)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(nextLevel))
  }

  aboutToDisappear(): void {
    this.restoreOverlayAfterDisappearIfNeeded()
  }

  build() {
    FeedSubscribeConfigView({
      targetUrl: this.targetUrl,
      targetTitle: this.targetTitle,
      targetSiteUrl: this.targetSiteUrl,
      targetImageUrl: this.targetImageUrl,
      targetDescription: this.targetDescription,
      targetCategory: this.targetCategory,
      sourceKind: this.sourceKind,
      initialSelectedView: this.initialSelectedView,
      theme: this.theme,
      onBack: () => {
        this.restoreOverlayAfterConfigClose()
        this.discoverPathStack.pop(true)
      },
      onSubscribed: () => {
        AppStorage.setOrCreate('discoverSearchDismissAt', Date.now())
        this.restoreOverlayAfterConfigClose()
        this.discoverPathStack.pop(true)
      },
      onSaved: () => {
        this.restoreOverlayAfterConfigClose()
        this.discoverPathStack.pop(true)
      },
      onUnsubscribed: () => {
        this.discoverPathStack.clear()
        this.settleRootOverlayClosed()
      }
    })
    .onAppear(() => {
      this.destinationVisibleSince = Date.now()
      const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
      if (shouldApplyDiscoverOverlayAfterDestinationAppear(rootVisibleSince)) {
        AppStorage.setOrCreate('discoverRootVisibleSince', 0)
        AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
      }
    })
    .onDisAppear(() => {
      const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
      if (!shouldApplyDiscoverOverlayAfterDestinationAppear(rootVisibleSince)) {
        AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
        return
      }
      const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
      AppStorage.setOrCreate('discoverHasForegroundOverlay', currentLevel > 0)
    })
  }
}

@Component
struct DiscoverBrowseDestination {
  @Consume('DiscoverNavPathStack') discoverPathStack: NavPathStack
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @Prop view: FeedViewType = FeedViewType.Articles
  @Prop title: string = ''
  @Prop sourceKey: string = ''
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State private cachedFeeds: RecommendedFeed[] = []
  @State private insGroups: InsGroupFeed[] = []
  @State private visibleFeedCount: number = 0
  @State private avatarHydrationVersion: number = 0
  @State private persistedAvatarCacheLoaded: boolean = false
  private readonly browseScroller: Scroller = new Scroller()
  private readonly browseAvatarOverrideMap: Map<string, string> = new Map<string, string>()
  private readonly browseAvatarHydratingKeys: Set<string> = new Set<string>()
  private readonly browseAvatarHydrationQueue: DiscoverBrowseAvatarHydrationTask[] = []
  private browseAvatarHydrationRunning: boolean = false
  private browseDestinationActive: boolean = false
  private destinationVisibleSince: number = 0

  aboutToAppear(): void {
    this.destinationVisibleSince = Date.now()
    const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
    if (shouldApplyDiscoverOverlayAfterDestinationAppear(rootVisibleSince)) {
      AppStorage.setOrCreate('discoverRootVisibleSince', 0)
      AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
      AppStorage.setOrCreate('discoverOverlayLevel', 1)
    }
    this.browseDestinationActive = true
    this.cachedFeeds = filteredRecommendedFeeds(this.view, this.sourceKey)
    this.visibleFeedCount = initialDiscoverBrowseVisibleCount(this.cachedFeeds.length)
    if (this.sourceKey === 'ins') {
      this.insGroups = builtinDiscoverInsGroups()
    }
    setTimeout(() => {
      if (this.browseDestinationActive) {
        void this.loadPersistedAvatarCache()
      }
    }, 120)
  }

  private browseFeeds(): RecommendedFeed[] {
    return filteredRecommendedFeeds(this.view, this.sourceKey)
  }

  private visibleBrowseFeeds(): RecommendedFeed[] {
    return this.cachedFeeds.slice(0, this.visibleFeedCount)
  }

  private hasMoreBrowseFeeds(): boolean {
    return this.visibleFeedCount < this.cachedFeeds.length
  }

  private loadMoreBrowseFeeds(): void {
    if (!this.hasMoreBrowseFeeds()) {
      return
    }

    this.visibleFeedCount = nextDiscoverBrowseVisibleCount(this.visibleFeedCount, this.cachedFeeds.length)
  }

  private handleBrowseScrollLoadMore(): void {
    if (!this.hasMoreBrowseFeeds()) {
      return
    }

    const currentOffset = Math.max(0, this.browseScroller.currentOffset().yOffset)
    if (shouldPreloadDiscoverBrowseMore(
      currentOffset,
      this.cachedFeeds.length,
      this.visibleFeedCount,
    )) {
      this.loadMoreBrowseFeeds()
    }
  }

  private browseTitle(): string {
    return this.title || discoverViewLabel(this.view)
  }

  private hostOf(url: string): string {
    const matched = (url || '').match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private normalizeSiteUrl(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed.replace(/^\/\/+/, '')}`
    }
    return trimmed
  }

  private fallbackAvatarCandidates(imageUrl: string, targetUrl: string, siteUrl: string, title: string): string[] {
    const candidates: string[] = []
    const push = (value: string): void => {
      const trimmed = (value || '').trim()
      if (!trimmed || candidates.includes(trimmed)) {
        return
      }
      candidates.push(trimmed)
    }

    push(imageUrl)
    const normalizedTarget = this.normalizeSiteUrl(targetUrl)
    const normalizedSite = this.normalizeSiteUrl(siteUrl)
    const host = this.hostOf(normalizedSite) || this.hostOf(normalizedTarget)

    const xUsername = extractXUsername(normalizedTarget) || extractXUsername(normalizedSite) || extractXUsername(title || '')
    if (xUsername) {
      push(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
    }

    const instagramUsername = extractInstagramUsername(normalizedTarget)
      || extractInstagramUsername(normalizedSite)
      || extractInstagramUsername(title || '')
    if (instagramUsername) {
      push(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`)
    }

    if (host) {
      push(`https://icons.duckduckgo.com/ip3/${host}.ico`)
      push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
      push(`https://${host}/favicon.ico`)
      push(`https://www.${host}/favicon.ico`)
    }

    return candidates
  }

  private cachedPreviewPayloadForFeed(targetUrl: string, siteUrl: string): FeedRefreshPayload | undefined {
    return DiscoverRemoteSearchService.cachedPreviewPayload(targetUrl)
      || DiscoverRemoteSearchService.cachedPreviewPayload(siteUrl)
  }

  private browseAvatarCacheKey(targetUrl: string, siteUrl: string): string {
    return discoverAvatarCacheKey(targetUrl, siteUrl)
  }

  private browseAvatarOverride(targetUrl: string, siteUrl: string): string {
    const keys = discoverAvatarCacheKeys(targetUrl, siteUrl)
    for (const key of keys) {
      const value = this.browseAvatarOverrideMap.get(key)
      if (value) {
        return value
      }
    }
    return ''
  }

  private async loadPersistedAvatarCache(): Promise<void> {
    if (this.persistedAvatarCacheLoaded) {
      return
    }

    try {
      const entries = await AppPreferenceService.loadDiscoverAvatarCache()
      entries.forEach((entry: DiscoverAvatarCacheEntry) => {
        discoverAvatarCacheKeys(entry.targetUrl, entry.siteUrl).forEach((key: string) => {
          this.browseAvatarOverrideMap.set(key, entry.imageUrl)
        })
      })
      this.persistedAvatarCacheLoaded = true
      this.avatarHydrationVersion += 1
    } catch (error) {
      this.persistedAvatarCacheLoaded = true
      console.warn(`load discover avatar cache failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private browseFeedAvatarImageUrl(feed: RecommendedFeed): string {
    const cachedPayload = this.cachedPreviewPayloadForFeed(feed.url, feed.siteUrl)
    return resolveDiscoverAvatarImageUrl({
      imageUrl: feed.imageUrl || '',
      targetUrl: feed.url,
      siteUrl: feed.siteUrl,
      title: feed.title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.browseAvatarOverride(feed.url, feed.siteUrl),
    })
  }

  private insMemberAvatarImageUrl(member: DiscoverBuiltinFeedSeed): string {
    const cachedPayload = this.cachedPreviewPayloadForFeed(member.url, '')
    return resolveDiscoverAvatarImageUrl({
      imageUrl: '',
      targetUrl: member.url,
      siteUrl: '',
      title: member.title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.browseAvatarOverride(member.url, ''),
    })
  }

  private shouldHydrateBrowseAvatar(currentImageUrl: string): boolean {
    return isDiscoverAvatarPlaceholderUrl(currentImageUrl)
  }

  private rememberLoadedBrowseAvatar(targetUrl: string, siteUrl: string, imageUrl: string): void {
    const normalizedImageUrl = (imageUrl || '').trim()
    if (!isDiscoverAvatarCacheableImageUrl(normalizedImageUrl)) {
      return
    }

    discoverAvatarCacheKeys(targetUrl, siteUrl).forEach((key: string) => {
      this.browseAvatarOverrideMap.set(key, normalizedImageUrl)
    })
    void AppPreferenceService.rememberDiscoverAvatar(targetUrl, siteUrl, normalizedImageUrl)
    if (siteUrl) {
      void AppPreferenceService.rememberDiscoverAvatar(targetUrl, '', normalizedImageUrl)
    }
  }

  private rememberBrowseAvatarPayload(targetUrl: string, payload: FeedRefreshPayload, imageUrl: string): void {
    DiscoverRemoteSearchService.rememberPreviewPayload(targetUrl, {
      etag: payload.etag,
      lastModified: payload.lastModified,
      feedTitle: payload.feedTitle,
      siteUrl: payload.siteUrl,
      imageUrl,
      description: payload.description,
      resolvedFeedUrl: payload.resolvedFeedUrl,
      entries: payload.entries,
    })
  }

  private async hydrateBrowseFeedAvatar(
    title: string,
    targetUrl: string,
    siteUrl: string,
    imageUrl: string,
  ): Promise<void> {
    if (!this.browseDestinationActive) {
      return
    }

    const key = this.browseAvatarCacheKey(targetUrl, siteUrl)
    if (this.browseAvatarOverrideMap.has(key) || this.browseAvatarHydratingKeys.has(key)) {
      return
    }

    const cachedPayload = this.cachedPreviewPayloadForFeed(targetUrl, siteUrl)
    const currentImageUrl = resolveDiscoverAvatarImageUrl({
      imageUrl,
      targetUrl,
      siteUrl,
      title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.browseAvatarOverride(targetUrl, siteUrl),
    })
    if (!this.shouldHydrateBrowseAvatar(currentImageUrl)) {
      return
    }

    this.browseAvatarHydratingKeys.add(key)
    this.browseAvatarHydrationQueue.push({
      key,
      title,
      targetUrl,
      siteUrl,
      imageUrl,
      currentImageUrl,
    })
    void this.processBrowseAvatarHydrationQueue()
  }

  private async processBrowseAvatarHydrationQueue(): Promise<void> {
    if (this.browseAvatarHydrationRunning) {
      return
    }

    this.browseAvatarHydrationRunning = true
    try {
      while (this.browseDestinationActive && this.browseAvatarHydrationQueue.length > 0) {
        const task = this.browseAvatarHydrationQueue.shift()
        if (!task) {
          continue
        }
        await this.runBrowseAvatarHydrationTask(task)
      }
    } finally {
      this.browseAvatarHydrationRunning = false
    }
  }

  private async runBrowseAvatarHydrationTask(task: DiscoverBrowseAvatarHydrationTask): Promise<void> {
    try {
      if (!this.browseDestinationActive) {
        return
      }
      const cachedPayload = this.cachedPreviewPayloadForFeed(task.targetUrl, task.siteUrl)
      const payload = cachedPayload || await RssFeedService.previewFeedUrl(task.targetUrl)
      if (!this.browseDestinationActive) {
        return
      }
      const resolvedAvatar = await SocialFeedAvatarService.resolveFeedAvatar(
        payload.resolvedFeedUrl || task.targetUrl,
        payload.siteUrl || task.siteUrl,
        payload.imageUrl || '',
        task.imageUrl || '',
      )
      const hydratedImageUrl = (resolvedAvatar || payload.imageUrl || '').trim()
      if (!hydratedImageUrl) {
        return
      }

      this.rememberBrowseAvatarPayload(task.targetUrl, payload, hydratedImageUrl)
      void AppPreferenceService.rememberDiscoverAvatar(task.targetUrl, task.siteUrl, hydratedImageUrl)
      if (task.siteUrl) {
        void AppPreferenceService.rememberDiscoverAvatar(task.targetUrl, '', hydratedImageUrl)
      }
      const nextImageUrl = resolveDiscoverAvatarImageUrl({
        imageUrl: task.imageUrl,
        targetUrl: task.targetUrl,
        siteUrl: task.siteUrl,
        title: task.title,
        cachedImageUrl: hydratedImageUrl,
        cachedSiteUrl: payload.siteUrl || '',
        cachedTitle: payload.feedTitle || '',
        cachedResolvedFeedUrl: payload.resolvedFeedUrl || '',
      })
      if (nextImageUrl && nextImageUrl !== task.currentImageUrl) {
        discoverAvatarCacheKeys(task.targetUrl, task.siteUrl).forEach((key: string) => {
          this.browseAvatarOverrideMap.set(key, hydratedImageUrl)
        })
        this.avatarHydrationVersion += 1
      }
    } catch (error) {
      console.warn(`hydrate discover browse avatar failed: ${task.targetUrl} ${error instanceof Error ? error.message : error}`)
    } finally {
      this.browseAvatarHydratingKeys.delete(task.key)
    }
  }

  private restoreOverlayAfterDisappearIfNeeded(): void {
    const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
    if (shouldSkipDiscoverOverlayRestoreAfterRootVisible(this.destinationVisibleSince, rootVisibleSince)) {
      return
    }
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    const nextLevel = resolveDiscoverOverlayLevelAfterDestinationDisappear(currentLevel, this.restoreOverlayLevel)
    AppStorage.setOrCreate('discoverOverlayLevel', nextLevel)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(nextLevel))
  }

  private stopBrowseAvatarHydration(): void {
    this.browseDestinationActive = false
    this.browseAvatarHydrationQueue.splice(0, this.browseAvatarHydrationQueue.length)
    this.browseAvatarHydratingKeys.clear()
  }

  aboutToDisappear(): void {
    this.stopBrowseAvatarHydration()
    this.restoreOverlayAfterDisappearIfNeeded()
  }

  private openPreviewPage(feed: RecommendedFeed): void {
    const result = createDiscoverResultFromFeed(feed)
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_PREVIEW,
      createDiscoverFlowRouteParams(
        result.targetUrl,
        result.targetTitle,
        result.targetView,
        result.siteUrl,
        result.imageUrl || '',
        result.description,
        result.sourceKind,
        feed.category || '',
        resolveDiscoverOverlayReturnLevel('browse'),
      ),
      true,
    )
  }

  private openSubscribeConfigPage(feed: RecommendedFeed): void {
    const result = createDiscoverResultFromFeed(feed)
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        result.targetUrl,
        result.targetTitle,
        result.targetView,
        result.siteUrl,
        result.imageUrl || '',
        result.description,
        result.sourceKind,
        feed.category || '',
        resolveDiscoverOverlayReturnLevel('browse'),
      ),
      true,
    )
  }

  @Builder
  private FeedRow(feed: RecommendedFeed, showDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 10 }) {
        AvatarTile({
          imageUrl: this.browseFeedAvatarImageUrl(feed),
          fallbackImageUrls: this.fallbackAvatarCandidates(
            this.browseFeedAvatarImageUrl(feed),
            feed.url,
            feed.siteUrl,
            feed.title,
          ),
          refreshToken: this.discoverOverlayLevel + this.avatarHydrationVersion,
          fallbackLabel: feed.title,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 8,
          textSize: 11,
          useAccentFallback: true,
          onImageLoaded: (url: string) => {
            this.rememberLoadedBrowseAvatar(feed.url, feed.siteUrl, url)
          },
        })

        Column({ space: 6 }) {
          Text(feed.title)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (feed.description.trim()) {
            Text(feed.description.trim())
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          } else if (feed.followers) {
            Text(feed.followers)
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height(feed.description.trim() ? 56 : 46)
      .padding({ left: 14, right: 14, top: 6, bottom: 6 })
      .backgroundColor('transparent')
      .onClick(() => {
        this.openPreviewPage(feed)
      })
      .onAppear(() => {
        setTimeout(() => {
          if (this.browseDestinationActive) {
            void this.hydrateBrowseFeedAvatar(feed.title, feed.url, feed.siteUrl, feed.imageUrl || '')
          }
        }, 520)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 14 })
      }
    }
    .width('100%')
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.browseTitle(),
        theme: this.theme,
        showBackButton: true,
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => {
          this.stopBrowseAvatarHydration()
          AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
          AppStorage.setOrCreate('discoverOverlayLevel', 0)
          this.discoverPathStack.pop(true)
        },
      })
        .width('100%')
    }
  }

  @Builder
  private InsFeedRow(member: DiscoverBuiltinFeedSeed, showDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 10 }) {
        AvatarTile({
          imageUrl: this.insMemberAvatarImageUrl(member),
          fallbackImageUrls: this.fallbackAvatarCandidates(
            this.insMemberAvatarImageUrl(member),
            member.url,
            '',
            member.title,
          ),
          refreshToken: this.discoverOverlayLevel + this.avatarHydrationVersion,
          fallbackLabel: member.title,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 8,
          textSize: 11,
          useAccentFallback: true,
          onImageLoaded: (url: string) => {
            this.rememberLoadedBrowseAvatar(member.url, '', url)
          },
        })

        Column({ space: 6 }) {
          Text(member.title)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (member.descriptionZh || member.descriptionEn) {
            Text(resolveDescription(member))
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height((member.descriptionZh || member.descriptionEn) ? 56 : 46)
      .padding({ left: 14, right: 14, top: 6, bottom: 6 })
      .backgroundColor('transparent')
      .onClick(() => {
        const feed: RecommendedFeed = {
          title: member.title,
          url: member.url,
          siteUrl: '',
          description: '',
          view: FeedViewType.Pictures,
          category: '内置-Ins',
        }
        this.openPreviewPage(feed)
      })
      .onAppear(() => {
        setTimeout(() => {
          if (this.browseDestinationActive) {
            void this.hydrateBrowseFeedAvatar(member.title, member.url, '', '')
          }
        }, 520)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 14 })
      }
    }
    .width('100%')
  }

  build() {
    Column() {
      this.HeaderSection()

      Scroll(this.browseScroller) {
        Column({ space: 12 }) {
          if (this.sourceKey === 'ins' && this.insGroups.length > 0) {
            ForEach(this.insGroups, (group: InsGroupFeed) => {
              Column({ space: 0 }) {
                Text(group.groupName)
                  .fontSize(14)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textPrimary)
                  .margin({ left: 14, top: 10, bottom: 6 })

                ForEach(group.members, (member: DiscoverBuiltinFeedSeed, index: number) => {
                  this.InsFeedRow(member, index < group.members.length - 1)
                }, (member: DiscoverBuiltinFeedSeed) => `${group.groupName}-${member.url}`)
              }
              .width('100%')
              .backgroundColor(this.theme.surface)
              .borderRadius(18)
              .border({ width: 0.8, color: this.theme.divider })
              .clip(true)
            }, (group: InsGroupFeed) => group.groupName)
          } else {
            Column({ space: 0 }) {
              ForEach(this.visibleBrowseFeeds(), (feed: RecommendedFeed, index: number) => {
                this.FeedRow(feed, index < this.visibleBrowseFeeds().length - 1)
              }, (feed: RecommendedFeed) => `${this.sourceKey || this.view}-${feed.url}`)
              if (this.hasMoreBrowseFeeds()) {
                Row() {
                  Text('继续下滑加载更多')
                    .fontSize(12)
                    .fontColor(this.theme.textMuted)
                }
                .width('100%')
                .height(44)
                .justifyContent(FlexAlign.Center)
              }
            }
            .width('100%')
            .backgroundColor(this.theme.surface)
            .borderRadius(18)
            .border({ width: 0.8, color: this.theme.divider })
            .clip(true)
          }
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 4, bottom: 16 })
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.Start)
        .constraintSize({ minHeight: '100%' })
      }
      .scrollBar(BarState.On)
      .edgeEffect(EdgeEffect.Spring)
      .width('100%')
      .layoutWeight(1)
      .onReachEnd(() => {
        this.loadMoreBrowseFeeds()
      })
      .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
        this.handleBrowseScrollLoadMore()
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onDisAppear(() => {
      this.stopBrowseAvatarHydration()
      this.restoreOverlayAfterDisappearIfNeeded()
    })
  }
}

@Component
struct DiscoverPreviewDestination {
  @Consume('DiscoverNavPathStack') discoverPathStack: NavPathStack
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @Prop targetUrl: string = ''
  @Prop initialTargetTitle: string = ''
  @Prop initialTargetSiteUrl: string = ''
  @Prop initialTargetImageUrl: string = ''
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  private destinationVisibleSince: number = 0

  private restoreOverlayAfterDisappearIfNeeded(): void {
    const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
    if (shouldSkipDiscoverOverlayRestoreAfterRootVisible(this.destinationVisibleSince, rootVisibleSince)) {
      return
    }
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    const nextLevel = resolveDiscoverOverlayLevelAfterDestinationDisappear(currentLevel, this.restoreOverlayLevel)
    AppStorage.setOrCreate('discoverOverlayLevel', nextLevel)
    AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(nextLevel))
  }

  aboutToDisappear(): void {
    this.restoreOverlayAfterDisappearIfNeeded()
  }

  private openEditConfigPage(feed: Feed): void {
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      feed.imageUrl || this.initialTargetImageUrl,
      feed.url || this.targetUrl,
      feed.siteUrl || this.initialTargetSiteUrl,
      feed.title || this.initialTargetTitle,
    )
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        this.targetUrl,
        feed.title,
        feed.view,
        feed.siteUrl || this.initialTargetSiteUrl,
        resolvedImageUrl,
        feed.description || this.initialTargetDescription,
        '编辑',
        feed.category || '',
        resolveDiscoverOverlayReturnLevel('preview'),
      ),
      true,
    )
  }

  private openNewSubscribeConfigPage(payload: FeedRefreshPayload): void {
    DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload)
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      payload.imageUrl || this.initialTargetImageUrl,
      payload.resolvedFeedUrl || this.targetUrl,
      payload.siteUrl || this.initialTargetSiteUrl,
      payload.feedTitle || this.initialTargetTitle,
    )
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        this.targetUrl,
        payload.feedTitle || this.initialTargetTitle,
        this.targetView,
        payload.siteUrl || this.initialTargetSiteUrl,
        resolvedImageUrl,
        payload.description || this.initialTargetDescription,
        '',
        this.targetCategory,
        resolveDiscoverOverlayReturnLevel('preview'),
      ),
      true,
    )
  }

  private openEntryDetail(entry: Entry): void {
    console.info(`[DiscoverPreview] Opening entry: ${entry.title}`)
    // 构造临时 Feed 以复用完整的 HTML 解析逻辑
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
  }

  build() {
    FeedDetailView({
      targetUrl: this.targetUrl,
      initialTargetTitle: this.initialTargetTitle,
      initialTargetSiteUrl: this.initialTargetSiteUrl,
      initialTargetImageUrl: this.initialTargetImageUrl,
      initialTargetDescription: this.initialTargetDescription,
      targetCategory: this.targetCategory,
      targetView: this.targetView,
      theme: this.theme,
      onBack: () => {
        AppStorage.setOrCreate('discoverHasForegroundOverlay', shouldShowDiscoverForegroundOverlay(this.restoreOverlayLevel))
        AppStorage.setOrCreate('discoverOverlayLevel', this.restoreOverlayLevel)
        this.discoverPathStack.pop(true)
      },
      onEdit: (feed: Feed) => { this.openEditConfigPage(feed) },
      onSubscribe: (payload: FeedRefreshPayload) => { this.openNewSubscribeConfigPage(payload) },
      onOpenArticle: (entry: Entry, _feed: Feed) => { this.openEntryDetail(entry) }
    })
    .onAppear(() => {
      this.destinationVisibleSince = Date.now()
      const rootVisibleSince = AppStorage.get<number>('discoverRootVisibleSince') ?? 0
      if (shouldApplyDiscoverOverlayAfterDestinationAppear(rootVisibleSince)) {
        AppStorage.setOrCreate('discoverRootVisibleSince', 0)
        AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
        AppStorage.setOrCreate('discoverOverlayLevel', 2)
      }
    })
    .onDisAppear(() => {
      this.restoreOverlayAfterDisappearIfNeeded()
    })
  }
}




@Component
struct DiscoverEntryDetailDestination {
  @Consume('DiscoverNavPathStack') discoverPathStack: NavPathStack
  @Prop entry?: Entry = undefined
  @Prop feedTitle: string = ''
  @Prop feedImageUrl: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  private publishedLabel(): string {
    return this.entry ? formatPublishedAt(this.entry.publishedAt) : ''
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.feedTitle || '文章详情',
        theme: this.theme,
        showBackButton: true,
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => {
          this.discoverPathStack.pop(true)
        },
      })
        .width('100%')
    }
  }

  @Builder
  private MetaBadge(text: string, active?: boolean) {
    Text(text)
      .fontSize(11)
      .fontWeight(FontWeight.Medium)
      .fontColor(active ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor(active ? this.theme.accent : this.theme.elevated)
      .borderRadius(999)
  }

  build() {
    Column() {
      this.HeaderSection()

      if (this.entry) {
        Scroll() {
          Column({ space: 18 }) {
            Column({ space: 12 }) {

              Text(this.entry!.title)
                .fontSize(28)
                .lineHeight(38)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)
                .width('100%')

              Text(`${this.entry!.author || '未知作者'} · ${this.publishedLabel()}`)
                .fontSize(13)
                .lineHeight(20)
                .fontColor(this.theme.textSecondary)
                .width('100%')
            }
            .width('100%')
            .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 })
            .alignItems(HorizontalAlign.Start)

            Column({ space: 20 }) {
              if (this.entry!.summary) {
                Text(this.entry!.summary)
                  .fontSize(16)
                  .lineHeight(27)
                  .fontColor(this.theme.textSecondary)
                  .fontWeight(FontWeight.Medium)
                  .width('100%')
              }

              if (this.entry!.content) {
                ForEach(this.entry!.content.split('\n\n'), (paragraph: string) => {
                  if (paragraph.trim()) {
                    Text(paragraph)
                      .fontSize(16)
                      .lineHeight(29)
                      .fontColor(this.theme.textPrimary)
                      .width('100%')
                      .textAlign(TextAlign.Start)
                  }
                }, (paragraph: string, index: number) => `${index}-${paragraph}`)
              }

              if (this.entry!.url) {
                Text(`原始来源：${this.entry!.url}`)
                  .fontSize(13)
                  .fontColor(this.theme.textMuted)
                  .width('100%')
              }
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding({ left: 18, right: 18, top: 12, bottom: 22 })
            .margin({ top: 4, bottom: 16 })
          }
          .width('100%')
          .padding({ bottom: 12 })
          .alignItems(HorizontalAlign.Start)
        }
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      } else {
        Column({ space: 12 }) {
          Text('未找到内容')
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('无法加载文章内容')
            .fontSize(15)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
