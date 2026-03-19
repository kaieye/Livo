import { create } from "zustand"
import type { Entry } from "../../../shared/types"

const ENTRY_LIST_CACHE_TTL_MS = 2 * 60 * 1000
const EMPTY_ENTRY_LIST_CACHE_TTL_MS = 5000
const ENTRY_LIST_CACHE_VERSION = 3
const DEFAULT_ENTRY_PAGE_SIZE = 10
const MAX_ENTRY_PAGE_SIZE = 1000
const entryListCache = new Map<string, { entries: Entry[]; cachedAt: number }>()
const entryListInFlight = new Map<string, Promise<Entry[]>>()

function isPicnobMirrorHost(host: string): boolean {
  const lower = host.toLowerCase()
  return (
    lower === "media.picnob.info" ||
    lower === "media.pixnoy.com" ||
    lower.includes("piokok.com") ||
    lower.includes("picnob.com") ||
    lower.includes("pixnoy.com") ||
    lower.includes("pixwox.com") ||
    lower.includes("sp1.pixnoy.com") ||
    lower.includes("sp2.pixnoy.com") ||
    lower.includes("sp3.pixnoy.com") ||
    lower.includes("sp4.pixnoy.com") ||
    lower.includes("sp5.pixnoy.com")
  )
}

function extractAssetIdFromRaw(input?: string): string {
  const raw = (input || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === "/get") {
      const nested = parsed.searchParams.get("url") || ""
      if (nested) return extractAssetIdFromRaw(nested)
    }
    if ((host.includes("pixnoy") || host.includes("picnob")) && parsed.searchParams.has("o")) {
      const encoded = parsed.searchParams.get("o") || ""
      if (encoded) {
        const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
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
  return ""
}

function getEntryClientDedupKey(entry: Entry): string {
  const candidates: string[] = [entry.url || "", entry.imageUrl || "", entry.content || "", entry.summary || ""]
  for (const m of entry.media || []) candidates.push(m.url || "", m.previewUrl || "")
  for (const s of candidates) {
    const asset = extractAssetIdFromRaw(s)
    if (asset) return `asset:${entry.feedId}:${asset}`
  }
  const title = (entry.title || "").toLowerCase().trim().slice(0, 80)
  const bucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  return `fallback:${entry.feedId}:${title}:${bucket}`
}

function entryClientRichness(entry: Entry): number {
  return (entry.media?.length || 0) * 400 + (entry.content?.length || 0) + (entry.summary?.length || 0) + (entry.imageUrl ? 40 : 0)
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
    byKey.set(key, entryClientRichness(entry) >= entryClientRichness(existing) ? entry : existing)
  }
  return Array.from(byKey.values()).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
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
    feedId: options?.feedId || "",
    feedIds,
    starred: !!options?.starred,
    unreadOnly: !!options?.unreadOnly,
    limit: options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE,
    offset: options?.offset ?? 0,
  })
}

function sortEntriesByPublishedDesc(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
}

function mergeEntriesById(prev: Entry[], next: Entry[]): Entry[] {
  if (next.length === 0) return prev
  const byId = new Map<string, Entry>()
  for (const entry of prev) byId.set(entry.id, entry)
  for (const entry of next) byId.set(entry.id, entry)
  return sortEntriesByPublishedDesc(Array.from(byId.values()))
}

interface EntryState {
  entries: Entry[]
  selectedEntry: Entry | null
  isLoading: boolean
  isLoadingMore: boolean
  hasMoreEntries: boolean
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
  markRead: (entryId: string, isRead: boolean) => Promise<void>
  markAllRead: (feedId?: string) => Promise<void>
  markAboveRead: (entryId: string) => Promise<void>
  markBelowRead: (entryId: string) => Promise<void>
  toggleStar: (entryId: string) => Promise<void>
  search: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
}

