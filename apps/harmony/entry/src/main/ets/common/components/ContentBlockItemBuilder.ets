import { ThemePalette, ThemeService } from '../services/ThemeService'
import { ArticleContentBlock } from '../models/LivoModels'
import {
  articleImageBlockServesAsVideoCover,
  resolveArticleVideoPreviewImage,
} from '../utils/ArticleDetailContent'
import { openImageViewer } from '../navigation/AppRouter'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import { VideoResolverService } from '../services/VideoResolverService'
import webview from '@ohos.web.webview'

@Component
export struct ContentBlockItemBuilder {
  @ObjectLink block: ArticleContentBlock
  @Prop index: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop mediaAspectRatio: number = 4 / 5
  @Prop mediaAspectRatios: number[] = []
  @Prop contentBlocks: ArticleContentBlock[] = []

  onMediaAspectRatioChange: (index: number, width: number, height: number) => void = () => {}
  onActionHintChange: (hint: string) => void = () => {}

  private videoWebController: webview.WebviewController = new webview.WebviewController()
  private nativeVideoController: VideoController = new VideoController()
  private readonly webVideoUserAgent: string =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

  @State private isPlaying: boolean = false
  @State private playableUrl: string = ''
  @State private fallbackUrl: string = ''
  @State private isResolving: boolean = false
  @State private isWebFallback: boolean = false

  private mediaAspectRatioForIndex(): number {
    const ratio = this.mediaAspectRatios[this.index]
    return ratio && ratio > 0 ? ratio : this.mediaAspectRatio
  }

  private imageBlockServesAsVideoCover(): boolean {
    return articleImageBlockServesAsVideoCover(this.contentBlocks, this.index)
  }

  private isYouTubeVideo(): boolean {
    return VideoResolverService.extractYouTubeVideoId(this.block.videoUrl).length > 0
  }

  private isDirectVideoFile(): boolean {
    return isDirectVideoUrl(this.block.videoUrl)
  }

  private resolveVideoPreviewImage(): string {
    return resolveArticleVideoPreviewImage(this.contentBlocks, this.block, this.index)
  }

  private openImageBlock(): void {
    if (!this.block.imageUrl) return
    void openImageViewer(this.block.imageUrl, '图片预览')
  }

  private onImageComplete(width: number, height: number): void {
    if (width > 0 && height > 0) {
      this.onMediaAspectRatioChange(this.index, width, height)
    }
  }

  private playVideo(): void {
    this.isPlaying = true
    this.onActionHintChange('')
    if (this.isDirectVideoFile()) {
      this.playableUrl = this.block.videoUrl
    } else if (this.isYouTubeVideo()) {
      this.isResolving = true
      this.onActionHintChange('正在解析视频地址...')
      void this.resolveYouTubeVideo()
    }
  }

  private stopVideo(): void {
    this.isPlaying = false
    this.playableUrl = ''
    this.fallbackUrl = ''
    this.isResolving = false
    this.isWebFallback = false
    try {
      this.nativeVideoController.stop()
    } catch (_) {}
  }

