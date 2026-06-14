import { openExternalUrlSafe } from '../../services/external-url'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import { useStoreShallow } from '../../store/helpers'
import { ContextMenu, useEntryContextActions } from '../ui/ContextMenu'
import { resolveEntryBrowserOpenUrl } from './entry-list/utils/entry-media'
import type { Entry } from '../../../../shared/types'

export interface EntryContextMenuWrapperProps {
  entry: Entry
  entryIndex: number
  totalEntries: number
  x: number
  y: number
  onClose: () => void
  onMarkAboveRead: () => void
  onMarkBelowRead: () => void
  onSharePoster: () => void
}

export function EntryContextMenuWrapper({
  entry,
  entryIndex,
  totalEntries,
  x,
  y,
  onClose,
  onMarkAboveRead,
  onMarkBelowRead,
  onSharePoster,
}: EntryContextMenuWrapperProps) {
  const { markRead, toggleStar } = useStoreShallow(useEntryStore, (s) => ({
    markRead: s.markRead,
    toggleStar: s.toggleStar,
  }))
  const feedSiteUrl = useFeedStore(
    (state) => state.feeds.find((feed) => feed.id === entry.feedId)?.siteUrl,
  )
  const browserOpenUrl = resolveEntryBrowserOpenUrl(entry)
  const actions = useEntryContextActions({
    entry,
    entryIndex,
    totalEntries,
    onMarkRead: markRead,
    onToggleStar: toggleStar,
    onMarkAboveRead,
    onMarkBelowRead,
    onOpenInBrowser: browserOpenUrl
      ? () => {
          void openExternalUrlSafe(browserOpenUrl)
        }
      : undefined,
    feedSiteUrl,
    onSharePoster,
  })
  return <ContextMenu x={x} y={y} onClose={onClose} actions={actions} />
}
