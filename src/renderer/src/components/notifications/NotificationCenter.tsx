import { useEffect } from 'react'
import { useNotificationStore } from '../../store/notification-store'
import { X, Check, Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({
  isOpen,
  onClose,
}: NotificationCenterProps) {
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()

  useEffect(() => {
    if (isOpen) {
      void fetchNotifications({ limit: 20 })
    }
  }, [isOpen, fetchNotifications])

  if (!isOpen) return null

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'feature':
        return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'account':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      default:
        return 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'system':
        return '系统'
      case 'feature':
        return '功能'
      case 'account':
        return '账户'
      default:
        return type
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="bg-surface dark:bg-surface-dark fixed right-4 top-16 z-50 flex h-[600px] w-[400px] flex-col rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell size={18} />
            <h3 className="font-semibold">通知中心</h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1.5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="border-b px-4 py-2">
            <button
              onClick={() => markAllAsRead()}
              className="text-accent hover:text-accent/80 text-sm transition-colors"
            >
              全部标记已读
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="text-text-secondary dark:text-text-dark-secondary flex items-center justify-center py-12 text-sm">
              加载中...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-text-secondary dark:text-text-dark-secondary flex flex-col items-center justify-center py-12">
              <Bell size={48} className="mb-2 opacity-20" />
              <p className="text-sm">暂无通知</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 transition-colors ${
                    notification.read
                      ? 'opacity-60'
                      : 'bg-accent/5 hover:bg-accent/10'
                  } hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${getTypeColor(
                        notification.type,
                      )}`}
                    >
                      {getTypeLabel(notification.type)}
                    </span>
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-accent hover:text-accent/80 text-xs transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                  <h4 className="mb-1 font-medium">{notification.title}</h4>
                  <p className="text-text-secondary dark:text-text-dark-secondary mb-2 text-sm">
                    {notification.content}
                  </p>
                  <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
