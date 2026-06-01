import type { FeedWithCount } from '../../../shared/types'
import { FeedViewType, VIEW_DEFINITIONS } from '../../../shared/types'

/**
 * Resolve a feed's grouping category. Falls back to the view type's default
 * folder name when the feed has no user-defined category.
 *
 * Mirrors the Harmony-side default folder fallback (see
 * AppRepositoryEntryHelpers / SubscriptionsContent grouping) and the Desktop
 * Sidebar's getFeedFolderName logic, kept simple and i18n-free so it can be
 * shared by readonly UIs like SubscriptionsPage.
 *
 * Intentional divergence from Sidebar.tsx#getFeedFolderName: that function
 * pipes the view fallback through `t(VIEW_TYPE_I18N_KEYS[view])` because the
 * sidebar lives inside the translated chrome. Here we use the language-
 * neutral `VIEW_DEFINITIONS[view].name` so this helper can be invoked from
 * non-React contexts (tests, services) and from UI that doesn't need
 * translation. Do NOT collapse the two — they serve different audiences.
 */
export function getFeedCategory(feed: {
  category?: string
  view?: FeedViewType
}): string {
  const trimmed = feed.category?.trim()
  if (trimmed) return trimmed
  const view = feed.view ?? FeedViewType.Articles
  return (
    VIEW_DEFINITIONS[view]?.name ?? VIEW_DEFINITIONS[FeedViewType.Articles].name
  )
}

export interface FeedGroup {
  category: string
  feeds: FeedWithCount[]
  unreadCount: number
}

/**
 * Group feeds by category (preserving insertion order of first occurrence).
 * Within each group, feeds keep their input order. Returned groups expose a
 * pre-computed unreadCount for badge rendering.
 */
export function groupFeedsByCategory(feeds: FeedWithCount[]): FeedGroup[] {
  const groups = new Map<string, FeedGroup>()
  for (const feed of feeds) {
    const category = getFeedCategory(feed)
    let group = groups.get(category)
    if (!group) {
      group = { category, feeds: [], unreadCount: 0 }
      groups.set(category, group)
    }
    group.feeds.push(feed)
    group.unreadCount += feed.unreadCount
  }
  return Array.from(groups.values())
}
