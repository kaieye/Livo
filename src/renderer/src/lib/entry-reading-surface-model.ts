import { FeedViewType, type Entry, type Feed } from '../../../shared/types'

export interface EntryReadingSurfaceScopeModel<TFeed extends Feed = Feed> {
  feedById: Map<string, TFeed>
  recommendedFeedIds: Set<string>
  currentFeed: TFeed | undefined
  scopedEntries: Entry[]
}

export interface EntryReadingSurfaceRenderModel {
  renderEntries: Entry[]
  hasStaleEntriesWhileLoading: boolean
  shouldShowLoadingSkeleton: boolean
}

export function buildEntryReadingSurfaceScopeModel<TFeed extends Feed>(input: {
  entries: Entry[]
  feeds: TFeed[]
  feedById?: Map<string, TFeed>
  activeView: FeedViewType | null
  selectedFeedId?: string | null
  showRecommended: boolean
  recommendedCategory: string
}): EntryReadingSurfaceScopeModel<TFeed> {
  const feedById =
    input.feedById ?? new Map(input.feeds.map((feed) => [feed.id, feed]))
  const recommendedFeedIds = new Set(
    input.feeds
      .filter((feed) => feed.category === input.recommendedCategory)
      .map((feed) => feed.id),
  )
  const currentFeed = input.selectedFeedId
    ? feedById.get(input.selectedFeedId)
    : undefined

  return {
    feedById,
    recommendedFeedIds,
    currentFeed,
    scopedEntries: buildEntryReadingSurfaceEntries({
      entries: input.entries,
      feedById,
      recommendedFeedIds,
      activeView: input.activeView,
      selectedFeedId: input.selectedFeedId,
      showRecommended: input.showRecommended,
    }),
  }
}

export function buildEntryReadingSurfaceEntries(input: {
  entries: Entry[]
  feedById: Map<string, Feed>
  recommendedFeedIds: Set<string>
  activeView: FeedViewType | null
  selectedFeedId?: string | null
  showRecommended: boolean
}): Entry[] {
  if (input.selectedFeedId) {
    if (input.selectedFeedId === 'starred') return input.entries
    return input.entries.filter(
      (entry) => entry.feedId === input.selectedFeedId,
    )
  }

  return input.entries.filter((entry) => {
    const feed = input.feedById.get(entry.feedId)
    if (!feed) return false
    if (feed.showInAll === false) return false
    if (!input.showRecommended && input.recommendedFeedIds.has(entry.feedId)) {
      return false
    }
    if (input.activeView === null) return true
    return (feed.view ?? FeedViewType.Articles) === input.activeView
  })
}

export function buildEntryReadingSurfaceRenderModel(input: {
  sourceEntries: Entry[]
  scopedEntries: Entry[]
  isLoading: boolean
  isPostProcessing: boolean
  allowStaleEntriesWhileLoading: boolean
}): EntryReadingSurfaceRenderModel {
  const hasStaleEntriesWhileLoading =
    input.allowStaleEntriesWhileLoading &&
    (input.isLoading || input.isPostProcessing) &&
    input.scopedEntries.length === 0 &&
    input.sourceEntries.length > 0
  const renderEntries = hasStaleEntriesWhileLoading
    ? input.sourceEntries
    : input.scopedEntries

  return {
    renderEntries,
    hasStaleEntriesWhileLoading,
    shouldShowLoadingSkeleton: input.isLoading && renderEntries.length === 0,
  }
}
