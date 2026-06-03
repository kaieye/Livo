import { createAppStore } from './helpers'
import type {
  Entry,
  EntryListResult,
  ReaderSnapshot,
  ReaderSnapshotRequest,
} from '../../../shared/types'
import { isMirrorHost } from '../../../shared/url-detect'

const ENTRY_LIST_CACHE_TTL_MS = 2 * 60 * 1000
const EMPTY_ENTRY_LIST_CACHE_TTL_MS = 5000
const ENTRY_LIST_CACHE_VERSION = 3
const DEFAULT_ENTRY_PAGE_SIZE = 10
const MAX_ENTRY_PAGE_SIZE = 1000
const entryListCache = new Map<
  string,
  { result: EntryListResult; cachedAt: number }
>()
const entryListInFlight = new Map<string, Promise<EntryListResult>>()
const entryDetailCache = new Map<string, Entry>()
const entryDetailInFlight = new Map<string, Promise<Entry | null>>()
const entrySnapshotCache = new Map<string, Entry>()

/** Returns cached result if fresh, or an existing in-flight promise. null = miss. */
function getCachedListResult(cacheKey: string): EntryListResult | null {
  const cached = entryListCache.get(cacheKey)
  if (!cached) return null
  const ttl = cached.result?.entries?.length
    ? ENTRY_LIST_CACHE_TTL_MS
    : EMPTY_ENTRY_LIST_CACHE_TTL_MS
  if (Date.now() - cached.cachedAt < ttl) return cached.result
  return null
}

/** Fetch with in-flight dedup and cache store. */
async function fetchAndCacheList(
  cacheKey: string,
  fetchFn: () => Promise<EntryListResult>,
): Promise<EntryListResult> {
  const existing = entryListInFlight.get(cacheKey)
  if (existing) return existing
  const promise = fetchFn()
    .then((result) => {
      entryListCache.set(cacheKey, { result, cachedAt: Date.now() })
      return result
    })
    .finally(() => {
      entryListInFlight.delete(cacheKey)
    })
  entryListInFlight.set(cacheKey, promise)
  return promise
}

function isPicnobMirrorHost(host: string): boolean {
  return isMirrorHost(host)
}

function extractAssetIdFromRaw(input?: string): string {
  const raw = (input || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === '/get') {
      const nested = parsed.searchParams.get('url') || ''
      if (nested) return extractAssetIdFromRaw(nested)
    }
    if (
      (host.includes('pixnoy') ||
        host.includes('picnob') ||
        host.includes('pixwox') ||
        host.includes('piokok')) &&
      parsed.searchParams.has('o')
    ) {
      const encoded = parsed.searchParams.get('o') || ''
      if (encoded) {
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
        const padded =
          normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
        try {
          const decoded = atob(padded)
          const nested = decoded.match(/https?:\/\/\S+/i)?.[0] || decoded
          const fromNested = extractAssetIdFromRaw(nested)
          if (fromNested) return fromNested
        } catch {
          // Ignore.
        }
      }
    }
    const direct = raw.match(/_(\d{14,})_/)
    if (direct?.[1]) return direct[1]
    const decodedUrl = decodeURIComponent(raw)
    const decodedMatch = decodedUrl.match(/_(\d{14,})_/)
    if (decodedMatch?.[1]) return decodedMatch[1]
  } catch {
    // Ignore parse/decode failures and try direct fallback below.
  }
  const direct = raw.match(/_(\d{14,})_/)
  if (direct?.[1]) return direct[1]
  return ''
}

function getEntryClientDedupKey(entry: Entry): string {
  const candidates: string[] = [
    entry.url || '',
    entry.imageUrl || '',
    entry.content || '',
    entry.summary || '',
  ]
  for (const m of entry.media || [])
    candidates.push(m.url || '', m.previewUrl || '')
  for (const s of candidates) {
    const asset = extractAssetIdFromRaw(s)
    if (asset) return `asset:${entry.feedId}:${asset}`
  }
  const title = (entry.title || '').toLowerCase().trim().slice(0, 80)
  const bucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  return `fallback:${entry.feedId}:${title}:${bucket}`
}

function entryClientRichness(entry: Entry): number {
  return (
    (entry.media?.length || 0) * 400 +
    (entry.content?.length || 0) +
    (entry.summary?.length || 0) +
    (entry.imageUrl ? 40 : 0)
  )
}

