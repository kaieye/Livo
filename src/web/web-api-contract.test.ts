import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { ElectronAPI } from '../preload/index'
import {
  createWebAPI,
  generateOPMLContent,
  getFeedImageFromParsed,
  getSiteAvatarFromHtml,
} from './web-api'
import { cloneDefaultSettings } from '../shared/settings'
import { REDACTED_SECRET_VALUE } from '../shared/settings-secrets'
import type { AppSettings } from '../shared/types'

type ApiShape = {
  [key: string]: true | 'string' | ApiShape
}

type FakeRequest<T> = {
  result?: T
  error: Error | null
  onsuccess: ((event: { target: FakeRequest<T> }) => void) | null
  onerror: (() => void) | null
  onupgradeneeded?: ((event: { target: FakeRequest<T> }) => void) | null
}

function successRequest<T>(value: T): FakeRequest<T> {
  const request: FakeRequest<T> = {
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }
  queueMicrotask(() => {
    request.result = value
    request.onsuccess?.({ target: request })
  })
  return request
}

function stubSettingsIndexedDB(initialSettings?: AppSettings) {
  let settings = initialSettings
  const putSettings: AppSettings[] = []
  const settingsStore = {
    get: vi.fn((key: string) =>
      successRequest(
        key === 'app-settings' && settings
          ? { key: 'app-settings', value: settings }
          : undefined,
      ),
    ),
    put: vi.fn((record: { key: string; value: AppSettings }) => {
      settings = record.value
      putSettings.push(record.value)
      return successRequest(undefined)
    }),
  }
  const fakeDatabase = {
    objectStoreNames: { contains: vi.fn(() => true) },
    transaction: vi.fn(() => ({
      objectStore: vi.fn((name: string) => {
        if (name === 'settings') return settingsStore
        throw new Error(`Unexpected store ${name}`)
      }),
    })),
  }
  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => successRequest(fakeDatabase)),
  })
  return { putSettings, settingsStore }
}

function stubLocalStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
  vi.stubGlobal('localStorage', localStorage)
  return { localStorage, values }
}

const ELECTRON_API_SHAPE = {
  serverUrl: 'string',
  feeds: {
    add: true,
    remove: true,
    list: true,
    refresh: true,
    refreshAll: true,
    update: true,
    importOPML: true,
    exportOPML: true,
    refreshImportedFeeds: true,
    syncNow: true,
    syncToCloud: true,
    syncFromCloud: true,
    syncStatus: true,
  },
  entries: {
    list: true,
    get: true,
    markRead: true,
    markAllRead: true,
    toggleStar: true,
    saveProgress: true,
    markListened: true,
    saveListenProgress: true,
    search: true,
  },
  reader: {
    snapshot: true,
  },
  ai: {
    summarize: true,
    summarizeEntry: true,
    getSummarySession: true,
    translate: true,
    translateEntrySegments: true,
    getTranslationSession: true,
    createTranslationSession: true,
    updateTranslationSession: true,
    chat: true,
    chatStream: true,
    judgeFilter: true,
    digest: {
      listRuns: true,
      generate: true,
    },
    onStreamChunk: true,
    onStreamDone: true,
    onStreamError: true,
    testConnection: true,
  },
  tasks: {
    getRun: true,
    listRuns: true,
  },
  settings: {
    get: true,
    set: true,
    onChanged: true,
  },
  actions: {
    sync: true,
  },
  agent: {
    run: true,
    resume: true,
    abort: true,
    cancelPending: true,
    listTraces: true,
    deleteTrace: true,
    clearTraces: true,
    listMemory: true,
    clearMemory: true,
    onToolEvent: true,
    onNavigate: true,
  },
  readability: {
    fetch: true,
  },
  readingActivity: {
    sync: true,
  },
  discover: {
    categories: true,
    popular: true,
    search: true,
    searchWechatMp: true,
    ensureWechatMpFeed: true,
    rsshubRoutes: true,
    rsshubInstance: true,
    validateFeed: true,
    previewFeed: true,
    resolveProfileUrl: true,
    probeTwitterUser: true,
    probeYouTubeChannel: true,
    probeVideoSources: true,
    probeBilibiliUid: true,
    probeBilibiliUsers: true,
    probeInstagramUser: true,
  },
  app: {
    getVersion: true,
    openExternal: true,
    reportError: true,
    readRecentLogs: true,
    openDataDirectory: true,
    openCacheDirectory: true,
    openLogsDirectory: true,
    clearCache: true,
    checkForUpdates: true,
    installUpdate: true,
    getIcon: true,
    saveTextFile: true,
    downloadUrl: true,
    rendererReady: true,
    readyToShowMainWindow: true,
    hydrate: true,
  },
  menu: {
    showContextMenu: true,
  },
  windowControls: {
    minimize: true,
    maximizeToggle: true,
    close: true,
    isMaximized: true,
    onMaximizeChange: true,
    platform: 'string',
  },
  data: {
    cleanup: true,
    stats: true,
  },
  refreshLogs: {
    list: true,
    clear: true,
  },
  video: {
    resolve: true,
    openInApp: true,
    ytLogin: true,
    ytStatus: true,
    ytLogout: true,
  },
  accounts: {
    status: true,
    link: true,
    unlink: true,
    setDisplayName: true,
    bilibiliFollowings: true,
  },
  auth: {
    bindGoogle: true,
    bindWechat: true,
    loginGoogle: true,
    loginWechat: true,
    getCurrentUser: true,
    logout: true,
    checkSession: true,
    onLoginProgress: true,
    wechatMpLogin: true,
  },
  notifications: {
    list: true,
    unreadCount: true,
    markRead: true,
    markUnread: true,
    markAllRead: true,
  },
  websocket: {
    connect: true,
    disconnect: true,
    status: true,
  },
  fever: {
    listAccounts: true,
    createAccount: true,
    updateAccount: true,
    deleteAccount: true,
    verify: true,
    sync: true,
    syncAll: true,
    getSyncState: true,
    onSyncProgress: true,
  },
  on: true,
} satisfies ApiShape

