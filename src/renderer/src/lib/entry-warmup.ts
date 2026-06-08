import { FeedViewType } from '../../../shared/types'
import { getEntryLoadLimit } from './entry-load-limit'

export interface EntryWarmupFeed {
  id: string
  view?: FeedViewType | null
  category?: string
  showInAll?: boolean
}

export interface EntryWarmupRequest {
  key: string
  options: {
    feedIds: string[]
    limit: number
  }
}

export const ENTRY_WARMUP_VIEWS = [
  FeedViewType.SocialMedia,
  FeedViewType.Videos,
  FeedViewType.Pictures,
  FeedViewType.Articles,
] as const

export function buildEntryWarmupKey(
  scope: string,
  feedIds: readonly string[],
  limit: number,
): string {
  return `${scope}:${limit}:${[...feedIds].sort().join('\u001f')}`
}

export function buildEntryWarmupRequests(
  feeds: EntryWarmupFeed[],
  excludeCategory?: string,
): EntryWarmupRequest[] {
  const visibleFeeds = feeds.filter(
    (feed) =>
      feed.showInAll !== false &&
      (!excludeCategory || feed.category !== excludeCategory),
  )

  return ENTRY_WARMUP_VIEWS.flatMap((view) => {
    const feedIds = visibleFeeds
      .filter((feed) => (feed.view ?? FeedViewType.Articles) === view)
      .map((feed) => feed.id)

    if (feedIds.length === 0) return []

    const limit = getEntryLoadLimit(view)
    return [
      {
        key: buildEntryWarmupKey(`view:${view}`, feedIds, limit),
        options: { feedIds, limit },
      },
    ]
  })
}
