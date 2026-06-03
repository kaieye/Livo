import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc-contracts'
import { registerChannel } from './register-channel'

const handleMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
}))

vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

describe('registerChannel', () => {
  beforeEach(() => {
    handleMock.mockReset()
  })

  it('wraps handler results in an IPC envelope', async () => {
    registerChannel(IPC.FEED_REMOVE, async () => ({ success: true }))

    const [, handler] = handleMock.mock.calls[0]
    const result = await handler({}, 'feed-1')

    expect(result).toEqual({ ok: true, data: { success: true } })
  })

  it('returns validation errors before invoking the handler', async () => {
    const handlerMock = vi.fn()
    registerChannel(IPC.FEED_REMOVE, handlerMock)

    const [, handler] = handleMock.mock.calls[0]
    const result = await handler({}, 123)

    expect(handlerMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'validation_error' },
    })
  })
})
