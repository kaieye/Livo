import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import { type IpcChannel, unwrapIpcEnvelope } from '../shared/ipc-contracts'
import {
  isRendererEventChannel,
  type RendererEventCallback,
  type RendererEventChannel,
  type RendererEventArgs,
} from '../shared/renderer-events'
import type {
  AppSettings,
  Feed,
  Entry,
  EntryListResult,
  FeedWithCount,
  FeedViewType,
  FeedSyncResult,
  FeedSyncStatus,
  ReaderSnapshot,
  ReaderSnapshotRequest,
  AccountProvider,
  AppUpdateInfo,
  AppUpdateInstallResult,
  NativeContextMenuItem,
  DownloadUrlOptions,
  DownloadUrlResult,
  SaveTextFileOptions,
  SaveTextFileResult,
  DiscoverFeedPreviewResult,
  AISemanticFilterInput,
  AISemanticFilterResult,
  AITranslateEntrySegmentsInput,
  AITranslateEntrySegmentsResult,
  AIDigestGenerateResult,
  AIDigestRun,
  AIDigestPreset,
  AISummaryEntryResult,
  EntryAISummarySession,
  EntryAITranslationSegment,
  EntryAITranslationSession,
  EntryAITranslationSessionStatus,
  TaskRunListOptions,
  TaskRunRecord,
  FeverAccount,
  FeverSyncState,
  AppHydratePayload,
} from '../shared/types'
import type { ResolvedProfileUrlResult } from '../shared/types'
import type { ActionRule } from '../shared/actions'
import type {
  AgentRunSummary,
  AgentToolExecutionEvent,
  AgentChatHistoryMessage,
  AgentNavigationAction,
  AgentTraceRecord,
} from '../shared/types'

type AgentRunResponse =
  | ({ success: true } & AgentRunSummary)
  | { success: false; error: string }

type AgentToolEventPayload = { requestId: string } & AgentToolExecutionEvent

async function invokeIpc<T = any>(
  channel: IpcChannel,
  ...args: unknown[]
): Promise<T> {
  const result = await ipcRenderer.invoke(channel, ...args)
  return unwrapIpcEnvelope<T>(result)
}

