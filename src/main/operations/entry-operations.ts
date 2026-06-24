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

export interface EntryStateUpdate {
  entryId: string
  isRead?: boolean
  isStarred?: boolean
}

export interface BatchUpdateEntryStateResult {
  results: Array<UpdateEntryStateResult & { entryId: string }>
  matchedCount: number
  changedCount: number
  missingCount: number
}

type EntryRepositoryLike = ReturnType<typeof getDb>['entries']
type BatchEntryReadRepository = EntryRepositoryLike & {
  getEntriesByIds: (ids: string[]) => Map<string, Entry>
}
type BatchEntryStateUpdateRepository = EntryRepositoryLike & {
  updateEntryState: (
    id: string,
    updates: { isRead?: boolean; isStarred?: boolean },
  ) => void
}
type BatchEntryStateUpdateManyRepository = EntryRepositoryLike & {
  updateEntriesState: (
    updates: Array<{
      id: string
      isRead?: boolean
      isStarred?: boolean
    }>,
  ) => void
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

export function batchUpdateEntryStateWithWriteBack(
  updates: EntryStateUpdate[],
): BatchUpdateEntryStateResult {
  const results: Array<UpdateEntryStateResult & { entryId: string }> = []
  const db = getDb()
  const entries = db.entries
  const canBatchRead = hasBatchEntryRead(entries)
  const canBatchUpdate = hasBatchEntryStateUpdate(entries)
  const canBatchUpdateMany = hasBatchEntryStateUpdateMany(entries)
  const existingById = canBatchRead
    ? entries.getEntriesByIds(uniqueEntryIds(updates))
    : new Map<string, Entry>()
  const dbUpdates: Array<{
    id: string
    updates: { isRead?: boolean; isStarred?: boolean }
  }> = []

  for (const update of updates) {
    const entryId = update.entryId.trim()
    const entry = canBatchRead
      ? existingById.get(entryId)
      : entries.getEntryById(entryId)
    if (!entry) {
      results.push({ entryId, entry: null, changed: false })
      continue
    }

    const nextUpdates = changedEntryState(entry, update)
    const changed = Object.keys(nextUpdates).length > 0
    if (!changed) {
      results.push({ entryId, entry, changed: false })
      continue
    }

    dbUpdates.push({ id: entryId, updates: nextUpdates })
    results.push({
      entryId,
      entry: { ...entry, ...nextUpdates },
      changed,
    })
  }

  if (dbUpdates.length > 0) {
    if (canBatchUpdateMany) {
      entries.updateEntriesState(
        dbUpdates.map((update) => ({ id: update.id, ...update.updates })),
      )
    } else {
      for (const update of dbUpdates) {
        if (canBatchUpdate) {
          entries.updateEntryState(update.id, update.updates)
        } else {
          entries.updateEntry(update.id, update.updates)
        }
      }
    }
    for (const update of dbUpdates) {
      writeBackEntryState(update.id, update.updates)
    }
  }

  return {
    results,
    matchedCount: results.filter((result) => !!result.entry).length,
    changedCount: results.filter((result) => result.changed).length,
    missingCount: results.filter((result) => !result.entry).length,
  }
}

function uniqueEntryIds(updates: EntryStateUpdate[]): string[] {
  return Array.from(
    new Set(
      updates
        .map((update) => update.entryId.trim())
        .filter((entryId) => entryId.length > 0),
    ),
  )
}

function changedEntryState(
  entry: Entry,
  updates: { isRead?: boolean; isStarred?: boolean },
): { isRead?: boolean; isStarred?: boolean } {
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
  return nextUpdates
}

function hasBatchEntryRead(
  entries: EntryRepositoryLike,
): entries is BatchEntryReadRepository {
  return (
    typeof (entries as { getEntriesByIds?: unknown }).getEntriesByIds ===
    'function'
  )
}

function hasBatchEntryStateUpdate(
  entries: EntryRepositoryLike,
): entries is BatchEntryStateUpdateRepository {
  return (
    typeof (entries as { updateEntryState?: unknown }).updateEntryState ===
    'function'
  )
}

function hasBatchEntryStateUpdateMany(
  entries: EntryRepositoryLike,
): entries is BatchEntryStateUpdateManyRepository {
  return (
    typeof (entries as { updateEntriesState?: unknown }).updateEntriesState ===
    'function'
  )
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
