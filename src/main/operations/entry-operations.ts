/**
 * Shared entry operations used by both IPC handlers and Agent tools.
 */
import { getDb } from '../database'
import { feverWriteBack } from '../services/fever/fever-sync'
import type { Entry } from '../../shared/types'

export interface MarkAllReadResult {
  markedCount: number
}

export interface UpdateEntryStateResult {
  entry: Entry | null
  changed: boolean
}

/** Update an entry and trigger Fever write-back when read/star state changes. */
export function updateEntryWithWriteBack(
  entryId: string,
  updates: { isRead?: boolean; isStarred?: boolean },
): UpdateEntryStateResult {
  const entry = getDb().entries.getEntryById(entryId)
  if (!entry) return { entry: null, changed: false }

  const nextUpdates: { isRead?: boolean; isStarred?: boolean } = {}
  if (updates.isRead !== undefined && updates.isRead !== entry.isRead) {
    nextUpdates.isRead = updates.isRead
  }
  if (
    updates.isStarred !== undefined &&
    updates.isStarred !== entry.isStarred
  ) {
    nextUpdates.isStarred = updates.isStarred
  }

  const changed = Object.keys(nextUpdates).length > 0
  if (!changed) return { entry, changed: false }

  getDb().entries.updateEntry(entryId, nextUpdates)
  writeBackEntryState(entryId, nextUpdates)

  return {
    entry: { ...entry, ...nextUpdates },
    changed,
  }
}

function writeBackEntryState(
  entryId: string,
  updates: { isRead?: boolean; isStarred?: boolean },
): void {
  if (updates.isRead !== undefined) {
    feverWriteBack(entryId, updates.isRead ? 'read' : 'unread')
  }
  if (updates.isStarred !== undefined) {
    feverWriteBack(entryId, updates.isStarred ? 'saved' : 'unsaved')
  }
}

/**
 * Mark all entries as read for the given feed (or all feeds).
 * Includes Fever write-back for each affected entry so remote state
 * stays in sync regardless of whether the operation was initiated
 * via UI (IPC) or AI (Agent tool).
 */
export function markAllRead(feedId?: string): MarkAllReadResult {
  const unreadEntries = getDb().entries.getEntries({
    feedId,
    unreadOnly: true,
    limit: 10000,
    skipDedupe: true,
  })
  getDb().entries.markAllRead(feedId)
  for (const entry of unreadEntries.entries) {
    feverWriteBack(entry.id, 'read')
  }
  return { markedCount: unreadEntries.entries.length }
}
