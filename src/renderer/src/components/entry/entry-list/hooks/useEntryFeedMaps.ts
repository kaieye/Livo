import { useMemo } from 'react'
import type { Feed } from '../../../../../../shared/types'

export interface EntryFeedMaps {
  feedTitleById: Map<string, string>
  feedImageById: Map<string, string | undefined>
  feedSiteUrlById: Map<string, string | undefined>
  feedUrlById: Map<string, string | undefined>
}

export function useEntryFeedMaps(feedById: Map<string, Feed>): EntryFeedMaps {
  return useMemo(
    () => ({
      feedTitleById: new Map(
        Array.from(feedById.entries()).map(([id, feed]) => [id, feed.title]),
      ),
      feedImageById: new Map(
        Array.from(feedById.entries()).map(([id, feed]) => [id, feed.imageUrl]),
      ),
      feedSiteUrlById: new Map(
        Array.from(feedById.entries()).map(([id, feed]) => [id, feed.siteUrl]),
      ),
      feedUrlById: new Map(
        Array.from(feedById.entries()).map(([id, feed]) => [id, feed.url]),
      ),
    }),
    [feedById],
  )
}
