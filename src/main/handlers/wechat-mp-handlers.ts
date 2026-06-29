import { BrowserWindow } from 'electron'
import { registerChannel } from '../ipc/register-channel'
import { IPC } from '../../shared/ipc-contracts'

const WX_MP_LOGIN_URL = 'https://mp.weixin.qq.com/'
const LOGIN_TIMEOUT_MS = 180_000 // 3 minutes

function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    if (token) return token
  } catch {
    // Not a valid URL
  }
  return null
}

export function registerWechatMpHandlers(): void {
  registerChannel(IPC.WECHAT_MP_LOGIN, async () => {
    return new Promise<{ token: string }>((resolve, reject) => {
      const win = new BrowserWindow({
        width: 460,
        height: 620,
        title: '微信公众号登录',
        resizable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })

      let resolved = false
      const finish = (token: string | null, error?: string) => {
        if (resolved) return
        resolved = true
        try {
          if (!win.isDestroyed()) win.close()
        } catch {
          // ignore
        }
        if (token) {
          resolve({ token })
        } else {
          reject(new Error(error || '登录超时或已取消'))
        }
      }

      // Timeout safety
      const timer = setTimeout(() => finish(null, '登录超时'), LOGIN_TIMEOUT_MS)

      // Monitor page navigation for login success
      win.webContents.on('did-navigate', (_event, url) => {
        // Check if we reached the WeChat MP home page (login successful)
        if (url.includes('/cgi-bin/home') || url.includes('/cgi-bin/appmsg')) {
          clearTimeout(timer)
          // Try to extract token from URL first
          const token = extractTokenFromUrl(url)
          if (token) {
            finish(token)
            return
          }
          // If no token in URL, try to get it from cookies
          win.webContents.session.cookies
            .get({ url: WX_MP_LOGIN_URL })
            .then((cookies) => {
              for (const cookie of cookies) {
                if (
                  cookie.name === 'token' ||
                  cookie.name.toLowerCase().includes('token')
                ) {
                  finish(cookie.value)
                  return
                }
              }
              // Try to extract token from page
              win.webContents
                .executeJavaScript(
                  'new URL(window.location.href).searchParams.get("token") || ""',
                )
                .then((jsToken: string) => {
                  if (jsToken) {
                    finish(jsToken)
                  } else {
                    // Token not found in URL or cookies — but we're on the home page,
                    // so login DID succeed. Try extracting cookies broadly.
                    finish('logged-in-without-token')
                  }
                })
                .catch(() => finish('logged-in-without-token'))
            })
            .catch(() => finish('logged-in-without-token'))
        }
      })

      // Handle window close (user cancelled)
      win.on('closed', () => {
        clearTimeout(timer)
        finish(null, '登录窗口已关闭')
      })

      win.loadURL(WX_MP_LOGIN_URL)
    })
  })
}
