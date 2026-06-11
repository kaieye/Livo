import { app, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { IPC, type NativeContextMenuItem } from '../../shared/types'
import type { FeedWithCount } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { logError, logInfo, readRecentLogs } from '../services/system/logger'
import {
  clearApplicationCache,
  getAppCacheDirectoryPath,
  getLogDirectory,
  getUserDataDirectoryPath,
  openDirectory,
} from '../services/system/app-shell'
import { checkForAppUpdates } from '../services/system/update-check'
import { downloadUrlToFile, saveTextFile } from '../services/system/download'
import { settingsProvider } from '../services/system/settings-provider'
import { getDb, whenDbReady } from '../database'
import { sessionStore } from '../services/auth/session-store'
import type { WindowManager } from '../window-manager'

function logStartupTiming(label: string, startedAt: number): void {
  logInfo(`[startup] ${label}`, {
    durationMs: Math.round(performance.now() - startedAt),
  })
}

export function registerAppHandlers(windowManager: WindowManager): void {
  registerChannel(IPC.APP_GET_VERSION, () => app.getVersion())
  registerChannel(IPC.APP_OPEN_EXTERNAL, (_event, url: string) => {
    windowManager.safeOpenExternal(url)
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
  registerChannel(IPC.APP_RENDERER_READY, () => {
    windowManager.markRendererReady()
    return { success: true }
  })
  registerChannel(IPC.APP_READY_TO_SHOW_MAIN_WINDOW, () => {
    windowManager.readyToShowMainWindow()
    return { success: true }
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

  registerChannel(IPC.WINDOW_MINIMIZE, () => {
    windowManager.minimizeWindow()
    return { success: true }
  })
  registerChannel(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    windowManager.toggleMaximizeWindow()
    return { success: true }
  })
  registerChannel(IPC.WINDOW_CLOSE, () => {
    windowManager.closeWindow()
    return { success: true }
  })
  registerChannel(IPC.WINDOW_IS_MAXIMIZED, () => {
    return windowManager.isWindowMaximized()
  })

  // Batched shell hydration: returns settings + feeds + auth in a single IPC
  // call. The heavier reader snapshot is loaded separately after the shell is
  // visible so startup does not block on entry-list queries.
  registerChannel(IPC.APP_HYDRATE, async () => {
    const startTime = performance.now()
    // Guard: the renderer may call hydrate before initDatabase() completes.
    // Wait for the database to be ready before querying.
    const dbStartTime = performance.now()
    await whenDbReady()
    logStartupTiming('app.hydrate.dbReady', dbStartTime)

    const settingsStartTime = performance.now()
    const settings = settingsProvider.get()
    logStartupTiming('app.hydrate.settings', settingsStartTime)

    const feedsStartTime = performance.now()
    const db = getDb()
    const unreadCountMap = db.entries.getUnreadCountMap()
    const feeds: FeedWithCount[] = db.feeds
      .getAllFeeds()
      .map((feed) => ({
        ...feed,
        folder:
          feed.folder ??
          (feed.category === 'Recommended' ? '' : feed.category || ''),
        unreadCount: unreadCountMap.get(feed.id) || 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
    logStartupTiming('app.hydrate.feeds', feedsStartTime)

    const authStartTime = performance.now()
    const user = sessionStore.getCurrentUser()
    logStartupTiming('app.hydrate.auth', authStartTime)
    logStartupTiming('app.hydrate.total', startTime)

    return {
      settings,
      feeds,
      auth: {
        success: true,
        isValid: !!user,
        user,
      },
      initialSnapshot: null,
    }
  })

  registerChannel(IPC.APP_GET_ICON, () => {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'resources', 'Livo.png')
      : join(app.getAppPath(), 'resources', 'Livo.png')
    const image = nativeImage.createFromPath(iconPath)
    return image.isEmpty() ? null : image.toDataURL()
  })
}
