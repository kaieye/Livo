import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc-contracts'
import { cloneDefaultSettings } from '../../shared/settings'

const appGetPathMock = vi.hoisted(() => vi.fn())
const handleMock = vi.hoisted(() => vi.fn())
const applyProxySettingsMock = vi.hoisted(() => vi.fn())
const eventSendMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: appGetPathMock,
  },
  ipcMain: {
    handle: handleMock,
  },
}))

vi.mock('../services/system/event-bus', () => ({
  getEventBus: () => ({
    send: eventSendMock,
  }),
}))

vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('../services/system/proxy', () => ({
  applyProxySettings: applyProxySettingsMock,
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

describe('registerSettingsHandlers', () => {
  let userDataDir: string

  beforeEach(() => {
    vi.resetModules()
    handleMock.mockReset()
    applyProxySettingsMock.mockReset()
    eventSendMock.mockReset()
    userDataDir = mkdtempSync(join(tmpdir(), 'livo-settings-handler-'))
    appGetPathMock.mockReturnValue(userDataDir)
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('wraps settings:get with the default settings envelope', async () => {
    const { registerSettingsHandlers } = await import('./settings-handlers')
    registerSettingsHandlers()

    const handler = getRegisteredHandler(IPC.SETTINGS_GET)
    const result = await handler({})

    expect(result).toEqual({
      ok: true,
      data: cloneDefaultSettings(),
    })
  })

  it('persists settings:set and applies proxy settings through the IPC contract', async () => {
    const { registerSettingsHandlers } = await import('./settings-handlers')
    registerSettingsHandlers()

    const handler = getRegisteredHandler(IPC.SETTINGS_SET)
    const result = await handler(
      {},
      { general: { proxyUrl: 'http://127.0.0.1:7890' } },
    )

    expect(result).toMatchObject({
      ok: true,
      data: {
        success: true,
        settings: {
          general: {
            proxyUrl: 'http://127.0.0.1:7890',
          },
        },
      },
    })
    expect(applyProxySettingsMock).toHaveBeenCalledTimes(1)
    expect(applyProxySettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        general: expect.objectContaining({
          proxyUrl: 'http://127.0.0.1:7890',
        }),
      }),
    )

    const settingsPath = join(userDataDir, 'data', 'settings.json')
    expect(existsSync(settingsPath)).toBe(true)
    const saved = JSON.parse(readFileSync(settingsPath, 'utf-8')) as {
      general: { proxyUrl: string }
    }
    expect(saved.general.proxyUrl).toBe('http://127.0.0.1:7890')
  })

  it('rejects invalid settings:set payloads before applying side effects', async () => {
    const { registerSettingsHandlers } = await import('./settings-handlers')
    registerSettingsHandlers()

    const handler = getRegisteredHandler(IPC.SETTINGS_SET)
    const result = await handler({}, 'not-settings')

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'validation_error' },
    })
    expect(applyProxySettingsMock).not.toHaveBeenCalled()
    expect(existsSync(join(userDataDir, 'data', 'settings.json'))).toBe(false)
  })
})
