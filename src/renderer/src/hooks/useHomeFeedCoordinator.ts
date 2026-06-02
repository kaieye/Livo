import { useState, useEffect, useMemo, useCallback, type UIEvent } from 'react'
import { useEntryStore } from '../store/entry-store'
import { useFeedStore } from '../store/feed-store'
import { useGeneralSettingKey } from '../store/settings-store'
import { FeedViewType } from '../../../shared/types'
import { RECOMMENDED_CATEGORY } from './useInitRecommendedFeeds'
import { getEntryLoadLimit } from '../lib/entry-load-limit'

const SOCIAL_LIST_SCROLL_GUARD_PX = 120
const SOCIAL_LIST_LOAD_MORE_BOTTOM_OFFSET_PX = 260

export interface HomeFeedCoordinatorState {
  /** Raw entries from store. */
  entries: ReturnType<typeof useEntryStore.getState>['entries']
  /** Feed IDs scoped to the current active view (excluding recommended). */
  viewFeedIds: string[] | undefined
  /** Entries filtered by active view and recommended feed exclusion. */
  baseFilteredEntries: ReturnType<typeof useEntryStore.getState>['entries']
  /** Recommended feed IDs to exclude from main view. */
  recommendedFeedIds: Set<string>
  /** Current filter mode: all entries or unread only. */
  filterMode: 'all' | 'unread'
  /** Set filter mode. */
  setFilterMode: (mode: 'all' | 'unread') => void
  /** Map of feed ID to feed object. */
  feedById: Map<
    string,
    ReturnType<typeof useFeedStore.getState>['feeds'][number]
  >
  /** Current feed if a specific feed is selected. */
  currentFeed:
    | ReturnType<typeof useFeedStore.getState>['feeds'][number]
    | undefined
  /** Display title for the current view scope. */
  title: string
  /** Reload entries for the current scope. */
  reloadCurrentList: () => void
  /** Clear cache and reload entries. */
  reloadCurrentListFresh: () => void
  /** Handle scroll event for load-more and grid progressive rendering. */
  handleListScroll: (e: UIEvent<HTMLDivElement>) => void
  /** Search query state. */
  searchQuery: string
  /** Set search query. */
  setSearchQuery: (q: string) => void
  /** Execute search. */
  handleSearch: (e: React.FormEvent) => void
  /** Whether progressive grid has more entries to show. */
  hasMoreGridEntries: boolean
  /** Grid visible entry count state. */
  gridVisibleCount: number
  /** Set grid visible count. */
  setGridVisibleCount: (count: number | ((prev: number) => number)) => void
  /** Entry load limit (varies by view type). */
  entryLoadLimit: number
  /** Whether entries are currently loading. */
  isLoading: boolean
  /** Whether more entries are being loaded. */
  isLoadingMore: boolean
  /** Whether there are more entries to load. */
  hasMoreEntries: boolean
  /** Load more entries. */
  loadMoreEntries: () => Promise<void>
  /** Load entries with options. */
  loadEntries: ReturnType<typeof useEntryStore.getState>['loadEntries']
  /** Clear entry list cache. */
  clearListCache: () => void
  /** Currently selected entry. */
  selectedEntry: ReturnType<typeof useEntryStore.getState>['selectedEntry']
  /** Refresh current feed(s). */
  refreshCurrentFeeds: () => Promise<void>
}

/**
 * Data coordination hook for the home feed.
 * Encapsulates feed scope computation, entry loading/reloading,
 * entry filtering, filter mode management, pagination, and search.
 *
 * Extracted from EntryList.tsx to separate data coordination from rendering.
 */
