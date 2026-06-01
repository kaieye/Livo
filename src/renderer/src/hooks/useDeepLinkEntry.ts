import { useEffect, useMemo, useState } from 'react'

import { useEntryStore } from '../store/entry-store'
import type { Entry } from '../../../shared/types'

export type DeepLinkEntryState = 'idle' | 'loading' | 'missing'

export interface UseDeepLinkEntryResult {
  /** Selected entry iff it matches the requested `entryId`; null otherwise. */
  activeEntry: Entry | null
  state: DeepLinkEntryState
}

// Hydrates `selectedEntry` for standalone routes (ArticleDetail / VideoPlayer /
// ImageViewer). Fast path reads the in-memory store list so star/read mutations
// stay live; slow path falls back to `window.api.entries.get` so deep-links and
// cold starts work. Drives `selectEntry` so store-driven components downstream
// (e.g. EntryContent) keep their current contract.
export function useDeepLinkEntry(
  entryId: string | undefined,
): UseDeepLinkEntryResult {
  const storeEntries = useEntryStore((s) => s.entries)
  const selectedEntry = useEntryStore((s) => s.selectedEntry)
  const selectEntry = useEntryStore((s) => s.selectEntry)

  const [state, setState] = useState<DeepLinkEntryState>('idle')

  const inStoreEntry = useMemo<Entry | null>(
    () =>
      entryId ? (storeEntries.find((e) => e.id === entryId) ?? null) : null,
    [storeEntries, entryId],
  )

  useEffect(() => {
    if (!entryId) {
      setState('missing')
      return
    }

    if (inStoreEntry) {
      setState('idle')
      void selectEntry(inStoreEntry)
      return
    }

    // If the entry was pre-populated into selectedEntry by a discover preview,
    // skip the DB fetch — the entry already has the correct id.
    if (selectedEntry && selectedEntry.id === entryId) {
      setState('idle')
      return
    }

    let cancelled = false
    setState('loading')
    void window.api.entries
      .get(entryId)
      .then((entry) => {
        if (cancelled) return
        if (!entry) {
          setState('missing')
          return
        }
        setState('idle')
        void selectEntry(entry)
      })
      .catch(() => {
        if (cancelled) return
        setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [entryId, inStoreEntry, selectEntry, selectedEntry])

  const activeEntry =
    selectedEntry && selectedEntry.id === entryId ? selectedEntry : null

  return { activeEntry, state }
}
