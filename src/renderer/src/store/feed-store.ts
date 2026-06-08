import { createAppStore } from './helpers'
import type { FeedWithCount } from '../../../shared/types'
import { FeedViewType } from '../../../shared/types'
import type {
  FeedRefreshProgressPayload,
  ImportRefreshProgressPayload,
} from '../../../shared/renderer-events'
import { useSettingsStore } from './settings-store'
import { useEntryStore } from './entry-store'
import { buildHomeFeedLoadOptions } from '../lib/home-feed-scope'
import {
  invalidateFeedCache,
  invalidateMultipleFeedsCaches,
} from '../lib/entry-cache'

const RECOMMENDED_CATEGORY = 'Recommended'

async function reloadEntriesForCurrentScope(state: {
  selectedFeedId: string | null
  activeView: FeedViewType | null
  feeds: FeedWithCount[]
}): Promise<void> {
  const { loadEntries } = useEntryStore.getState()
  // DO NOT clearListCache here - let selective invalidation handle it
  await loadEntries(
    buildHomeFeedLoadOptions({
      selectedFeedId: state.selectedFeedId,
      activeView: state.activeView,
      feeds: state.feeds,
    }),
  )
}

interface FeedState {
  refreshProgress: {
    total: number
    completed: number
    percent: number
    feedId?: string
    feedTitle?: string
    success?: boolean
    newEntries?: number
    feed?: Partial<FeedWithCount>
    done?: boolean
  } | null
  feeds: FeedWithCount[]
  selectedFeedId: string | null // null = all feeds, "starred" = starred view
  activeView: FeedViewType | null // null = show all, otherwise filter by view
  isLoading: boolean
  isRefreshing: boolean

  // Actions
  loadFeeds: () => Promise<void>
  addFeed: (
    url: string,
    category?: string,
    view?: FeedViewType,
    title?: string,
  ) => Promise<{
    success: boolean
    error?: string
    feed?: Partial<FeedWithCount>
  }>
  removeFeed: (feedId: string) => Promise<void>
  removeFeeds: (feedIds: string[]) => Promise<void>
  refreshFeed: (feedId: string) => Promise<void>
  refreshMultiple: (feedIds: string[]) => Promise<void>
  refreshAll: () => Promise<void>
  setSelectedFeed: (feedId: string | null) => void
  setActiveView: (view: FeedViewType | null) => void
  updateFeed: (
    feedId: string,
    updates: {
      title?: string
      url?: string
      folder?: string
      category?: string
      view?: FeedViewType
      imageUrl?: string
      showInAll?: boolean
      maxEntries?: number
    },
  ) => Promise<void>
  importOPML: () => Promise<{
    success: boolean
    imported?: number
    skipped?: number
    importedFeedIds?: string[]
    errors?: string[]
    error?: string
    canceled?: boolean
  }>
  exportOPML: () => Promise<{
    success: boolean
    count?: number
    error?: string
    canceled?: boolean
  }>
  refreshImportedFeeds: (feedIds: string[]) => Promise<{
    success: boolean
    total: number
    refreshed: number
    failed: number
  }>
  importRefreshProgress: {
    completed: number
    total: number
    success: number
    failed: number
    currentTitle?: string
  } | null
}

