import { Loader2 } from 'lucide-react'
import type { MouseEvent, RefObject } from 'react'
import type { Entry, FeedViewType } from '../../../../../shared/types'
import { FeedViewType as FeedViewTypeEnum } from '../../../../../shared/types'
import type { EntryListSocialRow } from '../../../lib/entry-list-model'
import { SkeletonList } from '../../ui/Skeleton'
import { EntryListEmpty } from './EntryListEmpty'
import { GridLayout } from './layouts/GridLayout'
import { LinearListLayout } from './layouts/LinearListLayout'
import { SocialLayout } from './layouts/SocialLayout'

export interface EntryListContentProps {
  isLoading: boolean
  hasStaleEntriesWhileLoading: boolean
  activeView: FeedViewType | null
  selectedFeedId: string | null
  isRefreshing: boolean
  isGridMode: boolean
  renderEntries: Entry[]
  socialRows: EntryListSocialRow[]
  virtualizerEntries: Entry[]
  gridRows: Entry[][]
  useVirtualLinearList: boolean
  hasMoreGridEntries: boolean
  isLoadingMore: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  selectedEntryId: string | null
  feedTitleById: Map<string, string>
  feedImageById: Map<string, string | undefined>
  feedSiteUrlById: Map<string, string | undefined>
  feedUrlById: Map<string, string | undefined>
  dimRead: boolean
  imageProxy: boolean
  onRefresh: () => void | Promise<void>
  onSelectEntry: (entry: Entry) => void
  onMarkAboveRead: (entryId: string) => void
  onMarkBelowRead: (entryId: string) => void
  onContextMenu: (e: MouseEvent, entryId: string) => void
  onMediaAllFailed: (entry: Entry) => void
}

export function EntryListContent({
  isLoading,
  hasStaleEntriesWhileLoading,
  activeView,
  selectedFeedId,
  isRefreshing,
  isGridMode,
  renderEntries,
  socialRows,
  virtualizerEntries,
  gridRows,
  useVirtualLinearList,
  hasMoreGridEntries,
  isLoadingMore,
  scrollRef,
  selectedEntryId,
  feedTitleById,
  feedImageById,
  feedSiteUrlById,
  feedUrlById,
  dimRead,
  imageProxy,
  onRefresh,
  onSelectEntry,
  onMarkAboveRead,
  onMarkBelowRead,
  onContextMenu,
  onMediaAllFailed,
}: EntryListContentProps) {
  const virtualizerCacheKey = `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`

  if (isLoading && !hasStaleEntriesWhileLoading) {
    return (
      <SkeletonList
        count={6}
        type={
          activeView === FeedViewTypeEnum.SocialMedia
            ? 'social'
            : isGridMode
              ? 'grid'
              : 'article'
        }
      />
    )
  }

  if (renderEntries.length === 0) {
    return (
      <EntryListEmpty
        selectedFeedId={selectedFeedId}
        activeView={activeView}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
      />
    )
  }

  return (
    <>
      {activeView === FeedViewTypeEnum.SocialMedia ? (
        <SocialLayout
          socialRows={socialRows}
          scrollRef={scrollRef}
          renderEntries={renderEntries}
          selectedEntryId={selectedEntryId}
          feedTitleById={feedTitleById}
          feedImageById={feedImageById}
          feedSiteUrlById={feedSiteUrlById}
          feedUrlById={feedUrlById}
          dimRead={dimRead}
          cacheKey={`social:${virtualizerCacheKey}`}
          onSelectEntry={onSelectEntry}
          onMarkAboveRead={onMarkAboveRead}
          onMarkBelowRead={onMarkBelowRead}
          onContextMenu={onContextMenu}
          onMediaAllFailed={onMediaAllFailed}
        />
      ) : isGridMode ? (
        <GridLayout
          gridRows={gridRows}
          scrollRef={scrollRef}
          selectedEntryId={selectedEntryId}
          feedTitleById={feedTitleById}
          feedImageById={feedImageById}
          activeView={activeView}
          hasMore={hasMoreGridEntries}
          cacheKey={`grid:${virtualizerCacheKey}`}
          onSelectEntry={onSelectEntry}
        />
      ) : (
        <LinearListLayout
          entries={renderEntries}
          virtualizerEntries={virtualizerEntries}
          useVirtual={useVirtualLinearList}
          scrollRef={scrollRef}
          selectedEntryId={selectedEntryId}
          feedTitleById={feedTitleById}
          dimRead={dimRead}
          imageProxy={imageProxy}
          cacheKey={`linear:${virtualizerCacheKey}`}
          onSelectEntry={onSelectEntry}
          onContextMenu={onContextMenu}
        />
      )}

      {isLoadingMore && (
        <div className="text-text-tertiary flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
    </>
  )
}
