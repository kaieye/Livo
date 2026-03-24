import { BrowserWindow, nativeTheme, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppCommandPayload } from '../shared/types'
import { logError, logInfo, logWarn } from './services/logger'

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
  private pendingProtocolUrl: string | null = null
  private isQuitting = false

  constructor(private readonly options: WindowManagerOptions) {}

  setPendingProtocolUrl(url: string): void {
    this.pendingProtocolUrl = url
  }

  safeOpenExternal(url: string): void {
    try {
      if (!/^https?:\/\//i.test(url)) return
      void shell.openExternal(url).catch((error) => {
        logWarn('[external] failed to open url', url, error)
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
    this.mainWindow.show()
    this.mainWindow.focus()
  }

  hideMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.hide()
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
    const mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: false,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      autoHideMenuBar: true,
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
    this.bindWindowEvents(mainWindow)

    if (this.options.isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }

    if (this.options.isDev && process.env['ELECTRON_RENDERER_URL']) {
      void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

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
    mainWindow.on('ready-to-show', () => {
      const shouldRevealWindow =
        !this.options.shouldStartInTray?.() || !!this.pendingProtocolUrl
      if (shouldRevealWindow) {
        mainWindow.show()
      }
      this.options.onVisibilityChanged?.()
      if (this.pendingProtocolUrl) {
        logWarn(
          '[protocol] pending deep link received',
          this.pendingProtocolUrl,
        )
        this.pendingProtocolUrl = null
      }
    })

    mainWindow.on('minimize', () => {
      if (!this.options.shouldMinimizeToTray?.()) return
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.hide()
        }
      }, 0)
    })

    mainWindow.on('close', (event) => {
      if (this.isQuitting || !this.options.shouldMinimizeToTray?.()) return
      event.preventDefault()
      mainWindow.hide()
    })

    mainWindow.on('closed', () => {
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null
      }
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
