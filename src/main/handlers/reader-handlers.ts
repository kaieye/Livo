import { IPC } from '../../shared/types'
import type { ReaderSnapshotRequest } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { getReaderSnapshot } from '../services/entry/reader-snapshot'

export function registerReaderHandlers(): void {
  registerChannel(
    IPC.READER_SNAPSHOT,
    (_event, input?: ReaderSnapshotRequest) => {
      return getReaderSnapshot(input)
    },
  )
}
