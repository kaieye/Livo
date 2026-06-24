import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ElectronAPI } from '../preload/index'
import {
  createWebAPI,
  getFeedImageFromParsed,
  getSiteAvatarFromHtml,
} from './web-api'

type ApiShape = {
  [key: string]: true | 'string' | ApiShape
}

const ELECTRON_API_SHAPE = {
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
  it('matches the preload ElectronAPI shape at runtime and type level', () => {
    const api = createWebAPI()

    expectTypeOf(api).toMatchTypeOf<ElectronAPI>()
    assertApiShape(
      api as unknown as Record<string, unknown>,
      ELECTRON_API_SHAPE,
    )
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
