import { create } from 'zustand'

export interface AuthUser {
  id: string
  displayName: string
  avatarUrl: string | null
  role: string
  status: string
  createdAt: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  /** 应用启动后是否已完成一次本地 Session 检查（避免登录弹窗闪烁） */
  isSessionChecked: boolean
  /** 用户本次会话中选择了"稍后再说"，不再弹出登录框 */
  isLoginPromptDismissed: boolean
  isLoading: boolean
  error: string | null
  setUser: (user: AuthUser | null, token?: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  dismissLoginPrompt: () => void
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isSessionChecked: false,
  isLoginPromptDismissed: false,
  isLoading: false,
  error: null,

  setUser: (user, token = null) =>
    set({
      user,
      token: token ?? null,
      isAuthenticated: !!user,
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  dismissLoginPrompt: () => set({ isLoginPromptDismissed: true }),

  logout: async () => {
    try {
      set({ isLoading: true, error: null })
      await window.api.auth.logout()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        // 主动登出后不立即再弹登录框，避免打断
        isLoginPromptDismissed: true,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Logout failed',
        isLoading: false,
      })
    }
  },

  checkSession: async () => {
    try {
      const result = await window.api.auth.checkSession()
      if (result.success && result.isValid && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isSessionChecked: true,
        })
      } else {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isSessionChecked: true,
        })
      }
    } catch (error) {
      console.error('Failed to check session:', error)
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isSessionChecked: true,
      })
    }
  },
}))
