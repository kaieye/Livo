import { Loader2 } from 'lucide-react'
import type { Entry, FeedViewType } from '../../../../../../shared/types'
import { FeedViewType as FeedViewTypeEnum } from '../../../../../../shared/types'
import { GridCard } from '../items/GridCard'
import { useGridVirtualizer } from '../hooks/useEntryVirtualizer'
import type { RefObject } from 'react'

export interface GridLayoutProps {
  gridRows: Entry[][]
  scrollRef: RefObject<HTMLDivElement | null>
  selectedEntryId: string | null
  feedTitleById: Map<string, string>
  feedImageById: Map<string, string | undefined>
  activeView: FeedViewType | null
  hasMore: boolean
  cacheKey: string
  onSelectEntry: (entry: Entry) => void
}

export function GridLayout({
  gridRows,
  scrollRef,
  selectedEntryId,
  feedTitleById,
  feedImageById,
  activeView,
  hasMore,
  cacheKey,
  onSelectEntry,
}: GridLayoutProps) {
  const virtualizer = useGridVirtualizer({
    gridRows,
    scrollElement: scrollRef,
    cacheKey,
  })
  const virtualRows = virtualizer.getVirtualItems()

  const isVideo = activeView === FeedViewTypeEnum.Videos
  const showSummary = activeView !== FeedViewTypeEnum.Videos

  return (
    <>
      <div
        className="relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((row) => {
          const rowEntries = gridRows[row.index]
          if (!rowEntries || rowEntries.length === 0) return null
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full px-4"
              style={{
                transform: `translateY(${row.start}px)`,
                paddingTop: row.index === 0 ? '1rem' : '0.375rem',
              }}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {rowEntries.map((entry) => (
                  <GridCard
                    key={entry.id}
                    entry={entry}
                    isActive={selectedEntryId === entry.id}
                    onSelect={() => onSelectEntry(entry)}
                    feedTitle={feedTitleById.get(entry.feedId)}
                    feedImage={feedImageById.get(entry.feedId)}
                    isVideo={isVideo}
                    showSummary={showSummary}
                  />
                ))}
                {rowEntries.length === 1 && <div aria-hidden="true" />}
              </div>
            </div>
          )
        })}
      </div>
      {hasMore && (
        <div className="text-text-tertiary flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
    </>
  )
}
