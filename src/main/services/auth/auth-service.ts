import { session } from 'electron'
import { getBackendBaseUrl } from '../backend/backend-config'

export interface LoginResponse {
  url: string
  loginId: string
  state: string
}

export interface PollResponse {
  status: 'pending' | 'completed' | 'expired'
  token?: string
  user?: {
    id: string
    displayName: string
    avatarUrl: string | null
    role: string
    status: string
    createdAt: string
  }
}

export interface CurrentUser {
  id: string
  displayName: string
  avatarUrl: string | null
  role: string
  status: string
  createdAt: string
}

/**
 * 认证服务 - 与后端 NestJS API 通信
 */
export class AuthService {
  private baseUrl: string

  constructor(baseUrl: string = getBackendBaseUrl()) {
    this.baseUrl = baseUrl
  }

  /**
   * 获取 Google OAuth URL
   */
  async getGoogleLoginUrl(): Promise<LoginResponse> {
    const response = await session.defaultSession.fetch(
      `${this.baseUrl}/auth/google/login?client=desktop`,
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Failed to get Google login URL: ${response.status}${text ? ` ${text}` : ''}`,
      )
    }

    return (await response.json()) as LoginResponse
  }

  /**
   * 获取微信 OAuth URL
   */
  async getWechatLoginUrl(): Promise<LoginResponse> {
    const response = await session.defaultSession.fetch(
      `${this.baseUrl}/auth/wechat/login?client=desktop`,
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Failed to get Wechat login URL: ${response.status}${text ? ` ${text}` : ''}`,
      )
    }

    return (await response.json()) as LoginResponse
  }

  /**
   * 轮询登录状态
   */
  async pollLoginStatus(loginId: string): Promise<PollResponse> {
    const response = await session.defaultSession.fetch(
      `${this.baseUrl}/auth/desktop/poll?loginId=${encodeURIComponent(loginId)}`,
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Failed to poll login status: ${response.status}${text ? ` ${text}` : ''}`,
      )
    }

    return (await response.json()) as PollResponse
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(token: string): Promise<CurrentUser> {
    const response = await session.defaultSession.fetch(
      `${this.baseUrl}/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Failed to get user info: ${response.status}${text ? ` ${text}` : ''}`,
      )
    }

    return (await response.json()) as CurrentUser
  }

  /**
   * 登出
   */
  async logout(token: string): Promise<void> {
    const response = await session.defaultSession.fetch(
      `${this.baseUrl}/auth/logout`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Failed to logout: ${response.status}${text ? ` ${text}` : ''}`,
      )
    }
  }
}

export const authService = new AuthService()
