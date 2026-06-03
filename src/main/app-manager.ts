import { app, protocol, session, Menu } from 'electron'
import { join } from 'path'
import { initDatabase, getDatabase } from './database'
import { registerFeedHandlers } from './handlers/feed-handlers'
import { registerEntryHandlers } from './handlers/entry-handlers'
import { registerReaderHandlers } from './handlers/reader-handlers'
import { registerAIHandlers } from './handlers/ai-handlers'
import {
  registerSettingsHandlers,
  getSettings,
} from './handlers/settings-handlers'
import { registerReadabilityHandlers } from './handlers/readability-handlers'
import { registerDiscoverHandlers } from './handlers/discover-handlers'
import { registerVideoHandlers } from './handlers/video-handlers'
import { registerAccountHandlers } from './handlers/account-handlers'
import { registerAgentHandlers } from './handlers/agent-handlers'
import { registerActionHandlers } from './handlers/action-handlers'
import { registerFeverHandlers } from './handlers/fever-handlers'
import { registerTaskHandlers } from './handlers/task-handlers'
import { startAutoRefresh } from './services/feed/feed-refresh'
import {
  startFeverAutoSync,
  stopFeverAutoSync,
} from './services/fever/fever-sync'
import { startAggregatorJobs } from './services/feed/aggregator-jobs'
import { logError, readRecentLogs } from './services/system/logger'
import {
  clearApplicationCache,
  getAppCacheDirectoryPath,
  getLogDirectory,
  getUserDataDirectoryPath,
  openDirectory,
} from './services/system/app-shell'
import { applyProxySettings } from './services/system/proxy'
import { WindowManager } from './window-manager'
import { IPC, type NativeContextMenuItem } from '../shared/types'
import { registerAppMenu } from './menu'
import { checkForAppUpdates } from './services/system/update-check'
import { AppTray } from './services/system/tray'
import { recoverOrphanBilibiliDynamicFeeds } from './services/bilibili/bilibili-orphan-recovery'
import { startCacheMaintenance } from './services/system/cache-maintenance'
import { downloadUrlToFile, saveTextFile } from './services/system/download'
import { registerChannel } from './ipc/register-channel'

export class AppManager {
  readonly windowManager: WindowManager
  private tray: AppTray | null = null
  private stopCacheMaintenance: (() => void) | null = null

  constructor(
    private readonly options: {
      isDev: boolean
    },
  ) {
    this.windowManager = new WindowManager({
      isDev: options.isDev,
      preloadPath: join(__dirname, '../preload/index.mjs'),
      getCacheImagePath: (fileName) =>
        join(app.getPath('userData'), 'cache', 'images', fileName),
      shouldMinimizeToTray: () => getSettings().general.minimizeToTray,
      shouldStartInTray: () => getSettings().general.startInTray,
      onVisibilityChanged: () => {
        this.tray?.refreshMenu()
      },
    })
  }

