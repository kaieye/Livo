import { BrowserWindow } from 'electron'
import { registerChannel } from '../ipc/register-channel'
import { IPC } from '../../shared/ipc-contracts'
import { getBackendBaseUrl } from '../services/backend/backend-config'

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

function buildCookieString(cookies: Electron.Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

async function saveCredentialsToServer(
  token: string,
  cookies: string,
): Promise<void> {
  const serverUrl = getBackendBaseUrl()
  const res = await fetch(`${serverUrl}/api/wechat-rss/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, cookies }),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Server responded with ${res.status}`)
  }
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
          // Use persistent session so cookies survive across login attempts
          partition: 'persist:wechat-mp',
        },
      })

      // Set a standard browser UA to avoid being blocked by WeChat
      win.webContents.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      )

      let resolved = false
      const finish = async (
        token: string | null,
        cookies: string,
        error?: string,
      ) => {
        if (resolved) return
        resolved = true
        try {
          if (!win.isDestroyed()) win.close()
        } catch {
          // ignore
        }
        if (token && cookies) {
          try {
            await saveCredentialsToServer(token, cookies)
            resolve({ token })
          } catch (e) {
            reject(
              new Error(
                `服务器保存失败: ${e instanceof Error ? e.message : String(e)}`,
              ),
            )
          }
        } else if (token) {
          // Token but no cookies — try saving with empty cookies
          try {
            await saveCredentialsToServer(token, '')
            resolve({ token })
          } catch (e) {
            reject(
              new Error(
                `服务器保存失败: ${e instanceof Error ? e.message : String(e)}`,
              ),
            )
          }
        } else {
          reject(new Error(error || '登录超时或已取消'))
        }
      }

      // Timeout safety
      const timer = setTimeout(
        () => finish(null, '', '登录超时'),
        LOGIN_TIMEOUT_MS,
      )

      // Monitor page navigation for login success
      win.webContents.on('did-navigate', (_event, url) => {
        if (url.includes('/cgi-bin/home') || url.includes('/cgi-bin/appmsg')) {
          clearTimeout(timer)

          // Get ALL cookies from the session
          win.webContents.session.cookies
            .get({ url: WX_MP_LOGIN_URL })
            .then((cookies) => {
              const cookieStr = buildCookieString(cookies)

              // Try to extract token from URL first
              const urlToken = extractTokenFromUrl(url)
              if (urlToken) {
                finish(urlToken, cookieStr)
                return
              }

              // Look for token in cookies
              for (const c of cookies) {
                if (
                  c.name === 'token' ||
                  c.name.toLowerCase().includes('token')
                ) {
                  finish(c.value, cookieStr)
                  return
                }
              }

              // Try extracting from page JS
              win.webContents
                .executeJavaScript(
                  'new URL(window.location.href).searchParams.get("token") || ""',
                )
                .then((jsToken: string) => {
                  finish(jsToken || 'logged-in', cookieStr)
                })
                .catch(() => finish('logged-in', cookieStr))
            })
            .catch(() => finish('logged-in', ''))
        }
      })

      // Handle window close (user cancelled)
      win.on('closed', () => {
        clearTimeout(timer)
        finish(null, '', '登录窗口已关闭')
      })

      win.loadURL(WX_MP_LOGIN_URL)
    })
  })
}
