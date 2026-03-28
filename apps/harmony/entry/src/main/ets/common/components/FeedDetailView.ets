import { AppRepository } from '../data/AppRepository'
import { Entry, Feed, FeedCardModel, FeedViewType, formatPublishedAt } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'

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
  onOpenArticle: (entry: Entry) => void = () => {}

  @State private targetTitle: string = ''
  @State private targetSiteUrl: string = ''
  @State private targetDescription: string = ''
  @State private previewPayload: FeedRefreshPayload | undefined = undefined
  @State private previewError: string = ''
  @State private isLoading: boolean = true
  @State private isRefreshing: boolean = false
  @State private existingFeed: Feed | undefined = undefined

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
        }
      } else if (this.targetUrl) {
        // Mode: Discover Preview
        this.existingFeed = await this.findExistingFeed(this.targetUrl, this.targetSiteUrl)
        const payload = await RssFeedService.previewFeedUrl(this.targetUrl)
        this.previewPayload = payload
        
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
      } else if (this.targetUrl) {
        const payload = await RssFeedService.previewFeedUrl(this.targetUrl)
        this.previewPayload = payload
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

  private heroDescription(): string {
    return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl
  }

  private previewEntries(): Entry[] {
    return this.previewPayload?.entries.slice(0, 50) ?? []
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
    Row() {
      // 返回按钮
      Text('‹')
        .fontSize(28)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)
        .width(40)
        .height(40)
        .textAlign(TextAlign.Center)
        .onClick(() => { this.onBack() })

      // 中间居中：头像 + 名称
      if (!this.isLoading && this.previewPayload) {
        Row({ space: 8 }) {
          this.FeedAvatar(32, 10, 14)

          Text(this.previewPayload?.feedTitle || this.targetTitle)
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        Blank().layoutWeight(1)
      }

      // 右侧：编辑按钮或占位
      if (!this.isLoading && this.existingFeed) {
        Text('编辑')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .width(40)
          .height(40)
          .textAlign(TextAlign.Center)
          .onClick(() => { this.onEdit(this.existingFeed!) })
      } else {
        Row().width(40).height(40)
      }
    }
    .width('100%')
    .padding({ left: 18, right: 18, top: 12, bottom: 12 })
    .alignItems(VerticalAlign.Center)
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
      this.onOpenArticle(entry)
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
