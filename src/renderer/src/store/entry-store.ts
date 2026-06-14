import { createAppStore } from './helpers'
import type {
  Entry,
  ReaderSnapshot,
  ReaderSnapshotRequest,
} from '../../../shared/types'
import {
  readDefaultHomeSnapshotCache,
  writeDefaultHomeSnapshotCache,
} from '../lib/reader-snapshot-cache'
import {
  buildListCacheKey,
  getCachedListResult,
  setCachedListResult,
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
import { recordReadActivity } from '../lib/reading-activity'
import {
  buildEntryByIdMap,
  findEntryById,
  getEntriesAbove,
  getEntriesBelow,
  getEntriesByFeedId as selectEntriesByFeedId,
  patchEntryState,
} from '../lib/entry-selectors'

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

  // Selectors
  getEntryById: (entryId: string | null | undefined) => Entry | null
  getEntryByIdMap: () => Map<string, Entry>
  getEntriesByFeedId: (feedId: string | null | undefined) => Entry[]

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
  hydrateSnapshotCache: (options?: {
    feedId?: string
    feedIds?: string[]
    starred?: boolean
    unreadOnly?: boolean
    limit?: number
  }) => ReaderSnapshot | null
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

  getEntryById: (entryId) => {
    if (!entryId) return null
    const selectedEntry = get().selectedEntry
    if (selectedEntry?.id === entryId) return selectedEntry
    return findEntryById(get().entries, entryId)
  },

  getEntryByIdMap: () => buildEntryByIdMap(get().entries),

  getEntriesByFeedId: (feedId) => selectEntriesByFeedId(get().entries, feedId),

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
    const shouldResetEntries = get().paginationQueryKey !== queryKey
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

    // 当前视图没有订阅源时，直接返回空结果
    if (
      !normalizedOptions.feedId &&
      !normalizedOptions.starred &&
      normalizedOptions.feedIds &&
      normalizedOptions.feedIds.length === 0
    ) {
      set({
        entries: [],
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: false,
      })
      return
    }

    const cacheKey = buildListCacheKey(normalizedOptions)
    const cachedHit = getCachedListResult(cacheKey, normalizedOptions.limit)
    if (cachedHit) {
      set({
        entries: cacheEntrySnapshots(cachedHit.entries),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: cachedHit.hasMore,
      })
      return
    }

    set({
      entries: shouldResetEntries ? [] : get().entries,
      isLoading: shouldResetEntries || get().entries.length === 0,
      isLoadingMore: false,
      hasMoreEntries: false,
    })
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

    // 当前视图没有订阅源时，直接返回空结果，避免不必要的 IPC 请求
    if (
      !normalizedOptions.feedId &&
      !normalizedOptions.starred &&
      normalizedOptions.feedIds &&
      normalizedOptions.feedIds.length === 0
    ) {
      set({
        entries: [],
        isLoading: false,
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
      return {
        entries: [],
        feeds: [],
        counts: {
          totalFeeds: 0,
          totalUnread: 0,
          unreadByFeedId: {},
          scopeUnread: 0,
        },
        nextCursor: null,
      }
    }

    const listCacheKey = buildListCacheKey(normalizedOptions)
    const cachedHit = getCachedListResult(listCacheKey, pageSize)
    const snapshotInput = buildReaderSnapshotInput(normalizedOptions)
    const shouldResetEntries = get().paginationQueryKey !== queryKey

    // Cache hit: show entries immediately, skip IPC entirely.
    if (cachedHit) {
      set({
        entries: cacheEntrySnapshots(cachedHit.entries),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: cachedHit.hasMore,
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
      return null
    }

    set({
      entries: shouldResetEntries ? [] : get().entries,
      isLoading: shouldResetEntries || get().entries.length === 0,
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
      const snapshot = await window.api.reader.snapshot(snapshotInput)
      if (get().paginationQueryKey !== queryKey) return null
      const sorted = sortEntriesByPublishedDesc(snapshot.entries)
      setCachedListResult(listCacheKey, {
        entries: sorted,
        hasMore: snapshot.nextCursor !== null,
      })
      writeDefaultHomeSnapshotCache(snapshotInput, snapshot)
      set({
        entries: cacheEntrySnapshots(sorted),
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

  hydrateSnapshotCache: (options) => {
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
    const snapshotInput = buildReaderSnapshotInput(normalizedOptions)
    const snapshot = readDefaultHomeSnapshotCache(snapshotInput)
    if (!snapshot) return null

    const queryKey = JSON.stringify({
      snapshot: true,
      feedId: normalizedOptions.feedId || '',
      feedIds: [...(normalizedOptions.feedIds || [])].sort(),
      starred: !!normalizedOptions.starred,
      unreadOnly: !!normalizedOptions.unreadOnly,
      pageSize,
    })
    const sorted = sortEntriesByPublishedDesc(snapshot.entries)
    set({
      entries: cacheEntrySnapshots(sorted),
      isLoading: false,
      isLoadingMore: false,
      hasMoreEntries: snapshot.nextCursor !== null,
      paginationQueryKey: queryKey,
      paginationOptions: {
        feedId: normalizedOptions.feedId,
        feedIds: normalizedOptions.feedIds,
        starred: normalizedOptions.starred,
        unreadOnly: normalizedOptions.unreadOnly,
      },
      paginationPageSize: pageSize,
      paginationSource: 'snapshot',
      snapshotNextCursor: snapshot.nextCursor,
    })
    return snapshot
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
      const queryKey = state.paginationQueryKey
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
        const current = get()
        if (
          current.paginationSource !== 'snapshot' ||
          current.paginationQueryKey !== queryKey ||
          current.snapshotNextCursor !== cursor
        ) {
          return
        }
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
        const current = get()
        if (
          current.paginationSource === 'snapshot' &&
          current.paginationQueryKey === queryKey &&
          current.snapshotNextCursor === cursor
        ) {
          set({ isLoadingMore: false })
        }
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

    set((state) => patchEntryState(state, entryId, () => nextDetail))

    return nextDetail
  },

  selectEntry: async (entry) => {
    if (!entry) {
      if (!get().selectedEntry && !get().isSelectedEntryHydrating) return
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
      recordReadActivity(1)
      // Update local state
      set((state) => patchEntryState(state, entry.id, { isRead: true }))
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
        set((state) => patchEntryState(state, id, () => detail))
      }),
    )
  },

  markRead: async (entryId, isRead) => {
    const wasRead = get().getEntryById(entryId)?.isRead
    await window.api.entries.markRead(entryId, isRead)
    if (isRead && !wasRead) recordReadActivity(1)
    set((state) => patchEntryState(state, entryId, { isRead }))
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
    const toMark = getEntriesAbove(entries, entryId).filter((e) => !e.isRead)
    if (toMark.length === 0) return
    for (const e of toMark) {
      await window.api.entries.markRead(e.id, true)
    }
    const ids = new Set(toMark.map((entry) => entry.id))
    set((state) => ({
      entries: state.entries.map((e) =>
        ids.has(e.id) ? { ...e, isRead: true } : e,
      ),
    }))
  },

  markBelowRead: async (entryId) => {
    const { entries } = get()
    const toMark = getEntriesBelow(entries, entryId).filter((e) => !e.isRead)
    if (toMark.length === 0) return
    for (const e of toMark) {
      await window.api.entries.markRead(e.id, true)
    }
    const ids = new Set(toMark.map((entry) => entry.id))
    set((state) => ({
      entries: state.entries.map((e) =>
        ids.has(e.id) ? { ...e, isRead: true } : e,
      ),
    }))
  },

  toggleStar: async (entryId) => {
    const result = await window.api.entries.toggleStar(entryId)
    set((state) =>
      patchEntryState(state, entryId, { isStarred: result.isStarred }),
    )
    patchCachedEntry(entryId, { isStarred: result.isStarred })
  },

  saveProgress: async (entryId, readProgress) => {
    await window.api.entries.saveProgress(entryId, readProgress)
    set((state) => patchEntryState(state, entryId, { readProgress }))
    patchCachedEntry(entryId, { readProgress })
  },

  markListened: async (entryId, isListened) => {
    await window.api.entries.markListened(entryId, isListened)
    set((state) => patchEntryState(state, entryId, { isListened }))
    patchCachedEntry(entryId, { isListened })
  },

  saveListenProgress: async (entryId, listenProgress) => {
    await window.api.entries.saveListenProgress(entryId, listenProgress)
    set((state) => patchEntryState(state, entryId, { listenProgress }))
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
