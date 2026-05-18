import { curves } from '@kit.ArkUI'
import webview from '@ohos.web.webview'
import { AccountSessionService } from '../common/services/AccountSessionService'
import { PageHeader } from '../common/components/PageHeader'
import { SecondaryPageHeaderShell } from '../common/components/SecondaryPageHeaderShell'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { AccountProvider } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import {
  buildAccountLoginRenderExitMessage,
  resolveAccountLoginWebPolicy,
} from '../common/utils/account/AccountLoginWebPolicy'
import { detectBilibiliLogin } from '../common/utils/platform/BilibiliLoginDetection'
import { detectYouTubeLoginState } from '../common/utils/platform/YouTubeLoginDetection'
import { BilibiliPageState, BilibiliWebNavResponse } from '../common/utils/platform/BilibiliWebState'
import { YouTubePageState } from '../common/utils/platform/YouTubeWebState'
import { buildBilibiliCookieGroups, buildYouTubeCookieGroups } from '../common/utils/platform/CookieGroupBuilder'
import {
  buildBilibiliNavScript,
  buildBilibiliPageStateScript,
  buildYouTubePageStateScript,
  buildYouTubeProfileFetchScript,
} from '../common/utils/platform/WebScriptBuilder'
import { PollingController } from '../common/utils/PollingController'
import { normalizeYouTubeProfileSources, resolveYouTubeProfileName } from '../common/utils/platform/YouTubeProfileResolver'
import { writeAccountLinkResult } from '../common/utils/account/AccountLinkResultWriter'

@Entry
@Component
struct AccountLogin {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State pageTitle: string = '账号关联'
  @State loginUrl: string = ''
  @State provider: AccountProvider = 'youtube'
  @State loading: boolean = true
  @State loadError: string = ''
  @State handledSuccess: boolean = false
  @State handlingSuccess: boolean = false
  @State initialBilibiliSessData: string = ''
  @State initialBilibiliLinked: boolean = false

