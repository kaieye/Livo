import { create } from 'zustand'
import type {
  AppUpdateInfo,
  AppUpdateInstallResult,
  AppUpdateState,
  AppUpdateStatus,
} from '../../../shared/types'

interface UpdateState {
  currentVersion: string
  info: AppUpdateInfo | null
  isChecking: boolean
  isInstallingUpdate: boolean
  installError: string | null
  updateStatus: AppUpdateStatus
  downloadProgress: number | null
  lastCheckedAt: number | null
  dismissedVersion: string | null
  setCurrentVersion: (version: string) => void
  dismissVersion: (version: string) => void
  applyUpdateState: (state: AppUpdateState) => void
  checkForUpdates: (force?: boolean) => Promise<AppUpdateInfo | null>
  installUpdate: () => Promise<AppUpdateInstallResult | null>
}

function clampProgress(percent: number | undefined): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return null
  return Math.max(0, Math.min(100, percent))
}

const MAC_MANUAL_INSTALL_ERROR =
  '当前 macOS 安装包不支持应用内覆盖安装，请下载 DMG 手动更新'

export const useUpdateStore = create<UpdateState>((set, get) => ({
  currentVersion: '',
  info: null,
  isChecking: false,
  isInstallingUpdate: false,
  installError: null,
  updateStatus: 'idle',
  downloadProgress: null,
  lastCheckedAt: null,
  dismissedVersion: null,
  setCurrentVersion: (version) => set({ currentVersion: version }),
  dismissVersion: (version) => set({ dismissedVersion: version }),
  applyUpdateState: (state) => {
    switch (state.status) {
      case 'checking':
        set({ isChecking: true, updateStatus: 'checking' })
        break
      case 'available':
      case 'idle':
        set((current) => ({
          info: state.info ?? current.info,
          currentVersion: state.info?.currentVersion ?? current.currentVersion,
          isChecking: false,
          updateStatus: state.status,
          installError: null,
        }))
        break
      case 'downloading':
        set({
          isChecking: false,
          isInstallingUpdate: true,
          updateStatus: 'downloading',
          downloadProgress: clampProgress(state.percent),
          installError: null,
        })
        break
      case 'downloaded':
        set({
          isInstallingUpdate: true,
          updateStatus: 'downloaded',
          downloadProgress: 100,
        })
        break
      case 'installing':
        set({
          isInstallingUpdate: true,
          updateStatus: 'installing',
          downloadProgress: 100,
        })
        break
      case 'error':
        set((current) => ({
          info: state.info ?? current.info,
          isChecking: false,
          isInstallingUpdate: false,
          updateStatus: 'error',
          installError: state.error || '更新失败',
        }))
        break
    }
  },
  checkForUpdates: async (_force = false) => {
    if (!window.api?.app?.checkForUpdates) return null
    set({ isChecking: true, updateStatus: 'checking' })
    try {
      const info = await window.api.app.checkForUpdates(_force)
      set({
        info,
        currentVersion: info.currentVersion,
        isChecking: false,
        updateStatus: info.error
          ? 'error'
          : info.hasUpdate
            ? 'available'
            : 'idle',
        installError: null,
        lastCheckedAt: Date.now(),
      })
      return info
    } catch {
      set({
        isChecking: false,
        updateStatus: 'error',
        lastCheckedAt: Date.now(),
      })
      return null
    }
  },
  installUpdate: async () => {
    if (!window.api?.app?.installUpdate) return null
    if (get().info?.canInstall === false) {
      set({
        isInstallingUpdate: false,
        updateStatus: 'error',
        downloadProgress: null,
        installError: MAC_MANUAL_INSTALL_ERROR,
      })
      return { success: false, error: MAC_MANUAL_INSTALL_ERROR }
    }
    set({
      isInstallingUpdate: true,
      installError: null,
      updateStatus: 'downloading',
      downloadProgress: 0,
    })
    try {
      const result = await window.api.app.installUpdate()
      set({
        isInstallingUpdate: result.success,
        updateStatus: result.success ? 'installing' : 'error',
        downloadProgress: result.success ? 100 : null,
        installError: result.success ? null : result.error || '更新失败',
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({
        isInstallingUpdate: false,
        updateStatus: 'error',
        downloadProgress: null,
        installError: message,
      })
      return { success: false, error: message }
    }
  },
}))
