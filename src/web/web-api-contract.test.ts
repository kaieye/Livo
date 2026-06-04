import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ElectronAPI } from '../preload/index'
import { createWebAPI } from './web-api'

type ApiShape = {
  [key: string]: true | ApiShape
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
    listTraces: true,
    clearTraces: true,
    onToolEvent: true,
    onNavigate: true,
  },
  readability: {
    fetch: true,
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
    saveTextFile: true,
    downloadUrl: true,
  },
  menu: {
    showContextMenu: true,
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
