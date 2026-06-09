import { shell, BrowserWindow } from 'electron'
import { authService } from '../services/auth/auth-service'
import { sessionStore } from '../services/auth/session-store'
import { getValidatedSession } from '../services/auth/session-validation'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { IPC } from '../../shared/ipc-contracts'
import { feedSyncService } from '../services/feed/feed-sync-service'
import { logError } from '../services/system/logger'

/**
 * 轮询登录状态直到完成或超时
 */
async function pollUntilComplete(
  loginId: string,
  onProgress?: (status: string) => void,
): Promise<{ token: string; user: any }> {
  const maxAttempts = 60 // 最多轮询 60 次
  const intervalMs = 2000 // 每 2 秒轮询一次

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await authService.pollLoginStatus(loginId)

      if (result.status === 'completed' && result.token && result.user) {
        return { token: result.token, user: result.user }
      }

      if (result.status === 'expired') {
        throw new Error('Login session expired')
      }

      // 通知进度
      onProgress?.(
        `Waiting for authentication... (${attempt + 1}/${maxAttempts})`,
      )

      // 等待后继续轮询
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    } catch (error) {
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

/**
 * 注册认证相关的 IPC 处理器
 */
export function registerAuthHandlers(): void {
  // Google 登录
  registerChannel(IPC.AUTH_LOGIN_GOOGLE, async () => {
    try {
      // 1. 获取登录 URL 和 loginId
      const { url, loginId } = await authService.getGoogleLoginUrl()

      // 2. 打开系统浏览器
      await shell.openExternal(url)

      // 3. 轮询登录状态
      const { token, user } = await pollUntilComplete(loginId, (status) => {
        // 可以通过 IPC 发送进度更新到渲染进程
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('auth:login-progress', { status })
        })
      })

      // 4. 保存 session（30 天有效期）
      sessionStore.saveSession({
        token,
        userId: user.id,
        user,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      })
      triggerFeedSyncAfterLogin()

      return { success: true, token, user }
    } catch (error) {
      return toHandlerError(error)
    }
  })

  // 微信登录
  registerChannel(IPC.AUTH_LOGIN_WECHAT, async () => {
    try {
      // 1. 获取登录 URL 和 loginId
      const { url, loginId } = await authService.getWechatLoginUrl()

      // 2. 打开系统浏览器
      await shell.openExternal(url)

      // 3. 轮询登录状态
      const { token, user } = await pollUntilComplete(loginId, (status) => {
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('auth:login-progress', { status })
        })
      })

      // 4. 保存 session
      sessionStore.saveSession({
        token,
        userId: user.id,
        user,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      })
      triggerFeedSyncAfterLogin()

      return { success: true, token, user }
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
