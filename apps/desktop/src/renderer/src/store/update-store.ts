import { create } from 'zustand'
import type { AppUpdateInfo } from '../../../shared/types'

interface UpdateState {
  currentVersion: string
  info: AppUpdateInfo | null
  isChecking: boolean
  lastCheckedAt: number | null
  dismissedVersion: string | null
  setCurrentVersion: (version: string) => void
  dismissVersion: (version: string) => void
  checkForUpdates: (force?: boolean) => Promise<AppUpdateInfo | null>
}

export const useUpdateStore = create<UpdateState>((set) => ({
  currentVersion: '',
  info: null,
  isChecking: false,
  lastCheckedAt: null,
  dismissedVersion: null,
  setCurrentVersion: (version) => set({ currentVersion: version }),
  dismissVersion: (version) => set({ dismissedVersion: version }),
  checkForUpdates: async (_force = false) => {
    if (!window.api?.app?.checkForUpdates) return null
    set({ isChecking: true })
    try {
      const info = await window.api.app.checkForUpdates()
      set({
        info,
        currentVersion: info.currentVersion,
        isChecking: false,
        lastCheckedAt: Date.now(),
      })
      return info
    } catch {
      set({ isChecking: false, lastCheckedAt: Date.now() })
      return null
    }
  },
}))
