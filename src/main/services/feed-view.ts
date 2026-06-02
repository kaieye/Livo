import { FeedViewType } from '../../shared/types'
import { isInstagramUserFeedUrl } from '../../shared/url-detect'

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

/** Detect view type from parsed feed content */
export function detectViewType(parsed: {
  items?: Array<Record<string, unknown>>
}): FeedViewType {
  const items = parsed.items || []

  let videoCount = 0
  let imageCount = 0

  for (const item of items.slice(0, 10)) {
    const enclosure = item.enclosure as
      | { type?: string; url?: string }
      | undefined
    const content = String(item.content || item['content:encoded'] || '')

    if (
      enclosure?.type?.startsWith('video/') ||
      content.includes('<video') ||
      content.includes('youtube.com/embed')
    ) {
      videoCount++
    } else if (
      enclosure?.type?.startsWith('image/') ||
      content.includes('<img')
    ) {
      const imgCount = (content.match(/<img/g) || []).length
      if (imgCount >= 3) imageCount++
    }
  }

  const total = items.length || 1
  if (videoCount / total > 0.5) return FeedViewType.Videos
  if (imageCount / total > 0.5) return FeedViewType.SocialMedia

  return FeedViewType.Articles
}

export function detectViewTypeFromUrlOrContent(
  url: string,
  parsed: any,
): FeedViewType {
  const routeView = detectRouteViewFromUrl(url)
  if (routeView !== null) return routeView
  return parsed ? detectViewType(parsed) : FeedViewType.Articles
}
