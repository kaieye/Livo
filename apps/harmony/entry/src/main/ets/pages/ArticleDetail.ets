import { common } from '@kit.AbilityKit'
import { MovingPhotoView, MovingPhotoViewController, photoAccessHelper } from '@kit.MediaLibraryKit'
import webview from '@ohos.web.webview'
import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack, openImageViewer, openVideoPlayer } from '../common/navigation/AppRouter'
import { ArticleAssistService, TranslationFormattingHint } from '../common/services/ArticleAssistService'
import { ExternalUrlService } from '../common/services/ExternalUrlService'
import { MovingPhotoService } from '../common/services/MovingPhotoService'
import { VideoResolverService } from '../common/services/VideoResolverService'
import { isDirectVideoUrl } from '../common/utils/FeedMediaUrl'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../common/utils/PictureGallery'
import { resolveArticleSourceUrl } from '../common/utils/ArticleSourceUrl'
import { resolveYouTubePlaybackDisplay } from '../common/utils/YouTubePlaybackDisplay'
import { resolveVideoPlaybackTarget } from '../common/utils/VideoPlaybackTarget'
import {
  shouldOpenYouTubeExternallyOnFallback,
  shouldUseYouTubeWebFallback,
} from '../common/utils/YouTubePlaybackMode'
import { PageHeader } from '../common/components/PageHeader'
import { SecondaryPageHeaderShell } from '../common/components/SecondaryPageHeaderShell'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  AITargetLanguage,
  HarmonySettings,
  isLegacyPlainArticleContent,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { HEADER_BACK_SLOT_SIZE, PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'
import { presentTweetEntryFromCard, TweetEntryPresentation, TweetQuotedPresentation } from '../common/utils/TweetEntryPresentation'
import { AvatarTile } from '../common/components/AvatarTile'
import { HighlightedInlineText } from '../common/components/HighlightedInlineText'

@Entry
@Component
struct ArticleDetail {
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @State entry?: ArticleDetailModel = undefined
  @State actionHint: string = ''
  @State aiSummary: string = ''
  @State aiTranslation: string = ''
  @State aiSummaryError: string = ''
  @State aiTranslationError: string = ''
  @State aiResultEntryId: string = ''
  @State aiEnabled: boolean = false
  @State aiTranslationEnabled: boolean = false
  @State aiTargetLanguage: AITargetLanguage = 'zh-CN'
  @State isAiProcessing: boolean = false
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State isUpgradingLegacyContent: boolean = false
  @State starScale: number = 1
  @State activeVideoBlockId: string = ''
  @State activeVideoPlayableUrl: string = ''
  @State activeVideoFallbackUrl: string = ''
  @State isResolvingActiveVideo: boolean = false
  @State inlineVideoPreparingBlockId: string = ''
  @State mediaAspectRatios: number[] = []
  @State activeMovingPhoto: photoAccessHelper.MovingPhoto | undefined = undefined
  @State private activePictureMediaIndex: number = 0
  @State private playingDetailLivePhotoIndex: number = -1
  @State private pausedDetailLivePhotoIndex: number = -1
  @State private preparedDetailLivePhotoIndices: number[] = []
  @State private detailLivePhotoInstanceSeeds: number[] = []
  @State private detailLivePhotoAspectRatios: number[] = []
  @State private isPictureMediaFullyVisible: boolean = false
  @State private isPictureMediaNearlyVisible: boolean = false
  @State private detailLivePhotoVisibilityRatios: number[] = []
  @State private detailLivePhotoMuted: boolean = true
  @State private activeSocialInlineVideoKey: string = ''
  private upgradedEntryIds: Set<string> = new Set<string>()
  private videoWebController: webview.WebviewController = new webview.WebviewController()
  private nativeVideoController: VideoController = new VideoController()
  private readonly movingPhotoController: MovingPhotoViewController = new MovingPhotoViewController()
  private readonly detailLivePhotoControllers: VideoController[] = []
  private readonly socialInlineVideoControllers: Map<string, VideoController> = new Map()
  private readonly webVideoUserAgent: string =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

  private animateWithUiContext(options: AnimateParam, event: () => void): void {
    this.getUIContext().animateTo(options, event)
  }

  private copyEntryWithStarState(entry: ArticleDetailModel, isStarred: boolean): ArticleDetailModel {
    return {
      id: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      imageUrl: entry.imageUrl,
      feedImageUrl: entry.feedImageUrl,
      author: entry.author,
      articleUrl: entry.articleUrl,
      publishedAt: entry.publishedAt,
      publishedLabel: entry.publishedLabel,
      readingLabel: entry.readingLabel,
      tags: entry.tags,
      mediaUrls: entry.mediaUrls,
      rawMediaUrls: entry.rawMediaUrls,
      feedTitle: entry.feedTitle,
      feedCategory: entry.feedCategory,
      viewLabel: entry.viewLabel,
      viewBadgeColor: entry.viewBadgeColor,
      hasVideoMedia: entry.hasVideoMedia,
      isRead: entry.isRead,
      isStarred,
      contentParagraphs: entry.contentParagraphs,
      contentBlocks: entry.contentBlocks,
      siteUrl: entry.siteUrl,
    }
  }

  private showToast(message: string, duration: number = 1800): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    void this.loadEntry(true, true)
  }

  private entryId(): string {
    const params = getStringParams()
    return params?.entryId ?? ''
  }

  private async loadEntry(markRead: boolean, allowRouteSnapshot: boolean = false): Promise<void> {
    const entryId = this.entryId()
    if (!entryId) {
      this.entry = undefined
      return
    }

    if (markRead) {
      await AppRepository.markRead(entryId, true)
      console.info(`已标记条目为已读: ${entryId}`)
    }

    const params = getStringParams()
    const entryJson = params?.entryJson as string

    if (allowRouteSnapshot && entryJson) {
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
    this.aiTranslationEnabled = settings.aiTranslationEnabled
    this.aiTargetLanguage = settings.aiTranslationLanguage
    const currentEntryId = this.entry?.id || ''
    if (currentEntryId && this.aiResultEntryId !== currentEntryId) {
      this.aiSummary = ''
      this.aiTranslation = ''
      this.aiSummaryError = ''
      this.aiTranslationError = ''
      this.aiResultEntryId = currentEntryId
    }
    if (this.entry && (
      (settings.aiSummaryEnabled && settings.aiSummaryAutoTrigger)
      || (settings.aiTranslationEnabled && settings.aiTranslationAutoTrigger)
    )) {
      void this.runArticleAIAssist(settings)
    }
    if (!upgraded) {
      this.actionHint = markRead ? '已标记为已读' : '内容已刷新'
    }
  }

  private aiLanguageLabel(): string {
    switch (this.aiTargetLanguage) {
      case 'zh-CN':
        return '简体中文'
      case 'zh-TW':
        return '繁体中文'
      case 'en':
        return 'English'
      case 'ja':
        return '日本語'
      case 'ko':
        return '한국어'
      case 'fr':
        return 'Français'
      case 'de':
        return 'Deutsch'
      case 'es':
        return 'Español'
      case 'ru':
        return 'Русский'
      case 'ar':
        return 'العربية'
      default:
        return this.aiTargetLanguage
    }
  }

  private compactErrorMessage(message: string, maxLength: number = 88): string {
    const normalized = (message || '').replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return '未知错误'
    }
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
  }

  private isChineseTargetLanguage(): boolean {
    return this.aiTargetLanguage === 'zh-CN' || this.aiTargetLanguage === 'zh-TW'
  }

  private containsCjkText(value: string): boolean {
    return /[\u3400-\u9FFF]/.test(value || '')
  }

  private async handleArticleAIAssist(): Promise<void> {
    try {
      const settings = await AppRepository.settings()
      await this.runArticleAIAssist(settings)
    } catch (error) {
      const message = `AI 处理失败：${error instanceof Error ? error.message : String(error)}`
      this.actionHint = message
      this.showToast(message, 2600)
    }
  }

  private async runArticleAIAssist(settings?: HarmonySettings): Promise<void> {
    if (!this.entry) {
      this.actionHint = '暂无可处理文章'
      this.showToast('暂无可处理文章')
      return
    }
    if (this.isAiProcessing) {
      this.actionHint = 'AI 正在处理中，请稍候...'
      this.showToast('AI 正在处理中，请稍候...')
      return
    }

    const resolvedSettings = settings ?? await AppRepository.settings()
    this.aiEnabled = resolvedSettings.aiSummaryEnabled
    this.aiTranslationEnabled = resolvedSettings.aiTranslationEnabled
    this.aiTargetLanguage = resolvedSettings.aiTranslationLanguage

    if (!this.aiEnabled && !this.aiTranslationEnabled) {
      this.actionHint = '请先在 设置 > AI助手 中开启摘要或翻译'
      this.showToast('请先在 设置 > AI助手 中开启摘要或翻译')
      return
    }

    this.isAiProcessing = true
    this.actionHint = 'AI 助手处理中...'
    this.showToast('AI 助手处理中...', 1200)
    this.aiSummaryError = ''
    this.aiTranslationError = ''
    const errors: string[] = []
    try {
      const aiSettings = await AppRepository.aiSettings()
      const entry = this.entry
      if (!entry) {
        return
      }
      this.aiResultEntryId = entry.id

      const aiTasks: Promise<void>[] = []

      if (this.aiEnabled) {
        aiTasks.push((async () => {
          try {
            this.aiSummary = await ArticleAssistService.summarizeWithAI(
              entry.title,
              entry.summary,
              entry.contentParagraphs,
              this.aiTargetLanguage,
              aiSettings,
            )
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            const fallbackSummary = ArticleAssistService.summarizeInLanguage(
              entry.title,
              entry.summary,
              entry.contentParagraphs,
              this.aiTargetLanguage,
            )
            if (this.aiTargetLanguage === 'en') {
              this.aiSummary = fallbackSummary
            } else {
              try {
                const localized = await ArticleAssistService.localizeTextWithAI(
                  fallbackSummary,
                  this.aiTargetLanguage,
                  aiSettings,
                )
                if (this.isChineseTargetLanguage() && !this.containsCjkText(localized)) {
                  this.aiSummary = ''
                } else {
                  this.aiSummary = localized.trim()
                }
              } catch (_localizeError) {
                this.aiSummary = ''
              }
            }
            if (!this.aiSummary.trim()) {
              this.aiSummaryError = reason
              errors.push(`摘要失败：${reason}`)
            }
          }
        })())
      }

      if (this.aiTranslationEnabled) {
        aiTasks.push((async () => {
          try {
            this.aiTranslation = await ArticleAssistService.translateWithAI(
              entry.title,
              entry.summary,
              entry.contentParagraphs,
              this.aiTargetLanguage,
              aiSettings,
              this.translationFormattingHint(),
            )
          } catch (error) {
            this.aiTranslation = ''
            const reason = error instanceof Error ? error.message : String(error)
            this.aiTranslationError = reason
            errors.push(`翻译失败：${reason}`)
          }
        })())
      }

      if (aiTasks.length > 0) {
        await Promise.all(aiTasks)
      }

      if (errors.length === 0) {
        this.actionHint = 'AI 处理完成'
        this.showToast('AI 处理完成')
      } else if (errors.length === 1 && (this.aiEnabled || this.aiTranslationEnabled)) {
        const summaryReady = !!this.aiSummary.trim()
        const translationReady = !!this.aiTranslation.trim()
        if (summaryReady && !translationReady) {
          this.actionHint = `摘要已完成，翻译失败：${errors[0]}`
          this.showToast(this.compactErrorMessage(`AI 摘要已完成，翻译失败：${errors[0]}`), 3000)
        } else if (!summaryReady && translationReady) {
          this.actionHint = `翻译已完成，摘要失败：${errors[0]}`
          this.showToast(this.compactErrorMessage(`AI 翻译已完成，摘要失败：${errors[0]}`), 3000)
        } else {
          this.actionHint = `部分完成：${errors[0]}`
          this.showToast(this.compactErrorMessage(`AI 部分完成：${errors[0]}`), 3000)
        }
      } else {
        this.actionHint = errors.join('；')
        this.showToast(this.compactErrorMessage(`AI 处理存在错误：${errors[0]}`), 3000)
      }
    } catch (error) {
      const message = `AI 处理失败：${error instanceof Error ? error.message : String(error)}`
      this.actionHint = message
      this.showToast(message, 2600)
    } finally {
      this.isAiProcessing = false
    }
  }

  private async toggleStar(): Promise<void> {
    const entryId = this.entryId()
    if (!entryId) {
      return
    }

    const previousStarred = this.entry?.isStarred ?? false
    if (this.entry) {
      this.entry = this.copyEntryWithStarState(this.entry, !previousStarred)
    }

    this.animateWithUiContext({ duration: 140, curve: Curve.EaseOut }, () => {
      this.starScale = 1.28
    })

    setTimeout(() => {
      this.animateWithUiContext({ duration: 240, curve: Curve.FastOutSlowIn }, () => {
        this.starScale = 1.0
      })
    }, 100)

    try {
      await AppRepository.toggleStar(entryId)
      await this.loadEntry(false, false)
      const message = this.entry?.isStarred ? '已收藏' : '已取消收藏'
      this.actionHint = message
      this.showToast(message)
    } catch (error) {
      if (this.entry) {
        this.entry = this.copyEntryWithStarState(this.entry, previousStarred)
      }
      this.showToast('收藏操作失败，请稍后重试')
      console.error(`toggleStar failed: ${error instanceof Error ? error.message : error}`)
    }
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
    await ExternalUrlService.open(url)
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

  private isPictureDetail(): boolean {
    const viewLabel = (this.entry?.viewLabel || '').trim()
    return viewLabel === '图片'
  }

  private isSocialDetail(): boolean {
    const viewLabel = (this.entry?.viewLabel || '').trim()
    return viewLabel === '社交'
  }

  private tweetPresentation(): TweetEntryPresentation {
    return presentTweetEntryFromCard(this.entry ?? {})
  }

  private tweetUsernameLabel(): string {
    return (this.tweetPresentation().username || '').trim()
  }

  private tweetMediaItems(): PictureCarouselMediaItem[] {
    const urls = (this.tweetPresentation().mediaUrls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
    const fallbackImage = urls.find((url: string) => !isDirectVideoUrl(url)) || ''
    return resolvePictureCarouselMediaItems(urls, fallbackImage).slice(0, 4)
  }

  private hasQuotedTweet(): boolean {
    return (
      (this.tweetPresentation().kind === 'quote' || this.tweetPresentation().kind === 'retweet')
      && !!this.tweetPresentation().quotedTweet
    )
  }

  private quotedTweetPresentation(): TweetQuotedPresentation {
    return this.tweetPresentation().quotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private quotedTweetMediaItems(): PictureCarouselMediaItem[] {
    const urls = (this.quotedTweetPresentation().mediaUrls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
    const fallbackImage = urls.find((url: string) => !isDirectVideoUrl(url)) || ''
    return resolvePictureCarouselMediaItems(urls, fallbackImage).slice(0, 4)
  }

  private quotedTweetHeaderLabel(): string {
    const baseLabel = (this.quotedTweetPresentation().displayName || '').trim()
      || (this.quotedTweetPresentation().username || '').trim()
      || '未知来源'
    return baseLabel.endsWith(':') ? baseLabel : `${baseLabel}:`
  }

  private hasNestedQuotedTweet(): boolean {
    return this.hasQuotedTweet() && !!this.quotedTweetPresentation().nestedQuotedTweet
  }

  private nestedQuotedTweetPresentation(): TweetQuotedPresentation {
    return this.quotedTweetPresentation().nestedQuotedTweet || {
      displayName: '',
      username: '',
      avatarUrl: '',
      text: '',
      mediaUrls: [],
    }
  }

  private nestedQuotedTweetMediaItems(): PictureCarouselMediaItem[] {
    const urls = (this.nestedQuotedTweetPresentation().mediaUrls || [])
      .map((url: string) => url.trim())
      .filter((url: string) => !!url)
    const fallbackImage = urls.find((url: string) => !isDirectVideoUrl(url)) || ''
    return resolvePictureCarouselMediaItems(urls, fallbackImage).slice(0, 4)
  }

  private nestedQuotedTweetHeaderLabel(): string {
    const baseLabel = (this.nestedQuotedTweetPresentation().displayName || '').trim()
      || (this.nestedQuotedTweetPresentation().username || '').trim()
      || '未知来源'
    return baseLabel.endsWith(':') ? baseLabel : `${baseLabel}:`
  }

  private isTweetMediaVideo(item: PictureCarouselMediaItem): boolean {
    return !!(item.videoUrl || '').trim()
  }

  private socialMediaRenderKey(section: string, item: PictureCarouselMediaItem, index: number): string {
    return `${section}_${index}_${item.imageUrl}_${item.videoUrl}`
  }

  private isSocialInlineVideoActive(section: string, item: PictureCarouselMediaItem, index: number): boolean {
    return this.activeSocialInlineVideoKey === this.socialMediaRenderKey(section, item, index)
  }

  private socialInlineVideoControllerFor(section: string, item: PictureCarouselMediaItem, index: number): VideoController {
    const key = this.socialMediaRenderKey(section, item, index)
    const existing = this.socialInlineVideoControllers.get(key)
    if (existing) {
      return existing
    }
    const controller = new VideoController()
    this.socialInlineVideoControllers.set(key, controller)
    return controller
  }

  private playSocialInlineVideo(section: string, item: PictureCarouselMediaItem, index: number): void {
    if (!this.isTweetMediaVideo(item)) {
      return
    }
    this.activeSocialInlineVideoKey = this.socialMediaRenderKey(section, item, index)
  }

  private openSocialImage(item: PictureCarouselMediaItem): void {
    if ((item.imageUrl || '').trim()) {
      void openImageViewer(item.imageUrl, this.entry?.title || '图片预览')
    }
  }

  private translationFormattingHint(): TranslationFormattingHint | undefined {
    if (!this.isSocialDetail()) {
      return undefined
    }
    const presentation = this.tweetPresentation()
    if (presentation.kind !== 'retweet') {
      return undefined
    }
    return {
      tweetKind: 'retweet',
      sourceUserName: (presentation.displayName || '').trim() || (this.entry?.author || '').trim() || '用户',
      retweetedUserName: (presentation.retweetByLabel || '').trim() || '转发用户',
    }
  }

  private tweetMediaTileWidth(index: number, count: number): string {
    if (count <= 1) {
      return '100%'
    }
    if (count === 3 && index === 0) {
      return '100%'
    }
    return '49.2%'
  }

  private tweetMediaTileHeight(index: number, count: number): number {
    if (count <= 1) {
      return 208
    }
    if (count === 3 && index === 0) {
      return 148
    }
    return 136
  }

  @Builder
  private SocialTweetDetail() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        AvatarTile({
          imageUrl: this.tweetPresentation().avatarUrl,
          fallbackLabel: this.tweetPresentation().displayName,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 17,
          radius: 999,
          textSize: 11,
          showFallbackLabel: false,
        })

        Row({ space: 4 }) {
          HighlightedInlineText({
            text: this.tweetPresentation().displayName || '未知来源',
            query: '',
            theme: this.theme,
            fontSize: 16,
            lineHeight: 20,
            fontWeight: FontWeight.Bold,
            defaultColor: this.theme.textPrimary,
            maxLines: 1,
          })

          if (this.tweetUsernameLabel()) {
            HighlightedInlineText({
              text: this.tweetUsernameLabel(),
              query: '',
              theme: this.theme,
              fontSize: 14,
              lineHeight: 18,
              defaultColor: this.theme.textMuted,
              maxLines: 1,
            })
          }

          if (this.tweetPresentation().publishedLabel) {
            Text(`· ${this.tweetPresentation().publishedLabel}`)
              .fontSize(13)
              .fontColor(this.theme.textMuted)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
          }
        }
        .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Top)

      if (this.tweetPresentation().text) {
        HighlightedInlineText({
          text: this.tweetPresentation().text,
          query: '',
          theme: this.theme,
          fontSize: 16,
          lineHeight: 24,
          defaultColor: this.theme.textPrimary,
          maxLines: 99,
        })
          .width('100%')
      }

      if (this.hasQuotedTweet()) {
        Column({ space: 8 }) {
          Text('RT')
            .fontSize(12)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textMuted)
            .width('100%')

          Text() {
            Span(this.quotedTweetHeaderLabel())
              .fontWeight(FontWeight.Bold)

            if ((this.quotedTweetPresentation().text || '').trim()) {
              Span(` ${(this.quotedTweetPresentation().text || '').trim()}`)
                .fontWeight(FontWeight.Regular)
            }
          }
            .fontSize(13)
            .lineHeight(20)
            .fontColor(this.theme.textPrimary)
            .width('100%')

          if (this.quotedTweetMediaItems().length > 0) {
            Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
              ForEach(this.quotedTweetMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
                Stack({ alignContent: Alignment.Center }) {
                  if (this.isTweetMediaVideo(item) && this.isSocialInlineVideoActive('quoted', item, index)) {
                    Video({
                      src: item.videoUrl,
                      controller: this.socialInlineVideoControllerFor('quoted', item, index),
                      previewUri: item.imageUrl,
                    })
                      .width(this.tweetMediaTileWidth(index, this.quotedTweetMediaItems().length))
                      .height(this.tweetMediaTileHeight(index, this.quotedTweetMediaItems().length))
                      .borderRadius(8)
                      .controls(true)
                      .autoPlay(true)
                      .muted(false)
                  } else {
                    if ((item.imageUrl || '').trim()) {
                      Image(item.imageUrl)
                        .width(this.tweetMediaTileWidth(index, this.quotedTweetMediaItems().length))
                        .height(this.tweetMediaTileHeight(index, this.quotedTweetMediaItems().length))
                        .borderRadius(8)
                        .objectFit(ImageFit.Cover)
                        .backgroundColor(this.theme.elevated)
                    } else {
                      Column()
                        .width(this.tweetMediaTileWidth(index, this.quotedTweetMediaItems().length))
                        .height(this.tweetMediaTileHeight(index, this.quotedTweetMediaItems().length))
                        .borderRadius(8)
                        .backgroundColor(this.theme.elevated)
                    }

                    if (this.isTweetMediaVideo(item)) {
                      Row() {
                        SymbolGlyph($r('sys.symbol.play_fill'))
                          .fontSize(28)
                          .fontColor(['#F5F5F5'])
                      }
                      .width(56)
                      .height(56)
                      .justifyContent(FlexAlign.Center)
                      .alignItems(VerticalAlign.Center)
                      .borderRadius(999)
                      .backgroundColor('rgba(168,168,168,0.58)')
                    }
                  }
                }
                  .margin({ bottom: this.quotedTweetMediaItems().length > 1 ? 6 : 0 })
                  .onClick(() => {
                    if (this.isTweetMediaVideo(item)) {
                      this.playSocialInlineVideo('quoted', item, index)
                    } else {
                      this.openSocialImage(item)
                    }
                  })
              }, (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`)
            }
            .width('100%')
            .clip(true)
          }

          if (this.hasNestedQuotedTweet()) {
            Column({ space: 0 }) {
              Column({ space: 8 }) {
                Text('RT')
                  .fontSize(12)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textMuted)
                  .width('100%')

                Text() {
                  Span(this.nestedQuotedTweetHeaderLabel())
                    .fontWeight(FontWeight.Bold)

                  if ((this.nestedQuotedTweetPresentation().text || '').trim()) {
                    Span(` ${(this.nestedQuotedTweetPresentation().text || '').trim()}`)
                      .fontWeight(FontWeight.Regular)
                  }
                }
                  .fontSize(13)
                  .lineHeight(20)
                  .fontColor(this.theme.textPrimary)
                  .width('100%')
              }
              .width('100%')
              .padding({
                left: 10,
                right: 10,
                top: 10,
                bottom: this.nestedQuotedTweetMediaItems().length > 0 ? 8 : 10,
              })

              if (this.nestedQuotedTweetMediaItems().length > 0) {
                Column() {
                  Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
                    ForEach(this.nestedQuotedTweetMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
                      Stack({ alignContent: Alignment.Center }) {
                        if (this.isTweetMediaVideo(item) && this.isSocialInlineVideoActive('nested', item, index)) {
                          Video({
                            src: item.videoUrl,
                            controller: this.socialInlineVideoControllerFor('nested', item, index),
                            previewUri: item.imageUrl,
                          })
                            .width(this.tweetMediaTileWidth(index, this.nestedQuotedTweetMediaItems().length))
                            .height(this.tweetMediaTileHeight(index, this.nestedQuotedTweetMediaItems().length))
                            .borderRadius(0)
                            .controls(true)
                            .autoPlay(true)
                            .muted(false)
                        } else {
                          if ((item.imageUrl || '').trim()) {
                            Image(item.imageUrl)
                              .width(this.tweetMediaTileWidth(index, this.nestedQuotedTweetMediaItems().length))
                              .height(this.tweetMediaTileHeight(index, this.nestedQuotedTweetMediaItems().length))
                              .borderRadius(0)
                              .objectFit(ImageFit.Cover)
                              .backgroundColor(this.theme.elevated)
                          } else {
                            Column()
                              .width(this.tweetMediaTileWidth(index, this.nestedQuotedTweetMediaItems().length))
                              .height(this.tweetMediaTileHeight(index, this.nestedQuotedTweetMediaItems().length))
                              .borderRadius(0)
                              .backgroundColor(this.theme.elevated)
                          }

                          if (this.isTweetMediaVideo(item)) {
                            Row() {
                              SymbolGlyph($r('sys.symbol.play_fill'))
                                .fontSize(28)
                                .fontColor(['#F5F5F5'])
                            }
                            .width(56)
                            .height(56)
                            .justifyContent(FlexAlign.Center)
                            .alignItems(VerticalAlign.Center)
                            .borderRadius(999)
                            .backgroundColor('rgba(168,168,168,0.58)')
                          }
                        }
                      }
                        .margin({ bottom: this.nestedQuotedTweetMediaItems().length > 1 ? 6 : 0 })
                        .onClick(() => {
                          if (this.isTweetMediaVideo(item)) {
                            this.playSocialInlineVideo('nested', item, index)
                          } else {
                            this.openSocialImage(item)
                          }
                        })
                    }, (item: PictureCarouselMediaItem, index: number) => `nested_${item.imageUrl}_${item.videoUrl}_${index}`)
                  }
                  .width('100%')
                }
                .width('100%')
                .padding(1)
                .backgroundColor(this.theme.divider)
                .clip(true)
              }
            }
            .width('100%')
            .borderRadius(10)
            .border({ width: 0.8, color: this.theme.divider })
            .backgroundColor(this.theme.surface)
            .clip(true)
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding({ left: 2, right: 2, top: 2, bottom: 2 })
      }

      if (this.tweetMediaItems().length > 0) {
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          ForEach(this.tweetMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
            Stack({ alignContent: Alignment.Center }) {
              if (this.isTweetMediaVideo(item) && this.isSocialInlineVideoActive('main', item, index)) {
                Video({
                  src: item.videoUrl,
                  controller: this.socialInlineVideoControllerFor('main', item, index),
                  previewUri: item.imageUrl,
                })
                  .width(this.tweetMediaTileWidth(index, this.tweetMediaItems().length))
                  .height(this.tweetMediaTileHeight(index, this.tweetMediaItems().length))
                  .borderRadius(10)
                  .controls(true)
                  .autoPlay(true)
                  .muted(false)
              } else {
                if ((item.imageUrl || '').trim()) {
                  Image(item.imageUrl)
                    .width(this.tweetMediaTileWidth(index, this.tweetMediaItems().length))
                    .height(this.tweetMediaTileHeight(index, this.tweetMediaItems().length))
                    .borderRadius(10)
                    .objectFit(ImageFit.Cover)
                    .backgroundColor(this.theme.elevated)
                } else {
                  Column()
                    .width(this.tweetMediaTileWidth(index, this.tweetMediaItems().length))
                    .height(this.tweetMediaTileHeight(index, this.tweetMediaItems().length))
                    .borderRadius(10)
                    .backgroundColor(this.theme.elevated)
                }

                if (this.isTweetMediaVideo(item)) {
                  Row() {
                    SymbolGlyph($r('sys.symbol.play_fill'))
                      .fontSize(28)
                      .fontColor(['#F5F5F5'])
                  }
                  .width(56)
                  .height(56)
                  .justifyContent(FlexAlign.Center)
                  .alignItems(VerticalAlign.Center)
                  .borderRadius(999)
                  .backgroundColor('rgba(168,168,168,0.58)')
                }
              }
            }
              .margin({ bottom: this.tweetMediaItems().length > 1 ? 6 : 0 })
              .onClick(() => {
                if (this.isTweetMediaVideo(item)) {
                  this.playSocialInlineVideo('main', item, index)
                } else {
                  this.openSocialImage(item)
                }
              })
          }, (item: PictureCarouselMediaItem, index: number) => `${item.imageUrl}_${item.videoUrl}_${index}`)
        }
        .width('100%')
        .clip(true)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
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

  private browserOpenUrl(): string {
    const articleUrl = (this.entry?.articleUrl || '').trim()
    if (articleUrl) {
      return articleUrl
    }

    return this.sourceUrl()
  }

  private async openEntryInBrowser(): Promise<void> {
    const url = this.browserOpenUrl()
    if (!url) {
      this.actionHint = '暂无可打开链接'
      return
    }

    try {
      await ExternalUrlService.open(url)
      this.actionHint = '已在浏览器打开'
    } catch (error) {
      console.error(`Failed to open entry in browser: ${error instanceof Error ? error.message : `${error}`}`)
      this.actionHint = '浏览器打开失败'
    }
  }

  private pictureDetailMediaItems(): PictureCarouselMediaItem[] {
    if (!this.isPictureDetail()) {
      return []
    }

    return (this.entry?.contentBlocks ?? []).reduce((result: PictureCarouselMediaItem[], block: ArticleContentBlock) => {
      if (block.type === 'video' && block.videoUrl) {
        result.push({
          kind: 'livePhoto',
          imageUrl: block.imageUrl || '',
          videoUrl: block.videoUrl,
        })
        return result
      }

      if (block.type === 'image' && block.imageUrl) {
        result.push({
          kind: 'image',
          imageUrl: block.imageUrl,
          videoUrl: '',
        })
      }
      return result
    }, [])
  }

  private pictureDetailTextBlocks(): ArticleContentBlock[] {
    if (!this.isPictureDetail()) {
      return this.entry?.contentBlocks ?? []
    }

    return (this.entry?.contentBlocks ?? []).filter((block: ArticleContentBlock) => block.type === 'paragraph' && !!block.text)
  }

  private detailLivePhotoControllerFor(index: number): VideoController {
    if (!this.detailLivePhotoControllers[index]) {
      this.detailLivePhotoControllers[index] = new VideoController()
    }
    return this.detailLivePhotoControllers[index]
  }

  private currentDetailLivePhotoItem(index: number): PictureCarouselMediaItem | undefined {
    const item = this.pictureDetailMediaItems()[index]
    return item?.kind === 'livePhoto' && item.videoUrl ? item : undefined
  }

  private firstDetailLivePhotoIndex(): number {
    const items = this.pictureDetailMediaItems()
    for (let index = 0; index < items.length; index += 1) {
      if (items[index]?.kind === 'livePhoto' && items[index].videoUrl) {
        return index
      }
    }

    return -1
  }

  private preloadDetailLivePhotoIndices(): number[] {
    // 在垂直列表布局中，所有live图片都会被挂载和显示
    // 这个方法保留以保持向后兼容，但现在返回空数组
    return []
  }

  private mountedDetailLivePhotoIndices(): number[] {
    // 在垂直列表布局中，所有live图片都被挂载和显示
    const items = this.pictureDetailMediaItems()
    const mounted = new Set<number>()

    items.forEach((item: PictureCarouselMediaItem, index: number) => {
      if (item.kind === 'livePhoto' && item.videoUrl) {
        mounted.add(index)
      }
    })

    return Array.from(mounted.values())
  }

  private warmMountedDetailLivePhotos(targetIndex: number): void {
    this.mountedDetailLivePhotoIndices().forEach((index: number) => {
      if (index !== targetIndex) {
        return
      }
      try {
        this.detailLivePhotoControllerFor(index).start()
      } catch (_) {
      }
    })
  }

  private isDetailLivePhotoPrepared(index: number): boolean {
    return this.preparedDetailLivePhotoIndices.includes(index)
  }

  private clearPreparedDetailLivePhoto(index: number): void {
    if (!this.preparedDetailLivePhotoIndices.includes(index)) {
      return
    }

    this.preparedDetailLivePhotoIndices = this.preparedDetailLivePhotoIndices.filter((value: number) => value !== index)
  }

  private markPreparedDetailLivePhoto(index: number): void {
    if (this.preparedDetailLivePhotoIndices.includes(index)) {
      return
    }

    this.preparedDetailLivePhotoIndices = [...this.preparedDetailLivePhotoIndices, index]
  }

  private detailLivePhotoInstanceSeed(index: number): number {
    return this.detailLivePhotoInstanceSeeds[index] ?? 0
  }

  private refreshDetailLivePhotoInstance(index: number): void {
    this.clearPreparedDetailLivePhoto(index)
    const nextSeeds = [...this.detailLivePhotoInstanceSeeds]
    nextSeeds[index] = (nextSeeds[index] ?? 0) + 1
    this.detailLivePhotoInstanceSeeds = nextSeeds
  }

  private stopAllDetailLivePhotoPlayback(exceptIndex: number = -1): void {
    this.detailLivePhotoControllers.forEach((controller: VideoController, index: number) => {
      if (index === exceptIndex || !controller) {
        return
      }
      try {
        controller.pause()
      } catch (_) {
      }
    })
  }

  private stopDetailLivePhotoPlayback(): void {
    this.playingDetailLivePhotoIndex = -1
    this.pausedDetailLivePhotoIndex = -1
    this.preparedDetailLivePhotoIndices = []
    this.stopAllDetailLivePhotoPlayback()
  }

  private pauseDetailLivePhotoPlayback(index: number): void {
    const item = this.currentDetailLivePhotoItem(index)
    if (!item) {
      this.pausedDetailLivePhotoIndex = -1
      this.playingDetailLivePhotoIndex = -1
      return
    }

    this.stopAllDetailLivePhotoPlayback(index)
    try {
      this.detailLivePhotoControllerFor(index).pause()
      this.pausedDetailLivePhotoIndex = index
    } catch (_) {
      this.pausedDetailLivePhotoIndex = -1
    }
    this.playingDetailLivePhotoIndex = -1
  }

  private syncPictureDetailLivePhotoPlayback(index: number): void {
    const item = this.currentDetailLivePhotoItem(index)
    if (!item) {
      this.playingDetailLivePhotoIndex = -1
      this.pausedDetailLivePhotoIndex = -1
      return
    }

    if (this.detailLivePhotoVisibilityRatio(index) < 0.35) {
      this.pauseDetailLivePhotoPlayback(index)
      return
    }

    this.warmMountedDetailLivePhotos(index)

    if (this.isDetailLivePhotoPrepared(index)) {
      this.pausedDetailLivePhotoIndex = -1
      this.playingDetailLivePhotoIndex = index
      try {
        this.detailLivePhotoControllerFor(index).start()
      } catch (_) {
      }
      return
    }

    this.pausedDetailLivePhotoIndex = -1
    this.playingDetailLivePhotoIndex = -1
  }

  private detailLivePhotoVisibilityRatio(index: number): number {
    return this.detailLivePhotoVisibilityRatios[index] ?? 0
  }

  private resolveCenteredDetailLivePhotoIndex(ratios: number[]): number {
    const items = this.pictureDetailMediaItems()
    let bestIndex = -1
    let bestScore = 0

    items.forEach((item: PictureCarouselMediaItem, index: number) => {
      if (item.kind !== 'livePhoto' || !item.videoUrl) {
        return
      }
      const score = ratios[index] ?? 0
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    return bestScore >= 0.35 ? bestIndex : -1
  }

  private updateDetailLivePhotoVisibility(index: number, isVisible: boolean, currentRatio: number): void {
    if (this.currentDetailLivePhotoItem(index) === undefined) {
      return
    }

    const nextRatios = [...this.detailLivePhotoVisibilityRatios]
    nextRatios[index] = currentRatio
    this.detailLivePhotoVisibilityRatios = nextRatios

    const centeredIndex = this.resolveCenteredDetailLivePhotoIndex(nextRatios)
    if (centeredIndex < 0) {
      this.isPictureMediaNearlyVisible = false
      this.isPictureMediaFullyVisible = false
      this.stopDetailLivePhotoPlayback()
      return
    }

    this.isPictureMediaNearlyVisible = true
    this.isPictureMediaFullyVisible = true
    if (this.activePictureMediaIndex !== centeredIndex) {
      this.activePictureMediaIndex = centeredIndex
    }
    this.syncPictureDetailLivePhotoPlayback(centeredIndex)
  }

  private toggleDetailLivePhotoMuted(): void {
    this.detailLivePhotoMuted = !this.detailLivePhotoMuted
    this.showToast(this.detailLivePhotoMuted ? '已静音' : '已开启声音')
  }

  private toggleDetailLivePhotoPlayback(index: number): void {
    const item = this.currentDetailLivePhotoItem(index)
    if (!item) {
      return
    }

    if (this.playingDetailLivePhotoIndex === index) {
      this.pauseDetailLivePhotoPlayback(index)
      return
    }

    if (this.detailLivePhotoVisibilityRatio(index) < 0.35) {
      return
    }

    this.syncPictureDetailLivePhotoPlayback(index)
  }

  private shouldShowPlayingDetailLivePhoto(index: number): boolean {
    return this.activePictureMediaIndex === index
      && this.isDetailLivePhotoPrepared(index)
  }

  private shouldShowPausedDetailLivePhoto(index: number): boolean {
    return this.pausedDetailLivePhotoIndex === index && this.isDetailLivePhotoPrepared(index)
  }

  private shouldWarmDetailLivePhoto(index: number): boolean {
    // 如果可见比例已知且达到阈值，正常预热
    if (this.detailLivePhotoVisibilityRatio(index) >= 0.35) {
      return this.activePictureMediaIndex === index
        && this.mountedDetailLivePhotoIndices().includes(index)
    }
    // 可见比例尚未初始化时（页面刚进入），对第一个 live 图片立即预热
    const allRatiosZero = this.detailLivePhotoVisibilityRatios.every((r: number) => r === 0)
    return allRatiosZero
      && index === this.firstDetailLivePhotoIndex()
      && this.mountedDetailLivePhotoIndices().includes(index)
  }

  private shouldShowDetailLivePhotoLoading(index: number): boolean {
    if (this.currentDetailLivePhotoItem(index) === undefined) {
      return false
    }
    if (this.isDetailLivePhotoPrepared(index)) {
      return false
    }
    // 可见比例已知时，只对当前激活且可见的图片显示加载
    const ratio = this.detailLivePhotoVisibilityRatio(index)
    if (ratio > 0) {
      return this.activePictureMediaIndex === index && ratio >= 0.35
    }
    // 可见比例尚未初始化时，对第一个 live 图片显示加载
    const allRatiosZero = this.detailLivePhotoVisibilityRatios.every((r: number) => r === 0)
    return allRatiosZero && index === this.firstDetailLivePhotoIndex()
  }

  private handleDetailLivePhotoPrepared(index: number): void {
    this.markPreparedDetailLivePhoto(index)
    const ratio = this.detailLivePhotoVisibilityRatio(index)
    const allRatiosZero = this.detailLivePhotoVisibilityRatios.every((r: number) => r === 0)
    const isInitialFirstPhoto = allRatiosZero && index === this.firstDetailLivePhotoIndex()
    if ((this.activePictureMediaIndex === index && ratio >= 0.35) || isInitialFirstPhoto) {
      this.pausedDetailLivePhotoIndex = -1
      this.playingDetailLivePhotoIndex = index
      try {
        this.detailLivePhotoControllerFor(index).start()
      } catch (_) {
      }
    }
  }

  private handleDetailLivePhotoStart(index: number): void {
    this.markPreparedDetailLivePhoto(index)
    if (this.pausedDetailLivePhotoIndex === index) {
      this.pausedDetailLivePhotoIndex = -1
    }
    const ratio = this.detailLivePhotoVisibilityRatio(index)
    const allRatiosZero = this.detailLivePhotoVisibilityRatios.every((r: number) => r === 0)
    const isInitialFirstPhoto = allRatiosZero && index === this.firstDetailLivePhotoIndex()
    if ((this.activePictureMediaIndex === index && ratio >= 0.35) || isInitialFirstPhoto) {
      this.playingDetailLivePhotoIndex = index
    }
  }

  private handleDetailLivePhotoPause(index: number): void {
    if (this.isDetailLivePhotoPrepared(index)) {
      this.pausedDetailLivePhotoIndex = index
    }
    if (this.playingDetailLivePhotoIndex === index) {
      this.playingDetailLivePhotoIndex = -1
    }
  }

  private handleDetailLivePhotoStop(index: number): void {
    if (this.playingDetailLivePhotoIndex === index) {
      this.playingDetailLivePhotoIndex = -1
    }
    if (this.pausedDetailLivePhotoIndex === index) {
      this.pausedDetailLivePhotoIndex = -1
    }
  }

  private handleDetailLivePhotoError(index: number): void {
    this.clearPreparedDetailLivePhoto(index)
    if (this.playingDetailLivePhotoIndex === index) {
      this.playingDetailLivePhotoIndex = -1
    }
    if (this.pausedDetailLivePhotoIndex === index) {
      this.pausedDetailLivePhotoIndex = -1
    }
    this.refreshDetailLivePhotoInstance(index)
  }

  private detailLivePhotoAspectRatio(index: number): number {
    const ratio = this.detailLivePhotoAspectRatios[index]
    return ratio && ratio > 0 ? ratio : 4 / 5
  }

  private rememberDetailLivePhotoAspectRatio(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return
    }

    const nextRatio = width / height
    const currentRatio = this.detailLivePhotoAspectRatios[index]
    if (currentRatio && Math.abs(currentRatio - nextRatio) < 0.001) {
      return
    }

    const nextAspectRatios = [...this.detailLivePhotoAspectRatios]
    nextAspectRatios[index] = nextRatio
    this.detailLivePhotoAspectRatios = nextAspectRatios
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

  private imageBlockServesAsVideoCover(index: number): boolean {
    const blocks = this.entry?.contentBlocks ?? []
    const current = blocks[index]
    if (!current || current.type !== 'image' || !current.imageUrl) {
      return false
    }

    const previous = index > 0 ? blocks[index - 1] : undefined
    if (!previous || previous.type !== 'video') {
      return false
    }

    return !(previous.imageUrl || '').trim()
  }

  private resolveVideoPreviewImage(block: ArticleContentBlock, index: number): string {
    const ownPreview = (block.imageUrl || '').trim()
    if (ownPreview) {
      return ownPreview
    }

    const blocks = this.entry?.contentBlocks ?? []
    const next = index + 1 < blocks.length ? blocks[index + 1] : undefined
    if (next && next.type === 'image' && next.imageUrl) {
      return next.imageUrl
    }

    return ''
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

  private mediaAspectRatio(index: number): number {
    const ratio = this.mediaAspectRatios[index]
    return ratio && ratio > 0 ? ratio : 4 / 5
  }

  private rememberMediaAspectRatio(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return
    }

    const nextRatio = width / height
    const currentRatio = this.mediaAspectRatios[index]
    if (currentRatio && Math.abs(currentRatio - nextRatio) < 0.001) {
      return
    }

    const nextRatios = [...this.mediaAspectRatios]
    nextRatios[index] = nextRatio
    this.mediaAspectRatios = nextRatios
  }

  private shouldInlineVideoPlayback(block: ArticleContentBlock): boolean {
    return this.isPictureDetail() && this.isDirectVideoFile(block.videoUrl)
  }

  private shouldUseNativeMovingPhoto(block: ArticleContentBlock): boolean {
    return this.shouldInlineVideoPlayback(block) && !!block.imageUrl
  }

  private isInlineVideoPreparing(block: ArticleContentBlock): boolean {
    return this.inlineVideoPreparingBlockId === block.id
  }

  private loadMovingPhotoForBlock(block: ArticleContentBlock): void {
    if (!this.shouldUseNativeMovingPhoto(block)) {
      this.activeMovingPhoto = undefined
      return
    }

    const context = this.getUIContext().getHostContext() as common.UIAbilityContext
    const expectedBlockId = block.id
    this.activeMovingPhoto = undefined
    void MovingPhotoService.loadRemoteMovingPhoto(
      context,
      block.imageUrl,
      block.videoUrl,
    )
      .then((movingPhoto: photoAccessHelper.MovingPhoto) => {
        if (this.activeVideoBlockId !== expectedBlockId) {
          return
        }
        this.activeMovingPhoto = movingPhoto
      })
      .catch((error: Error) => {
        if (this.activeVideoBlockId !== expectedBlockId) {
          return
        }
        this.activeMovingPhoto = undefined
        this.inlineVideoPreparingBlockId = ''
        this.actionHint = error instanceof Error ? error.message : '动态照片加载失败'
      })
  }

  private openVideoFullscreen(block: ArticleContentBlock): void {
    void openVideoPlayer(this.entry?.title || '视频播放', block.videoUrl, block.imageUrl || '')
  }

  private openVideoBlock(block: ArticleContentBlock): void {
    if (this.shouldInlineVideoPlayback(block)) {
      this.playVideo(block)
      return
    }

    const playbackTarget = resolveVideoPlaybackTarget(
      this.isYouTubeVideo(block.videoUrl),
      this.isDirectVideoFile(block.videoUrl),
    )
    if (playbackTarget === 'dedicated') {
      this.openVideoFullscreen(block)
      return
    }

    this.playVideo(block)
  }

  private playVideo(block: ArticleContentBlock): void {
    this.activeVideoBlockId = block.id
    this.activeVideoPlayableUrl = ''
    this.activeVideoFallbackUrl = ''
    this.isResolvingActiveVideo = false
    this.activeMovingPhoto = undefined
    this.inlineVideoPreparingBlockId = this.shouldInlineVideoPlayback(block) ? block.id : ''
    this.actionHint = ''
    if (this.isDirectVideoFile(block.videoUrl)) {
      this.loadMovingPhotoForBlock(block)
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
    this.inlineVideoPreparingBlockId = ''
    this.activeMovingPhoto = undefined
    try {
      this.nativeVideoController.stop()
    } catch (_) {}
    try {
      this.movingPhotoController.stopPlayback()
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
    buttonScale: number = 1,
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
      .scale({ x: buttonScale, y: buttonScale })
      .animation({ duration: 180, curve: Curve.FastOutSlowIn })
      .onClick(() => {
        if (onTap) {
          onTap()
        }
      })
  }

  @Builder
  private HeaderImageAction(
    image: Resource,
    size: number,
    onTap?: () => void,
    backgroundColor?: string,
    buttonScale: number = 1,
  ) {
    Row() {
      Image(image)
        .width(size)
        .height(size)
        .objectFit(ImageFit.Contain)
    }
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(backgroundColor ?? Color.Transparent)
      .borderRadius(HEADER_BACK_SLOT_SIZE)
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .scale({ x: buttonScale, y: buttonScale })
      .animation({ duration: 180, curve: Curve.FastOutSlowIn })
      .onClick(() => {
        if (onTap) {
          onTap()
        }
      })
  }

  @Builder
  private HeaderActions() {
    Row({ space: 4 }) {
      this.HeaderImageAction(
        $r('app.media.ri_ai'),
        22,
        () => { void this.handleArticleAIAssist() },
      )

      this.HeaderIconAction(
        $r('sys.symbol.arrow_right_up_and_square'),
        22,
        () => { void this.openEntryInBrowser() },
      )

      Row() {
        SymbolGlyph($r(this.entry?.isStarred ? 'sys.symbol.star_fill' : 'sys.symbol.star'))
          .fontSize(22)
          .fontColor([this.entry?.isStarred ? '#F6C343' : this.theme.textSecondary])
          .renderingStrategy(SymbolRenderingStrategy.SINGLE)
      }
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .borderRadius(HEADER_BACK_SLOT_SIZE)
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .scale({ x: this.starScale, y: this.starScale })
      .animation({ duration: 180, curve: Curve.FastOutSlowIn })
      .onClick(() => { void this.toggleStar() })
    }
    .height(HEADER_BACK_SLOT_SIZE)
  }

  @Builder
  private PlayOverlayButton() {
    Row() {
      SymbolGlyph($r('sys.symbol.play_fill'))
        .fontSize(26)
        .fontColor(['#FFFFFF'])
    }
    .width(62)
    .height(62)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor('rgba(17,24,39,0.42)')
    .borderRadius(999)
  }

  private hasAiAssistResult(): boolean {
    return !!this.aiSummary.trim() || !!this.aiTranslation.trim()
  }

  private hasAiAssistStatePanel(): boolean {
    return this.isAiProcessing
      || this.hasAiAssistResult()
      || !!this.aiSummaryError.trim()
      || !!this.aiTranslationError.trim()
  }

  @Builder
  private AIAssistResultCard(title: string, content: string) {
    Column({ space: 8 }) {
      Text(title)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.accent)
        .width('100%')

      Text(content)
        .fontSize(14)
        .lineHeight(22)
        .fontColor(this.theme.textPrimary)
        .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .backgroundColor(this.theme.elevated)
    .borderRadius(14)
  }

  @Builder
  private AIAssistResultSection() {
    Column({ space: 10 }) {
      if (this.isAiProcessing) {
        Row({ space: 8 }) {
          LoadingProgress()
            .width(14)
            .height(14)
            .color(this.theme.accent)

          Text('正在生成摘要与翻译...')
            .fontSize(12)
            .fontColor(this.theme.textSecondary)
            .width('100%')
            .layoutWeight(1)
        }
        .width('100%')
      }

      if (this.aiSummary.trim()) {
        this.AIAssistResultCard('AI 摘要', this.aiSummary)
      }

      if (this.aiTranslation.trim()) {
        this.AIAssistResultCard(`AI 翻译（${this.aiLanguageLabel()}）`, this.aiTranslation)
      }

      if (this.aiSummaryError.trim()) {
        Text(`摘要失败：${this.compactErrorMessage(this.aiSummaryError, 120)}`)
          .fontSize(12)
          .lineHeight(18)
          .fontColor('#D94848')
          .width('100%')
      }

      if (this.aiTranslationError.trim()) {
        Text(`翻译失败：${this.compactErrorMessage(this.aiTranslationError, 120)}`)
          .fontSize(12)
          .lineHeight(18)
          .fontColor('#D94848')
          .width('100%')
      }
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .backgroundColor(this.theme.elevated)
    .borderRadius(14)
  }

  @Builder
  private LiveBadge() {
    Row({ space: 4 }) {
      SymbolGlyph($r('sys.symbol.play_fill'))
        .fontSize(11)
        .fontColor(['rgba(255,255,255,0.92)'])

      Text('LIVE')
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor('rgba(255,255,255,0.92)')
    }
    .padding({ left: 8, right: 8, top: 5, bottom: 5 })
    .margin({ top: 10, right: 10 })
    .backgroundColor('rgba(0,0,0,0.22)')
    .borderRadius(999)
  }

  @Builder
  private LiveSoundToggle() {
    Row({ space: 4 }) {
      SymbolGlyph($r(this.detailLivePhotoMuted ? 'sys.symbol.speaker_slash_fill' : 'sys.symbol.speaker_wave_2_fill'))
        .fontSize(11)
        .fontColor(['rgba(255,255,255,0.92)'])

      Text(this.detailLivePhotoMuted ? '静音' : '有声')
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor('rgba(255,255,255,0.92)')
    }
    .padding({ left: 8, right: 8, top: 5, bottom: 5 })
    .margin({ right: 10, bottom: 10 })
    .backgroundColor('rgba(0,0,0,0.28)')
    .borderRadius(999)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.toggleDetailLivePhotoMuted()
    })
  }

  @Builder
  private DetailLivePhotoSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(item.imageUrl)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
          .onComplete((event) => {
            if (event) {
              this.rememberDetailLivePhotoAspectRatio(index, event.width, event.height)
            }
          })
          .visibility((this.shouldShowPlayingDetailLivePhoto(index) || this.shouldShowPausedDetailLivePhoto(index))
            ? Visibility.Hidden
            : Visibility.Visible)

        if (item.kind === 'livePhoto' && item.videoUrl && this.mountedDetailLivePhotoIndices().includes(index)) {
          Video({
            src: item.videoUrl,
            controller: this.detailLivePhotoControllerFor(index),
            previewUri: item.imageUrl,
          })
            .width('100%')
            .height('100%')
            .borderRadius(18)
            .controls(false)
            .autoPlay(this.shouldWarmDetailLivePhoto(index))
            .loop(true)
            .muted(this.detailLivePhotoMuted || !this.shouldShowPlayingDetailLivePhoto(index))
            .objectFit(ImageFit.Cover)
            .opacity((this.shouldShowPlayingDetailLivePhoto(index) || this.shouldShowPausedDetailLivePhoto(index)) ? 1 : 0)
            .onPrepared(() => {
              this.handleDetailLivePhotoPrepared(index)
            })
            .onStart(() => {
              this.handleDetailLivePhotoStart(index)
            })
            .onPause(() => {
              this.handleDetailLivePhotoPause(index)
            })
            .onStop(() => {
              this.handleDetailLivePhotoStop(index)
            })
            .onError(() => {
              this.handleDetailLivePhotoError(index)
            })
        }
      }
      .width('100%')
      .height('100%')
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        this.toggleDetailLivePhotoPlayback(index)
      })

      if (this.shouldShowDetailLivePhotoLoading(index)) {
        Stack() {
          LoadingProgress()
            .width(28)
            .height(28)
            .color(this.theme.accent)
        }
        .width('100%')
        .height('100%')
        .align(Alignment.Center)
      }

      Stack() {
        this.LiveBadge()
      }
      .width('100%')
      .height('100%')
      .align(Alignment.TopEnd)

      Stack() {
        this.LiveSoundToggle()
      }
      .width('100%')
      .height('100%')
      .align(Alignment.BottomEnd)
    }
    .width('100%')
    .aspectRatio(this.detailLivePhotoAspectRatio(index))
    .onVisibleAreaChange([0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0], (isVisible: boolean, currentRatio: number) => {
      this.updateDetailLivePhotoVisibility(index, isVisible, currentRatio)
    })
  }

  @Builder
  private PictureDetailMediaCarousel() {
    if (this.pictureDetailMediaItems().length > 0) {
      Column({ space: 20 }) {
        ForEach(this.pictureDetailMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
          Column() {
            if (item.kind === 'livePhoto') {
              this.DetailLivePhotoSlide(item, index)
            } else {
              Stack({ alignContent: Alignment.Center }) {
                Image(item.imageUrl)
                  .width('100%')
                  .height('100%')
                  .objectFit(ImageFit.Contain)
                  .borderRadius(18)
                  .backgroundColor(this.theme.elevated)
                  .onComplete((event) => {
                    if (event) {
                      this.rememberDetailLivePhotoAspectRatio(index, event.width, event.height)
                    }
                  })
              }
              .width('100%')
              .aspectRatio(this.detailLivePhotoAspectRatio(index))
              .clip(true)
              .borderRadius(18)
              .backgroundColor(this.theme.elevated)
              .onClick(() => {
                void openImageViewer(item.imageUrl, this.entry?.title || '图片预览')
              })
            }
          }
          .width('100%')
        }, (item: PictureCarouselMediaItem, index: number) =>
          `${item.kind}-${item.imageUrl}-${item.videoUrl}-${index}-${this.detailLivePhotoInstanceSeed(index)}`)
      }
      .width('100%')
      .onVisibleAreaChange([0], (isVisible: boolean) => {
        if (!isVisible) {
          this.isPictureMediaNearlyVisible = false
          this.isPictureMediaFullyVisible = false
          this.detailLivePhotoVisibilityRatios = []
          this.stopDetailLivePhotoPlayback()
        }
      })
      .onDisAppear(() => {
        this.stopDetailLivePhotoPlayback()
      })
    }
  }

  @Builder
  private ContentBlockItem(block: ArticleContentBlock, index: number) {
    if (block.type === 'image' && block.imageUrl && !this.imageBlockServesAsVideoCover(index)) {
      Column() {
        Stack({ alignContent: Alignment.Center }) {
          Image(block.imageUrl)
            .width('100%')
            .height('100%')
            .objectFit(ImageFit.Contain)
            .borderRadius(18)
            .backgroundColor(this.theme.elevated)
            .onComplete((event) => {
              if (event) {
                this.rememberMediaAspectRatio(index, event.width, event.height)
              }
            })
        }
        .width('100%')
        .aspectRatio(this.mediaAspectRatio(index))
        .constraintSize({ maxHeight: 640 })
        .clip(true)
        .borderRadius(18)
        .backgroundColor(this.theme.elevated)
        .onClick(() => {
          this.openImageBlock(block)
        })
      }
      .width('100%')
    } else if (block.type === 'video' && block.videoUrl) {
      Column() {
        if (this.isVideoPlaying(block)) {
          Column() {
            if (this.isDirectVideoFile(block.videoUrl)) {
              Stack({ alignContent: Alignment.Center }) {
                if (this.resolveVideoPreviewImage(block, index)) {
                  Image(this.resolveVideoPreviewImage(block, index))
                    .width('100%')
                    .height('100%')
                    .objectFit(ImageFit.Contain)
                    .opacity(0)
                    .onComplete((event) => {
                      if (event) {
                        this.rememberMediaAspectRatio(index, event.width, event.height)
                      }
                    })
                }

                if (this.shouldUseNativeMovingPhoto(block) && this.activeMovingPhoto) {
                  MovingPhotoView({
                    movingPhoto: this.activeMovingPhoto,
                    controller: this.movingPhotoController,
                  })
                    .width('100%')
                    .height('100%')
                    .muted(true)
                    .objectFit(ImageFit.Contain)
                    .autoPlay(true)
                    .repeatPlay(false)
                    .autoPlayPeriod(0, 1500)
                    .onPrepared(() => {
                      if (this.inlineVideoPreparingBlockId === block.id) {
                        this.inlineVideoPreparingBlockId = ''
                      }
                    })
                    .onStart(() => {
                      if (this.inlineVideoPreparingBlockId === block.id) {
                        this.inlineVideoPreparingBlockId = ''
                      }
                    })
                    .onError(() => {
                      this.activeMovingPhoto = undefined
                      this.inlineVideoPreparingBlockId = ''
                      this.actionHint = '动态照片播放失败，请稍后重试'
                    })
                } else {
                  Video({
                    src: this.activeVideoPlayableUrl || block.videoUrl,
                    controller: this.nativeVideoController,
                    previewUri: this.resolveVideoPreviewImage(block, index),
                  })
                    .width('100%')
                    .height('100%')
                    .borderRadius(18)
                    .controls(true)
                    .autoPlay(true)
                    .objectFit(ImageFit.Contain)
                    .onPrepared(() => {
                      if (this.inlineVideoPreparingBlockId === block.id) {
                        this.inlineVideoPreparingBlockId = ''
                      }
                    })
                    .onStart(() => {
                      if (this.inlineVideoPreparingBlockId === block.id) {
                        this.inlineVideoPreparingBlockId = ''
                      }
                    })
                    .onError(() => {
                      this.inlineVideoPreparingBlockId = ''
                      this.actionHint = '应用内播放失败，请稍后重试'
                    })
                }

                if (this.isInlineVideoPreparing(block)) {
                  LoadingProgress()
                    .width(28)
                    .height(28)
                    .color(this.theme.accent)
                }
              }
                .width('100%')
                .aspectRatio(this.mediaAspectRatio(index))
                .constraintSize({ maxHeight: 640 })
                .clip(true)
                .borderRadius(18)
                .backgroundColor(this.theme.elevated)
            } else if (this.isYouTubeVideo(block.videoUrl)) {
              if (this.activeVideoPlayableUrl) {
                Stack({ alignContent: Alignment.Center }) {
                  if (this.resolveVideoPreviewImage(block, index)) {
                    Image(this.resolveVideoPreviewImage(block, index))
                      .width('100%')
                      .height('100%')
                      .objectFit(ImageFit.Contain)
                      .opacity(0)
                      .onComplete((event) => {
                        if (event) {
                          this.rememberMediaAspectRatio(index, event.width, event.height)
                        }
                      })
                  }

                  Video({
                    src: this.activeVideoPlayableUrl,
                    controller: this.nativeVideoController,
                    previewUri: this.resolveVideoPreviewImage(block, index),
                  })
                    .width('100%')
                    .height('100%')
                    .borderRadius(18)
                    .controls(false)
                    .autoPlay(true)
                    .objectFit(ImageFit.Contain)
                    .onError(() => {
                      this.actionHint = '应用内播放失败，请稍后重试'
                    })
                }
                .width('100%')
                .aspectRatio(this.mediaAspectRatio(index))
                .constraintSize({ maxHeight: 640 })
                .clip(true)
                .borderRadius(18)
                .backgroundColor(this.theme.elevated)
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
                .aspectRatio(this.mediaAspectRatio(index))
                .constraintSize({ maxHeight: 640 })
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
                  .aspectRatio(this.mediaAspectRatio(index))
                  .constraintSize({ maxHeight: 640 })
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
                .aspectRatio(this.mediaAspectRatio(index))
                .constraintSize({ maxHeight: 640 })
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
                .aspectRatio(this.mediaAspectRatio(index))
                .constraintSize({ maxHeight: 640 })
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
          }
          .width('100%')
        } else {
          Stack({ alignContent: Alignment.Center }) {
            if (this.resolveVideoPreviewImage(block, index)) {
              Image(this.resolveVideoPreviewImage(block, index))
                .width('100%')
                .height('100%')
                .objectFit(ImageFit.Contain)
                .borderRadius(18)
                .backgroundColor(this.theme.elevated)
                .onComplete((event) => {
                  if (event) {
                    this.rememberMediaAspectRatio(index, event.width, event.height)
                  }
                })
            } else {
              Row()
                .width('100%')
                .height('100%')
                .backgroundColor(this.theme.elevated)
                .borderRadius(18)
            }

            this.PlayOverlayButton()
          }
          .width('100%')
          .aspectRatio(this.mediaAspectRatio(index))
          .constraintSize({ maxHeight: 640 })
          .clip(true)
          .onClick(() => {
            this.openVideoBlock(block)
          })
        }
      }
      .width('100%')
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
      SecondaryPageHeaderShell() {
        Column({ space: 8 }) {
          PageHeader({
            title: '文章详情',
            theme: this.theme,
            showBackButton: true,
            showTrailingBuilder: true,
            titleSize: 20,
            topPadding: 0,
            bottomPadding: 0,
            onBack: () => { void goBack() },
          }) {
            this.HeaderActions()
          }
        }
        .width('100%')
      }

      if (this.entry) {
        Scroll() {
          Column({ space: 18 }) {
            if (!this.isSocialDetail()) {
              Column({ space: 12 }) {
                if (!this.isPictureDetail()) {
                  Text(this.entry!.title)
                    .fontSize(28)
                    .lineHeight(38)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(this.theme.textPrimary)
                    .width('100%')
                }

                Text(`${this.entry!.author} · ${this.entry!.publishedLabel}`)
                  .fontSize(13)
                  .lineHeight(20)
                  .fontColor(this.theme.textSecondary)
                  .width('100%')
              }
              .width('100%')
              .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 })
              .alignItems(HorizontalAlign.Start)
            }

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
              if (this.hasAiAssistStatePanel()) {
                this.AIAssistResultSection()
              }

              if (this.isSocialDetail()) {
                this.SocialTweetDetail()
              } else {
                if (this.isPictureDetail() && (this.entry!.title || '').trim()) {
                  Text(this.entry!.title)
                    .fontSize(16)
                    .lineHeight(29)
                    .fontColor(this.theme.textPrimary)
                    .width('100%')
                    .textAlign(TextAlign.Start)
                }

                if (this.isPictureDetail()) {
                  this.PictureDetailMediaCarousel()
                }

                if (this.shouldRenderSummary()) {
                  Text(this.entry!.summary)
                    .fontSize(16)
                    .lineHeight(27)
                    .fontColor(this.theme.textSecondary)
                    .fontWeight(FontWeight.Medium)
                    .width('100%')
                }

                if (this.entry!.contentBlocks.length > 0) {
                  ForEach(this.pictureDetailTextBlocks(), (block: ArticleContentBlock, index: number) => {
                    if (this.shouldRenderParagraphBlock(block, index)) {
                      this.ContentBlockItem(block, index)
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

                if (!this.isPictureDetail()) {
                }
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
          .justifyContent(FlexAlign.Start)
          .constraintSize({ minHeight: '100%' })
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
    .backgroundColor(this.theme.background)
  }
}
