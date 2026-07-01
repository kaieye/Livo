import { BrowserWindow, nativeTheme, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { DeepLinkAction } from '../shared/deep-link'
import { classifyExternalUrl } from '../shared/url-policy'
import type { AppCommandPayload } from '../shared/types'
import { getAppIconPath } from './app-icon'
import { logError, logInfo, logWarn } from './services/system/logger'
import {
  hasSavedWindowState,
  persistWindowState,
  readWindowState,
} from './services/system/window-state'

const MAIN_WINDOW_READY_TIMEOUT_MS = 10000

interface WindowManagerOptions {
  isDev: boolean
  preloadPath: string
  getCacheImagePath: (fileName: string) => string
  shouldMinimizeToTray?: () => boolean
  shouldStartInTray?: () => boolean
  onVisibilityChanged?: () => void
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private pendingDeepLinks: DeepLinkAction[] = []
  private rendererReady = false
  private rendererAppReadyToShow = false
  private mainWindowReadyToShow = false
  private revealMainWindowRequested = false
  private focusMainWindowWhenShown = false
  private readyToShowTimeout: ReturnType<typeof setTimeout> | null = null
  private mainWindowReadyTimedOut = false
  private isQuitting = false

  constructor(private readonly options: WindowManagerOptions) {}

  enqueueDeepLink(action: DeepLinkAction): void {
    this.pendingDeepLinks.push(action)
    this.requestMainWindowReveal({ focus: true })
    this.flushPendingDeepLinks()
  }

  markRendererReady(): void {
    this.rendererReady = true
    this.flushPendingDeepLinks()
  }

  readyToShowMainWindow(): void {
    this.rendererAppReadyToShow = true
    this.flushPendingDeepLinks()
    this.revealMainWindowIfReady()
  }

  safeOpenExternal(url: string): void {
    try {
      const policy = classifyExternalUrl(url)
      if (policy.blocked) {
        logWarn('[external] blocked url', {
          url,
          reason: policy.blockedReason,
        })
        return
      }
      if (policy.suspicious) {
        logWarn('[external] opening suspicious url', {
          url: policy.url,
          hostname: policy.hostname,
        })
      }
      void shell.openExternal(policy.url).catch((error) => {
        logWarn('[external] failed to open url', policy.url, error)
      })
    } catch (error) {
      logWarn('[external] invalid external url', url, error)
    }
  }

  focusMainWindow(): void {
    if (!this.mainWindow) return
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }
    this.requestMainWindowReveal({ focus: true })
  }

  hideMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.hide()
  }

  minimizeWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.minimize()
  }

  toggleMaximizeWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize()
    } else {
      this.mainWindow.maximize()
    }
  }

  closeWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.close()
  }

  isWindowMaximized(): boolean {
    return (
      !!this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      this.mainWindow.isMaximized()
    )
  }

  isMainWindowVisible(): boolean {
    return (
      !!this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      this.mainWindow.isVisible()
    )
  }

  prepareForQuit(): void {
    this.isQuitting = true
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  hasMainWindow(): boolean {
    return !!this.mainWindow && !this.mainWindow.isDestroyed()
  }

  sendAppCommand(payload: AppCommandPayload): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.webContents.send('app:command', payload)
    if (!this.mainWindow.isVisible()) {
      this.focusMainWindow()
    }
  }

  createMainWindow(): BrowserWindow {
    const windowState = readWindowState()
    const mainWindow = new BrowserWindow({
      x: windowState.x,
      y: windowState.y,
      width: windowState.width,
      height: windowState.height,
      minWidth: 900,
      minHeight: 600,
      show: false,
      ...(process.platform === 'darwin'
        ? {
            titleBarStyle: 'hiddenInset' as const,
            trafficLightPosition: { x: 16, y: 16 },
          }
        : process.platform === 'win32'
          ? { titleBarStyle: 'hidden' as const }
          : {}),
      autoHideMenuBar: true,
      icon: getAppIconPath(),
      webPreferences: {
        preload: this.options.preloadPath,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: true,
      },
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1C1C1E' : '#FFFFFF',
    })

    this.mainWindow = mainWindow
    this.rendererReady = false
    this.rendererAppReadyToShow = false
    this.mainWindowReadyToShow = false
    this.revealMainWindowRequested = false
    this.focusMainWindowWhenShown = false
    this.mainWindowReadyTimedOut = false
    this.clearReadyToShowTimeout()
    this.bindWindowEvents(mainWindow)
    if (windowState.isMaximized) {
      mainWindow.maximize()
    } else if (!hasSavedWindowState()) {
      mainWindow.center()
    }

    if (this.options.isDev && !process.env['LIVO_E2E']) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }

    if (this.options.isDev && process.env['ELECTRON_RENDERER_URL']) {
      void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
    this.installReadyToShowTimeout(mainWindow)

    return mainWindow
  }

  resolveCacheFile(fileName: string): string | null {
    if (
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\')
    ) {
      return null
    }
    const filePath = this.options.getCacheImagePath(fileName)
    return existsSync(filePath) ? filePath : null
  }

  private bindWindowEvents(mainWindow: BrowserWindow): void {
    const persistCurrentWindowState = (): void => {
      if (mainWindow.isDestroyed() || mainWindow.isMinimized()) return
      const bounds = mainWindow.getNormalBounds()
      persistWindowState({
        ...bounds,
        isMaximized: mainWindow.isMaximized(),
      })
    }

    mainWindow.on('ready-to-show', () => {
      this.mainWindowReadyToShow = true
      this.revealMainWindowIfReady({
        ignoreRendererReady: true,
      })
      this.flushPendingDeepLinks()
    })

    mainWindow.on('minimize', () => {
      if (!this.options.shouldMinimizeToTray?.()) return
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.hide()
        }
      }, 0)
    })

    mainWindow.on('maximize', () => {
      if (mainWindow.isDestroyed()) return
      persistCurrentWindowState()
      mainWindow.webContents.send('window:maximize-changed', true)
    })

    mainWindow.on('unmaximize', () => {
      if (mainWindow.isDestroyed()) return
      persistCurrentWindowState()
      mainWindow.webContents.send('window:maximize-changed', false)
    })

    mainWindow.on('resized', persistCurrentWindowState)
    mainWindow.on('moved', persistCurrentWindowState)

    mainWindow.on('close', (event) => {
      if (this.isQuitting || !this.options.shouldMinimizeToTray?.()) return
      event.preventDefault()
      mainWindow.hide()
    })

    mainWindow.on('closed', () => {
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null
      }
      this.clearReadyToShowTimeout()
      this.options.onVisibilityChanged?.()
    })

    mainWindow.on('show', () => {
      this.options.onVisibilityChanged?.()
    })

    mainWindow.on('hide', () => {
      this.options.onVisibilityChanged?.()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      const referrerUrl = details.referrer?.url || ''
      const fromBilibiliPlayer = /player\.bilibili\.com/i.test(referrerUrl)
      if (fromBilibiliPlayer && /bilibili\.com/i.test(details.url)) {
        return { action: 'deny' }
      }
      this.safeOpenExternal(details.url)
      return { action: 'deny' }
    })

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      // 主窗口只允许停留在应用入口；正文或脚本触发的外部跳转统一走系统浏览器。
      if (this.isAllowedAppNavigationUrl(navigationUrl)) return
      event.preventDefault()
      logWarn('[window] blocked main-frame navigation', {
        url: navigationUrl,
      })
      this.safeOpenExternal(navigationUrl)
    })

    mainWindow.webContents.on(
      'will-attach-webview',
      (event, webPreferences, params) => {
        const policy = classifyExternalUrl(params.src || '')
        if (policy.blocked) {
          event.preventDefault()
          logWarn('[window] blocked webview attachment', {
            url: params.src,
            reason: policy.blockedReason,
          })
          return
        }

        // webview 只用于外部媒体页面，禁止它继承主窗口 preload 或 Node 能力。
        delete webPreferences.preload
        webPreferences.nodeIntegration = false
        webPreferences.nodeIntegrationInSubFrames = false
        webPreferences.contextIsolation = true
        webPreferences.sandbox = true
        webPreferences.webSecurity = true
        webPreferences.allowRunningInsecureContent = false
      },
    )

    mainWindow.webContents.on('did-attach-webview', (_event, webContents) => {
      webContents.setWindowOpenHandler((details) => {
        this.safeOpenExternal(details.url)
        return { action: 'deny' }
      })

      webContents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault()
        logWarn('[window] blocked webview navigation', {
          url: navigationUrl,
        })
        this.safeOpenExternal(navigationUrl)
      })
    })

    mainWindow.webContents.on('did-fail-load', (_event, code, desc) => {
      logError('[window] failed to load', { code, desc })
    })

    mainWindow.webContents.on(
      'console-message',
      (_event, level, message, line, sourceId) => {
        if (sourceId.startsWith('devtools://')) return
        const formatted = `[renderer:${level}] ${message} (${sourceId}:${line})`
        if (level >= 2) {
          logError(formatted)
        } else {
          logInfo(formatted)
        }
      },
    )

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      logError(
        '[window] renderer process gone',
        details.reason,
        details.exitCode,
      )
    })

    mainWindow.webContents.on('unresponsive', () => {
      logError('[window] renderer became unresponsive')
    })

    mainWindow.webContents.on('did-finish-load', () => {
      this.installStartupWatchdog(mainWindow)
    })
  }

  private requestMainWindowReveal(options?: { focus?: boolean }): void {
    this.revealMainWindowRequested = true
    this.focusMainWindowWhenShown =
      this.focusMainWindowWhenShown || !!options?.focus
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (this.mainWindowReadyTimedOut) {
      this.revealMainWindowIfReady({
        ignoreRendererReady: true,
        ignoreFirstPaint: true,
      })
      return
    }
    this.revealMainWindowIfReady()
  }

  private shouldRevealMainWindow(): boolean {
    return (
      !this.options.shouldStartInTray?.() ||
      this.revealMainWindowRequested ||
      this.pendingDeepLinks.length > 0
    )
  }

  private revealMainWindowIfReady(options?: {
    ignoreRendererReady?: boolean
    ignoreFirstPaint?: boolean
  }): void {
    const current = this.mainWindow
    if (!current || current.isDestroyed()) return
    if (!this.shouldRevealMainWindow()) return
    if (!options?.ignoreFirstPaint && !this.mainWindowReadyToShow) return
    if (!options?.ignoreRendererReady && !this.rendererAppReadyToShow) return

    this.clearReadyToShowTimeout()
    current.show()
    if (this.focusMainWindowWhenShown) {
      current.focus()
    }
    this.focusMainWindowWhenShown = false
  }

  private installReadyToShowTimeout(mainWindow: BrowserWindow): void {
    if (this.readyToShowTimeout) return
    this.readyToShowTimeout = setTimeout(() => {
      this.readyToShowTimeout = null
      this.mainWindowReadyTimedOut = true
      const current = this.mainWindow
      if (!current || current !== mainWindow || current.isDestroyed()) return
      if (!this.shouldRevealMainWindow() || current.isVisible()) return

      logWarn('[window] renderer app ready timeout, showing main window')
      this.revealMainWindowIfReady({
        ignoreRendererReady: true,
        ignoreFirstPaint: true,
      })
    }, MAIN_WINDOW_READY_TIMEOUT_MS)
  }

  private clearReadyToShowTimeout(): void {
    if (!this.readyToShowTimeout) return
    clearTimeout(this.readyToShowTimeout)
    this.readyToShowTimeout = null
  }

  private isAllowedAppNavigationUrl(rawUrl: string): boolean {
    try {
      const navigationUrl = new URL(rawUrl)
      const rendererUrl = new URL(this.getRendererEntryUrl())

      if (navigationUrl.protocol !== rendererUrl.protocol) {
        return false
      }

      if (rendererUrl.protocol === 'file:') {
        return navigationUrl.pathname === rendererUrl.pathname
      }

      return navigationUrl.origin === rendererUrl.origin
    } catch (error) {
      logWarn('[window] invalid navigation url', rawUrl, error)
      return false
    }
  }

  private getRendererEntryUrl(): string {
    if (this.options.isDev && process.env['ELECTRON_RENDERER_URL']) {
      return process.env['ELECTRON_RENDERER_URL']
    }
    return pathToFileURL(join(__dirname, '../renderer/index.html')).toString()
  }

  private flushPendingDeepLinks(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (!this.rendererReady) return
    if (this.mainWindow.webContents.isLoadingMainFrame()) return

    while (this.pendingDeepLinks.length > 0) {
      const action = this.pendingDeepLinks.shift()
      if (!action) continue
      logInfo('[protocol] dispatching deep link', { type: action.type })
      this.mainWindow.webContents.send('app:deep-link', action)
    }
  }

  private installStartupWatchdog(mainWindow: BrowserWindow): void {
    if (
      !this.mainWindow ||
      this.mainWindow !== mainWindow ||
      mainWindow.isDestroyed()
    )
      return

    setTimeout(() => {
      const current = this.mainWindow
      if (!current || current !== mainWindow || current.isDestroyed()) return
      void current.webContents
        .executeJavaScript(
          `(() => {
            const root = document.getElementById('root');
            const text = (root?.textContent || '').trim();
            return text.includes('Loading Livo');
          })()`,
          true,
        )
        .then((stillLoading) => {
          if (stillLoading) {
            logError(
              '[window] startup watchdog: renderer stuck on loading screen, reloading',
            )
            void current.webContents.reloadIgnoringCache()
          }
        })
        .catch((error) => {
          logWarn('[window] startup watchdog check failed', error)
        })
    }, 8000)
  }
}
