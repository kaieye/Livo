import { FeedViewType } from '@shared'

export interface DiscoverRouteTarget {
  feedId?: string
  url: string
  title?: string
  siteUrl?: string
  imageUrl?: string
  description?: string
  category?: string
  view?: FeedViewType
}

function buildDiscoverTargetSearch(target: DiscoverRouteTarget): string {
  const search = new URLSearchParams()
  if (target.feedId) search.set('feedId', target.feedId)
  search.set('url', target.url)
  if (target.title) search.set('title', target.title)
  if (target.siteUrl) search.set('siteUrl', target.siteUrl)
  if (target.imageUrl) search.set('imageUrl', target.imageUrl)
  if (target.description) search.set('description', target.description)
  if (target.category) search.set('category', target.category)
  if (typeof target.view === 'number') search.set('view', String(target.view))
  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * Route path constants for type-safe navigation.
 * All paths are relative to the HashRouter root (#/).
 */
export const ROUTES = {
  home: '/',
  starred: '/starred',
  feed: (feedId: string) => `/feed/${feedId}`,
  /** Navigate to a feed while preserving the active view type. */
  viewFeed: (view: FeedViewType, feedId: string) => {
    const slug = VIEW_TYPE_SLUGS[view]
    return slug ? `/${slug}/feed/${feedId}` : `/feed/${feedId}`
  },
  feedDetail: (feedId: string) => `/feed-detail/${feedId}`,
  entry: (entryId: string) => `/entry/${entryId}`,
  video: (entryId: string) => `/video/${entryId}`,
  image: (entryId: string, index?: number) =>
    typeof index === 'number' && index > 0
      ? `/image/${entryId}/${index}`
      : `/image/${entryId}`,
  login: (provider?: string) => (provider ? `/login/${provider}` : '/login'),
  discover: '/discover',
  discoverPreview: (target: DiscoverRouteTarget) =>
    `/discover/preview${buildDiscoverTargetSearch(target)}`,
  discoverSubscribe: (target: DiscoverRouteTarget) =>
    `/discover/subscribe${buildDiscoverTargetSearch(target)}`,
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
  'video',
  'image',
  'login',
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
      // /:viewType/feed/:feedId — preserve both view type and feed selection
      if (segments[1] === 'feed' && segments[2]) {
        return { viewType, feedId: segments[2] }
      }
      return { viewType, feedId: null }
    }
  }

  return { viewType: null, feedId: null }
}
