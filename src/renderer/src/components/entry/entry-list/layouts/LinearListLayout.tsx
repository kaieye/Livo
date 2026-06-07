import type { Entry } from '../../../../../../shared/types'
import { EntryCard } from '../items/EntryCard'
import { useLinearVirtualizer } from '../hooks/useEntryVirtualizer'
import type { RefObject } from 'react'

export interface LinearListLayoutProps {
  entries: Entry[]
  virtualizerEntries: Entry[]
  useVirtual: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  selectedEntryId: string | null
  feedTitleById: Map<string, string>
  dimRead: boolean
  imageProxy: boolean
  onSelectEntry: (entry: Entry) => void
  onContextMenu: (e: React.MouseEvent, entryId: string) => void
}

export function LinearListLayout({
  entries,
  virtualizerEntries,
  useVirtual,
  scrollRef,
  selectedEntryId,
  feedTitleById,
  dimRead,
  imageProxy,
  onSelectEntry,
  onContextMenu,
}: LinearListLayoutProps) {
  const virtualizer = useLinearVirtualizer({
    entries: virtualizerEntries,
    scrollElement: scrollRef,
  })
  const virtualItems = virtualizer.getVirtualItems()

  const renderEntry = (entry: Entry) => (
    <EntryCard
      entry={entry}
      isActive={selectedEntryId === entry.id}
      onSelect={() => onSelectEntry(entry)}
      feedTitle={feedTitleById.get(entry.feedId)}
      dimRead={dimRead}
      imageProxy={imageProxy}
      onContextMenu={(e) => onContextMenu(e, entry.id)}
    />
  )

  if (useVirtual) {
    return (
      <div
        className="relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((item) => {
          const entry = virtualizerEntries[item.index]
          if (!entry) return null
          return (
            <div
              key={entry.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {renderEntry(entry)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.id}>{renderEntry(entry)}</div>
      ))}
    </>
  )
}
