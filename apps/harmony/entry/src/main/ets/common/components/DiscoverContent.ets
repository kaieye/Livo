import { AppRepository } from '../data/AppRepository'
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
  filteredRecommendedFeedsByPlatform,
  normalizeDiscoverInput,
  preferredViewForPlatform,
  RecommendedFeed,
  resolveKeywordCandidatesByPlatform,
  resolveProfileCandidatesByPlatform,
  ResolvedDiscoverCandidate,
  searchedRecommendedFeedsByPlatform,
} from '../services/DiscoverService'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { FeedDetailView } from './FeedDetailView'
import { extractInstagramUsername, extractXUsername } from '../utils/SocialFeedTitles'
import { resolveSocialFeedDisplayImageUrl } from '../utils/SocialFeedPresentation'
import {
  CARD_RADIUS_LG,
  CARD_RADIUS_MD,
  CARD_RADIUS_SM,
  CHIP_FONT_SIZE,
  CHIP_RADIUS,
  INPUT_RADIUS,
  LIST_ACTION_HEIGHT,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_META_SIZE,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
  META_FONT_SIZE,
  PAGE_BOTTOM_GAP,
  PAGE_HORIZONTAL_PADDING,
  PAGE_TOP_PADDING,
  SECTION_TITLE_FONT_SIZE,
  BOTTOM_TAB_FLOAT_GAP,
  BOTTOM_TAB_TOTAL_HEIGHT,
} from '../ui/UiTokens'

const DISCOVER_ROUTE_PREVIEW: string = 'discover-preview'
const DISCOVER_ROUTE_SUBSCRIBE_CONFIG: string = 'discover-subscribe-config'
const DISCOVER_ROUTE_ENTRY_DETAIL: string = 'entry-detail'
const HEADER_BLUR_SCROLL_RANGE: number = 72
const DISCOVER_TITLE_BAR_MINI_HEIGHT: number = 56
const DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const DISCOVER_TITLE_BAR_OVERLAY_SPACER: number =
  DISCOVER_TITLE_BAR_MINI_HEIGHT + DISCOVER_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET

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
}

class EntryDetailParams {
  entry: Entry | undefined = undefined
  feedTitle: string = ''
  feedImageUrl: string = ''
}

interface ConfigOption {
  view: FeedViewType
  label: string
  description: string
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
  @State hasLoaded: boolean = false
  @State isLoadingPage: boolean = false
  @State subscribedFeeds: Feed[] = []
  @Prop showBottomTabs: boolean = true
  @Prop reserveBottomTabInset: boolean = false
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @StorageProp('discoverSearchDismissAt') @Watch('handleSearchDismissSignal') discoverSearchDismissAt: number = 0
  @Provide('DiscoverNavPathStack') discoverPathStack: NavPathStack = new NavPathStack()
  onReady: () => void = () => {}
  private searchSession: number = 0
  private platformSwitchSession: number = 0
  private searchInputController: TextInputController = new TextInputController()
  private readonly contentScroller: Scroller = new Scroller()
  private headerBlurOffset: number = 0

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
        .fontSize(28)
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
    this.dismissSearchFocus()

    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
      if (this.hasLoaded || this.isLoadingPage) {
        this.onReady()
        return
      }
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

