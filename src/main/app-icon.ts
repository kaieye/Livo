import { app } from 'electron'
import { join } from 'path'

export function getAppIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'yuanjiao-Livo.png')
    : join(app.getAppPath(), 'resources', 'yuanjiao-Livo.png')
}

export function getTrayIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(app.getAppPath(), 'resources', 'tray.png')
}
