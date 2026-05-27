import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Rss } from 'lucide-react'
import type { FeedWithCount } from '../../../../shared/types'
import { FeedViewType } from '../../../../shared/types'
import { groupFeedsByCategory } from '../../lib/feed-grouping'
import { ROUTES } from '../../router/route-paths'

interface FeedGroupListProps {
  feeds: FeedWithCount[]
  activeView: FeedViewType | null
}

/**
 * SubscriptionsPage main content: feeds grouped by category, each group
 * collapsible. Mirrors the Harmony-side SubscriptionsContent behaviour
 * (feeds filtered by current view mode, no recommended feeds mixed in).
 */
export const FeedGroupList = memo(function FeedGroupList({
  feeds,
  activeView,
}: FeedGroupListProps) {
  const navigate = useNavigate()

  const filteredFeeds = useMemo(() => {
    if (activeView === null) return feeds
    return feeds.filter((f) => (f.view ?? FeedViewType.Articles) === activeView)
  }, [feeds, activeView])

  const groups = useMemo(
    () => groupFeedsByCategory(filteredFeeds),
    [filteredFeeds],
  )

  // Stable callback so memoised CategoryGroup / FeedRow don't re-render on
  // every parent render. (Without this, the inline arrow recreated each render
  // would defeat the React.memo wrappers below.)
  const handleSelect = useCallback(
    (feedId: string) => navigate(ROUTES.feed(feedId)),
    [navigate],
  )

  if (groups.length === 0) {
    return (
      <main className="flex-1 overflow-y-auto px-6 py-12">
        <EmptyState />
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-4">
        {groups.map((group) => (
          <CategoryGroup
            key={group.category}
            category={group.category}
            feeds={group.feeds}
            unreadCount={group.unreadCount}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </main>
  )
})

interface CategoryGroupProps {
  category: string
  feeds: FeedWithCount[]
  unreadCount: number
  onSelect: (feedId: string) => void
}

const CategoryGroup = memo(function CategoryGroup({
  category,
  feeds,
  unreadCount,
  onSelect,
}: CategoryGroupProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-1 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
      >
        <ChevronRight
          size={12}
          className={[
            'flex-shrink-0 transition-transform',
            expanded ? 'rotate-90' : '',
          ].join(' ')}
        />
        <span className="flex-1 truncate normal-case">{category}</span>
        <span className="tabular-nums text-[var(--color-text-tertiary)]">
          {feeds.length}
        </span>
        {unreadCount > 0 && (
          <span className="tabular-nums text-[var(--color-accent)]">
            {unreadCount > 999 ? '999+' : unreadCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-1 space-y-0.5">
          {feeds.map((feed) => (
            <FeedRow key={feed.id} feed={feed} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  )
})

interface FeedRowProps {
  feed: FeedWithCount
  onSelect: (feedId: string) => void
}

const FeedRow = memo(function FeedRow({ feed, onSelect }: FeedRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(feed.id)}
      className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
    >
      <FeedAvatar feed={feed} />
      <span className="flex-1 truncate text-sm text-[var(--color-text-primary)]">
        {feed.title || feed.url}
      </span>
      {feed.unreadCount > 0 && (
        <span className="rounded-full bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
          {feed.unreadCount > 999 ? '999+' : feed.unreadCount}
        </span>
      )}
    </button>
  )
})

function FeedAvatar({ feed }: { feed: FeedWithCount }) {
  if (feed.imageUrl) {
    return (
      <img
        src={feed.imageUrl}
        alt=""
        className="h-5 w-5 flex-shrink-0 rounded bg-[var(--color-bg-tertiary)] object-cover"
        loading="lazy"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
        }}
      />
    )
  }
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-[var(--color-bg-tertiary)]">
      <Rss size={11} className="text-[var(--color-text-tertiary)]" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
        <Rss size={20} className="text-[var(--color-text-tertiary)]" />
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">暂无订阅</p>
      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
        切换模式或添加新的订阅源
      </p>
    </div>
  )
}