function dedupeEntriesForClient(entries: Entry[]): Entry[] {
  const byKey = new Map<string, Entry>()
  for (const entry of entries) {
    const key = getEntryClientDedupKey(entry)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entry)
      continue
    }
    byKey.set(
      key,
      entryClientRichness(entry) >= entryClientRichness(existing)
        ? entry
        : existing,
    )
  }
  return Array.from(byKey.values()).sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )
}

function buildListCacheKey(options?: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
}): string {
  const feedIds = [...(options?.feedIds || [])].sort()
  return JSON.stringify({
    v: ENTRY_LIST_CACHE_VERSION,
    feedId: options?.feedId || '',
    feedIds,
    starred: !!options?.starred,
    unreadOnly: !!options?.unreadOnly,
    limit: options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE,
    offset: options?.offset ?? 0,
  })
}

function sortEntriesByPublishedDesc(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )
}

function mergeEntriesById(prev: Entry[], next: Entry[]): Entry[] {
  if (next.length === 0) return prev
  const byId = new Map<string, Entry>()
  for (const entry of prev) byId.set(entry.id, entry)
  for (const entry of next) byId.set(entry.id, entry)
  return sortEntriesByPublishedDesc(Array.from(byId.values()))
}

function cacheEntrySnapshot(entry: Entry): Entry {
  entrySnapshotCache.set(entry.id, entry)
  return entry
}

function cacheEntrySnapshots(entries: Entry[]): Entry[] {
  for (const entry of entries) cacheEntrySnapshot(entry)
  return entries
}

function mergeEntrySnapshotState(detail: Entry, snapshot: Entry): Entry {
  return {
    ...detail,
    feedId: snapshot.feedId,
    title: snapshot.title,
    url: snapshot.url,
    author: snapshot.author ?? detail.author,
    authorAvatar: snapshot.authorAvatar ?? detail.authorAvatar,
    imageUrl: snapshot.imageUrl ?? detail.imageUrl,
    media: snapshot.media ?? detail.media,
    publishedAt: snapshot.publishedAt,
    isRead: snapshot.isRead,
    isStarred: snapshot.isStarred,
    readProgress: snapshot.readProgress ?? detail.readProgress,
    notifiedAt: snapshot.notifiedAt ?? detail.notifiedAt,
    createdAt: snapshot.createdAt,
  }
}

function getCachedEntryDetail(entryId: string): Entry | undefined {
  const detail = entryDetailCache.get(entryId)
  if (!detail) return undefined
  const snapshot = entrySnapshotCache.get(entryId)
  return snapshot ? mergeEntrySnapshotState(detail, snapshot) : detail
}

function cacheEntryDetail(entry: Entry): Entry {
  entryDetailCache.set(entry.id, entry)
  return getCachedEntryDetail(entry.id) ?? entry
}

function getInitialSelectedEntry(entry: Entry): Entry {
  const snapshot = cacheEntrySnapshot(entry)
  const detail = getCachedEntryDetail(entry.id)
  return detail ? mergeEntrySnapshotState(detail, snapshot) : snapshot
}

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

function patchCachedEntry(entryId: string, patch: Partial<Entry>): void {
  const snapshot = entrySnapshotCache.get(entryId)
  if (snapshot) entrySnapshotCache.set(entryId, { ...snapshot, ...patch })
  const detail = entryDetailCache.get(entryId)
  if (detail) entryDetailCache.set(entryId, { ...detail, ...patch })
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

  const existing = entryDetailInFlight.get(entryId)
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
      entryDetailInFlight.delete(entryId)
    })

  entryDetailInFlight.set(entryId, request)
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
      Math.min(options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE, MAX_ENTRY_PAGE_SIZE),
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
      Math.min(options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE, MAX_ENTRY_PAGE_SIZE),
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
        limit: options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE,
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
        state.paginationPageSize || DEFAULT_ENTRY_PAGE_SIZE,
        MAX_ENTRY_PAGE_SIZE,
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
    entryListCache.clear()
    entryListInFlight.clear()
    entrySnapshotCache.clear()
  },

  refreshEntryMedia: async (entryId, feedId) => {
    if (!entryId || !feedId) return null
    try {
      await window.api.feeds.refresh(feedId)
    } catch {
      // Keep going so we still try to read whatever the backend currently has.
    }

    entryListCache.clear()

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
        if (entryDetailCache.has(id)) return
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
