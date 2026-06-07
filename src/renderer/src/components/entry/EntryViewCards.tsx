import { memo } from 'react'

import type { Entry } from '../../../../shared/types'
import { GridCard } from './entry-list/items/GridCard'
import { SocialMediaItem } from './entry-list/items/SocialMediaItem'

interface FeedMeta {
  title?: string
  imageUrl?: string
  siteUrl?: string
  url?: string
}

export const TimelineEntryCard = memo(function TimelineEntryCard({
  entry,
  feedMeta,
  isActive,
  entryIndex,
  totalEntries,
  dimRead,
  onSelectEntry,
  onDoubleClickEntry,
  onMarkAboveRead,
  onMarkBelowRead,
  onContextMenuEntry,
  onOpenBilibiliInPage,
}: {
  entry: Entry
  feedMeta?: FeedMeta
  isActive: boolean
  entryIndex: number
  totalEntries: number
  dimRead?: boolean
  onSelectEntry: (entry: Entry) => void
  onDoubleClickEntry: (entry: Entry) => void
  onMarkAboveRead: (entryId: string) => void
  onMarkBelowRead: (entryId: string) => void
  onContextMenuEntry: (e: React.MouseEvent, entryId: string) => void
  onOpenBilibiliInPage?: (entry: Entry, url: string) => void
}) {
  return (
    <SocialMediaItem
      entry={entry}
      isActive={isActive}
      onSelect={() => onSelectEntry(entry)}
      onDoubleClick={() => onDoubleClickEntry(entry)}
      feedTitle={feedMeta?.title}
      feedImage={feedMeta?.imageUrl}
      feedSiteUrl={feedMeta?.siteUrl}
      feedUrl={feedMeta?.url}
      entryIndex={entryIndex}
      totalEntries={totalEntries}
      onMarkAboveRead={() => onMarkAboveRead(entry.id)}
      onMarkBelowRead={() => onMarkBelowRead(entry.id)}
      onContextMenu={(e) => onContextMenuEntry(e, entry.id)}
      dimRead={dimRead}
      onOpenBilibiliInPage={onOpenBilibiliInPage}
    />
  )
})

export const VideoEntryCard = memo(function VideoEntryCard({
  entry,
  feedMeta,
  onSelectEntry,
  onContextMenuEntry,
}: {
  entry: Entry
  feedMeta?: FeedMeta
  onSelectEntry: (entry: Entry) => void
  onContextMenuEntry: (e: React.MouseEvent, entryId: string) => void
}) {
  return (
    <GridCard
      entry={entry}
      isActive={false}
      onSelect={() => onSelectEntry(entry)}
      feedTitle={feedMeta?.title}
      feedImage={feedMeta?.imageUrl}
      isVideo={true}
      showSummary={false}
      onContextMenu={(e) => onContextMenuEntry(e, entry.id)}
    />
  )
})
