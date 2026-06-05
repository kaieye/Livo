import { useMemo } from 'react'

import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import { buildEntryReadingSurfaceScopeModel } from '../lib/entry-reading-surface-model'
import { buildWideViewEntryModel } from '../lib/wide-view-entry-model'
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
      buildEntryReadingSurfaceScopeModel({
        entries,
        feeds,
        feedById,
        activeView,
        selectedFeedId,
        showRecommended,
        recommendedCategory: RECOMMENDED_CATEGORY,
      }).scopedEntries,
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

  const model = useMemo(() => {
    const result = buildWideViewEntryModel({
      entries,
      viewFilteredEntries,
      feedById,
      isLoading,
      isSocialDedupeProcessing,
      allowStaleEntriesWhileLoading: !selectedFeedId,
    })
    // PERF: mark when WideView entry model computation is done
    performance.mark('vs:wideview-memos')
    return result
  }, [
    entries,
    feedById,
    isLoading,
    isSocialDedupeProcessing,
    selectedFeedId,
    viewFilteredEntries,
  ])

  return { ...model, isSocialDedupeProcessing }
}
