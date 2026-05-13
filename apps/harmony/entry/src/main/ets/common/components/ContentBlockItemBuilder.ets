import webview from '@ohos.web.webview'
import { MovingPhotoView, MovingPhotoViewController, photoAccessHelper } from '@kit.MediaLibraryKit'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ArticleContentBlock } from '../models/LivoModels'
import {
  articleImageBlockServesAsVideoCover,
  resolveArticleVideoPreviewImage,
} from '../utils/ArticleDetailContent'
import { isArticleDirectVideo, isArticleYouTubeVideo, resolveInAppEmbedUrl } from '../utils/ArticleVideoUrlClassifier'
import { shouldUseYouTubeWebFallback } from '../utils/YouTubePlaybackMode'
import { AudioPlaybackService } from '../services/AudioPlaybackService'

const WEB_VIDEO_USER_AGENT: string =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

/**
 * Renders a single article content block (image, video, or text).
 *
 * Inline video state (which block is active, the resolved URLs, and the
 * loaded MovingPhoto reference) is owned by the page and passed in via
 * @Prop / callback. Imperative controllers (native video, moving photo,
 * web view) are also created on the page and shared in.
 */
@Component
export struct ContentBlockItemBuilder {
  @Prop block: ArticleContentBlock = {} as ArticleContentBlock
  @Prop index: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop contentBlocks: ArticleContentBlock[] = []
  @Prop mediaAspectRatios: number[] = []

  @Prop activeVideoBlockId: string = ''
  @Prop activeVideoPlayableUrl: string = ''
  @Prop activeVideoFallbackUrl: string = ''
  @Prop isResolvingActiveVideo: boolean = false
  @Prop inlineVideoPreparingBlockId: string = ''
  @Prop activeMovingPhoto: photoAccessHelper.MovingPhoto | undefined = undefined
  @Prop shouldUseInlineMovingPhoto: boolean = false
  @StorageProp('audioServicePlaying') private audioPlaying: boolean = false
  @StorageProp('audioServicePreparing') private audioPreparing: boolean = false
  @StorageProp('audioServicePositionMs') private audioPositionMs: number = 0
  @StorageProp('audioServiceDurationMs') private audioDurationMs: number = 0
  @StorageProp('audioServiceError') private audioError: string = ''

  nativeVideoController: VideoController = new VideoController()
  movingPhotoController: MovingPhotoViewController = new MovingPhotoViewController()
  videoWebController: webview.WebviewController = new webview.WebviewController()
  private audioService: AudioPlaybackService = AudioPlaybackService.getInstance()

  onMediaAspectRatio: (index: number, width: number, height: number) => void = () => {}
  onActionHint: (hint: string) => void = () => {}
  onClearMovingPhoto: () => void = () => {}
  onClearInlineVideoPreparing: (blockId: string) => void = () => {}
  onOpenVideo: (block: ArticleContentBlock) => void = () => {}
  onOpenGallery: (url: string) => void = () => {}

  aboutToDisappear(): void {
    // Audio player is now owned by AudioPlaybackService — no release needed here.
  }

  private mediaAspectRatio(): number {
    const ratio = this.mediaAspectRatios[this.index]
    return ratio && ratio > 0 ? ratio : 4 / 5
  }

  private resolvePreviewImage(): string {
    return resolveArticleVideoPreviewImage(this.contentBlocks, this.block, this.index)
  }

  private isVideoPlaying(): boolean {
    return this.activeVideoBlockId === this.block.id
  }

  private isInlineVideoPreparing(): boolean {
    return this.inlineVideoPreparingBlockId === this.block.id
  }

  private audioSourceUrl(): string {
    return (this.block.audioUrl || '').trim()
  }

  private audioProgressWidth(): string {
    if (this.audioDurationMs <= 0) {
      return '0%'
    }
    const percent = Math.max(0, Math.min(100, (this.audioPositionMs / this.audioDurationMs) * 100))
    return `${percent}%`
  }

  private formatAudioTime(valueMs: number): string {
    const seconds = Math.max(0, Math.floor((valueMs || 0) / 1000))
    const minutes = Math.floor(seconds / 60)
    const restSeconds = seconds % 60
    return `${minutes}:${restSeconds < 10 ? '0' : ''}${restSeconds}`
  }

  private toggleAudioPlayback(): void {
    const url = this.audioSourceUrl()
    if (!url) {
      return
    }
    this.audioService.togglePlayback(url, this.block.text || '音频')
  }

