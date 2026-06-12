import { app } from 'electron'
import { join } from 'path'

export function getAppIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'yuanjiao-Livo.png')
    : join(app.getAppPath(), 'resources', 'yuanjiao-Livo.png')
}
