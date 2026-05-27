import { memo } from 'react'
import { FileText, MessageCircle, Play, Image as ImageIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FeedViewType } from '../../../../shared/types'

interface SubscriptionsModeRailProps {
  activeView: FeedViewType | null
  viewCounts: Map<FeedViewType, number>
  onChange: (view: FeedViewType | null) => void
}

interface ModeDescriptor {
  view: FeedViewType
  label: string
  icon: LucideIcon
}

const MODES: ModeDescriptor[] = [
  { view: FeedViewType.Articles, label: '文章', icon: FileText },
  { view: FeedViewType.SocialMedia, label: '社交', icon: MessageCircle },
  { view: FeedViewType.Videos, label: '视频', icon: Play },
  { view: FeedViewType.Pictures, label: '图片', icon: ImageIcon },
]

/**
 * Top mode rail for the SubscriptionsPage. Mirrors the Harmony-side
 * SubscriptionsModeRail by exposing Articles / Social / Videos / Pictures
 * filters. Tapping the active mode again clears the filter (parity with the
 * existing feed-store toggle behaviour).
 */
export const SubscriptionsModeRail = memo(function SubscriptionsModeRail({
  activeView,
  viewCounts,
  onChange,
}: SubscriptionsModeRailProps) {
  return (
    <nav
      className="flex flex-shrink-0 gap-1 border-b border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] px-6 py-3"
      aria-label="订阅模式切换"
    >
      {MODES.map(({ view, label, icon: Icon }) => {
        const isActive = activeView === view
        const count = viewCounts.get(view) ?? 0
        return (
          <button
            key={view}
            type="button"
            onClick={() => onChange(isActive ? null : view)}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            <Icon size={14} className="flex-shrink-0" />
            <span>{label}</span>
            {count > 0 && (
              <span
                className={[
                  'ml-0.5 min-w-[1.25rem] rounded px-1 text-center text-xs tabular-nums',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]',
                ].join(' ')}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
})
