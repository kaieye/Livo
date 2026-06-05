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
  const timelineEntries = renderEntries

  return {
    renderEntries,
    timelineEntries,
    shouldShowLoadingSkeleton,
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
