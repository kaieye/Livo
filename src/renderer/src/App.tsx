import { useEffect } from "react"
import { Layout } from "./components/layout/Layout"
import { useFeedStore } from "./store/feed-store"
import { useEntryStore } from "./store/entry-store"
import { useSettingsStore } from "./store/settings-store"
import { useActionsStore } from "./store/actions-store"
import { useStoreShallow } from "./store/helpers"
import { FeedViewType } from "../../shared/types"
import { getEntryLoadLimit } from "./lib/entry-load-limit"
import { SettingsDialog } from "./components/settings/SettingsDialog"
import { QuickSearchPanel, useQuickSearchStore } from "./components/search/QuickSearch"
import { AIChatPanel } from "./components/ai/AIChatPanel"
import { ShortcutHelpDialog, useShortcutHelpStore } from "./components/shortcuts/ShortcutHelp"
import { CornerPlayer } from "./components/media/MediaPlayer"
import { useInitRecommendedFeeds } from "./hooks/useInitRecommendedFeeds"
import { TextContextMenu } from "./components/ui/TextContextMenu"
import { registerLayoutCommands } from "./lib/layout-commands"
import { handleRegisteredShortcutEvent, registerCommand } from "./lib/command-registry"
import { useApplyAppearanceSettings } from "./hooks/useApplyAppearanceSettings"

export default function App() {
  const { loadFeeds } = useStoreShallow(useFeedStore, (s) => ({ loadFeeds: s.loadFeeds }))
  const { loadSettings } = useStoreShallow(useSettingsStore, (s) => ({ loadSettings: s.loadSettings }))
  const { loadRules } = useStoreShallow(useActionsStore, (s) => ({ loadRules: s.loadRules }))
  const { clearListCache } = useStoreShallow(useEntryStore, (s) => ({ clearListCache: s.clearListCache }))
  useApplyAppearanceSettings()

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
  const { toggleSearch } = useStoreShallow(useQuickSearchStore, (s) => ({ toggleSearch: s.toggle }))
  const { toggleShortcutHelp } = useStoreShallow(useShortcutHelpStore, (s) => ({ toggleShortcutHelp: s.toggle }))

  useEffect(() => {
    const unregisterLayoutCommands = registerLayoutCommands()
    const unregisterSearch = registerCommand({
      id: "global:quick-search",
      shortcutId: "quick-search",
      handler: (e) => {
        e.preventDefault()
        toggleSearch()
      },
    })
    const unregisterShortcuts = registerCommand({
      id: "global:show-shortcuts",
      shortcutId: "show-shortcuts",
      handler: (e) => {
        const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
        if (isInput) return false
        e.preventDefault()
        toggleShortcutHelp()
      },
    })

    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if (handleRegisteredShortcutEvent(e)) {
        return
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut)
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut)
      unregisterShortcuts()
      unregisterSearch()
      unregisterLayoutCommands()
    }
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