const api = {
  // Feed operations
  feeds: {
    add: (
      url: string,
      category?: string,
      view?: FeedViewType,
      title?: string,
    ) => invokeIpc(IPC.FEED_ADD, url, category, view, title),
    remove: (feedId: string) => invokeIpc(IPC.FEED_REMOVE, feedId),
    list: (): Promise<FeedWithCount[]> => invokeIpc(IPC.FEED_LIST),
    refresh: (feedId: string) => invokeIpc(IPC.FEED_REFRESH, feedId),
    refreshAll: () => invokeIpc(IPC.FEED_REFRESH_ALL),
    update: (feedId: string, updates: Partial<Feed>) =>
      invokeIpc(IPC.FEED_UPDATE, feedId, updates),
    importOPML: () => invokeIpc(IPC.FEED_IMPORT_OPML),
    exportOPML: () => invokeIpc(IPC.FEED_EXPORT_OPML),
    refreshImportedFeeds: (feedIds: string[]) =>
      invokeIpc(IPC.FEED_REFRESH_IMPORTED, feedIds),
    syncNow: (): Promise<FeedSyncResult | { success: false; error: string }> =>
      invokeIpc(IPC.FEED_SYNC_NOW),
    syncToCloud: (): Promise<
      FeedSyncResult | { success: false; error: string }
    > => invokeIpc(IPC.FEED_SYNC_TO_CLOUD),
    syncFromCloud: (): Promise<
      FeedSyncResult | { success: false; error: string }
    > => invokeIpc(IPC.FEED_SYNC_FROM_CLOUD),
    syncStatus: (): Promise<FeedSyncStatus> => invokeIpc(IPC.FEED_SYNC_STATUS),
  },

  // Reading activity
  readingActivity: {
    sync: (deviceId: string, days: Array<{ day: string; count: number }>) =>
      invokeIpc(IPC.READING_ACTIVITY_SYNC, deviceId, days),
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
    }): Promise<EntryListResult> => invokeIpc(IPC.ENTRY_LIST, options),
    get: (entryId: string): Promise<Entry | null> =>
      invokeIpc(IPC.ENTRY_GET, entryId),
    markRead: (entryId: string, isRead: boolean) =>
      invokeIpc(IPC.ENTRY_MARK_READ, entryId, isRead),
    markAllRead: (feedId?: string) =>
      invokeIpc(IPC.ENTRY_MARK_ALL_READ, feedId),
    toggleStar: (entryId: string) => invokeIpc(IPC.ENTRY_TOGGLE_STAR, entryId),
    saveProgress: (entryId: string, readProgress: number) =>
      invokeIpc(IPC.ENTRY_SAVE_PROGRESS, entryId, readProgress),
    markListened: (entryId: string, isListened: boolean) =>
      invokeIpc(IPC.ENTRY_MARK_LISTENED, entryId, isListened),
    saveListenProgress: (entryId: string, listenProgress: number) =>
      invokeIpc(IPC.ENTRY_SAVE_LISTEN_PROGRESS, entryId, listenProgress),
    search: (query: string, limit?: number): Promise<Entry[]> =>
      invokeIpc(IPC.ENTRY_SEARCH, query, limit),
  },

  reader: {
    snapshot: (input?: ReaderSnapshotRequest): Promise<ReaderSnapshot> =>
      invokeIpc(IPC.READER_SNAPSHOT, input),
  },

  // AI operations
  ai: {
    summarize: (content: string, language?: string, requestId?: string) =>
      invokeIpc(IPC.AI_SUMMARIZE, content, language, requestId),
    summarizeEntry: (
      entryId: string,
      language?: string,
      requestId?: string,
    ): Promise<AISummaryEntryResult> =>
      invokeIpc(IPC.AI_SUMMARIZE_ENTRY, entryId, language, requestId),
    getSummarySession: (
      entryId: string,
    ): Promise<EntryAISummarySession | null> =>
      invokeIpc(IPC.AI_SUMMARY_SESSION_GET, entryId),
    translate: (content: string, targetLanguage: string, requestId?: string) =>
      invokeIpc(IPC.AI_TRANSLATE, content, targetLanguage, requestId),
    translateEntrySegments: (
      input: AITranslateEntrySegmentsInput,
    ): Promise<AITranslateEntrySegmentsResult> =>
      invokeIpc(IPC.AI_TRANSLATE_ENTRY_SEGMENTS, input),
    getTranslationSession: (
      entryId: string,
    ): Promise<EntryAITranslationSession | null> =>
      invokeIpc(IPC.AI_TRANSLATION_SESSION_GET, entryId),
    createTranslationSession: (input: {
      entryId: string
      targetLanguage: string
      status: EntryAITranslationSessionStatus
      segments?: EntryAITranslationSegment[]
      errorCode?: string
      errorMessage?: string
      model?: string
      configFingerprint?: string
      runId?: string
    }): Promise<EntryAITranslationSession> =>
      invokeIpc(IPC.AI_TRANSLATION_SESSION_CREATE, input),
    updateTranslationSession: (
      sessionId: string,
      updates: {
        targetLanguage?: string
        status?: EntryAITranslationSessionStatus
        segments?: EntryAITranslationSegment[]
        errorCode?: string
        errorMessage?: string
        model?: string
        configFingerprint?: string
        runId?: string
        finishedAt?: number
      },
    ): Promise<EntryAITranslationSession | null> =>
      invokeIpc(IPC.AI_TRANSLATION_SESSION_UPDATE, sessionId, updates),
    chat: (messages: Array<{ role: string; content: string }>) =>
      invokeIpc(IPC.AI_CHAT, messages),
    chatStream: (
      messages: Array<{ role: string; content: string }>,
      requestId: string,
    ) => invokeIpc(IPC.AI_CHAT_STREAM, messages, requestId),
    judgeFilter: (
      input: AISemanticFilterInput,
    ): Promise<AISemanticFilterResult> => invokeIpc(IPC.AI_FILTER_JUDGE, input),
    digest: {
      listRuns: (limit?: number): Promise<AIDigestRun[]> =>
        invokeIpc(IPC.AI_DIGEST_LIST, limit),
      generate: (input: {
        preset: AIDigestPreset
        feedId?: string
      }): Promise<AIDigestGenerateResult> =>
        invokeIpc(IPC.AI_DIGEST_GENERATE, input),
    },
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
    testConnection: (): Promise<{
      success: boolean
      message: string
      duration?: number
      modelInfo?: string
    }> => invokeIpc(IPC.AI_TEST_CONNECTION),
  },

  tasks: {
    getRun: (runId: string): Promise<TaskRunRecord | null> =>
      invokeIpc(IPC.TASK_RUN_GET, runId),
    listRuns: (options?: TaskRunListOptions): Promise<TaskRunRecord[]> =>
      invokeIpc(IPC.TASK_RUN_LIST, options),
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => invokeIpc(IPC.SETTINGS_GET),
    set: (settings: Partial<AppSettings>) =>
      invokeIpc(IPC.SETTINGS_SET, settings),
    onChanged: (callback: (settings: AppSettings) => void) => {
      const handler = (_event: unknown, settings: AppSettings) =>
        callback(settings)
      ipcRenderer.on('settings:changed', handler)
      return () => ipcRenderer.removeListener('settings:changed', handler)
    },
  },

  // Automation rules (synced to the main process for ingestion-time filtering)
  actions: {
    sync: (rules: ActionRule[]): Promise<{ success: boolean }> =>
      invokeIpc(IPC.ACTIONS_SYNC, rules),
  },

  // Agent (multi-round tool-calling assistant)
  agent: {
    run: (payload: {
      requestId: string
      prompt: string
      history?: AgentChatHistoryMessage[]
      pageContext?: string
    }): Promise<AgentRunResponse> => invokeIpc(IPC.AGENT_RUN, payload),
    resume: (payload: {
      requestId: string
      pendingId: string
    }): Promise<AgentRunResponse> => invokeIpc(IPC.AGENT_RESUME, payload),
    abort: (requestId: string): Promise<{ success: boolean }> =>
      invokeIpc(IPC.AGENT_ABORT, requestId),
    listTraces: (): Promise<AgentTraceRecord[]> =>
      invokeIpc(IPC.AGENT_TRACES_LIST),
    clearTraces: (): Promise<{ success: boolean }> =>
      invokeIpc(IPC.AGENT_TRACES_CLEAR),
    onToolEvent: (callback: (data: AgentToolEventPayload) => void) => {
      const handler = (_event: unknown, data: AgentToolEventPayload) =>
        callback(data)
      ipcRenderer.on('agent:tool-event', handler)
      return () => ipcRenderer.removeListener('agent:tool-event', handler)
    },
    onNavigate: (callback: (action: AgentNavigationAction) => void) => {
      const handler = (_event: unknown, action: AgentNavigationAction) =>
        callback(action)
      ipcRenderer.on('agent:navigate', handler)
      return () => ipcRenderer.removeListener('agent:navigate', handler)
    },
  },

  // Readability
  readability: {
    fetch: (url: string, entryId?: string) =>
      invokeIpc(IPC.READABILITY_FETCH, url, entryId),
  },

  // Discover
  discover: {
    categories: () => invokeIpc(IPC.DISCOVER_CATEGORIES),
    popular: (category?: string) => invokeIpc(IPC.DISCOVER_POPULAR, category),
    search: (
      query: string,
      platform?: 'all' | 'youtube' | 'bilibili' | 'x' | 'instagram',
    ) => invokeIpc(IPC.DISCOVER_SEARCH, query, platform),
    rsshubRoutes: (category?: string) =>
      invokeIpc(IPC.DISCOVER_RSSHUB_ROUTES, category),
    rsshubInstance: () => invokeIpc(IPC.DISCOVER_RSSHUB_INSTANCE),
    validateFeed: (url: string) => invokeIpc(IPC.DISCOVER_VALIDATE_FEED, url),
    previewFeed: (url: string): Promise<DiscoverFeedPreviewResult> =>
      invokeIpc(IPC.DISCOVER_PREVIEW_FEED, url),
    resolveProfileUrl: (url: string): Promise<ResolvedProfileUrlResult> =>
      invokeIpc(IPC.DISCOVER_RESOLVE_PROFILE_URL, url),
    probeTwitterUser: (username: string) =>
      invokeIpc(IPC.DISCOVER_PROBE_TWITTER_USER, username),
    probeYouTubeChannel: (query: string) =>
      invokeIpc(IPC.DISCOVER_PROBE_YOUTUBE_CHANNEL, query),
    probeVideoSources: (query: string) =>
      invokeIpc(IPC.DISCOVER_PROBE_VIDEO_SOURCES, query),
    probeBilibiliUid: (uid: string) =>
      invokeIpc(IPC.DISCOVER_PROBE_BILIBILI_UID, uid),
    probeBilibiliUsers: (query: string) =>
      invokeIpc(IPC.DISCOVER_PROBE_BILIBILI_USERS, query),
    probeInstagramUser: (username: string) =>
      invokeIpc(IPC.DISCOVER_PROBE_INSTAGRAM_USER, username),
  },

  // App
  app: {
    getVersion: (): Promise<string> => invokeIpc(IPC.APP_GET_VERSION),
    getIcon: (): Promise<string | null> => invokeIpc(IPC.APP_GET_ICON),
    openExternal: (url: string): Promise<{ success: boolean }> =>
      invokeIpc(IPC.APP_OPEN_EXTERNAL, url),
    reportError: (payload: {
      source: string
      message: string
      stack?: string
      componentStack?: string
    }): Promise<{ success: boolean }> =>
      invokeIpc(IPC.APP_REPORT_ERROR, payload),
    readRecentLogs: (
      maxLines?: number,
    ): Promise<{ success: boolean; content: string }> =>
      invokeIpc(IPC.APP_READ_RECENT_LOGS, maxLines),
    openDataDirectory: (): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.APP_OPEN_DATA_DIRECTORY),
    openCacheDirectory: (): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.APP_OPEN_CACHE_DIRECTORY),
    openLogsDirectory: (): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.APP_OPEN_LOGS_DIRECTORY),
    clearCache: (): Promise<{
      success: boolean
      clearedBytes: number
      error?: string
    }> => invokeIpc(IPC.APP_CLEAR_CACHE),
    checkForUpdates: (): Promise<AppUpdateInfo> =>
      invokeIpc(IPC.APP_CHECK_FOR_UPDATES),
    installUpdate: (): Promise<AppUpdateInstallResult> =>
      invokeIpc(IPC.APP_INSTALL_UPDATE),
    saveTextFile: (options: SaveTextFileOptions): Promise<SaveTextFileResult> =>
      invokeIpc(IPC.APP_SAVE_TEXT_FILE, options),
    downloadUrl: (options: DownloadUrlOptions): Promise<DownloadUrlResult> =>
      invokeIpc(IPC.APP_DOWNLOAD_URL, options),
    rendererReady: (): Promise<{ success: boolean }> =>
      invokeIpc(IPC.APP_RENDERER_READY),
    readyToShowMainWindow: (): Promise<{ success: boolean }> =>
      invokeIpc(IPC.APP_READY_TO_SHOW_MAIN_WINDOW),
    hydrate: (): Promise<AppHydratePayload> => invokeIpc(IPC.APP_HYDRATE),
  },

  menu: {
    showContextMenu: (
      items: NativeContextMenuItem[],
    ): Promise<{ id: string | null }> =>
      invokeIpc(IPC.MENU_SHOW_CONTEXT, items),
  },

  // Native window controls (custom title bar)
  windowControls: {
    minimize: () => invokeIpc(IPC.WINDOW_MINIMIZE),
    maximizeToggle: () => invokeIpc(IPC.WINDOW_MAXIMIZE_TOGGLE),
    close: () => invokeIpc(IPC.WINDOW_CLOSE),
    isMaximized: (): Promise<boolean> => invokeIpc(IPC.WINDOW_IS_MAXIMIZED),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_event: unknown, isMaximized: boolean) =>
        callback(isMaximized)
      ipcRenderer.on('window:maximize-changed', handler)
      return () => {
        ipcRenderer.removeListener('window:maximize-changed', handler)
      }
    },
    platform: process.platform as string,
  },

  // Data maintenance
  data: {
    cleanup: (options?: {
      entriesPerFeed?: number
      maxEntryAgeDays?: number
    }) => invokeIpc(IPC.DATA_CLEANUP, options),
    stats: (): Promise<{
      totalFeeds: number
      totalEntries: number
      readEntries: number
      starredEntries: number
      dataSizeBytes: number
      cacheSizeBytes: number
    }> => invokeIpc(IPC.DATA_STATS),
  },

  // Refresh logs
  refreshLogs: {
    list: (): Promise<import('../shared/types').RefreshLogEntry[]> =>
      invokeIpc(IPC.REFRESH_LOG_LIST),
    clear: (): Promise<{ success: boolean }> =>
      invokeIpc(IPC.REFRESH_LOG_CLEAR),
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
    }> => invokeIpc(IPC.VIDEO_RESOLVE, url),
    openInApp: (url: string): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.VIDEO_OPEN_IN_APP, url),
    ytLogin: (): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.VIDEO_YT_LOGIN),
    ytStatus: (): Promise<{ loggedIn: boolean; name: string | null }> =>
      invokeIpc(IPC.VIDEO_YT_STATUS),
    ytLogout: (): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.VIDEO_YT_LOGOUT),
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
    }> => invokeIpc(IPC.ACCOUNT_STATUS, provider),
    link: (
      provider: AccountProvider,
    ): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.ACCOUNT_LINK, provider),
    unlink: (
      provider: AccountProvider,
    ): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.ACCOUNT_UNLINK, provider),
    setDisplayName: (
      provider: AccountProvider,
      displayName: string,
    ): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.ACCOUNT_SET_DISPLAY_NAME, provider, displayName),
    bilibiliFollowings: (): Promise<{
      success: boolean
      creators?: Array<{ mid: number; uname: string }>
      error?: string
    }> => invokeIpc(IPC.ACCOUNT_BILIBILI_FOLLOWINGS),
  },

  // Fever sync
  fever: {
    listAccounts: (): Promise<FeverAccount[]> =>
      invokeIpc(IPC.FEVER_ACCOUNTS_LIST),
    createAccount: (input: {
      baseUrl: string
      username: string
      apiKey: string
    }): Promise<FeverAccount> => invokeIpc(IPC.FEVER_ACCOUNTS_CREATE, input),
    updateAccount: (
      id: string,
      updates: Partial<FeverAccount>,
    ): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.FEVER_ACCOUNTS_UPDATE, id, updates),
    deleteAccount: (
      id: string,
    ): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.FEVER_ACCOUNTS_DELETE, id),
    verify: (
      baseUrl: string,
      username: string,
      apiKey: string,
    ): Promise<{ success: boolean; error?: string }> =>
      invokeIpc(IPC.FEVER_VERIFY, baseUrl, username, apiKey),
    sync: (
      accountId: string,
    ): Promise<{
      success: boolean
      feedsSynced: number
      itemsSynced: number
      newEntries: number
      error?: string
    }> => invokeIpc(IPC.FEVER_SYNC, accountId),
    syncAll: (): Promise<{
      success: boolean
      results: Array<{ accountId: string; success: boolean; error?: string }>
    }> => invokeIpc(IPC.FEVER_SYNC_ALL),
    getSyncState: (accountId: string): Promise<FeverSyncState | null> =>
      invokeIpc(IPC.FEVER_SYNC_STATE, accountId),
    onSyncProgress: (
      callback: (data: {
        accountId: string
        phase: string
        feedsSynced: number
        itemsSynced: number
        newEntries: number
        error?: string
      }) => void,
    ) => {
      const handler = (
        _event: unknown,
        data: {
          accountId: string
          phase: string
          feedsSynced: number
          itemsSynced: number
          newEntries: number
          error?: string
        },
      ) => callback(data)
      ipcRenderer.on('fever:sync-progress', handler)
      return () => ipcRenderer.removeListener('fever:sync-progress', handler)
    },
  },

  // Auth operations (for backend NestJS authentication)
  auth: {
    loginGoogle: () => invokeIpc(IPC.AUTH_LOGIN_GOOGLE),
    loginWechat: () => invokeIpc(IPC.AUTH_LOGIN_WECHAT),
    bindGoogle: () => invokeIpc(IPC.AUTH_BIND_GOOGLE),
    bindWechat: () => invokeIpc(IPC.AUTH_BIND_WECHAT),
    getCurrentUser: () => invokeIpc(IPC.AUTH_GET_CURRENT_USER),
    logout: () => invokeIpc(IPC.AUTH_LOGOUT),
    checkSession: () => invokeIpc(IPC.AUTH_CHECK_SESSION),
    onLoginProgress: (
      callback: (data: { status: string }) => void,
    ): (() => void) => {
      const handler = (_event: unknown, data: { status: string }) =>
        callback(data)
      ipcRenderer.on('auth:login-progress', handler)
      return () => ipcRenderer.removeListener('auth:login-progress', handler)
    },
  },

  notifications: {
    list: (options?: { unread?: boolean; limit?: number; offset?: number }) =>
      invokeIpc(IPC.ADMIN_GET_NOTIFICATIONS, options),
    unreadCount: () => invokeIpc(IPC.ADMIN_GET_UNREAD_COUNT),
    markRead: (id: string) => invokeIpc(IPC.ADMIN_MARK_NOTIFICATION_READ, id),
    markUnread: (id: string) =>
      invokeIpc(IPC.ADMIN_MARK_NOTIFICATION_UNREAD, id),
    markAllRead: () => invokeIpc(IPC.ADMIN_MARK_ALL_NOTIFICATIONS_READ),
  },

  websocket: {
    connect: (userId?: string) => invokeIpc(IPC.WS_CONNECT, userId),
    disconnect: () => invokeIpc(IPC.WS_DISCONNECT),
    status: () => invokeIpc(IPC.WS_STATUS),
  },

  // Events
  on: <C extends RendererEventChannel>(
    channel: C,
    callback: RendererEventCallback<C>,
  ) => {
    if (!isRendererEventChannel(channel)) {
      throw new Error(`Unsupported renderer event channel: ${channel}`)
    }
    const handler = (_event: unknown, ...args: RendererEventArgs<C>) =>
      callback(...args)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
