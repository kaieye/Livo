import { IPC } from '../../shared/ipc-contracts'
import { registerChannel } from '../ipc/register-channel'
import { syncReadingActivity } from '../services/reading-activity/reading-activity-sync'

export function registerReadingActivityHandlers(): void {
  registerChannel(IPC.READING_ACTIVITY_SYNC, async (_event, deviceId, days) => {
    return syncReadingActivity(deviceId, days)
  })
}
