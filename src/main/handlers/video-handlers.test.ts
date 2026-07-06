import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('registerVideoHandlers YouTube account compatibility', () => {
  beforeEach(() => {
    registerChannelMock.mockReset()
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
})
