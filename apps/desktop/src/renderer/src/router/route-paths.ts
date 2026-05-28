import { FeedViewType } from '@livo/models'

/**
 * Route path constants for type-safe navigation.
 * All paths are relative to the HashRouter root (#/).
 */
export const ROUTES = {
  home: '/',
  starred: '/starred',
  feed: (feedId: string) => `/feed/${feedId}`,
  feedDetail: (feedId: string) => `/feed-detail/${feedId}`,
  entry: (entryId: string) => `/entry/${entryId}`,
  discover: '/discover',
  settings: '/settings',
  subscriptions: '/subscriptions',
  viewType: (view: FeedViewType) => {
    const slug = VIEW_TYPE_SLUGS[view]
    return slug ? `/${slug}` : '/'
  },
} as const

/** Maps FeedViewType enum values to URL path segments. */
export const VIEW_TYPE_SLUGS: Record<FeedViewType, string> = {
  [FeedViewType.Articles]: 'articles',
  [FeedViewType.SocialMedia]: 'social',
  [FeedViewType.Videos]: 'videos',
  [FeedViewType.Pictures]: 'pictures',
}

/** Reverse mapping from URL slug to FeedViewType. */
export const VIEW_TYPE_FROM_SLUG: Record<string, FeedViewType> = {
  articles: FeedViewType.Articles,
  social: FeedViewType.SocialMedia,
  videos: FeedViewType.Videos,
  pictures: FeedViewType.Pictures,
}

/** Known non-view-type path segments that should not be treated as view filters. */
const NON_VIEW_PATHS = new Set([
  'feed',
  'feed-detail',
  'entry',
  'starred',
  'discover',
  'settings',
  'subscriptions',
])

/**
 * Parse the current hash path to determine the active view type and feed selection.
 * Returns null view for "all feeds" view.
 */
export function parseViewFromPath(pathname: string): {
  viewType: FeedViewType | null
  feedId: string | null
} {
  // Remove leading slash
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean)

  if (segments.length === 0) {
    return { viewType: null, feedId: null }
  }

  const first = segments[0]

  if (first === 'starred') {
    return { viewType: null, feedId: 'starred' }
  }

  if (first === 'feed' && segments[1]) {
    return { viewType: null, feedId: segments[1] }
  }

  if (!NON_VIEW_PATHS.has(first)) {
    const viewType = VIEW_TYPE_FROM_SLUG[first]
    if (viewType !== undefined) {
      return { viewType, feedId: null }
    }
  }

  return { viewType: null, feedId: null }
}
