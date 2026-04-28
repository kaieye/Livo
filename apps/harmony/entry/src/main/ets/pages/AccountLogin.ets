import { curves } from '@kit.ArkUI'
import webview from '@ohos.web.webview'
import { AppRepository } from '../common/data/AppRepository'
import { PageHeader } from '../common/components/PageHeader'
import { SecondaryPageHeaderShell } from '../common/components/SecondaryPageHeaderShell'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { AccountProvider } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import {
  buildAccountLoginRenderExitMessage,
  resolveAccountLoginWebPolicy,
} from '../common/utils/AccountLoginWebPolicy'
import { detectBilibiliLogin } from '../common/utils/BilibiliLoginDetection'
import { detectYouTubeLoginState } from '../common/utils/YouTubeLoginDetection'
import { normalizeYouTubeProfileSources, resolveYouTubeProfileName } from '../common/utils/YouTubeProfileResolver'

const SETTINGS_ACTIVE_SHEET_KEY: string = 'settingsActiveSheetKey'

interface BilibiliWebNavResponse {
  code?: number
  message?: string
  data?: BilibiliWebNavData
}

interface BilibiliWebNavData {
  isLogin?: boolean
  uname?: string
}

interface BilibiliPageState {
  currentUrl: string
  title: string
  displayName: string
  loggedIn: boolean
  cookies: string
}

