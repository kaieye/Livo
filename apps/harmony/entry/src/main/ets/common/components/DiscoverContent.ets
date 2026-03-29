import promptAction from '@ohos.promptAction'
import { AppRepository } from '../data/AppRepository'
import { openArticleDetail, openFeedDetailPreview } from '../navigation/AppRouter'
import { AvatarTile } from './AvatarTile'
import { BottomTabs } from './BottomTabs'
import { PageHeader } from './PageHeader'
import { Entry, Feed, FeedViewType, formatPublishedAt, toArticleDetailModel } from '../models/LivoModels'
import { FeedDraft } from '../repositories/FeedRepository'
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

const DISCOVER_ROUTE_SUBSCRIBE_CONFIG: string = 'discover-subscribe-config'
const DISCOVER_ROUTE_ENTRY_DETAIL: string = 'entry-detail'

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
  }
}

function createDiscoverFlowRouteParams(
  targetUrl: string,
  targetTitle: string,
  targetView: FeedViewType,
  siteUrl: string,
  description: string,
  sourceKind: string,
  category: string,
): DiscoverFlowRouteParams {
  const params = new DiscoverFlowRouteParams()
  params.targetUrl = targetUrl
  params.targetTitle = targetTitle
  params.targetView = targetView
  params.siteUrl = siteUrl
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
  @Provide('DiscoverNavPathStack') discoverPathStack: NavPathStack = new NavPathStack()
  onReady: () => void = () => {}
  private searchSession: number = 0

  aboutToAppear(): void {
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

  private isSubscribedRecommendedFeed(feed: RecommendedFeed): boolean {
    const recommendedUrl = this.normalizeFeedIdentity(feed.url)
    const recommendedSiteUrl = this.normalizeFeedIdentity(feed.siteUrl)
    const recommendedTitle = feed.title.trim().toLowerCase()

    for (const subscribedFeed of this.subscribedFeeds) {
      const subscribedUrl = this.normalizeFeedIdentity(subscribedFeed.url)
      const subscribedSiteUrl = this.normalizeFeedIdentity(subscribedFeed.siteUrl ?? '')
      const subscribedTitle = subscribedFeed.title.trim().toLowerCase()

      if (recommendedUrl && subscribedUrl && recommendedUrl === subscribedUrl) {
        return true
      }

      if (recommendedSiteUrl && subscribedSiteUrl && recommendedSiteUrl === subscribedSiteUrl) {
        return true
      }

      if (recommendedTitle && subscribedTitle && recommendedTitle === subscribedTitle) {
        return true
      }
    }

    return false
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
    const session = Date.now()
    this.searchSession = session

    if (!trimmed) {
      this.remoteResults = []
      this.isSearchingRemote = false
      return
    }

    if (this.directUrlResult() || this.resolvedCandidates().length > 0) {
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

  private openPreviewPage(
    targetUrl: string,
    targetTitle: string,
    targetView: FeedViewType,
    siteUrl: string,
    description: string,
    sourceKind: string,
    category: string,
  ): void {
    void openFeedDetailPreview({
      targetUrl,
      targetTitle,
      targetView,
      siteUrl,
      description,
      sourceKind,
      category,
    })
  }

  private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate): void {
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        candidate.targetUrl,
        candidate.targetTitle,
        candidate.targetView,
        candidate.siteUrl,
        candidate.description,
        candidate.sourceKind,
        this.resolvedPlatformLabel(candidate),
      ),
      true,
    )
  }

  private openDirectUrlResult(result: DirectUrlResult): void {
    this.openPreviewPage(
      result.targetUrl,
      result.title,
      preferredViewForPlatform(this.searchPlatform),
      result.siteUrl,
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
    if (candidate.imageUrl) {
      return candidate.imageUrl
    }

    const platform = this.resolvedPlatformLabel(candidate)
    if (platform === 'GitHub') {
      return 'https://github.githubassets.com/favicons/favicon.svg'
    }
    if (platform === 'YouTube') {
      return 'https://www.youtube.com/s/desktop/fe0e7cf8/img/favicon_144x144.png'
    }
    if (platform === 'Instagram') {
      return 'https://static.cdninstagram.com/rsrc.php/v4/yI/r/VsNE-OHk_8a.png'
    }
    if (platform === 'Bilibili') {
      return 'https://www.bilibili.com/favicon.ico'
    }
    if (platform === 'X') {
      return 'https://abs.twimg.com/favicons/twitter.3.ico'
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
      .onClick(() => {
        this.searchPlatform = platform
        void this.refreshRemoteResults()
      })
  }

  @Builder
  private SearchPanel() {
    Column({ space: 12 }) {
      Stack({ alignContent: Alignment.End }) {
        TextInput({ text: this.query, placeholder: '输入 RSS 地址、主页链接或关键字' })
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
          .placeholderColor(this.theme.textMuted)
          .caretColor(this.theme.textPrimary)
          .borderRadius(INPUT_RADIUS)
          .padding({ left: 16, right: this.query.trim() ? 44 : 16, top: 14, bottom: 14 })
          .width('100%')
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
            .margin({ right: 10 })
            .onClick(() => {
              this.query = ''
              this.remoteResults = []
              this.isSearchingRemote = false
            })
        }
      }
      .width('100%')

      Row({ space: 10 }) {
        ForEach(this.platformOptions(), (platform: DiscoverSearchPlatform) => {
          this.PlatformChip(platform)
        }, (platform: DiscoverSearchPlatform) => platform)
      }
      .width('100%')
    }
    .width('100%')
    .padding(18)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 16,
      color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.05)',
      offsetX: 0,
      offsetY: 6,
    })
    .transition(livoMotion.enterSoft(40))
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
    .transition(livoMotion.enterFromRight(20))
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

            Text(candidate.description)
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

        Button('订阅')
          .type(ButtonType.Capsule)
          .fontSize(LIST_ROW_META_SIZE)
          .fontWeight(FontWeight.Medium)
          .height(LIST_ACTION_HEIGHT)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
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
    if (this.hasSearchResults() || this.isSearchingRemote) {
      Column({ space: 12 }) {
        this.SectionHeader('搜索结果')

        if (this.isSearchingRemote && this.searchResults().length === 0) {
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
      Column({ space: 8 }) {
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

  private discoverListExternalGap(): number {
    return 0
  }

  private discoverViewportBottomInset(): number {
    return 0
  }

  @Builder
  private DiscoverRoot() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Column({ space: 10 }) {
          PageHeader({
            title: '添加订阅',
            theme: this.theme,
          })
          this.SearchPanel()
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 0 })
        .alignItems(HorizontalAlign.Start)

        Scroll() {
          Column({ space: 16 }) {
            if (this.directUrlResult()) {
              Column({ space: 12 }) {
                this.SectionHeader('地址结果')
                this.DirectUrlRow(this.directUrlResult())
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
            }

            this.CandidateSection('识别结果', this.resolvedCandidates())
            this.CandidateSection('候选订阅', this.keywordCandidates())
            this.SearchResultSection()
            this.RecommendedFallbackSection()

            if (this.query.trim() && !this.hasAnyResult() && !this.isSearchingRemote) {
              this.NoResultState()
            }

            Row()
              .height(this.discoverBottomSpacerHeight())
              .width('100%')
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .padding({
            left: PAGE_HORIZONTAL_PADDING,
            right: PAGE_HORIZONTAL_PADDING,
            top: 0,
            bottom: this.discoverListBottomPadding(),
          })
          .margin({ bottom: this.discoverListExternalGap() })
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .backgroundColor(this.theme.background)
        .edgeEffect(EdgeEffect.Spring)
        .nestedScroll({
          scrollForward: NestedScrollMode.SELF_FIRST,
          scrollBackward: NestedScrollMode.SELF_FIRST,
        })
      }
      .width('100%')
      .height('100%')

      if (this.showBottomTabs && this.discoverOverlayLevel === 0) {
        BottomTabs({ activeTab: 'discover', theme: this.theme })
          .align(Alignment.Bottom)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  @Builder
  private DiscoverDestinations(name: string, params?: DiscoverFlowRouteParams | EntryDetailParams) {
    if (name === DISCOVER_ROUTE_SUBSCRIBE_CONFIG) {
      NavDestination() {
        DiscoverSubscribeConfigDestination({
          targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
          targetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
          targetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
          targetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
          sourceKind: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).sourceKind,
          initialSelectedView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
          theme: this.theme,
        })
      }
      .hideTitleBar(true)
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
    }
  }

  build() {
    Navigation(this.discoverPathStack) {
      this.DiscoverRoot()
    }
    .hideToolBar(true)
    .hideBackButton(true)
    .mode(NavigationMode.Stack)
    .navDestination(this.DiscoverDestinations)
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}

@Component
struct DiscoverSubscribeConfigDestination {
  @Consume('DiscoverNavPathStack') discoverPathStack: NavPathStack
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @Prop targetUrl: string = ''
  @Prop targetTitle: string = ''
  @Prop targetSiteUrl: string = ''
  @Prop targetDescription: string = ''
  @Prop sourceKind: string = ''
  @Prop initialSelectedView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State selectedView: FeedViewType = FeedViewType.Articles
  @State customTitle: string = ''
  @State customCategory: string = ''
  @State hideInTimeline: boolean = false
  @State isEditMode: boolean = false
  @State hasChanges: boolean = false
  @State existingFeed: Feed | undefined = undefined

  aboutToAppear(): void {
    this.selectedView = this.initialSelectedView
    this.customTitle = this.targetTitle
    this.isEditMode = this.sourceKind === '编辑'
    
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    if (currentLevel < 1) {
      AppStorage.setOrCreate('discoverOverlayLevel', 1)
    }

    if (this.isEditMode) {
      void this.loadExistingFeed()
    }
  }

  private async loadExistingFeed(): Promise<void> {
    const feeds = await AppRepository.feedEntities()
    this.existingFeed = feeds.find((feed: Feed) => 
      this.normalizeUrl(feed.url) === this.normalizeUrl(this.targetUrl)
    )

    if (this.existingFeed) {
      this.customTitle = this.existingFeed.title
      this.customCategory = this.existingFeed.category || ''
      this.selectedView = this.existingFeed.view
      this.hideInTimeline = !this.existingFeed.showInAll
    }
  }

  private normalizeUrl(url: string): string {
    return url.trim().replace(/\/+$/, '').toLowerCase()
  }

  private checkForChanges(): void {
    if (!this.existingFeed) {
      this.hasChanges = false
      return
    }

    this.hasChanges = 
      this.customTitle !== this.existingFeed.title ||
      this.customCategory !== this.existingFeed.category ||
      this.selectedView !== this.existingFeed.view ||
      this.hideInTimeline !== !this.existingFeed.showInAll
  }

  private viewOptions(): ConfigOption[] {
    return [
      { view: FeedViewType.Articles, label: '文章', description: '' },
      { view: FeedViewType.SocialMedia, label: '社交', description: '' },
      { view: FeedViewType.Pictures, label: '图片', description: '' },
      { view: FeedViewType.Videos, label: '视频', description: '' },
    ]
  }

  private getViewLabel(view: FeedViewType): string {
    switch (view) {
      case FeedViewType.Articles:
        return '文章'
      case FeedViewType.SocialMedia:
        return '社交'
      case FeedViewType.Pictures:
        return '图片'
      case FeedViewType.Videos:
        return '视频'
      default:
        return '文章'
    }
  }

  private getViewIcon(view: FeedViewType): Resource {
    switch (view) {
      case FeedViewType.Articles:
        return $r('app.media.sub_articles_inactive')
      case FeedViewType.SocialMedia:
        return $r('app.media.sub_social_inactive')
      case FeedViewType.Pictures:
        return $r('app.media.sub_pictures_inactive')
      case FeedViewType.Videos:
        return $r('app.media.sub_videos_inactive')
      default:
        return $r('app.media.sub_articles_inactive')
    }
  }

  private getViewIconColor(view: FeedViewType): string {
    if (this.selectedView === view) {
      return this.theme.textPrimary
    }
    return this.theme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  }

  private isBilibiliSource(): boolean {
    const site = this.targetSiteUrl.toLowerCase()
    const target = this.targetUrl.toLowerCase()
    return site.includes('space.bilibili.com')
      || site.includes('bilibili.com')
      || target.includes('/bilibili/user/video/')
      || target.includes('/bilibili/user/dynamic/')
  }

  private mappedTargetUrl(): string {
    if (!this.isBilibiliSource()) {
      return this.targetUrl
    }

    const matched = this.targetUrl.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    const uid = matched?.[1] ?? ''
    if (!uid) {
      return this.targetUrl
    }

    const instanceMatch = this.targetUrl.match(/^(https?:\/\/[^/]+)/i)
    const instance = instanceMatch?.[1] ?? 'https://rsshub.pseudoyu.com'

    if (this.selectedView === FeedViewType.SocialMedia) {
      return `${instance}/bilibili/user/dynamic/${uid}`
    }

    if (this.selectedView === FeedViewType.Videos) {
      return `${instance}/bilibili/user/video/${uid}`
    }

    return this.targetUrl
  }

  private hostOf(url: string): string {
    const matched = url.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private faviconUrl(): string {
    const host = this.hostOf(this.targetSiteUrl || this.targetUrl)
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : ''
  }

  private async handleUnsubscribe(): Promise<void> {
    if (!this.existingFeed) {
      return
    }

    try {
      await AppRepository.removeFeed(this.existingFeed.id)
      
      promptAction.showToast({
        message: '已取消订阅',
        duration: 2000,
      })

      // 返回到发现页面
      AppStorage.setOrCreate('discoverOverlayLevel', 0)
      this.discoverPathStack.clear()
    } catch (e) {
      promptAction.showToast({
        message: `取消订阅失败: ${e}`,
        duration: 3000,
      })
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.existingFeed) {
      return
    }

    try {
      const draft: FeedDraft = {
        url: this.targetUrl,
        title: this.customTitle || this.targetTitle,
        siteUrl: this.targetSiteUrl,
        description: this.targetDescription,
        category: this.customCategory,
        view: this.selectedView,
        showInAll: !this.hideInTimeline,
      }

      await AppRepository.updateFeed(this.existingFeed.id, draft)
      
      promptAction.showToast({
        message: '保存成功',
        duration: 2000,
      })

      // 返回到预览页面
      AppStorage.setOrCreate('discoverOverlayLevel', 1)
      this.discoverPathStack.pop(true)
    } catch (e) {
      promptAction.showToast({
        message: `保存失败: ${e}`,
        duration: 3000,
      })
    }
  }

  private async handleSubscribe(): Promise<void> {
    try {
      const draft: FeedDraft = {
        url: this.mappedTargetUrl(),
        title: this.customTitle || this.targetTitle,
        siteUrl: this.targetSiteUrl,
        description: this.targetDescription,
        category: this.customCategory,
        view: this.selectedView,
        showInAll: !this.hideInTimeline,
      }

      await AppRepository.createFeed(draft)
      
      promptAction.showToast({
        message: '订阅成功',
        duration: 2000,
      })

      // 返回到发现页面
      AppStorage.setOrCreate('discoverOverlayLevel', 0)
      this.discoverPathStack.clear()
    } catch (e) {
      promptAction.showToast({
        message: `订阅失败: ${e}`,
        duration: 3000,
      })
    }
  }

  @Builder
  private TopBar() {
    Row() {
      // 返回箭头按钮
      Text('‹')
        .fontSize(32)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(44)
        .height(44)
        .textAlign(TextAlign.Center)
        .onClick(() => {
          AppStorage.setOrCreate('discoverOverlayLevel', 0)
          this.discoverPathStack.pop(true)
        })

      // 标题
      Text(`订阅 - ${this.targetTitle}`)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      // 订阅按钮
      Button('订阅')
        .type(ButtonType.Normal)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .height(36)
        .padding({ left: 20, right: 20 })
        .backgroundColor('transparent')
        .fontColor('#FF6B35')
        .onClick(() => {
          void this.handleSubscribe()
        })
    }
    .width('100%')
    .padding({ left: 8, right: 8, top: 12, bottom: 8 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  private FeedInfoCard() {
    Column({ space: 12 }) {
      // 头像和基本信息
      Row({ space: 12 }) {
        // 头像
        Stack({ alignContent: Alignment.Center }) {
          if (this.faviconUrl()) {
            Image(this.faviconUrl())
              .width(56)
              .height(56)
              .borderRadius(14)
              .backgroundColor(this.theme.elevated)
          } else {
            Row()
              .width(56)
              .height(56)
              .borderRadius(14)
              .backgroundColor(this.theme.accent)

            Text(this.targetTitle.substring(0, 1).toUpperCase())
              .fontSize(24)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
          }
        }

        // 标题和URL
        Column({ space: 4 }) {
          Text(this.targetTitle)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(this.targetUrl)
            .fontSize(12)
            .fontColor(this.theme.textMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')

      // 完整描述
      if (this.targetDescription) {
        Text(this.targetDescription)
          .fontSize(14)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .width('100%')
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(16)
  }

  @Builder
  private ConfigSection(title: string, description: string) {
    Column({ space: 8 }) {
      Text(title)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Text(description)
        .fontSize(13)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private TextInputField(placeholder: string, value: string, onChange: (value: string) => void) {
    TextInput({ text: value, placeholder: placeholder })
      .backgroundColor(this.theme.elevated)
      .fontColor(this.theme.textPrimary)
      .placeholderColor(this.theme.textMuted)
      .borderRadius(12)
      .padding({ left: 16, right: 16, top: 12, bottom: 12 })
      .width('100%')
      .onChange((newValue: string) => {
        onChange(newValue)
        this.checkForChanges()
      })
  }

  @Builder
  private ToggleRow(label: string, description: string, value: boolean, onChange: (value: boolean) => void) {
    Row() {
      Column({ space: 4 }) {
        Text(label)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(description)
          .fontSize(12)
          .lineHeight(16)
          .fontColor(this.theme.textSecondary)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Toggle({ type: ToggleType.Switch, isOn: value })
        .selectedColor(this.theme.accent)
        .onChange((isOn: boolean) => {
          onChange(isOn)
          this.checkForChanges()
        })
    }
    .width('100%')
    .padding({ top: 8, bottom: 8 })
  }

  private indicatorColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.92)'
  }

  private indicatorBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)'
  }

  private indicatorShadowColor(): string {
    return this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.08)'
  }

  private activeTextColor(): string {
    return this.theme.isDark ? '#F5F8FF' : '#14213D'
  }

  @Builder
  private ViewTypeButton(option: ConfigOption) {
    Row({ space: 6 }) {
      // 图标
      Image(this.getViewIcon(option.view))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)

      // 标签
      Text(this.getViewLabel(option.view))
        .fontSize(14)
        .fontWeight(this.selectedView === option.view ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.selectedView === option.view ? this.activeTextColor() : this.theme.textSecondary)
    }
    .layoutWeight(1)
    .height(38)
    .justifyContent(FlexAlign.Center)
    .borderRadius(CHIP_RADIUS)
    .animation({ duration: 160, curve: Curve.EaseInOut })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => {
      this.selectedView = option.view
      this.checkForChanges()
    })
  }

  private viewOptionIndex(view: FeedViewType): number {
    const options = this.viewOptions()
    for (let i = 0; i < options.length; i++) {
      if (options[i].view === view) {
        return i
      }
    }
    return 0
  }

  @State railWidth: number = 0

  private indicatorSlotWidth(): number {
    if (this.railWidth <= 0) {
      return 0
    }
    return (this.railWidth - 8) / this.viewOptions().length
  }

  private indicatorOffsetX(): number {
    return this.indicatorSlotWidth() * this.viewOptionIndex(this.selectedView)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        // 顶部导航栏
        this.TopBar()

        // 可滚动内容区域
        Scroll() {
          Column({ space: 20 }) {
            // 订阅源信息卡片
            this.FeedInfoCard()

            // 标题配置
            Column({ space: 12 }) {
              this.ConfigSection('标题', '此订阅源的自定义标题，留空则使用默认标题。')
              this.TextInputField('', this.customTitle, (value: string) => {
                this.customTitle = value
              })
            }
            .width('100%')

            // 在时间线中隐藏
            this.ToggleRow(
              '在时间线中隐藏',
              '开启后，此订阅将不再显示在主时间线中。',
              this.hideInTimeline,
              (value: boolean) => {
                this.hideInTimeline = value
              }
            )

            // 栏目类型选择
            Column({ space: 12 }) {
              this.ConfigSection('栏目', '')

              Stack({ alignContent: Alignment.Center }) {
                // Sliding indicator (same style as ContentModeRail on homepage)
                Row() {
                  Row()
                    .width(this.indicatorSlotWidth())
                    .height(38)
                    .translate({ x: this.indicatorOffsetX() })
                    .backgroundColor(this.indicatorColor())
                    .borderRadius(CHIP_RADIUS)
                    .border({ width: 0.6, color: this.indicatorBorderColor() })
                    .shadow({
                      radius: 8,
                      color: this.indicatorShadowColor(),
                      offsetX: 0,
                      offsetY: 2,
                    })
                    .animation({ duration: 100, curve: Curve.EaseOut })
                }
                .width('100%')
                .height('100%')
                .justifyContent(FlexAlign.Start)

                Row({ space: 0 }) {
                  ForEach(this.viewOptions(), (option: ConfigOption) => {
                    this.ViewTypeButton(option)
                  }, (option: ConfigOption) => `view-${option.view}`)
                }
                .width('100%')
                .height('100%')
              }
              .width('100%')
              .height(46)
              .padding(4)
              .backgroundColor(this.theme.elevated)
              .borderRadius(CARD_RADIUS_SM)
              .border({ width: 0.8, color: this.theme.divider })
              .onSizeChange((_, newValue) => {
                if (typeof newValue.width === 'number') {
                  this.railWidth = newValue.width
                }
              })
            }
            .width('100%')

            // 底部留出空间给按钮
            Row().height(this.isEditMode ? 80 : 20)
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 8, bottom: 16 })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Auto)
        .edgeEffect(EdgeEffect.Spring)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)

      // 底部按钮区域
      if (this.isEditMode) {
        // 编辑模式：显示取消订阅和保存按钮
        if (this.hasChanges) {
          Row({ space: 12 }) {
            Button('取消订阅')
              .type(ButtonType.Capsule)
              .layoutWeight(1)
              .height(50)
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .backgroundColor(this.theme.elevated)
              .fontColor('#EF4444')
              .onClick(() => {
                this.showUnsubscribeConfirm()
              })

            Button('保存')
              .type(ButtonType.Capsule)
              .layoutWeight(1)
              .height(50)
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .backgroundColor(this.theme.accent)
              .fontColor('#FFFFFF')
              .onClick(() => {
                void this.handleSave()
              })
          }
          .width('90%')
          .margin({ bottom: 24 })
          .opacity(0.92)
        } else {
          Button('取消订阅')
            .type(ButtonType.Capsule)
            .width('80%')
            .height(50)
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .backgroundColor(this.theme.elevated)
            .fontColor('#EF4444')
            .margin({ bottom: 24 })
            .opacity(0.92)
            .onClick(() => {
              this.showUnsubscribeConfirm()
            })
        }
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  // 取消订阅确认对话框
  private showUnsubscribeConfirm(): void {
    AlertDialog.show({
      title: '取消订阅',
      message: '确定要取消订阅这个订阅源吗？',
      primaryButton: {
        value: '取消',
        action: () => {}
      },
      secondaryButton: {
        value: '确定',
        fontColor: '#EF4444',
        action: () => {
          void this.handleUnsubscribe()
        }
      }
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
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  aboutToAppear(): void {
    AppStorage.setOrCreate('discoverOverlayLevel', 1)
  }

  aboutToDisappear(): void {
    const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
    if (currentLevel >= 1) {
      AppStorage.setOrCreate('discoverOverlayLevel', currentLevel - 1)
    }
  }

  private openEditConfigPage(feed: Feed): void {
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        this.targetUrl,
        feed.title,
        feed.view,
        feed.siteUrl || this.initialTargetSiteUrl,
        feed.description || this.initialTargetDescription,
        '编辑',
        feed.category || '',
      ),
      true,
    )
  }

  private openNewSubscribeConfigPage(payload: FeedRefreshPayload): void {
    AppStorage.setOrCreate('discoverOverlayLevel', 2)
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_SUBSCRIBE_CONFIG,
      createDiscoverFlowRouteParams(
        this.targetUrl,
        payload.feedTitle || this.initialTargetTitle,
        this.targetView,
        payload.siteUrl || this.initialTargetSiteUrl,
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
      initialTargetDescription: this.initialTargetDescription,
      targetCategory: this.targetCategory,
      targetView: this.targetView,
      theme: this.theme,
      onBack: () => {
        const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0
        AppStorage.setOrCreate('discoverOverlayLevel', currentLevel > 1 ? currentLevel - 1 : 0)
        this.discoverPathStack.pop(true)
      },
      onEdit: (feed: Feed) => { this.openEditConfigPage(feed) },
      onSubscribe: (payload: FeedRefreshPayload) => { this.openNewSubscribeConfigPage(payload) },
      onOpenArticle: (entry: Entry, _feed: Feed) => { this.openEntryDetail(entry) }
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
    Row() {
      // 返回箭头按钮
      Text('‹')
        .fontSize(28)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(40)
        .height(40)
        .textAlign(TextAlign.Center)
        .onClick(() => {
          this.discoverPathStack.pop(true)
        })

      Blank()
    }
    .width('100%')
    .padding({ left: 18, right: 18, top: 12, bottom: 10 })
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
            .padding({ left: 18, right: 18, top: 6, bottom: 2 })
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
