import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkForAppUpdates: vi.fn(),
  fetch: vi.fn(),
  getPath: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  quit: vi.fn(),
  spawn: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: mocks.getPath,
    getVersion: vi.fn(() => '1.0.0'),
    quit: mocks.quit,
  },
  session: {
    defaultSession: {
      fetch: mocks.fetch,
    },
  },
}))

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}))

vi.mock('./logger', () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}))

vi.mock('./network-url-policy', () => ({
  assertNetworkFetchUrl: vi.fn(async (url: string) => url),
}))

vi.mock('./update-check', () => ({
  checkForAppUpdates: mocks.checkForAppUpdates,
}))

import {
  buildElevatedInstallerCommand,
  installAppUpdate,
  quoteWindowsCommandArgument,
} from './update-install'

const originalPlatform = process.platform

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value,
  })
}

function githubInstallerUrl(version = '1.2.0'): string {
  return `https://github.com/kaieye/Livo/releases/download/v${version}/Livo-Setup-${version}.exe`
}

function mockUpdateInfo(
  overrides: {
    installerDownloadUrl?: string
    installerAssetName?: string
    installerSize?: number
  } = {},
): void {
  mocks.checkForAppUpdates.mockResolvedValue({
    hasUpdate: true,
    currentVersion: '1.0.0',
    latestVersion: '1.2.0',
    installerAssetName: 'Livo-Setup-1.2.0.exe',
    installerDownloadUrl: githubInstallerUrl(),
    ...overrides,
  })
}

describe('Windows elevated installer command', () => {
  it('quotes Program Files and trailing backslashes safely', () => {
    expect(quoteWindowsCommandArgument('C:\\Program Files\\Livo')).toBe(
      '"C:\\Program Files\\Livo"',
    )
    expect(quoteWindowsCommandArgument('C:\\Livo Files\\')).toBe(
      '"C:\\Livo Files\\\\"',
    )
  })

  it('uses an encoded native UAC command without temporary script files', () => {
    const encoded = buildElevatedInstallerCommand(
      'C:\\Users\\Chos1nz\\Livo 安装程序.exe',
      'C:\\Program Files\\Livo',
    )
    const command = Buffer.from(encoded, 'base64').toString('utf16le')
    expect(command).toContain('Start-Process -FilePath $installerPath')
    expect(command).toContain('-Verb RunAs')
    expect(command).toContain('--silent-install "C:\\Program Files\\Livo" --silent-update')
  })
})

