import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFeedStore } from '../store/feed-store'
import { useDiscoverStore } from '../store/discover-store'
import { useSettingsStore } from '../store/settings-store'
import { parseViewFromPath, VIEW_TYPE_SLUGS } from './route-paths'

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
  const resolvePath = (pathname: string) => {
    const { viewType, feedId } = parseViewFromPath(pathname)
    const isDiscover = pathname === '/discover'
    const isSettings = pathname === '/settings'
    return { viewType, feedId, isDiscover, isSettings }
  }

  // Compute the URL that represents the current store state
  const computeUrl = (): string => {
    const discoverOpen = useDiscoverStore.getState().isOpen
    const settingsOpen = useSettingsStore.getState().isOpen
    if (discoverOpen) return '/discover'
    if (settingsOpen) return '/settings'
    const { selectedFeedId, activeView } = useFeedStore.getState()
    if (selectedFeedId === 'starred') return '/starred'
    if (selectedFeedId) return `/feed/${selectedFeedId}`
    if (activeView !== null) {
      const slug = VIEW_TYPE_SLUGS[activeView]
      return slug ? `/${slug}` : '/'
    }
    return '/'
  }

  // Direction 1: URL → Store
  useEffect(() => {
    if (syncingFromStore.current) {
      syncingFromStore.current = false
      return
    }

    syncingFromUrl.current = true
    const { viewType, feedId, isDiscover, isSettings } = resolvePath(
      location.pathname,
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
      if (feedStore.activeView !== viewType) {
        feedStore.setActiveView(viewType)
      }
      if (feedStore.selectedFeedId !== feedId) {
        feedStore.setSelectedFeed(feedId)
      }
    }

    syncingFromUrl.current = false
  }, [location.pathname])

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

    return () => {
      unsubFeed()
      unsubDiscover()
      unsubSettings()
    }
  }, [navigate])
}
