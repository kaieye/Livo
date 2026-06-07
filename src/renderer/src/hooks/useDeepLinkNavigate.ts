import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SettingsTabId } from '@shared'
import { ROUTES } from '../router/route-paths'
import { useDiscoverStore } from '../store/discover-store'
import { useEntryStore } from '../store/entry-store'
import { useFeedStore } from '../store/feed-store'
import { useSettingsStore } from '../store/settings-store'
import { openEntryDetailFromAgent } from './useAgentNavigate'

function closePanelsBeforeDeepLinkNavigation(): void {
  const settingsStore = useSettingsStore.getState()
  if (settingsStore.isOpen) settingsStore.setOpen(false)

  const discoverStore = useDiscoverStore.getState()
  if (discoverStore.isOpen) discoverStore.setOpen(false)
}

function openSettings(tab: SettingsTabId | undefined): void {
  const store = useSettingsStore.getState()
  if (typeof tab === 'string') store.setActiveTab(tab)
  store.setOpen(true)
}

export function useDeepLinkNavigate(): void {
  const navigate = useNavigate()

  useEffect(() => {
    return window.api.on('app:deep-link', (action) => {
      switch (action.type) {
        case 'add-feed':
          closePanelsBeforeDeepLinkNavigation()
          navigate(ROUTES.discoverSubscribe({ url: action.url }))
          return
        case 'open-entry':
          openEntryDetailFromAgent(action.entryId, navigate)
          return
        case 'open-feed':
          closePanelsBeforeDeepLinkNavigation()
          navigate(ROUTES.feed(action.feedId))
          return
        case 'preview-feed':
          closePanelsBeforeDeepLinkNavigation()
          if (action.url) {
            navigate(ROUTES.discoverPreview({ url: action.url }))
          } else {
            useDiscoverStore.getState().setOpen(true)
            navigate(ROUTES.discover)
          }
          return
        case 'open-search': {
          closePanelsBeforeDeepLinkNavigation()
          navigate(ROUTES.home)
          if (action.query) {
            const entryStore = useEntryStore.getState()
            entryStore.setSearchQuery(action.query)
            void entryStore.search(action.query)
          }
          return
        }
        case 'open-starred':
          closePanelsBeforeDeepLinkNavigation()
          navigate(ROUTES.starred)
          return
        case 'open-view':
          closePanelsBeforeDeepLinkNavigation()
          navigate(ROUTES.viewType(action.view))
          return
        case 'open-settings':
          openSettings(action.tab)
          navigate(ROUTES.settings)
          return
        case 'import-opml':
          void window.api.feeds.importOPML()
          return
        case 'refresh-all':
          void useFeedStore.getState().refreshAll()
          return
        case 'login':
          closePanelsBeforeDeepLinkNavigation()
          navigate(ROUTES.login(action.provider))
          return
      }
    })
  }, [navigate])
}
