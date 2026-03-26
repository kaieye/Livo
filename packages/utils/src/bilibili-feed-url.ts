import { FeedViewType } from '@livo/models'

function extractBilibiliUid(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl)
    const route = `${parsed.hostname}${parsed.pathname}`
    const matched = route.match(
      /(?:^|\/)bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    return matched?.[1] || null
  } catch {
    const matched = feedUrl.match(
      /(?:^|\/)bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    return matched?.[1] || null
  }
}

function getRouteSegmentForView(
  view: FeedViewType,
): 'video' | 'dynamic' | 'article' {
  if (view === FeedViewType.SocialMedia) return 'dynamic'
  if (view === FeedViewType.Articles) return 'article'
  return 'video'
}

export function detectBilibiliFeedViewFromUrl(
  feedUrl: string,
): FeedViewType | null {
  const raw = (feedUrl || '').trim()
  if (!raw) return null
  if (/\/bilibili\/user\/dynamic\/\d+/i.test(raw))
    return FeedViewType.SocialMedia
  if (/\/bilibili\/user\/article\/\d+/i.test(raw)) return FeedViewType.Articles
  if (/\/bilibili\/user\/video\/\d+/i.test(raw)) return FeedViewType.Videos
  return null
}

export function remapBilibiliFeedUrlToView(
  feedUrl: string,
  view: FeedViewType,
): string {
  const uid = extractBilibiliUid(feedUrl)
  if (!uid) return feedUrl

  const nextSegment = getRouteSegmentForView(view)
  if (/^rsshub:\/\/+/i.test(feedUrl)) {
    return `rsshub://bilibili/user/${nextSegment}/${uid}`
  }
  return feedUrl.replace(
    /(?:^|\/)bilibili\/user\/(?:video|dynamic|article)\/\d+/i,
    (matched) => {
      const prefix = matched.startsWith('/') ? '/' : ''
      return `${prefix}bilibili/user/${nextSegment}/${uid}`
    },
  )
}
