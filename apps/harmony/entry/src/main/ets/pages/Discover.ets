import router from '@ohos.router'
import { AppRepository } from '../common/data/AppRepository'
import { BottomTabs } from '../common/components/BottomTabs'
import { FeedViewType } from '../common/models/LivoModels'
import { DiscoverRemoteSearchService } from '../common/services/DiscoverRemoteSearchService'
import {
  discoverFeedPlatform,
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
} from '../common/services/DiscoverService'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

interface DirectUrlResult {
  targetUrl: string
  siteUrl: string
  title: string
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

@Entry
@Component
struct Discover {
  @State query: string = ''
  @State searchPlatform: DiscoverSearchPlatform = 'all'
  @State theme: ThemePalette = ThemeService.darkPalette()
  @State remoteResults: ResolvedDiscoverCandidate[] = []
  @State isSearchingRemote: boolean = false
  private searchSession: number = 0

  aboutToAppear(): void {
    void this.loadData()
  }

  private async loadData(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  private viewLabel(view: FeedViewType): string {
    return discoverViewLabel(view)
  }

  private normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, '').toLowerCase()
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
    router.pushUrl({
      url: 'pages/DiscoverPreview',
      params: {
        targetUrl,
        targetTitle,
        view: `${targetView}`,
        siteUrl,
        description,
        sourceKind,
        category,
      },
    })
  }

  private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate): void {
    router.pushUrl({
      url: 'pages/DiscoverSubscribeConfig',
      params: {
        targetUrl: candidate.targetUrl,
        targetTitle: candidate.targetTitle,
        view: `${candidate.targetView}`,
        siteUrl: candidate.siteUrl,
        description: candidate.description,
        sourceKind: candidate.sourceKind,
        category: this.resolvedPlatformLabel(candidate),
      },
    })
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

  private recommendedPlatformLabel(feed: RecommendedFeed): string {
    const platform = discoverFeedPlatform(feed)
    if (platform === 'all') {
      const site = feed.siteUrl.toLowerCase()
      if (site.includes('openai.com')) {
        return 'OpenAI'
      }
      if (site.includes('github.')) {
        return 'GitHub'
      }
      return this.viewLabel(feed.view)
    }
    return discoverPlatformLabel(platform)
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

  private initialsLabel(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) {
      return '?'
    }
    return trimmed.substring(0, 1).toUpperCase()
  }

  @Builder
  private SectionTitle() {
    Row() {
      Text('添加订阅')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .width('100%')
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  private PlatformChip(platform: DiscoverSearchPlatform) {
    Text(discoverPlatformLabel(platform))
      .fontSize(11)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.searchPlatform === platform ? '#FFFFFF' : this.theme.textSecondary)
      .padding({ left: 12, right: 12, top: 8, bottom: 8 })
      .backgroundColor(this.searchPlatform === platform ? this.theme.accent : this.theme.elevated)
      .borderRadius(999)
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
          .borderRadius(18)
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
            .borderRadius(999)
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
    .borderRadius(24)
  }

  @Builder
  private SectionHeader(title: string, count: number) {
    Row() {
      Text(title)
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Blank()

      Text(`${count}`)
        .fontSize(12)
        .fontColor(this.theme.textMuted)
    }
    .width('100%')
  }

  @Builder
  private AvatarBox(imageUrl: string, fallbackLabel: string, accent: string) {
    Stack({ alignContent: Alignment.Center }) {
      if (imageUrl) {
        Image(imageUrl)
          .width(38)
          .height(38)
          .borderRadius(10)
          .backgroundColor(this.theme.elevated)
      } else {
        Row()
          .width(38)
          .height(38)
          .borderRadius(10)
          .backgroundColor(accent)

        Text(this.initialsLabel(fallbackLabel))
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
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
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          this.ResultMeta('地址', discoverPlatformLabel(this.searchPlatform), '')

          Text(result.targetUrl)
            .fontSize(12)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 14 })
      .backgroundColor(this.theme.surface)
      .borderRadius(20)
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
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            Text(candidate.description)
              .fontSize(12)
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
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .height(32)
          .backgroundColor(this.theme.elevated)
          .fontColor(this.theme.textPrimary)
          .onClick(() => {
            this.openSubscribeConfigPage(candidate)
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 14 })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 16, right: 16 })
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
        .borderRadius(24)
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
              .fontSize(13)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 16, bottom: 16 })
          .backgroundColor(this.theme.surface)
          .borderRadius(20)
        } else {
          Column() {
            ForEach(this.searchResults(), (candidate: ResolvedDiscoverCandidate, index: number) => {
              this.CandidateRow(candidate, index < this.searchResults().length - 1)
            }, (candidate: ResolvedDiscoverCandidate) => `search-${candidate.targetUrl}`)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(24)
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
        .borderRadius(24)
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
    .borderRadius(24)
  }

  build() {
    Column() {
      Column({ space: 18 }) {
        this.SectionTitle()
        this.SearchPanel()
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 18, bottom: 10 })
      .alignItems(HorizontalAlign.Start)

      Scroll() {
        Column({ space: 18 }) {
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

          Row().height(24).width('100%')
        }
        .width('100%')
        .padding({ left: 18, right: 18, top: 0, bottom: 24 })
        .justifyContent(FlexAlign.Start)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)

      BottomTabs({ activeTab: 'discover', theme: this.theme })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
  }
}
