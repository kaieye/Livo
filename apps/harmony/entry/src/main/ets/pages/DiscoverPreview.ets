import { FeedRepository } from '../common/repositories/FeedRepository'
import { AppPreferenceService } from '../common/services/AppPreferenceService'
import { FeedRefreshCoordinator } from '../common/data/FeedRefreshCoordinator'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { Entry, Feed, FeedViewType, formatPublishedAt } from '../common/models/LivoModels'

import { FeedDraft } from '../common/repositories/FeedRepository'
import { FeedRefreshPayload, RssFeedService } from '../common/services/RssFeedService'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { resolveSocialFeedDisplayImageUrl } from '../common/utils/SocialFeedPresentation'
import { PageHeader } from '../common/components/PageHeader'
import { SecondaryPageHeaderShell } from '../common/components/SecondaryPageHeaderShell'
import { PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'

@Entry
@Component
struct DiscoverPreview {
  @State theme: ThemePalette = ThemeService.lightPalette()
  @State targetUrl: string = ''
  @State targetTitle: string = ''
  @State targetSiteUrl: string = ''
  @State targetImageUrl: string = ''
  @State targetDescription: string = ''
  @State targetCategory: string = ''
  @State targetView: FeedViewType = FeedViewType.Articles
  @State sourceKind: string = ''
  @State previewPayload: FeedRefreshPayload | undefined = undefined
  @State previewError: string = ''
  @State isLoading: boolean = true
  @State isSubmitting: boolean = false
  @State existingFeed: Feed | undefined = undefined

  aboutToAppear(): void {
    void this.loadPage()
  }

  private params(): Record<string, string> {
    return getStringParams()
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

  private publishedLabel(entry: Entry): string {
    return formatPublishedAt(entry.publishedAt)
  }

  private resolvedAvatarUrl(): string {
    const resolved = resolveSocialFeedDisplayImageUrl(
      this.previewPayload?.imageUrl || this.targetImageUrl || this.existingFeed?.imageUrl || '',
      this.previewPayload?.resolvedFeedUrl || this.targetUrl,
      this.previewPayload?.siteUrl || this.targetSiteUrl,
      this.previewPayload?.feedTitle || this.targetTitle,
    )
    if (resolved) {
      return resolved
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
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.previewPayload?.feedTitle || this.targetTitle || '订阅预览',
        theme: this.theme,
        showBackButton: true,
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => { void goBack() },
      })
        .width('100%')
    }
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
        ForEach(this.previewEntries(), (entry: Entry) => {
          Column({ space: 8 }) {
            Row({ space: 8 }) {
              Text(entry.author || '未知作者')
                .fontSize(11)
                .fontColor(this.theme.textMuted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })

              Blank()

              Text(this.publishedLabel(entry))
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
    const feeds = await FeedRepository.list()
    return feeds.find((feed: Feed) => this.feedMatchesTarget(feed, targetUrl, siteUrl))
  }

  private async loadPage(): Promise<void> {
    this.isLoading = true
    this.previewError = ''
    this.previewPayload = undefined
    this.existingFeed = undefined

    try {
      const settings = await AppPreferenceService.loadSettings()
      this.theme = await ThemeService.resolvePalette(settings)

      const params = this.params()
      this.targetUrl = params.targetUrl ?? ''
      this.targetTitle = params.targetTitle ?? ''
      this.targetSiteUrl = params.siteUrl ?? ''
      this.targetImageUrl = params.imageUrl ?? ''
      this.targetDescription = params.description ?? ''
      this.targetCategory = params.category ?? ''
      this.sourceKind = params.sourceKind ?? ''
      const parsedView = Number(params.view ?? FeedViewType.Articles)
      this.targetView = parsedView as FeedViewType

      if (!this.targetUrl) {
        this.previewError = '订阅源参数缺失'
        return
      }

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
        imageUrl: this.previewPayload.imageUrl || this.existingFeed?.imageUrl || '',
        description: this.previewPayload.description || this.targetDescription,
        category: this.targetCategory || this.viewLabel(this.targetView),
        view: this.targetView,
        showInAll: this.existingFeed ? this.existingFeed.showInAll : true,
      }

      if (this.existingFeed) {
        await FeedRepository.update(this.existingFeed.id, draft)
        await FeedRefreshCoordinator.refreshFeed(this.existingFeed.id)
        this.showToast('订阅已更新')
      } else {
        const created = await FeedRepository.create(draft)
        await FeedRefreshCoordinator.refreshFeed(created.id)
        this.showToast('订阅已添加')
      }

      void goBack()
    } catch (_) {
      this.showToast('添加失败，请检查链接或网络')
    } finally {
      this.isSubmitting = false
    }
  }

  private showToast(message: string, duration: number = 2000): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  build() {
    Column({ space: 0 }) {
      this.HeaderSection()

      if (this.isLoading) {
        Column({ space: 12 }) {
          LoadingProgress().width(42).height(42).color(this.theme.accent)
          Text('正在加载订阅预览...')
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
        .justifyContent(FlexAlign.Center)
      } else if (this.previewError) {
        Column({ space: 16 }) {
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
          .borderRadius(24)
        }
        .width('100%')
        .layoutWeight(1)
        .padding({ left: 18, right: 18, bottom: 18 })
      } else if (this.previewPayload) {
        Scroll() {
          Column({ space: 18 }) {
            this.HeroCard()
            this.PreviewSection()
            Row().height(104).width('100%')
          }
          .width('100%')
          .padding({ left: 18, right: 18, top: 0, bottom: 24 })
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      } else {
        Column({ space: 12 }) {
          LoadingProgress().width(42).height(42).color(this.theme.accent)
          Text('正在初始化页面...')
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .padding({ left: 18, right: 18 })
        .justifyContent(FlexAlign.Center)
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
            .onClick(() => { void this.submit() })
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

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
