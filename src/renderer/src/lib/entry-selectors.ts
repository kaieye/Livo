import type { Entry } from '../../../shared/types'

export function buildEntryByIdMap(
  entries: readonly Entry[],
): Map<string, Entry> {
  return new Map(entries.map((entry) => [entry.id, entry] as const))
}

export function findEntryById(
  entries: readonly Entry[],
  entryId: string | null | undefined,
): Entry | null {
  if (!entryId) return null
  return entries.find((entry) => entry.id === entryId) ?? null
}

export function getEntriesByFeedId(
  entries: readonly Entry[],
  feedId: string | null | undefined,
): Entry[] {
  if (!feedId) return []
  return entries.filter((entry) => entry.feedId === feedId)
}

export function getEntriesAbove(
  entries: readonly Entry[],
  entryId: string,
): Entry[] {
  const index = entries.findIndex((entry) => entry.id === entryId)
  return index > 0 ? entries.slice(0, index) : []
}

export function getEntriesBelow(
  entries: readonly Entry[],
  entryId: string,
): Entry[] {
  const index = entries.findIndex((entry) => entry.id === entryId)
  return index >= 0 && index < entries.length - 1
    ? entries.slice(index + 1)
    : []
}

type EntryPatch = Partial<Entry> | ((entry: Entry) => Entry)

function applyEntryPatch(entry: Entry, patch: EntryPatch): Entry {
  return typeof patch === 'function' ? patch(entry) : { ...entry, ...patch }
}

export function patchEntryState(
  state: { entries: Entry[]; selectedEntry: Entry | null },
  entryId: string,
  patch: EntryPatch,
): { entries: Entry[]; selectedEntry: Entry | null } {
  let didPatchEntries = false
  const entries = state.entries.map((entry) => {
    if (entry.id !== entryId) return entry
    didPatchEntries = true
    return applyEntryPatch(entry, patch)
  })
  const selectedEntry =
    state.selectedEntry?.id === entryId
      ? applyEntryPatch(state.selectedEntry, patch)
      : state.selectedEntry
  return {
    entries: didPatchEntries ? entries : state.entries,
    selectedEntry,
  }
}
