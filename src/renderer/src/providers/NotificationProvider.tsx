import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import { useNotificationStore } from '../store/notification-store'

export function NotificationProvider() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      void window.api.websocket.disconnect().catch(() => {})
      useNotificationStore.getState().stopPolling()
      return
    }

    void window.api.websocket.connect(user.id).catch(() => {})
    useNotificationStore.getState().startPolling()

    const offNotification = window.api.on('ws:notification', (payload) => {
      void useNotificationStore.getState().fetchUnreadCount()
      void useNotificationStore.getState().fetchNotifications({ limit: 20 })

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.message })
      }
    })

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {})
    }

    return () => {
      offNotification()
      useNotificationStore.getState().stopPolling()
      void window.api.websocket.disconnect().catch(() => {})
    }
  }, [isAuthenticated, user?.id])

  return null
}
