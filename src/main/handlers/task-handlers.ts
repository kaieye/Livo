import { IPC } from '../../shared/types'
import type { TaskRunListOptions } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { getLocalTaskRunner } from '../services/system/task-runner-service'

export function registerTaskHandlers(): void {
  registerChannel(IPC.TASK_RUN_GET, (_event, runId: string) => {
    return getLocalTaskRunner().getRun(runId) ?? null
  })

  registerChannel(IPC.TASK_RUN_LIST, (_event, options?: TaskRunListOptions) => {
    const limit = Math.max(1, Math.min(options?.limit ?? 50, 200))
    return getLocalTaskRunner()
      .listRecentRuns(options?.taskName)
      .slice()
      .reverse()
      .slice(0, limit)
  })
}
