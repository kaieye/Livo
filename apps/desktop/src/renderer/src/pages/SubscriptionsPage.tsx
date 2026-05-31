import { useMemo, useState } from 'react'
import { useFeedStore } from '../store/feed-store'
import { FeedViewType } from '../../../shared/types'
import { isUserFeed } from '../lib/feed-filters'
import { SubscriptionsModeRail } from '../components/subscriptions/SubscriptionsModeRail'
import { FeedGroupList } from '../components/subscriptions/FeedGroupList'
import { useSubscriptionsAvatarHydration } from '../hooks/useSubscriptionsAvatarHydration'

/**
 * SubscriptionsPage provides a full-page view for managing RSS subscriptions.
 * It includes a SubscriptionsModeRail for switching between view types
 * (Articles / Social / Videos / Pictures) and a grouped feed list by category.
 *
 * This page does NOT use useUrlSync because it doesn't participate in
 * the main 3-column layout's view/feed selection state machine. The active
 * mode is intentionally kept as page-local state (NOT in `feed-store`) so
 * filtering here cannot leak into the home view's `activeView` global.
 *
 * Recommended feeds and feeds hidden from "All" (`showInAll === false`)
 * are excluded — matching the rule used everywhere else in the codebase
 * (Sidebar, useHomeFeedCoordinator, Layout, feed-store...). See
 * `lib/feed-filters.ts` for the shared `isUserFeed` predicate.
 */
export default function SubscriptionsPage() {
  const feeds = useFeedStore((s) => s.feeds)
  const [activeView, setActiveView] = useState<FeedViewType | null>(null)

  const userFeeds = useMemo(() => feeds.filter(isUserFeed), [feeds])

  // Pre-resolve avatars for social-media feeds on mount
  useSubscriptionsAvatarHydration(userFeeds)

  const viewCounts = useMemo(() => {
    const counts = new Map<FeedViewType, number>()
    for (const feed of userFeeds) {
      const v = feed.view ?? FeedViewType.Articles
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return counts
  }, [userFeeds])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="flex-shrink-0 border-b border-[var(--color-border-secondary)] px-6 py-4">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          订阅管理
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          共 {userFeeds.length} 个订阅源
        </p>
      </header>

      <SubscriptionsModeRail
        activeView={activeView}
        viewCounts={viewCounts}
        onChange={setActiveView}
      />

      <FeedGroupList feeds={userFeeds} activeView={activeView} />
    </div>
  )
}
