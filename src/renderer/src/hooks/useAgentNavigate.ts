/**
 * Handles agent:navigate IPC events dispatched from main-process
 * navigation tools. Translates structured navigation intents into
 * renderer-side store / router actions.
 */
import { useEffect } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import type { AgentNavigationAction } from '@shared'
import { useSettingsStore } from '../store/settings-store'
import { useDiscoverStore } from '../store/discover-store'
import { useAIChatStore } from '../store/ai-chat-store'
import { ROUTES } from '../router/route-paths'

function closePanelsBeforeEntryNavigation(): void {
  const settingsStore = useSettingsStore.getState()
  if (settingsStore.isOpen) settingsStore.setOpen(false)

  const discoverStore = useDiscoverStore.getState()
  if (discoverStore.isOpen) discoverStore.setOpen(false)

  const aiChatStore = useAIChatStore.getState()
  if (aiChatStore.isPanelOpen) aiChatStore.setPanelOpen(false)
}

export function openEntryDetailFromAgent(
  entryId: string,
  navigate: NavigateFunction,
): void {
  const normalizedEntryId = entryId.trim()
  if (!normalizedEntryId) return

  closePanelsBeforeEntryNavigation()
  navigate(ROUTES.entry(normalizedEntryId))
}

export function useAgentNavigate() {
  const navigate = useNavigate()

  useEffect(() => {
    const cleanup = window.api.agent.onNavigate(
      (action: AgentNavigationAction) => {
        switch (action.type) {
          case 'open-root-tab': {
            const tab = action.tab
            if (tab === 'settings') {
              useSettingsStore.getState().setOpen(true)
              return
            }
            if (tab === 'discover') {
              useDiscoverStore.getState().setOpen(true)
              return
            }
            // 'home' — navigate to root
            navigate('/')
            return
          }
          case 'go-back':
            navigate(-1)
            return
          case 'open-entry-detail':
            openEntryDetailFromAgent(action.entryId, navigate)
            return
          case 'open-feed-detail':
            navigate(ROUTES.feed(action.feedId))
            return
          case 'open-settings-panel': {
            const store = useSettingsStore.getState()
            // Map agent panel IDs to SettingsTabId values.
            // 'settings' (the root-level panel) has no tab — just open the dialog.
            const panel = action.panel
            if (panel !== 'settings') {
              store.setActiveTab(panel)
            }
            store.setOpen(true)
            return
          }
          case 'open-video-player':
            // Video player requires an entryId — fall back to external browser
            if (action.videoUrl && window.api?.app?.openExternal) {
              void window.api.app.openExternal(action.videoUrl)
            }
            return
          case 'open-image-viewer':
            if (action.imageUrl && window.api?.app?.openExternal) {
              void window.api.app.openExternal(action.imageUrl)
            }
            return
        }
      },
    )
    return () => {
      cleanup()
    }
  }, [navigate])
}
