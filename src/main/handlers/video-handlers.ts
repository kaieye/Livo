/**
 * IPC handlers for video URL resolution and YouTube account linking.
 *
 * - VIDEO_RESOLVE: Invidious/Piped proxy 鈫?direct .mp4 URLs
 * - VIDEO_YT_LOGIN / STATUS / LOGOUT: Legacy compatibility wrappers around
 *   the hardened account-linking service's YouTube provider.
 */
import { BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { classifyExternalUrl } from '../../shared/url-policy'
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

function validateVideoWindowUrl(url: string):
  | {
      allowed: true
      url: string
      origin: string
    }
  | {
      allowed: false
      error: string
    } {
  const policy = classifyExternalUrl(url)
  if (policy.blocked) {
    return { allowed: false, error: policy.blockedReason || 'blocked_url' }
  }
  if (policy.suspicious) {
    return { allowed: false, error: 'suspicious_url' }
  }

  try {
    return {
      allowed: true,
      url: policy.url,
      origin: new URL(policy.url).origin,
    }
  } catch {
    return { allowed: false, error: 'malformed' }
  }
}

export function registerVideoHandlers(): void {
  // 鈹€鈹€ Invidious/Piped video resolution 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  registerChannel(IPC.VIDEO_RESOLVE, async (_event, url: string) => {
    return resolveVideoUrl(url)
  })

  registerChannel(IPC.VIDEO_OPEN_IN_APP, async (_event, url: string) => {
    try {
      const initialUrl = validateVideoWindowUrl(url)
      if (!initialUrl.allowed) {
        return { success: false, error: initialUrl.error }
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
          sandbox: true,
        },
      })
      videoWin.webContents.setUserAgent(DESKTOP_UA)
      videoWin.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' }
      })
      videoWin.webContents.on('will-navigate', (event, nextUrl) => {
        const navigationUrl = validateVideoWindowUrl(nextUrl)
        if (
          !navigationUrl.allowed ||
          navigationUrl.origin !== initialUrl.origin
        ) {
          event.preventDefault()
        }
      })

      await videoWin.loadURL(initialUrl.url)
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