  handleSecondInstance(argv: string[]): void {
    const protocolArg = argv.find((arg) => /^livo:\/\//i.test(arg))
    if (protocolArg) {
      this.windowManager.setPendingProtocolUrl(protocolArg)
    }
    this.windowManager.focusMainWindow()
  }

  handleOpenUrl(url: string): void {
    this.windowManager.setPendingProtocolUrl(url)
    this.windowManager.focusMainWindow()
  }

  async onReady(): Promise<void> {
    this.configurePlatformIntegration()
    this.registerCacheProtocol()

    await initDatabase()
    await recoverOrphanBilibiliDynamicFeeds()

    this.registerIpcHandlers()

    const settings = getSettings()
    await applyProxySettings(settings)

    const mainWindow = this.windowManager.createMainWindow()
    this.createTray()
    this.registerMenu()

    startAggregatorJobs()
    this.stopCacheMaintenance = startCacheMaintenance(getSettings)
    startFeverAutoSync()
    startAutoRefresh(settings.general.refreshInterval, mainWindow, {
      freshnessTTL: settings.data?.freshnessTTL ?? 10,
      concurrency: settings.data?.refreshConcurrency ?? 5,
    })

    this.registerSessionPolicies()
    this.registerAppIpc()
  }

  handleActivate(): void {
    if (!this.windowManager.hasMainWindow()) {
      this.windowManager.createMainWindow()
    } else {
      this.windowManager.focusMainWindow()
    }
    this.tray?.refreshMenu()
  }

  handleBeforeQuit(): void {
    this.windowManager.prepareForQuit()
    this.tray?.destroy()
    this.tray = null
    stopFeverAutoSync()
    if (this.stopCacheMaintenance) {
      this.stopCacheMaintenance()
      this.stopCacheMaintenance = null
    }
  }

  handleWindowAllClosed(): void {
    const db = getDatabase()
    if (db) db.close()
    if (process.platform !== 'darwin') app.quit()
  }

  private configurePlatformIntegration(): void {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.livo.app')
    }
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient('livo')
    }
  }

  private registerCacheProtocol(): void {
    protocol.registerFileProtocol('livo-cache', (request, callback) => {
      const fileName = request.url.replace('livo-cache://', '')
      const filePath = this.windowManager.resolveCacheFile(fileName)
      if (filePath) {
        callback({ path: filePath })
      } else {
        callback({ error: -6 })
      }
    })
  }

  private registerIpcHandlers(): void {
    registerFeedHandlers()
    registerEntryHandlers()
    registerReaderHandlers()
    registerAIHandlers()
    registerSettingsHandlers()
    registerReadabilityHandlers()
    registerDiscoverHandlers()
    registerVideoHandlers()
    registerAccountHandlers()
    registerAgentHandlers()
    registerActionHandlers()
    registerFeverHandlers()
    registerTaskHandlers()
  }

  private createTray(): void {
    this.tray = new AppTray({
      showWindow: () => this.windowManager.focusMainWindow(),
      hideWindow: () => this.windowManager.hideMainWindow(),
      refreshAll: () =>
        this.windowManager.sendAppCommand({ type: 'refresh-all' }),
      openSettings: () =>
        this.windowManager.sendAppCommand({
          type: 'open-settings',
          tab: 'general',
        }),
      checkForUpdates: () =>
        this.windowManager.sendAppCommand({
          type: 'open-settings',
          tab: 'about',
        }),
      quit: () => {
        this.windowManager.prepareForQuit()
        app.quit()
      },
      isWindowVisible: () => this.windowManager.isMainWindowVisible(),
    })
    this.tray.ensureCreated()
  }

  private registerMenu(): void {
    registerAppMenu({
      windowManager: this.windowManager,
      isDev: this.options.isDev,
      openDataDirectory: () => {
        void openDirectory(getUserDataDirectoryPath())
      },
      openCacheDirectory: () => {
        void openDirectory(getAppCacheDirectoryPath())
      },
      openLogsDirectory: () => {
        void openDirectory(getLogDirectory())
      },
      checkForUpdates: () => {
        void checkForAppUpdates(true)
        this.windowManager.sendAppCommand({
          type: 'open-settings',
          tab: 'about',
        })
      },
    })
  }

  private registerSessionPolicies(): void {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      {
        urls: [
          '*://*.twimg.com/*',
          '*://pbs.twimg.com/*',
          '*://video.twimg.com/*',
          '*://*.x.com/*',
          '*://*.cdninstagram.com/*',
          '*://*.fbcdn.net/*',
          '*://*.instagram.com/*',
          '*://*.picnob.info/*',
          '*://*.picnob.com/*',
          '*://*.pixnoy.com/*',
          '*://*.piokok.com/*',
          '*://*.pixwox.com/*',
          '*://*.dumpor.com/*',
          '*://media.picnob.info/*',
          '*://media.picnob.com/*',
          '*://media.pixnoy.com/*',
          '*://media.piokok.com/*',
          '*://*.hdslb.com/*',
          '*://*.youtube.com/*',
          '*://*.youtube-nocookie.com/*',
          '*://*.googlevideo.com/*',
          '*://*.ytimg.com/*',
          '*://accounts.google.com/*',
        ],
      },
      (details, callback) => {
        const url = details.url
        if (url.includes('twimg.com') || url.includes('x.com')) {
          details.requestHeaders['Referer'] = 'https://twitter.com/'
          details.requestHeaders['referer'] = 'https://twitter.com/'
        }

        if (
          /cdninstagram\.com|fbcdn\.net|instagram\.com|picnob\.info|picnob\.com|pixnoy\.com|piokok\.com|pixwox\.com|dumpor\.com/i.test(
            url,
          ) ||
          /https?:\/\/[^/]*scontent[^/]*\./i.test(url)
        ) {
          details.requestHeaders['Referer'] = 'https://www.instagram.com/'
          details.requestHeaders['referer'] = 'https://www.instagram.com/'
        }

        if (url.includes('hdslb.com')) {
          details.requestHeaders['Referer'] = 'https://www.bilibili.com/'
          details.requestHeaders['referer'] = 'https://www.bilibili.com/'
        }

        if (
          url.includes('youtube.com') ||
          url.includes('youtube-nocookie.com') ||
          url.includes('googlevideo.com') ||
          url.includes('ytimg.com') ||
          url.includes('accounts.google.com')
        ) {
          const ua = details.requestHeaders['User-Agent'] || ''
          details.requestHeaders['User-Agent'] = ua
            .replace(/\s*Electron\/[\d.]+/gi, '')
            .replace(/\s*Livo\/[\d.]+/gi, '')
            .replace(/\s*electron-vite[\w-]*\/[\d.]+/gi, '')
        }

        callback({ requestHeaders: details.requestHeaders })
      },
    )

    session.defaultSession.webRequest.onHeadersReceived(
      { urls: ['*://*/*'] },
      (details, callback) => {
        const isMediaResource =
          details.resourceType === 'image' || details.resourceType === 'media'
        if (!isMediaResource) {
          callback({ responseHeaders: details.responseHeaders })
          return
        }

        const headers = { ...(details.responseHeaders || {}) }
        const statusCode = details.statusCode || 0
        const findHeaderKey = (name: string) =>
          Object.keys(headers).find(
            (k) => k.toLowerCase() === name.toLowerCase(),
          )
        const setHeader = (name: string, value: string) => {
          const key = findHeaderKey(name) || name
          headers[key] = [value]
        }
        const deleteHeader = (name: string) => {
          const key = findHeaderKey(name)
          if (key) delete headers[key]
        }

        if (statusCode < 200 || statusCode >= 300) {
          setHeader('Cache-Control', 'no-store, max-age=0')
          setHeader('Pragma', 'no-cache')
          setHeader('Expires', '0')
          callback({ responseHeaders: headers })
          return
        }

        if (details.resourceType === 'image') {
          setHeader(
            'Cache-Control',
            'public, max-age=604800, stale-while-revalidate=86400',
          )
        } else {
          setHeader(
            'Cache-Control',
            'public, max-age=86400, stale-while-revalidate=3600',
          )
        }

        deleteHeader('Pragma')
        deleteHeader('Expires')
        callback({ responseHeaders: headers })
      },
    )
  }

  private registerAppIpc(): void {
    registerChannel(IPC.APP_GET_VERSION, () => app.getVersion())
    registerChannel(IPC.APP_OPEN_EXTERNAL, (_event, url: string) => {
      this.windowManager.safeOpenExternal(url)
      return { success: true }
    })
    registerChannel(
      IPC.APP_REPORT_ERROR,
      (
        _event,
        payload: {
          source: string
          message: string
          stack?: string
          componentStack?: string
        },
      ) => {
        logError('[app-report-error]', payload)
        return { success: true }
      },
    )
    registerChannel(IPC.APP_READ_RECENT_LOGS, (_event, maxLines?: number) => {
      return {
        success: true,
        content: readRecentLogs(typeof maxLines === 'number' ? maxLines : 200),
      }
    })
    registerChannel(IPC.APP_OPEN_DATA_DIRECTORY, () => {
      return openDirectory(getUserDataDirectoryPath())
    })
    registerChannel(IPC.APP_OPEN_CACHE_DIRECTORY, () => {
      return openDirectory(getAppCacheDirectoryPath())
    })
    registerChannel(IPC.APP_OPEN_LOGS_DIRECTORY, () => {
      return openDirectory(getLogDirectory())
    })
    registerChannel(IPC.APP_CLEAR_CACHE, async () => {
      return clearApplicationCache()
    })
    registerChannel(IPC.APP_CHECK_FOR_UPDATES, async () => {
      return checkForAppUpdates()
    })
    registerChannel(IPC.APP_SAVE_TEXT_FILE, async (_event, options) => {
      return saveTextFile(options)
    })
    registerChannel(IPC.APP_DOWNLOAD_URL, async (_event, options) => {
      return downloadUrlToFile(options)
    })
    registerChannel(
      IPC.MENU_SHOW_CONTEXT,
      async (_event, items: NativeContextMenuItem[]) => {
        const filtered = Array.isArray(items) ? items : []
        return new Promise<{ id: string | null }>((resolve) => {
          let settled = false
          const finish = (id: string | null) => {
            if (settled) return
            settled = true
            resolve({ id })
          }

          const menu = Menu.buildFromTemplate(
            filtered.map((item) => {
              if (item.separator) {
                return { type: 'separator' as const }
              }
              return {
                label: item.label || '',
                enabled: !item.disabled,
                click: () => finish(item.id),
              }
            }),
          )

          menu.once('menu-will-close', () => {
            finish(null)
          })

          menu.popup({
            callback: () => {
              finish(null)
            },
          })
        })
      },
    )
  }
}

export function createAppManager(options: { isDev: boolean }): AppManager {
  return new AppManager(options)
}