export const useEntryStore = create<EntryState>((set, get) => ({
  entries: [],
  selectedEntry: null,
  isLoading: false,
  isLoadingMore: false,
  hasMoreEntries: false,
  paginationQueryKey: "",
  paginationOptions: null,
  paginationPageSize: 0,
  searchQuery: "",

  loadEntries: async (options) => {
    const pageSize = Math.max(1, Math.min(options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE, MAX_ENTRY_PAGE_SIZE))
    const normalizedOptions = {
      feedId: options?.feedId,
      feedIds: options?.feedIds,
      starred: options?.starred,
      unreadOnly: options?.unreadOnly,
      limit: pageSize,
      offset: 0,
    }
    const queryKey = JSON.stringify({
      feedId: normalizedOptions.feedId || "",
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
    })

    const cacheKey = buildListCacheKey(normalizedOptions)
    const cached = entryListCache.get(cacheKey)
    const ttl = cached?.entries?.length ? ENTRY_LIST_CACHE_TTL_MS : EMPTY_ENTRY_LIST_CACHE_TTL_MS
    if (cached && Date.now() - cached.cachedAt < ttl) {
      set({
        entries: cached.entries,
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: cached.entries.length >= pageSize,
      })
      return
    }

    set({ isLoading: true, isLoadingMore: false, hasMoreEntries: false })
    try {
      const existing = entryListInFlight.get(cacheKey)
      const entriesPromise =
        existing ??
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
        }).then((entries) => {
          entryListCache.set(cacheKey, { entries, cachedAt: Date.now() })
          return entries
        }).finally(() => {
          entryListInFlight.delete(cacheKey)
        })
      if (!existing) entryListInFlight.set(cacheKey, entriesPromise)
      const entries = await entriesPromise
      const isLatestQuery = get().paginationQueryKey === queryKey
      if (!isLatestQuery) return
      set({
        entries: sortEntriesByPublishedDesc(entries),
        isLoading: false,
        isLoadingMore: false,
        hasMoreEntries: entries.length >= pageSize,
      })
    } catch {
      set({ isLoading: false, isLoadingMore: false })
    }
  },

  prefetchEntries: async (options) => {
    const cacheKey = buildListCacheKey(options)
    const cached = entryListCache.get(cacheKey)
    const ttl = cached?.entries?.length ? ENTRY_LIST_CACHE_TTL_MS : EMPTY_ENTRY_LIST_CACHE_TTL_MS
    if (cached && Date.now() - cached.cachedAt < ttl) return
    if (entryListInFlight.has(cacheKey)) {
      await entryListInFlight.get(cacheKey)
      return
    }

    const promise = window.api.entries.list({
      feedId: options?.feedId,
      feedIds: options?.feedIds,
      starred: options?.starred,
      unreadOnly: options?.unreadOnly,
      limit: options?.limit ?? DEFAULT_ENTRY_PAGE_SIZE,
      compact: true,
      maxContentLength: 520,
      skipDedupe: false,
    }).then((entries) => {
      entryListCache.set(cacheKey, { entries, cachedAt: Date.now() })
      return entries
    }).finally(() => {
      entryListInFlight.delete(cacheKey)
    })
    entryListInFlight.set(cacheKey, promise)
    await promise
  },

  loadMoreEntries: async () => {
    const state = get()
    if (state.isLoading || state.isLoadingMore || !state.hasMoreEntries) return
    const baseOptions = state.paginationOptions
    const pageSize = Math.max(1, Math.min(state.paginationPageSize || DEFAULT_ENTRY_PAGE_SIZE, MAX_ENTRY_PAGE_SIZE))
    if (!baseOptions) return

    const offset = state.entries.length
    const pageOptions = {
      ...baseOptions,
      limit: pageSize,
      offset,
    }
    const cacheKey = buildListCacheKey(pageOptions)
    const cached = entryListCache.get(cacheKey)
    const ttl = cached?.entries?.length ? ENTRY_LIST_CACHE_TTL_MS : EMPTY_ENTRY_LIST_CACHE_TTL_MS

    set({ isLoadingMore: true })

    try {
      let nextPage: Entry[]
      if (cached && Date.now() - cached.cachedAt < ttl) {
        nextPage = cached.entries
      } else {
        const existing = entryListInFlight.get(cacheKey)
        const promise =
          existing ??
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
          }).then((entries) => {
            entryListCache.set(cacheKey, { entries, cachedAt: Date.now() })
            return entries
          }).finally(() => {
            entryListInFlight.delete(cacheKey)
          })
        if (!existing) entryListInFlight.set(cacheKey, promise)
        nextPage = await promise
      }

      set((current) => ({
        entries: mergeEntriesById(current.entries, nextPage),
        isLoadingMore: false,
        hasMoreEntries: nextPage.length >= pageSize,
      }))
    } catch {
      set({ isLoadingMore: false })
    }
  },

  clearListCache: () => {
    entryListCache.clear()
    entryListInFlight.clear()
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

    set((state) => ({
      entries: state.entries.map((entry) => (entry.id === entryId ? refreshed : entry)),
      selectedEntry: state.selectedEntry?.id === entryId ? refreshed : state.selectedEntry,
    }))

    return refreshed
  },

  selectEntry: async (entry) => {
    set({ selectedEntry: entry })
    if (entry && !entry.isRead) {
      await window.api.entries.markRead(entry.id, true)
      // Update local state
      set((state) => ({
        entries: state.entries.map((e) => (e.id === entry.id ? { ...e, isRead: true } : e)),
        selectedEntry: entry ? { ...entry, isRead: true } : null,
      }))
    }
    if (entry) {
      const fullEntry = await window.api.entries.get(entry.id).catch(() => null)
      if (fullEntry) {
        set((state) => {
          if (state.selectedEntry?.id !== entry.id) return state
          return { ...state, selectedEntry: fullEntry }
        })
      }
    }
  },

  markRead: async (entryId, isRead) => {
    await window.api.entries.markRead(entryId, isRead)
    set((state) => ({
      entries: state.entries.map((e) => (e.id === entryId ? { ...e, isRead } : e)),
      selectedEntry: state.selectedEntry?.id === entryId ? { ...state.selectedEntry, isRead } : state.selectedEntry,
    }))
  },

  markAllRead: async (feedId) => {
    await window.api.entries.markAllRead(feedId)
    set((state) => ({
      entries: state.entries.map((e) =>
        !feedId || e.feedId === feedId ? { ...e, isRead: true } : e
      ),
    }))
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
      entries: state.entries.map((e, i) => (i < idx ? { ...e, isRead: true } : e)),
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
      entries: state.entries.map((e, i) => (i > idx ? { ...e, isRead: true } : e)),
    }))
  },

  toggleStar: async (entryId) => {
    const result = await window.api.entries.toggleStar(entryId)
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId ? { ...e, isStarred: result.isStarred } : e
      ),
      selectedEntry:
        state.selectedEntry?.id === entryId
          ? { ...state.selectedEntry, isStarred: result.isStarred }
          : state.selectedEntry,
    }))
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
      paginationQueryKey: "",
      paginationOptions: null,
      paginationPageSize: 0,
    })
    try {
      const entries = await window.api.entries.search(query)
      set({ entries: dedupeEntriesForClient(entries), isLoading: false, isLoadingMore: false, hasMoreEntries: false })
    } catch {
      set({ isLoading: false, isLoadingMore: false })
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },
}))
