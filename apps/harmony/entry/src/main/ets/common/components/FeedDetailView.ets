import http from '@ohos.net.http'
import { AppRepository } from '../data/AppRepository'
import { Entry, Feed, FeedCardModel, FeedViewType, formatPublishedAt } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import { PageHeader } from './PageHeader'
import { PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from '../ui/UiTokens'

interface VideoPreviewCacheItem {
  videoUrl: string
  previewUrl: string
}

@Component
export struct FeedDetailView {
  @Prop feedId: string = ''
  @Prop targetUrl: string = ''
  @Prop initialTargetTitle: string = ''
  @Prop initialTargetSiteUrl: string = ''
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  
  // Callbacks for navigation and actions
  onBack: () => void = () => {}
  onEdit: (feed: Feed) => void = () => {}
  onSubscribe: (payload: FeedRefreshPayload) => void = () => {}
  onOpenArticle: (entry: Entry, feed: Feed) => void = () => {}

  @State private targetTitle: string = ''
  @State private targetSiteUrl: string = ''
  @State private targetDescription: string = ''
  @State private previewPayload: FeedRefreshPayload | undefined = undefined
  @State private previewError: string = ''
  @State private isLoading: boolean = true
  @State private isRefreshing: boolean = false
  @State private existingFeed: Feed | undefined = undefined
  @State private videoPreviewCache: VideoPreviewCacheItem[] = []

  aboutToAppear(): void {
    this.targetTitle = this.initialTargetTitle
    this.targetSiteUrl = this.initialTargetSiteUrl
    this.targetDescription = this.initialTargetDescription
    void this.loadData()
  }

  private async loadData(): Promise<void> {
    this.isLoading = true
    this.previewError = ''
    
    try {
      if (this.feedId) {
        // Mode: Subscribed Feed
        const feed = await AppRepository.feedEntityById(this.feedId)
        if (feed) {
          this.existingFeed = feed
          this.targetTitle = feed.title
          this.targetSiteUrl = feed.siteUrl || ''
          this.targetDescription = feed.description || ''
          
          const entries = await AppRepository.entryEntitiesByFeed(this.feedId)
          // For the shared view, we'll construct a pseudo-payload
          this.previewPayload = {
            etag: feed.etag || '',
            lastModified: feed.lastModified || '',
            feedTitle: feed.title,
            siteUrl: feed.siteUrl || '',
            imageUrl: feed.imageUrl || '',
            description: feed.description || '',
            entries: entries
          }
          void this.hydrateVideoPreviews(entries)
        }
      } else if (this.targetUrl) {
        // Mode: Discover Preview
        this.existingFeed = await this.findExistingFeed(this.targetUrl, this.targetSiteUrl)
        const payload = await RssFeedService.previewFeedUrl(this.targetUrl)
        this.previewPayload = payload
        void this.hydrateVideoPreviews(payload.entries)
        
        // If it matches an existing entry, update it
        if (!this.existingFeed && payload.siteUrl) {
           this.existingFeed = await this.findExistingFeed(this.targetUrl, payload.siteUrl)
        }
      }
    } catch (e) {
      this.previewError = `加载失败: ${e instanceof Error ? e.message : '未知错误'}`
    } finally {
      this.isLoading = false
    }
  }

  private async refreshData(): Promise<void> {
    if (this.isRefreshing) return
    this.isRefreshing = true
    try {
      if (this.existingFeed) {
        await AppRepository.refreshFeed(this.existingFeed.id)
        const entries = await AppRepository.entryEntitiesByFeed(this.existingFeed.id)
        if (this.previewPayload) {
          this.previewPayload.entries = entries
        }
        void this.hydrateVideoPreviews(entries)
      } else if (this.targetUrl) {
        const payload = await RssFeedService.previewFeedUrl(this.targetUrl)
        this.previewPayload = payload
        void this.hydrateVideoPreviews(payload.entries)
      }
    } finally {
      this.isRefreshing = false
    }
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

  private hostOf(value: string): string {
    const matched = value.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private avatarFallback(): string {
    const title = (this.previewPayload?.feedTitle || this.targetTitle || '?').trim()
    return title ? title.substring(0, 1).toUpperCase() : '?'
  }

  private extractYouTubeVideoId(value: string): string {
    const matched = (value || '').match(
      /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    )
    return matched?.[1] ?? ''
  }

  private extractBilibiliVideoToken(value: string): string {
    const bvid = (value || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1]
    if (bvid) {
      return `BV:${bvid}`
    }

    const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
    if (aid) {
      return `AV:${aid}`
    }

    return ''
  }

  private normalizeVideoUrl(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }

    if (isDirectVideoUrl(trimmed)) {
      return trimmed
    }

    const youTubeId = this.extractYouTubeVideoId(trimmed)
    if (youTubeId) {
      return `https://www.youtube.com/watch?v=${youTubeId}`
    }

    const bilibiliToken = this.extractBilibiliVideoToken(trimmed)
    if (bilibiliToken.startsWith('BV:')) {
      return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`
    }
    if (bilibiliToken.startsWith('AV:')) {
      return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`
    }

    return ''
  }

  private entryVideoUrl(entry: Entry): string {
    const directMediaUrl = (entry.mediaUrls ?? []).find((url: string) => isDirectVideoUrl(url))
    if (directMediaUrl) {
      return directMediaUrl
    }

    const candidates: string[] = [entry.url, entry.content, entry.summary]
    for (const candidate of candidates) {
      const normalized = this.normalizeVideoUrl(candidate || '')
      if (normalized) {
        return normalized
      }
    }

    const rawContent = `${entry.content || ''}\n${entry.summary || ''}`
    const matched = rawContent.match(
      /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/i,
    )?.[0] ?? ''
    if (!matched) {
      return ''
    }
    return this.normalizeVideoUrl(matched.startsWith('http') ? matched : `https://${matched}`)
  }

  private entryVideoPreviewUrl(entry: Entry): string {
    const videoUrl = this.entryVideoUrl(entry)
    const cached = this.videoPreviewCache.find((item: VideoPreviewCacheItem) => item.videoUrl === videoUrl)
    if (cached?.previewUrl) {
      return cached.previewUrl
    }
    const youTubeId = this.extractYouTubeVideoId(videoUrl)
    if (youTubeId) {
      return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`
    }
    return ''
  }

  private entryVideoSourceLabel(entry: Entry): string {
    const lower = this.entryVideoUrl(entry).toLowerCase()
    if (isDirectVideoUrl(lower)) {
      return '直链'
    }
    if (lower.includes('youtube.com')) {
      return 'YouTube'
    }
    if (lower.includes('bilibili.com')) {
      return 'Bilibili'
    }
    return ''
  }

  private async hydrateVideoPreviews(entries: Entry[]): Promise<void> {
    for (const entry of entries) {
      const videoUrl = this.entryVideoUrl(entry)
      if (!videoUrl || this.entryVideoPreviewUrl(entry)) {
        continue
      }

      const previewUrl = await this.fetchBilibiliVideoPreviewUrl(videoUrl)
      if (!previewUrl) {
        continue
      }

      const existingIndex = this.videoPreviewCache.findIndex((item: VideoPreviewCacheItem) => item.videoUrl === videoUrl)
      const nextCache = [...this.videoPreviewCache]
      const item: VideoPreviewCacheItem = { videoUrl, previewUrl }
      if (existingIndex >= 0) {
        nextCache[existingIndex] = item
      } else {
        nextCache.push(item)
      }
      this.videoPreviewCache = nextCache
    }
  }

  private async fetchBilibiliVideoPreviewUrl(videoUrl: string): Promise<string> {
    if (!videoUrl.toLowerCase().includes('bilibili.com')) {
      return ''
    }

    const bvid = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1] ?? ''
    if (!bvid) {
      return ''
    }

    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 5000,
          readTimeout: 5000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://www.bilibili.com/video/${bvid}`,
            'Origin': 'https://www.bilibili.com',
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const payload = JSON.parse(String(response.result)) as Record<string, Object | string | number>
      const data = payload['data'] as Record<string, string> | undefined
      return typeof data?.['pic'] === 'string' ? data['pic'] : ''
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }

  private heroDescription(): string {
    return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl
  }

  private previewEntries(): Entry[] {
    return this.previewPayload?.entries.slice(0, 50) ?? []
  }

  private articleDetailFeed(entry: Entry): Feed {
    if (this.existingFeed) {
      return this.existingFeed
    }

    return {
      id: entry.feedId || this.feedId || 'preview',
      title: this.previewPayload?.feedTitle || this.targetTitle || '预览内容',
      url: this.targetUrl || entry.url,
      siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || entry.url,
      imageUrl: this.previewPayload?.imageUrl || '',
      description: this.previewPayload?.description || this.targetDescription || '',
      category: this.targetCategory || '未分类',
      view: this.targetView,
      showInAll: true,
      errorCount: 0,
      createdAt: 0,
      updatedAt: 0,
    }
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
  private FeedAvatar(size: number = 32, radius: number = 10, fontSize: number = 14) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolvedAvatarUrl()) {
        Image(this.resolvedAvatarUrl())
          .width(size)
          .height(size)
          .borderRadius(radius)
          .backgroundColor(this.theme.elevated)
      } else {
        Row()
          .width(size)
          .height(size)
          .borderRadius(radius)
          .backgroundColor(this.theme.accent)

        Text(this.avatarFallback())
          .fontSize(fontSize)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
  }

  @Builder
  private HeaderSection() {
    PageHeader({
      title: this.previewPayload?.feedTitle || this.targetTitle || '订阅详情',
      theme: this.theme,
      showBackButton: true,
      trailingText: !this.isLoading && this.existingFeed ? '编辑' : '',
      titleSize: 20,
      topPadding: 0,
      bottomPadding: 0,
      onBack: () => { this.onBack() },
      onTrailingClick: () => {
        if (this.existingFeed) {
          this.onEdit(this.existingFeed)
        }
      },
    })
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 4 })
  }

  @Builder
  private DescriptionCard() {
    if (this.heroDescription()) {
      Column({ space: 8 }) {
        Text('简介')
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Text(this.heroDescription())
          .fontSize(14)
          .lineHeight(22)
          .fontColor(this.theme.textSecondary)
      }
      .width('100%')
      .padding(16)
      .backgroundColor(this.theme.surface)
      .borderRadius(20)
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private EntryCard(entry: Entry, index: number) {
    Column({ space: 8 }) {
      if (this.entryVideoPreviewUrl(entry)) {
        Stack({ alignContent: Alignment.TopStart }) {
          Image(this.entryVideoPreviewUrl(entry))
            .width('100%')
            .height(172)
            .objectFit(ImageFit.Cover)
            .borderRadius(16)

          Text(this.entryVideoSourceLabel(entry) || '视频')
            .fontSize(11)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .backgroundColor('rgba(17,24,39,0.72)')
            .borderRadius(999)
            .margin({ left: 12, top: 12 })
        }
        .width('100%')
        .clip(true)
      }

      Row({ space: 8 }) {
        Text(entry.author || '未知作者')
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(11)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(entry.publishedAt))
          .fontSize(11)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(entry.title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(22)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (entry.summary) {
        Text(entry.summary)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      if (this.entryVideoSourceLabel(entry)) {
        Text(`${this.entryVideoSourceLabel(entry)} 视频源`)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
      }
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .alignItems(HorizontalAlign.Start)
    .transition(livoMotion.enterSoft(index * 18 + 40))
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpenArticle(entry, this.articleDetailFeed(entry))
    })
  }

  @Builder
  private PreviewSection() {
    Column({ space: 12 }) {
      Row() {
        Text('内容预览')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Blank()

        Text(`${this.previewEntries().length} 条`)
          .fontSize(12)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Column({ space: 10 }) {
        ForEach(this.previewEntries(), (entry: Entry, index: number) => {
          this.EntryCard(entry, index)
        }, (entry: Entry) => entry.id)
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: 0 }) {
      this.HeaderSection()

      if (this.isLoading) {
        Column({ space: 12 }) {
          LoadingProgress().width(42).height(42).color(this.theme.accent)
          Text('正在加载预览...')
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.previewError) {
        Column({ space: 16 }) {
          Text('预览失败')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
          
          Text(this.previewError)
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
            .textAlign(TextAlign.Center)
            .padding({ left: 32, right: 32 })
            
          Button('重试')
            .onClick(() => { void this.loadData() })
            .backgroundColor(this.theme.accent)
            .fontColor('#FFFFFF')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        Stack({ alignContent: Alignment.Bottom }) {
          Refresh({ refreshing: $$this.isRefreshing }) {
            Scroll() {
              Column({ space: 14 }) {
                this.DescriptionCard()
                this.PreviewSection()
                Row().height(100).width('100%')
              }
              .width('100%')
              .padding({ left: 18, right: 18, top: 0, bottom: 24 })
            }
            .width('100%')
            .height('100%')
            .scrollBar(BarState.Off)
            .edgeEffect(EdgeEffect.Spring)
          }
          .onRefreshing(() => { void this.refreshData() })

          // 如果还没订阅，显示订阅按钮
          if (!this.existingFeed && this.previewPayload) {
            Row() {
              Button('订阅')
                .type(ButtonType.Capsule)
                .width('80%')
                .height(50)
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .backgroundColor(this.theme.accent)
                .fontColor('#FFFFFF')
                .shadow({ radius: 20, color: 'rgba(0,0,0,0.15)', offsetY: 8 })
                .onClick(() => {
                  this.onSubscribe(this.previewPayload!)
                })
            }
            .width('100%')
            .justifyContent(FlexAlign.Center)
            .padding({ bottom: 24 })
            .transition(TransitionEffect.move(TransitionEdge.BOTTOM).combine(TransitionEffect.OPACITY))
          }
        }
        .width('100%')
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
