import type { Feed } from '../../shared/types'
import { formatFeedTitle } from '../services/feed-title'

export function normalizeExistingFeedTitles(feeds: Feed[]): boolean {
  let changed = false

  for (const feed of feeds) {
    const normalizedTitle = formatFeedTitle(feed.url, feed.title, feed.title)
    if (normalizedTitle && normalizedTitle !== feed.title) {
      feed.title = normalizedTitle
      changed = true
    }
  }

  return changed
}
