import { useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNotificationStore } from '../../store/notification-store'
import { X, Check, Bell, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface NotificationPanelLayoutInput {
  viewportWidth: number
  viewportHeight: number
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function getNotificationCenterPanelLayout({
  viewportWidth,
  viewportHeight,
}: NotificationPanelLayoutInput): CSSProperties {
  return {
    width: Math.max(320, Math.min(680, viewportWidth - 32)),
    height: Math.max(360, Math.min(520, viewportHeight - 48)),
  }
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
    markAsUnread,
    markAllAsRead,
  } = useNotificationStore()

  useEffect(() => {
    if (isOpen) {
      void fetchNotifications({ limit: 20 })
    }
  }, [isOpen, fetchNotifications])

  if (!isOpen || typeof document === 'undefined') return null

  const panelStyle = getNotificationCenterPanelLayout({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  })

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

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-surface dark:bg-surface-dark-secondary flex flex-col overflow-hidden rounded-xl shadow-2xl"
          style={panelStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Bell size={18} />
              <h3 className="font-semibold">通知中心</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1.5 transition-colors"
              aria-label="关闭通知中心"
              title="关闭"
            >
              <X size={18} />
            </button>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center justify-between border-b px-5 py-2.5">
              <span className="text-text-secondary dark:text-text-dark-secondary text-xs">
                {notifications.length} 条通知
              </span>
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-accent hover:text-accent/80 text-sm transition-colors"
              >
                全部标记已读
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="text-text-secondary dark:text-text-dark-secondary flex h-full items-center justify-center text-sm">
                加载中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-text-secondary dark:text-text-dark-secondary flex h-full flex-col items-center justify-center">
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
                        ? 'opacity-70'
                        : 'bg-accent/5 hover:bg-accent/10'
                    } hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${getTypeColor(
                            notification.type,
                          )}`}
                        >
                          {getTypeLabel(notification.type)}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            notification.read
                              ? 'bg-surface-secondary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary'
                              : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {notification.read ? '已读' : '未读'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          notification.read
                            ? markAsUnread(notification.id)
                            : markAsRead(notification.id)
                        }
                        className="text-text-secondary hover:bg-surface-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-surface-dark-tertiary dark:hover:text-text-dark-primary flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors"
                        title={notification.read ? '标记未读' : '标记已读'}
                      >
                        {notification.read ? (
                          <Mail size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                        <span>
                          {notification.read ? '标记未读' : '标记已读'}
                        </span>
                      </button>
                    </div>
                    <h4 className="mb-1 font-medium">{notification.title}</h4>
                    <p className="text-text-secondary dark:text-text-dark-secondary mb-2 text-sm">
                      {notification.content}
                    </p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
                      {formatDistanceToNow(new Date(notification.createdAt), {
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
      </div>
    </>,
    document.body,
  )
}