export const useFeedStore = createAppStore<FeedState>((set, get) => ({
  refreshProgress: null,
  feeds: [],
  selectedFeedId: null,
  activeView: null,
  isLoading: false,
  isRefreshing: false,
  importRefreshProgress: null,

  loadFeeds: async () => {
    set({ isLoading: true })
    try {
      const feeds = await window.api.feeds.list()
      set({ feeds, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  addFeed: async (url, category, view, title) => {
    const result = await window.api.feeds.add(url, category, view, title)
    if (result.success) {
      // The feed is inserted optimistically; the main process runs a background
      // bootstrap that fetches entries and emits `feeds:updated`, which refreshes
      // the list and unread counts. Surface the new feed locally and return so the
      // dialog closes immediately instead of blocking on the initial fetch.
      useEntryStore.getState().clearListCache()
      await get().loadFeeds()
    }
    return result
  },

  removeFeed: async (feedId) => {
    await window.api.feeds.remove(feedId)
    if (get().selectedFeedId === feedId) {
      set({ selectedFeedId: null })
    }
    await get().loadFeeds()
  },

  removeFeeds: async (feedIds) => {
    if (!feedIds.length) return
    const ids = Array.from(new Set(feedIds))
    const selected = get().selectedFeedId
    await Promise.allSettled(ids.map((id) => window.api.feeds.remove(id)))
    if (selected && ids.includes(selected)) {
      set({ selectedFeedId: null })
    }
    await get().loadFeeds()
  },

  // Apply refresh result directly to local store to avoid full feed list reload.
  // Falls back to a full reload only when backend did not return enough data.
  refreshFeed: async (feedId) => {
    const applyRefreshPatch = (
      result:
        | {
            success?: boolean
            newEntries?: number
            unreadCount?: number
            feed?: Partial<FeedWithCount>
          }
        | null
        | undefined,
      targetFeedId: string,
    ): boolean => {
      if (!result?.success) return false
      set((state) => {
        const idx = state.feeds.findIndex((f) => f.id === targetFeedId)
        if (idx === -1) return state
        const current = state.feeds[idx]
        const nextUnread =
          typeof result.unreadCount === 'number'
            ? result.unreadCount
            : current.unreadCount + (result.newEntries || 0)
        const patched: FeedWithCount = {
          ...current,
          ...(result.feed || {}),
          unreadCount: Math.max(0, nextUnread),
        }
        const nextFeeds = [...state.feeds]
        nextFeeds[idx] = patched
        return { feeds: nextFeeds }
      })
      return true
    }

    const receiveRecommended =
      useSettingsStore.getState().settings.general.showRecommended
    if (!receiveRecommended) {
      const feed = get().feeds.find((f) => f.id === feedId)
      if (feed?.category === RECOMMENDED_CATEGORY) return
    }

    // Keep a visible refresh state so single-feed refresh has immediate UI feedback.
    set({ isRefreshing: true })
    try {
      const result = await window.api.feeds.refresh(feedId)
      const patched = applyRefreshPatch(result, feedId)
      if (!patched) {
        await get().loadFeeds()
      }
      // Invalidate only this feed's cache, not all caches
      invalidateFeedCache(feedId)
      // Refresh entry list for the currently visible scope
      await reloadEntriesForCurrentScope(get())
    } finally {
      set({ isRefreshing: false })
    }
  },

  refreshMultiple: async (feedIds) => {
    const receiveRecommended =
      useSettingsStore.getState().settings.general.showRecommended
    const targets = receiveRecommended
      ? feedIds
      : feedIds.filter((id) => {
          const feed = get().feeds.find((f) => f.id === id)
          return feed?.category !== RECOMMENDED_CATEGORY
        })
    if (targets.length === 0) return

    set({ isRefreshing: true })
    try {
      const queue = [...targets]
      const concurrency = 4
      let needsFallbackReload = false
      const worker = async () => {
        while (queue.length > 0) {
          const feedId = queue.shift()
          if (!feedId) return
          const result = await window.api.feeds.refresh(feedId)
          set((state) => {
            if (!result?.success) {
              needsFallbackReload = true
              return state
            }
            const idx = state.feeds.findIndex((f) => f.id === feedId)
            if (idx === -1) {
              needsFallbackReload = true
              return state
            }
            const current = state.feeds[idx]
            const nextUnread =
              typeof result.unreadCount === 'number'
                ? result.unreadCount
                : current.unreadCount + (result.newEntries || 0)
            const patched: FeedWithCount = {
              ...current,
              ...(result.feed || {}),
              unreadCount: Math.max(0, nextUnread),
            }
            const nextFeeds = [...state.feeds]
            nextFeeds[idx] = patched
            return { feeds: nextFeeds }
          })
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length) }, () =>
          worker(),
        ),
      )
      if (needsFallbackReload) {
        await get().loadFeeds()
      }
      // Invalidate cache for all refreshed feeds
      invalidateMultipleFeedsCaches(targets)
      await reloadEntriesForCurrentScope(get())
    } finally {
      set({ isRefreshing: false })
    }
  },

  refreshAll: async () => {
    set({ isRefreshing: true })
    const removeListener = window.api.on(
      'feeds:refresh-progress',
      (payload) => {
        const progress: FeedRefreshProgressPayload = payload
        if (!progress || typeof progress !== 'object') return
        set({ refreshProgress: progress })
      },
    )
    try {
      await window.api.feeds.refreshAll()
      // Feed list will be updated via feeds:updated event in AppBootstrapProvider
      // No need to call loadFeeds() here - reduces IPC overhead
    } finally {
      removeListener()
      set({ isRefreshing: false })
      setTimeout(() => set({ refreshProgress: null }), 600)
    }
  },

  setSelectedFeed: (feedId) => {
    set({ selectedFeedId: feedId })
  },

  setActiveView: (view) => {
    const { activeView, selectedFeedId } = get()
    if (activeView === view && selectedFeedId === null) return
    // PERF: mark store update
    performance.mark('vs:store')
    set({ activeView: view, selectedFeedId: null })
  },

  updateFeed: async (feedId, updates) => {
    await window.api.feeds.update(feedId, updates)
    await get().loadFeeds()
  },

  importOPML: async () => {
    const result = await window.api.feeds.importOPML()
    if (result.success) {
      await get().loadFeeds()
    }
    return result
  },

  exportOPML: async () => {
    return await window.api.feeds.exportOPML()
  },

  refreshImportedFeeds: async (feedIds) => {
    if (!feedIds.length)
      return { success: true, total: 0, refreshed: 0, failed: 0 }

    set({
      importRefreshProgress: {
        completed: 0,
        total: feedIds.length,
        success: 0,
        failed: 0,
      },
    })

    const removeListener = window.api.on(
      'import:refresh-progress',
      (payload) => {
        const progress: ImportRefreshProgressPayload = payload
        if (!progress || typeof progress !== 'object') return
        set({ importRefreshProgress: progress })
      },
    )

    try {
      const result = await window.api.feeds.refreshImportedFeeds(feedIds)
      await get().loadFeeds()
      return result
    } finally {
      removeListener()
      setTimeout(() => set({ importRefreshProgress: null }), 800)
    }
  },
}))
