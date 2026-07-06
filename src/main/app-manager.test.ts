import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppManager } from './app-manager'

const originalPlatform = process.platform

const mocks = vi.hoisted(() => ({
  appQuit: vi.fn(),
  dbClose: vi.fn(),
  stopAggregatorJobs: vi.fn(),
  stopAutoRefresh: vi.fn(),
  stopFeverAutoSync: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/livo-test'),
    isPackaged: false,
    quit: mocks.appQuit,
    setAppUserModelId: vi.fn(),
    setAsDefaultProtocolClient: vi.fn(),
  },
  protocol: {
    registerFileProtocol: vi.fn(),
  },
}))

vi.mock('./database', () => ({
  initDatabase: vi.fn(),
  getDb: () => ({
    close: mocks.dbClose,
  }),
}))

vi.mock('./window-manager', () => ({
  WindowManager: vi.fn().mockImplementation(() => ({
    createMainWindow: vi.fn(),
    focusMainWindow: vi.fn(),
    getMainWindow: vi.fn(),
    hasMainWindow: vi.fn(() => true),
    hideMainWindow: vi.fn(),
    isMainWindowVisible: vi.fn(() => true),
    prepareForQuit: vi.fn(),
    resolveCacheFile: vi.fn(),
    sendAppCommand: vi.fn(),
  })),
}))

vi.mock('./services/updater', () => ({
  UpdaterService: vi.fn().mockImplementation(() => ({
    setWindow: vi.fn(),
  })),
}))

vi.mock('./services/websocket', () => ({
  WebSocketService: vi.fn().mockImplementation(() => ({
    disconnect: vi.fn(),
    setWindow: vi.fn(),
  })),
}))

vi.mock('./services/system/tray', () => ({
  AppTray: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    ensureCreated: vi.fn(),
    refreshMenu: vi.fn(),
  })),
}))

vi.mock('./services/fever/fever-sync', () => ({
  startFeverAutoSync: vi.fn(),
  stopFeverAutoSync: mocks.stopFeverAutoSync,
}))

vi.mock('./services/system/settings-provider', () => ({
  settingsProvider: {
    get: vi.fn(() => ({
      data: { freshnessTTL: 10, refreshConcurrency: 5 },
      general: {
        minimizeToTray: false,
        refreshInterval: 0,
        startInTray: false,
      },
    })),
  },
}))

vi.mock('./services/feed/feed-refresh', () => ({
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: mocks.stopAutoRefresh,
}))

vi.mock('./services/feed/feed-sync-service', () => ({
  feedSyncService: {
    syncNow: vi.fn(),
  },
}))

vi.mock('./services/feed/aggregator-jobs', () => ({
  startAggregatorJobs: vi.fn(),
  stopAggregatorJobs: mocks.stopAggregatorJobs,
}))

vi.mock('./services/system/cache-maintenance', () => ({
  startCacheMaintenance: vi.fn(),
}))

vi.mock('./services/system/proxy', () => ({
  applyProxySettings: vi.fn(),
}))

vi.mock('./services/system/app-shell', () => ({
  getAppCacheDirectoryPath: vi.fn(() => '/tmp/livo-test/cache'),
  getLogDirectory: vi.fn(() => '/tmp/livo-test/logs'),
  getUserDataDirectoryPath: vi.fn(() => '/tmp/livo-test'),
  openDirectory: vi.fn(),
}))

vi.mock('./services/system/logger', () => ({
  logError: vi.fn(),
}))

vi.mock('./services/auth/session-store', () => ({
  sessionStore: {},
}))

vi.mock('./services/bilibili/bilibili-orphan-recovery', () => ({
  recoverOrphanBilibiliDynamicFeeds: vi.fn(),
}))

vi.mock('./services/system/session-policies', () => ({
  registerSessionPolicies: vi.fn(),
}))

vi.mock('./services/system/update-check', () => ({
  checkForAppUpdates: vi.fn(),
}))

vi.mock('./services/backend/backend-config', () => ({
  getBackendBaseUrl: vi.fn(() => 'ws://localhost'),
}))

vi.mock('../shared/deep-link', () => ({
  parseDeepLink: vi.fn(),
}))

vi.mock('./menu', () => ({
  registerAppMenu: vi.fn(),
}))

