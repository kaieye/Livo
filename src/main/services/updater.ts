import updaterPkg from 'electron-updater'
import { app, type BrowserWindow } from 'electron'
import type {
  AppUpdateInfo,
  AppUpdateInstallResult,
  AppUpdateState,
} from '../../shared/types'
import { __internal } from './system/update-check-internal'
import { checkForAppUpdates as checkWindowsUpdates } from './system/update-check'
import { installAppUpdate as installWindowsUpdate } from './system/update-install'

const { autoUpdater } = updaterPkg
const RELEASES_URL = 'https://github.com/kaieye/Livo/releases/latest'

function platformName(): AppUpdateInfo['platform'] {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return process.platform
  }
  return 'other'
}

function releaseNotesText(notes: unknown): string | undefined {
  if (typeof notes === 'string') return notes
  if (!Array.isArray(notes)) return undefined

  const text = notes
    .map((note) => {
      if (!note || typeof note !== 'object') return ''
      const value = (note as { note?: unknown }).note
      return typeof value === 'string' ? value : ''
    })
    .filter(Boolean)
    .join('\n\n')
  return text || undefined
}

export class UpdaterService {
  private window: BrowserWindow | null = null

  constructor(isDev: boolean) {
    if (isDev) {
      autoUpdater.updateConfigPath = null
      autoUpdater.forceDevUpdateConfig = false
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      this.sendToWindow('updater:available', info)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.sendToWindow('updater:progress', progress)
      this.sendUpdateState({
        status: 'downloading',
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.sendToWindow('updater:downloaded', info)
      this.sendUpdateState({ status: 'downloaded', percent: 100 })
    })

    autoUpdater.on('error', (error) => {
      this.sendToWindow('updater:error', error.message)
      this.sendUpdateState({ status: 'error', error: error.message })
    })
  }

  // autoUpdater 的事件可能在窗口销毁后（如退出过程中）触发，
  // 直接 send 会抛 "Object has been destroyed"。
  private sendToWindow(channel: string, ...args: unknown[]): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send(channel, ...args)
  }

  private sendUpdateState(state: AppUpdateState): void {
    this.sendToWindow('app:update-state', state)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  async checkForAppUpdates(force = false): Promise<AppUpdateInfo> {
    this.sendUpdateState({ status: 'checking' })
    const currentVersion = app.getVersion()
    const platform = platformName()

    if (platform !== 'darwin' || !app.isPackaged) {
      const info = await checkWindowsUpdates(force)
      const result: AppUpdateInfo = {
        ...info,
        canInstall:
          platform === 'win32' &&
          app.isPackaged &&
          info.hasUpdate &&
          !!info.installerDownloadUrl,
        platform,
      }
      this.sendUpdateState({
        status: result.error
          ? 'error'
          : result.hasUpdate
            ? 'available'
            : 'idle',
        info: result,
        error: result.error,
      })
      return result
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      const updateInfo = result?.updateInfo
      const latestVersion = updateInfo?.version
      const hasUpdate =
        !!latestVersion &&
        __internal.compareVersions(latestVersion, currentVersion) > 0
      const info: AppUpdateInfo = {
        hasUpdate,
        canInstall: hasUpdate,
        platform,
        currentVersion,
        latestVersion,
        releaseUrl: RELEASES_URL,
        publishedAt: updateInfo?.releaseDate,
        notes: releaseNotesText(updateInfo?.releaseNotes),
      }
      this.sendUpdateState({
        status: hasUpdate ? 'available' : 'idle',
        info,
      })
      return info
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const info: AppUpdateInfo = {
        hasUpdate: false,
        canInstall: false,
        platform,
        currentVersion,
        error: message,
      }
      this.sendUpdateState({ status: 'error', info, error: message })
      return info
    }
  }

  async installAppUpdate(): Promise<AppUpdateInstallResult> {
    if (process.platform === 'win32') {
      return installWindowsUpdate((state) => this.sendUpdateState(state))
    }
    if (process.platform !== 'darwin' || !app.isPackaged) {
      return {
        success: false,
        error: app.isPackaged
          ? '当前平台暂不支持应用内更新'
          : '开发模式无法执行应用内更新，请打包后验证',
      }
    }

    try {
      const info = await this.checkForAppUpdates()
      if (!info.hasUpdate || !info.canInstall) {
        return { success: false, error: '当前没有可安装的新版本' }
      }

      this.sendUpdateState({ status: 'downloading', percent: 0 })
      await autoUpdater.downloadUpdate()
      this.sendUpdateState({ status: 'downloaded', percent: 100 })
      this.sendUpdateState({ status: 'installing' })
      autoUpdater.quitAndInstall(false, true)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.sendUpdateState({ status: 'error', error: message })
      return { success: false, error: message }
    }
  }

  async checkForUpdates() {
    try {
      return await autoUpdater.checkForUpdates()
    } catch {
      return null
    }
  }

  downloadUpdate() {
    return autoUpdater.downloadUpdate()
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }
}
