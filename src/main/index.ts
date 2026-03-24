import { app, ipcMain, session, protocol } from 'electron'
import { join } from 'path'
import { initDatabase, getDatabase } from './database'
import { registerFeedHandlers } from './handlers/feed-handlers'
import { registerEntryHandlers } from './handlers/entry-handlers'
import { registerAIHandlers } from './handlers/ai-handlers'
import {
  registerSettingsHandlers,
  getSettings,
} from './handlers/settings-handlers'
import { registerReadabilityHandlers } from './handlers/readability-handlers'
import { registerDiscoverHandlers } from './handlers/discover-handlers'
import { registerVideoHandlers } from './handlers/video-handlers'
import { registerAccountHandlers } from './handlers/account-handlers'
import { startAutoRefresh } from './services/feed-refresh'
import { startAggregatorJobs } from './services/aggregator-jobs'
import { logError, readRecentLogs } from './services/logger'
import {
  clearApplicationCache,
  getAppCacheDirectoryPath,
  getLogDirectory,
  getUserDataDirectoryPath,
  openDirectory,
} from './services/app-shell'
import { applyProxySettings } from './services/proxy'
import { WindowManager } from './window-manager'
import { IPC } from '../shared/types'
import { registerAppMenu } from './menu'
import { checkForAppUpdates } from './services/update-check'
import { AppTray } from './services/tray'
import { recoverOrphanBilibiliDynamicFeeds } from './services/bilibili-orphan-recovery'

const isDev = !app.isPackaged
const windowManager = new WindowManager({
  isDev,
  preloadPath: join(__dirname, '../preload/index.mjs'),
  getCacheImagePath: (fileName) =>
    join(app.getPath('userData'), 'cache', 'images', fileName),
  shouldMinimizeToTray: () => getSettings().general.minimizeToTray,
  shouldStartInTray: () => getSettings().general.startInTray,
  onVisibilityChanged: () => {
    tray?.refreshMenu()
  },
})
let tray: AppTray | null = null

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}

