import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '../../store/notification-store'
import { NotificationCenter } from './NotificationCenter'

interface NotificationBellProps {
  className?: string
  iconSize?: number
}

export function NotificationBell({
  className,
  iconSize = 20,
}: NotificationBellProps) {
  const { unreadCount, startPolling, stopPolling } = useNotificationStore()
  const [isOpen, setIsOpen] = useState(false)
  const buttonClassName =
    className ??
    'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-2 transition-colors'

  useEffect(() => {
    // Start polling when component mounts
    startPolling()

    // Stop polling when component unmounts
    return () => {
      stopPolling()
    }
  }, [startPolling, stopPolling])

  return (
    <>
      <button
        type="button"
        aria-label="通知"
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName}
        title="通知"
      >
        <span className="relative flex h-[22px] w-[22px] items-center justify-center">
          <Bell size={iconSize} />
          {unreadCount > 0 && (
            <span className="bg-accent text-accent-foreground absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
