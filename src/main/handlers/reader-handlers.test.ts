import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/types'
import { registerReaderHandlers } from './reader-handlers'

const mocks = vi.hoisted(() => ({
  registerChannel: vi.fn(),
  whenDbReady: vi.fn(),
  getReaderSnapshot: vi.fn(),
}))

vi.mock('../ipc/register-channel', () => ({
  registerChannel: mocks.registerChannel,
}))

vi.mock('../database', () => ({
  whenDbReady: mocks.whenDbReady,
}))

vi.mock('../services/entry/reader-snapshot', () => ({
  getReaderSnapshot: mocks.getReaderSnapshot,
}))

describe('registerReaderHandlers', () => {
  beforeEach(() => {
    mocks.registerChannel.mockReset()
    mocks.whenDbReady.mockReset()
    mocks.getReaderSnapshot.mockReset()
  })

  it('首屏快照在读取数据库前等待 DB ready', async () => {
    const callOrder: string[] = []
    const snapshot = {
      feeds: [],
      entries: [],
      counts: {
        totalFeeds: 0,
        totalUnread: 0,
        unreadByFeedId: {},
        scopeUnread: 0,
      },
      nextCursor: null,
    }
    const input = { limit: 20 }

    mocks.whenDbReady.mockImplementation(async () => {
      callOrder.push('ready')
    })
    mocks.getReaderSnapshot.mockImplementation((receivedInput) => {
      callOrder.push('snapshot')
      expect(receivedInput).toBe(input)
      return snapshot
    })

    registerReaderHandlers()

    const [, handler] = mocks.registerChannel.mock.calls.find(
      ([channel]) => channel === IPC.READER_SNAPSHOT,
    )!

    await expect(handler({}, input)).resolves.toBe(snapshot)
    expect(callOrder).toEqual(['ready', 'snapshot'])
    expect(mocks.whenDbReady).toHaveBeenCalledTimes(1)
  })
})
