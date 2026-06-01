import { useEffect, type PropsWithChildren } from 'react'
import { useDiscoverStore } from '../store/discover-store'
import { useSettingsStore } from '../store/settings-store'
import { useStoreShallow } from '../store/helpers'
import { useEntryStore } from '../store/entry-store'
import { useAIChatStore } from '../store/ai-chat-store'
import { useQuickSearchStore } from '../components/search/QuickSearch'
import { useShortcutHelpStore } from '../components/shortcuts/shortcut-help-store'
import { useCommandPaletteStore } from '../components/command/CommandPalette'
import {
  handleRegisteredShortcutEvent,
  registerCommand,
} from '../lib/command-registry'
import { HOTKEY_OVERLAY_SCOPES } from '../lib/hotkey-scope'
import { registerLayoutCommands } from '../lib/layout-commands'
import { useFeedStore } from '../store/feed-store'

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function GlobalShortcutsProvider({ children }: PropsWithChildren) {
  const { setSettingsOpen } = useStoreShallow(useSettingsStore, (state) => ({
    setSettingsOpen: state.setOpen,
  }))
  const { setDiscoverOpen } = useStoreShallow(useDiscoverStore, (state) => ({
    setDiscoverOpen: state.setOpen,
  }))
  const { toggleSearch } = useStoreShallow(useQuickSearchStore, (state) => ({
    toggleSearch: state.toggle,
  }))
  const { toggleCommandPalette } = useStoreShallow(
    useCommandPaletteStore,
    (state) => ({ toggleCommandPalette: state.toggle }),
  )
  const { toggleShortcutHelp } = useStoreShallow(
    useShortcutHelpStore,
    (state) => ({ toggleShortcutHelp: state.toggle }),
  )

  useEffect(() => {
    const unregisterLayoutCommands = registerLayoutCommands()
    const unregisterSearch = registerCommand({
      id: 'global:quick-search',
      shortcutId: 'quick-search',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        event.preventDefault()
        toggleSearch()
      },
    })
    const unregisterCommandPalette = registerCommand({
      id: 'global:command-palette',
      shortcutId: 'command-palette',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        event.preventDefault()
        toggleCommandPalette()
      },
    })
    const unregisterShortcuts = registerCommand({
      id: 'global:show-shortcuts',
      shortcutId: 'show-shortcuts',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        event.preventDefault()
        toggleShortcutHelp()
      },
    })
    const unregisterSettings = registerCommand({
      id: 'global:open-settings',
      shortcutId: 'open-settings',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        event.preventDefault()
        setSettingsOpen(true)
      },
    })
    const unregisterDiscover = registerCommand({
      id: 'global:toggle-discover',
      shortcutId: 'toggle-discover',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        event.preventDefault()
        setDiscoverOpen(true)
      },
    })
    const unregisterRefreshAll = registerCommand({
      id: 'global:refresh-all',
      shortcutId: 'refresh-all',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        event.preventDefault()
        void useFeedStore.getState().refreshAll()
      },
    })

    // 18.2 — Global shortcuts for entry actions (star / AI summarize / AI translate / AI chat)
    const unregisterToggleStar = registerCommand({
      id: 'global:toggle-star',
      shortcutId: 'toggle-star',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        const entry = useEntryStore.getState().selectedEntry
        if (!entry) return false
        event.preventDefault()
        void useEntryStore.getState().toggleStar(entry.id)
      },
    })

    const unregisterAISummarize = registerCommand({
      id: 'global:ai-summarize',
      shortcutId: 'ai-summarize',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        const entry = useEntryStore.getState().selectedEntry
        if (!entry?.content) return false
        event.preventDefault()
        // Open AI chat panel with a summarize prompt so the user sees the result
        const chat = useAIChatStore.getState()
        if (!chat.isPanelOpen) chat.setPanelOpen(true)
        setTimeout(() => {
          void useAIChatStore
            .getState()
            .sendMessage(`请为当前文章生成摘要：${entry.title || ''}`)
        }, 150)
      },
    })

    const unregisterAITranslate = registerCommand({
      id: 'global:ai-translate',
      shortcutId: 'ai-translate',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        const entry = useEntryStore.getState().selectedEntry
        if (!entry?.content) return false
        event.preventDefault()
        const chat = useAIChatStore.getState()
        if (!chat.isPanelOpen) chat.setPanelOpen(true)
        setTimeout(() => {
          void useAIChatStore
            .getState()
            .sendMessage(`请翻译当前文章为中文：${entry.title || ''}`)
        }, 150)
      },
    })

    const unregisterAIChat = registerCommand({
      id: 'global:ai-chat',
      shortcutId: 'ai-chat',
      blockedScopes: HOTKEY_OVERLAY_SCOPES,
      handler: (event) => {
        if (isEditableTarget(event.target)) return false
        event.preventDefault()
        useAIChatStore.getState().setPanelOpen(true)
      },
    })

    const handleGlobalShortcut = (event: KeyboardEvent) => {
      handleRegisteredShortcutEvent(event)
    }

    window.addEventListener('keydown', handleGlobalShortcut)

    return () => {
      window.removeEventListener('keydown', handleGlobalShortcut)
      unregisterRefreshAll()
      unregisterDiscover()
      unregisterSettings()
      unregisterCommandPalette()
      unregisterShortcuts()
      unregisterSearch()
      unregisterLayoutCommands()
      unregisterToggleStar()
      unregisterAISummarize()
      unregisterAITranslate()
      unregisterAIChat()
    }
  }, [
    setDiscoverOpen,
    setSettingsOpen,
    toggleCommandPalette,
    toggleSearch,
    toggleShortcutHelp,
  ])

  return children
}
