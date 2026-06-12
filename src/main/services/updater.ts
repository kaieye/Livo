import updaterPkg from 'electron-updater'
import type { BrowserWindow } from 'electron'

const { autoUpdater } = updaterPkg

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
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.sendToWindow('updater:downloaded', info)
    })

    autoUpdater.on('error', (error) => {
      this.sendToWindow('updater:error', error.message)
    })
  }

  // autoUpdater 的事件可能在窗口销毁后（如退出过程中）触发，
  // 直接 send 会抛 "Object has been destroyed"。
  private sendToWindow(channel: string, ...args: unknown[]) {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send(channel, ...args)
  }

  setWindow(window: BrowserWindow) {
    this.window = window
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

  quitAndInstall() {
    autoUpdater.quitAndInstall(false, true)
  }
}
