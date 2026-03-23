import { memo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { Entry } from "../../../../shared/types"
import { ScrollArea } from "../ui/ScrollArea"
import { VideoEntryCard } from "./EntryViewCards"

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
    <div className="h-full min-h-0 flex flex-col">
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
        <div className="shrink-0 flex items-center justify-center gap-3 pt-3 pb-1 border-t border-surface-tertiary dark:border-surface-dark-tertiary bg-white dark:bg-surface-dark">
          <button
            onClick={onPrevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          >
            <ChevronLeft size={16} />
            {t("common.prevPage")}
          </button>
          <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          >
            {t("common.nextPage")}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
})
