import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc-contracts'

const registerChannelMock = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(
  () =>
    ({
      general: {},
      ai: {
        apiKey: 'sk-live',
        apiKeys: { openai: 'sk-live' },
      },
      aggregator: {
        apiKey: 'aggregator-secret',
        deviceId: 'device-secret',
      },
    }) as any,
)

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '0.1.0') },
  Menu: { buildFromTemplate: vi.fn() },
  nativeImage: { createFromPath: vi.fn(() => ({ toDataURL: vi.fn() })) },
}))

vi.mock('../ipc/register-channel', () => ({
  registerChannel: registerChannelMock,
}))

vi.mock('../services/system/logger', () => ({
  logInfo: vi.fn(),
  readRecentLogs: vi.fn(),
  reportRendererError: vi.fn(),
}))

vi.mock('../services/system/app-shell', () => ({
  clearApplicationCache: vi.fn(),
  getAppCacheDirectoryPath: vi.fn(),
  getLogDirectory: vi.fn(),
  getUserDataDirectoryPath: vi.fn(),
  openDirectory: vi.fn(),
}))

vi.mock('../services/system/update-check', () => ({
  checkForAppUpdates: vi.fn(),
}))

vi.mock('../services/system/update-install', () => ({
  installAppUpdate: vi.fn(),
}))

vi.mock('../services/system/download', () => ({
  downloadUrlToFile: vi.fn(),
  saveTextFile: vi.fn(),
}))

vi.mock('../services/system/settings-provider', () => ({
  settingsProvider: {
    get: vi.fn(() => settings),
  },
}))

vi.mock('../database', () => ({
  whenDbReady: vi.fn(async () => undefined),
  getDb: vi.fn(() => ({
    entries: { getUnreadCountMap: vi.fn(() => new Map()) },
    feeds: { getAllFeeds: vi.fn(() => []) },
  })),
}))

vi.mock('../services/auth/session-store', () => ({
  sessionStore: { getCurrentUser: vi.fn(() => null) },
}))

vi.mock('../app-icon', () => ({
  getAppIconPath: vi.fn(() => '/tmp/icon.png'),
}))

import { REDACTED_SECRET_VALUE } from '../../shared/settings-secrets'
import { registerAppHandlers } from './app-handlers'
import type { WindowManager } from '../window-manager'

function getRegisteredHandler(channel: string) {
  const call = registerChannelMock.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  )
  expect(call).toBeTruthy()
  return call?.[1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerAppHandlers', () => {
  beforeEach(() => {
    registerChannelMock.mockReset()
  })

  it('routes update IPC through the platform-aware updater service', async () => {
    const updater = {
      checkForAppUpdates: vi.fn(async () => ({
        hasUpdate: true,
        canInstall: true,
        platform: 'darwin',
        currentVersion: '1.0.0',
        latestVersion: '1.2.0',
      })),
      installAppUpdate: vi.fn(async () => ({ success: true })),
    }
    registerAppHandlers(
      { safeOpenExternal: vi.fn() } as unknown as WindowManager,
      updater as never,
    )

    await expect(
      getRegisteredHandler(IPC.APP_CHECK_FOR_UPDATES)(undefined, true),
    ).resolves.toMatchObject({ canInstall: true, platform: 'darwin' })
    await expect(
      getRegisteredHandler(IPC.APP_INSTALL_UPDATE)(),
    ).resolves.toEqual({ success: true })
    expect(updater.checkForAppUpdates).toHaveBeenCalledWith(true)
    expect(updater.installAppUpdate).toHaveBeenCalledTimes(1)
  })
  it('redacts settings secrets from app hydration', async () => {
    registerAppHandlers(
      {
        safeOpenExternal: vi.fn(),
      } as unknown as WindowManager,
      {
        checkForAppUpdates: vi.fn(),
        installAppUpdate: vi.fn(),
      } as never,
    )

    const result = await getRegisteredHandler(IPC.APP_HYDRATE)()

    expect(result).toMatchObject({
      settings: {
        ai: {
          apiKey: REDACTED_SECRET_VALUE,
          apiKeys: { openai: REDACTED_SECRET_VALUE },
        },
        aggregator: {
          apiKey: REDACTED_SECRET_VALUE,
          deviceId: REDACTED_SECRET_VALUE,
        },
      },
    })
    expect(JSON.stringify(result)).not.toContain('sk-live')
    expect(JSON.stringify(result)).not.toContain('aggregator-secret')
    expect(JSON.stringify(result)).not.toContain('device-secret')
  })
})
