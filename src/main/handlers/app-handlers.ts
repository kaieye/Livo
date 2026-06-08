import { app, Menu } from 'electron'
import { IPC, type NativeContextMenuItem } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { logError, readRecentLogs } from '../services/system/logger'
import {
  clearApplicationCache,
  getAppCacheDirectoryPath,
  getLogDirectory,
  getUserDataDirectoryPath,
  openDirectory,
} from '../services/system/app-shell'
import { checkForAppUpdates } from '../services/system/update-check'
import { downloadUrlToFile, saveTextFile } from '../services/system/download'
import type { WindowManager } from '../window-manager'

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
}
