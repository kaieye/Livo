import { useState, useEffect, useMemo, useCallback, type UIEvent } from 'react'
import { useEntryStore } from '../store/entry-store'
import { useFeedStore } from '../store/feed-store'
import { useStoreShallow } from '../store/helpers'
import { useGeneralSettingKey } from '../store/settings-store'
import { RECOMMENDED_CATEGORY } from './useInitRecommendedFeeds'
import { useStableHomeFeedLoadOptions } from './useStableHomeFeedLoadOptions'
import { getEntryLoadLimit } from '../lib/entry-load-limit'
import {
  areHomeFeedLoadOptionsEqual,
  buildHomeFeedRefreshTarget,
  buildHomeFeedLoadOptions,
  computeViewFeedIds,
} from '../lib/home-feed-scope'
import { buildCachedEntryReadingSurfaceScopeModel } from '../lib/entry-reading-surface-model'

const SOCIAL_LIST_SCROLL_GUARD_PX = 120
const SOCIAL_LIST_LOAD_MORE_BOTTOM_OFFSET_PX = 260
const EMPTY_SCOPED_ENTRIES: ReturnType<
  typeof useEntryStore.getState
>['entries'] = []

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
    loadSnapshot,
    hydrateSnapshotCache,
    loadMoreEntries,
    clearListCache,
    paginationOptions,
    paginationPageSize,
    searchQuery,
    setSearchQuery,
    search,
  } = useStoreShallow(useEntryStore, (s) => ({
    entries: s.entries,
    isLoading: s.isLoading,
    isLoadingMore: s.isLoadingMore,
    hasMoreEntries: s.hasMoreEntries,
    loadEntries: s.loadEntries,
    loadSnapshot: s.loadSnapshot,
    hydrateSnapshotCache: s.hydrateSnapshotCache,
    loadMoreEntries: s.loadMoreEntries,
    clearListCache: s.clearListCache,
    paginationOptions: s.paginationOptions,
    paginationPageSize: s.paginationPageSize,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    search: s.search,
  }))

  const {
    selectedFeedId,
    feeds,
    activeView,
    refreshFeed,
    refreshMultiple,
    refreshAll,
  } = useStoreShallow(useFeedStore, (s) => ({
    selectedFeedId: s.selectedFeedId,
    feeds: s.feeds,
    activeView: s.activeView,
    refreshFeed: s.refreshFeed,
    refreshMultiple: s.refreshMultiple,
    refreshAll: s.refreshAll,
  }))

  const showRecommended = useGeneralSettingKey('showRecommended')
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

  const entryLoadLimit = useMemo(
    () => getEntryLoadLimit(activeView),
    [activeView],
  )
  const derivedLoadOptions = useMemo(
    () =>
      buildHomeFeedLoadOptions({
        selectedFeedId,
        activeView,
        feeds,
        unreadOnly: filterMode === 'unread',
      }),
    [activeView, feeds, filterMode, selectedFeedId],
  )
  const currentLoadOptions = useStableHomeFeedLoadOptions(derivedLoadOptions)
  const entriesMatchCurrentScope = useMemo(
    () =>
      areHomeFeedLoadOptionsEqual(currentLoadOptions, {
        ...paginationOptions,
        limit: paginationPageSize || undefined,
      }),
    [currentLoadOptions, paginationOptions, paginationPageSize],
  )
  const scopedSourceEntries = useMemo(
    () => (entriesMatchCurrentScope ? entries : EMPTY_SCOPED_ENTRIES),
    [entries, entriesMatchCurrentScope],
  )
  const scopedIsLoading = isLoading || !entriesMatchCurrentScope
  const feedByIdMap = useMemo(
    () => new Map(feeds.map((feed) => [feed.id, feed] as const)),
    [feeds],
  )
  const scopeCacheKey = `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}:${
    filterMode === 'unread' ? 'unread' : 'all'
  }:${showRecommended ? 'with-recommended' : 'no-recommended'}`

  // View-scoped feed IDs for refresh targeting (excludes recommended feeds)
  const viewFeedIds = useMemo(
    () => computeViewFeedIds(feeds, activeView, RECOMMENDED_CATEGORY),
    [feeds, activeView],
  )

  const applySnapshotFeeds = useCallback(
    (snapshotFeeds: typeof feeds): void => {
      useFeedStore.setState((state) => {
        const current = state.feeds
        const unchanged =
          current.length === snapshotFeeds.length &&
          current.every((feed, index) => {
            const next = snapshotFeeds[index]
            return (
              next &&
              feed.id === next.id &&
              feed.unreadCount === next.unreadCount &&
              feed.title === next.title &&
              feed.category === next.category &&
              feed.folder === next.folder &&
              feed.view === next.view &&
              feed.showInAll === next.showInAll &&
              feed.lastRefreshStatus === next.lastRefreshStatus &&
              feed.lastRefreshAttemptedAt === next.lastRefreshAttemptedAt &&
              feed.lastRefreshError === next.lastRefreshError &&
              feed.lastRefreshRawError === next.lastRefreshRawError
            )
          })
        return unchanged ? state : { feeds: snapshotFeeds }
      })
    },
    [],
  )

  const loadCurrentSnapshot = useCallback(async () => {
    const cachedSnapshot = hydrateSnapshotCache(currentLoadOptions)
    if (cachedSnapshot) applySnapshotFeeds(cachedSnapshot.feeds)
    const snapshot = await loadSnapshot(currentLoadOptions)
    if (snapshot) applySnapshotFeeds(snapshot.feeds)
  }, [
    applySnapshotFeeds,
    currentLoadOptions,
    hydrateSnapshotCache,
    loadSnapshot,
  ])

  // Loading entries when feed selection / filter mode changes
  useEffect(() => {
    void loadCurrentSnapshot()
  }, [loadCurrentSnapshot])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      search(searchQuery)
    },
    [search, searchQuery],
  )

  const readingSurfaceScope = useMemo(
    () =>
      buildCachedEntryReadingSurfaceScopeModel({
        entries: scopedSourceEntries,
        feeds,
        feedById: feedByIdMap,
        activeView,
        selectedFeedId,
        showRecommended,
        recommendedCategory: RECOMMENDED_CATEGORY,
        cacheKey: scopeCacheKey,
      }),
    [
      activeView,
      feedByIdMap,
      feeds,
      scopeCacheKey,
      selectedFeedId,
      showRecommended,
      scopedSourceEntries,
    ],
  )
  const {
    feedById,
    currentFeed,
    recommendedFeedIds,
    scopedEntries: baseFilteredEntries,
  } = readingSurfaceScope

  const reloadCurrentList = useCallback(() => {
    void loadCurrentSnapshot()
  }, [loadCurrentSnapshot])

  const reloadCurrentListFresh = useCallback(() => {
    clearListCache()
    reloadCurrentList()
  }, [clearListCache, reloadCurrentList])

  // Refresh current feeds
  const refreshCurrentFeeds = useCallback(async () => {
    const refreshTarget = buildHomeFeedRefreshTarget({
      selectedFeedId,
      activeView,
      feeds,
    })
    if (refreshTarget.type === 'feed') {
      await refreshFeed(refreshTarget.feedId)
    } else if (refreshTarget.type === 'feeds') {
      await refreshMultiple(refreshTarget.feedIds)
    } else {
      await refreshAll()
    }
    reloadCurrentListFresh()
  }, [
    selectedFeedId,
    activeView,
    feeds,
    refreshFeed,
    refreshMultiple,
    refreshAll,
    reloadCurrentListFresh,
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
    entries: scopedSourceEntries,
    selectedEntry: useEntryStore.getState().selectedEntry,
    isLoading: scopedIsLoading,
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
