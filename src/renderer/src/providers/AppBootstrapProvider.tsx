import { useEffect, type PropsWithChildren } from 'react'
import { applyAfterReadyCallbacks } from '../initialize/queue'
import { useInitRecommendedFeeds } from '../hooks/useInitRecommendedFeeds'
import { buildHomeFeedLoadOptions } from '../lib/home-feed-scope'
import { useEntryStore } from '../store/entry-store'
import { useFeedStore } from '../store/feed-store'
import { useSettingsStore } from '../store/settings-store'
import { useActionsStore } from '../store/actions-store'
import { useStoreShallow } from '../store/helpers'

function reloadEntriesForCurrentScope() {
  const { selectedFeedId, activeView, feeds } = useFeedStore.getState()
  const { loadEntries } = useEntryStore.getState()
  void loadEntries(
    buildHomeFeedLoadOptions({ selectedFeedId, activeView, feeds }),
  )
}

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const { loadFeeds } = useStoreShallow(useFeedStore, (state) => ({
    loadFeeds: state.loadFeeds,
  }))
  const { loadSettings } = useStoreShallow(useSettingsStore, (state) => ({
    loadSettings: state.loadSettings,
  }))
  const { loadRules } = useStoreShallow(useActionsStore, (state) => ({
    loadRules: state.loadRules,
  }))
  const { clearListCache } = useStoreShallow(useEntryStore, (state) => ({
    clearListCache: state.clearListCache,
  }))

  useInitRecommendedFeeds()

  useEffect(() => {
    // Data is already hydrated from main.tsx via hydrateDataToMemory()
    // Just apply after-ready callbacks and notify main process
    applyAfterReadyCallbacks()
    void window.api.app.rendererReady()

    if (!window.api?.on) return

    // Listen for incremental updates from backend
    const cleanupFeedsUpdated = window.api.on('feeds:updated', () => {
      loadFeeds() // Reload feeds to get updated counts
      // DO NOT clearListCache() - preserve cache for better performance
      reloadEntriesForCurrentScope()
    })
    const cleanupEntriesEnriched = window.api.on('entries:enriched', () => {
      reloadEntriesForCurrentScope()
    })
    const cleanupEntriesRepaired = window.api.on('entries:repaired', () => {
      clearListCache() // Only clear cache for repairs (data integrity issue)
      reloadEntriesForCurrentScope()
    })

    return () => {
      cleanupFeedsUpdated?.()
      cleanupEntriesEnriched?.()
      cleanupEntriesRepaired?.()
    }
  }, [clearListCache, loadFeeds, loadRules, loadSettings])

  return children
}