      this.hasLoaded = true
      this.onReady()
    } finally {
      this.isLoadingPage = false
    }
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
  }

  private viewLabel(view: FeedViewType): string {
    return discoverViewLabel(view)
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

  private handleSearchDismissSignal(): void {
    this.dismissSearchFocus()
  }

  private dismissSearchFocus(): void {
    this.searchInputController.stopEditing()
    this.showPlatformChips = false
    this.keepPlatformChipsOnBlur = false
  }

  private scheduleOverlayNavigation(action: () => void): void {
    this.dismissSearchFocus()
    AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
    AppStorage.setOrCreate('discoverOverlayLevel', 1)
    setTimeout(() => {
      action()
    }, 90)
  }

  private settleDiscoverRootVisible(): void {
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    if (currentLevel > 0) {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
      return
    }
    AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
    AppStorage.setOrCreate('discoverOverlayLevel', 0)
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

  private recommendedFallback(): RecommendedFeed[] {
    return filteredRecommendedFeedsByPlatform(this.searchPlatform)
      .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
      .slice(0, 8)
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
        ),
        true,
      )
    })
  }

  private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate): void {
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
    return this.theme.accent
  }

  private faviconUrl(siteUrl: string): string {
    const host = this.hostOf(siteUrl)
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : ''
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
    const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
      candidate.imageUrl ?? '',
      candidate.targetUrl,
      candidate.siteUrl,
      candidate.targetTitle,
    )
    if (resolvedImageUrl) {
      return resolvedImageUrl
    }

    const platform = this.resolvedPlatformLabel(candidate)
    if (platform === 'GitHub') {
      return 'https://github.githubassets.com/favicons/favicon.svg'
    }
    return this.faviconUrl(candidate.siteUrl)
  }

  @Builder
  private PlatformChip(platform: DiscoverSearchPlatform) {
    Text(discoverPlatformLabel(platform))
      .fontSize(CHIP_FONT_SIZE)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.searchPlatform === platform ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 12, right: 12, top: 8, bottom: 8 })
      .backgroundColor(this.searchPlatform === platform ? this.theme.accent : this.theme.elevated)
      .borderRadius(CHIP_RADIUS)
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
          .fontColor([this.theme.textSecondary])

        TextInput({ text: this.query, placeholder: '搜索订阅源', controller: this.searchInputController })
          .backgroundColor('transparent')
          .fontColor(this.theme.textPrimary)
          .placeholderColor(this.theme.textMuted)
          .caretColor(this.theme.textPrimary)
          .padding(0)
          .layoutWeight(1)
          .onClick(() => {
            this.showPlatformChips = true
          })
          .onBlur(() => {
            if (this.keepPlatformChipsOnBlur) {
              this.keepPlatformChipsOnBlur = false
              return
            }
            setTimeout(() => {
              if (!this.isInteractingWithPlatformChips) {
                this.showPlatformChips = false
              }
            }, 80)
          })
          .onChange((value: string) => {
            this.query = value
            void this.refreshRemoteResults()
          })

        if (this.query.trim()) {
          Text('×')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textMuted)
            .width(28)
            .height(28)
            .textAlign(TextAlign.Center)
            .borderRadius(CHIP_RADIUS)
            .backgroundColor(this.theme.surface)
            .onClick(() => {
              this.query = ''
              this.remoteResults = []
              this.isSearchingRemote = false
            })
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 12 })
      .backgroundColor(this.theme.elevated)
      .borderRadius(INPUT_RADIUS)
      .border({ width: 0.8, color: this.theme.divider })
      .shadow({
        radius: 10,
        color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)',
        offsetY: 2,
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
      .height(this.showPlatformChips ? 36 : 0)
      .opacity(this.showPlatformChips ? 1 : 0)
      .translate({ y: this.showPlatformChips ? 0 : -10 })
      .padding({ top: this.showPlatformChips ? 6 : 0 })
      .clip(true)
      .animation({ duration: 260, curve: Curve.FastOutSlowIn })
    }
    .width('100%')
    .margin({ bottom: 4 })
    .transition(this.rootEnterTransition(40))
  }

  @Builder
  private SectionHeader(title: string) {
    Row() {
      Text(title)
        .fontSize(SECTION_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
    }
    .width('100%')
    .transition(this.showBottomTabs ? livoMotion.enterFromRight(20) : TransitionEffect.IDENTITY)
  }

  @Builder
  private AvatarBox(imageUrl: string, fallbackLabel: string, accent: string) {
    AvatarTile({
      imageUrl,
      fallbackLabel,
      accent,
      theme: this.theme,
      avatarSize: 38,
      radius: 10,
      textSize: 14,
    })
  }

  @Builder
  private ResultMeta(primary: string, secondary: string, tertiary: string) {
    Row({ space: 6 }) {
      Text(primary)
        .fontSize(10)
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
        this.AvatarBox('', result.title, this.theme.accent)

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
      .borderRadius(CARD_RADIUS_MD)
      .onClick(() => {
        this.openDirectUrlResult(result)
      })
    }
  }

  @Builder
  private CandidateRow(candidate: ResolvedDiscoverCandidate, showDivider: boolean) {
    Column() {
      Row({ space: 12 }) {
        Row({ space: 12 }) {
          this.AvatarBox(
            this.resolvedCandidateAvatarUrl(candidate),
            candidate.targetTitle,
            this.platformColor(this.resolvedPlatformLabel(candidate)),
          )

          Column({ space: 6 }) {
            Text(candidate.targetTitle)
              .fontSize(LIST_ROW_TITLE_SIZE)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            Text(this.candidateMetaText(candidate))
              .fontSize(LIST_ROW_META_SIZE)
              .fontColor(this.theme.textSecondary)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .onClick(() => {
          this.openCandidate(candidate)
        })

        Button(this.candidateActionLabel(candidate))
          .type(ButtonType.Capsule)
          .fontSize(LIST_ROW_META_SIZE)
          .fontWeight(FontWeight.Medium)
          .height(LIST_ACTION_HEIGHT)
          .backgroundColor(this.candidateActionBackground(candidate))
          .fontColor(this.candidateActionFontColor(candidate))
          .onClick(() => {
            this.openSubscribeConfigPage(candidate)
          })
      }
      .width('100%')
      .padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING })

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
  private CandidateSection(title: string, items: ResolvedDiscoverCandidate[]) {
    if (items.length > 0) {
      Column({ space: 12 }) {
        this.SectionHeader(title)

        Column() {
          ForEach(items, (candidate: ResolvedDiscoverCandidate, index: number) => {
            this.CandidateRow(candidate, index < items.length - 1)
          }, (candidate: ResolvedDiscoverCandidate) => `${title}-${candidate.targetUrl}`)
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .clip(true)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private SearchResultSection() {
    if (this.hasSearchResults() || this.isSearchingRemote || this.isPlatformSwitchSearching) {
      Column({ space: 12 }) {
        this.SectionHeader('搜索结果')

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
          .borderRadius(CARD_RADIUS_MD)
        } else {
          Column() {
            ForEach(this.searchResults(), (candidate: ResolvedDiscoverCandidate, index: number) => {
              this.CandidateRow(candidate, index < this.searchResults().length - 1)
            }, (candidate: ResolvedDiscoverCandidate) => `search-${candidate.targetUrl}`)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .clip(true)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private RecommendedFallbackSection() {
    if (!this.query.trim() && this.recommendedFallback().length > 0) {
      Column({ space: 6 }) {
        this.SectionHeader(
          this.searchPlatform === 'all' ? '推荐订阅' : `${discoverPlatformLabel(this.searchPlatform)} 推荐订阅`,
        )

        Column() {
          ForEach(this.recommendedFallback(), (feed: RecommendedFeed, index: number) => {
            this.CandidateRow(createDiscoverResultFromFeed(feed), index < this.recommendedFallback().length - 1)
          }, (feed: RecommendedFeed) => `recommended-${feed.view}-${feed.url}`)
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .clip(true)
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
    .borderRadius(CARD_RADIUS_LG)
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
        this.RecommendedFallbackSection()
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
    if (this.discoverOverlayLevel > 0) {
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
        this.searchInputController.stopEditing()
      })
      .padding({
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
        top: 0,
        bottom: this.isSearchModeActive() ? 16 : this.discoverListBottomPadding(),
      })

      if (this.showBottomTabs && this.discoverOverlayLevel === 0) {
        BottomTabs({ activeTab: 'discover', theme: this.theme })
          .align(Alignment.Bottom)
      }

    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onAppear(() => {
      this.dismissSearchFocus()
      this.settleDiscoverRootVisible()
    })
  }

  @Builder
  private DiscoverDestinations(name: string, params?: DiscoverFlowRouteParams | EntryDetailParams) {
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
    if (this.showBottomTabs || this.discoverOverlayLevel > 0) {
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
      .hideTitleBar(false)
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
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  private settleRootOverlayClosed(): void {
    AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
    AppStorage.setOrCreate('discoverOverlayLevel', 0)
  }

  private restoreRootOverlayAfterConfigClose(): void {
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    if (currentLevel > 1) {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
      AppStorage.setOrCreate('discoverOverlayLevel', 1)
    } else {
      this.settleRootOverlayClosed()
    }
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
        this.restoreRootOverlayAfterConfigClose()
        this.discoverPathStack.pop(true)
      },
      onSubscribed: () => {
        AppStorage.setOrCreate('discoverSearchDismissAt', Date.now())
        AppStorage.setOrCreate('feedsChangedAt', Date.now())
        this.discoverPathStack.clear()
        this.settleRootOverlayClosed()
      },
      onSaved: () => {
        AppStorage.setOrCreate('feedsChangedAt', Date.now())
        this.restoreRootOverlayAfterConfigClose()
        this.discoverPathStack.pop(true)
      },
      onUnsubscribed: () => {
        AppStorage.setOrCreate('feedsChangedAt', Date.now())
        this.discoverPathStack.clear()
        this.settleRootOverlayClosed()
      }
    })
    .onAppear(() => {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
    })
    .onDisAppear(() => {
      const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
      AppStorage.setOrCreate('discoverHasForegroundOverlay', currentLevel > 0)
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
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  private openEditConfigPage(feed: Feed): void {
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        this.targetUrl,
        feed.title,
        feed.view,
        feed.siteUrl || this.initialTargetSiteUrl,
        feed.imageUrl || '',
        feed.description || this.initialTargetDescription,
        '编辑',
        feed.category || '',
      ),
      true,
    )
  }

  private openNewSubscribeConfigPage(payload: FeedRefreshPayload): void {
    DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload)
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        this.targetUrl,
        payload.feedTitle || this.initialTargetTitle,
        this.targetView,
        payload.siteUrl || this.initialTargetSiteUrl,
        payload.imageUrl || '',
        payload.description || this.initialTargetDescription,
        '',
        this.targetCategory,
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
        AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
        const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
        AppStorage.setOrCreate('discoverOverlayLevel', currentLevel > 1 ? currentLevel - 1 : 0)
        this.discoverPathStack.pop(true)
      },
      onEdit: (feed: Feed) => { this.openEditConfigPage(feed) },
      onSubscribe: (payload: FeedRefreshPayload) => { this.openNewSubscribeConfigPage(payload) },
      onOpenArticle: (entry: Entry, _feed: Feed) => { this.openEntryDetail(entry) }
    })
    .onAppear(() => {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', true)
    })
    .onDisAppear(() => {
      const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
      if (currentLevel <= 1) {
        AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
      }
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