  private async resolveYouTubeVideo(): Promise<void> {
    const resolution = await VideoResolverService.resolveYouTubePlayback(this.block.videoUrl)
    if (!this.isPlaying) return

    this.isResolving = false
    if (resolution.playableUrl) {
      this.playableUrl = resolution.playableUrl
      this.onActionHintChange('已获取直链')
    } else if (resolution.fallbackUrl) {
      this.fallbackUrl = resolution.fallbackUrl
      this.isWebFallback = true
      this.onActionHintChange('使用 Web 播放')
    } else {
      this.onActionHintChange('未能解析应用内直链')
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
  private VideoPlayingContent() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolveVideoPreviewImage()) {
        Image(this.resolveVideoPreviewImage())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .opacity(0)
      }

      if (this.isDirectVideoFile()) {
        Video({
          src: this.playableUrl || this.block.videoUrl,
          controller: this.nativeVideoController,
          previewUri: this.resolveVideoPreviewImage(),
        })
          .width('100%')
          .height('100%')
          .borderRadius(18)
          .controls(true)
          .autoPlay(true)
          .objectFit(ImageFit.Contain)
          .onError(() => {
            this.onActionHintChange('应用内播放失败，请稍后重试')
          })
      } else if (this.isYouTubeVideo()) {
        if (this.playableUrl) {
          Video({
            src: this.playableUrl,
            controller: this.nativeVideoController,
            previewUri: this.resolveVideoPreviewImage(),
          })
            .width('100%')
            .height('100%')
            .borderRadius(18)
            .controls(false)
            .autoPlay(true)
            .objectFit(ImageFit.Contain)
            .onError(() => {
              this.onActionHintChange('应用内播放失败，请稍后重试')
            })
        } else if (this.isResolving) {
          Column({ space: 10 }) {
            LoadingProgress().width(28).height(28).color(this.theme.accent)
            Text('正在解析视频地址...').fontSize(13).fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
        } else if (this.isWebFallback && this.fallbackUrl) {
          Web({
            src: this.fallbackUrl,
            controller: this.videoWebController,
          })
            .width('100%')
            .aspectRatio(this.mediaAspectRatioForIndex())
            .borderRadius(18)
            .javaScriptAccess(true)
            .domStorageAccess(true)
            .mixedMode(MixedMode.All)
            .onControllerAttached(() => {
              try {
                webview.WebCookieManager.putAcceptCookieEnabled(true)
                webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true)
                this.videoWebController.setCustomUserAgent(this.webVideoUserAgent)
              } catch (_error) {}
            })
            .onPageEnd((_event: OnPageEndEvent) => {
              this.onActionHintChange('')
            })
        } else {
          Column({ space: 10 }) {
            Text('未能解析应用内直链').fontSize(14).fontWeight(FontWeight.Medium).fontColor(this.theme.textPrimary)
            Text('当前视频暂时无法解析直链，请稍后重试').fontSize(12).fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
        }
      } else {
        Web({
          src: this.block.videoUrl,
          controller: this.videoWebController,
        })
          .width('100%')
          .aspectRatio(this.mediaAspectRatioForIndex())
          .borderRadius(18)
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .onPageEnd((_event: OnPageEndEvent) => {
            this.onActionHintChange('')
          })
      }
    }
    .width('100%')
    .aspectRatio(this.mediaAspectRatioForIndex())
    .constraintSize({ maxHeight: 640 })
    .clip(true)
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
  }

  @Builder
  private VideoPreviewContent() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolveVideoPreviewImage()) {
        Image(this.resolveVideoPreviewImage())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
          .onComplete((event) => {
            if (event) {
              this.onImageComplete(event.width, event.height)
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
    .aspectRatio(this.mediaAspectRatioForIndex())
    .constraintSize({ maxHeight: 640 })
    .clip(true)
    .onClick(() => {
      this.playVideo()
    })
  }

  @Builder
  private ImageBlockContent() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.block.imageUrl)
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Contain)
        .borderRadius(18)
        .backgroundColor(this.theme.elevated)
        .onComplete((event) => {
          if (event) {
            this.onImageComplete(event.width, event.height)
          }
        })
    }
    .width('100%')
    .aspectRatio(this.mediaAspectRatioForIndex())
    .constraintSize({ maxHeight: 640 })
    .clip(true)
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
    .onClick(() => {
      this.openImageBlock()
    })
  }

  @Builder
  private TextBlockContent() {
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

  aboutToDisappear(): void {
    this.stopVideo()
  }

  build() {
    Column() {
      if (this.block.type === 'image' && this.block.imageUrl && !this.imageBlockServesAsVideoCover()) {
        this.ImageBlockContent()
      } else if (this.block.type === 'video' && this.block.videoUrl) {
        if (this.isPlaying) {
          this.VideoPlayingContent()
        } else {
          this.VideoPreviewContent()
        }
      } else if (this.block.text) {
        this.TextBlockContent()
      }
    }
    .width('100%')
  }
}
