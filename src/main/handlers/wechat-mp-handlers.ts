import { BrowserWindow } from 'electron'
import { registerChannel } from '../ipc/register-channel'
import { IPC } from '../../shared/ipc-contracts'
import { getBackendBaseUrl } from '../services/backend/backend-config'

const WX_MP_ORIGIN = 'https://mp.weixin.qq.com'
const WX_MP_LOGIN_URL = `${WX_MP_ORIGIN}/`
const LOGIN_TIMEOUT_MS = 180_000 // 3 minutes
const AUTHENTICATED_PATHS = new Set([
  '/cgi-bin/home',
  '/cgi-bin/appmsg',
  '/cgi-bin/appmsgpublish',
])

export function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const token =
      parsed.searchParams.get('token') ||
      new URLSearchParams(parsed.hash.replace(/^#/, '')).get('token')
    if (token) return token
  } catch {
    // Not a valid URL
  }
  return null
}

export function isWechatMpAuthenticatedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.origin !== WX_MP_ORIGIN) return false
    if (extractTokenFromUrl(url)) return true
    return AUTHENTICATED_PATHS.has(parsed.pathname)
  } catch {
    return false
  }
}

export function extractTokenFromCookies(
  cookies: Electron.Cookie[],
): string | null {
  const exact = cookies.find((c) => c.name === 'token')
  if (exact?.value) return exact.value
  const tokenLike = cookies.find((c) => c.name.toLowerCase().includes('token'))
  return tokenLike?.value || null
}

export function buildCookieString(cookies: Electron.Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

export function getWechatMpCookieLookupUrls(currentUrl: string): string[] {
  const urls = new Set<string>([WX_MP_LOGIN_URL])
  try {
    const parsed = new URL(currentUrl)
    if (parsed.origin === WX_MP_ORIGIN) {
      urls.add(parsed.toString())
    }
  } catch {
    // Ignore malformed URLs.
  }
  return Array.from(urls)
}

async function getWechatMpCookies(
  session: Electron.Session,
  currentUrl: string,
): Promise<Electron.Cookie[]> {
  const allCookies = await Promise.all(
    getWechatMpCookieLookupUrls(currentUrl).map((url) =>
      session.cookies.get({ url }).catch(() => []),
    ),
  )
  const byIdentity = new Map<string, Electron.Cookie>()
  for (const cookie of allCookies.flat()) {
    const key = `${cookie.domain || ''}\n${cookie.path || ''}\n${cookie.name}`
    byIdentity.set(key, cookie)
  }
  return Array.from(byIdentity.values())
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

      const finishFromAuthenticatedUrl = async (url: string) => {
        if (!isWechatMpAuthenticatedUrl(url)) return
        clearTimeout(timer)

        const cookies = await getWechatMpCookies(win.webContents.session, url)
        const cookieStr = buildCookieString(cookies)
        const tokenFromUrl = extractTokenFromUrl(url)
        if (tokenFromUrl) {
          await finish(tokenFromUrl, cookieStr)
          return
        }

        const tokenFromCookies = extractTokenFromCookies(cookies)
        if (tokenFromCookies) {
          await finish(tokenFromCookies, cookieStr)
          return
        }

        try {
          const jsToken = await win.webContents.executeJavaScript(
            'new URL(window.location.href).searchParams.get("token") || new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || ""',
          )
          await finish(jsToken || 'logged-in', cookieStr)
        } catch {
          await finish('logged-in', cookieStr)
        }
      }

      const maybeFinishLogin = (url: string) => {
        void finishFromAuthenticatedUrl(url).catch(() => {
          void finish(null, '', '登录凭证读取失败')
        })
      }

      // Monitor page navigation for login success
      win.webContents.on('did-navigate', (_event, url) => {
        maybeFinishLogin(url)
      })

      win.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
        if (isMainFrame) maybeFinishLogin(url)
      })

      win.webContents.on('did-finish-load', () => {
        maybeFinishLogin(win.webContents.getURL())
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