  private webController: webview.WebviewController = new webview.WebviewController()
  private bilibiliPolling: PollingController = new PollingController(1200)
  private youTubePolling: PollingController = new PollingController(1500)
  private readonly mobileUserAgent: string =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    const params = getStringParams()
    this.pageTitle = params.title || '账号关联'
    this.loginUrl = params.loginUrl || ''
    if (params.provider === 'youtube' || params.provider === 'x' || params.provider === 'instagram' || params.provider === 'bilibili') {
      this.provider = params.provider
    }
    if (this.provider === 'bilibili') {
      void this.loadInitialBilibiliSessData()
      this.bilibiliPolling.start(() => { this.provider === 'bilibili' && void this.persistBilibiliSessionIfAvailable(true) })
    }
    if (this.provider === 'youtube') {
      this.youTubePolling.start(() => { this.provider === 'youtube' && void this.persistYouTubeSessionIfAvailable(true) })
    }
  }

  aboutToDisappear(): void {
    this.bilibiliPolling.stop()
    this.youTubePolling.stop()
    void webview.WebCookieManager.saveCookieAsync()
    if (this.provider === 'bilibili' && !this.handledSuccess) {
      void this.persistBilibiliSessionIfAvailable(false)
    }
    if (this.provider === 'youtube' && !this.handledSuccess) {
      void this.persistYouTubeSessionIfAvailable(false)
    }
  }

  private async loadInitialBilibiliSessData(): Promise<void> {
    try {
      this.initialBilibiliSessData = await AccountSessionService.bilibiliSessData()
      const status = await AccountSessionService.status('bilibili')
      this.initialBilibiliLinked = status.linked && !status.error
    } catch (_error) {
      this.initialBilibiliSessData = ''
      this.initialBilibiliLinked = false
    }
  }

  private normalizeScriptResult(value: string): string {
    const trimmed = (value || '').trim()
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed.substring(1, trimmed.length - 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
    return trimmed
  }

  private async runScript<T>(script: string): Promise<T | null> {
    try {
      const result = await this.webController.runJavaScript(script)
      const normalized = this.normalizeScriptResult(result)
      return normalized ? JSON.parse(normalized) as T : null
    } catch (_error) {
      return null
    }
  }

  private fetchCookieSafe(url: string): string {
    try { return webview.WebCookieManager.fetchCookieSync(url) } catch (_error) { return '' }
  }

  private isYouTubeAuthFlowUrl(value: string): boolean {
    const normalized = (value || '').trim().toLowerCase()
    return !!normalized && (normalized.includes('accounts.google.com') || normalized.includes('accounts.youtube.com'))
  }

  private async currentBilibiliNavState(): Promise<BilibiliWebNavResponse | null> {
    return this.runScript<BilibiliWebNavResponse>(buildBilibiliNavScript())
  }

  private async currentBilibiliPageState(): Promise<BilibiliPageState | null> {
    return this.runScript<BilibiliPageState>(buildBilibiliPageStateScript())
  }

  private async currentDocumentCookies(): Promise<string> {
    const result = await this.runScript<string>('document.cookie')
    return result || ''
  }

  private async currentYouTubePageState(): Promise<YouTubePageState | null> {
    return this.runScript<YouTubePageState>(buildYouTubePageStateScript())
  }

  private async fetchYouTubeProfileSources(): Promise<string[]> {
    const result = await this.runScript<string[]>(buildYouTubeProfileFetchScript())
    return normalizeYouTubeProfileSources(result)
  }

  private async resolveYouTubeDisplayName(currentPageHtml: string): Promise<string> {
    const sources: string[] = currentPageHtml.trim() ? [currentPageHtml] : []
    const fetchedSources = await this.fetchYouTubeProfileSources()
    fetchedSources.forEach((html: string) => { html.trim() && sources.push(html) })
    return resolveYouTubeProfileName(sources)
  }

  private async persistBilibiliSessionIfAvailable(shouldAutoBack: boolean): Promise<void> {
    if (this.provider !== 'bilibili' || this.handledSuccess || this.handlingSuccess) { return }

    try {
      await webview.WebCookieManager.saveCookieAsync()
      const nav = await this.currentBilibiliNavState()
      const pageState = await this.currentBilibiliPageState()
      const currentUrl = this.webController.getUrl()
      const documentCookies = (pageState?.cookies || '').trim() || await this.currentDocumentCookies()
      const cookieGroups = buildBilibiliCookieGroups({ documentCookies, currentUrl, fetchCookie: this.fetchCookieSafe })
      const detection = detectBilibiliLogin({ nav, pageState, currentUrl, cookieGroups })
      const fallbackDisplayName = detection.displayName || 'Bilibili 已关联'

      if (!detection.loggedIn) { return }
      this.handlingSuccess = true
      const status = await AccountSessionService.setBilibiliVerifiedLink(fallbackDisplayName, detection.sessdata)
      if (!status.linked || !!status.error) { this.handlingSuccess = false; return }

      this.handledSuccess = true
      this.initialBilibiliSessData = detection.sessdata
      this.initialBilibiliLinked = true
      this.bilibiliPolling.stop()
      writeAccountLinkResult({ provider: 'bilibili', displayName: fallbackDisplayName, linked: true })
      shouldAutoBack && setTimeout(() => { void goBack() }, 120)
    } catch (error) {
      console.error(`AccountLogin bilibili persist exception: ${error instanceof Error ? error.message : `${error}`}`)
      this.handlingSuccess = false
    }
  }

  private tryHandleBilibiliLogin(): void {
    if (this.provider !== 'bilibili' || this.handledSuccess || this.handlingSuccess) { return }
    void this.persistBilibiliSessionIfAvailable(true)
  }

  private async persistYouTubeSessionIfAvailable(shouldAutoBack: boolean): Promise<void> {
    if (this.provider !== 'youtube' || this.handledSuccess || this.handlingSuccess) { return }

    try {
      const controllerUrl = (this.webController.getUrl() || '').trim()
      if (this.isYouTubeAuthFlowUrl(controllerUrl)) { return }

      await webview.WebCookieManager.saveCookieAsync()
      const pageState = await this.currentYouTubePageState()
      const currentUrl = (pageState?.currentUrl || this.webController.getUrl() || '').trim()
      if (this.isYouTubeAuthFlowUrl(currentUrl)) { return }

      const documentCookies = (pageState?.cookies || '').trim() || await this.currentDocumentCookies()
      const cookieGroups = buildYouTubeCookieGroups({ documentCookies, currentUrl, fetchCookie: this.fetchCookieSafe })
      const detection = detectYouTubeLoginState({ currentUrl, title: pageState?.title || '', documentCookies: cookieGroups.join('; '), pageHtml: pageState?.pageHtml || '' })
      if (!detection.loggedIn) { return }

      this.handlingSuccess = true
      this.youTubePolling.stop()
      const resolvedDisplayName = await this.resolveYouTubeDisplayName(pageState?.pageHtml || '')
      const fallbackDisplayName = resolvedDisplayName || detection.displayName || 'YouTube 已关联'
      const status = await AccountSessionService.setVerifiedLink('youtube', fallbackDisplayName)
      if (!status.linked || !!status.error) { this.handlingSuccess = false; return }

      this.handledSuccess = true
      writeAccountLinkResult({ provider: 'youtube', displayName: fallbackDisplayName, linked: true })
      shouldAutoBack && setTimeout(() => { void goBack() }, 120)
    } catch (error) {
      console.error(`AccountLogin youtube persist exception: ${error instanceof Error ? error.message : `${error}`}`)
      this.handlingSuccess = false
      this.provider === 'youtube' && !this.handledSuccess && this.youTubePolling.start(() => { this.provider === 'youtube' && void this.persistYouTubeSessionIfAvailable(true) })
    }
  }

  private tryHandleYouTubeLogin(): void {
    if (this.provider !== 'youtube' || this.handledSuccess || this.handlingSuccess) { return }
    void this.persistYouTubeSessionIfAvailable(true)
  }

  build() {
    Column({ space: 0 }) {
      SecondaryPageHeaderShell() {
        PageHeader({ title: this.pageTitle, theme: this.theme, showBackButton: true, titleSize: 20, topPadding: 0, bottomPadding: 0, onBack: () => { void goBack() } }).width('100%')
      }
      if (this.loginUrl) {
        Stack({ alignContent: Alignment.Center }) {
          Web({ src: this.loginUrl, controller: this.webController })
            .width('100%').height('100%').javaScriptAccess(true).domStorageAccess(true).mixedMode(MixedMode.All).allowWindowOpenMethod(resolveAccountLoginWebPolicy(this.provider).allowWindowOpenMethod)
            .onControllerAttached(() => {
              try { webview.WebCookieManager.putAcceptCookieEnabled(true); webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true); this.webController.setCustomUserAgent(this.mobileUserAgent) } catch (_error) {}
            })
            .onPageBegin(() => { this.loading = true; this.loadError = '' })
            .onPageEnd(() => {
              this.loading = false
              this.provider === 'bilibili' && this.tryHandleBilibiliLogin()
              this.provider === 'youtube' && this.tryHandleYouTubeLogin()
            })
            .onErrorReceive((event: OnErrorReceiveEvent) => {
              if (event.request?.isMainFrame()) { this.loading = false; this.loadError = '登录页加载失败，请稍后重试' }
            })
            .onRenderExited((event: OnRenderExitedEvent) => { this.loading = false; this.loadError = buildAccountLoginRenderExitMessage(this.provider, event?.renderExitReason ?? -1) })

          if (this.loading && !this.loadError) {
            Column({ space: 10 }) {
              LoadingProgress().width(26).height(26).color(this.theme.accent)
              Text('正在打开登录页...').fontSize(13).fontColor(this.theme.textSecondary)
            }.padding({ left: 18, right: 18, top: 14, bottom: 14 }).backgroundColor('rgba(255,255,255,0.88)').borderRadius(18)
          }
          if (this.loadError) {
            Column({ space: 8 }) {
              Text('打开失败').fontSize(16).fontWeight(FontWeight.Bold).fontColor(this.theme.textPrimary)
              Text(this.loadError).fontSize(13).lineHeight(20).fontColor(this.theme.textSecondary).textAlign(TextAlign.Center)
            }.padding({ left: 18, right: 18, top: 16, bottom: 16 }).backgroundColor(this.theme.surface).borderRadius(18).margin({ left: 24, right: 24 })
          }
        }.width('100%').layoutWeight(1)
      } else {
        Column({ space: 10 }) {
          Text('未找到登录地址').fontSize(18).fontWeight(FontWeight.Bold).fontColor(this.theme.textPrimary)
          Text('请返回上一页后重试。').fontSize(13).fontColor(this.theme.textSecondary)
        }.width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
      }
    }.width('100%').height('100%').backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: curves.springMotion(0.82, 0.94) }).opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut }).opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut }).opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut }).opacity(0)
  }
}