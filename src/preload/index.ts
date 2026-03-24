import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  AppSettings,
  Feed,
  Entry,
  FeedWithCount,
  FeedViewType,
  AccountProvider,
  AppUpdateInfo,
} from '../shared/types'
import type { ResolvedProfileUrlResult } from '../shared/types'

const api = {
  // Feed operations
  feeds: {
    add: (
      url: string,
      category?: string,
      view?: FeedViewType,
      title?: string,
    ) => ipcRenderer.invoke(IPC.FEED_ADD, url, category, view, title),
    remove: (feedId: string) => ipcRenderer.invoke(IPC.FEED_REMOVE, feedId),
    list: (): Promise<FeedWithCount[]> => ipcRenderer.invoke(IPC.FEED_LIST),
    refresh: (feedId: string) => ipcRenderer.invoke(IPC.FEED_REFRESH, feedId),
    refreshAll: () => ipcRenderer.invoke(IPC.FEED_REFRESH_ALL),
    update: (feedId: string, updates: Partial<Feed>) =>
      ipcRenderer.invoke(IPC.FEED_UPDATE, feedId, updates),
    importOPML: () => ipcRenderer.invoke(IPC.FEED_IMPORT_OPML),
    exportOPML: () => ipcRenderer.invoke(IPC.FEED_EXPORT_OPML),
  },

  // Entry operations
  entries: {
    list: (options: {
      feedId?: string
      feedIds?: string[]
      starred?: boolean
      unreadOnly?: boolean
      limit?: number
      offset?: number
      compact?: boolean
      maxContentLength?: number
      skipDedupe?: boolean
    }): Promise<Entry[]> => ipcRenderer.invoke(IPC.ENTRY_LIST, options),
    get: (entryId: string): Promise<Entry | null> =>
      ipcRenderer.invoke(IPC.ENTRY_GET, entryId),
    markRead: (entryId: string, isRead: boolean) =>
      ipcRenderer.invoke(IPC.ENTRY_MARK_READ, entryId, isRead),
    markAllRead: (feedId?: string) =>
      ipcRenderer.invoke(IPC.ENTRY_MARK_ALL_READ, feedId),
    toggleStar: (entryId: string) =>
      ipcRenderer.invoke(IPC.ENTRY_TOGGLE_STAR, entryId),
    search: (query: string, limit?: number): Promise<Entry[]> =>
      ipcRenderer.invoke(IPC.ENTRY_SEARCH, query, limit),
  },

  // AI operations
  ai: {
    summarize: (content: string, language?: string) =>
      ipcRenderer.invoke(IPC.AI_SUMMARIZE, content, language),
    translate: (content: string, targetLanguage: string) =>
      ipcRenderer.invoke(IPC.AI_TRANSLATE, content, targetLanguage),
    chat: (messages: Array<{ role: string; content: string }>) =>
      ipcRenderer.invoke(IPC.AI_CHAT, messages),
    chatStream: (
      messages: Array<{ role: string; content: string }>,
      requestId: string,
    ) => ipcRenderer.invoke(IPC.AI_CHAT_STREAM, messages, requestId),
    onStreamChunk: (
      callback: (data: { requestId: string; content: string }) => void,
    ) => {
      const handler = (
        _event: unknown,
        data: { requestId: string; content: string },
      ) => callback(data)
      ipcRenderer.on('ai:chat-stream-chunk', handler)
      return () => ipcRenderer.removeListener('ai:chat-stream-chunk', handler)
    },
    onStreamDone: (callback: (data: { requestId: string }) => void) => {
      const handler = (_event: unknown, data: { requestId: string }) =>
        callback(data)
      ipcRenderer.on('ai:chat-stream-done', handler)
      return () => ipcRenderer.removeListener('ai:chat-stream-done', handler)
    },
    onStreamError: (
      callback: (data: { requestId: string; error: string }) => void,
    ) => {
      const handler = (
        _event: unknown,
        data: { requestId: string; error: string },
      ) => callback(data)
      ipcRenderer.on('ai:chat-stream-error', handler)
      return () => ipcRenderer.removeListener('ai:chat-stream-error', handler)
    },
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, settings),
  },

  // Readability
  readability: {
    fetch: (url: string) => ipcRenderer.invoke('readability:fetch', url),
  },

  // Discover
  discover: {
    categories: () => ipcRenderer.invoke('discover:categories'),
    popular: (category?: string) =>
      ipcRenderer.invoke('discover:popular', category),
    search: (
      query: string,
      platform?: 'all' | 'youtube' | 'bilibili' | 'x' | 'instagram',
    ) => ipcRenderer.invoke('discover:search', query, platform),
    rsshubRoutes: (category?: string) =>
      ipcRenderer.invoke('discover:rsshub-routes', category),
    rsshubInstance: () => ipcRenderer.invoke('discover:rsshub-instance'),
    validateFeed: (url: string) =>
      ipcRenderer.invoke('discover:validate-feed', url),
    resolveProfileUrl: (url: string): Promise<ResolvedProfileUrlResult> =>
      ipcRenderer.invoke(IPC.DISCOVER_RESOLVE_PROFILE_URL, url),
    probeTwitterUser: (username: string) =>
      ipcRenderer.invoke('twitter:probe-user', username),
    probeYouTubeChannel: (query: string) =>
      ipcRenderer.invoke('youtube:probe-channel', query),
    probeVideoSources: (query: string) =>
      ipcRenderer.invoke('discover:probe-video-sources', query),
    probeBilibiliUid: (uid: string) =>
      ipcRenderer.invoke('discover:probe-bilibili-uid', uid),
    probeBilibiliUsers: (query: string) =>
      ipcRenderer.invoke('discover:probe-bilibili-users', query),
    probeInstagramUser: (username: string) =>
      ipcRenderer.invoke('instagram:probe-user', username),
  },

  // App
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
    openExternal: (url: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC.APP_OPEN_EXTERNAL, url),
    reportError: (payload: {
      source: string
      message: string
      stack?: string
      componentStack?: string
    }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC.APP_REPORT_ERROR, payload),
    readRecentLogs: (
      maxLines?: number,
    ): Promise<{ success: boolean; content: string }> =>
      ipcRenderer.invoke(IPC.APP_READ_RECENT_LOGS, maxLines),
    openDataDirectory: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.APP_OPEN_DATA_DIRECTORY),
    openCacheDirectory: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.APP_OPEN_CACHE_DIRECTORY),
    openLogsDirectory: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.APP_OPEN_LOGS_DIRECTORY),
    clearCache: (): Promise<{
      success: boolean
      clearedBytes: number
      error?: string
    }> => ipcRenderer.invoke(IPC.APP_CLEAR_CACHE),
    checkForUpdates: (): Promise<AppUpdateInfo> =>
      ipcRenderer.invoke(IPC.APP_CHECK_FOR_UPDATES),
  },

  // Data maintenance
  data: {
    cleanup: (options?: {
      entriesPerFeed?: number
      maxEntryAgeDays?: number
    }) => ipcRenderer.invoke(IPC.DATA_CLEANUP, options),
    stats: (): Promise<{
      totalFeeds: number
      totalEntries: number
      readEntries: number
      starredEntries: number
      dataSizeBytes: number
      cacheSizeBytes: number
    }> => ipcRenderer.invoke(IPC.DATA_STATS),
  },

  // Video resolution (Invidious/Piped proxy) & YouTube account linking
  video: {
    resolve: (
      url: string,
    ): Promise<{
      success: boolean
      url?: string
      quality?: string
      title?: string
      error?: string
    }> => ipcRenderer.invoke(IPC.VIDEO_RESOLVE, url),
    openInApp: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.VIDEO_OPEN_IN_APP, url),
    ytLogin: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.VIDEO_YT_LOGIN),
    ytStatus: (): Promise<{ loggedIn: boolean; name: string | null }> =>
      ipcRenderer.invoke(IPC.VIDEO_YT_STATUS),
    ytLogout: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.VIDEO_YT_LOGOUT),
  },

  // Linked account sessions
  accounts: {
    status: (
      provider: AccountProvider,
    ): Promise<{
      provider: AccountProvider
      linked: boolean
      displayName?: string | null
      error?: string
    }> => ipcRenderer.invoke(IPC.ACCOUNT_STATUS, provider),
    link: (
      provider: AccountProvider,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.ACCOUNT_LINK, provider),
    unlink: (
      provider: AccountProvider,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.ACCOUNT_UNLINK, provider),
    setDisplayName: (
      provider: AccountProvider,
      displayName: string,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.ACCOUNT_SET_DISPLAY_NAME, provider, displayName),
    bilibiliFollowings: (): Promise<{
      success: boolean
      creators?: Array<{ mid: number; uname: string }>
      error?: string
    }> => ipcRenderer.invoke(IPC.ACCOUNT_BILIBILI_FOLLOWINGS),
  },

  // Events
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: unknown, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
