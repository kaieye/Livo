import { memo } from 'react'
import {
  LayoutGrid,
  FileText,
  MessageCircle,
  Play,
  Image as ImageIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FeedViewType } from '../../../../shared/types'

interface ContentModeRailProps {
  /** Currently active view, or null for the "All" scope. */
  activeView: FeedViewType | null
  /** Currently selected feed id (used to suppress "All" highlight on starred/feed scopes). */
  selectedFeedId: string | null
  /** Unread counts keyed by view type. */
  unreadByView: Map<FeedViewType, number>
  /** Total unread across all user feeds (for the "All" chip). */
  totalUnread: number
  onChange: (view: FeedViewType | null) => void
}

interface ModeDescriptor {
  /** null represents the "All" scope. */
  view: FeedViewType | null
  labelKey: string
  icon: LucideIcon
}

const MODES: ModeDescriptor[] = [
  { view: null, labelKey: 'entryList.all', icon: LayoutGrid },
  {
    view: FeedViewType.Articles,
    labelKey: 'viewTypes.articles',
    icon: FileText,
  },
  {
    view: FeedViewType.SocialMedia,
    labelKey: 'viewTypes.socialMedia',
    icon: MessageCircle,
  },
  { view: FeedViewType.Videos, labelKey: 'viewTypes.videos', icon: Play },
  {
    view: FeedViewType.Pictures,
    labelKey: 'viewTypes.pictures',
    icon: ImageIcon,
  },
]

/**
 * Home content mode quick-switch rail. Mirrors the Harmony ContentModeRail by
 * exposing Articles / Social / Videos / Pictures (plus an "All" scope that is
 * specific to the desktop home model). Selecting a mode drives the shared
 * `feed-store` activeView, replacing the need to dig through the sidebar.
 */
export const ContentModeRail = memo(function ContentModeRail({
  activeView,
  selectedFeedId,
  unreadByView,
  totalUnread,
  onChange,
}: ContentModeRailProps) {
  const { t } = useTranslation()

  return (
    <nav
      className="flex flex-shrink-0 items-center gap-1 border-b border-surface-secondary bg-white px-3 py-2 dark:border-surface-dark-tertiary dark:bg-surface-dark"
      aria-label={t('entryList.contentModeRail')}
    >
      {MODES.map(({ view, labelKey, icon: Icon }) => {
        const isActive =
          view === null
            ? activeView === null && !selectedFeedId
            : activeView === view
        const count =
          view === null ? totalUnread : (unreadByView.get(view) ?? 0)
        return (
          <button
            key={view ?? 'all'}
            type="button"
            onClick={() => onChange(view)}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary',
            ].join(' ')}
          >
            <Icon size={13} className="flex-shrink-0" />
            <span>{t(labelKey)}</span>
            {count > 0 && (
              <span
                className={[
                  'ml-0.5 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] tabular-nums',
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-surface-secondary text-text-tertiary dark:bg-surface-dark-secondary',
                ].join(' ')}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
})
