import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { VirtualItem } from '@tanstack/react-virtual'

import type { Entry } from '../../../../shared/types'
import type { DateGroup } from '../../lib/date-groups'
import { TimelineEntryCard } from './EntryViewCards'

interface FeedMeta {
  title?: string
  imageUrl?: string
  siteUrl?: string
  url?: string
}

export const TimelineSection = memo(function TimelineSection({
  shouldUseVirtualTimeline,
  virtualItems,
  totalVirtualSize,
  measureElement,
  timelineEntries,
  renderedEntries,
  groupedEntries,
  timelineIndexById,
  feedMetaByEntryId,
  activeEntryId,
  dimRead,
  isLoadingMore,
  onSelectEntry,
  onDoubleClickEntry,
  onMarkAboveRead,
  onMarkBelowRead,
  onContextMenuEntry,
  onOpenBilibiliInPage,
}: {
  shouldUseVirtualTimeline: boolean
  virtualItems: VirtualItem[]
  totalVirtualSize: number
  measureElement: (element: Element | null) => void
  timelineEntries: Entry[]
  renderedEntries: Entry[]
  groupedEntries: DateGroup[]
  timelineIndexById: Map<string, number>
  feedMetaByEntryId: Map<string, FeedMeta>
  activeEntryId?: string
  dimRead?: boolean
  isLoadingMore: boolean
  onSelectEntry: (entry: Entry) => void
  onDoubleClickEntry: (entry: Entry) => void
  onMarkAboveRead: (entryId: string) => void
  onMarkBelowRead: (entryId: string) => void
  onContextMenuEntry: (e: React.MouseEvent, entryId: string) => void
  onOpenBilibiliInPage?: (entry: Entry, url: string) => void
}) {
  const { t } = useTranslation()

  const renderCard = (entry: Entry, entryIndex: number) => (
    <TimelineEntryCard
      key={entry.id}
      entry={entry}
      feedMeta={feedMetaByEntryId.get(entry.id)}
      isActive={activeEntryId === entry.id}
      entryIndex={entryIndex}
      totalEntries={timelineEntries.length}
      dimRead={dimRead}
      onSelectEntry={onSelectEntry}
      onDoubleClickEntry={onDoubleClickEntry}
      onMarkAboveRead={onMarkAboveRead}
      onMarkBelowRead={onMarkBelowRead}
      onContextMenuEntry={onContextMenuEntry}
      onOpenBilibiliInPage={onOpenBilibiliInPage}
    />
  )

  return (
    <div className="py-2">
      {shouldUseVirtualTimeline ? (
        <div className="relative" style={{ height: `${totalVirtualSize}px` }}>
          {virtualItems.map((item) => {
            const entry = timelineEntries[item.index]
            if (!entry) return null
            return (
              <div
                key={entry.id}
                data-index={item.index}
                ref={measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {renderCard(entry, item.index)}
              </div>
            )
          })}
        </div>
      ) : groupedEntries.length > 0 ? (
        groupedEntries.map((group) => (
          <div key={group.labelKey + group.label}>
            <div className="dark:bg-surface-dark/80 sticky top-0 z-[1] flex h-9 items-center border-b border-transparent bg-white/80 backdrop-blur-sm">
              <div className="dark:text-text-dark text-text m-auto flex w-full max-w-[clamp(45ch,60vw,65ch)] select-none gap-3 pl-2 text-base font-bold">
                <span>
                  {t(
                    group.labelKey,
                    group.labelKey === 'entryList.daysAgo'
                      ? { days: group.label.match(/\d+/)?.[0] }
                      : undefined,
                  ) || group.label}
                </span>
              </div>
            </div>
            {group.entries.map((entry) =>
              renderCard(entry, timelineIndexById.get(entry.id) ?? 0),
            )}
          </div>
        ))
      ) : (
        renderedEntries.map((entry) =>
          renderCard(entry, timelineIndexById.get(entry.id) ?? 0),
        )
      )}

      {!shouldUseVirtualTimeline &&
        renderedEntries.length < timelineEntries.length && (
          <div className="text-text-tertiary py-3 text-center text-xs">
            {`Loading ${renderedEntries.length}/${timelineEntries.length}...`}
          </div>
        )}
      {isLoadingMore && (
        <div className="text-text-tertiary inline-flex w-full items-center justify-center gap-2 py-3 text-center text-xs">
          <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Loading more...</span>
        </div>
      )}
    </div>
  )
})
