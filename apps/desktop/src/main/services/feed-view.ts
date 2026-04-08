import { FeedViewType } from '../../shared/types'

function isInstagramUserFeedUrl(url: string): boolean {
  const raw = (url || '').toLowerCase()
  return /(?:^|\/)(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//.test(
    raw,
  )
}

export function detectRouteViewFromUrl(url: string): FeedViewType | null {
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (/\/bilibili\/user\/video\//.test(path)) return FeedViewType.Videos
    if (/\/bilibili\/user\/dynamic\//.test(path))
      return FeedViewType.SocialMedia
    if (/\/bilibili\/user\/article\//.test(path)) return FeedViewType.Articles
    if (/\/youtube\//.test(path)) return FeedViewType.Videos
  } catch {
    // Ignore malformed URL.
  }
  return null
}

export function reconcileFeedView(url: string, currentView: FeedViewType) {
  const routeView = detectRouteViewFromUrl(url)
  if (routeView !== null) return routeView
  if (currentView === FeedViewType.Articles && isInstagramUserFeedUrl(url)) {
    return FeedViewType.Pictures
  }
  return currentView
}
