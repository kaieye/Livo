import { useMemo } from 'react'

import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import {
  buildWideViewBaseEntries,
  buildWideViewEntryModel,
} from '../lib/wide-view-entry-model'
import { RECOMMENDED_CATEGORY } from './useInitRecommendedFeeds'
import { useAsyncSocialDedupe } from './useAsyncSocialDedupe'

export function useWideViewEntries({
  entries,
  feeds,
  feedById,
  activeView,
  selectedFeedId,
  showRecommended,
  isLoading,
}: {
  entries: Entry[]
  feeds: Feed[]
  feedById: Map<string, Feed>
  activeView: FeedViewType | null
  selectedFeedId?: string | null
  showRecommended: boolean
  isLoading: boolean
}) {
  const baseFilteredEntries = useMemo(
    () =>
      buildWideViewBaseEntries({
        entries,
        feeds,
        feedById,
        activeView,
        selectedFeedId,
        showRecommended,
        recommendedCategory: RECOMMENDED_CATEGORY,
      }),
    [activeView, entries, feedById, feeds, selectedFeedId, showRecommended],
  )

  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const {
    entries: viewFilteredEntries,
    isProcessing: isSocialDedupeProcessing,
  } = useAsyncSocialDedupe(baseFilteredEntries, {
    enabled: shouldDedupeSocialEntries,
    cacheKey: `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`,
  })

  const model = useMemo(
    () =>
      buildWideViewEntryModel({
        entries,
        viewFilteredEntries,
        feedById,
        isLoading,
        isSocialDedupeProcessing,
      }),
    [
      entries,
      feedById,
      isLoading,
      isSocialDedupeProcessing,
      viewFilteredEntries,
    ],
  )

  return { ...model, isSocialDedupeProcessing }
}
