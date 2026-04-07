import Want from '@ohos.app.ability.Want'
import webview from '@ohos.web.webview'
import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack, openImageViewer, openVideoPlayer } from '../common/navigation/AppRouter'
import { ArticleAssistService } from '../common/services/ArticleAssistService'
import { AppContextService } from '../common/services/AppContextService'
import { VideoResolverService } from '../common/services/VideoResolverService'
import { isDirectVideoUrl } from '../common/utils/FeedMediaUrl'
import { resolveArticleSourceUrl } from '../common/utils/ArticleSourceUrl'
import { resolveYouTubePlaybackDisplay } from '../common/utils/YouTubePlaybackDisplay'
import { resolveVideoPlaybackTarget } from '../common/utils/VideoPlaybackTarget'
import {
  shouldOpenYouTubeExternallyOnFallback,
  shouldUseYouTubeWebFallback,
} from '../common/utils/YouTubePlaybackMode'
import { PageHeader } from '../common/components/PageHeader'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  isLegacyPlainArticleContent,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { HEADER_BACK_SLOT_SIZE, PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from '../common/ui/UiTokens'

@Entry
@Component
struct ArticleDetail {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @State entry?: ArticleDetailModel = undefined
  @State actionHint: string = ''
  @State aiSummary: string = ''
  @State aiEnabled: boolean = false
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State isUpgradingLegacyContent: boolean = false
  @State starScale: number = 1
  @State activeVideoBlockId: string = ''
  @State activeVideoPlayableUrl: string = ''
  @State activeVideoFallbackUrl: string = ''
  @State isResolvingActiveVideo: boolean = false
  private upgradedEntryIds: Set<string> = new Set<string>()
  private videoWebController: webview.WebviewController = new webview.WebviewController()
  private nativeVideoController: VideoController = new VideoController()
  private readonly webVideoUserAgent: string =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

  private animateWithUiContext(options: AnimateParam, event: () => void): void {
    this.getUIContext().animateTo(options, event)
  }

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    void this.loadEntry(true)
  }

  private entryId(): string {
    const params = getStringParams()
    return params?.entryId ?? ''
  }

  private async loadEntry(markRead: boolean): Promise<void> {
    const entryId = this.entryId()
    if (!entryId) {
      this.entry = undefined
      return
    }

    if (markRead) {
      await AppRepository.markRead(entryId, true)
    }

    const params = getStringParams()
    const entryJson = params?.entryJson as string

    if (entryJson) {
      try {
        const parsed = JSON.parse(entryJson) as ArticleDetailModel
        if (parsed) {
          this.entry = parsed
          this.actionHint = ''
          return
        }
      } catch (e) {
        console.error('Failed to parse entryJson', e)
      }
    }

    this.entry = await AppRepository.entryById(entryId)
    const upgraded = await this.upgradeLegacyEntryIfNeeded()
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
    this.aiEnabled = settings.aiSummaryEnabled
    this.aiSummary = this.entry
      ? ArticleAssistService.summarize(this.entry.title, this.entry.summary, this.entry.contentParagraphs)
      : ''
    if (!upgraded) {
      this.actionHint = markRead ? '已标记为已读' : '内容已刷新'
    }
  }

  private async toggleStar(): Promise<void> {
    const entryId = this.entryId()
    if (!entryId) {
      return
    }

    this.animateWithUiContext({ duration: 150, curve: Curve.EaseOut }, () => {
      this.starScale = 1.4
    })

    await AppRepository.toggleStar(entryId)
    await this.loadEntry(false)
    this.actionHint = this.entry?.isStarred ? '已收藏' : '已取消收藏'

    setTimeout(() => {
      this.animateWithUiContext({ duration: 300, curve: Curve.FastOutSlowIn }, () => {
        this.starScale = 1.0
      })
    }, 150)
  }

  private async upgradeLegacyEntryIfNeeded(): Promise<boolean> {
    const current = this.entry
    if (!current) {
      return false
    }

    if (this.upgradedEntryIds.has(current.id)) {
      return false
    }

    const rawContent = current.contentParagraphs.join('\n\n').trim()
    if (!isLegacyPlainArticleContent(rawContent)) {
      return false
    }

    this.upgradedEntryIds.add(current.id)
    this.isUpgradingLegacyContent = true
    this.actionHint = '正在刷新旧版正文格式...'

    try {
      await AppRepository.refreshFeed(current.feedId)
      const refreshed = await AppRepository.entryById(current.id)
      if (refreshed) {
        this.entry = refreshed
      }
      this.actionHint = '已刷新正文排版'
      return true
    } catch (_) {
      this.actionHint = '旧版正文刷新失败，已保留本地内容'
      return true
    } finally {
      this.isUpgradingLegacyContent = false
    }
  }

  private async openExternalUrl(url: string): Promise<void> {
    const trimmed = (url || '').trim()
    if (!trimmed) {
      return
    }

    try {
      const want: Want = {
        action: 'action.view',
        entities: ['entity.default'],
        uri: trimmed,
      }
      await AppContextService.getContext().startAbility(want)
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`
      console.error(`Failed to open external url: ${message}`)
      this.actionHint = '打开视频失败'
    }
  }

  private extractYouTubeVideoId(value: string): string {
    return VideoResolverService.extractYouTubeVideoId(value)
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

  private inAppVideoUrl(videoUrl: string): string {
    const youTubeId = this.extractYouTubeVideoId(videoUrl)
    if (youTubeId) {
      return this.activeVideoFallbackUrl
    }

    const bilibiliToken = this.extractBilibiliVideoToken(videoUrl)
    if (bilibiliToken.startsWith('BV:')) {
      return `https://www.bilibili.com/blackboard/newplayer.html?autoplay=true&danmaku=true&highQuality=true&bvid=${encodeURIComponent(bilibiliToken.substring(3))}`
    }
    if (bilibiliToken.startsWith('AV:')) {
      return `https://www.bilibili.com/blackboard/newplayer.html?autoplay=true&danmaku=true&highQuality=true&aid=${encodeURIComponent(bilibiliToken.substring(3))}`
    }

    return videoUrl
  }

  private cleanText(value: string): string {
    return (value || '')
      .replace(/https?:\/\/[^\s]+/gi, ' ')
      .replace(/\b(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[#@]/g, ' ')
      .replace(/[._-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  private isYouTubeVideo(videoUrl: string): boolean {
    return this.extractYouTubeVideoId(videoUrl).length > 0
  }

  private isDirectVideoFile(videoUrl: string): boolean {
    return isDirectVideoUrl(videoUrl)
  }

  private sourceUrl(): string {
    if (!this.entry) {
      return ''
    }

    return resolveArticleSourceUrl({
      articleUrl: this.entry.articleUrl,
      siteUrl: this.entry.siteUrl,
      contentBlocks: this.entry.contentBlocks,
    })
  }

  private sourceLabel(): string {
    const hasVideoBlock = !!this.entry?.contentBlocks.find((block: ArticleContentBlock) => block.type === 'video')
    return hasVideoBlock ? '视频来源' : '原始来源'
  }

  private shouldRenderSummary(): boolean {
    const summary = this.cleanText(this.entry?.summary ?? '')
    if (!summary) {
      return false
    }

    const title = this.cleanText(this.entry?.title ?? '')
    if (title && (summary === title || summary.includes(title) || title.includes(summary))) {
      return false
    }

    const firstParagraphBlock = this.entry?.contentBlocks.find((block: ArticleContentBlock) => block.type === 'paragraph' && block.text)
    const firstParagraph = this.cleanText(firstParagraphBlock?.text ?? this.entry?.contentParagraphs[0] ?? '')
    if (firstParagraph && (summary === firstParagraph || summary.includes(firstParagraph) || firstParagraph.includes(summary))) {
      return false
    }

    const openingParagraphs = this.cleanText((this.entry?.contentParagraphs ?? []).slice(0, 3).join(' '))
    if (openingParagraphs && (openingParagraphs.includes(summary) || summary.includes(openingParagraphs))) {
      return false
    }

    return true
  }

  private shouldRenderParagraphBlock(block: ArticleContentBlock, index: number): boolean {
    if (block.type !== 'paragraph' || !block.text) {
      return true
    }

    const normalizedParagraph = this.cleanText(block.text)
    if (!normalizedParagraph) {
      return false
    }

    const title = this.cleanText(this.entry?.title ?? '')
    if (title && (normalizedParagraph === title || normalizedParagraph.includes(title))) {
      return false
    }

    if (!this.shouldRenderSummary()) {
      return true
    }

    const normalizedSummary = this.cleanText(this.entry?.summary ?? '')
    if (!normalizedSummary) {
      return true
    }

    if (index <= 2 && (
      normalizedParagraph === normalizedSummary
      || normalizedParagraph.includes(normalizedSummary)
      || normalizedSummary.includes(normalizedParagraph)
    )) {
      return false
    }

    return true
  }

  private isVideoPlaying(block: ArticleContentBlock): boolean {
    return this.activeVideoBlockId === block.id
  }

  private openImageBlock(block: ArticleContentBlock): void {
    if (!block.imageUrl) {
      return
    }

    void openImageViewer(block.imageUrl, this.entry?.title || '图片预览')
  }

  private playVideo(block: ArticleContentBlock): void {
    const playbackTarget = resolveVideoPlaybackTarget(
      this.isYouTubeVideo(block.videoUrl),
      this.isDirectVideoFile(block.videoUrl),
    )
    if (playbackTarget === 'dedicated') {
      void openVideoPlayer(this.entry?.title || '视频播放', block.videoUrl, block.imageUrl || '')
      return
    }

    this.activeVideoBlockId = block.id
    this.activeVideoPlayableUrl = ''
    this.activeVideoFallbackUrl = ''
    this.isResolvingActiveVideo = false
    this.actionHint = ''
    if (this.isDirectVideoFile(block.videoUrl)) {
      this.activeVideoPlayableUrl = block.videoUrl
      return
    }
    if (this.isYouTubeVideo(block.videoUrl)) {
      this.isResolvingActiveVideo = true
      this.actionHint = '正在解析视频地址...'
      void this.resolveAndPlayYouTubeVideo(block.videoUrl)
    }
  }

  private stopVideo(): void {
    this.activeVideoBlockId = ''
    this.activeVideoPlayableUrl = ''
    this.activeVideoFallbackUrl = ''
    this.isResolvingActiveVideo = false
    try {
      this.nativeVideoController.stop()
    } catch (_) {}
  }

  private async resolveAndPlayYouTubeVideo(videoUrl: string): Promise<void> {
    const expectedVideoUrl = videoUrl
    const resolution = await VideoResolverService.resolveYouTubePlayback(videoUrl)

    if (!this.isYouTubeVideo(expectedVideoUrl) || this.activeVideoBlockId.length === 0) {
      return
    }

    this.isResolvingActiveVideo = false
    const displayState = resolveYouTubePlaybackDisplay(
      resolution.playableUrl,
      shouldUseYouTubeWebFallback() ? resolution.fallbackUrl : '',
    )
    this.activeVideoPlayableUrl = displayState.playableUrl
    this.activeVideoFallbackUrl = displayState.fallbackUrl

    if (displayState.playableUrl) {
      this.actionHint = displayState.actionHint
      return
    }

    if (shouldOpenYouTubeExternallyOnFallback()) {
      this.stopVideo()
      this.actionHint = '正在外部打开 YouTube 视频'
      await this.openExternalUrl(videoUrl)
      this.actionHint = '已在外部打开 YouTube 视频'
      return
    }

    this.actionHint = displayState.actionHint
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

  @Builder
  private HeaderIconAction(
    symbol: Resource,
    size: number,
    onTap?: () => void,
    symbolColors?: ResourceColor[],
    backgroundColor?: string,
  ) {
    Row() {
      SymbolGlyph(symbol)
        .fontSize(size)
        .fontColor(symbolColors ?? [this.theme.textSecondary])
        .renderingStrategy(symbol === $r('sys.symbol.lightbulb')
          ? SymbolRenderingStrategy.MULTIPLE_COLOR
          : SymbolRenderingStrategy.SINGLE)
    }
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(backgroundColor ?? Color.Transparent)
      .borderRadius(HEADER_BACK_SLOT_SIZE)
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        if (onTap) {
          onTap()
        }
      })
  }

  @Builder
  private HeaderActions() {
    Row({ space: 4 }) {
      this.HeaderIconAction(
        $r('sys.symbol.lightbulb'),
        24,
        () => { this.actionHint = 'AI 助手功能开发中...' },
        [this.theme.accent, this.theme.textSecondary],
      )

      this.HeaderIconAction(
        $r('sys.symbol.share'),
        22,
        () => { this.actionHint = '分享功能开发中...' },
      )

      this.HeaderIconAction(
        $r(this.entry?.isStarred ? 'sys.symbol.star_fill' : 'sys.symbol.star'),
        22,
        () => { void this.toggleStar() },
        [this.entry?.isStarred ? this.theme.accent : this.theme.textSecondary],
        undefined,
      )
    }
    .height(HEADER_BACK_SLOT_SIZE)
  }

  @Builder
  private ContentBlockItem(block: ArticleContentBlock) {
    if (block.type === 'image' && block.imageUrl) {
      Column({ space: 0 }) {
        Image(block.imageUrl)
          .width('100%')
          .constraintSize({ minHeight: 180, maxHeight: 520 })
          .objectFit(ImageFit.Contain)
          .borderRadius(16)
      }
      .width('100%')
      .clip(true)
      .onClick(() => {
        this.openImageBlock(block)
      })
    } else if (block.type === 'video' && block.videoUrl) {
      Column({ space: 12 }) {
        if (this.isVideoPlaying(block)) {
          Column({ space: 10 }) {
            if (this.isDirectVideoFile(block.videoUrl)) {
              Video({
                src: this.activeVideoPlayableUrl || block.videoUrl,
                controller: this.nativeVideoController,
                previewUri: block.imageUrl || '',
              })
                .width('100%')
                .height(232)
                .borderRadius(18)
                .controls(true)
                .autoPlay(true)
                .objectFit(ImageFit.Contain)
                .onError(() => {
                  this.actionHint = '应用内播放失败，请稍后重试'
                })
            } else if (this.isYouTubeVideo(block.videoUrl)) {
              if (this.activeVideoPlayableUrl) {
                Video({
                  src: this.activeVideoPlayableUrl,
                  controller: this.nativeVideoController,
                  previewUri: block.imageUrl || '',
                })
                  .width('100%')
                  .height(232)
                  .borderRadius(18)
                  .controls(true)
                  .autoPlay(true)
                  .objectFit(ImageFit.Contain)
                  .onError(() => {
                    this.actionHint = '应用内播放失败，请稍后重试'
                  })
              } else if (this.isResolvingActiveVideo) {
                Column({ space: 10 }) {
                  LoadingProgress()
                    .width(28)
                    .height(28)
                    .color(this.theme.accent)

                  Text('正在解析视频地址...')
                    .fontSize(13)
                    .fontColor(this.theme.textSecondary)
                }
                .width('100%')
                .height(232)
                .justifyContent(FlexAlign.Center)
                .alignItems(HorizontalAlign.Center)
                .backgroundColor(this.theme.elevated)
                .borderRadius(18)
              } else if (shouldUseYouTubeWebFallback() && this.activeVideoFallbackUrl) {
                Web({
                  src: this.activeVideoFallbackUrl,
                  controller: this.videoWebController,
                })
                  .width('100%')
                  .height(232)
                  .borderRadius(18)
                  .javaScriptAccess(true)
                  .domStorageAccess(true)
                  .mixedMode(MixedMode.All)
                  .onControllerAttached(() => {
                    try {
                      webview.WebCookieManager.putAcceptCookieEnabled(true)
                      webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true)
                      this.videoWebController.setCustomUserAgent(this.webVideoUserAgent)
                    } catch (_error) {
                    }
                  })
                  .onPageBegin((_event: OnPageBeginEvent) => {
                    this.actionHint = '正在加载 YouTube 播放器...'
                  })
                  .onPageEnd((_event: OnPageEndEvent) => {
                    this.actionHint = ''
                  })
                  .onErrorReceive((event: OnErrorReceiveEvent) => {
                    if (event.request?.isMainFrame()) {
                      this.actionHint = 'YouTube 播放器加载失败，请稍后重试'
                    }
                  })
              } else {
                Column({ space: 10 }) {
                  Text('未能解析应用内直链')
                    .fontSize(14)
                    .fontWeight(FontWeight.Medium)
                    .fontColor(this.theme.textPrimary)

                  Text('当前视频暂时无法解析直链，请稍后重试')
                    .fontSize(12)
                    .fontColor(this.theme.textSecondary)
                }
                .width('100%')
                .height(232)
                .justifyContent(FlexAlign.Center)
                .alignItems(HorizontalAlign.Center)
                .backgroundColor(this.theme.elevated)
                .borderRadius(18)
              }
            } else {
              Web({
                src: this.inAppVideoUrl(block.videoUrl),
                controller: this.videoWebController,
              })
                .width('100%')
                .height(232)
                .borderRadius(18)
                .javaScriptAccess(true)
                .domStorageAccess(true)
                .onPageEnd((_event: OnPageEndEvent) => {
                  this.actionHint = ''
                })
                .onErrorReceive((event: OnErrorReceiveEvent) => {
                  if (event.request?.isMainFrame()) {
                    this.actionHint = '应用内播放失败，可尝试外部打开'
                  }
                })
            }

            Row({ space: 10 }) {
              Text('收起')
                .fontSize(13)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.theme.textSecondary)
                .padding({ left: 12, right: 12, top: 8, bottom: 8 })
                .backgroundColor(this.theme.elevated)
                .borderRadius(999)
                .onClick(() => {
                  this.stopVideo()
                })

              if (!this.isYouTubeVideo(block.videoUrl)) {
                Text('外部打开')
                  .fontSize(13)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#FFFFFF')
                  .padding({ left: 12, right: 12, top: 8, bottom: 8 })
                  .backgroundColor(this.theme.accent)
                  .borderRadius(999)
                  .onClick(() => {
                    void this.openExternalUrl(block.videoUrl)
                  })
              }
            }
            .padding({ top: 2, bottom: 2 })
          }
          .width('100%')
        } else {
          Stack({ alignContent: Alignment.Center }) {
            if (block.imageUrl) {
              Image(block.imageUrl)
                .width('100%')
                .constraintSize({ minHeight: 180, maxHeight: 260 })
                .objectFit(ImageFit.Cover)
                .borderRadius(18)
            } else {
              Row()
                .width('100%')
                .height(180)
                .backgroundColor(this.theme.elevated)
                .borderRadius(18)
            }

            Row({ space: 8 }) {
              Text('播放视频')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor('#FFFFFF')
            }
            .padding({ left: 16, right: 16, top: 10, bottom: 10 })
            .backgroundColor('rgba(17,24,39,0.72)')
            .borderRadius(999)
          }
          .width('100%')
          .clip(true)
          .onClick(() => {
            this.playVideo(block)
          })
        }
      }
      .width('100%')
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => {
        if (!this.isVideoPlaying(block)) {
          this.playVideo(block)
        }
      })
    } else if (block.text) {
      Column({ space: 0 }) {
        Text(block.text)
          .fontSize(16)
          .lineHeight(29)
          .fontColor(this.theme.textPrimary)
          .width('100%')
          .textAlign(TextAlign.Start)
      }
      .width('100%')
      .padding({ left: 2, right: 2 })
    }
  }

  build() {
    Column() {
      Column({ space: 8 }) {
        PageHeader({
          title: '文章详情',
          theme: this.theme,
          showBackButton: true,
          showTrailingBuilder: true,
          titleSize: 20,
          topPadding: 24,
          bottomPadding: 0,
          onBack: () => { void goBack() },
        }) {
          this.HeaderActions()
        }
      }
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 8 })

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

              Text(`${this.entry!.author} · ${this.entry!.publishedLabel}`)
                .fontSize(13)
                .lineHeight(20)
                .fontColor(this.theme.textSecondary)
                .width('100%')
            }
            .width('100%')
            .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 })
            .alignItems(HorizontalAlign.Start)

            if (this.entry!.tags.length > 0) {
              Row({ space: 8 }) {
                ForEach(this.entry!.tags, (tag: string) => {
                  Text(tag)
                    .fontSize(12)
                    .fontColor(this.theme.textSecondary)
                    .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                    .backgroundColor(this.theme.elevated)
                    .borderRadius(999)
                }, (tag: string) => tag)
              }
              .width('100%')
              .margin({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
            }

            Column({ space: 20 }) {
              if (this.shouldRenderSummary()) {
                Text(this.entry!.summary)
                  .fontSize(16)
                  .lineHeight(27)
                  .fontColor(this.theme.textSecondary)
                  .fontWeight(FontWeight.Medium)
                  .width('100%')
              }

              if (this.entry!.contentBlocks.length > 0) {
                ForEach(this.entry!.contentBlocks, (block: ArticleContentBlock, index: number) => {
                  if (this.shouldRenderParagraphBlock(block, index)) {
                    this.ContentBlockItem(block)
                  }
                }, (block: ArticleContentBlock) => block.id)
              } else {
                ForEach(this.entry!.contentParagraphs, (paragraph: string) => {
                  Text(paragraph)
                    .fontSize(16)
                    .lineHeight(29)
                    .fontColor(this.theme.textPrimary)
                    .width('100%')
                    .textAlign(TextAlign.Start)
                }, (paragraph: string, index: number) => `${index}-${paragraph}`)
              }

              if (this.sourceUrl()) {
                Text(`${this.sourceLabel()}：${this.sourceUrl()}`)
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
          .padding({ bottom: this.bottomAvoidArea + 28 })
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      } else {
        Column({ space: 12 }) {
          Text('未找到内容')
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('请从订阅页重新进入一个条目。')
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
    .padding({ top: this.topAvoidArea })
    .backgroundColor(this.theme.background)
  }
}