interface YouTubePageState {
  currentUrl: string
  title: string
  cookies: string
  pageHtml: string
}

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
  private bilibiliCookiePollId: number = -1
  private youTubeCookiePollId: number = -1
  private readonly mobileUserAgent: string =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
  private readonly bilibiliCookieProbeUrls: string[] = [
    'https://www.bilibili.com/',
    'https://passport.bilibili.com/',
    'https://m.bilibili.com/',
    'https://account.bilibili.com/',
  ]
  private readonly youTubeCookieProbeUrls: string[] = [
    'https://m.youtube.com/',
    'https://www.youtube.com/',
    'https://studio.youtube.com/',
    'https://myaccount.google.com/',
    'https://accounts.google.com/',
  ]
  aboutToAppear(): void {
    this.theme = ThemeService.currentPalette()
    const params = getStringParams()
    this.pageTitle = params.title || '账号关联'
    this.loginUrl = params.loginUrl || ''
    const provider = params.provider
    if (provider === 'youtube' || provider === 'x' || provider === 'instagram' || provider === 'bilibili') {
      this.provider = provider
    }

    if (this.provider === 'bilibili') {
      void this.loadInitialBilibiliSessData()
      this.startBilibiliCookiePolling()
    }

    if (this.provider === 'youtube') {
      this.startYouTubeCookiePolling()
    }
  }

  aboutToDisappear(): void {
    this.stopBilibiliCookiePolling()
    this.stopYouTubeCookiePolling()
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
      this.initialBilibiliSessData = await AppRepository.bilibiliSessData()
      const status = await AppRepository.accountStatus('bilibili')
      this.initialBilibiliLinked = status.linked && !status.error
      console.info(
        `AccountLogin initial bilibili linked=${status.linked} displayName=${status.displayName} error=${status.error} hasSessdata=${this.initialBilibiliSessData ? 'true' : 'false'}`,
      )
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

  private fetchCookieSafe(url: string): string {
    try {
      return webview.WebCookieManager.fetchCookieSync(url)
    } catch (_error) {
      return ''
    }
  }

  private async currentBilibiliNavState(): Promise<BilibiliWebNavResponse | null> {
    try {
      const script = `
        (async () => {
          try {
            const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json, text/plain, */*'
              }
            });
            return await response.text();
          } catch (error) {
            return JSON.stringify({ __livo_error: String(error) });
          }
        })()
      `
      const result = await this.webController.runJavaScript(script)
      const normalized = this.normalizeScriptResult(result)
      if (!normalized) {
        return null
      }
      return JSON.parse(normalized) as BilibiliWebNavResponse
    } catch (_error) {
      return null
    }
  }

  private async currentBilibiliPageState(): Promise<BilibiliPageState | null> {
    try {
      const script = `
        (() => {
          try {
            const html = document.documentElement?.innerHTML || '';
            const initialState = globalThis.__INITIAL_STATE__ || globalThis.__INITIAL_DATA__ || {};
            const stateText = JSON.stringify(initialState || {});
            const find = (patterns) => {
              for (const pattern of patterns) {
                const matched = html.match(pattern) || stateText.match(pattern);
                if (matched && matched[1]) {
                  return String(matched[1]).trim();
                }
              }
              return '';
            };
            const displayName =
              find([
                /"uname":"([^"]+)"/,
                /"username":"([^"]+)"/,
                /"nickName":"([^"]+)"/
              ]) ||
              String(document.querySelector('[class*="name"],[class*="uname"],[data-user-name]')?.textContent || '').trim();
            const loggedIn =
              /"isLogin"\\s*:\\s*true/.test(html) ||
              /"isLogin"\\s*:\\s*true/.test(stateText) ||
              !!displayName;
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              displayName,
              loggedIn,
              cookies: document.cookie || ''
            });
          } catch (error) {
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              displayName: '',
              loggedIn: false,
              cookies: ''
            });
          }
        })()
      `
      const result = await this.webController.runJavaScript(script)
      const normalized = this.normalizeScriptResult(result)
      if (!normalized) {
        return null
      }
      return JSON.parse(normalized) as BilibiliPageState
    } catch (_error) {
      return null
    }
  }

  private async currentDocumentCookies(): Promise<string> {
    try {
      const result = await this.webController.runJavaScript('document.cookie')
      return this.normalizeScriptResult(result)
    } catch (_error) {
      return ''
    }
  }

  private bilibiliCookieGroups(currentUrl: string, documentCookies: string): string[] {
    const cookieGroups: string[] = []
    if (documentCookies.trim()) {
      cookieGroups.push(documentCookies)
    }
    if (currentUrl.trim()) {
      cookieGroups.push(this.fetchCookieSafe(currentUrl))
    }
    this.bilibiliCookieProbeUrls.forEach((url: string) => {
      cookieGroups.push(this.fetchCookieSafe(url))
    })
    return cookieGroups
  }

  private youTubeCookieGroups(currentUrl: string, documentCookies: string): string[] {
    const cookieGroups: string[] = []
    if (documentCookies.trim()) {
      cookieGroups.push(documentCookies)
    }
    if (currentUrl.trim()) {
      cookieGroups.push(this.fetchCookieSafe(currentUrl))
    }
    this.youTubeCookieProbeUrls.forEach((url: string) => {
      cookieGroups.push(this.fetchCookieSafe(url))
    })
    return cookieGroups
  }

  private startBilibiliCookiePolling(): void {
    this.stopBilibiliCookiePolling()
    this.bilibiliCookiePollId = setInterval(() => {
      if (this.provider === 'bilibili') {
        void this.persistBilibiliSessionIfAvailable(true)
      }
    }, 1200)
  }

  private stopBilibiliCookiePolling(): void {
    if (this.bilibiliCookiePollId >= 0) {
      clearInterval(this.bilibiliCookiePollId)
      this.bilibiliCookiePollId = -1
    }
  }

  private startYouTubeCookiePolling(): void {
    this.stopYouTubeCookiePolling()
    this.youTubeCookiePollId = setInterval(() => {
      if (this.provider === 'youtube') {
        void this.persistYouTubeSessionIfAvailable(true)
      }
    }, 1500)
  }

  private stopYouTubeCookiePolling(): void {
    if (this.youTubeCookiePollId >= 0) {
      clearInterval(this.youTubeCookiePollId)
      this.youTubeCookiePollId = -1
    }
  }

  private async fetchYouTubeProfileSources(): Promise<string[]> {
    try {
      const script = `
        (async () => {
          const urls = [
            'https://www.youtube.com/account',
            'https://www.youtube.com/',
            'https://myaccount.google.com/',
            'https://myaccount.google.com/personal-info'
          ];
          const outputs = [];
          for (const target of urls) {
            try {
              const response = await fetch(target, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
              });
              outputs.push(response.ok ? await response.text() : '');
            } catch (error) {
              outputs.push('');
            }
          }
          return JSON.stringify(outputs);
        })()
      `
      const result = await this.webController.runJavaScript(script)
      const normalized = this.normalizeScriptResult(result)
      if (!normalized) {
        return []
      }
      return normalizeYouTubeProfileSources(JSON.parse(normalized) as Object | string[] | null | undefined)
    } catch (_error) {
      return []
    }
  }

  private async resolveYouTubeDisplayName(currentPageHtml: string): Promise<string> {
    const sources: string[] = []
    if (currentPageHtml.trim()) {
      sources.push(currentPageHtml)
    }
    const fetchedSources = normalizeYouTubeProfileSources(await this.fetchYouTubeProfileSources())
    fetchedSources.forEach((html: string) => {
      if (html.trim()) {
        sources.push(html)
      }
    })
    return resolveYouTubeProfileName(sources)
  }

  private async persistBilibiliSessionIfAvailable(shouldAutoBack: boolean): Promise<void> {
    if (this.provider !== 'bilibili' || this.handledSuccess || this.handlingSuccess) {
      return
    }

    try {
      await webview.WebCookieManager.saveCookieAsync()
      const nav = await this.currentBilibiliNavState()
      const pageState = await this.currentBilibiliPageState()
      const currentUrl = this.webController.getUrl()
      const documentCookies = (pageState?.cookies || '').trim() || await this.currentDocumentCookies()
      const detection = detectBilibiliLogin({
        nav,
        pageState,
        currentUrl,
        cookieGroups: this.bilibiliCookieGroups(currentUrl, documentCookies),
      })
      const fallbackDisplayName = detection.displayName || 'Bilibili 已关联'
      console.info(
        `AccountLogin bilibili detect currentUrl=${detection.effectiveUrl} navLoggedIn=${detection.navLoggedIn} pageLoggedIn=${detection.pageLoggedIn} hasSessionCookie=${detection.hasSessionCookie} displayName=${fallbackDisplayName} hasSessdata=${detection.sessdata ? 'true' : 'false'}`,
      )
      if (!detection.loggedIn) {
        return
      }

      this.handlingSuccess = true
      const status = await AppRepository.setBilibiliVerifiedLink(fallbackDisplayName, detection.sessdata)
      console.info(
        `AccountLogin bilibili persist linked=${status.linked} displayName=${status.displayName} error=${status.error}`,
      )
      if (!status.linked || !!status.error) {
        console.error(
          `AccountLogin bilibili persist rejected linked=${status.linked} displayName=${status.displayName} error=${status.error}`,
        )
        this.handlingSuccess = false
        return
      }

      this.handledSuccess = true
      this.initialBilibiliSessData = detection.sessdata
      this.initialBilibiliLinked = true
      this.stopBilibiliCookiePolling()
      AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, 'accounts')
      AppStorage.setOrCreate('settingsOverlayLevel', 1)
      AppStorage.setOrCreate('accountLinkResultProvider', 'bilibili')
      AppStorage.setOrCreate('accountLinkResultDisplayName', fallbackDisplayName)
      AppStorage.setOrCreate('accountLinkResultLinked', true)
      AppStorage.setOrCreate('accountLinkResultAt', Date.now())
      AppStorage.setOrCreate('accountsStatusRefreshAt', Date.now())
      if (shouldAutoBack) {
        setTimeout(() => {
          void goBack()
        }, 120)
      }
    } catch (error) {
      console.error(
        `AccountLogin bilibili persist exception: ${error instanceof Error ? error.message : `${error}`}`,
      )
      this.handlingSuccess = false
    }
  }

  private async tryHandleBilibiliLogin(): Promise<void> {
    if (this.provider !== 'bilibili' || this.handledSuccess || this.handlingSuccess) {
      return
    }

    try {
      await this.persistBilibiliSessionIfAvailable(true)
    } catch (_error) {
    }
  }

  private async currentYouTubePageState(): Promise<YouTubePageState | null> {
    try {
      const script = `
        (() => {
          const read = (value) => typeof value === 'string' ? value.trim() : '';
          try {
            const html = document.documentElement?.innerHTML || '';
            const byPattern = (patterns) => {
              for (const pattern of patterns) {
                const matched = html.match(pattern);
                if (matched && matched[1]) {
                  return String(matched[1]).trim();
                }
              }
              return '';
            };
            const channelHandle =
              read(document.querySelector('a[href^="/@"]')?.textContent) ||
              byPattern([
                /"channelHandle":"(@[^"]+)"/,
                /\\"channelHandle\\":"(@[^\\"]+)\\"/
              ]);
            const accountName =
              read(document.querySelector('yt-formatted-string#account-name')?.textContent) ||
              read(document.querySelector('button#avatar-btn')?.getAttribute('aria-label')).replace(/^Google Account[:\\s]*/i, '') ||
              read(document.querySelector('img#img')?.getAttribute('alt')).replace(/^Google Account[:\\s]*/i, '') ||
              byPattern([
                /"accountName":"([^"]+)"/,
                /\\"accountName\\":"([^\\"]+)\\"/
              ]);
            const channelName = byPattern([
              /"channelName":"([^"]+)"/,
              /\\"channelName\\":"([^\\"]+)\\"/
            ]);
            const displayName = byPattern([
              /"displayName":"([^"]+)"/,
              /\\"displayName\\":"([^\\"]+)\\"/,
              /"fullName":"([^"]+)"/,
              /\\"fullName\\":"([^\\"]+)\\"/,
              /"givenName":"([^"]+)"/,
              /\\"givenName\\":"([^\\"]+)\\"/
            ]);
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              cookies: document.cookie || '',
              pageHtml: JSON.stringify({
                channelHandle,
                accountName,
                channelName,
                displayName
              })
            });
          } catch (error) {
            return JSON.stringify({
              currentUrl: location.href || '',
              title: document.title || '',
              cookies: document.cookie || '',
              pageHtml: ''
            });
          }
        })()
      `
      const result = await this.webController.runJavaScript(script)
      const normalized = this.normalizeScriptResult(result)
      if (!normalized) {
        return null
      }
      return JSON.parse(normalized) as YouTubePageState
    } catch (_error) {
      return null
    }
  }

  private async persistYouTubeSessionIfAvailable(shouldAutoBack: boolean): Promise<void> {
    if (this.provider !== 'youtube' || this.handledSuccess || this.handlingSuccess) {
      return
    }

    try {
      const controllerUrl = (this.webController.getUrl() || '').trim()
      if (this.isYouTubeAuthFlowUrl(controllerUrl)) {
        return
      }

      await webview.WebCookieManager.saveCookieAsync()
      const pageState = await this.currentYouTubePageState()
      const currentUrl = (pageState?.currentUrl || this.webController.getUrl() || '').trim()
      if (this.isYouTubeAuthFlowUrl(currentUrl)) {
        return
      }
      const documentCookies = (pageState?.cookies || '').trim() || await this.currentDocumentCookies()
      const detection = detectYouTubeLoginState({
        currentUrl,
        title: pageState?.title || '',
        documentCookies: this.youTubeCookieGroups(currentUrl, documentCookies).join('; '),
        pageHtml: pageState?.pageHtml || '',
      })
      if (!detection.loggedIn) {
        return
      }

      this.handlingSuccess = true
      this.stopYouTubeCookiePolling()
      const resolvedDisplayName = await this.resolveYouTubeDisplayName(pageState?.pageHtml || '')
      const fallbackDisplayName = resolvedDisplayName || detection.displayName || 'YouTube 已关联'
      console.info(
        `AccountLogin youtube detect currentUrl=${currentUrl} loggedIn=${detection.loggedIn} inLoginFlow=${detection.inLoginFlow} hasSessionCookie=${detection.hasSessionCookie} detectedDisplayName=${detection.displayName || ''} resolvedDisplayName=${resolvedDisplayName || ''} fallbackDisplayName=${fallbackDisplayName}`,
      )
      const status = await AppRepository.setVerifiedAccountLink('youtube', fallbackDisplayName)
      console.info(
        `AccountLogin youtube persist linked=${status.linked} displayName=${status.displayName} error=${status.error}`,
      )
      if (!status.linked || !!status.error) {
        console.error(
          `AccountLogin youtube persist rejected linked=${status.linked} displayName=${status.displayName} error=${status.error}`,
        )
        this.handlingSuccess = false
        return
      }

      this.handledSuccess = true
      AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, 'accounts')
      AppStorage.setOrCreate('settingsOverlayLevel', 1)
      AppStorage.setOrCreate('accountLinkResultProvider', 'youtube')
      AppStorage.setOrCreate('accountLinkResultDisplayName', fallbackDisplayName)
      AppStorage.setOrCreate('accountLinkResultLinked', true)
      AppStorage.setOrCreate('accountLinkResultAt', Date.now())
      AppStorage.setOrCreate('accountsStatusRefreshAt', Date.now())
      if (shouldAutoBack) {
        setTimeout(() => {
          void goBack()
        }, 120)
      }
    } catch (error) {
      console.error(
        `AccountLogin youtube persist exception: ${error instanceof Error ? error.message : `${error}`}`,
      )
      this.handlingSuccess = false
      if (this.provider === 'youtube' && !this.handledSuccess) {
        this.startYouTubeCookiePolling()
      }
    }
  }

  private isYouTubeAuthFlowUrl(value: string): boolean {
    const normalized = (value || '').trim().toLowerCase()
    if (!normalized) {
      return false
    }
    return normalized.includes('accounts.google.com') || normalized.includes('accounts.youtube.com')
  }

  private async tryHandleYouTubeLogin(): Promise<void> {
    if (this.provider !== 'youtube' || this.handledSuccess || this.handlingSuccess) {
      return
    }

    try {
      await this.persistYouTubeSessionIfAvailable(true)
    } catch (_error) {
    }
  }

  private allowWindowOpenMethod(): boolean {
    return resolveAccountLoginWebPolicy(this.provider).allowWindowOpenMethod
  }

  build() {
    Column({ space: 0 }) {
      SecondaryPageHeaderShell() {
        PageHeader({
          title: this.pageTitle,
          theme: this.theme,
          showBackButton: true,
          titleSize: 20,
          topPadding: 0,
          bottomPadding: 0,
          onBack: () => { void goBack() },
        })
          .width('100%')
      }

      if (this.loginUrl) {
        Stack({ alignContent: Alignment.Center }) {
          Web({
            src: this.loginUrl,
            controller: this.webController,
          })
            .width('100%')
            .height('100%')
            .javaScriptAccess(true)
            .domStorageAccess(true)
            .mixedMode(MixedMode.All)
            .allowWindowOpenMethod(this.allowWindowOpenMethod())
            .onControllerAttached(() => {
              try {
                webview.WebCookieManager.putAcceptCookieEnabled(true)
                webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true)
                this.webController.setCustomUserAgent(this.mobileUserAgent)
              } catch (_error) {
              }
            })
            .onPageBegin((_event: OnPageBeginEvent) => {
              this.loading = true
              this.loadError = ''
            })
            .onPageEnd((_event: OnPageEndEvent) => {
              this.loading = false
              if (this.provider === 'bilibili') {
                void this.tryHandleBilibiliLogin()
              }
              if (this.provider === 'youtube') {
                void this.tryHandleYouTubeLogin()
              }
            })
            .onErrorReceive((event: OnErrorReceiveEvent) => {
              if (event.request?.isMainFrame()) {
                this.loading = false
                this.loadError = '登录页加载失败，请稍后重试'
              }
            })
            .onRenderExited((event: OnRenderExitedEvent) => {
              this.loading = false
              this.loadError = buildAccountLoginRenderExitMessage(this.provider, event?.renderExitReason ?? -1)
              console.error(
                `AccountLogin render exited provider=${this.provider} reason=${event?.renderExitReason ?? -1}`,
              )
            })

          if (this.loading && !this.loadError) {
            Column({ space: 10 }) {
              LoadingProgress()
                .width(26)
                .height(26)
                .color(this.theme.accent)

              Text('正在打开登录页...')
                .fontSize(13)
                .fontColor(this.theme.textSecondary)
            }
            .padding({ left: 18, right: 18, top: 14, bottom: 14 })
            .backgroundColor('rgba(255,255,255,0.88)')
            .borderRadius(18)
          }

          if (this.loadError) {
            Column({ space: 8 }) {
              Text('打开失败')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.theme.textPrimary)

              Text(this.loadError)
                .fontSize(13)
                .lineHeight(20)
                .fontColor(this.theme.textSecondary)
                .textAlign(TextAlign.Center)
            }
            .padding({ left: 18, right: 18, top: 16, bottom: 16 })
            .backgroundColor(this.theme.surface)
            .borderRadius(18)
            .margin({ left: 24, right: 24 })
          }
        }
        .width('100%')
        .layoutWeight(1)
      } else {
        Column({ space: 10 }) {
          Text('未找到登录地址')
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text('请返回上一页后重试。')
            .fontSize(13)
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
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: curves.springMotion(0.82, 0.94) })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