  private rememberAspectRatio(width: number, height: number): void {
    if (width > 0 && height > 0) {
      this.onMediaAspectRatio(this.index, width, height)
    }
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

  @Builder
  private ImageBlock() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.block.imageUrl)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
          .onComplete((event) => {
            if (event) {
              this.rememberAspectRatio(event.width, event.height)
            }
          })
      }
      .width('100%')
      .aspectRatio(this.mediaAspectRatio())
      .constraintSize({ maxHeight: 640 })
      .clip(true)
      .borderRadius(18)
      .backgroundColor(this.theme.elevated)
      .onClick(() => {
        this.onOpenGallery(this.block.imageUrl)
      })
    }
    .width('100%')
  }

  @Builder
  private DirectVideoSurface() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolvePreviewImage()) {
        Image(this.resolvePreviewImage())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .opacity(0)
          .onComplete((event) => {
            if (event) {
              this.rememberAspectRatio(event.width, event.height)
            }
          })
      }

      if (this.shouldUseInlineMovingPhoto && this.activeMovingPhoto) {
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
          .onPrepared(() => { this.onClearInlineVideoPreparing(this.block.id) })
          .onStart(() => { this.onClearInlineVideoPreparing(this.block.id) })
          .onError(() => {
            this.onClearMovingPhoto()
            this.onClearInlineVideoPreparing(this.block.id)
            this.onActionHint('动态照片播放失败，请稍后重试')
          })
      } else {
        Video({
          src: this.activeVideoPlayableUrl || this.block.videoUrl,
          controller: this.nativeVideoController,
          previewUri: this.resolvePreviewImage(),
        })
          .width('100%')
          .height('100%')
          .borderRadius(18)
          .controls(true)
          .autoPlay(true)
          .objectFit(ImageFit.Contain)
          .onPrepared(() => { this.onClearInlineVideoPreparing(this.block.id) })
          .onStart(() => { this.onClearInlineVideoPreparing(this.block.id) })
          .onError(() => {
            this.onClearInlineVideoPreparing(this.block.id)
            this.onActionHint('应用内播放失败，请稍后重试')
          })
      }

      if (this.isInlineVideoPreparing()) {
        LoadingProgress()
          .width(28)
          .height(28)
          .color(this.theme.accent)
      }
    }
    .width('100%')
    .aspectRatio(this.mediaAspectRatio())
    .constraintSize({ maxHeight: 640 })
    .clip(true)
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
  }

  @Builder
  private YouTubeNativeSurface() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolvePreviewImage()) {
        Image(this.resolvePreviewImage())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .opacity(0)
          .onComplete((event) => {
            if (event) {
              this.rememberAspectRatio(event.width, event.height)
            }
          })
      }

      Video({
        src: this.activeVideoPlayableUrl,
        controller: this.nativeVideoController,
        previewUri: this.resolvePreviewImage(),
      })
        .width('100%')
        .height('100%')
        .borderRadius(18)
        .controls(false)
        .autoPlay(true)
        .objectFit(ImageFit.Contain)
        .onError(() => {
          this.onActionHint('应用内播放失败，请稍后重试')
        })
    }
    .width('100%')
    .aspectRatio(this.mediaAspectRatio())
    .constraintSize({ maxHeight: 640 })
    .clip(true)
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
  }

  @Builder
  private YouTubeResolvingSurface() {
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
    .aspectRatio(this.mediaAspectRatio())
    .constraintSize({ maxHeight: 640 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(this.theme.elevated)
    .borderRadius(18)
  }

  @Builder
  private YouTubeWebFallbackSurface() {
    Web({
      src: this.activeVideoFallbackUrl,
      controller: this.videoWebController,
    })
      .width('100%')
      .aspectRatio(this.mediaAspectRatio())
      .constraintSize({ maxHeight: 640 })
      .borderRadius(18)
      .javaScriptAccess(true)
      .domStorageAccess(true)
      .mixedMode(MixedMode.All)
      .onControllerAttached(() => {
        try {
          webview.WebCookieManager.putAcceptCookieEnabled(true)
          webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true)
          this.videoWebController.setCustomUserAgent(WEB_VIDEO_USER_AGENT)
        } catch (_error) {
        }
      })
      .onPageBegin((_event: OnPageBeginEvent) => {
        this.onActionHint('正在加载 YouTube 播放器...')
      })
      .onPageEnd((_event: OnPageEndEvent) => {
        this.onActionHint('')
      })
      .onErrorReceive((event: OnErrorReceiveEvent) => {
        if (event.request?.isMainFrame()) {
          this.onActionHint('YouTube 播放器加载失败，请稍后重试')
        }
      })
  }

  @Builder
  private YouTubeUnresolvedSurface() {
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
    .aspectRatio(this.mediaAspectRatio())
    .constraintSize({ maxHeight: 640 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(this.theme.elevated)
    .borderRadius(18)
  }

  @Builder
  private WebEmbedSurface() {
    Web({
      src: resolveInAppEmbedUrl(this.block.videoUrl, this.activeVideoFallbackUrl),
      controller: this.videoWebController,
    })
      .width('100%')
      .aspectRatio(this.mediaAspectRatio())
      .constraintSize({ maxHeight: 640 })
      .borderRadius(18)
      .javaScriptAccess(true)
      .domStorageAccess(true)
      .onPageEnd((_event: OnPageEndEvent) => {
        this.onActionHint('')
      })
      .onErrorReceive((event: OnErrorReceiveEvent) => {
        if (event.request?.isMainFrame()) {
          this.onActionHint('应用内播放失败，可尝试外部打开')
        }
      })
  }

  @Builder
  private VideoPlayingContent() {
    Column() {
      if (isArticleDirectVideo(this.block.videoUrl)) {
        this.DirectVideoSurface()
      } else if (isArticleYouTubeVideo(this.block.videoUrl)) {
        if (this.activeVideoPlayableUrl) {
          this.YouTubeNativeSurface()
        } else if (this.isResolvingActiveVideo) {
          this.YouTubeResolvingSurface()
        } else if (shouldUseYouTubeWebFallback() && this.activeVideoFallbackUrl) {
          this.YouTubeWebFallbackSurface()
        } else {
          this.YouTubeUnresolvedSurface()
        }
      } else {
        this.WebEmbedSurface()
      }
    }
    .width('100%')
  }

  @Builder
  private VideoPreviewContent() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolvePreviewImage()) {
        Image(this.resolvePreviewImage())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
          .onComplete((event) => {
            if (event) {
              this.rememberAspectRatio(event.width, event.height)
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
    .aspectRatio(this.mediaAspectRatio())
    .constraintSize({ maxHeight: 640 })
    .clip(true)
    .onClick(() => {
      this.onOpenVideo(this.block)
    })
  }

  @Builder
  private VideoBlock() {
    Column() {
      if (this.isVideoPlaying()) {
        this.VideoPlayingContent()
      } else {
        this.VideoPreviewContent()
      }
    }
    .width('100%')
  }

  @Builder
  private TextBlock() {
    Column({ space: 0 }) {
      Text(this.block.text)
        .fontSize(16)
        .lineHeight(29)
        .fontColor(this.theme.textPrimary)
        .width('100%')
        .textAlign(TextAlign.Start)
    }
    .width('100%')
    .padding({ left: 2, right: 2 })
  }

  @Builder
  private AudioBlock() {
    Column({ space: 10 }) {
      Row({ space: 12 }) {
        Row() {
          if (this.audioPreparing) {
            LoadingProgress()
              .width(22)
              .height(22)
              .color(this.theme.accent)
          } else {
            SymbolGlyph($r(this.audioPlaying ? 'sys.symbol.pause_fill' : 'sys.symbol.play_fill'))
              .fontSize(24)
              .fontColor([this.theme.accent])
          }
        }
        .width(46)
        .height(46)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor(this.theme.elevated)
        .borderRadius(999)
        .onClick(() => {
          this.toggleAudioPlayback()
        })

        Column({ space: 6 }) {
          Text(this.block.text || '音频')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(`${this.formatAudioTime(this.audioPositionMs)} / ${this.formatAudioTime(this.audioDurationMs)}`)
            .fontSize(11)
            .fontColor(this.theme.textSecondary)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')

      Row() {
        Blank()
          .width(this.audioProgressWidth())
          .height(4)
          .backgroundColor(this.theme.accent)
          .borderRadius(999)
      }
      .width('100%')
      .height(4)
      .backgroundColor(this.theme.divider)
      .borderRadius(999)
      .clip(true)

      if (this.audioError) {
        Text(this.audioError)
          .fontSize(11)
          .fontColor(this.theme.textMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .backgroundColor(this.theme.surface)
    .border({ width: 0.8, color: this.theme.divider })
    .borderRadius(18)
  }

  build() {
    if (this.block.type === 'image' && this.block.imageUrl
      && !articleImageBlockServesAsVideoCover(this.contentBlocks, this.index)) {
      this.ImageBlock()
    } else if (this.block.type === 'video' && this.block.videoUrl) {
      this.VideoBlock()
    } else if (this.block.type === 'audio' && this.block.audioUrl) {
      this.AudioBlock()
    } else if (this.block.text) {
      this.TextBlock()
    }
  }
}
