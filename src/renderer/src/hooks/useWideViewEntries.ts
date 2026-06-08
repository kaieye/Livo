import { useMemo } from 'react'

import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import {
  buildCachedWideViewBaseEntries,
  buildCachedWideViewEntryModel,
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
  const scopeCacheKey = `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}:${
    showRecommended ? 'with-recommended' : 'no-recommended'
  }`
  const baseFilteredEntries = useMemo(
    () =>
      buildCachedWideViewBaseEntries({
        entries,
        feeds,
        feedById,
        activeView,
        selectedFeedId,
        showRecommended,
        recommendedCategory: RECOMMENDED_CATEGORY,
        cacheKey: scopeCacheKey,
      }),
    [
      activeView,
      entries,
      feedById,
      feeds,
      scopeCacheKey,
      selectedFeedId,
      showRecommended,
    ],
  )

  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const {
    entries: viewFilteredEntries,
    isProcessing: isSocialDedupeProcessing,
  } = useAsyncSocialDedupe(baseFilteredEntries, {
    enabled: shouldDedupeSocialEntries,
    cacheKey: `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`,
  })

  const model = useMemo(() => {
    return buildCachedWideViewEntryModel({
      entries,
      viewFilteredEntries,
      feedById,
      isLoading,
      isSocialDedupeProcessing,
      allowStaleEntriesWhileLoading: !selectedFeedId,
      cacheKey: `${scopeCacheKey}:wide-model`,
    })
  }, [
    entries,
    feedById,
    isLoading,
    isSocialDedupeProcessing,
    scopeCacheKey,
    selectedFeedId,
    viewFilteredEntries,
  ])

  return { ...model, isSocialDedupeProcessing }
}
