import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { registerVideoHandlers } from './video-handlers'
import {
  getAccountState,
  linkAccount,
  unlinkAccount,
} from '../services/account/account-auth'

const registerChannelMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}))

vi.mock('../ipc/register-channel', () => ({
  registerChannel: registerChannelMock,
}))

vi.mock('../services/video/video-proxy', () => ({
  resolveVideoUrl: vi.fn(),
}))

vi.mock('../services/account/account-auth', () => ({
  getAccountState: vi.fn(),
  linkAccount: vi.fn(),
  unlinkAccount: vi.fn(),
}))

function getRegisteredHandler(channel: string) {
  const call = registerChannelMock.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  )
  expect(call).toBeTruthy()
  return call?.[1] as (...args: unknown[]) => Promise<unknown>
}

function mockVideoWindow() {
  const loadURL = vi.fn().mockResolvedValue(undefined)
  const setUserAgent = vi.fn()
  const setWindowOpenHandler = vi.fn()
  const on = vi.fn()

  vi.mocked(BrowserWindow).mockImplementation(
    () =>
      ({
        loadURL,
        webContents: {
          setUserAgent,
          setWindowOpenHandler,
          on,
        },
      }) as unknown as BrowserWindow,
  )

  return {
    loadURL,
    setUserAgent,
    setWindowOpenHandler,
    on,
  }
}

function getWindowOpenHandler(windowMock: ReturnType<typeof mockVideoWindow>) {
  const handler = windowMock.setWindowOpenHandler.mock.calls[0]?.[0]
  expect(handler).toBeTypeOf('function')
  return handler as (details: { url: string }) => { action: string }
}

function getWillNavigateHandler(
  windowMock: ReturnType<typeof mockVideoWindow>,
) {
  const call = windowMock.on.mock.calls.find(
    ([event]) => event === 'will-navigate',
  )
  expect(call).toBeTruthy()
  return call?.[1] as (
    event: { preventDefault: () => void },
    url: string,
  ) => void
}

describe('registerVideoHandlers YouTube account compatibility', () => {
  beforeEach(() => {
    registerChannelMock.mockReset()
    vi.mocked(BrowserWindow).mockReset()
    vi.mocked(getAccountState).mockReset()
    vi.mocked(linkAccount).mockReset()
    vi.mocked(unlinkAccount).mockReset()
  })

  it('routes legacy YouTube login/status/logout through account auth', async () => {
    vi.mocked(linkAccount).mockResolvedValue({ success: true })
    vi.mocked(getAccountState).mockResolvedValue({
      provider: 'youtube',
      linked: true,
      displayName: 'Livo Tube',
    })
    vi.mocked(unlinkAccount).mockResolvedValue({ success: true })

    registerVideoHandlers()

    await expect(getRegisteredHandler(IPC.VIDEO_YT_LOGIN)()).resolves.toEqual({
      success: true,
    })
    await expect(getRegisteredHandler(IPC.VIDEO_YT_STATUS)()).resolves.toEqual({
      loggedIn: true,
      name: 'Livo Tube',
    })
    await expect(getRegisteredHandler(IPC.VIDEO_YT_LOGOUT)()).resolves.toEqual({
      success: true,
    })

    expect(linkAccount).toHaveBeenCalledWith('youtube')
    expect(getAccountState).toHaveBeenCalledWith('youtube')
    expect(unlinkAccount).toHaveBeenCalledWith('youtube')
  })

  it('rejects unsafe in-app video URLs before creating a window', async () => {
    registerVideoHandlers()
    const handler = getRegisteredHandler(IPC.VIDEO_OPEN_IN_APP)

    await expect(handler(null, 'javascript:alert(1)')).resolves.toEqual({
      success: false,
      error: 'unsupported-protocol',
    })
    await expect(handler(null, 'https://127.0.0.1/watch')).resolves.toEqual({
      success: false,
      error: 'suspicious_url',
    })

    expect(BrowserWindow).not.toHaveBeenCalled()
  })

  it('loads normalized safe URLs in a sandboxed video window', async () => {
    const windowMock = mockVideoWindow()
    registerVideoHandlers()

    await expect(
      getRegisteredHandler(IPC.VIDEO_OPEN_IN_APP)(
        null,
        ' https://example.com/watch ',
      ),
    ).resolves.toEqual({ success: true })

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        }),
      }),
    )
    expect(windowMock.loadURL).toHaveBeenCalledWith('https://example.com/watch')
  })

  it('denies popups and blocks unsafe or cross-origin video navigation', async () => {
    const windowMock = mockVideoWindow()
    registerVideoHandlers()

    await getRegisteredHandler(IPC.VIDEO_OPEN_IN_APP)(
      null,
      'https://example.com/watch',
    )

    expect(
      getWindowOpenHandler(windowMock)({ url: 'https://example.com/popup' }),
    ).toEqual({ action: 'deny' })

    const willNavigate = getWillNavigateHandler(windowMock)
    const sameOriginEvent = { preventDefault: vi.fn() }
    willNavigate(sameOriginEvent, 'https://example.com/next')
    expect(sameOriginEvent.preventDefault).not.toHaveBeenCalled()

    const crossOriginEvent = { preventDefault: vi.fn() }
    willNavigate(crossOriginEvent, 'https://evil.example/')
    expect(crossOriginEvent.preventDefault).toHaveBeenCalled()

    const unsafeEvent = { preventDefault: vi.fn() }
    willNavigate(unsafeEvent, 'javascript:alert(1)')
    expect(unsafeEvent.preventDefault).toHaveBeenCalled()
  })
})
