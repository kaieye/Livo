/**
 * IPC handlers for video URL resolution and YouTube account linking.
 *
 * - VIDEO_RESOLVE: Invidious/Piped proxy 鈫?direct .mp4 URLs
 * - VIDEO_YT_LOGIN / STATUS / LOGOUT: Legacy compatibility wrappers around
 *   the hardened account-linking service's YouTube provider.
 */
import { BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { resolveVideoUrl } from '../services/video/video-proxy'
import {
  getAccountState,
  linkAccount,
  unlinkAccount,
} from '../services/account/account-auth'

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export function registerVideoHandlers(): void {
  // 鈹€鈹€ Invidious/Piped video resolution 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  registerChannel(IPC.VIDEO_RESOLVE, async (_event, url: string) => {
    return resolveVideoUrl(url)
  })

  registerChannel(IPC.VIDEO_OPEN_IN_APP, async (_event, url: string) => {
    try {
      if (!/^https?:\/\//i.test(url)) {
        return { success: false, error: 'Invalid URL' }
      }
      const videoWin = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        },
      })
      videoWin.webContents.setUserAgent(DESKTOP_UA)
      videoWin.webContents.setWindowOpenHandler((details) => {
        if (/^https?:\/\//i.test(details.url)) {
          return { action: 'allow' }
        }
        return { action: 'deny' }
      })

      await videoWin.loadURL(url)
      return { success: true }
    } catch (err) {
      return toHandlerError(err)
    }
  })

  // Legacy YouTube account IPC: route through hardened account linking.
  registerChannel(IPC.VIDEO_YT_LOGIN, async () => {
    return linkAccount('youtube')
  })

  // Legacy YouTube account: check if linked.
  registerChannel(IPC.VIDEO_YT_STATUS, async () => {
    const state = await getAccountState('youtube')
    return {
      loggedIn: state.linked,
      name: state.displayName || (state.linked ? 'YouTube' : null),
    }
  })

  // Legacy YouTube account: clear linked session.
  registerChannel(IPC.VIDEO_YT_LOGOUT, async () => {
    return unlinkAccount('youtube')
  })
}
