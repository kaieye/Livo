import window from '@ohos.window'
import webview from '@ohos.web.webview'
import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { VideoResolverService } from '../common/services/VideoResolverService'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { resolveVideoPlayerLaunchState, VideoPlayerLaunchMode } from '../common/utils/VideoPlayerLaunchState'

@Entry
@Component
struct VideoPlayer {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @State title: string = '视频播放'
  @State videoUrl: string = ''
  @State previewUrl: string = ''
  @State playableUrl: string = ''
  @State fallbackUrl: string = ''
  @State mode: VideoPlayerLaunchMode = 'error'
  @State actionHint: string = ''
  @State theme: ThemePalette = ThemeService.currentPalette()

  private previousOrientation?: window.Orientation = undefined
  private nativeVideoController: VideoController = new VideoController()
  private webController: webview.WebviewController = new webview.WebviewController()
  private readonly webVideoUserAgent: string =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

  aboutToAppear(): void {
    const params = getStringParams()
    this.title = params.title || '视频播放'
    this.videoUrl = params.videoUrl || ''
    this.previewUrl = params.previewUrl || ''
    void this.loadTheme()
    this.initializePlayer()
    void this.applyPlayerOrientation()
  }

  aboutToDisappear(): void {
    void this.restoreOrientation()
  }

  private async loadTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  private initializePlayer(): void {
    if (!this.videoUrl) {
      this.mode = 'error'
      this.actionHint = '视频地址无效'
      return
    }

    const state = resolveVideoPlayerLaunchState(
      this.videoUrl,
      VideoResolverService.buildWebFallbackUrl(this.videoUrl),
    )
    this.mode = state.mode
    this.playableUrl = state.playableUrl
    this.fallbackUrl = state.fallbackUrl
    this.actionHint = state.actionHint
  }

  private async applyPlayerOrientation(): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }

    try {
      this.previousOrientation = mainWindow.getPreferredOrientation()
      await mainWindow.setPreferredOrientation(window.Orientation.AUTO_ROTATION_UNSPECIFIED)
    } catch (error) {
      console.error(`Failed to enable landscape video orientation: ${error}`)
    }
  }

  private async restoreOrientation(): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }

    try {
      await mainWindow.setPreferredOrientation(
        this.previousOrientation ?? window.Orientation.AUTO_ROTATION_PORTRAIT,
      )
    } catch (error) {
      console.error(`Failed to restore app orientation: ${error}`)
    }
  }

  @Builder
  private PlayerBody() {
    if (this.mode === 'direct' && this.playableUrl) {
      Video({
        src: this.playableUrl,
        controller: this.nativeVideoController,
        previewUri: this.previewUrl,
      })
        .width('100%')
        .height('100%')
        .controls(true)
        .autoPlay(true)
        .objectFit(ImageFit.Contain)
        .onError(() => {
          this.actionHint = '应用内播放失败，请稍后重试'
        })
    } else if (this.mode === 'web' && this.fallbackUrl) {
      Web({
        src: this.fallbackUrl,
        controller: this.webController,
      })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .mixedMode(MixedMode.All)
        .onControllerAttached(() => {
          try {
            webview.WebCookieManager.putAcceptCookieEnabled(true)
            webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true)
            this.webController.setCustomUserAgent(this.webVideoUserAgent)
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
        Text('当前视频暂时无法在应用内播放')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFFFFF')

        Text(this.actionHint || '请稍后重试')
          .fontSize(13)
          .fontColor('rgba(255,255,255,0.72)')
          .textAlign(TextAlign.Center)
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .padding(24)
      .backgroundColor('#000000')
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.PlayerBody()

      if (this.actionHint) {
        Column() {
          Text(this.actionHint)
            .fontSize(12)
            .fontColor('#FFFFFF')
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .backgroundColor('rgba(0,0,0,0.56)')
            .borderRadius(999)
        }
        .width('100%')
        .padding({ left: 16, right: 16, bottom: Math.max(24, this.bottomAvoidArea + 8) })
        .alignItems(HorizontalAlign.Center)
        .justifyContent(FlexAlign.End)
        .align(Alignment.Bottom)
      }

      Row() {
        SymbolGlyph($r('sys.symbol.chevron_backward'))
          .fontSize(20)
          .fontColor(['#FFFFFF'])
      }
      .width(42)
      .height(42)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('rgba(0,0,0,0.48)')
      .borderRadius(999)
      .margin({ left: 16, top: 16 })
      .onClick(() => {
        void goBack()
      })
    }
    .width('100%')
    .height('100%')
    .padding({
      top: this.topAvoidArea,
      bottom: this.bottomAvoidArea,
    })
    .backgroundColor('#000000')
  }
}
