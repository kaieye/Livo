import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const autoUpdater = {
    updateConfigPath: undefined as string | null | undefined,
    forceDevUpdateConfig: false,
    autoDownload: true,
    autoInstallOnAppQuit: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler)
      return autoUpdater
    }),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  }

  return {
    autoUpdater,
    handlers,
    isPackaged: true,
    getVersion: vi.fn(() => '1.0.0'),
    checkForAppUpdates: vi.fn(),
    installAppUpdate: vi.fn(),
  }
})

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged
    },
    getVersion: mocks.getVersion,
  },
}))

vi.mock('electron-updater', () => ({
  default: { autoUpdater: mocks.autoUpdater },
}))

vi.mock('./system/update-check', () => ({
  checkForAppUpdates: mocks.checkForAppUpdates,
}))

vi.mock('./system/update-install', () => ({
  installAppUpdate: mocks.installAppUpdate,
}))

import { UpdaterService } from './updater'

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  })
}

describe('UpdaterService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handlers.clear()
    mocks.isPackaged = true
    mocks.getVersion.mockReturnValue('1.0.0')
    mocks.autoUpdater.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => void) => {
        mocks.handlers.set(event, handler)
        return mocks.autoUpdater
      },
    )
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: originalPlatform,
    })
  })

  it('publishes macOS download progress through the app update state channel', async () => {
    setPlatform('darwin')
    mocks.autoUpdater.checkForUpdates.mockResolvedValue({
      updateInfo: { version: '1.2.0' },
    })
    mocks.autoUpdater.downloadUpdate.mockImplementation(async () => {
      mocks.handlers.get('download-progress')?.({
        percent: 42.5,
        transferred: 425,
        total: 1000,
        bytesPerSecond: 200,
      })
      return ['/tmp/Livo-1.2.0-mac-arm64.zip']
    })
    const send = vi.fn()
    const service = new UpdaterService(false)
    service.setWindow({
      isDestroyed: () => false,
      webContents: { send },
    } as never)

    await service.installAppUpdate()

    expect(send).toHaveBeenCalledWith('app:update-state', {
      status: 'downloading',
      percent: 42.5,
      transferred: 425,
      total: 1000,
      bytesPerSecond: 200,
    })
    expect(send).toHaveBeenCalledWith('app:update-state', {
      status: 'installing',
    })
  })
  it('downloads a macOS update before restarting into the installer', async () => {
    setPlatform('darwin')
    mocks.autoUpdater.checkForUpdates.mockResolvedValue({
      updateInfo: { version: '1.2.0' },
    })
    mocks.autoUpdater.downloadUpdate.mockResolvedValue([
      '/tmp/Livo-1.2.0-mac-arm64.zip',
    ])

    const service = new UpdaterService(false)

    await expect(service.installAppUpdate()).resolves.toEqual({ success: true })
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(mocks.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
  it('keeps the custom Windows installer path installable when packaged', async () => {
    setPlatform('win32')
    mocks.checkForAppUpdates.mockResolvedValue({
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      installerDownloadUrl:
        'https://github.com/kaieye/Livo/releases/download/v1.2.0/Livo-Setup-1.2.0.exe',
    })

    const service = new UpdaterService(false)

    await expect(service.checkForAppUpdates(true)).resolves.toMatchObject({
      hasUpdate: true,
      canInstall: true,
      platform: 'win32',
    })
    expect(mocks.checkForAppUpdates).toHaveBeenCalledWith(true)
  })
  it('maps a packaged macOS update into an installable app update', async () => {
    setPlatform('darwin')
    mocks.autoUpdater.checkForUpdates.mockResolvedValue({
      updateInfo: {
        version: '1.2.0',
        releaseDate: '2026-07-14T01:02:03.000Z',
        releaseNotes: 'Signed macOS update',
      },
    })

    const service = new UpdaterService(false)

    await expect(service.checkForAppUpdates()).resolves.toEqual({
      hasUpdate: true,
      canInstall: true,
      platform: 'darwin',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      releaseUrl: 'https://github.com/kaieye/Livo/releases/latest',
      publishedAt: '2026-07-14T01:02:03.000Z',
      notes: 'Signed macOS update',
    })
  })
})