vi.mock('./handlers/feed-handlers', () => ({ registerFeedHandlers: vi.fn() }))
vi.mock('./handlers/feed-sync-handlers', () => ({
  registerFeedSyncHandlers: vi.fn(),
}))
vi.mock('./handlers/entry-handlers', () => ({ registerEntryHandlers: vi.fn() }))
vi.mock('./handlers/reader-handlers', () => ({
  registerReaderHandlers: vi.fn(),
}))
vi.mock('./handlers/ai-handlers', () => ({ registerAIHandlers: vi.fn() }))
vi.mock('./handlers/settings-handlers', () => ({
  registerSettingsHandlers: vi.fn(),
}))
vi.mock('./handlers/readability-handlers', () => ({
  registerReadabilityHandlers: vi.fn(),
}))
vi.mock('./handlers/discover-handlers', () => ({
  registerDiscoverHandlers: vi.fn(),
}))
vi.mock('./handlers/video-handlers', () => ({ registerVideoHandlers: vi.fn() }))
vi.mock('./handlers/account-handlers', () => ({
  registerAccountHandlers: vi.fn(),
}))
vi.mock('./handlers/agent-handlers', () => ({ registerAgentHandlers: vi.fn() }))
vi.mock('./handlers/action-handlers', () => ({
  registerActionHandlers: vi.fn(),
}))
vi.mock('./handlers/fever-handlers', () => ({ registerFeverHandlers: vi.fn() }))
vi.mock('./handlers/task-handlers', () => ({ registerTaskHandlers: vi.fn() }))
vi.mock('./handlers/app-handlers', () => ({ registerAppHandlers: vi.fn() }))
vi.mock('./handlers/auth-handlers', () => ({ registerAuthHandlers: vi.fn() }))
vi.mock('./handlers/wechat-mp-handlers', () => ({
  registerWechatMpHandlers: vi.fn(),
}))
vi.mock('./handlers/reading-activity-handlers', () => ({
  registerReadingActivityHandlers: vi.fn(),
}))
vi.mock('./handlers/updater-handlers', () => ({
  registerUpdaterHandlers: vi.fn(),
}))
vi.mock('./handlers/websocket-handlers', () => ({
  registerWebSocketHandlers: vi.fn(),
}))
vi.mock('./handlers/notification-handlers', () => ({
  registerNotificationHandlers: vi.fn(),
}))

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  })
}

describe('AppManager window lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it('keeps the database open when the last macOS window closes', () => {
    setPlatform('darwin')
    const manager = new AppManager({ isDev: true })
    ;(manager as unknown as { databaseReady: boolean }).databaseReady = true

    manager.handleWindowAllClosed()

    expect(mocks.stopFeverAutoSync).not.toHaveBeenCalled()
    expect(mocks.stopAutoRefresh).not.toHaveBeenCalled()
    expect(mocks.stopAggregatorJobs).not.toHaveBeenCalled()
    expect(mocks.dbClose).not.toHaveBeenCalled()
    expect(mocks.appQuit).not.toHaveBeenCalled()
  })

  it('stops database-backed jobs before closing the database on non-macOS', () => {
    setPlatform('win32')
    const manager = new AppManager({ isDev: true })
    ;(manager as unknown as { databaseReady: boolean }).databaseReady = true

    manager.handleWindowAllClosed()

    expect(mocks.stopFeverAutoSync).toHaveBeenCalledTimes(1)
    expect(mocks.stopAutoRefresh).toHaveBeenCalledTimes(1)
    expect(mocks.stopAggregatorJobs).toHaveBeenCalledTimes(1)
    expect(mocks.dbClose).toHaveBeenCalledTimes(1)
    expect(mocks.appQuit).toHaveBeenCalledTimes(1)
    expect(mocks.stopFeverAutoSync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.dbClose.mock.invocationCallOrder[0],
    )
    expect(mocks.stopAutoRefresh.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.dbClose.mock.invocationCallOrder[0],
    )
    expect(mocks.stopAggregatorJobs.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.dbClose.mock.invocationCallOrder[0],
    )
  })

  it('does not touch the database when closing before initialization finishes', () => {
    setPlatform('win32')
    const manager = new AppManager({ isDev: true })

    manager.handleWindowAllClosed()

    expect(mocks.stopFeverAutoSync).toHaveBeenCalledTimes(1)
    expect(mocks.stopAutoRefresh).toHaveBeenCalledTimes(1)
    expect(mocks.stopAggregatorJobs).toHaveBeenCalledTimes(1)
    expect(mocks.dbClose).not.toHaveBeenCalled()
    expect(mocks.appQuit).toHaveBeenCalledTimes(1)
  })

  it('closes the database once when before-quit follows window-all-closed', () => {
    setPlatform('linux')
    const manager = new AppManager({ isDev: true })
    ;(manager as unknown as { databaseReady: boolean }).databaseReady = true

    manager.handleWindowAllClosed()
    manager.handleBeforeQuit()

    expect(mocks.dbClose).toHaveBeenCalledTimes(1)
  })

  it('closes the database on explicit macOS quit', () => {
    setPlatform('darwin')
    const manager = new AppManager({ isDev: true })
    ;(manager as unknown as { databaseReady: boolean }).databaseReady = true

    manager.handleBeforeQuit()

    expect(mocks.stopFeverAutoSync).toHaveBeenCalledTimes(1)
    expect(mocks.stopAutoRefresh).toHaveBeenCalledTimes(1)
    expect(mocks.stopAggregatorJobs).toHaveBeenCalledTimes(1)
    expect(mocks.dbClose).toHaveBeenCalledTimes(1)
    expect(mocks.appQuit).not.toHaveBeenCalled()
  })
})
