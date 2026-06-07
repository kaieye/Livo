import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { feedSyncService } from '../services/feed/feed-sync-service'

export function registerFeedSyncHandlers(): void {
  registerChannel(IPC.FEED_SYNC_NOW, async () => {
    try {
      return await feedSyncService.syncNow()
    } catch (error) {
      return toHandlerError(error, '订阅源同步失败')
    }
  })

  registerChannel(IPC.FEED_SYNC_TO_CLOUD, async () => {
    try {
      return await feedSyncService.syncToCloud()
    } catch (error) {
      return toHandlerError(error, '订阅源上传失败')
    }
  })

  registerChannel(IPC.FEED_SYNC_FROM_CLOUD, async () => {
    try {
      return await feedSyncService.syncFromCloud()
    } catch (error) {
      return toHandlerError(error, '订阅源拉取失败')
    }
  })

  registerChannel(IPC.FEED_SYNC_STATUS, () => {
    return feedSyncService.getStatus()
  })
}