function assertApiShape(
  value: Record<string, unknown>,
  shape: ApiShape,
  path = 'api',
) {
  expect(Object.keys(value).sort(), path).toEqual(Object.keys(shape).sort())

  for (const [key, expected] of Object.entries(shape)) {
    const nextPath = `${path}.${key}`
    const actual = value[key]
    if (expected === true) {
      expect(typeof actual, nextPath).toBe('function')
      continue
    }
    if (expected === 'string') {
      expect(typeof actual, nextPath).toBe('string')
      continue
    }

    expect(actual, nextPath).toEqual(expect.any(Object))
    assertApiShape(actual as Record<string, unknown>, expected, nextPath)
  }
}

describe('web api contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matches the preload ElectronAPI shape at runtime and type level', () => {
    const api = createWebAPI()

    expectTypeOf(api).toMatchTypeOf<ElectronAPI>()
    assertApiShape(
      api as unknown as Record<string, unknown>,
      ELECTRON_API_SHAPE,
    )
  })

  it('blocks unsafe external opens in the web fallback API', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', {
      open,
      location: { origin: 'https://web.example' },
    })
    const api = createWebAPI()

    await expect(api.app.openExternal('javascript:alert(1)')).resolves.toEqual({
      success: false,
      error: 'unsupported-protocol',
    })
    await expect(
      api.video.openInApp('https://127.0.0.1/feed'),
    ).resolves.toEqual({
      success: false,
      error: 'suspicious_url',
    })

    expect(open).not.toHaveBeenCalled()
  })

  it('opens normalized safe URLs in the web fallback API', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', {
      open,
      location: { origin: 'https://web.example' },
    })
    const api = createWebAPI()

    await expect(
      api.app.openExternal(' https://example.com/article '),
    ).resolves.toEqual({ success: true })

    expect(open).toHaveBeenCalledWith(
      'https://example.com/article',
      '_blank',
      'noopener,noreferrer',
    )
  })
})

describe('generateOPMLContent', () => {
  it('removes secret URL components from exported feed URLs', () => {
    const opml = generateOPMLContent([
      {
        id: 'feed-1',
        title: 'Private feed',
        url: 'https://user:pass@example.com/rss.xml?token=raw-token&ok=1',
        siteUrl:
          'https://example.com/site?X-Goog-Signature=raw-signature&view=1',
        view: 0,
        errorCount: 0,
        createdAt: 1000,
      },
    ])

    expect(opml).not.toContain('raw-token')
    expect(opml).not.toContain('raw-signature')
    expect(opml).not.toContain('user:pass')
    expect(opml).toContain('xmlUrl="https://example.com/rss.xml?ok=1"')
    expect(opml).toContain('htmlUrl="https://example.com/site?view=1"')
  })
})

describe('getFeedImageFromParsed', () => {
  it('does not use entry images as feed avatar fallback', () => {
    expect(
      getFeedImageFromParsed({
        items: [{ imageUrl: 'https://blog.example.com/post-cover.jpg' }],
      }),
    ).toBe('')
  })

  it('uses the feed-level image metadata', () => {
    expect(
      getFeedImageFromParsed({
        image: { url: ' https://blog.example.com/avatar.png ' },
        items: [{ imageUrl: 'https://blog.example.com/post-cover.jpg' }],
      }),
    ).toBe('https://blog.example.com/avatar.png')
  })
})

