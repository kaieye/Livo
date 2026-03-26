import { useEffect, type PropsWithChildren } from 'react'
import { useDiscoverStore } from '../store/discover-store'
import { useSettingsStore } from '../store/settings-store'
import { useStoreShallow } from '../store/helpers'
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
