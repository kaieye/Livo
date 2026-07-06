import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const defaultSession = {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    webRequest: {
      onBeforeSendHeaders: vi.fn(),
      onHeadersReceived: vi.fn(),
    },
  }
  const wechatSession = {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    webRequest: {
      onBeforeSendHeaders: vi.fn(),
      onHeadersReceived: vi.fn(),
    },
  }
  return {
    defaultSession,
    wechatSession,
    fromPartition: vi.fn(() => wechatSession),
  }
})

vi.mock('electron', () => ({
  session: {
    defaultSession: mocks.defaultSession,
    fromPartition: mocks.fromPartition,
  },
}))

import { registerSessionPolicies } from './session-policies'

describe('session policies', () => {
  it('denies permission requests and checks for default and login sessions', () => {
    registerSessionPolicies()

    expect(mocks.defaultSession.setPermissionRequestHandler).toHaveBeenCalled()
    expect(mocks.defaultSession.setPermissionCheckHandler).toHaveBeenCalled()
    expect(mocks.fromPartition).toHaveBeenCalledWith('persist:wechat-mp')
    expect(mocks.wechatSession.setPermissionRequestHandler).toHaveBeenCalled()
    expect(mocks.wechatSession.setPermissionCheckHandler).toHaveBeenCalled()

    const defaultRequestHandler =
      mocks.defaultSession.setPermissionRequestHandler.mock.calls[0]?.[0]
    const callback = vi.fn()
    defaultRequestHandler?.({}, 'media', callback)
    expect(callback).toHaveBeenCalledWith(false)

    const defaultCheckHandler =
      mocks.defaultSession.setPermissionCheckHandler.mock.calls[0]?.[0]
    expect(
      defaultCheckHandler?.({}, 'geolocation', 'https://evil.example'),
    ).toBe(false)
  })
})
