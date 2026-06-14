import { ipcMain } from 'electron'
import { IPC, ipcOk, ipcFail } from '../../shared/ipc-contracts'
import { syncReadingActivity } from '../services/reading-activity/reading-activity-sync'
import { logError } from '../services/system/logger'

export function registerReadingActivityHandlers(): void {
  ipcMain.handle(
    IPC.READING_ACTIVITY_SYNC,
    async (
      _event,
      deviceId: string,
      days: Array<{ day: string; count: number }>,
    ) => {
      try {
        const result = await syncReadingActivity(deviceId, days)
        return ipcOk(result)
      } catch (error) {
        logError('Failed to sync reading activity', error)
        return ipcFail({
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'internal_error',
        })
      }
    },
  )
}
