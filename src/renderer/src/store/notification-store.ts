import { create } from 'zustand';

interface Notification {
  id: string;
  user_id: string;
  type: 'system' | 'feature' | 'account';
  title: string;
  content: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isPolling: boolean;

  fetchNotifications: (options?: { read?: boolean; limit?: number; offset?: number }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollingInterval: NodeJS.Timeout | null = null;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  isPolling: false,

  fetchNotifications: async (options = {}) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (options.read !== undefined) params.set('read', String(options.read));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.offset) params.set('offset', String(options.offset));

      const url = `/api/notifications${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      set({ notifications: data.notifications, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const { count } = await response.json();
      set({ unreadCount: count });
    } catch (error) {
      // Silently fail for polling
      console.error('Failed to fetch unread count:', error);
    }
  },

  markAsRead: async (id: string) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  markAllAsRead: async () => {
    set({ error: null });
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read: true,
          read_at: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  startPolling: () => {
    if (pollingInterval) return;

    // Fetch immediately
    get().fetchUnreadCount();

    // Poll every 30 seconds
    pollingInterval = setInterval(() => {
      get().fetchUnreadCount();
    }, 30000);

    set({ isPolling: true });
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    set({ isPolling: false });
  },
}));
