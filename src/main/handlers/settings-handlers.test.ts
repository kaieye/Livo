import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc-contracts'
import { cloneDefaultSettings } from '../../shared/settings'

const appGetPathMock = vi.hoisted(() => vi.fn())
const handleMock = vi.hoisted(() => vi.fn())
const applyProxySettingsMock = vi.hoisted(() => vi.fn())
const eventSendMock = vi.hoisted(() => vi.fn())
const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) =>
    Buffer.from(`encrypted:${value}`, 'utf8'),
  ),
  decryptString: vi.fn((value: Buffer) =>
    value.toString('utf8').replace(/^encrypted:/, ''),
  ),
}))

vi.mock('electron', () => ({
  app: {
    getPath: appGetPathMock,
  },
  ipcMain: {
    handle: handleMock,
  },
  safeStorage: safeStorageMock,
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
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    safeStorageMock.encryptString.mockClear()
    safeStorageMock.decryptString.mockClear()
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

  it('does not rewrite ordinary plaintext proxy settings on load', async () => {
    const settingsPath = join(userDataDir, 'data', 'settings.json')
    mkdirSync(join(userDataDir, 'data'), { recursive: true })
    const storedSettings = JSON.stringify({
      general: { proxyUrl: 'http://127.0.0.1:7890' },
    })
    writeFileSync(settingsPath, storedSettings)

    const { settingsProvider } =
      await import('../services/system/settings-provider')

    expect(settingsProvider.get().general.proxyUrl).toBe(
      'http://127.0.0.1:7890',
    )
    expect(readFileSync(settingsPath, 'utf-8')).toBe(storedSettings)
  })

  it('rewrites legacy plaintext settings secrets on load', async () => {
    const settingsPath = join(userDataDir, 'data', 'settings.json')
    mkdirSync(join(userDataDir, 'data'), { recursive: true })
    writeFileSync(
      settingsPath,
      JSON.stringify({
        general: { proxyUrl: 'http://user:pass@127.0.0.1:7890' },
        ai: {
          provider: 'openai',
          apiKey: 'sk-live',
          apiKeys: { openai: 'sk-live' },
        },
        aggregator: {
          apiKey: 'aggregator-secret',
          deviceId: 'device-secret',
        },
      }),
    )

    const { settingsProvider } =
      await import('../services/system/settings-provider')

    expect(settingsProvider.get().ai.apiKey).toBe('sk-live')
    const savedText = readFileSync(settingsPath, 'utf-8')
    expect(savedText).not.toContain('sk-live')
    expect(savedText).not.toContain('aggregator-secret')
    expect(savedText).not.toContain('device-secret')
    expect(savedText).not.toContain('user:pass')
    expect(savedText).toContain('safeStorage:')
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

  it('rejects malformed nested settings patches before applying side effects', async () => {
    const { registerSettingsHandlers } = await import('./settings-handlers')
    registerSettingsHandlers()

    const handler = getRegisteredHandler(IPC.SETTINGS_SET)
    const result = await handler(
      {},
      {
        general: {
          theme: 'dark',
          customCSS: 'x'.repeat(200_001),
        },
      },
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'validation_error' },
    })
    expect(applyProxySettingsMock).not.toHaveBeenCalled()
    expect(existsSync(join(userDataDir, 'data', 'settings.json'))).toBe(false)
  })

  it('redacts secrets in settings:get, settings:set, and settings:changed while encrypting persisted values', async () => {
    const { registerSettingsHandlers } = await import('./settings-handlers')
    const { REDACTED_SECRET_VALUE } =
      await import('../../shared/settings-secrets')
    registerSettingsHandlers()

    const setHandler = getRegisteredHandler(IPC.SETTINGS_SET)
    const setResult = await setHandler(
      {},
      {
        general: { proxyUrl: 'http://user:pass@127.0.0.1:7890' },
        ai: {
          provider: 'openai',
          apiKey: 'sk-live',
          apiKeys: { openai: 'sk-live' },
        },
        aggregator: {
          apiKey: 'aggregator-secret',
          deviceId: 'device-secret',
        },
      },
    )

    expect(setResult).toMatchObject({
      ok: true,
      data: {
        success: true,
        settings: {
          ai: {
            apiKey: REDACTED_SECRET_VALUE,
            apiKeys: { openai: REDACTED_SECRET_VALUE },
          },
          aggregator: {
            apiKey: REDACTED_SECRET_VALUE,
            deviceId: REDACTED_SECRET_VALUE,
          },
          general: { proxyUrl: REDACTED_SECRET_VALUE },
        },
      },
    })
    expect(eventSendMock).toHaveBeenCalledWith(
      'settings:changed',
      expect.objectContaining({
        ai: expect.objectContaining({
          apiKey: REDACTED_SECRET_VALUE,
          apiKeys: { openai: REDACTED_SECRET_VALUE },
        }),
        aggregator: expect.objectContaining({
          apiKey: REDACTED_SECRET_VALUE,
          deviceId: REDACTED_SECRET_VALUE,
        }),
        general: expect.objectContaining({
          proxyUrl: REDACTED_SECRET_VALUE,
        }),
      }),
    )

    const settingsPath = join(userDataDir, 'data', 'settings.json')
    const savedText = readFileSync(settingsPath, 'utf-8')
    expect(savedText).not.toContain('sk-live')
    expect(savedText).not.toContain('aggregator-secret')
    expect(savedText).not.toContain('device-secret')
    expect(savedText).not.toContain('user:pass')
    expect(savedText).toContain('safeStorage:')

    const getHandler = getRegisteredHandler(IPC.SETTINGS_GET)
    const getResult = await getHandler({})
    expect(getResult).toMatchObject({
      ok: true,
      data: {
        ai: { apiKey: REDACTED_SECRET_VALUE },
        aggregator: {
          apiKey: REDACTED_SECRET_VALUE,
          deviceId: REDACTED_SECRET_VALUE,
        },
        general: { proxyUrl: REDACTED_SECRET_VALUE },
      },
    })
  })

  it('preserves existing secrets when settings:set sends redacted sentinel values', async () => {
    const { registerSettingsHandlers } = await import('./settings-handlers')
    const { REDACTED_SECRET_VALUE } =
      await import('../../shared/settings-secrets')
    registerSettingsHandlers()

    const setHandler = getRegisteredHandler(IPC.SETTINGS_SET)
    await setHandler(
      {},
      {
        general: { proxyUrl: 'http://user:pass@127.0.0.1:7890' },
        ai: {
          provider: 'openai',
          apiKey: 'sk-live',
          apiKeys: { openai: 'sk-live' },
        },
        aggregator: {
          apiKey: 'aggregator-secret',
          deviceId: 'device-secret',
        },
      },
    )
    await setHandler(
      {},
      {
        general: { proxyUrl: REDACTED_SECRET_VALUE },
        ai: {
          apiKey: REDACTED_SECRET_VALUE,
          apiKeys: { openai: REDACTED_SECRET_VALUE },
          model: 'gpt-4o',
        },
        aggregator: {
          apiKey: REDACTED_SECRET_VALUE,
          deviceId: REDACTED_SECRET_VALUE,
        },
      },
    )

    const settingsPath = join(userDataDir, 'data', 'settings.json')
    const savedText = readFileSync(settingsPath, 'utf-8')
    expect(savedText).not.toContain('sk-live')
    expect(savedText).not.toContain('aggregator-secret')
    expect(savedText).not.toContain('device-secret')
    expect(savedText).not.toContain('user:pass')

    const { getSettings } = await import('./settings-handlers')
    expect(getSettings().general.proxyUrl).toBe(
      'http://user:pass@127.0.0.1:7890',
    )
    expect(getSettings().ai.apiKey).toBe('sk-live')
    expect(getSettings().ai.apiKeys?.openai).toBe('sk-live')
    expect(getSettings().aggregator.apiKey).toBe('aggregator-secret')
    expect(getSettings().aggregator.deviceId).toBe('device-secret')
    expect(getSettings().ai.model).toBe('gpt-4o')
  })
})
