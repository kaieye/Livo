import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WindowManager, classifyWebviewAttachmentUrl } from './window-manager'

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

type EventHandler = (...args: unknown[]) => void

function createFakeWebContents() {
  const handlers = new Map<string, EventHandler>()
  const fake = {
    handlers,
    windowOpenHandler: null as
      | ((details: { url: string; referrer?: { url?: string } }) => {
          action: 'allow' | 'deny'
        })
      | null,
    on: vi.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler)
    }),
    setWindowOpenHandler: vi.fn((handler) => {
      fake.windowOpenHandler = handler
      return undefined
    }),
    send: vi.fn(),
    isLoadingMainFrame: vi.fn(() => false),
    executeJavaScript: vi.fn(),
    reloadIgnoringCache: vi.fn(),
  }
  return fake
}

function createFakeMainWindow() {
  const handlers = new Map<string, EventHandler>()
  return {
    handlers,
    webContents: createFakeWebContents(),
    on: vi.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler)
    }),
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    getNormalBounds: vi.fn(() => ({
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    })),
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  }
}

function bindWindowEventsForTest(
  manager: WindowManager,
  mainWindow: ReturnType<typeof createFakeMainWindow>,
): void {
  ;(
    manager as unknown as {
      bindWindowEvents: (window: typeof mainWindow) => void
    }
  ).bindWindowEvents(mainWindow)
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

describe('classifyWebviewAttachmentUrl', () => {
  it('allows public http webview URLs', () => {
    expect(classifyWebviewAttachmentUrl(' https://example.com/video ')).toEqual(
      {
        allowed: true,
        url: 'https://example.com/video',
        blockedReason: null,
      },
    )
  })

  it('blocks loopback and private webview URLs before attachment', () => {
    expect(classifyWebviewAttachmentUrl('http://localhost:3000')).toMatchObject(
      {
        allowed: false,
        blockedReason: 'private-network',
      },
    )
    expect(
      classifyWebviewAttachmentUrl('http://192.168.1.10/admin'),
    ).toMatchObject({
      allowed: false,
      blockedReason: 'private-network',
    })
    expect(classifyWebviewAttachmentUrl('http://[::1]/admin')).toMatchObject({
      allowed: false,
      blockedReason: 'private-network',
    })
  })

  it('blocks credentialed or unsupported webview URLs before attachment', () => {
    expect(
      classifyWebviewAttachmentUrl('https://user:pass@example.com/video'),
    ).toMatchObject({
      allowed: false,
      blockedReason: 'credentials',
    })
    expect(classifyWebviewAttachmentUrl('file:///etc/passwd')).toMatchObject({
      allowed: false,
      blockedReason: 'unsupported-protocol',
    })
  })
})

describe('WindowManager webview boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.openExternal.mockResolvedValue(undefined)
  })

  it('blocks private, credentialed, and unsupported webview attachments', () => {
    const manager = createWindowManager()
    const mainWindow = createFakeMainWindow()
    bindWindowEventsForTest(manager, mainWindow)
    const attach = mainWindow.webContents.handlers.get('will-attach-webview')
    expect(attach).toBeTruthy()

    for (const src of [
      'http://localhost:3000',
      'http://127.0.0.1/admin',
      'http://192.168.1.1/admin',
      'http://169.254.169.254/latest/meta-data',
      'file:///etc/passwd',
      'https://user:pass@example.com/video',
    ]) {
      const event = { preventDefault: vi.fn() }
      const webPreferences = { preload: '/tmp/preload.js' }

      attach?.(event, webPreferences, { src })

      expect(event.preventDefault).toHaveBeenCalledTimes(1)
      expect(mocks.logWarn).toHaveBeenCalledWith(
        '[window] blocked webview attachment',
        expect.objectContaining({ url: src }),
      )
    }
  })

  it('strips privileged webview preferences for allowed public attachments', () => {
    const manager = createWindowManager()
    const mainWindow = createFakeMainWindow()
    bindWindowEventsForTest(manager, mainWindow)
    const attach = mainWindow.webContents.handlers.get('will-attach-webview')
    const event = { preventDefault: vi.fn() }
    const webPreferences = {
      preload: '/tmp/preload.js',
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    }

    attach?.(event, webPreferences, { src: 'https://example.com/video' })

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(webPreferences).toEqual({
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    })
  })

  it('denies webview popups and later navigations through the external policy', async () => {
    const manager = createWindowManager()
    const mainWindow = createFakeMainWindow()
    bindWindowEventsForTest(manager, mainWindow)
    const didAttach = mainWindow.webContents.handlers.get('did-attach-webview')
    const childWebContents = createFakeWebContents()

    didAttach?.({}, childWebContents)

    expect(
      childWebContents.windowOpenHandler?.({
        url: 'https://example.com/popup',
      }),
    ).toEqual({ action: 'deny' })
    await vi.waitFor(() => {
      expect(mocks.openExternal).toHaveBeenCalledWith(
        'https://example.com/popup',
      )
    })

    const navigate = childWebContents.handlers.get('will-navigate')
    const event = { preventDefault: vi.fn() }
    navigate?.(event, 'https://example.com/next')

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(mocks.openExternal).toHaveBeenCalledWith(
        'https://example.com/next',
      )
    })
  })
})
