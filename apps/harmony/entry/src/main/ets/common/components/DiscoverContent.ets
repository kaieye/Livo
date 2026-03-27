import promptAction from '@ohos.promptAction'
import { AppRepository } from '../data/AppRepository'
import { AvatarTile } from './AvatarTile'
import { BottomTabs } from './BottomTabs'
import { PageHeader } from './PageHeader'
import { Entry, Feed, FeedViewType } from '../models/LivoModels'
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
import {
  CARD_RADIUS_LG,
  CARD_RADIUS_MD,
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
} from '../ui/UiTokens'

const DISCOVER_ROUTE_SUBSCRIBE_CONFIG: string = 'discover-subscribe-config'
const DISCOVER_ROUTE_PREVIEW: string = 'discover-preview'

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
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
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

    return searchedRecommendedFeedsByPlatform(this.query, this.searchPlatform).slice(0, 10)
  }

  private searchResults(): ResolvedDiscoverCandidate[] {
    if (this.remoteResults.length > 0) {
      return this.remoteResults
    }

    return this.localRecommendedResults().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed))
  }

  private recommendedFallback(): RecommendedFeed[] {
    return filteredRecommendedFeedsByPlatform(this.searchPlatform).slice(0, 8)
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
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_PREVIEW,
      createDiscoverFlowRouteParams(targetUrl, targetTitle, targetView, siteUrl, description, sourceKind, category),
      true,
    )
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
  private SectionHeader(title: string, count: number) {
    Row() {
      Text(title)
        .fontSize(SECTION_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Blank()

      Text(`${count}`)
        .fontSize(META_FONT_SIZE)
        .fontColor(this.theme.textMuted)
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
        this.SectionHeader(title, items.length)

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
        this.SectionHeader('搜索结果', this.searchResults().length)

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
      Column({ space: 12 }) {
        this.SectionHeader(
          this.searchPlatform === 'all' ? '推荐来源' : `${discoverPlatformLabel(this.searchPlatform)} 推荐`,
          this.recommendedFallback().length,
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

  @Builder
  private DiscoverRoot() {
    Column() {
      Column({ space: 14 }) {
        PageHeader({
          title: '添加订阅',
          theme: this.theme,
        })
        this.SearchPanel()
      }
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 8 })
      .alignItems(HorizontalAlign.Start)

      Scroll() {
        Column({ space: 14 }) {
          if (this.directUrlResult()) {
            Column({ space: 12 }) {
              this.SectionHeader('地址结果', 1)
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

          Row().height(18).width('100%')
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: PAGE_BOTTOM_GAP })
        .justifyContent(FlexAlign.Start)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)

      if (this.showBottomTabs) {
        BottomTabs({ activeTab: 'discover', theme: this.theme })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private DiscoverDestinations(name: string, params?: DiscoverFlowRouteParams) {
    if (name === DISCOVER_ROUTE_SUBSCRIBE_CONFIG) {
      DiscoverSubscribeConfigDestination({
        targetUrl: normalizeDiscoverFlowRouteParams(params).targetUrl,
        targetTitle: normalizeDiscoverFlowRouteParams(params).targetTitle,
        targetSiteUrl: normalizeDiscoverFlowRouteParams(params).siteUrl,
        targetDescription: normalizeDiscoverFlowRouteParams(params).description,
        sourceKind: normalizeDiscoverFlowRouteParams(params).sourceKind,
        initialSelectedView: normalizeDiscoverFlowRouteParams(params).targetView,
        theme: this.theme,
      })
    } else if (name === DISCOVER_ROUTE_PREVIEW) {
      DiscoverPreviewDestination({
        targetUrl: normalizeDiscoverFlowRouteParams(params).targetUrl,
        initialTargetTitle: normalizeDiscoverFlowRouteParams(params).targetTitle,
        initialTargetSiteUrl: normalizeDiscoverFlowRouteParams(params).siteUrl,
        initialTargetDescription: normalizeDiscoverFlowRouteParams(params).description,
        targetCategory: normalizeDiscoverFlowRouteParams(params).category,
        targetView: normalizeDiscoverFlowRouteParams(params).targetView,
        theme: this.theme,
      })
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
  @Prop targetUrl: string = ''
  @Prop targetTitle: string = ''
  @Prop targetSiteUrl: string = ''
  @Prop targetDescription: string = ''
  @Prop sourceKind: string = ''
  @Prop initialSelectedView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State selectedView: FeedViewType = FeedViewType.Articles

  aboutToAppear(): void {
    this.selectedView = this.initialSelectedView
  }

  private options(): ConfigOption[] {
    if (this.isBilibiliSource()) {
      return [
        { view: FeedViewType.SocialMedia, label: '社交', description: '订阅 Bilibili 动态更新' },
        { view: FeedViewType.Videos, label: '视频', description: '订阅 Bilibili 视频更新' },
      ]
    }

    return [
      { view: FeedViewType.Articles, label: '文章', description: '适合博客、资讯和长文内容' },
      { view: FeedViewType.SocialMedia, label: '社交', description: '适合动态流、短内容和讨论' },
      { view: FeedViewType.Pictures, label: '图片', description: '适合图片集、摄影和视觉内容' },
      { view: FeedViewType.Videos, label: '视频', description: '适合频道更新、视频和播客' },
    ]
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

  private continueToPreview(): void {
    this.discoverPathStack.pushPathByName(
      DISCOVER_ROUTE_PREVIEW,
      createDiscoverFlowRouteParams(
        this.mappedTargetUrl(),
        this.targetTitle,
        this.selectedView,
        this.targetSiteUrl,
        this.targetDescription,
        this.sourceKind,
        '',
      ),
      true,
    )
  }

  @Builder
  private HeaderSection() {
    Row() {
      Text('‹')
        .fontSize(28)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(40)
        .height(40)
        .textAlign(TextAlign.Center)
        .borderRadius(999)
        .backgroundColor(this.theme.elevated)
        .onClick(() => {
          this.discoverPathStack.pop(true)
        })

      Blank()
    }
    .width('100%')
  }

  @Builder
  private OptionCard(option: ConfigOption) {
    Column({ space: 6 }) {
      Text(option.label)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.selectedView === option.view ? '#FFFFFF' : this.theme.textPrimary)
        .width('100%')

      Text(option.description)
        .fontSize(12)
        .lineHeight(20)
        .fontColor(this.selectedView === option.view ? 'rgba(255,255,255,0.82)' : this.theme.textSecondary)
        .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.selectedView === option.view ? this.theme.accent : this.theme.surface)
    .borderRadius(22)
    .alignItems(HorizontalAlign.Start)
    .animation({ duration: 180, curve: Curve.EaseInOut })
    .onClick(() => {
      this.selectedView = option.view
    })
  }

  build() {
    Column({ space: 14 }) {
      this.HeaderSection()

      Column({ space: 6 }) {
        Text('订阅到哪个栏目')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .width('100%')

        Text(this.targetTitle || '选择一个最合适的栏目，然后继续预览。')
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
          .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)

      Column({ space: 12 }) {
        ForEach(this.options(), (option: ConfigOption) => {
          this.OptionCard(option)
        }, (option: ConfigOption) => `${option.view}`)
      }
      .width('100%')

      Blank()

      Button('继续')
        .type(ButtonType.Capsule)
        .width('100%')
        .height(54)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .backgroundColor(this.theme.accent)
        .fontColor('#FFFFFF')
        .onClick(() => {
          this.continueToPreview()
        })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 18, right: 18, top: 20, bottom: 24 })
    .backgroundColor(this.theme.background)
  }
}

@Component
struct DiscoverPreviewDestination {
  @Consume('DiscoverNavPathStack') discoverPathStack: NavPathStack
  @Prop targetUrl: string = ''
  @Prop initialTargetTitle: string = ''
  @Prop initialTargetSiteUrl: string = ''
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State targetTitle: string = ''
  @State targetSiteUrl: string = ''
  @State targetDescription: string = ''
  @State previewPayload: FeedRefreshPayload | undefined = undefined
  @State previewError: string = ''
  @State isLoading: boolean = false
  @State isSubmitting: boolean = false
  @State existingFeed: Feed | undefined = undefined

  aboutToAppear(): void {
    this.targetTitle = this.initialTargetTitle
    this.targetSiteUrl = this.initialTargetSiteUrl
    this.targetDescription = this.initialTargetDescription
    void this.loadPage()
  }

  private viewLabel(view: FeedViewType): string {
    switch (view) {
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

  private hostOf(value: string): string {
    const matched = value.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private avatarFallback(): string {
    const title = (this.previewPayload?.feedTitle || this.targetTitle || '?').trim()
    return title ? title.substring(0, 1).toUpperCase() : '?'
  }

  private heroDescription(): string {
    return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl
  }

  private previewEntries(): Entry[] {
    return this.previewPayload?.entries.slice(0, 6) ?? []
  }

  private resolvedAvatarUrl(): string {
    if (this.previewPayload?.imageUrl) {
      return this.previewPayload.imageUrl
    }

    const host = this.hostOf(this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl)
    if (host) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    }
    return ''
  }

  @Builder
  private FeedAvatar() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolvedAvatarUrl()) {
        Image(this.resolvedAvatarUrl())
          .width(56)
          .height(56)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
      } else {
        Row()
          .width(56)
          .height(56)
          .borderRadius(18)
          .backgroundColor(this.theme.accent)

        Text(this.avatarFallback())
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
  }

  @Builder
  private HeaderSection() {
    Row() {
      Text('‹')
        .fontSize(28)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(40)
        .height(40)
        .textAlign(TextAlign.Center)
        .borderRadius(999)
        .backgroundColor(this.theme.elevated)
        .onClick(() => {
          this.discoverPathStack.pop(true)
        })

      Blank()
    }
    .width('100%')
  }

  @Builder
  private HeroCard() {
    Column({ space: 14 }) {
      Row({ space: 14 }) {
        this.FeedAvatar()

        Column({ space: 6 }) {
          Text(this.previewPayload?.feedTitle || this.targetTitle)
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(this.hostOf(this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl))
            .fontSize(12)
            .fontColor(this.theme.textMuted)
            .maxLines(1)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')

      if (this.heroDescription()) {
        Text(this.heroDescription())
          .fontSize(15)
          .lineHeight(24)
          .fontColor(this.theme.textSecondary)
          .width('100%')
      }
    }
    .width('100%')
    .padding(20)
    .backgroundColor(this.theme.surface)
    .borderRadius(28)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private PreviewSection() {
    Column({ space: 12 }) {
      Row() {
        Text('内容预览')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
      }
      .width('100%')

      Column({ space: 10 }) {
        ForEach(this.previewEntries(), (entry: Entry, index: number) => {
          Column({ space: 8 }) {
            Row({ space: 8 }) {
              Text(`${index + 1}`)
                .fontSize(11)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.accent)
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .backgroundColor(this.theme.elevated)
                .borderRadius(999)

              Text(entry.author || '未知作者')
                .fontSize(11)
                .fontColor(this.theme.textMuted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })

              Blank()

              Text(`${entry.readingTimeMinutes} 分钟`)
                .fontSize(11)
                .fontColor(this.theme.textMuted)
            }
            .width('100%')

            Text(entry.title)
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            Text(entry.summary)
              .fontSize(13)
              .lineHeight(21)
              .fontColor(this.theme.textSecondary)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .width('100%')
          .padding(16)
          .backgroundColor(this.theme.surface)
          .borderRadius(22)
          .alignItems(HorizontalAlign.Start)
        }, (entry: Entry) => entry.id)
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  private normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, '').toLowerCase()
  }

  private feedMatchesTarget(feed: Feed, targetUrl: string, siteUrl: string): boolean {
    const normalizedTarget = this.normalizeUrl(targetUrl)
    const normalizedSite = this.normalizeUrl(siteUrl)
    return this.normalizeUrl(feed.url) === normalizedTarget
      || (!!feed.siteUrl && this.normalizeUrl(feed.siteUrl) === normalizedTarget)
      || (!!siteUrl && this.normalizeUrl(feed.url) === normalizedSite)
      || (!!feed.siteUrl && !!siteUrl && this.normalizeUrl(feed.siteUrl) === normalizedSite)
  }

  private async findExistingFeed(targetUrl: string, siteUrl: string): Promise<Feed | undefined> {
    const feeds = await AppRepository.feedEntities()
    return feeds.find((feed: Feed) => this.feedMatchesTarget(feed, targetUrl, siteUrl))
  }

  private async loadPage(): Promise<void> {
    if (!this.targetUrl) {
      this.previewError = '订阅源参数缺失'
      return
    }

    this.isLoading = true
    this.previewError = ''
    try {
      const payload = await RssFeedService.previewFeedUrl(this.targetUrl)
      this.previewPayload = payload
      this.existingFeed = await this.findExistingFeed(this.targetUrl, payload.siteUrl)
      if (!this.targetTitle) {
        this.targetTitle = payload.feedTitle
      }
      if (!this.targetSiteUrl) {
        this.targetSiteUrl = payload.siteUrl
      }
      if (!this.targetDescription) {
        this.targetDescription = payload.description
      }
    } catch (e) {
      this.previewError = e instanceof Error ? e.message : '预览失败'
    } finally {
      this.isLoading = false
    }
  }

  private async submit(): Promise<void> {
    if (!this.previewPayload || !this.targetUrl) {
      return
    }

    this.isSubmitting = true
    try {
      const draft: FeedDraft = {
        title: this.previewPayload.feedTitle || this.targetTitle || this.targetUrl,
        url: this.targetUrl,
        siteUrl: this.previewPayload.siteUrl || this.targetSiteUrl,
        description: this.previewPayload.description || this.targetDescription,
        category: this.targetCategory || this.viewLabel(this.targetView),
        view: this.targetView,
        showInAll: this.existingFeed ? this.existingFeed.showInAll : true,
      }

      if (this.existingFeed) {
        await AppRepository.updateFeed(this.existingFeed.id, draft)
        await AppRepository.refreshFeed(this.existingFeed.id)
        promptAction.showToast({ message: '订阅已更新' })
      } else {
        const created = await AppRepository.createFeed(draft)
        await AppRepository.refreshFeed(created.id)
        promptAction.showToast({ message: '订阅已添加' })
      }

      this.discoverPathStack.clear(true)
    } catch (_) {
      promptAction.showToast({ message: '添加失败，请检查链接或网络' })
    } finally {
      this.isSubmitting = false
    }
  }

  build() {
    Column({ space: 0 }) {
      if (this.isLoading) {
        Column({ space: 12 }) {
          LoadingProgress()
            .width(42)
            .height(42)
            .color(this.theme.accent)

          Text('正在加载订阅预览...')
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.previewError) {
        Column({ space: 16 }) {
          this.HeaderSection()

          Column({ space: 10 }) {
            Text('预览失败')
              .fontSize(20)
              .fontWeight(FontWeight.Bold)
              .fontColor('#EF4444')

            Text(this.previewError)
              .fontSize(14)
              .fontColor(this.theme.textSecondary)
              .lineHeight(22)
          }
          .width('100%')
          .padding(20)
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
        }
        .width('100%')
        .layoutWeight(1)
        .padding(18)
      } else if (this.previewPayload) {
        Scroll() {
          Column({ space: 14 }) {
            this.HeaderSection()
            this.HeroCard()
            this.PreviewSection()
            Row().height(104).width('100%')
          }
          .width('100%')
          .padding({ left: 18, right: 18, top: 20, bottom: 24 })
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }

      if (this.previewPayload && !this.isLoading) {
        Row({ space: 10 }) {
          Button(this.isSubmitting ? '处理中...' : (this.existingFeed ? '更新订阅' : '添加订阅'))
            .type(ButtonType.Capsule)
            .backgroundColor(this.theme.accent)
            .fontColor('#FFFFFF')
            .enabled(!this.isSubmitting)
            .layoutWeight(1)
            .height(54)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .onClick(() => {
              void this.submit()
            })
        }
        .width('100%')
        .padding({ left: 18, right: 18, top: 12, bottom: 18 })
        .backgroundColor(this.theme.background)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