app.on('second-instance', (_event, argv) => {
  const protocolArg = argv.find((arg) => /^livo:\/\//i.test(arg))
  if (protocolArg) {
    windowManager.setPendingProtocolUrl(protocolArg)
  }
  windowManager.focusMainWindow()
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  windowManager.setPendingProtocolUrl(url)
  windowManager.focusMainWindow()
})

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.livo.app')
  }
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient('livo')
  }

  // Register custom protocol for local cached images (must be before any window is created)
  protocol.registerFileProtocol('livo-cache', (request, callback) => {
    const fileName = request.url.replace('livo-cache://', '')
    const filePath = windowManager.resolveCacheFile(fileName)
    if (filePath) {
      callback({ path: filePath })
    } else {
      callback({ error: -6 }) // net::ERR_FILE_NOT_FOUND
    }
  })

  // Initialize database
  await initDatabase()
  await recoverOrphanBilibiliDynamicFeeds()

  // Register IPC handlers
  registerFeedHandlers()
  registerEntryHandlers()
  registerAIHandlers()
  registerSettingsHandlers()
  registerReadabilityHandlers()
  registerDiscoverHandlers()
  registerVideoHandlers()
  registerAccountHandlers()

  // Start auto-refresh AFTER window is created, so mainWindow is available for IPC
  const settings = getSettings()
  await applyProxySettings(settings)

  // Create window first
  const mainWindow = windowManager.createMainWindow()
  tray = new AppTray({
    showWindow: () => windowManager.focusMainWindow(),
    hideWindow: () => windowManager.hideMainWindow(),
    refreshAll: () => windowManager.sendAppCommand({ type: 'refresh-all' }),
    openSettings: () =>
      windowManager.sendAppCommand({ type: 'open-settings', tab: 'general' }),
    checkForUpdates: () =>
      windowManager.sendAppCommand({ type: 'open-settings', tab: 'about' }),
    quit: () => {
      windowManager.prepareForQuit()
      app.quit()
    },
    isWindowVisible: () => windowManager.isMainWindowVisible(),
  })
  tray.ensureCreated()
  registerAppMenu({
    windowManager,
    isDev,
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
      windowManager.sendAppCommand({ type: 'open-settings', tab: 'about' })
    },
  })

  // Warm and maintain a local aggregator cache for high-risk feeds so the UI
  // can consume recent snapshots instead of relying on live fetches every time.
  startAggregatorJobs()

  // Now start auto-refresh with data maintenance options
  startAutoRefresh(settings.general.refreshInterval, mainWindow, {
    freshnessTTL: settings.data?.freshnessTTL ?? 10,
    concurrency: settings.data?.refreshConcurrency ?? 5,
  })

  // Intercept outgoing headers for media CDNs:
  // 1. Twitter/X: strip Referer so pbs.twimg.com / video.twimg.com don't reject us
  // 2. YouTube: spoof User-Agent to look like regular Chrome (strip "Electron" / app name)
  //    so that youtube-nocookie.com iframe embeds don't trigger bot / login detection
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

      // Twitter/X: add proper Referer so pbs.twimg.com / video.twimg.com return images correctly.
      // Without this, Twitter's CDN may reject requests with 403 or return empty responses.
      if (url.includes('twimg.com') || url.includes('x.com')) {
        details.requestHeaders['Referer'] = 'https://twitter.com/'
        details.requestHeaders['referer'] = 'https://twitter.com/'
      }

      // Instagram/Picnob mirrors: set Instagram Referer to reduce hotlink blocking on avatar/media URLs.
      if (
        /cdninstagram\.com|fbcdn\.net|instagram\.com|picnob\.info|picnob\.com|pixnoy\.com|piokok\.com|pixwox\.com|dumpor\.com/i.test(
          url,
        ) ||
        /https?:\/\/[^/]*scontent[^/]*\./i.test(url)
      ) {
        details.requestHeaders['Referer'] = 'https://www.instagram.com/'
        details.requestHeaders['referer'] = 'https://www.instagram.com/'
      }

      // Bilibili CDN images (hdslb) may require site Referer to avoid hotlink rejection.
      if (url.includes('hdslb.com')) {
        details.requestHeaders['Referer'] = 'https://www.bilibili.com/'
        details.requestHeaders['referer'] = 'https://www.bilibili.com/'
      }

      // YouTube / Google: spoof User-Agent to look like vanilla Chrome
      if (
        url.includes('youtube.com') ||
        url.includes('youtube-nocookie.com') ||
        url.includes('googlevideo.com') ||
        url.includes('ytimg.com') ||
        url.includes('accounts.google.com')
      ) {
        const ua = details.requestHeaders['User-Agent'] || ''
        // Remove Electron/X.Y.Z and AppName/X.Y.Z tokens
        details.requestHeaders['User-Agent'] = ua
          .replace(/\s*Electron\/[\d.]+/gi, '')
          .replace(/\s*Livo\/[\d.]+/gi, '')
          .replace(/\s*electron-vite[\w-]*\/[\d.]+/gi, '')
      }

      callback({ requestHeaders: details.requestHeaders })
    },
  )

  // Force cache for remote images/videos so thumbnails and previews don't re-load every time.
  // Many feed/media origins return no-cache headers; rewrite them to allow disk cache reuse.
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
        Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
      const setHeader = (name: string, value: string) => {
        const key = findHeaderKey(name) || name
        headers[key] = [value]
      }
      const deleteHeader = (name: string) => {
        const key = findHeaderKey(name)
        if (key) delete headers[key]
      }

      // Do not cache failed media responses; avoid sticky broken thumbnails.
      if (statusCode < 200 || statusCode >= 300) {
        setHeader('Cache-Control', 'no-store, max-age=0')
        setHeader('Pragma', 'no-cache')
        setHeader('Expires', '0')
        callback({ responseHeaders: headers })
        return
      }

      // Keep image caches longer than video byte ranges (success responses only).
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
      // Let Cache-Control govern caching behavior.
      deleteHeader('Expires')

      callback({ responseHeaders: headers })
    },
  )

  // Return app version
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, (_event, url: string) => {
    windowManager.safeOpenExternal(url)
    return { success: true }
  })
  ipcMain.handle(
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
  ipcMain.handle(IPC.APP_READ_RECENT_LOGS, (_event, maxLines?: number) => {
    return {
      success: true,
      content: readRecentLogs(typeof maxLines === 'number' ? maxLines : 200),
    }
  })
  ipcMain.handle(IPC.APP_OPEN_DATA_DIRECTORY, () => {
    return openDirectory(getUserDataDirectoryPath())
  })
  ipcMain.handle(IPC.APP_OPEN_CACHE_DIRECTORY, () => {
    return openDirectory(getAppCacheDirectoryPath())
  })
  ipcMain.handle(IPC.APP_OPEN_LOGS_DIRECTORY, () => {
    return openDirectory(getLogDirectory())
  })
  ipcMain.handle(IPC.APP_CLEAR_CACHE, async () => {
    return clearApplicationCache()
  })
  ipcMain.handle(IPC.APP_CHECK_FOR_UPDATES, async () => {
    return checkForAppUpdates()
  })

  app.on('activate', () => {
    if (!windowManager.hasMainWindow()) {
      windowManager.createMainWindow()
    } else {
      windowManager.focusMainWindow()
    }
    tray?.refreshMenu()
  })
})

app.on('before-quit', () => {
  windowManager.prepareForQuit()
  tray?.destroy()
})

app.on('window-all-closed', () => {
  const db = getDatabase()
  if (db) db.close()
  if (process.platform !== 'darwin') app.quit()
})
