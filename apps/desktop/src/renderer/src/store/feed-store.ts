import { createAppStore } from './helpers'
import type { FeedWithCount } from '../../../shared/types'
import { FeedViewType } from '../../../shared/types'
import { useSettingsStore } from './settings-store'
import { useEntryStore } from './entry-store'
import { getEntryLoadLimit } from '../lib/entry-load-limit'

const RECOMMENDED_CATEGORY = 'Recommended'

function isSlowSocialFeed(feed?: Partial<FeedWithCount>): boolean {
  const rawUrl = String(feed?.url || '').toLowerCase()
  const view = feed?.view
  if (view === FeedViewType.SocialMedia || view === FeedViewType.Pictures)
    return true
  return (
    /\/instagram\/user\//i.test(rawUrl) ||
    /\/picnob(?:\.info)?\/user\//i.test(rawUrl) ||
    /\/pixnoy\/user\//i.test(rawUrl) ||
    /\/piokok\/user\//i.test(rawUrl) ||
    /\/(?:twitter|x)\/user\//i.test(rawUrl)
  )
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function reloadEntriesForCurrentScope(state: {
  selectedFeedId: string | null
  activeView: FeedViewType | null
  feeds: FeedWithCount[]
}): Promise<void> {
  const { clearListCache, loadEntries } = useEntryStore.getState()
  const limit = getEntryLoadLimit(state.activeView)
  const viewFeedIds =
    state.activeView !== null
      ? state.feeds
          .filter((f) => (f.view ?? FeedViewType.Articles) === state.activeView)
          .map((f) => f.id)
      : []

  clearListCache()
  if (state.selectedFeedId === 'starred') {
    await loadEntries({ starred: true, limit })
    return
  }
  if (state.selectedFeedId) {
    await loadEntries({ feedId: state.selectedFeedId, limit })
    return
  }
  if (viewFeedIds.length > 0) {
    await loadEntries({ feedIds: viewFeedIds, limit })
    return
  }
  await loadEntries({ limit })
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
}

export const useFeedStore = createAppStore<FeedState>((set, get) => ({
  refreshProgress: null,
  feeds: [],
  selectedFeedId: null,
  activeView: null,
  isLoading: false,
  isRefreshing: false,

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
      // Avoid stale empty list cache for newly added subscriptions.
      useEntryStore.getState().clearListCache()
      await get().loadFeeds()
      const shouldSkipWarmup = isSlowSocialFeed(result.feed)
      const newFeedId = result.feed?.id
      if (newFeedId && !shouldSkipWarmup) {
        try {
          const unreadEntries = await window.api.entries.list({
            feedId: newFeedId,
            unreadOnly: true,
            limit: 5000,
            compact: true,
            maxContentLength: 200,
            skipDedupe: false,
          })
          set((state) => ({
            feeds: state.feeds.map((f) =>
              f.id === newFeedId
                ? { ...f, unreadCount: unreadEntries.entries.length }
                : f,
            ),
          }))

          // Warm cache so opening the feed can render immediately.
          await useEntryStore.getState().prefetchEntries({
            feedId: newFeedId,
            unreadOnly: false,
            limit: 1000,
          })
        } catch {
          // Keep UI on list() result when recount fails.
        }
      }
      if (newFeedId && shouldSkipWarmup) {
        // For slow social feeds (Instagram/X), emulate manual refresh in background
        // so users don't have to click refresh after subscribing.
        void (async () => {
          for (let round = 0; round < 3; round++) {
            await delayMs(1200 + round * 1800)
            try {
              await window.api.feeds.refresh(newFeedId)
              await get().loadFeeds()
              await reloadEntriesForCurrentScope(get())
            } catch {
              // Continue next round.
            }
          }
        })()
      }
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
      // Refresh entry list for the currently visible scope to avoid stale empty cache.
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
        const progress = payload as FeedState['refreshProgress']
        if (!progress || typeof progress !== 'object') return
        set({ refreshProgress: progress })
      },
    )
    try {
      await window.api.feeds.refreshAll()
      await get().loadFeeds()
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
}))
