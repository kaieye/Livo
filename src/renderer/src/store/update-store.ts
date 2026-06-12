import { create } from 'zustand'
import type {
  AppUpdateInfo,
  AppUpdateInstallResult,
} from '../../../shared/types'

interface UpdateState {
  currentVersion: string
  info: AppUpdateInfo | null
  isChecking: boolean
  isInstallingUpdate: boolean
  installError: string | null
  lastCheckedAt: number | null
  dismissedVersion: string | null
  setCurrentVersion: (version: string) => void
  dismissVersion: (version: string) => void
  checkForUpdates: (force?: boolean) => Promise<AppUpdateInfo | null>
  installUpdate: () => Promise<AppUpdateInstallResult | null>
}

export const useUpdateStore = create<UpdateState>((set) => ({
  currentVersion: '',
  info: null,
  isChecking: false,
  isInstallingUpdate: false,
  installError: null,
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
        installError: null,
        lastCheckedAt: Date.now(),
      })
      return info
    } catch {
      set({ isChecking: false, lastCheckedAt: Date.now() })
      return null
    }
  },
  installUpdate: async () => {
    if (!window.api?.app?.installUpdate) return null
    set({ isInstallingUpdate: true, installError: null })
    try {
      const result = await window.api.app.installUpdate()
      set({
        isInstallingUpdate: false,
        installError: result.success ? null : result.error || '更新失败',
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ isInstallingUpdate: false, installError: message })
      return { success: false, error: message }
    }
  },
}))
