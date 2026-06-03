import type { Feed } from '../../shared/types'
import { FeedViewType } from '../../shared/types'
import { formatFeedTitle } from '../services/feed/feed-title'

export function normalizeExistingFeedTitles(feeds: Feed[]): boolean {
  let changed = false

  for (const feed of feeds) {
    const normalizedTitle = formatFeedTitle(feed.url, feed.title, feed.title)
    if (normalizedTitle && normalizedTitle !== feed.title) {
      feed.title = normalizedTitle
      changed = true
    }

    // Keep Bilibili route and view aligned so dynamic/video/article subscriptions
    // are rendered in the correct column even if they were originally created
    // with a mismatched explicit view.
    if (/\/bilibili\/user\/dynamic\/\d+/i.test(feed.url)) {
      if (feed.view !== FeedViewType.SocialMedia) {
        feed.view = FeedViewType.SocialMedia
        changed = true
      }
    } else if (/\/bilibili\/user\/article\/\d+/i.test(feed.url)) {
      if (feed.view !== FeedViewType.Articles) {
        feed.view = FeedViewType.Articles
        changed = true
      }
    } else if (/\/bilibili\/user\/video\/\d+/i.test(feed.url)) {
      // Historical bug: some Bilibili profile subscriptions were created with the
      // `/user/video/:uid` route while the feed view was SocialMedia, so users
      // expected dynamic posts but the stored route only tracked video uploads.
      if (feed.view === FeedViewType.SocialMedia) {
        feed.url = feed.url.replace(
          /\/bilibili\/user\/video\/(\d+)/i,
          '/bilibili/user/dynamic/$1',
        )
        changed = true
      } else if (feed.view !== FeedViewType.Videos) {
        feed.view = FeedViewType.Videos
        changed = true
      }
    }
  }

  return changed
}
