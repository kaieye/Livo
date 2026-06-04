/**
 * IPC handlers for video URL resolution and YouTube account linking.
 *
 * - VIDEO_RESOLVE: Invidious/Piped proxy 鈫?direct .mp4 URLs
 * - VIDEO_YT_LOGIN: Opens a BrowserWindow with a preload script that
 *   disables WebAuthn APIs BEFORE any page script runs, preventing the
 *   Windows Security Center passkey dialog.  Mobile UA ensures Google
 *   shows the traditional email/password form.
 * - VIDEO_YT_STATUS: Checks whether YouTube/Google cookies exist.
 * - VIDEO_YT_LOGOUT: Clears YouTube/Google cookies.
 */
import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { resolveVideoUrl } from '../services/video/video-proxy'

/** Mobile Chrome UA - Google shows plain email+password login */
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** Google / YouTube cookie domains we care about */
const YT_COOKIE_DOMAINS = [
  '.youtube.com',
  '.google.com',
  '.accounts.google.com',
  'youtube.com',
  'accounts.google.com',
]

// 鈹€鈹€ Create a preload script at runtime that nukes WebAuthn 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// This file is loaded as a preload with contextIsolation OFF, so it shares
// the page's global scope and runs BEFORE any page script.  This is the
// ONLY reliable way to prevent Windows Security Center from popping up.
const preloadDir = join(app.getPath('temp'), 'livo')
if (!existsSync(preloadDir)) mkdirSync(preloadDir, { recursive: true })
const ytLoginPreloadPath = join(preloadDir, 'yt-login-preload.js')
writeFileSync(
  ytLoginPreloadPath,
  `// Livo: Disable WebAuthn / Passkey before page scripts load
try {
  var noop = function() { return Promise.reject(new DOMException('Not allowed', 'NotAllowedError')); };
  Object.defineProperty(navigator, 'credentials', {
    value: {
      create: noop,
      get: noop,
      store: function() { return Promise.resolve(); },
      preventSilentAccess: function() { return Promise.resolve(); }
    },
    writable: false,
    configurable: false
  });
  window.PublicKeyCredential = undefined;
  window.AuthenticatorAssertionResponse = undefined;
  window.AuthenticatorAttestationResponse = undefined;
  window.AuthenticatorResponse = undefined;
} catch(e) {}
`,
)

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

  // 鈹€鈹€ YouTube account: open Google login window 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  registerChannel(IPC.VIDEO_YT_LOGIN, async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const loginWin = new BrowserWindow({
        width: 420,
        height: 720,
        title: 'Sign in to YouTube',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          // contextIsolation must be OFF so the preload script shares
          // the page's global scope and can override navigator.credentials
          contextIsolation: false,
          sandbox: false,
          preload: ytLoginPreloadPath,
        },
      })

      // Mobile UA: Google shows email + password, no passkey prompts
      loginWin.webContents.setUserAgent(MOBILE_UA)

      // Navigate to Google login 鈫?redirect to mobile YouTube after auth
      loginWin.loadURL(
        'https://accounts.google.com/ServiceLogin?continue=https://m.youtube.com/',
      )

      // When user lands on YouTube after login, we're done
      loginWin.webContents.on('did-navigate', (_e, url) => {
        const isYouTube =
          url.startsWith('https://m.youtube.com') ||
          url.startsWith('https://www.youtube.com')
        if (isYouTube && !url.includes('accounts.google.com')) {
          setTimeout(() => loginWin.close(), 1500)
        }
      })

      loginWin.on('closed', async () => {
        try {
          const cookies = await session.defaultSession.cookies.get({
            domain: '.youtube.com',
          })
          const hasSID = cookies.some(
            (c) =>
              c.name === 'SID' || c.name === 'SSID' || c.name === 'LOGIN_INFO',
          )
          resolve({ success: hasSID })
        } catch {
          resolve({ success: false, error: 'Failed to check cookies' })
        }
      })
    })
  })

  // 鈹€鈹€ YouTube account: check if logged in 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  registerChannel(IPC.VIDEO_YT_STATUS, async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({
        domain: '.youtube.com',
      })
      const loginCookie = cookies.find(
        (c) => c.name === 'SID' || c.name === 'SSID' || c.name === 'LOGIN_INFO',
      )
      return {
        loggedIn: !!loginCookie,
        // Try to get display name from cookie or just return "YouTube"
        name: loginCookie ? 'YouTube' : null,
      }
    } catch {
      return { loggedIn: false, name: null }
    }
  })

  // 鈹€鈹€ YouTube account: clear cookies (logout) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  registerChannel(IPC.VIDEO_YT_LOGOUT, async () => {
    try {
      for (const domain of YT_COOKIE_DOMAINS) {
        const cookies = await session.defaultSession.cookies.get({ domain })
        for (const cookie of cookies) {
          const url = `http${cookie.secure ? 's' : ''}://${cookie.domain?.replace(/^\./, '') || domain}${cookie.path || '/'}`
          await session.defaultSession.cookies.remove(url, cookie.name)
        }
      }
      return { success: true }
    } catch (err) {
      return toHandlerError(err)
    }
  })
}
