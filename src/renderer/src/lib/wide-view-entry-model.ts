import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import {
  buildEntryReadingSurfaceRenderModel,
  buildEntryReadingSurfaceScopeModel,
} from './entry-reading-surface-model'

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
  return buildEntryReadingSurfaceScopeModel(input).scopedEntries
}

export function buildWideViewEntryModel(input: {
  entries: Entry[]
  viewFilteredEntries: Entry[]
  feedById: Map<string, Feed>
  isLoading: boolean
  isSocialDedupeProcessing: boolean
  allowStaleEntriesWhileLoading?: boolean
}): WideViewEntryModel {
  const { renderEntries, shouldShowLoadingSkeleton } =
    buildEntryReadingSurfaceRenderModel({
      sourceEntries: input.entries,
      scopedEntries: input.viewFilteredEntries,
      isLoading: input.isLoading,
      isPostProcessing: input.isSocialDedupeProcessing,
      allowStaleEntriesWhileLoading:
        input.allowStaleEntriesWhileLoading ?? true,
    })

  // Single-pass: build all 5 Maps in one traversal instead of 5 separate .map() calls.
  const timelineIndexById = new Map<string, number>()
  const timelineFeedMetaByEntryId = new Map<string, TimelineFeedMeta>()
  const videoFeedMetaByEntryId = new Map<string, VideoFeedMeta>()
  const renderEntryById = new Map<string, Entry>()
  const renderEntryIndexById = new Map<string, number>()

  for (let i = 0; i < renderEntries.length; i++) {
    const entry = renderEntries[i]
    const feed = input.feedById.get(entry.feedId)

    renderEntryById.set(entry.id, entry)
    renderEntryIndexById.set(entry.id, i)
    timelineIndexById.set(entry.id, i)

    timelineFeedMetaByEntryId.set(entry.id, {
      title: feed?.title,
      imageUrl: feed?.imageUrl,
      siteUrl: feed?.siteUrl,
      url: feed?.url,
    })

    videoFeedMetaByEntryId.set(entry.id, {
      title: feed?.title,
      imageUrl: feed?.imageUrl,
    })
  }

  return {
    renderEntries,
    timelineEntries: renderEntries,
    shouldShowLoadingSkeleton,
    timelineIndexById,
    timelineFeedMetaByEntryId,
    videoFeedMetaByEntryId,
    renderEntryById,
    renderEntryIndexById,
  }
}
