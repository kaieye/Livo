import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { logWarn } from './logger'

function createTrayImage() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'Livo.png')
    : join(app.getAppPath(), 'resources', 'Livo.png')
  const png = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 32, height: 32 })
  const pngDataUrl = png.toDataURL()
  const roundedSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">',
    '<defs><clipPath id="rc"><rect width="32" height="32" rx="9"/></clipPath></defs>',
    `<image href="${pngDataUrl}" width="32" height="32" clip-path="url(#rc)"/>`,
    '</svg>',
  ].join('')
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(roundedSvg)}`,
  )
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
