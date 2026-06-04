import { createAppStore } from './helpers'
import type {
  Entry,
  EntryListResult,
  ReaderSnapshot,
  ReaderSnapshotRequest,
} from '../../../shared/types'
import {
  buildListCacheKey,
  getCachedListResult,
  fetchAndCacheList,
  getDefaultPageSize,
  getMaxPageSize,
  getCachedEntryDetail,
  cacheEntryDetail,
  getEntryDetailInFlight,
  setEntryDetailInFlight,
  deleteEntryDetailInFlight,
  cacheEntrySnapshot,
  cacheEntrySnapshots,
  patchCachedEntry,
  getInitialSelectedEntry,
  clearAllCaches,
  invalidateListCache,
  hasEntryDetail,
  sortEntriesByPublishedDesc,
  mergeEntriesById,
} from '../lib/entry-cache'
import { dedupeEntriesForClient } from '../lib/entry-client-dedupe'

function buildReaderSnapshotInput(options?: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  cursor?: string | null
}): ReaderSnapshotRequest {
  const scope: ReaderSnapshotRequest['scope'] = options?.starred
    ? { type: 'starred' }
    : options?.feedId
      ? { type: 'feed', feedId: options.feedId }
      : { type: 'all', feedIds: options?.feedIds }
  return {
    scope,
    limit: options?.limit,
    cursor: options?.cursor,
    unreadOnly: options?.unreadOnly,
    compact: true,
    maxContentLength: 520,
  }
}

interface EntryState {
  entries: Entry[]
  selectedEntry: Entry | null
  isSelectedEntryHydrating: boolean
  isLoading: boolean
  isLoadingMore: boolean
  hasMoreEntries: boolean
  snapshotNextCursor: string | null
  paginationSource: 'entries' | 'snapshot'
  paginationQueryKey: string
  paginationOptions: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
  } | null
  paginationPageSize: number
  searchQuery: string

  // Actions
  loadEntries: (options?: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
    limit?: number
  }) => Promise<void>
  loadSnapshot: (options?: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
    limit?: number
  }) => Promise<ReaderSnapshot | null>
  prefetchEntries: (options?: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
    limit?: number
  }) => Promise<void>
  loadMoreEntries: () => Promise<void>
  clearListCache: () => void
  refreshEntryMedia: (entryId: string, feedId: string) => Promise<Entry | null>
  selectEntry: (entry: Entry | null) => Promise<void>
  prefetchEntryDetails: (entryIds: string[]) => Promise<void>
  markRead: (entryId: string, isRead: boolean) => Promise<void>
  markAllRead: (feedId?: string) => Promise<void>
  markAboveRead: (entryId: string) => Promise<void>
  markBelowRead: (entryId: string) => Promise<void>
  toggleStar: (entryId: string) => Promise<void>
  saveProgress: (entryId: string, readProgress: number) => Promise<void>
  markListened: (entryId: string, isListened: boolean) => Promise<void>
  saveListenProgress: (entryId: string, listenProgress: number) => Promise<void>
  search: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
}

async function fetchEntryDetail(entryId: string): Promise<Entry | null> {
  if (!entryId) return null
  const cached = getCachedEntryDetail(entryId)
  if (cached) return cached

  const existing = getEntryDetailInFlight(entryId)
  if (existing) return existing

  const request = window.api.entries
    .get(entryId)
    .then((entry) => {
      if (entry) {
        cacheEntryDetail(entry)
      }
      return entry ? (getCachedEntryDetail(entry.id) ?? entry) : entry
    })
    .catch(() => null)
    .finally(() => {
      deleteEntryDetailInFlight(entryId)
    })

  setEntryDetailInFlight(entryId, request)
  return request
}

