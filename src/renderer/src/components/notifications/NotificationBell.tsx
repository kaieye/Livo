import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '../../store/notification-store'
import { NotificationCenter } from './NotificationCenter'

export function NotificationBell() {
  const { unreadCount, startPolling, stopPolling } = useNotificationStore()
  const [isOpen, setIsOpen] = useState(false)

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
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary relative rounded-lg p-2 transition-colors"
        title="通知"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="bg-accent text-accent-foreground absolute right-0 top-0 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
