import type { FeedWithCount } from '../../../shared/types'
import { RECOMMENDED_CATEGORY } from '../hooks/useInitRecommendedFeeds'

export { RECOMMENDED_CATEGORY }

/**
 * Predicate identifying feeds that belong to the user's own subscriptions —
 * i.e. excluding recommended feeds and feeds the user has hidden from the
 * "All" timeline (`showInAll === false`).
 *
 * This canonicalises the filter rule that is currently duplicated across
 * Sidebar.tsx (1020/1049/1070), useHomeFeedCoordinator.ts (121), Layout.tsx
 * (78/87), feed-store.ts (282) etc. New call sites should prefer this
 * predicate; existing call sites are left alone to avoid widening this
 * change's blast radius. See `feed-store.ts:8` for a known-duplicate
 * `RECOMMENDED_CATEGORY` literal — that is tracked as separate tech debt.
 */
export function isUserFeed(
  feed: Pick<FeedWithCount, 'category' | 'showInAll'>,
): boolean {
  if (feed.category === RECOMMENDED_CATEGORY) return false
  if (feed.showInAll === false) return false
  return true
}
