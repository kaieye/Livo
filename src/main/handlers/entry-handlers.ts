import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import {
  getEntries,
  getEntryById,
  updateEntry,
  markAllRead as dbMarkAllRead,
  searchEntries,
  getFeverItemMappingsByLocalEntry,
  getFeverAccountById,
  upsertFeverItemMapping,
  type EntryListResult,
} from '../database'
import { createFeverClient } from '../services/fever-client'

function feverWriteBack(
  entryId: string,
  state: 'read' | 'unread' | 'saved' | 'unsaved',
): void {
  const mappings = getFeverItemMappingsByLocalEntry(entryId)
  for (const mapping of mappings) {
    const account = getFeverAccountById(mapping.accountId)
    if (!account?.enabled) continue
    const client = createFeverClient(
      account.baseUrl,
      account.username,
      account.apiKey,
    )
    client
      .markItem(mapping.feverItemId, state)
      .then(() => {
        const updates: Record<string, boolean> = {}
        if (state === 'read' || state === 'unread')
          updates.remoteIsRead = state === 'read'
        if (state === 'saved' || state === 'unsaved')
          updates.remoteIsStarred = state === 'saved'
        upsertFeverItemMapping({ ...mapping, ...updates })
      })
      .catch(() => {
        // Best-effort; reconciled on next sync
      })
  }
}

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
      feverWriteBack(entryId, isRead ? 'read' : 'unread')
      return { success: true }
    },
  )

  // Mark all entries as read
  ipcMain.handle(IPC.ENTRY_MARK_ALL_READ, (_event, feedId?: string) => {
    // Get entries before marking to trigger write-back
    const unreadEntries = getEntries({
      feedId,
      unreadOnly: true,
      limit: 10000,
      skipDedupe: true,
    })
    dbMarkAllRead(feedId)
    for (const entry of unreadEntries.entries) {
      feverWriteBack(entry.id, 'read')
    }
    return { success: true }
  })

  // Toggle star
  ipcMain.handle(IPC.ENTRY_TOGGLE_STAR, (_event, entryId: string) => {
    const entry = getEntryById(entryId)
    if (!entry) return { success: false, isStarred: false }
    const newStarred = !entry.isStarred
    updateEntry(entryId, { isStarred: newStarred })
    feverWriteBack(entryId, newStarred ? 'saved' : 'unsaved')
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