export const useEntryStore = createAppStore<EntryState>((set, get) => ({
  entries: [],
  selectedEntry: null,
  isSelectedEntryHydrating: false,
  isLoading: false,
  isLoadingMore: false,
  hasMoreEntries: false,
  snapshotNextCursor: null,
  paginationSource: 'entries',
  paginationQueryKey: '',
  paginationOptions: null,
  paginationPageSize: 0,
  searchQuery: '',

  loadEntries: async (options) => {
    const pageSize = Math.max(
      1,
      Math.min(options?.limit ?? getDefaultPageSize(), getMaxPageSize()),
    )
    const normalizedOptions = {
      feedId: options?.feedId,
      feedIds: options?.feedIds,
      starred: options?.starred,
      unreadOnly: options?.unreadOnly,
      limit: pageSize,
      offset: 0,
    }
    const queryKey = JSON.stringify({
      feedId: normalizedOptions.feedId || '',
      feedIds: [...(normalizedOptions.feedIds || [])].sort(),
      starred: !!normalizedOptions.starred,
      unreadOnly: !!normalizedOptions.unreadOnly,
      pageSize,
    })
    set({
      paginationQueryKey: queryKey,
      paginationOptions: {
        feedId: normalizedOptions.feedId,
        feedIds: normalizedOptions.feedIds,
        starred: normalizedOptions.starred,
        unreadOnly: normalizedOptions.unreadOnly,
      },
      paginationPageSize: pageSize,
      paginationSource: 'entries',
      snapshotNextCursor: null,
    })

    const cacheKey = buildListCacheKey(normalizedOptions)
    const cachedHit = getCachedListResult(cacheKey)
    if (cachedHit) {
      set({
        entries: cacheEntrySnapshots(cachedHit.entries),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: cachedHit.hasMore,
      })
      return
    }

    set({ isLoading: true, isLoadingMore: false, hasMoreEntries: false })
    try {
      const result = await fetchAndCacheList(cacheKey, () =>
        window.api.entries.list({
          feedId: normalizedOptions.feedId,
          feedIds: normalizedOptions.feedIds,
          starred: normalizedOptions.starred,
          unreadOnly: normalizedOptions.unreadOnly,
          limit: normalizedOptions.limit,
          offset: 0,
          compact: true,
          maxContentLength: 520,
          skipDedupe: false,
        }),
      )
      const isLatestQuery = get().paginationQueryKey === queryKey
      if (!isLatestQuery) return
      set({
        entries: cacheEntrySnapshots(
          sortEntriesByPublishedDesc(result.entries),
        ),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: result.hasMore,
      })
    } catch {
      set({ isLoading: false, isLoadingMore: false })
    }
  },

  loadSnapshot: async (options) => {
    const pageSize = Math.max(
      1,
      Math.min(options?.limit ?? getDefaultPageSize(), getMaxPageSize()),
    )
    const normalizedOptions = {
      feedId: options?.feedId,
      feedIds: options?.feedIds,
      starred: options?.starred,
      unreadOnly: options?.unreadOnly,
      limit: pageSize,
    }
    const queryKey = JSON.stringify({
      snapshot: true,
      feedId: normalizedOptions.feedId || '',
      feedIds: [...(normalizedOptions.feedIds || [])].sort(),
      starred: !!normalizedOptions.starred,
      unreadOnly: !!normalizedOptions.unreadOnly,
      pageSize,
    })
    set({
      isLoading: true,
      isLoadingMore: false,
      hasMoreEntries: false,
      paginationQueryKey: queryKey,
      paginationOptions: {
        feedId: normalizedOptions.feedId,
        feedIds: normalizedOptions.feedIds,
        starred: normalizedOptions.starred,
        unreadOnly: normalizedOptions.unreadOnly,
      },
      paginationPageSize: pageSize,
      paginationSource: 'snapshot',
      snapshotNextCursor: null,
    })

    try {
      const snapshot = await window.api.reader.snapshot(
        buildReaderSnapshotInput(normalizedOptions),
      )
      if (get().paginationQueryKey !== queryKey) return null
      set({
        entries: cacheEntrySnapshots(
          sortEntriesByPublishedDesc(snapshot.entries),
        ),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: snapshot.nextCursor !== null,
        snapshotNextCursor: snapshot.nextCursor,
      })
      return snapshot
    } catch {
      if (get().paginationQueryKey === queryKey) {
        set({ isLoading: false, isLoadingMore: false })
      }
      return null
    }
  },

  prefetchEntries: async (options) => {
    const cacheKey = buildListCacheKey(options)
    if (getCachedListResult(cacheKey)) return
    const result = await fetchAndCacheList(cacheKey, () =>
      window.api.entries.list({
        feedId: options?.feedId,
        feedIds: options?.feedIds,
        starred: options?.starred,
        unreadOnly: options?.unreadOnly,
        limit: options?.limit ?? getDefaultPageSize(),
        compact: true,
        maxContentLength: 520,
        skipDedupe: false,
      }),
    )
    cacheEntrySnapshots(result.entries)
  },

  loadMoreEntries: async () => {
    const state = get()
    if (state.isLoading || state.isLoadingMore || !state.hasMoreEntries) return
    const baseOptions = state.paginationOptions
    const pageSize = Math.max(
      1,
      Math.min(
        state.paginationPageSize || getDefaultPageSize(),
        getMaxPageSize(),
      ),
    )
    if (!baseOptions) return

    if (state.paginationSource === 'snapshot') {
      const cursor = state.snapshotNextCursor
      if (!cursor) return
      set({ isLoadingMore: true })
      try {
        const snapshot = await window.api.reader.snapshot(
          buildReaderSnapshotInput({
            ...baseOptions,
            limit: pageSize,
            cursor,
          }),
        )
        set((current) => ({
          entries: mergeEntriesById(
            current.entries,
            cacheEntrySnapshots(snapshot.entries),
          ),
          isLoadingMore: false,
          hasMoreEntries: snapshot.nextCursor !== null,
          snapshotNextCursor: snapshot.nextCursor,
        }))
      } catch {
        set({ isLoadingMore: false })
      }
      return
    }

    const offset = state.entries.length
    const pageOptions = {
      ...baseOptions,
      limit: pageSize,
      offset,
    }
    const cacheKey = buildListCacheKey(pageOptions)

    set({ isLoadingMore: true })

    try {
      const cachedHit = getCachedListResult(cacheKey)
      const nextPage =
        cachedHit ??
        (await fetchAndCacheList(cacheKey, () =>
          window.api.entries.list({
            feedId: pageOptions.feedId,
            feedIds: pageOptions.feedIds,
            starred: pageOptions.starred,
            unreadOnly: pageOptions.unreadOnly,
            limit: pageOptions.limit,
            offset: pageOptions.offset,
            compact: true,
            maxContentLength: 520,
            skipDedupe: false,
          }),
        ))
      if (!cachedHit) cacheEntrySnapshots(nextPage.entries)

      set((current) => ({
        entries: mergeEntriesById(
          current.entries,
          cacheEntrySnapshots(nextPage.entries),
        ),
        isLoadingMore: false,
        hasMoreEntries: nextPage.hasMore,
      }))
    } catch {
      set({ isLoadingMore: false })
    }
  },

  clearListCache: () => {
    clearAllCaches()
  },

  refreshEntryMedia: async (entryId, feedId) => {
    if (!entryId || !feedId) return null
    try {
      await window.api.feeds.refresh(feedId)
    } catch {
      // Keep going so we still try to read whatever the backend currently has.
    }

    invalidateListCache()

    const refreshed = await window.api.entries.get(entryId).catch(() => null)
    if (!refreshed) return null

    const nextDetail = cacheEntryDetail(refreshed)
    cacheEntrySnapshot(nextDetail)

    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === entryId ? nextDetail : entry,
      ),
      selectedEntry:
        state.selectedEntry?.id === entryId ? nextDetail : state.selectedEntry,
    }))

    return nextDetail
  },

  selectEntry: async (entry) => {
    if (!entry) {
      set({ selectedEntry: null, isSelectedEntryHydrating: false })
      return
    }

    const selectedEntry = getInitialSelectedEntry(entry)
    const cachedEntry = getCachedEntryDetail(entry.id)
    set({
      selectedEntry,
      isSelectedEntryHydrating: !cachedEntry,
    })
    if (entry && !entry.isRead) {
      await window.api.entries.markRead(entry.id, true)
      // Update local state
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entry.id ? { ...e, isRead: true } : e,
        ),
        selectedEntry:
          state.selectedEntry?.id === entry.id
            ? { ...state.selectedEntry, isRead: true }
            : state.selectedEntry,
      }))
      patchCachedEntry(entry.id, { isRead: true })
    }
    const fullEntry = await fetchEntryDetail(entry.id)
    set((state) => {
      if (state.selectedEntry?.id !== entry.id) return state
      return {
        ...state,
        selectedEntry: fullEntry ?? state.selectedEntry,
        isSelectedEntryHydrating: false,
      }
    })
  },

  prefetchEntryDetails: async (entryIds) => {
    const ids = Array.from(new Set(entryIds.filter(Boolean)))
    if (ids.length === 0) return
    await Promise.allSettled(
      ids.map(async (id) => {
        if (hasEntryDetail(id)) return
        const detail = await fetchEntryDetail(id)
        if (!detail) return
        cacheEntrySnapshot(detail)
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? detail : entry,
          ),
          selectedEntry:
            state.selectedEntry?.id === id ? detail : state.selectedEntry,
        }))
      }),
    )
  },

  markRead: async (entryId, isRead) => {
    await window.api.entries.markRead(entryId, isRead)
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId ? { ...e, isRead } : e,
      ),
      selectedEntry:
        state.selectedEntry?.id === entryId
          ? { ...state.selectedEntry, isRead }
          : state.selectedEntry,
    }))
    patchCachedEntry(entryId, { isRead })
  },

  markAllRead: async (feedId) => {
    await window.api.entries.markAllRead(feedId)
    set((state) => ({
      entries: state.entries.map((e) =>
        !feedId || e.feedId === feedId ? { ...e, isRead: true } : e,
      ),
      selectedEntry:
        !feedId || state.selectedEntry?.feedId === feedId
          ? state.selectedEntry
            ? { ...state.selectedEntry, isRead: true }
            : state.selectedEntry
          : state.selectedEntry,
    }))
    for (const entry of get().entries) {
      if (!feedId || entry.feedId === feedId) {
        patchCachedEntry(entry.id, { isRead: true })
      }
    }
  },

  markAboveRead: async (entryId) => {
    const { entries } = get()
    const idx = entries.findIndex((e) => e.id === entryId)
    if (idx <= 0) return
    const toMark = entries.slice(0, idx).filter((e) => !e.isRead)
    for (const e of toMark) {
      await window.api.entries.markRead(e.id, true)
    }
    set((state) => ({
      entries: state.entries.map((e, i) =>
        i < idx ? { ...e, isRead: true } : e,
      ),
    }))
  },

  markBelowRead: async (entryId) => {
    const { entries } = get()
    const idx = entries.findIndex((e) => e.id === entryId)
    if (idx < 0 || idx >= entries.length - 1) return
    const toMark = entries.slice(idx + 1).filter((e) => !e.isRead)
    for (const e of toMark) {
      await window.api.entries.markRead(e.id, true)
    }
    set((state) => ({
      entries: state.entries.map((e, i) =>
        i > idx ? { ...e, isRead: true } : e,
      ),
    }))
  },

  toggleStar: async (entryId) => {
    const result = await window.api.entries.toggleStar(entryId)
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId ? { ...e, isStarred: result.isStarred } : e,
      ),
      selectedEntry:
        state.selectedEntry?.id === entryId
          ? { ...state.selectedEntry, isStarred: result.isStarred }
          : state.selectedEntry,
    }))
    patchCachedEntry(entryId, { isStarred: result.isStarred })
  },

  saveProgress: async (entryId, readProgress) => {
    await window.api.entries.saveProgress(entryId, readProgress)
    set((state) => {
      const updated = state.entries.map((e) =>
        e.id === entryId ? { ...e, readProgress } : e,
      )
      const selected =
        state.selectedEntry?.id === entryId
          ? { ...state.selectedEntry, readProgress }
          : state.selectedEntry
      return { entries: updated, selectedEntry: selected }
    })
    patchCachedEntry(entryId, { readProgress })
  },

  markListened: async (entryId, isListened) => {
    await window.api.entries.markListened(entryId, isListened)
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId ? { ...e, isListened } : e,
      ),
      selectedEntry:
        state.selectedEntry?.id === entryId
          ? { ...state.selectedEntry, isListened }
          : state.selectedEntry,
    }))
    patchCachedEntry(entryId, { isListened })
  },

  saveListenProgress: async (entryId, listenProgress) => {
    await window.api.entries.saveListenProgress(entryId, listenProgress)
    set((state) => {
      const updated = state.entries.map((e) =>
        e.id === entryId ? { ...e, listenProgress } : e,
      )
      const selected =
        state.selectedEntry?.id === entryId
          ? { ...state.selectedEntry, listenProgress }
          : state.selectedEntry
      return { entries: updated, selectedEntry: selected }
    })
    patchCachedEntry(entryId, { listenProgress })
  },

  search: async (query) => {
    if (!query.trim()) {
      // Reload normal entries
      await get().loadEntries()
      return
    }
    set({
      isLoading: true,
      isLoadingMore: false,
      hasMoreEntries: false,
      snapshotNextCursor: null,
      paginationSource: 'entries',
      paginationQueryKey: '',
      paginationOptions: null,
      paginationPageSize: 0,
    })
    try {
      const entries = await window.api.entries.search(query)
      set({
        entries: cacheEntrySnapshots(dedupeEntriesForClient(entries)),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: false,
      })
    } catch {
      set({ isLoading: false, isLoadingMore: false })
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },
}))
