import Store from 'electron-store'
import type { CurrentUser } from './auth-service'

interface SessionData {
  token: string
  userId: string
  user: CurrentUser
  expiresAt: number
}

/**
 * Session 存储 - 使用 electron-store 安全存储 token
 */
export class SessionStore {
  private store: Store

  constructor() {
    this.store = new Store({
      name: 'livo-auth-session',
      // 加密存储（可选，生产环境建议启用）
      // encryptionKey: 'your-encryption-key',
    })
  }

  /**
   * 保存 session
   */
  saveSession(data: SessionData): void {
    this.store.set('session', data)
  }

  /**
   * 获取 session
   */
  getSession(): SessionData | null {
    const session = this.store.get('session') as SessionData | undefined
    return session ?? null
  }

  /**
   * 清除 session
   */
  clearSession(): void {
    this.store.delete('session')
  }

  /**
   * 检查 session 是否有效
   */
  isSessionValid(): boolean {
    const session = this.getSession()
    if (!session) return false

    // 检查是否过期
    if (Date.now() >= session.expiresAt) {
      this.clearSession()
      return false
    }

    return true
  }

  /**
   * 获取有效的 token
   */
  getValidToken(): string | null {
    if (!this.isSessionValid()) {
      return null
    }
    const session = this.getSession()
    return session?.token ?? null
  }

  /**
   * 获取当前用户
   */
  getCurrentUser(): CurrentUser | null {
    if (!this.isSessionValid()) {
      return null
    }
    const session = this.getSession()
    return session?.user ?? null
  }
}

export const sessionStore = new SessionStore()
