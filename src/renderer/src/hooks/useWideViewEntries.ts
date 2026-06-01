import { useMemo } from 'react'

import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import { RECOMMENDED_CATEGORY } from './useInitRecommendedFeeds'
import { useAsyncSocialDedupe } from './useAsyncSocialDedupe'

interface TimelineFeedMeta {
  title?: string
  imageUrl?: string
  siteUrl?: string
  url?: string
}

interface VideoFeedMeta {
  title?: string
  imageUrl?: string
}

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
  const recommendedFeedIds = useMemo(
    () =>
      new Set(
        feeds
          .filter((f) => f.category === RECOMMENDED_CATEGORY)
          .map((f) => f.id),
      ),
    [feeds],
  )

  const baseFilteredEntries = useMemo(() => {
    const filtered = selectedFeedId
      ? selectedFeedId === 'starred'
        ? entries
        : entries.filter((entry) => entry.feedId === selectedFeedId)
      : activeView !== null
        ? entries.filter((entry) => {
            const feed = feedById.get(entry.feedId)
            if (!feed) return false
            if (feed.showInAll === false) return false
            if (!showRecommended && recommendedFeedIds.has(entry.feedId))
              return false
            return (feed.view ?? FeedViewType.Articles) === activeView
          })
        : entries.filter((entry) => {
            const feed = feedById.get(entry.feedId)
            if (!feed) return false
            if (feed.showInAll === false) return false
            if (!showRecommended && recommendedFeedIds.has(entry.feedId))
              return false
            return true
          })

    if (
      !selectedFeedId &&
      activeView === null &&
      entries.length > 0 &&
      filtered.length === 0
    ) {
      return entries.filter((entry) => {
        const feed = feedById.get(entry.feedId)
        if (!feed) return false
        if (feed.showInAll === false) return false
        if (!showRecommended && recommendedFeedIds.has(entry.feedId))
          return false
        return true
      })
    }

    return filtered
  }, [
    activeView,
    entries,
    feedById,
    recommendedFeedIds,
    selectedFeedId,
    showRecommended,
  ])

  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const {
    entries: viewFilteredEntries,
    isProcessing: isSocialDedupeProcessing,
  } = useAsyncSocialDedupe(baseFilteredEntries, {
    enabled: shouldDedupeSocialEntries,
    cacheKey: `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`,
  })

  const hasStaleEntriesWhileLoading =
    (isLoading || isSocialDedupeProcessing) &&
    viewFilteredEntries.length === 0 &&
    entries.length > 0
  const renderEntries = hasStaleEntriesWhileLoading
    ? entries
    : viewFilteredEntries
  const shouldShowLoadingSkeleton = isLoading && renderEntries.length === 0
  const timelineEntries = renderEntries

  const timelineIndexById = useMemo(
    () =>
      new Map(
        timelineEntries.map((entry, index) => [entry.id, index] as const),
      ),
    [timelineEntries],
  )
  const timelineFeedMetaByEntryId = useMemo(
    () =>
      new Map(
        timelineEntries.map((entry) => {
          const feed = feedById.get(entry.feedId)
          return [
            entry.id,
            {
              title: feed?.title,
              imageUrl: feed?.imageUrl,
              siteUrl: feed?.siteUrl,
              url: feed?.url,
            } satisfies TimelineFeedMeta,
          ] as const
        }),
      ),
    [feedById, timelineEntries],
  )
  const videoFeedMetaByEntryId = useMemo(
    () =>
      new Map(
        renderEntries.map((entry) => {
          const feed = feedById.get(entry.feedId)
          return [
            entry.id,
            {
              title: feed?.title,
              imageUrl: feed?.imageUrl,
            } satisfies VideoFeedMeta,
          ] as const
        }),
      ),
    [feedById, renderEntries],
  )
  const renderEntryById = useMemo(
    () => new Map(renderEntries.map((entry) => [entry.id, entry] as const)),
    [renderEntries],
  )
  const renderEntryIndexById = useMemo(
    () =>
      new Map(renderEntries.map((entry, index) => [entry.id, index] as const)),
    [renderEntries],
  )

  return {
    renderEntries,
    timelineEntries,
    shouldShowLoadingSkeleton,
    timelineIndexById,
    timelineFeedMetaByEntryId,
    videoFeedMetaByEntryId,
    renderEntryById,
    renderEntryIndexById,
    isSocialDedupeProcessing,
  }
}
