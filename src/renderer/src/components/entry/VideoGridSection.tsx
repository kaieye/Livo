import { memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Entry } from '../../../../shared/types'
import { ScrollArea } from '../ui/ScrollArea'
import { VideoEntryCard } from './EntryViewCards'

export const VideoGridSection = memo(function VideoGridSection({
  videoGridRef,
  videoColumnCount,
  entries,
  feedMetaByEntryId,
  videoPagination,
  currentPage,
  totalPages,
  onSelectEntry,
  onContextMenuEntry,
  onPrevPage,
  onNextPage,
  onScroll,
}: {
  videoGridRef: React.RefObject<HTMLDivElement | null>
  videoColumnCount: number
  entries: Entry[]
  feedMetaByEntryId: Map<string, { title?: string; imageUrl?: string }>
  videoPagination: boolean
  currentPage: number
  totalPages: number
  onSelectEntry: (entry: Entry) => void
  onContextMenuEntry: (e: React.MouseEvent, entryId: string) => void
  onPrevPage: () => void
  onNextPage: () => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea
        rootClassName="flex-1 min-h-0"
        viewportClassName="h-full min-h-0 overflow-y-auto pb-3"
        onScroll={onScroll}
      >
        <div
          ref={videoGridRef}
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${videoColumnCount}, minmax(0, 1fr))`,
          }}
        >
          {entries.map((entry) => (
            <VideoEntryCard
              key={entry.id}
              entry={entry}
              feedMeta={feedMetaByEntryId.get(entry.id)}
              onSelectEntry={onSelectEntry}
              onContextMenuEntry={onContextMenuEntry}
            />
          ))}
        </div>
      </ScrollArea>

      {videoPagination && totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-surface-tertiary bg-white pb-1 pt-3 dark:border-surface-dark-tertiary dark:bg-surface-dark">
          <button
            onClick={onPrevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-surface-dark-secondary"
          >
            <ChevronLeft size={16} />
            {t('common.prevPage')}
          </button>
          <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-surface-dark-secondary"
          >
            {t('common.nextPage')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
})
