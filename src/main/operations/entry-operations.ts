/**
 * Shared entry operations used by both IPC handlers and Agent tools.
 */
import { getDb } from '../database'
import { feverWriteBack } from '../services/fever/fever-sync'

export interface MarkAllReadResult {
  markedCount: number
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
