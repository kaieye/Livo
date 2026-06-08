import { IPC } from '../../shared/types'
import type { ReaderSnapshotRequest } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { whenDbReady } from '../database'
import { getReaderSnapshot } from '../services/entry/reader-snapshot'

export function registerReaderHandlers(): void {
  registerChannel(
    IPC.READER_SNAPSHOT,
    async (_event, input?: ReaderSnapshotRequest) => {
      // renderer shell 现在会早于数据库 hydrate 挂载，首屏快照需要等待 DB。
      await whenDbReady()
      return getReaderSnapshot(input)
    },
  )
}
