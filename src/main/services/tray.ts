import { Menu, Tray, nativeImage } from 'electron'
import { logWarn } from './logger'

function createTrayImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill="#FF7A1A"/>
      <path d="M9 10.5a7 7 0 0 1 14 0v1.2c0 3.1 1.1 5 2.6 6.9.4.5 0 1.3-.7 1.3H7.1c-.7 0-1.1-.8-.7-1.3 1.5-1.9 2.6-3.8 2.6-6.9z" fill="#fff"/>
      <circle cx="16" cy="23.6" r="2.1" fill="#fff"/>
    </svg>
  `.trim()
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
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