describe('getSiteAvatarFromHtml', () => {
  it('uses a semantic profile image instead of a post image', () => {
    expect(
      getSiteAvatarFromHtml(
        `
          <article>
            <img src="https://cdn.example.com/latest-post-cover.webp" />
          </article>
          <aside>
            <img src="/blog/images/person2_s.jpg" alt="个人照片" />
          </aside>
        `,
        'https://www.ruanyifeng.com/blog/',
      ),
    ).toBe('https://www.ruanyifeng.com/blog/images/person2_s.jpg')
  })
})

describe('web settings secret persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps web secrets session-only while returning redacted settings', async () => {
    vi.resetModules()
    const initial = cloneDefaultSettings()
    initial.ai.model = 'gpt-test'
    initial.ai.baseUrl = 'https://api.example.com/v1'
    const storage = stubSettingsIndexedDB(initial)
    vi.stubGlobal('window', { location: { origin: 'https://web.example' } })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'pong' } }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const [{ initWebDB }, { createWebAPI }] = await Promise.all([
      import('./storage'),
      import('./web-api'),
    ])
    await initWebDB()
    const api = createWebAPI()

    const result = await api.settings.set({
      ai: {
        apiKey: 'sk-web',
        apiKeys: { openai: 'sk-web' },
      },
      aggregator: {
        apiKey: 'aggregator-secret',
        deviceId: 'device-secret',
      },
      general: {
        proxyUrl: 'http://user:pass@127.0.0.1:7890',
      },
    } as unknown as Partial<AppSettings>)

    expect(result.settings.ai.apiKey).toBe(REDACTED_SECRET_VALUE)
    expect(result.settings.ai.apiKeys?.openai).toBe(REDACTED_SECRET_VALUE)
    expect(result.settings.aggregator.apiKey).toBe(REDACTED_SECRET_VALUE)
    expect(result.settings.aggregator.deviceId).toBe(REDACTED_SECRET_VALUE)
    expect(result.settings.general.proxyUrl).toBe(REDACTED_SECRET_VALUE)
    expect(JSON.stringify(storage.putSettings.at(-1))).not.toContain('sk-web')
    expect(JSON.stringify(storage.putSettings.at(-1))).not.toContain(
      'aggregator-secret',
    )
    expect(JSON.stringify(storage.putSettings.at(-1))).not.toContain(
      'user:pass',
    )

    await expect(
      api.ai.chat([{ role: 'user', content: 'ping' }]),
    ).resolves.toMatchObject({
      success: true,
      message: 'pong',
    })
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-web' }),
      }),
    )

    vi.resetModules()
    fetchMock.mockClear()
    const [{ initWebDB: initFreshWebDB }, { createWebAPI: createFreshWebAPI }] =
      await Promise.all([import('./storage'), import('./web-api')])
    await initFreshWebDB()
    const freshApi = createFreshWebAPI()

    await expect(
      freshApi.ai.chat([{ role: 'user', content: 'ping' }]),
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('AI API Key'),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('web digest run persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redacts embedded URL secrets from legacy digest runs and rewrites storage', async () => {
    const rawRuns = [
      {
        id: 'digest-1',
        preset: 'today',
        title: 'Digest',
        status: 'failed',
        windowStartAt: 1,
        windowEndAt: 2,
        sourceEntryIds: [],
        candidateCount: 1,
        content:
          'Source https://user:pass@example.com/a?access_token=raw&ok=1.',
        error: 'Error https://cdn.example.com/e?X-Amz-Signature=raw&width=640!',
        createdAt: 1,
        updatedAt: 2,
      },
    ]
    const { values } = stubLocalStorage({
      'livo-ai-digest-runs': JSON.stringify(rawRuns),
    })
    const api = createWebAPI()

    const runs = await api.ai.digest.listRuns(10)
    const rewritten = values.get('livo-ai-digest-runs') || ''

    expect(JSON.stringify(runs)).not.toContain('raw')
    expect(JSON.stringify(runs)).not.toContain('user:pass')
    expect(runs[0].content).toBe('Source https://example.com/a?ok=1.')
    expect(runs[0].error).toBe('Error https://cdn.example.com/e?width=640!')
    expect(rewritten).not.toContain('raw')
    expect(rewritten).not.toContain('user:pass')
    expect(JSON.parse(rewritten)).toMatchObject(runs)
  })
})
