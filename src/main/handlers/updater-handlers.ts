import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import type { UpdaterService } from '../services/updater'

export function registerUpdaterHandlers(updater: UpdaterService): void {
  registerChannel(IPC.UPDATER_CHECK, async () => {
    const result = await updater.checkForUpdates()
    return { success: !!result, updateInfo: result?.updateInfo }
  })

  registerChannel(IPC.UPDATER_DOWNLOAD, async () => {
    await updater.downloadUpdate()
    return { success: true }
  })

  registerChannel(IPC.UPDATER_INSTALL, () => {
    updater.quitAndInstall()
    return { success: true }
  })
}
