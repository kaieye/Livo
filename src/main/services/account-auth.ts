import { app, BrowserWindow, session } from 'electron'
import type { AccountProvider, AccountSessionState } from '../../shared/types'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { readFileSync } from 'fs'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// Disable passkey/WebAuthn to avoid triggering Windows Security Center dialogs in login windows.
const preloadDir = join(app.getPath('temp'), 'livo')
if (!existsSync(preloadDir)) mkdirSync(preloadDir, { recursive: true })
const accountLoginPreloadPath = join(preloadDir, 'account-login-preload.js')
writeFileSync(
  accountLoginPreloadPath,
  `try {
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
} catch(e) {}`,
)

interface ProviderConfig {
  loginUrl: string
  title: string
  cookieDomains: string[]
  cookieDomainKeywords: string[]
  authCookieNames: string[]
  userAgent: 'mobile' | 'desktop'
  allowSafePopups?: boolean
  timeoutMs?: number
}

const PROVIDER_CONFIGS: Record<AccountProvider, ProviderConfig> = {
  youtube: {
    loginUrl:
      'https://accounts.google.com/ServiceLogin?continue=https://m.youtube.com/',
    title: 'Sign in to YouTube',
    cookieDomains: [
      '.youtube.com',
      '.google.com',
      '.accounts.google.com',
      'youtube.com',
      'accounts.google.com',
    ],
    cookieDomainKeywords: ['youtube.com', 'google.com'],
    authCookieNames: [
      'SID',
      'SSID',
      'HSID',
      'LSID',
      'SAPISID',
      'APISID',
      'SIDCC',
      'LOGIN_INFO',
      '__Secure-1PAPISID',
      '__Secure-1PSID',
      '__Secure-3PSID',
      '__Secure-1PSIDTS',
      '__Secure-3PSIDTS',
      '__Secure-1PSIDCC',
      '__Secure-3PSIDCC',
    ],
    userAgent: 'mobile',
    allowSafePopups: false,
    timeoutMs: 240000,
  },
  x: {
    loginUrl: 'https://x.com/i/flow/login',
    title: 'Sign in to X',
    cookieDomains: ['.x.com', '.twitter.com', 'x.com', 'twitter.com'],
    cookieDomainKeywords: ['x.com', 'twitter.com'],
    authCookieNames: ['auth_token', 'twid', 'ct0'],
    userAgent: 'desktop',
    allowSafePopups: true,
    timeoutMs: 240000,
  },
  instagram: {
    loginUrl: 'https://www.instagram.com/accounts/login/',
    title: 'Sign in to Instagram',
    cookieDomains: ['.instagram.com', 'instagram.com'],
    cookieDomainKeywords: ['instagram.com'],
    authCookieNames: ['sessionid', 'ds_user_id'],
    userAgent: 'mobile',
  },
  bilibili: {
    loginUrl: 'https://passport.bilibili.com/login',
    title: 'Sign in to Bilibili',
    cookieDomains: ['.bilibili.com', 'bilibili.com', '.passport.bilibili.com'],
    cookieDomainKeywords: ['bilibili.com'],
    authCookieNames: ['SESSDATA', 'DedeUserID', 'bili_jct'],
    userAgent: 'desktop',
    timeoutMs: 240000,
  },
}

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

const runtimeAccountNames = new Map<AccountProvider, string>()
const accountNameFile = join(
  app.getPath('userData'),
  'account-display-names.json',
)

function loadSavedAccountNames(): Partial<Record<AccountProvider, string>> {
  try {
    if (!existsSync(accountNameFile)) return {}
    const raw = readFileSync(accountNameFile, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Record<AccountProvider, string>>
    return parsed ?? {}
  } catch {
    return {}
  }
}

function saveAccountNames(
  data: Partial<Record<AccountProvider, string>>,
): void {
  try {
    writeFileSync(accountNameFile, JSON.stringify(data), 'utf-8')
  } catch {
    // ignore
  }
}

function sanitizeName(raw: string | undefined | null): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (value.length > 80) return null
  return value
}

