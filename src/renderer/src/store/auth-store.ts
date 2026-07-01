import { create } from 'zustand'

export interface AuthIdentity {
  provider: string
  providerEmail: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface AuthUser {
  id: string
  displayName: string
  avatarUrl: string | null
  role: string
  status: string
  createdAt: string
  providers?: string[]
  identities?: AuthIdentity[]
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  /** 应用启动后是否已完成一次本地 Session 检查（避免登录弹窗闪烁） */
  isSessionChecked: boolean
  isLoading: boolean
  error: string | null
  setUser: (user: AuthUser | null, token?: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  bindGoogle: () => Promise<void>
  bindWechat: () => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

type BindProvider = 'google' | 'wechat'

async function bindProvider(provider: BindProvider): Promise<AuthUser> {
  const result =
    provider === 'google'
      ? await window.api.auth.bindGoogle()
      : await window.api.auth.bindWechat()

  if (result.success && result.user) {
    return result.user
  }

  throw new Error(result.error || 'Account binding failed')
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isSessionChecked: false,
  isLoading: false,
  error: null,

  setUser: (user, token = null) => {
    const wasAuthenticated = useAuthStore.getState().isAuthenticated
    set({
      user,
      token: token ?? null,
      isAuthenticated: !!user,
      error: null,
    })
    // Trigger subscription cloud sync on login
    if (user && !wasAuthenticated) {
      window.api.feeds.syncNow().catch(() => {
        // Silently ignore — cloud sync is best-effort
      })
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  bindGoogle: async () => {
    try {
      set({ isLoading: true, error: null })
      const user = await bindProvider('google')
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google binding failed'
      set({
        error: message,
        isLoading: false,
      })
      throw new Error(message)
    }
  },

  bindWechat: async () => {
    try {
      set({ isLoading: true, error: null })
      const user = await bindProvider('wechat')
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Wechat binding failed'
      set({
        error: message,
        isLoading: false,
      })
      throw new Error(message)
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null })
      await window.api.auth.logout()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
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
