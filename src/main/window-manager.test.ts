import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WindowManager } from './window-manager'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  openExternal: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('dns/promises', () => ({
  lookup: mocks.lookup,
}))

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  nativeTheme: {
    shouldUseDarkColors: false,
    on: vi.fn(),
  },
  shell: {
    openExternal: mocks.openExternal,
  },
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}))

vi.mock('url', async () => {
  const actual = await vi.importActual<typeof import('url')>('url')
  return actual
})

vi.mock('./app-icon', () => ({
  getAppIconPath: vi.fn(() => '/tmp/livo-icon.png'),
}))

vi.mock('./services/system/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: mocks.logWarn,
}))

function createWindowManager(): WindowManager {
  return new WindowManager({
    isDev: false,
    preloadPath: '/tmp/preload.js',
    getCacheImagePath: (fileName) => `/tmp/cache/${fileName}`,
  })
}

describe('WindowManager.safeOpenExternal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.openExternal.mockResolvedValue(undefined)
  })

  it('opens public http URLs after network-policy validation', async () => {
    const manager = createWindowManager()

    const result = await manager.safeOpenExternal(' https://example.com/post ')

    expect(result).toEqual({ success: true })
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/post')
  })

  it('blocks loopback URLs in the main process', async () => {
    const manager = createWindowManager()

    const result = await manager.safeOpenExternal('http://localhost:3000/admin')

    expect(result).toEqual({ success: false, error: 'loopback' })
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('blocks hostnames that resolve to private addresses', async () => {
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    const manager = createWindowManager()

    const result = await manager.safeOpenExternal(
      'https://private.example/admin',
    )

    expect(result).toEqual({ success: false, error: 'private-network' })
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })
})
