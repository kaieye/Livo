import { common } from '@kit.AbilityKit'
import { photoAccessHelper } from '@kit.MediaLibraryKit'
import { AppPreferenceService } from '../common/services/AppPreferenceService'
import { EntryRepository } from '../common/repositories/EntryRepository'
import { goBack, openImageViewer } from '../common/navigation/AppRouter'
import { TranslationFormattingHint } from '../common/services/ArticleAssistService'
import { ExternalUrlService } from '../common/services/ExternalUrlService'
import { resolveArticleSourceUrl } from '../common/utils/ArticleSourceUrl'
import { PictureCarouselMediaItem } from '../common/utils/PictureGallery'
import {
  resolvePictureDetailMediaItems,
  resolvePictureDetailTextBlocks,
  shouldRenderArticleParagraphBlock,
  shouldRenderArticleSummary,
} from '../common/utils/ArticleDetailContent'
import { ArticleAIAssistViewModel } from '../common/utils/ArticleAIAssistViewModel'
import { ArticleInlineVideoPlaybackController } from '../common/utils/ArticleInlineVideoPlaybackController'
import { SocialInlineVideoRegistry } from '../common/utils/SocialInlineVideoRegistry'
import { ArticleEntryLoader, copyArticleEntryWithStarState } from '../common/utils/ArticleEntryLoader'
import { PageHeader } from '../common/components/PageHeader'
import { SecondaryPageHeaderShell } from '../common/components/SecondaryPageHeaderShell'
import { ArticleSocialDetail } from '../common/components/ArticleSocialDetail'
import { ArticleDetailHeaderActions } from '../common/components/ArticleDetailHeaderActions'
import { ArticleAIAssistResultPanel } from '../common/components/ArticleAIAssistResultPanel'
import { ArticleNonSocialContent } from '../common/components/ArticleNonSocialContent'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  AITargetLanguage,
  HarmonySettings,
} from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { showToast, TOAST_DURATION_SHORT } from '../common/utils/PageToastHelper'
import { PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'
import { presentTweetEntryFromCard, TweetEntryPresentation } from '../common/utils/TweetEntryPresentation'
import { getStringParams } from '../common/navigation/AppRouter'

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

  private readonly socialVideoRegistry: SocialInlineVideoRegistry = new SocialInlineVideoRegistry()
  private readonly aiAssistViewModel: ArticleAIAssistViewModel = new ArticleAIAssistViewModel(this)
  private readonly videoController: ArticleInlineVideoPlaybackController = new ArticleInlineVideoPlaybackController(this)
  private readonly entryLoader: ArticleEntryLoader = new ArticleEntryLoader(this)

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    void this.entryLoader.load(this.entryId(), true, true)
  }

  private entryId(): string {
    return getStringParams()?.entryId ?? ''
  }

  showToast(message: string, duration?: number): void {
    showToast(this.getUIContext(), message, duration ?? TOAST_DURATION_SHORT)
  }

  getHostContext(): common.UIAbilityContext {
    return this.getUIContext().getHostContext() as common.UIAbilityContext
  }

  private animateWithUiContext(options: AnimateParam, event: () => void): void {
    this.getUIContext().animateTo(options, event)
  }

  applyAISettings(settings: HarmonySettings): void {
    this.aiEnabled = settings.aiSummaryEnabled
    this.aiTranslationEnabled = settings.aiTranslationEnabled
    this.aiTargetLanguage = settings.aiTranslationLanguage
  }

  resetAIResultsIfEntryChanged(): void {
    const currentEntryId = this.entry?.id || ''
    if (currentEntryId && this.aiResultEntryId !== currentEntryId) {
      this.aiSummary = ''
      this.aiTranslation = ''
      this.aiSummaryError = ''
      this.aiTranslationError = ''
      this.aiResultEntryId = currentEntryId
    }
  }

  triggerAutoAIAssist(): void {
    void this.runArticleAIAssist()
  }

  isPictureDetail(): boolean {
    return (this.entry?.viewLabel || '').trim() === '图片'
  }

  isSocialDetail(): boolean {
    return (this.entry?.viewLabel || '').trim() === '社交'
  }

  private async handleArticleAIAssist(): Promise<void> {
    try {
      const settings = await AppPreferenceService.loadSettings()
      this.applyAISettings(settings)
      await this.runArticleAIAssist()
    } catch (error) {
      const message = `AI 处理失败：${error instanceof Error ? error.message : String(error)}`
      this.actionHint = message
      this.showToast(message, 2600)
    }
  }

  private async runArticleAIAssist(): Promise<void> {
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

    this.isAiProcessing = true
    try {
      await this.aiAssistViewModel.run({
        entry: this.entry,
        summaryEnabled: this.aiEnabled,
        translationEnabled: this.aiTranslationEnabled,
        targetLanguage: this.aiTargetLanguage,
        formattingHint: this.translationFormattingHint(),
      })
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
      this.entry = copyArticleEntryWithStarState(this.entry, !previousStarred)
    }

    this.animateWithUiContext({ duration: 140, curve: Curve.EaseOut }, () => { this.starScale = 1.28 })
    setTimeout(() => {
      this.animateWithUiContext({ duration: 240, curve: Curve.FastOutSlowIn }, () => { this.starScale = 1.0 })
    }, 100)

    try {
      await EntryRepository.toggleStar(entryId)
      await this.entryLoader.load(entryId, false, false)
      const message = this.entry?.isStarred ? '已收藏' : '已取消收藏'
      this.actionHint = message
      this.showToast(message)
    } catch (error) {
      if (this.entry) {
        this.entry = copyArticleEntryWithStarState(this.entry, previousStarred)
      }
      this.showToast('收藏操作失败，请稍后重试')
      console.error(`toggleStar failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private tweetPresentation(): TweetEntryPresentation {
    return presentTweetEntryFromCard(this.entry ?? {})
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

  private browserOpenUrl(): string {
    const articleUrl = (this.entry?.articleUrl || '').trim()
    if (articleUrl) {
      return articleUrl
    }
    if (!this.entry) {
      return ''
    }
    return resolveArticleSourceUrl({
      articleUrl: this.entry.articleUrl,
      siteUrl: this.entry.siteUrl,
      contentBlocks: this.entry.contentBlocks,
    })
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

  private hasAiAssistStatePanel(): boolean {
    return this.isAiProcessing
      || !!this.aiSummary.trim() || !!this.aiTranslation.trim()
      || !!this.aiSummaryError.trim() || !!this.aiTranslationError.trim()
  }

  private isSocialInlineVideoActive(section: string, item: PictureCarouselMediaItem, index: number): boolean {
    return this.activeSocialInlineVideoKey === SocialInlineVideoRegistry.keyFor(section, item, index)
  }

  private playSocialInlineVideo(section: string, item: PictureCarouselMediaItem, index: number): void {
    if (!(item.videoUrl || '').trim()) {
      return
    }
    this.activeSocialInlineVideoKey = SocialInlineVideoRegistry.keyFor(section, item, index)
  }

  private openSocialImage(item: PictureCarouselMediaItem): void {
    if ((item.imageUrl || '').trim()) {
      void openImageViewer(item.imageUrl, this.entry?.title || '图片预览')
    }
  }

  @Builder
  private DetailHeader() {
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
  }

  @Builder
  private MetadataRow() {
    if (!this.isSocialDetail()) {
      Column({ space: 12 }) {
        if (!this.isPictureDetail()) {
          Text(this.entry!.title)
            .fontSize(28).lineHeight(38).fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary).width('100%')
        }
        Text(`${this.entry!.author} · ${this.entry!.publishedLabel}`)
          .fontSize(13).lineHeight(20).fontColor(this.theme.textSecondary).width('100%')
      }
      .width('100%')
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 })
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private TagsRow() {
    if (this.entry!.tags.length > 0) {
      Row({ space: 8 }) {
        ForEach(this.entry!.tags, (tag: string) => {
          Text(tag)
            .fontSize(12).fontColor(this.theme.textSecondary)
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .backgroundColor(this.theme.elevated).borderRadius(999)
        }, (tag: string) => tag)
      }
      .width('100%')
      .margin({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
    }
  }

  @Builder
  private NonSocialBody() {
    ArticleNonSocialContent({
      entry: this.entry!,
      theme: this.theme,
      mediaAspectRatios: this.mediaAspectRatios,
      shouldRenderSummary: shouldRenderArticleSummary(this.entry),
      isPictureDetail: this.isPictureDetail(),
      pictureDetailMediaItems: this.isPictureDetail() ? resolvePictureDetailMediaItems(this.entry?.contentBlocks ?? []) : [],
      textBlocks: this.isPictureDetail()
        ? resolvePictureDetailTextBlocks(this.entry?.contentBlocks ?? [])
        : (this.entry?.contentBlocks ?? []),
      activeVideoBlockId: this.activeVideoBlockId,
      activeVideoPlayableUrl: this.activeVideoPlayableUrl,
      activeVideoFallbackUrl: this.activeVideoFallbackUrl,
      isResolvingActiveVideo: this.isResolvingActiveVideo,
      inlineVideoPreparingBlockId: this.inlineVideoPreparingBlockId,
      activeMovingPhoto: this.activeMovingPhoto,
      nativeVideoController: this.videoController.nativeVideo,
      movingPhotoController: this.videoController.movingPhoto,
      shouldUseInlineMovingPhotoFor: (block: ArticleContentBlock) => this.videoController.shouldUseNativeMovingPhoto(block),
      renderBlockCheck: (block: ArticleContentBlock, index: number) => shouldRenderArticleParagraphBlock(this.entry, block, index),
      onMediaAspectRatio: (idx: number, w: number, h: number) => this.rememberMediaAspectRatio(idx, w, h),
      onActionHint: (hint: string) => { this.actionHint = hint },
      onClearMovingPhoto: () => { this.activeMovingPhoto = undefined },
      onClearInlineVideoPreparing: (blockId: string) => {
        if (this.inlineVideoPreparingBlockId === blockId) { this.inlineVideoPreparingBlockId = '' }
      },
      onOpenImage: (block: ArticleContentBlock) => {
        if (block.imageUrl) { void openImageViewer(block.imageUrl, this.entry?.title || '图片预览') }
      },
      onOpenVideo: (block: ArticleContentBlock) => {
        this.videoController.open(block, () => {
          ArticleInlineVideoPlaybackController.openVideoFullscreen(this.entry?.title || '', block)
        })
      },
    })
  }

  @Builder
  private DetailBody() {
    Column({ space: 20 }) {
      if (this.hasAiAssistStatePanel()) {
        ArticleAIAssistResultPanel({
          theme: this.theme,
          isProcessing: this.isAiProcessing,
          summary: this.aiSummary,
          translation: this.aiTranslation,
          summaryError: this.aiSummaryError,
          translationError: this.aiTranslationError,
          targetLanguageLabel: ArticleAIAssistViewModel.labelFor(this.aiTargetLanguage),
        })
      }

      if (this.isSocialDetail()) {
        ArticleSocialDetail({
          presentation: this.tweetPresentation(),
          theme: this.theme,
          isInlineVideoActive: (section: string, item: PictureCarouselMediaItem, index: number) =>
            this.isSocialInlineVideoActive(section, item, index),
          inlineVideoControllerFor: (section: string, item: PictureCarouselMediaItem, index: number) =>
            this.socialVideoRegistry.controllerFor(section, item, index),
          onPlayInlineVideo: (section: string, item: PictureCarouselMediaItem, index: number) =>
            this.playSocialInlineVideo(section, item, index),
          onOpenImage: (item: PictureCarouselMediaItem) => this.openSocialImage(item),
        })
      } else {
        this.NonSocialBody()
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 18, right: 18, top: 12, bottom: 22 })
    .margin({ top: 4, bottom: 16 })
  }

  build() {
    Column() {
      this.DetailHeader()

      if (this.entry) {
        Scroll() {
          Column({ space: 18 }) {
            this.MetadataRow()
            this.TagsRow()
            this.DetailBody()
          }
          .width('100%')
          .padding({ bottom: this.bottomAvoidArea + 28 })
          .alignItems(HorizontalAlign.Start)
          .justifyContent(FlexAlign.Start)
          .constraintSize({ minHeight: '100%' })
        }
        .width('100%').layoutWeight(1).scrollBar(BarState.Off).edgeEffect(EdgeEffect.Spring)
      } else {
        Column({ space: 12 }) {
          Text('未找到内容')
            .fontSize(24).fontWeight(FontWeight.Bold).fontColor(this.theme.textPrimary)

          Text('请从订阅页重新进入一个条目。')
            .fontSize(15).fontColor(this.theme.textSecondary)
        }
        .width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
      }
    }
    .width('100%').height('100%').backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 280, curve: Curve.FastOutSlowIn }).opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut }).opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut }).opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut }).opacity(0)
  }
}