async function fetchTextWithSession(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await session.defaultSession.fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function extractByRegex(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const parsed = sanitizeName(match[1])
      if (parsed) return parsed
    }
  }
  return null
}

interface BilibiliNavResponse {
  code?: number
  message?: string
  data?: {
    isLogin?: boolean
    uname?: string
  }
}

async function fetchBilibiliNavState(): Promise<{
  loggedIn: boolean
  displayName: string | null
}> {
  try {
    const response = await session.defaultSession.fetch(
      'https://api.bilibili.com/x/web-interface/nav',
      {
        method: 'GET',
        headers: {
          Referer: 'https://www.bilibili.com/',
          'User-Agent': DESKTOP_UA,
        },
      },
    )
    if (!response.ok) return { loggedIn: false, displayName: null }
    const data = (await response.json()) as BilibiliNavResponse
    const loggedIn = data?.code === 0 && data?.data?.isLogin === true
    return {
      loggedIn,
      displayName: loggedIn ? sanitizeName(data?.data?.uname) : null,
    }
  } catch {
    return { loggedIn: false, displayName: null }
  }
}

async function tryResolveDisplayName(
  provider: AccountProvider,
): Promise<string | null> {
  // Bilibili has a stable auth-check API that returns current username.
  if (provider === 'bilibili') {
    const nav = await fetchBilibiliNavState()
    return nav.loggedIn ? nav.displayName : null
  }

  if (provider === 'instagram') {
    const html = await fetchTextWithSession(
      'https://www.instagram.com/accounts/edit/',
    )
    if (!html) return null
    return extractByRegex(html, [
      /"username":"([^"]+)"/,
      /name="username"\s+value="([^"]+)"/,
    ])
  }

  if (provider === 'x') {
    const html = await fetchTextWithSession('https://x.com/settings/account')
    if (!html) return null
    return extractByRegex(html, [
      /"screen_name":"([^"]+)"/,
      /"screenName":"([^"]+)"/,
      /https:\/\/x\.com\/([^"\\/]+)"/,
    ])
  }

  if (provider === 'youtube') {
    const html1 = await fetchTextWithSession('https://www.youtube.com/account')
    if (html1) {
      const handle = extractByRegex(html1, [/"channelHandle":"(@[^"]+)"/])
      if (handle) return handle
      const fromAccount = extractByRegex(html1, [
        /"accountName":"([^"]+)"/,
        /"channelName":"([^"]+)"/,
      ])
      if (fromAccount) return fromAccount
    }
    const html2 = await fetchTextWithSession('https://www.youtube.com')
    if (html2) {
      const handle = extractByRegex(html2, [/"channelHandle":"(@[^"]+)"/])
      if (handle) return handle
      return extractByRegex(html2, [
        /"accountName":"([^"]+)"/,
        /"channelName":"([^"]+)"/,
      ])
    }
    const google1 = await fetchTextWithSession('https://myaccount.google.com/')
    if (google1) {
      const fromGoogle = extractByRegex(google1, [
        /"displayName":"([^"]+)"/,
        /"givenName":"([^"]+)"/,
        /"fullName":"([^"]+)"/,
      ])
      if (fromGoogle) return fromGoogle
    }
    const google2 = await fetchTextWithSession(
      'https://myaccount.google.com/personal-info',
    )
    if (google2) {
      return extractByRegex(google2, [
        /"displayName":"([^"]+)"/,
        /"givenName":"([^"]+)"/,
        /"fullName":"([^"]+)"/,
      ])
    }
  }

  return null
}

async function hasProviderAuthCookie(
  provider: AccountProvider,
): Promise<boolean> {
  const config = PROVIDER_CONFIGS[provider]
  try {
    const allCookies = await session.defaultSession.cookies.get({})
    return allCookies.some((cookie) => {
      const domain = (cookie.domain || '').replace(/^\./, '').toLowerCase()
      const domainMatched = config.cookieDomainKeywords.some((kw) =>
        domain.endsWith(kw),
      )
      if (!domainMatched) return false
      return config.authCookieNames.includes(cookie.name)
    })
  } catch {
    return false
  }
}

