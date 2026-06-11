import { create } from 'zustand'

interface Notification {
  id: string
  userId: string
  type: 'system' | 'feature' | 'account' | 'account_banned' | 'account_unbanned'
  title: string
  content: string
  read: boolean
  readAt: string | number | null
  createdAt: string | number
}

interface NotificationsResponse {
  notifications: Notification[]
  total: number
  limit: number
  offset: number
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  isPolling: boolean

  fetchNotifications: (options?: {
    read?: boolean
    limit?: number
    offset?: number
  }) => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

let pollingInterval: NodeJS.Timeout | null = null

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  isPolling: false,

  fetchNotifications: async (options = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (options.read !== undefined) params.set('read', String(options.read))
      if (options.limit) params.set('limit', String(options.limit))
      if (options.offset) params.set('offset', String(options.offset))

      const data = (await window.api.notifications.list({
        unread: options.read === false ? true : undefined,
        limit: options.limit,
        offset: options.offset,
      })) as NotificationsResponse
      set({ notifications: data.notifications, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { count } = (await window.api.notifications.unreadCount()) as {
        count: number
      }
      set({ unreadCount: count })
    } catch (error) {
      // Silently fail for polling
      console.error('Failed to fetch unread count:', error)
    }
  },

  markAsRead: async (id: string) => {
    set({ error: null })
    try {
      await window.api.notifications.markRead(id)

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true, readAt: Date.now() } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  markAllAsRead: async () => {
    set({ error: null })
    try {
      await window.api.notifications.markAllRead()

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read: true,
          readAt: Date.now(),
        })),
        unreadCount: 0,
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  startPolling: () => {
    if (pollingInterval) return

    // Fetch immediately
    get().fetchUnreadCount()

    // Poll every 30 seconds
    pollingInterval = setInterval(() => {
      get().fetchUnreadCount()
    }, 30000)

    set({ isPolling: true })
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    set({ isPolling: false })
  },
}))
