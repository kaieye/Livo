import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import {
  getEntries,
  getEntryById,
  updateEntry,
  markAllRead as dbMarkAllRead,
  searchEntries,
  type EntryListResult,
} from '../database'

export function registerEntryHandlers(): void {
  // List entries
  ipcMain.handle(
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
      return getEntries(options)
    },
  )

  // Get single entry
  ipcMain.handle(IPC.ENTRY_GET, async (_event, entryId: string) => {
    return getEntryById(entryId) || null
  })

  // Mark entry as read
  ipcMain.handle(
    IPC.ENTRY_MARK_READ,
    (_event, entryId: string, isRead: boolean) => {
      updateEntry(entryId, { isRead })
      return { success: true }
    },
  )

  // Mark all entries as read
  ipcMain.handle(IPC.ENTRY_MARK_ALL_READ, (_event, feedId?: string) => {
    dbMarkAllRead(feedId)
    return { success: true }
  })

  // Toggle star
  ipcMain.handle(IPC.ENTRY_TOGGLE_STAR, (_event, entryId: string) => {
    const entry = getEntryById(entryId)
    if (!entry) return { success: false, isStarred: false }
    const newStarred = !entry.isStarred
    updateEntry(entryId, { isStarred: newStarred })
    return { success: true, isStarred: newStarred }
  })

  // Save reading progress
  ipcMain.handle(
    IPC.ENTRY_SAVE_PROGRESS,
    (_event, entryId: string, readProgress: number) => {
      updateEntry(entryId, { readProgress })
      return { success: true }
    },
  )

  // Search entries
  ipcMain.handle(IPC.ENTRY_SEARCH, (_event, query: string, limit?: number) => {
    return searchEntries(query, limit)
  })
}
