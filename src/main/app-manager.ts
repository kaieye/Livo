import { app, protocol } from 'electron'
import { join } from 'path'
import { initDatabase, getDb } from './database'
import { registerFeedHandlers } from './handlers/feed-handlers'
import { registerEntryHandlers } from './handlers/entry-handlers'
import { registerReaderHandlers } from './handlers/reader-handlers'
import { registerAIHandlers } from './handlers/ai-handlers'
import { registerSettingsHandlers } from './handlers/settings-handlers'
import { settingsProvider } from './services/system/settings-provider'
import { registerReadabilityHandlers } from './handlers/readability-handlers'
import { registerDiscoverHandlers } from './handlers/discover-handlers'
import { registerVideoHandlers } from './handlers/video-handlers'
import { registerAccountHandlers } from './handlers/account-handlers'
import { registerAgentHandlers } from './handlers/agent-handlers'
import { registerActionHandlers } from './handlers/action-handlers'
import { registerFeverHandlers } from './handlers/fever-handlers'
import { registerTaskHandlers } from './handlers/task-handlers'
import { registerAppHandlers } from './handlers/app-handlers'
import { startAutoRefresh } from './services/feed/feed-refresh'
import {
  startFeverAutoSync,
  stopFeverAutoSync,
} from './services/fever/fever-sync'
import { startAggregatorJobs } from './services/feed/aggregator-jobs'
import {
  getAppCacheDirectoryPath,
  getLogDirectory,
  getUserDataDirectoryPath,
  openDirectory,
} from './services/system/app-shell'
import { applyProxySettings } from './services/system/proxy'
import { WindowManager } from './window-manager'
import { registerAppMenu } from './menu'
import { checkForAppUpdates } from './services/system/update-check'
import { AppTray } from './services/system/tray'
import { recoverOrphanBilibiliDynamicFeeds } from './services/bilibili/bilibili-orphan-recovery'
import { startCacheMaintenance } from './services/system/cache-maintenance'
import { registerSessionPolicies } from './services/system/session-policies'

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
      shouldMinimizeToTray: () => settingsProvider.get().general.minimizeToTray,
      shouldStartInTray: () => settingsProvider.get().general.startInTray,
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

    const settings = settingsProvider.get()
    await applyProxySettings(settings)

    const mainWindow = this.windowManager.createMainWindow()
    this.createTray()
    this.registerMenu()

    startAggregatorJobs()
    this.stopCacheMaintenance = startCacheMaintenance(() =>
      settingsProvider.get(),
    )
    startFeverAutoSync()
    startAutoRefresh(settings.general.refreshInterval, mainWindow, {
      freshnessTTL: settings.data?.freshnessTTL ?? 10,
      concurrency: settings.data?.refreshConcurrency ?? 5,
    })

    registerSessionPolicies()
    registerAppHandlers(this.windowManager)
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
    getDb().close()
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
}

export function createAppManager(options: { isDev: boolean }): AppManager {
  return new AppManager(options)
}
