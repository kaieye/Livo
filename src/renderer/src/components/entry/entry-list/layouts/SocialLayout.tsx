import { useTranslation } from 'react-i18next'
import type { Entry } from '../../../../../../shared/types'
import type { EntryListSocialRow } from '../../../../lib/entry-list-model'
import { SocialMediaItem } from '../items/SocialMediaItem'
import { useSocialVirtualizer } from '../hooks/useEntryVirtualizer'
import type { RefObject } from 'react'

export interface SocialLayoutProps {
  socialRows: EntryListSocialRow[]
  scrollRef: RefObject<HTMLDivElement | null>
  renderEntries: Entry[]
  selectedEntryId: string | null
  feedTitleById: Map<string, string>
  feedImageById: Map<string, string | undefined>
  feedSiteUrlById: Map<string, string | undefined>
  feedUrlById: Map<string, string | undefined>
  dimRead: boolean
  onSelectEntry: (entry: Entry) => void
  onMarkAboveRead: (entryId: string) => void
  onMarkBelowRead: (entryId: string) => void
  onContextMenu: (e: React.MouseEvent, entryId: string) => void
  onMediaAllFailed: (entry: Entry) => void
}

export function SocialLayout({
  socialRows,
  scrollRef,
  renderEntries,
  selectedEntryId,
  feedTitleById,
  feedImageById,
  feedSiteUrlById,
  feedUrlById,
  dimRead,
  onSelectEntry,
  onMarkAboveRead,
  onMarkBelowRead,
  onContextMenu,
  onMediaAllFailed,
}: SocialLayoutProps) {
  const { t } = useTranslation()
  const virtualizer = useSocialVirtualizer({
    socialRows,
    scrollElement: scrollRef,
  })
  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div
      className="relative"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualRows.map((row) => {
        const item = socialRows[row.index]
        if (!item) return null
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {item.type === 'header' ? (
              <div className="dark:bg-surface-dark/80 flex h-9 items-center border-b border-transparent bg-white/80 backdrop-blur-sm">
                <div className="dark:text-text-dark text-text m-auto flex w-full max-w-[clamp(45ch,60vw,65ch)] select-none gap-3 pl-4 text-sm font-bold">
                  <span>
                    {t(
                      item.labelKey,
                      item.labelKey === 'entryList.daysAgo'
                        ? { days: item.label.match(/\d+/)?.[0] }
                        : undefined,
                    ) || item.label}
                  </span>
                </div>
              </div>
            ) : (
              <SocialMediaItem
                entry={item.entry}
                isActive={selectedEntryId === item.entry.id}
                onSelect={() => onSelectEntry(item.entry)}
                feedTitle={feedTitleById.get(item.entry.feedId)}
                feedImage={feedImageById.get(item.entry.feedId)}
                feedSiteUrl={feedSiteUrlById.get(item.entry.feedId)}
                feedUrl={feedUrlById.get(item.entry.feedId)}
                entryIndex={item.entryIndex}
                totalEntries={renderEntries.length}
                onMarkAboveRead={() => onMarkAboveRead(item.entry.id)}
                onMarkBelowRead={() => onMarkBelowRead(item.entry.id)}
                onContextMenu={(e) => onContextMenu(e, item.entry.id)}
                dimRead={dimRead}
                onMediaAllFailed={() => onMediaAllFailed(item.entry)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
