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
  isLoading: boolean
  error: string | null
  setUser: (user: AuthUser | null, token?: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
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
        })
      } else {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      }
    } catch (error) {
      console.error('Failed to check session:', error)
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      })
    }
  },
}))
