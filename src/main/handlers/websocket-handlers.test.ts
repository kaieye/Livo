import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc-contracts'
import { registerWebSocketHandlers } from './websocket-handlers'
import type { WebSocketService } from '../services/websocket'

const registerChannelMock = vi.hoisted(() => vi.fn())
const getValidatedSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../ipc/register-channel', () => ({
  registerChannel: registerChannelMock,
}))

vi.mock('../services/auth/session-validation', () => ({
  getValidatedSession: getValidatedSessionMock,
}))

function getRegisteredHandler(channel: string) {
  const call = registerChannelMock.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  )
  expect(call).toBeTruthy()
  return call?.[1] as (...args: unknown[]) => Promise<unknown> | unknown
}

function createWsMock(): WebSocketService {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
  } as unknown as WebSocketService
}

describe('registerWebSocketHandlers', () => {
  beforeEach(() => {
    registerChannelMock.mockReset()
    getValidatedSessionMock.mockReset()
  })

  it('connects with the main-process validated session user id', async () => {
    const ws = createWsMock()
    getValidatedSessionMock.mockResolvedValue({
      token: 'secret-token',
      user: { id: 'session-user' },
    })

    registerWebSocketHandlers(ws)
    const result = await getRegisteredHandler(IPC.WS_CONNECT)()

    expect(result).toEqual({ success: true })
    expect(ws.connect).toHaveBeenCalledWith('session-user')
  })

  it('disconnects and fails when no authenticated session exists', async () => {
    const ws = createWsMock()
    getValidatedSessionMock.mockResolvedValue(null)

    registerWebSocketHandlers(ws)
    const result = await getRegisteredHandler(IPC.WS_CONNECT)()

    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
    })
    expect(ws.connect).not.toHaveBeenCalled()
    expect(ws.disconnect).toHaveBeenCalledTimes(1)
  })
})
