import { FeedViewType, type Entry, type Feed } from '../../../shared/types'

export interface TimelineFeedMeta {
  title?: string
  imageUrl?: string
  siteUrl?: string
  url?: string
}

export interface VideoFeedMeta {
  title?: string
  imageUrl?: string
}

export interface WideViewEntryModel {
  renderEntries: Entry[]
  timelineEntries: Entry[]
  shouldShowLoadingSkeleton: boolean
  timelineIndexById: Map<string, number>
  timelineFeedMetaByEntryId: Map<string, TimelineFeedMeta>
  videoFeedMetaByEntryId: Map<string, VideoFeedMeta>
  renderEntryById: Map<string, Entry>
  renderEntryIndexById: Map<string, number>
}

export function buildWideViewBaseEntries(input: {
  entries: Entry[]
  feeds: Feed[]
  feedById: Map<string, Feed>
  activeView: FeedViewType | null
  selectedFeedId?: string | null
  showRecommended: boolean
  recommendedCategory: string
}): Entry[] {
  const recommendedFeedIds = new Set(
    input.feeds
      .filter((feed) => feed.category === input.recommendedCategory)
      .map((feed) => feed.id),
  )

  const shouldRenderInAllScope = (entry: Entry): boolean => {
    const feed = input.feedById.get(entry.feedId)
    if (!feed) return false
    if (feed.showInAll === false) return false
    if (!input.showRecommended && recommendedFeedIds.has(entry.feedId)) {
      return false
    }
    return true
  }

  if (input.selectedFeedId) {
    if (input.selectedFeedId === 'starred') return input.entries
    return input.entries.filter(
      (entry) => entry.feedId === input.selectedFeedId,
    )
  }

  if (input.activeView !== null) {
    return input.entries.filter((entry) => {
      const feed = input.feedById.get(entry.feedId)
      if (!feed) return false
      if (!shouldRenderInAllScope(entry)) return false
      return (feed.view ?? FeedViewType.Articles) === input.activeView
    })
  }

  const filtered = input.entries.filter(shouldRenderInAllScope)

  // 全部视图加载中可能保留旧条目；这里保持原有兜底路径，避免列表闪空。
  if (input.entries.length > 0 && filtered.length === 0) {
    return input.entries.filter(shouldRenderInAllScope)
  }

  return filtered
}

export function buildWideViewEntryModel(input: {
  entries: Entry[]
  viewFilteredEntries: Entry[]
  feedById: Map<string, Feed>
  isLoading: boolean
  isSocialDedupeProcessing: boolean
}): WideViewEntryModel {
  const hasStaleEntriesWhileLoading =
    (input.isLoading || input.isSocialDedupeProcessing) &&
    input.viewFilteredEntries.length === 0 &&
    input.entries.length > 0
  const renderEntries = hasStaleEntriesWhileLoading
    ? input.entries
    : input.viewFilteredEntries
  const timelineEntries = renderEntries

  return {
    renderEntries,
    timelineEntries,
    shouldShowLoadingSkeleton: input.isLoading && renderEntries.length === 0,
    timelineIndexById: new Map(
      timelineEntries.map((entry, index) => [entry.id, index] as const),
    ),
    timelineFeedMetaByEntryId: new Map(
      timelineEntries.map((entry) => {
        const feed = input.feedById.get(entry.feedId)
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
    videoFeedMetaByEntryId: new Map(
      renderEntries.map((entry) => {
        const feed = input.feedById.get(entry.feedId)
        return [
          entry.id,
          {
            title: feed?.title,
            imageUrl: feed?.imageUrl,
          } satisfies VideoFeedMeta,
        ] as const
      }),
    ),
    renderEntryById: new Map(
      renderEntries.map((entry) => [entry.id, entry] as const),
    ),
    renderEntryIndexById: new Map(
      renderEntries.map((entry, index) => [entry.id, index] as const),
    ),
  }
}
