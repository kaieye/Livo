import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC, unwrapIpcEnvelope } from '../../shared/ipc-contracts'
import type { TaskContract } from '../services/system/task-contracts'

const handleMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
}))

vi.mock('../services/system/event-bus', () => ({
  getEventBus: () => ({
    send: vi.fn(),
  }),
}))

type RegisteredHandler = (
  event: Record<string, never>,
  ...args: unknown[]
) => Promise<unknown>

function getRegisteredHandler(channel: string): RegisteredHandler {
  const call = handleMock.mock.calls.find(
    ([registered]) => registered === channel,
  )
  if (!call) throw new Error(`Missing IPC handler: ${channel}`)
  return call[1] as RegisteredHandler
}

describe('registerTaskHandlers', () => {
  beforeEach(async () => {
    vi.resetModules()
    handleMock.mockReset()
    const { resetLocalTaskRunnerForTest } =
      await import('../services/system/task-runner-service')
    resetLocalTaskRunnerForTest()
  })

  it('exposes recent Task Runner records through IPC envelopes', async () => {
    const { getLocalTaskRunner } =
      await import('../services/system/task-runner-service')
    const { registerTaskHandlers } = await import('./task-handlers')
    const contract: TaskContract<{ id: string }> = {
      name: 'test.ipc_task',
      concurrency: 1,
      dedupeKey: (payload) => payload.id,
    }

    const run = getLocalTaskRunner().enqueue(
      contract,
      { id: 'a' },
      async () => 'ok',
      { metadata: { source: 'test' } },
    )
    await expect(run.promise).resolves.toBe('ok')
    registerTaskHandlers()

    const getRun = getRegisteredHandler(IPC.TASK_RUN_GET)
    const listRuns = getRegisteredHandler(IPC.TASK_RUN_LIST)

    expect(unwrapIpcEnvelope(await getRun({}, run.runId))).toMatchObject({
      runId: run.runId,
      taskName: 'test.ipc_task',
      status: 'succeeded',
      metadata: { source: 'test' },
    })
    expect(
      unwrapIpcEnvelope(
        await listRuns({}, { taskName: 'test.ipc_task', limit: 1 }),
      ),
    ).toEqual([
      expect.objectContaining({
        runId: run.runId,
        taskName: 'test.ipc_task',
      }),
    ])
  })
})