describe('installAppUpdate', () => {
  let userDataPath: string
  let exePath: string

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    setPlatform('win32')

    userDataPath = mkdtempSync(join(tmpdir(), 'livo-update-install-test-'))
    exePath = join(userDataPath, 'current', 'Livo.exe')
    mocks.getPath.mockImplementation((name: string) => {
      if (name === 'userData') return userDataPath
      if (name === 'exe') return exePath
      return userDataPath
    })
    mocks.spawn.mockImplementation(() => {
      const child = {
        once: vi.fn((event: string, listener: (code?: number | null) => void) => {
          if (event === 'exit') queueMicrotask(() => listener(0))
          return child
        }),
        stderr: { on: vi.fn() },
      }
      return child
    })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: originalPlatform,
    })
    vi.useRealTimers()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('downloads a bounded installer and starts the silent updater', async () => {
    const body = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(78, 1)])
    const updateDir = join(userDataPath, 'updates')
    mkdirSync(join(updateDir, 'next', 'nested'), { recursive: true })
    writeFileSync(join(updateDir, 'next', 'nested', 'old.txt'), 'old')
    writeFileSync(join(updateDir, 'Livo-Setup-old.exe'), 'old')

    mockUpdateInfo({ installerSize: body.length })
    mocks.fetch.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'content-length': String(body.length),
        },
      }),
    )

    await expect(installAppUpdate()).resolves.toEqual({ success: true })

    const installerPath = join(updateDir, 'Livo-Setup-1.2.0.exe')
    expect(readFileSync(installerPath).subarray(0, 2).toString()).toBe('MZ')
    expect(existsSync(join(updateDir, 'next'))).toBe(false)
    expect(existsSync(join(updateDir, 'Livo-Setup-old.exe'))).toBe(false)
    expect(mocks.spawn).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining(['-EncodedCommand']),
      expect.objectContaining({
        cwd: updateDir,
        detached: false,
      }),
    )
    const encodedCommand = mocks.spawn.mock.calls[0][1].at(-1)
    const command = Buffer.from(encodedCommand, 'base64').toString('utf16le')
    expect(command).toContain(`$installerPath = '${installerPath}'`)
    expect(command).toContain(
      `--silent-install ${dirname(exePath)} --silent-update`,
    )
    expect(command).toContain('-Verb RunAs')

    vi.advanceTimersByTime(250)
    expect(mocks.quit).toHaveBeenCalled()
  })

  it('allows Electron to follow GitHub release redirects', async () => {
    const body = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(78, 1)])
    mockUpdateInfo({ installerSize: body.length })
    mocks.fetch.mockImplementation(
      async (_url: string, init?: RequestInit): Promise<Response> => {
        if (init?.redirect === 'manual') {
          throw new Error('Redirect was cancelled')
        }
        return new Response(body, {
          status: 200,
          headers: { 'content-length': String(body.length) },
        })
      },
    )

    await expect(installAppUpdate()).resolves.toEqual({ success: true })

    expect(mocks.fetch).toHaveBeenCalledWith(
      githubInstallerUrl(),
      expect.objectContaining({ redirect: 'follow' }),
    )
  })

  it('reports Windows download progress and installation handoff', async () => {
    const body = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(78, 1)])
    mockUpdateInfo({ installerSize: body.length })
    mocks.fetch.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-length': String(body.length) },
      }),
    )
    const onState = vi.fn()

    await expect(installAppUpdate(onState)).resolves.toEqual({ success: true })

    expect(onState).toHaveBeenCalledWith({
      status: 'downloading',
      percent: 100,
      transferred: body.length,
      total: body.length,
    })
    expect(onState).toHaveBeenCalledWith({ status: 'installing' })
  })
  it('keeps Livo running and reports an error when the installer cannot start', async () => {
    const body = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(78, 1)])
    mockUpdateInfo({ installerSize: body.length })
    mocks.fetch.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-length': String(body.length) },
      }),
    )
    mocks.spawn.mockImplementationOnce(() => {
      const child = {
        once: vi.fn((event: string, listener: (error?: Error) => void) => {
          if (event === 'error') {
            queueMicrotask(() => listener(new Error('spawn failed')))
          }
          return child
        }),
        stderr: { on: vi.fn() },
      }
      return child
    })
    const onState = vi.fn()

    await expect(installAppUpdate(onState)).resolves.toEqual({
      success: false,
      error: 'spawn failed',
    })

    vi.advanceTimersByTime(250)
    expect(mocks.quit).not.toHaveBeenCalled()
    expect(onState).toHaveBeenLastCalledWith({
      status: 'error',
      error: 'spawn failed',
    })
  })

  it('rejects installer downloads outside the GitHub release path', async () => {
    mockUpdateInfo({
      installerDownloadUrl: 'https://example.com/Livo-Setup-1.2.0.exe',
      installerSize: 80,
    })

    const result = await installAppUpdate()

    expect(result.success).toBe(false)
    expect(result.error).toContain('下载地址无效')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('rejects oversized response metadata before writing an installer', async () => {
    mockUpdateInfo({ installerSize: undefined })
    mocks.fetch.mockResolvedValue(
      new Response(Buffer.from('MZ'), {
        status: 200,
        headers: {
          'content-length': String(301 * 1024 * 1024),
        },
      }),
    )

    const result = await installAppUpdate()

    expect(result.success).toBe(false)
    expect(result.error).toContain('过大')
    expect(
      existsSync(join(userDataPath, 'updates', 'Livo-Setup-1.2.0.exe')),
    ).toBe(false)
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('removes partial downloads when the response size mismatches metadata', async () => {
    const body = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(78, 1)])
    mockUpdateInfo({ installerSize: body.length + 1 })
    mocks.fetch.mockResolvedValue(new Response(body, { status: 200 }))

    const result = await installAppUpdate()

    expect(result.success).toBe(false)
    expect(result.error).toContain('大小不匹配')
    expect(
      existsSync(join(userDataPath, 'updates', 'Livo-Setup-1.2.0.exe')),
    ).toBe(false)
    expect(
      existsSync(
        join(userDataPath, 'updates', 'Livo-Setup-1.2.0.exe.download'),
      ),
    ).toBe(false)
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('rejects downloaded executables without an MZ header', async () => {
    const body = Buffer.from('not an exe')
    mockUpdateInfo({ installerSize: body.length })
    mocks.fetch.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'content-length': String(body.length),
        },
      }),
    )

    const result = await installAppUpdate()

    expect(result.success).toBe(false)
    expect(result.error).toContain('格式无效')
    expect(
      existsSync(join(userDataPath, 'updates', 'Livo-Setup-1.2.0.exe')),
    ).toBe(false)
    expect(mocks.spawn).not.toHaveBeenCalled()
  })
})
