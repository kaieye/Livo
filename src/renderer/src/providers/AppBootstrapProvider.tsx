import { useEffect, type PropsWithChildren } from 'react'
import { applyAfterReadyCallbacks } from '../initialize/queue'
import { useInitRecommendedFeeds } from '../hooks/useInitRecommendedFeeds'
import { buildHomeFeedLoadOptions } from '../lib/home-feed-scope'
import { recordAppMetric } from '../lib/performance-metrics'
import { useEntryStore } from '../store/entry-store'
import { useFeedStore } from '../store/feed-store'
import { useSettingsStore } from '../store/settings-store'
import { useActionsStore } from '../store/actions-store'
import { useStoreShallow } from '../store/helpers'

let bootstrapPromise: Promise<void> | null = null

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
    if (!bootstrapPromise) {
      bootstrapPromise = Promise.all([
        loadSettings(),
        loadFeeds(),
        loadRules(),
      ]).then(() => {
        applyAfterReadyCallbacks()
        document.documentElement.dataset.appReady = 'true'
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            recordAppMetric('app.bootstrapReady', performance.now())
          })
        })
      })
    }

    if (!window.api?.on) return

    const cleanupFeedsUpdated = window.api.on('feeds:updated', () => {
      loadFeeds()
      clearListCache()
      reloadEntriesForCurrentScope()
    })
    const cleanupEntriesEnriched = window.api.on('entries:enriched', () => {
      reloadEntriesForCurrentScope()
    })
    const cleanupEntriesRepaired = window.api.on('entries:repaired', () => {
      clearListCache()
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
