import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { CurrentUser } from './auth-service'

export interface SessionData {
  token: string
  userId: string
  user: CurrentUser
  expiresAt: number
}

interface StoredSessionData {
  token?: string
  encryptedToken?: string
  tokenStorage?: 'safeStorage'
  userId: string
  user: CurrentUser
  expiresAt: number
}

/**
 * Session 存储 - keeps bearer tokens out of plaintext renderer/disk surfaces.
 */
export class SessionStore {
  private store: Store
  private memorySession: SessionData | null = null

  constructor() {
    this.store = new Store({
      name: 'livo-auth-session',
    })
  }

  private canEncryptToken(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  private encryptToken(token: string): string | null {
    if (!this.canEncryptToken()) return null
    try {
      return safeStorage.encryptString(token).toString('base64')
    } catch {
      return null
    }
  }

  private decryptToken(encryptedToken: string): string | null {
    try {
      return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
    } catch {
      return null
    }
  }

  private toStoredSession(data: SessionData): StoredSessionData {
    const encryptedToken = this.encryptToken(data.token)
    return {
      userId: data.userId,
      user: data.user,
      expiresAt: data.expiresAt,
      ...(encryptedToken
        ? { encryptedToken, tokenStorage: 'safeStorage' as const }
        : {}),
    }
  }

  /**
   * 保存 session
   */
  saveSession(data: SessionData): void {
    this.memorySession = data
    this.store.set('session', this.toStoredSession(data))
  }

  /**
   * 获取 session
   */
  getSession(): SessionData | null {
    const stored = this.store.get('session') as StoredSessionData | undefined
    if (!stored) return this.memorySession

    if (stored.encryptedToken) {
      const token = this.decryptToken(stored.encryptedToken)
      if (!token) {
        this.clearSession()
        return null
      }
      const session = {
        token,
        userId: stored.userId,
        user: stored.user,
        expiresAt: stored.expiresAt,
      }
      this.memorySession = session
      return session
    }

    if (stored.token) {
      const session = {
        token: stored.token,
        userId: stored.userId,
        user: stored.user,
        expiresAt: stored.expiresAt,
      }
      this.saveSession(session)
      return session
    }

    return this.memorySession
  }

  /**
   * 清除 session
   */
  clearSession(): void {
    this.memorySession = null
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
