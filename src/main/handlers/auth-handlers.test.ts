import { beforeEach, describe, expect, it, vi } from 'vitest'

const registerChannelMock = vi.hoisted(() => vi.fn())
const authServiceMock = vi.hoisted(() => ({
  getGoogleLoginUrl: vi.fn(),
  pollLoginStatus: vi.fn(),
}))
const sessionStoreMock = vi.hoisted(() => ({
  saveSession: vi.fn(),
}))
const getValidatedSessionMock = vi.hoisted(() => vi.fn())
const feedSyncMock = vi.hoisted(() => vi.fn())
const browserWindowInstances = vi.hoisted(
  () =>
    [] as Array<{
      webContents: {
        setWindowOpenHandler: ReturnType<typeof vi.fn>
        on: ReturnType<typeof vi.fn>
        send: ReturnType<typeof vi.fn>
      }
      on: ReturnType<typeof vi.fn>
      loadURL: ReturnType<typeof vi.fn>
      isDestroyed: ReturnType<typeof vi.fn>
      close: ReturnType<typeof vi.fn>
    }>,
)

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => {
    const win = {
      webContents: {
        setWindowOpenHandler: vi.fn(),
        on: vi.fn(),
        send: vi.fn(),
      },
      on: vi.fn(),
      loadURL: vi.fn().mockResolvedValue(undefined),
      isDestroyed: vi.fn(() => false),
      close: vi.fn(),
    }
    browserWindowInstances.push(win)
    return win
  }),
}))
vi.mock('../ipc/register-channel', () => ({
  registerChannel: registerChannelMock,
}))
vi.mock('../services/auth/auth-service', () => ({
  authService: authServiceMock,
}))
vi.mock('../services/auth/session-store', () => ({
  sessionStore: sessionStoreMock,
}))
vi.mock('../services/auth/session-validation', () => ({
  getValidatedSession: getValidatedSessionMock,
}))
vi.mock('../services/feed/feed-sync-service', () => ({
  feedSyncService: { syncNow: feedSyncMock },
}))
vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
}))
vi.mock('../services/backend/backend-config', () => ({
  getBackendBaseUrl: () => 'https://api.livo.example',
}))

import { isAuthPopupUrlAllowed } from './auth-handlers'
import { registerAuthHandlers } from './auth-handlers'
import { IPC } from '../../shared/ipc-contracts'

const user = {
  id: 'user-1',
  displayName: 'Alice',
  avatarUrl: null,
  role: 'user',
  status: 'active',
  createdAt: '2026-07-07T00:00:00.000Z',
}

function getRegisteredHandler(channel: string) {
  const call = registerChannelMock.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  )
  expect(call).toBeTruthy()
  return call?.[1] as (...args: unknown[]) => Promise<unknown>
}

beforeEach(() => {
  registerChannelMock.mockReset()
  authServiceMock.getGoogleLoginUrl.mockReset()
  authServiceMock.pollLoginStatus.mockReset()
  sessionStoreMock.saveSession.mockReset()
  getValidatedSessionMock.mockReset()
  feedSyncMock.mockReset()
  feedSyncMock.mockResolvedValue(undefined)
  browserWindowInstances.length = 0
})

describe('auth popup navigation policy', () => {
  it('allows backend and expected provider URLs', () => {
    expect(
      isAuthPopupUrlAllowed('google', 'https://api.livo.example/auth/callback'),
    ).toBe(true)
    expect(
      isAuthPopupUrlAllowed(
        'google',
        'https://accounts.google.com/o/oauth2/v2/auth',
      ),
    ).toBe(true)
    expect(
      isAuthPopupUrlAllowed('wechat', 'https://open.weixin.qq.com/connect/qr'),
    ).toBe(true)
  })

  it('blocks backend-supplied arbitrary HTTPS URLs', () => {
    expect(isAuthPopupUrlAllowed('google', 'https://evil.example/login')).toBe(
      false,
    )
    expect(
      isAuthPopupUrlAllowed('wechat', 'https://weixin.qq.com.evil.example/'),
    ).toBe(false)
  })
})

describe('registerAuthHandlers auth token redaction', () => {
  it('stores login tokens in main but does not return them to the renderer', async () => {
    authServiceMock.getGoogleLoginUrl.mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      loginId: 'login-1',
    })
    authServiceMock.pollLoginStatus.mockResolvedValue({
      status: 'completed',
      token: 'secret-token',
      user,
    })

    registerAuthHandlers()
    const result = await getRegisteredHandler(IPC.AUTH_LOGIN_GOOGLE)()

    expect(result).toEqual({ success: true, user })
    expect(result).not.toHaveProperty('token')
    expect(sessionStoreMock.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'secret-token',
        userId: user.id,
        user,
      }),
    )
  })

  it('does not return the validated session token from current-user IPC', async () => {
    getValidatedSessionMock.mockResolvedValue({
      token: 'secret-token',
      user,
    })

    registerAuthHandlers()
    const result = await getRegisteredHandler(IPC.AUTH_GET_CURRENT_USER)()

    expect(result).toEqual({ success: true, user })
    expect(result).not.toHaveProperty('token')
  })
})
