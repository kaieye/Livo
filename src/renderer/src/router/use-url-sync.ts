import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFeedStore } from '../store/feed-store'
import { useEntryStore } from '../store/entry-store'
import { useDiscoverStore } from '../store/discover-store'
import { useSettingsStore } from '../store/settings-store'
import {
  getEntryIdFromSearch,
  parseViewFromPath,
  VIEW_TYPE_SLUGS,
  withEntrySearchParam,
} from './route-paths'

/**
 * Hook that establishes bidirectional synchronization between URL hash
 * and Zustand store state (activeView, selectedFeedId, isDiscoverOpen, isSettingsOpen).
 *
 * Direction 1 (URL → Store): When the hash changes, update store state.
 * Direction 2 (Store → URL): When store state changes, push new hash.
 *
 * Uses guard refs to prevent infinite update loops.
 *
 * MUST be called inside a component rendered within <RouterProvider>.
 */
export function useUrlSync(): void {
  const location = useLocation()
  const navigate = useNavigate()

  // Guard: true when processing a URL change → skip store→URL sync
  const syncingFromUrl = useRef(false)
  // Guard: true when pushing a URL from store → skip URL→store sync
  const syncingFromStore = useRef(false)

  // Resolve current URL to the store state representation
  const resolvePath = (pathname: string, search: string) => {
    const { viewType, feedId } = parseViewFromPath(pathname)
    const entryId = getEntryIdFromSearch(search)
    const isDiscover = pathname === '/discover'
    const isSettings = pathname === '/settings'
    return { viewType, feedId, entryId, isDiscover, isSettings }
  }

  // Compute the URL that represents the current store state
  const computeUrl = (): string => {
    const discoverOpen = useDiscoverStore.getState().isOpen
    const settingsOpen = useSettingsStore.getState().isOpen
    if (discoverOpen) return '/discover'
    if (settingsOpen) return '/settings'
    const { selectedFeedId, activeView } = useFeedStore.getState()
    const entryId = useEntryStore.getState().selectedEntry?.id ?? null
    const withEntry = (path: string) => withEntrySearchParam(path, entryId)
    if (selectedFeedId === 'starred') return withEntry('/starred')
    if (selectedFeedId) {
      // Preserve the active view type so the view context is not lost
      if (activeView !== null) {
        const slug = VIEW_TYPE_SLUGS[activeView]
        const path = slug
          ? `/${slug}/feed/${selectedFeedId}`
          : `/feed/${selectedFeedId}`
        return withEntry(path)
      }
      return withEntry(`/feed/${selectedFeedId}`)
    }
    if (activeView !== null) {
      const slug = VIEW_TYPE_SLUGS[activeView]
      return withEntry(slug ? `/${slug}` : '/')
    }
    return withEntry('/')
  }

  const selectEntryFromUrl = (entryId: string | null): void => {
    const entryStore = useEntryStore.getState()
    if (!entryId) {
      if (entryStore.selectedEntry) void entryStore.selectEntry(null)
      return
    }
    if (entryStore.selectedEntry?.id === entryId) return

    // 等当前路由切换的清理 effect 跑完，再恢复 URL 指向的详情。
    window.setTimeout(() => {
      const current = useEntryStore.getState()
      if (current.selectedEntry?.id === entryId) return
      const inList = current.entries.find((entry) => entry.id === entryId)
      if (inList) {
        void current.selectEntry(inList)
        return
      }
      void window.api.entries.get(entryId).then((entry) => {
        if (!entry) return
        void useEntryStore.getState().selectEntry(entry)
      })
    }, 0)
  }

  // Direction 1: URL → Store
  useLayoutEffect(() => {
    if (syncingFromStore.current) {
      syncingFromStore.current = false
      return
    }

    syncingFromUrl.current = true
    const { viewType, feedId, entryId, isDiscover, isSettings } = resolvePath(
      location.pathname,
      location.search,
    )

    const discoverStore = useDiscoverStore.getState()
    const settingsStore = useSettingsStore.getState()
    const feedStore = useFeedStore.getState()

    // Sync discover panel
    if (isDiscover !== discoverStore.isOpen) {
      discoverStore.setOpen(isDiscover)
    }

    // Sync settings panel
    if (isSettings !== settingsStore.isOpen) {
      settingsStore.setOpen(isSettings)
    }

    // Sync feed view/selection (only when not on discover/settings)
    if (!isDiscover && !isSettings) {
      if (
        feedStore.activeView !== viewType ||
        feedStore.selectedFeedId !== feedId
      ) {
        useFeedStore.setState((state) =>
          state.activeView === viewType && state.selectedFeedId === feedId
            ? state
            : { activeView: viewType, selectedFeedId: feedId },
        )
      }
      selectEntryFromUrl(entryId)
    }

    syncingFromUrl.current = false
  }, [location.pathname, location.search])

  // Direction 2: Store → URL
  useEffect(() => {
    const unsubFeed = useFeedStore.subscribe((state, prevState) => {
      if (syncingFromUrl.current) return
      if (
        state.activeView === prevState.activeView &&
        state.selectedFeedId === prevState.selectedFeedId
      )
        return
      syncingFromStore.current = true
      navigate(computeUrl(), { replace: true })
    })

    const unsubDiscover = useDiscoverStore.subscribe((state, prevState) => {
      if (syncingFromUrl.current) return
      if (state.isOpen === prevState.isOpen) return
      syncingFromStore.current = true
      navigate(computeUrl(), { replace: true })
    })

    const unsubSettings = useSettingsStore.subscribe((state, prevState) => {
      if (syncingFromUrl.current) return
      if (state.isOpen === prevState.isOpen) return
      syncingFromStore.current = true
      navigate(computeUrl(), { replace: true })
    })

    const unsubEntry = useEntryStore.subscribe((state, prevState) => {
      if (syncingFromUrl.current) return
      if (state.selectedEntry?.id === prevState.selectedEntry?.id) return
      syncingFromStore.current = true
      navigate(computeUrl(), { replace: false })
    })

    return () => {
      unsubFeed()
      unsubDiscover()
      unsubSettings()
      unsubEntry()
    }
  }, [navigate])
}
