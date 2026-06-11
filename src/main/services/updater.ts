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
      this.window?.webContents.send('updater:available', info)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.window?.webContents.send('updater:progress', progress)
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.window?.webContents.send('updater:downloaded', info)
    })

    autoUpdater.on('error', (error) => {
      this.window?.webContents.send('updater:error', error.message)
    })
  }

  setWindow(window: BrowserWindow) {
    this.window = window
  }

  async checkForUpdates() {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (error) {
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