export async function getAccountState(
  provider: AccountProvider,
): Promise<AccountSessionState> {
  if (provider === 'bilibili') {
    const nav = await fetchBilibiliNavState()
    if (!nav.loggedIn) {
      return {
        provider,
        linked: false,
        displayName: null,
        error:
          'Bilibili login session not detected. Please relink your account.',
      }
    }
    return {
      provider,
      linked: true,
      displayName: nav.displayName,
    }
  }

  const config = PROVIDER_CONFIGS[provider]
  try {
    const hasCookieByGlobalScan = await hasProviderAuthCookie(provider)
    const savedNames = loadSavedAccountNames()
    for (const domain of config.cookieDomains) {
      const cookies = await session.defaultSession.cookies.get({ domain })
      const hasAuth = cookies.some((c) =>
        config.authCookieNames.includes(c.name),
      )
      if (hasAuth || hasCookieByGlobalScan) {
        const displayName =
          (await tryResolveDisplayName(provider)) ??
          runtimeAccountNames.get(provider) ??
          sanitizeName(savedNames[provider]) ??
          null
        if (!displayName) {
          return {
            provider,
            linked: false,
            displayName: null,
            error:
              'Found login session cookies, but failed to resolve account name. Please set it manually.',
          }
        }
        return {
          provider,
          linked: true, // Success criterion includes valid account name resolution.
          displayName,
        }
      }
    }
  } catch {
    // fall through
  }
  return { provider, linked: false, displayName: null }
}

export async function setManualAccountDisplayName(
  provider: AccountProvider,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const parsed = sanitizeName(name)
  if (!parsed) {
    return { success: false, error: 'Invalid account name' }
  }
  runtimeAccountNames.set(provider, parsed)
  const saved = loadSavedAccountNames()
  saved[provider] = parsed
  saveAccountNames(saved)
  return { success: true }
}

