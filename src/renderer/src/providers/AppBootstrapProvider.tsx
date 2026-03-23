import { useEffect, type PropsWithChildren } from "react"
import { FeedViewType } from "../../../shared/types"
import { useInitRecommendedFeeds } from "../hooks/useInitRecommendedFeeds"
import { getEntryLoadLimit } from "../lib/entry-load-limit"
import { useEntryStore } from "../store/entry-store"
import { useFeedStore } from "../store/feed-store"
import { useSettingsStore } from "../store/settings-store"
import { useActionsStore } from "../store/actions-store"
import { useStoreShallow } from "../store/helpers"

let bootstrapPromise: Promise<void> | null = null

function reloadEntriesForCurrentScope() {
  const { selectedFeedId, activeView, feeds } = useFeedStore.getState()
  const { loadEntries } = useEntryStore.getState()
  const limit = getEntryLoadLimit(activeView)
  const viewFeedIds = activeView !== null
    ? feeds
        .filter((feed) => (feed.view ?? FeedViewType.Articles) === activeView)
        .map((feed) => feed.id)
    : []

  if (selectedFeedId === "starred") {
    void loadEntries({ starred: true, limit })
    return
  }

  if (selectedFeedId) {
    void loadEntries({ feedId: selectedFeedId, limit })
    return
  }

  if (viewFeedIds.length > 0) {
    void loadEntries({ feedIds: viewFeedIds, limit })
    return
  }

  void loadEntries({ limit })
}

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const { loadFeeds } = useStoreShallow(useFeedStore, (state) => ({ loadFeeds: state.loadFeeds }))
  const { loadSettings } = useStoreShallow(useSettingsStore, (state) => ({ loadSettings: state.loadSettings }))
  const { loadRules } = useStoreShallow(useActionsStore, (state) => ({ loadRules: state.loadRules }))
  const { clearListCache } = useStoreShallow(useEntryStore, (state) => ({ clearListCache: state.clearListCache }))

  useInitRecommendedFeeds()

  useEffect(() => {
    if (!bootstrapPromise) {
      bootstrapPromise = Promise.all([
        loadSettings(),
        loadFeeds(),
        loadRules(),
      ]).then(() => undefined)
    }

    if (!window.api?.on) return

    const cleanupFeedsUpdated = window.api.on("feeds:updated", () => {
      loadFeeds()
      clearListCache()
      reloadEntriesForCurrentScope()
    })
    const cleanupEntriesEnriched = window.api.on("entries:enriched", () => {
      reloadEntriesForCurrentScope()
    })
    const cleanupEntriesRepaired = window.api.on("entries:repaired", () => {
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
