import { useEffect, type PropsWithChildren } from 'react'
import type { AppCommandPayload } from '../../../shared/types'
import { useQuickSearchStore } from '../store/quick-search-store'
import { useFeedStore } from '../store/feed-store'
import { useSettingsStore } from '../store/settings-store'

function isAppCommandPayload(value: unknown): value is AppCommandPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<AppCommandPayload>
  return typeof payload.type === 'string'
}

export function AppCommandProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!window.api?.on) return

    return window.api.on('app:command', (payload) => {
      if (!isAppCommandPayload(payload)) return

      switch (payload.type) {
        case 'open-settings':
        case 'open-data-settings': {
          const settingsStore = useSettingsStore.getState()
          settingsStore.setOpen(true)
          settingsStore.setActiveTab(
            payload.tab ??
              (payload.type === 'open-data-settings' ? 'data' : 'general'),
          )
          break
        }
        case 'open-search':
          useQuickSearchStore.getState().open()
          break
        case 'show-shortcuts': {
          const settingsStore = useSettingsStore.getState()
          settingsStore.setActiveTab('shortcuts')
          settingsStore.setOpen(true)
          break
        }
        case 'refresh-all':
          void useFeedStore.getState().refreshAll()
          break
        default:
          break
      }
    })
  }, [])

  return children
}
