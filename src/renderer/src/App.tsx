import { useEffect } from "react"
import { Layout } from "./components/layout/Layout"
import { useFeedStore } from "./store/feed-store"
import { useEntryStore } from "./store/entry-store"
import { useSettingsStore } from "./store/settings-store"
import { useActionsStore } from "./store/actions-store"
import { FeedViewType } from "../../shared/types"
import { getEntryLoadLimit } from "./lib/entry-load-limit"
import { SettingsDialog } from "./components/settings/SettingsDialog"
import { QuickSearchPanel, useQuickSearchStore } from "./components/search/QuickSearch"
import { AIChatPanel } from "./components/ai/AIChatPanel"
import { ShortcutHelpDialog, useShortcutHelpStore } from "./components/shortcuts/ShortcutHelp"
import { CornerPlayer } from "./components/media/MediaPlayer"
import { useInitRecommendedFeeds } from "./hooks/useInitRecommendedFeeds"
import { TextContextMenu } from "./components/ui/TextContextMenu"

export default function App() {
  const loadFeeds = useFeedStore((s) => s.loadFeeds)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const loadRules = useActionsStore((s) => s.loadRules)
  const clearListCache = useEntryStore((s) => s.clearListCache)

  const reloadEntriesForCurrentScope = () => {
    const { selectedFeedId, activeView, feeds } = useFeedStore.getState()
    const { loadEntries } = useEntryStore.getState()
    const limit = getEntryLoadLimit(activeView)
    const viewFeedIds = activeView !== null
      ? feeds
          .filter((f) => (f.view ?? FeedViewType.Articles) === activeView)
          .map((f) => f.id)
      : []
    if (selectedFeedId === "starred") {
      void loadEntries({ starred: true, limit })
    } else if (selectedFeedId) {
      void loadEntries({ feedId: selectedFeedId, limit })
    } else if (viewFeedIds.length > 0) {
      void loadEntries({ feedIds: viewFeedIds, limit })
    } else {
      void loadEntries({ limit })
    }
  }

  // Auto-subscribe recommended feeds on first launch
  useInitRecommendedFeeds()

  useEffect(() => {
    loadSettings()
    loadFeeds()
    loadRules()

    // Listen for auto-refresh updates
    let cleanup: (() => void) | undefined
    let cleanupEnriched: (() => void) | undefined
    let cleanupRepaired: (() => void) | undefined
    if (window.api?.on) {
      cleanup = window.api.on("feeds:updated", () => {
        loadFeeds()
        clearListCache()
        reloadEntriesForCurrentScope()
      })
      // Re-fetch entries when video durations are enriched in the background
      cleanupEnriched = window.api.on("entries:enriched", () => {
        reloadEntriesForCurrentScope()
      })
      cleanupRepaired = window.api.on("entries:repaired", () => {
        clearListCache()
        reloadEntriesForCurrentScope()
      })
    }

    return () => {
      cleanup?.()
      cleanupEnriched?.()
      cleanupRepaired?.()
    }
  }, [clearListCache, loadFeeds, loadSettings, loadRules])

  // Global keyboard shortcuts
  const toggleSearch = useQuickSearchStore((s) => s.toggle)
  const toggleShortcutHelp = useShortcutHelpStore((s) => s.toggle)

  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      // Don't capture when focusing input/textarea (except for global shortcuts)
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

      // Cmd/Ctrl+K → Quick Search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        toggleSearch()
        return
      }

      // ? → Shortcut help (only if not in input)
      if (e.key === "?" && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        toggleShortcutHelp()
        return
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut)
    return () => window.removeEventListener("keydown", handleGlobalShortcut)
  }, [toggleSearch, toggleShortcutHelp])

  return (
    <>
      <Layout />
      <SettingsDialog />
      <QuickSearchPanel />
      <AIChatPanel />
      <ShortcutHelpDialog />
      <CornerPlayer />
      <TextContextMenu />
    </>
  )
}
