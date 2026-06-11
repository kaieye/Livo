import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { logInfo, logWarn } from './logger'

function createTrayImage() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'yuanjiao-Livo.png')
    : join(app.getAppPath(), 'resources', 'yuanjiao-Livo.png')

  logInfo('[tray] loading icon from', iconPath)

  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    logWarn('[tray] image is empty, path may be wrong:', iconPath)
    return nativeImage.createEmpty()
  }

  logInfo('[tray] loaded image size:', image.getSize())

  const resized = image.resize({ width: 32, height: 32 })
  logInfo('[tray] resized to:', resized.getSize())
  return resized
}

export class AppTray {
  private tray: Tray | null = null

  constructor(
    private readonly actions: {
      showWindow: () => void
      hideWindow: () => void
      refreshAll: () => void
      openSettings: () => void
      checkForUpdates: () => void
      quit: () => void
      isWindowVisible: () => boolean
    },
  ) {}

  ensureCreated(): void {
    if (this.tray) return
    try {
      this.tray = new Tray(createTrayImage())
      this.tray.setToolTip('Livo')
      this.tray.on('click', () => {
        if (this.actions.isWindowVisible()) {
          this.actions.hideWindow()
        } else {
          this.actions.showWindow()
        }
      })
      this.refreshMenu()
    } catch (error) {
      logWarn('[tray] failed to create tray', error)
    }
  }

  refreshMenu(): void {
    if (!this.tray) return
    const menu = Menu.buildFromTemplate([
      {
        label: this.actions.isWindowVisible() ? '隐藏 Livo' : '显示 Livo',
        click: () => {
          if (this.actions.isWindowVisible()) {
            this.actions.hideWindow()
          } else {
            this.actions.showWindow()
          }
          this.refreshMenu()
        },
      },
      {
        label: '刷新全部订阅',
        click: () => this.actions.refreshAll(),
      },
      {
        label: '设置',
        click: () => this.actions.openSettings(),
      },
      {
        label: '检查更新',
        click: () => this.actions.checkForUpdates(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.actions.quit(),
      },
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    if (!this.tray) return
    this.tray.destroy()
    this.tray = null
  }
}
