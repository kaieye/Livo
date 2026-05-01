import { curves } from '@kit.ArkUI'
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
import { PictureCarouselMediaItem } from '../common/utils/PictureGallery'
import { resolveArticleSourceUrl } from '../common/utils/ArticleSourceUrl'
import { resolveYouTubePlaybackDisplay } from '../common/utils/YouTubePlaybackDisplay'
import { resolveVideoPlaybackTarget } from '../common/utils/VideoPlaybackTarget'
import {
  articleImageBlockServesAsVideoCover,
  resolveArticleVideoPreviewImage,
  resolvePictureDetailMediaItems,
  resolvePictureDetailTextBlocks,
  shouldRenderArticleParagraphBlock,
  shouldRenderArticleSummary,
} from '../common/utils/ArticleDetailContent'
import {
  shouldOpenYouTubeExternallyOnFallback,
  shouldUseYouTubeWebFallback,
} from '../common/utils/YouTubePlaybackMode'
import { PageHeader } from '../common/components/PageHeader'
import { SecondaryPageHeaderShell } from '../common/components/SecondaryPageHeaderShell'
import { ArticleSocialDetail } from '../common/components/ArticleSocialDetail'
import { ArticlePictureDetailMedia } from '../common/components/ArticlePictureDetailMedia'
import { ArticleDetailHeaderActions } from '../common/components/ArticleDetailHeaderActions'
import { ArticleAIAssistResultPanel } from '../common/components/ArticleAIAssistResultPanel'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  AITargetLanguage,
  HarmonySettings,
  isLegacyPlainArticleContent,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'
import { presentTweetEntryFromCard, TweetEntryPresentation } from '../common/utils/TweetEntryPresentation'

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
  @State private activeSocialInlineVideoKey: string = ''
  private upgradedEntryIds: Set<string> = new Set<string>()
  private videoWebController: webview.WebviewController = new webview.WebviewController()
  private nativeVideoController: VideoController = new VideoController()
  private readonly movingPhotoController: MovingPhotoViewController = new MovingPhotoViewController()
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
    if (!(item.videoUrl || '').trim()) {
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

    return resolvePictureDetailMediaItems(this.entry?.contentBlocks ?? [])
  }

  private pictureDetailTextBlocks(): ArticleContentBlock[] {
    if (!this.isPictureDetail()) {
      return this.entry?.contentBlocks ?? []
    }

    return resolvePictureDetailTextBlocks(this.entry?.contentBlocks ?? [])
  }

  private shouldRenderSummary(): boolean {
    return shouldRenderArticleSummary(this.entry)
  }

  private shouldRenderParagraphBlock(block: ArticleContentBlock, index: number): boolean {
    return shouldRenderArticleParagraphBlock(this.entry, block, index)
  }

  private imageBlockServesAsVideoCover(index: number): boolean {
    return articleImageBlockServesAsVideoCover(this.entry?.contentBlocks ?? [], index)
  }

  private resolveVideoPreviewImage(block: ArticleContentBlock, index: number): string {
    return resolveArticleVideoPreviewImage(this.entry?.contentBlocks ?? [], block, index)
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
            ArticleDetailHeaderActions({
              theme: this.theme,
              isStarred: this.entry?.isStarred ?? false,
              starScale: this.starScale,
              onRunAi: () => { void this.handleArticleAIAssist() },
              onOpenBrowser: () => { void this.openEntryInBrowser() },
              onToggleStar: () => { void this.toggleStar() },
            })
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
                ArticleAIAssistResultPanel({
                  theme: this.theme,
                  isProcessing: this.isAiProcessing,
                  summary: this.aiSummary,
                  translation: this.aiTranslation,
                  summaryError: this.aiSummaryError,
                  translationError: this.aiTranslationError,
                  targetLanguageLabel: this.aiLanguageLabel(),
                })
              }

              if (this.isSocialDetail()) {
                ArticleSocialDetail({
                  presentation: this.tweetPresentation(),
                  theme: this.theme,
                  isInlineVideoActive: (section: string, item: PictureCarouselMediaItem, index: number): boolean => {
                    return this.isSocialInlineVideoActive(section, item, index)
                  },
                  inlineVideoControllerFor: (section: string, item: PictureCarouselMediaItem, index: number): VideoController => {
                    return this.socialInlineVideoControllerFor(section, item, index)
                  },
                  onPlayInlineVideo: (section: string, item: PictureCarouselMediaItem, index: number): void => {
                    this.playSocialInlineVideo(section, item, index)
                  },
                  onOpenImage: (item: PictureCarouselMediaItem): void => {
                    this.openSocialImage(item)
                  },
                })
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
                  ArticlePictureDetailMedia({
                    mediaItems: this.pictureDetailMediaItems(),
                    title: this.entry!.title || '图片预览',
                    theme: this.theme,
                  })
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

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 280, curve: Curve.FastOutSlowIn })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
