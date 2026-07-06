import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc-contracts'
import { registerReadingActivityHandlers } from './reading-activity-handlers'
import { syncReadingActivity } from '../services/reading-activity/reading-activity-sync'

const registerChannelMock = vi.hoisted(() => vi.fn())

vi.mock('../ipc/register-channel', () => ({
  registerChannel: registerChannelMock,
}))

vi.mock('../services/reading-activity/reading-activity-sync', () => ({
  syncReadingActivity: vi.fn(),
}))

function getRegisteredHandler() {
  const call = registerChannelMock.mock.calls.find(
    ([channel]) => channel === IPC.READING_ACTIVITY_SYNC,
  )
  expect(call).toBeTruthy()
  return call?.[1] as (
    event: unknown,
    deviceId: string,
    days: Array<{ day: string; count: number }>,
  ) => Promise<unknown>
}

describe('registerReadingActivityHandlers', () => {
  beforeEach(() => {
    registerChannelMock.mockReset()
    vi.mocked(syncReadingActivity).mockReset()
  })

  it('registers reading activity sync through the validated channel wrapper', async () => {
    vi.mocked(syncReadingActivity).mockResolvedValue({
      uploaded: 1,
      aggregatedDays: [{ day: '2026-07-07', count: 3 }],
    })

    registerReadingActivityHandlers()

    expect(registerChannelMock).toHaveBeenCalledWith(
      IPC.READING_ACTIVITY_SYNC,
      expect.any(Function),
    )

    const days = [{ day: '2026-07-07', count: 3 }]
    await expect(getRegisteredHandler()({}, 'device-1', days)).resolves.toEqual(
      {
        uploaded: 1,
        aggregatedDays: [{ day: '2026-07-07', count: 3 }],
      },
    )
    expect(syncReadingActivity).toHaveBeenCalledWith('device-1', days)
  })
})
