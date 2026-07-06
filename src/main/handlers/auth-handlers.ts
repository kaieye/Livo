import { BrowserWindow } from 'electron'
import { authService, type CurrentUser } from '../services/auth/auth-service'
import { sessionStore } from '../services/auth/session-store'
import { getValidatedSession } from '../services/auth/session-validation'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { IPC } from '../../shared/ipc-contracts'
import { feedSyncService } from '../services/feed/feed-sync-service'
import { logError } from '../services/system/logger'
import { getBackendBaseUrl } from '../services/backend/backend-config'
import { isLoginWindowUrlAllowed } from '../services/auth/login-window-policy'

const AUTH_POPUP_ALLOWED_HOST_SUFFIXES: Record<'google' | 'wechat', string[]> =
  {
    google: ['accounts.google.com', 'google.com'],
    wechat: ['open.weixin.qq.com', 'weixin.qq.com', 'qq.com'],
  }

function originOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).origin
  } catch {
    return null
  }
}

export function isAuthPopupUrlAllowed(
  provider: 'google' | 'wechat',
  rawUrl: string,
): boolean {
  const origins = [originOf(getBackendBaseUrl())].filter(
    (origin): origin is string => Boolean(origin),
  )

  return isLoginWindowUrlAllowed(rawUrl, {
    allowedOrigins: origins,
    allowedHostSuffixes: AUTH_POPUP_ALLOWED_HOST_SUFFIXES[provider],
  })
}

/**
 * 创建一个用于 OAuth 登录/绑定的弹窗
 */
function createAuthPopup(
  url: string,
  title: string,
  provider: 'google' | 'wechat',
): BrowserWindow {
  if (!isAuthPopupUrlAllowed(provider, url)) {
    throw new Error('Blocked unsafe authentication URL')
  }

  const win = new BrowserWindow({
    width: 500,
    height: 650,
    title,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isAuthPopupUrlAllowed(provider, nextUrl)) {
      void win.loadURL(nextUrl).catch((err) => {
        logError('[auth] failed to load auth popup url', err)
      })
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, nextUrl) => {
    if (!isAuthPopupUrlAllowed(provider, nextUrl)) {
      event.preventDefault()
    }
  })

  win.loadURL(url).catch((err) => {
    logError('[auth] failed to load auth url', err)
  })

  return win
}

/**
 * 轮询登录状态直到完成、超时或被取消。
 * 当 signal 被 abort 时立即抛出取消错误，不再等待剩余轮询。
 */
