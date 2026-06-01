import { FeedViewType } from '../../../shared/types'
import { detectBilibiliFeedViewFromUrl } from '../../../shared/bilibili-feed-url'

export function inferDiscoverFeedViewFromUrl(targetUrl: string): FeedViewType {
  const lower = (targetUrl || '').toLowerCase()
  if (/\/(?:twitter|x)\/user\//i.test(lower)) return FeedViewType.SocialMedia

  const bilibiliView = detectBilibiliFeedViewFromUrl(lower)
  if (bilibiliView !== null) return bilibiliView

  if (/\/youtube\//i.test(lower)) return FeedViewType.Videos
  if (
    /\/instagram\//i.test(lower) ||
    /\/picnob(?:\.info)?\//i.test(lower) ||
    /\/pixnoy\//i.test(lower) ||
    /\/piokok\//i.test(lower) ||
    /\/imginn\//i.test(lower)
  ) {
    return FeedViewType.Pictures
  }

  return FeedViewType.Articles
}