export function useHomeFeedCoordinator(): HomeFeedCoordinatorState {
  const {
    entries,
    isLoading,
    isLoadingMore,
    hasMoreEntries,
    loadEntries,
    loadMoreEntries,
    clearListCache,
    searchQuery,
    setSearchQuery,
    search,
  } = useEntryStore()

  const {
    selectedFeedId,
    feeds,
    activeView,
    refreshFeed,
    refreshMultiple,
    refreshAll,
  } = useFeedStore()

  const showRecommended = useGeneralSettingKey('showRecommended')
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

  const entryLoadLimit = useMemo(
    () => getEntryLoadLimit(activeView),
    [activeView],
  )

  // Compute feed IDs for the active view (excluding recommended feeds)
  const viewFeedIds = useMemo(
    () =>
      activeView !== null
        ? feeds
            .filter(
              (f) =>
                (f.view ?? FeedViewType.Articles) === activeView &&
                f.category !== RECOMMENDED_CATEGORY &&
                f.showInAll !== false,
            )
            .map((f) => f.id)
        : undefined,
    [feeds, activeView],
  )

  // Loading entries when feed selection / filter mode changes
  useEffect(() => {
    if (selectedFeedId === 'starred') {
      loadEntries({ starred: true, limit: entryLoadLimit })
    } else if (selectedFeedId) {
      loadEntries({
        feedId: selectedFeedId,
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      })
    } else if (viewFeedIds && viewFeedIds.length > 0) {
      loadEntries({
        feedIds: viewFeedIds,
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      })
    } else {
      loadEntries({
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      })
    }
  }, [selectedFeedId, filterMode, loadEntries, viewFeedIds, entryLoadLimit])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      search(searchQuery)
    },
    [search, searchQuery],
  )

  const feedById = useMemo(
    () => new Map(feeds.map((f) => [f.id, f] as const)),
    [feeds],
  )
  const currentFeed = selectedFeedId ? feedById.get(selectedFeedId) : undefined

  const reloadCurrentList = useCallback(() => {
    if (selectedFeedId === 'starred') {
      loadEntries({ starred: true, limit: entryLoadLimit })
    } else if (selectedFeedId) {
      loadEntries({
        feedId: selectedFeedId,
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      })
    } else if (viewFeedIds && viewFeedIds.length > 0) {
      loadEntries({
        feedIds: viewFeedIds,
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      })
    } else {
      loadEntries({
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      })
    }
  }, [entryLoadLimit, filterMode, loadEntries, selectedFeedId, viewFeedIds])

  const reloadCurrentListFresh = useCallback(() => {
    clearListCache()
    reloadCurrentList()
  }, [clearListCache, reloadCurrentList])

  // Refresh current feeds
  const refreshCurrentFeeds = useCallback(async () => {
    if (selectedFeedId && selectedFeedId !== 'starred') {
      await refreshFeed(selectedFeedId)
    } else if (viewFeedIds && viewFeedIds.length > 0) {
      await refreshMultiple(viewFeedIds)
    } else {
      await refreshAll()
    }
    reloadCurrentListFresh()
  }, [
    selectedFeedId,
    viewFeedIds,
    refreshFeed,
    refreshMultiple,
    refreshAll,
    reloadCurrentListFresh,
  ])

  // Build a set of recommended feed IDs so we can exclude their entries
  const recommendedFeedIds = useMemo(
    () =>
      new Set(
        feeds
          .filter((f) => f.category === RECOMMENDED_CATEGORY)
          .map((f) => f.id),
      ),
    [feeds],
  )
  const receiveRecommended = showRecommended

  // Filter entries by active view (when showing all feeds) - exclude recommended feeds
  const baseFilteredEntries = useMemo(() => {
    const filtered = selectedFeedId
      ? entries
      : activeView !== null
        ? entries.filter((entry) => {
            const feed = feedById.get(entry.feedId)
            if (!feed) return false
            if (feed.showInAll === false) return false
            if (!receiveRecommended && recommendedFeedIds.has(entry.feedId))
              return false
            return (feed.view ?? FeedViewType.Articles) === activeView
          })
        : entries.filter((entry) => {
            const feed = feedById.get(entry.feedId)
            if (!feed) return false
            if (feed.showInAll === false) return false
            if (!receiveRecommended && recommendedFeedIds.has(entry.feedId))
              return false
            return true
          })

    // Safety fallback: in "All" view, if filters accidentally remove everything
    // while entries already exist, show raw entries to avoid blank timeline.
    let finalFiltered = filtered
    if (
      !selectedFeedId &&
      activeView === null &&
      entries.length > 0 &&
      filtered.length === 0
    ) {
      finalFiltered = entries.filter((entry) => {
        const feed = feedById.get(entry.feedId)
        if (!feed) return false
        if (feed.showInAll === false) return false
        if (!receiveRecommended && recommendedFeedIds.has(entry.feedId))
          return false
        return true
      })
    }
    return finalFiltered
  }, [
    activeView,
    entries,
    feedById,
    receiveRecommended,
    recommendedFeedIds,
    selectedFeedId,
  ])

  // Progressive grid rendering state
  const GRID_INITIAL_COUNT = 40
  const [gridVisibleCount, setGridVisibleCount] = useState(GRID_INITIAL_COUNT)

  // Handle scroll for load-more and grid progressive rendering
  const handleListScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const hasScrolledEnough = el.scrollTop > SOCIAL_LIST_SCROLL_GUARD_PX
      const nearBottom =
        el.scrollTop + el.clientHeight >=
        el.scrollHeight - SOCIAL_LIST_LOAD_MORE_BOTTOM_OFFSET_PX

      if (
        !searchQuery.trim() &&
        hasMoreEntries &&
        !isLoadingMore &&
        hasScrolledEnough &&
        nearBottom
      ) {
        void loadMoreEntries()
      }
    },
    [hasMoreEntries, isLoadingMore, loadMoreEntries, searchQuery],
  )

  return {
    entries,
    selectedEntry: useEntryStore.getState().selectedEntry,
    isLoading,
    isLoadingMore,
    hasMoreEntries,
    loadEntries,
    loadMoreEntries,
    clearListCache,
    viewFeedIds,
    baseFilteredEntries,
    recommendedFeedIds,
    filterMode,
    setFilterMode,
    feedById,
    currentFeed,
    title: currentFeed?.title || '',
    reloadCurrentList,
    reloadCurrentListFresh,
    handleListScroll,
    searchQuery,
    setSearchQuery,
    handleSearch,
    hasMoreGridEntries: false,
    gridVisibleCount,
    setGridVisibleCount,
    entryLoadLimit,
    refreshCurrentFeeds,
  }
}