export async function linkAccount(
  provider: AccountProvider,
): Promise<{ success: boolean; error?: string }> {
  const config = PROVIDER_CONFIGS[provider]

  return new Promise((resolve) => {
    let hadNavigation = false
    let failedToOpen = false
    let settled = false

    const finish = (result: { success: boolean; error?: string }) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let loginWin: BrowserWindow
    try {
      loginWin = new BrowserWindow({
        width: 420,
        height: 760,
        title: config.title,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          // Must be false so preload can patch page globals before scripts execute.
          contextIsolation: false,
          sandbox: false,
          preload: accountLoginPreloadPath,
        },
      })
    } catch (err) {
      finish({
        success: false,
        error: `Failed to create login window: ${String(err)}`,
      })
      return
    }

    try {
      loginWin.webContents.setUserAgent(
        config.userAgent === 'desktop' ? DESKTOP_UA : MOBILE_UA,
      )
    } catch {
      // ignore
    }

    loginWin.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeHttpUrl(url)) {
        if (config.allowSafePopups) {
          return { action: 'allow' }
        }
        void loginWin.loadURL(url).catch(() => {})
      }
      return { action: 'deny' }
    })

    loginWin.webContents.on('will-navigate', (event, url) => {
      if (!isSafeHttpUrl(url)) {
        event.preventDefault()
      }
    })

    loginWin.webContents.on('render-process-gone', () => {
      finish({
        success: false,
        error: 'Login window renderer crashed. Please retry.',
      })
      if (!loginWin.isDestroyed()) loginWin.close()
    })

    const tryCaptureNameFromPage = async () => {
      try {
        const name = await loginWin.webContents.executeJavaScript(
          `(() => {
            const read = (v) => (typeof v === 'string' ? v.trim() : '');
            const direct = [
              document.querySelector('yt-formatted-string#account-name')?.textContent,
              document.querySelector('button#avatar-btn')?.getAttribute('aria-label'),
              document.querySelector('img#img')?.getAttribute('alt'),
              document.querySelector('meta[itemprop="name"]')?.getAttribute('content')
            ].map(read).find(Boolean);
            if (direct) return direct.replace(/^Google Account[:\\s]*/i, '').trim();
            const text = document.documentElement?.innerHTML || '';
            const m = text.match(/"channelHandle":"(@[^"]+)"/) || text.match(/"accountName":"([^"]+)"/) || text.match(/"channelName":"([^"]+)"/);
            return m && m[1] ? String(m[1]).trim() : '';
          })()`,
          true,
        )
        const parsed = sanitizeName(typeof name === 'string' ? name : null)
        if (parsed) {
          runtimeAccountNames.set(provider, parsed)
        }
      } catch {
        // Ignore page extraction failures.
      }
    }

    loginWin.webContents.on('did-navigate', () => {
      hadNavigation = true
      void tryCaptureNameFromPage()
    })
    loginWin.webContents.on('did-redirect-navigation', () => {
      hadNavigation = true
      void tryCaptureNameFromPage()
    })
    loginWin.webContents.on('did-frame-navigate', () => {
      hadNavigation = true
      void tryCaptureNameFromPage()
    })
    loginWin.webContents.on('did-stop-loading', () => {
      void tryCaptureNameFromPage()
    })

    loginWin.webContents.on(
      'did-fail-load',
      (_event, errorCode, _errorDescription, validatedURL) => {
        // Ignore common transient cancellations during redirects.
        if (errorCode === -3) return
        // Some providers intentionally navigate to about:blank in intermediary steps.
        if (validatedURL?.startsWith('about:blank')) return
        failedToOpen = true
      },
    )

    const timer = setTimeout(() => {
      finish({ success: false, error: 'Login timed out. Please retry.' })
      if (!loginWin.isDestroyed()) loginWin.close()
    }, config.timeoutMs ?? 120000)

    const cookiePoll = setInterval(async () => {
      if (settled) return
      const hasAuth =
        provider === 'bilibili'
          ? (await fetchBilibiliNavState()).loggedIn
          : await hasProviderAuthCookie(provider)
      if (!hasAuth) return
      // Try to grab name from current page before finishing.
      await tryCaptureNameFromPage()
      finish({ success: true })
      if (!loginWin.isDestroyed()) loginWin.close()
    }, 2000)

    loginWin.loadURL(config.loginUrl).catch((err) => {
      failedToOpen = true
      finish({
        success: false,
        error: `Failed to open login page: ${String(err)}`,
      })
      if (!loginWin.isDestroyed()) loginWin.close()
    })

    loginWin.on('closed', async () => {
      clearTimeout(timer)
      clearInterval(cookiePoll)
      if (failedToOpen) {
        finish({ success: false, error: 'Login window failed to open' })
        return
      }
      const state = await getAccountState(provider)
      if (state.linked) {
        finish({ success: true })
        return
      }
      if (!hadNavigation) {
        finish({
          success: false,
          error:
            'Login window did not navigate successfully; check your network and retry',
        })
        return
      }
      finish({
        success: false,
        error:
          'No login session detected. Complete login before closing the window.',
      })
    })
  })
}

export async function unlinkAccount(
  provider: AccountProvider,
): Promise<{ success: boolean; error?: string }> {
  const config = PROVIDER_CONFIGS[provider]
  try {
    for (const domain of config.cookieDomains) {
      const cookies = await session.defaultSession.cookies.get({ domain })
      for (const cookie of cookies) {
        const cookieDomain =
          cookie.domain?.replace(/^\./, '') || domain.replace(/^\./, '')
        const cookiePath = cookie.path || '/'
        const url = `http${cookie.secure ? 's' : ''}://${cookieDomain}${cookiePath}`
        await session.defaultSession.cookies.remove(url, cookie.name)
      }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
