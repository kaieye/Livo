import type { FeedViewType } from '../../../shared/types'
import { getEntryLoadLimit } from './entry-load-limit'

export interface HomeFeedLoadOptions {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit: number
}

/**
 * Derive entry load options from the current home feed scope.
 * Single source of truth for: starred → selected feed → active view → all feeds.
 */
export function buildHomeFeedLoadOptions(options: {
  selectedFeedId: string | null
  activeView: FeedViewType | null
  feeds: Array<{ id: string; view?: FeedViewType; showInAll?: boolean }>
  unreadOnly?: boolean
  limit?: number
}): HomeFeedLoadOptions {
  const {
    selectedFeedId,
    activeView,
    feeds,
    unreadOnly,
    limit: explicitLimit,
  } = options
  const limit = explicitLimit ?? getEntryLoadLimit(activeView)

  if (selectedFeedId === 'starred') {
    return { starred: true, unreadOnly, limit }
  }

  if (selectedFeedId) {
    return { feedId: selectedFeedId, unreadOnly, limit }
  }

  if (activeView !== null) {
    const viewFeedIds = feeds
      .filter((f) => (f.view ?? 0) === activeView && f.showInAll !== false)
      .map((f) => f.id)
    if (viewFeedIds.length > 0) {
      return { feedIds: viewFeedIds, unreadOnly, limit }
    }
  }

  return { unreadOnly, limit }
}

/**
 * Compute view-scoped feed IDs for filtering (excludes recommended feeds).
 * Used by the coordinator for client-side entry filtering after load.
 */
export function computeViewFeedIds(
  feeds: Array<{
    id: string
    view?: FeedViewType
    category?: string
    showInAll?: boolean
  }>,
  activeView: FeedViewType | null,
  excludeCategory?: string,
): string[] | undefined {
  if (activeView === null) return undefined
  return feeds
    .filter(
      (f) =>
        (f.view ?? 0) === activeView &&
        f.showInAll !== false &&
        (!excludeCategory || f.category !== excludeCategory),
    )
    .map((f) => f.id)
}
