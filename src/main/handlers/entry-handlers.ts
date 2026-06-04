import { registerChannel } from '../ipc/register-channel'
import { IPC } from '../../shared/types'
import { getDb } from '../database'
import type { EntryListResult } from '../database'
import { feverWriteBack } from '../services/fever/fever-sync'
import { markAllRead } from '../operations/entry-operations'

/** Update an entry and trigger Fever write-back when read/star state changes. */
function updateEntryWithWriteBack(
  entryId: string,
  updates: { isRead?: boolean; isStarred?: boolean },
): void {
  getDb().entries.updateEntry(entryId, updates)
  if (updates.isRead !== undefined) {
    feverWriteBack(entryId, updates.isRead ? 'read' : 'unread')
  }
  if (updates.isStarred !== undefined) {
    feverWriteBack(entryId, updates.isStarred ? 'saved' : 'unsaved')
  }
}

export function registerEntryHandlers(): void {
  // List entries
  registerChannel(
    IPC.ENTRY_LIST,
    async (
      _event,
      options: {
        feedId?: string
        feedIds?: string[]
        starred?: boolean
        unreadOnly?: boolean
        limit?: number
        offset?: number
        compact?: boolean
        maxContentLength?: number
        skipDedupe?: boolean
      },
    ): Promise<EntryListResult> => {
      return getDb().entries.getEntries(options)
    },
  )

  // Get single entry
  registerChannel(IPC.ENTRY_GET, async (_event, entryId: string) => {
    return getDb().entries.getEntryById(entryId) || null
  })

  // Mark entry as read
  registerChannel(
    IPC.ENTRY_MARK_READ,
    (_event, entryId: string, isRead: boolean) => {
      updateEntryWithWriteBack(entryId, { isRead })
      return { success: true }
    },
  )

  // Mark all entries as read
  registerChannel(IPC.ENTRY_MARK_ALL_READ, (_event, feedId?: string) => {
    markAllRead(feedId)
    return { success: true }
  })

  // Toggle star
  registerChannel(IPC.ENTRY_TOGGLE_STAR, (_event, entryId: string) => {
    const entry = getDb().entries.getEntryById(entryId)
    if (!entry) return { success: false, isStarred: false }
    const newStarred = !entry.isStarred
    updateEntryWithWriteBack(entryId, { isStarred: newStarred })
    return { success: true, isStarred: newStarred }
  })

  // Save reading progress
  registerChannel(
    IPC.ENTRY_SAVE_PROGRESS,
    (_event, entryId: string, readProgress: number) => {
      getDb().entries.updateEntry(entryId, { readProgress })
      return { success: true }
    },
  )

  // Mark entry as listened
  registerChannel(
    IPC.ENTRY_MARK_LISTENED,
    (_event, entryId: string, isListened: boolean) => {
      getDb().entries.updateEntry(entryId, { isListened })
      return { success: true }
    },
  )

  // Save listen progress
  registerChannel(
    IPC.ENTRY_SAVE_LISTEN_PROGRESS,
    (_event, entryId: string, listenProgress: number) => {
      getDb().entries.updateEntry(entryId, { listenProgress })
      return { success: true }
    },
  )

  // Search entries
  registerChannel(IPC.ENTRY_SEARCH, (_event, query: string, limit?: number) => {
    return getDb().entries.searchEntries(query, limit)
  })
}