async function pollUntilComplete(
  loginId: string,
  signal: AbortSignal,
  onProgress?: (status: string) => void,
): Promise<{ token: string; user: any }> {
  const maxAttempts = 60
  const intervalMs = 1000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal.aborted) {
      throw new Error('Login cancelled — window was closed')
    }

    try {
      const result = await authService.pollLoginStatus(loginId)

      if (result.status === 'completed' && result.token && result.user) {
        return { token: result.token, user: result.user }
      }

      if (result.status === 'expired') {
        throw new Error('Login session expired')
      }

      onProgress?.(
        `Waiting for authentication... (${attempt + 1}/${maxAttempts})`,
      )

      // 使用可中断的 delay，窗口关闭时立即退出
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error('Login cancelled — window was closed'))
          return
        }
        const onAbort = () => {
          clearTimeout(timer)
          reject(new Error('Login cancelled — window was closed'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }, intervalMs)
      })
    } catch (error) {
      if (signal.aborted) {
        throw new Error('Login cancelled — window was closed')
      }
      throw new Error(
        `Failed to poll login status: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  throw new Error('Login timeout - please try again')
}

function triggerFeedSyncAfterLogin(): void {
  setImmediate(() => {
    feedSyncService.syncNow().catch((error) => {
      logError('[auth-feed-sync-after-login-failed]', error)
    })
  })
}

function sendAuthProgress(status: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return
    win.webContents.send('auth:login-progress', { status })
  })
}

function saveLoginSession(token: string, user: CurrentUser): void {
  sessionStore.saveSession({
    token,
    userId: user.id,
    user,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  })
}

async function refreshStoredUser(token: string): Promise<CurrentUser> {
  const user = await authService.getCurrentUser(token)
  const session = sessionStore.getSession()

  if (!session) {
    throw new Error('Local session not found')
  }

  sessionStore.saveSession({
    ...session,
    userId: user.id,
    user,
  })

  return user
}

async function runOAuthLogin(
  provider: 'google' | 'wechat',
  getUrl: () => Promise<{ url: string; loginId: string }>,
  title: string,
): Promise<{ success: true; token: string; user: CurrentUser }> {
  const { url, loginId } = await getUrl()
  const authWindow = createAuthPopup(url, title, provider)
  const controller = new AbortController()

  // 用户手动关闭弹窗时立即取消轮询，不再等待服务端超时
  authWindow.on('closed', () => {
    controller.abort()
  })

  try {
    const { token, user } = await pollUntilComplete(
      loginId,
      controller.signal,
      (status) => {
        sendAuthProgress(status)
      },
    )

    // 登录成功 → 立刻关闭弹窗，再做后续保存
    if (!authWindow.isDestroyed()) {
      authWindow.close()
    }

    saveLoginSession(token, user)
    triggerFeedSyncAfterLogin()
    return { success: true, token, user }
  } catch (error) {
    if (!authWindow.isDestroyed()) {
      authWindow.close()
    }
    throw error
  }
}

async function bindProvider(
  provider: 'google' | 'wechat',
): Promise<{ success: true; user: CurrentUser }> {
  const validatedSession = await getValidatedSession()
  if (!validatedSession) {
    throw new Error('Please sign in before binding an account')
  }

  const { url, loginId } =
    provider === 'google'
      ? await authService.getGoogleBindUrl(validatedSession.token)
      : await authService.getWechatBindUrl(validatedSession.token)

  const authWindow = createAuthPopup(
    url,
    provider === 'google' ? 'Google 账号绑定' : '微信账号绑定',
    provider,
  )
  const controller = new AbortController()

  authWindow.on('closed', () => {
    controller.abort()
  })

  try {
    await pollUntilComplete(loginId, controller.signal, (status) => {
      sendAuthProgress(status)
    })
  } finally {
    if (!authWindow.isDestroyed()) {
      authWindow.close()
    }
  }

  const user = await refreshStoredUser(validatedSession.token)

  return { success: true, user }
}

/**
 * 注册认证相关的 IPC 处理器
 */
export function registerAuthHandlers(): void {
  // Google 登录
  registerChannel(IPC.AUTH_LOGIN_GOOGLE, async () => {
    try {
      return await runOAuthLogin(
        'google',
        () => authService.getGoogleLoginUrl(),
        'Google 登录',
      )
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // 微信登录
  registerChannel(IPC.AUTH_LOGIN_WECHAT, async () => {
    try {
      return await runOAuthLogin(
        'wechat',
        () => authService.getWechatLoginUrl(),
        '微信扫码登录',
      )
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // Google 绑定
  registerChannel(IPC.AUTH_BIND_GOOGLE, async () => {
    try {
      return await bindProvider('google')
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // 微信绑定
  registerChannel(IPC.AUTH_BIND_WECHAT, async () => {
    try {
      return await bindProvider('wechat')
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // 获取当前用户
  registerChannel(IPC.AUTH_GET_CURRENT_USER, async () => {
    try {
      const session = await getValidatedSession()
      if (!session) {
        return { success: true, user: null, token: null }
      }

      triggerFeedSyncAfterLogin()
      return { success: true, user: session.user, token: session.token }
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // 登出
  registerChannel(IPC.AUTH_LOGOUT, async () => {
    try {
      const session = sessionStore.getSession()

      if (session) {
        try {
          await authService.logout(session.token)
        } catch (error) {
          // 即使后端登出失败，也清除本地 session
          console.error('Logout API failed:', error)
        }
        sessionStore.clearSession()
      }

      return { success: true }
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // 检查登录状态
  registerChannel(IPC.AUTH_CHECK_SESSION, async () => {
    const session = await getValidatedSession()
    if (session) {
      triggerFeedSyncAfterLogin()
    }
    return {
      success: true,
      isValid: !!session,
      user: session?.user ?? null,
    }
  })
}
