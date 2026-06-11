import { app, protocol } from 'electron'
import { join } from 'path'
import { initDatabase, getDb } from './database'
import { registerFeedHandlers } from './handlers/feed-handlers'
import { registerFeedSyncHandlers } from './handlers/feed-sync-handlers'
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
import { registerAuthHandlers } from './handlers/auth-handlers'
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
import { parseDeepLink } from '../shared/deep-link'
import { UpdaterService } from './services/updater'
import { registerUpdaterHandlers } from './handlers/updater-handlers'
import { WebSocketService } from './services/websocket'
import { registerWebSocketHandlers } from './handlers/websocket-handlers'

const STARTUP_BACKGROUND_DELAY_MS = 2500

export class AppManager {
  readonly windowManager: WindowManager
  private tray: AppTray | null = null
  private stopCacheMaintenance: (() => void) | null = null
  private startupBackgroundTimer: ReturnType<typeof setTimeout> | null = null
  private updater: UpdaterService
  private websocket: WebSocketService

  constructor(
    private readonly options: {
      isDev: boolean
    },
  ) {
    this.updater = new UpdaterService(options.isDev)
    this.websocket = new WebSocketService(
      process.env.WS_SERVER_URL || 'http://localhost:3000',
    )
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
      this.dispatchDeepLink(protocolArg)
    }
    this.windowManager.focusMainWindow()
  }

  handleOpenUrl(url: string): void {
    this.dispatchDeepLink(url)
    this.windowManager.focusMainWindow()
  }

  handleInitialArgv(argv: string[]): void {
    const protocolArg = argv.find((arg) => /^livo:\/\//i.test(arg))
    if (protocolArg) {
      this.dispatchDeepLink(protocolArg)
    }
  }

  private dispatchDeepLink(url: string): void {
    const action = parseDeepLink(url)
    if (!action) return
    this.windowManager.enqueueDeepLink(action)
  }

  async onReady(): Promise<void> {
    this.configurePlatformIntegration()
    this.registerCacheProtocol()

    // 提前注册 IPC，窗口加载后可以立刻调用启动接口。
    this.registerIpcHandlers()
    registerAppHandlers(this.windowManager)
    registerUpdaterHandlers(this.updater)
    registerWebSocketHandlers(this.websocket)

    // 先创建窗口，再等待数据库初始化；renderer HTML 和骨架屏可以更早加载。
    const mainWindow = this.windowManager.createMainWindow()
    this.updater.setWindow(mainWindow)
    this.websocket.setWindow(mainWindow)

    // 数据库初始化与 renderer 启动并行，避免主进程先把开窗链路堵住。
    const dbInitPromise = (async () => {
      await initDatabase()
      await recoverOrphanBilibiliDynamicFeeds()
    })()

    const settings = settingsProvider.get()
    await applyProxySettings(settings)

    this.createTray()
    this.registerMenu()

    registerSessionPolicies()

    // 数据库初始化完成后再安排后台任务；此时窗口与骨架屏已开始加载。
    await dbInitPromise

    this.scheduleStartupBackgroundJobs(mainWindow, settings)
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
    if (this.startupBackgroundTimer) {
      clearTimeout(this.startupBackgroundTimer)
      this.startupBackgroundTimer = null
    }
    this.tray?.destroy()
    this.tray = null
    this.websocket.disconnect()
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
    registerFeedSyncHandlers()
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
    registerAuthHandlers()
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

  private scheduleStartupBackgroundJobs(
    mainWindow: ReturnType<WindowManager['getMainWindow']>,
    settings: ReturnType<typeof settingsProvider.get>,
  ): void {
    if (this.startupBackgroundTimer) {
      clearTimeout(this.startupBackgroundTimer)
    }

    // 聚合预热、缓存扫描和自动刷新都不是首屏必需；延后启动，
    // 避免刚开窗时和 hydrate / reader snapshot 抢数据库与 IO。
    this.startupBackgroundTimer = setTimeout(() => {
      this.startupBackgroundTimer = null
      startAggregatorJobs()
      this.stopCacheMaintenance = startCacheMaintenance(() =>
        settingsProvider.get(),
      )
      startFeverAutoSync()
      startAutoRefresh(settings.general.refreshInterval, mainWindow, {
        freshnessTTL: settings.data?.freshnessTTL ?? 10,
        concurrency: settings.data?.refreshConcurrency ?? 5,
      })
    }, STARTUP_BACKGROUND_DELAY_MS)
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
