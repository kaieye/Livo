import type {
  AccountProvider,
  AgentChatHistoryMessage,
  AITranslateEntrySegmentsInput,
  AppSettings,
  DownloadUrlOptions,
  Feed,
  FeedViewType,
  FeverAccount,
  NativeContextMenuItem,
  ReaderSnapshotRequest,
  SaveTextFileOptions,
} from './types'
import type { ActionRule } from './actions'
import type { AISemanticFilterInput, AIDigestPreset } from './types'

export const IPC = {
  FEED_ADD: 'feed:add',
  FEED_REMOVE: 'feed:remove',
  FEED_LIST: 'feed:list',
  FEED_REFRESH: 'feed:refresh',
  FEED_REFRESH_ALL: 'feed:refresh-all',
  FEED_UPDATE: 'feed:update',
  FEED_IMPORT_OPML: 'feed:import-opml',
  FEED_EXPORT_OPML: 'feed:export-opml',
  FEED_REFRESH_IMPORTED: 'feed:refresh-imported',
  ENTRY_LIST: 'entry:list',
  ENTRY_GET: 'entry:get',
  ENTRY_MARK_READ: 'entry:mark-read',
  ENTRY_MARK_ALL_READ: 'entry:mark-all-read',
  ENTRY_TOGGLE_STAR: 'entry:toggle-star',
  ENTRY_SAVE_PROGRESS: 'entry:save-progress',
  ENTRY_MARK_LISTENED: 'entry:mark-listened',
  ENTRY_SAVE_LISTEN_PROGRESS: 'entry:save-listen-progress',
  ENTRY_SEARCH: 'entry:search',
  READER_SNAPSHOT: 'reader:snapshot',
  AI_SUMMARIZE: 'ai:summarize',
  AI_SUMMARIZE_ENTRY: 'ai:summarize-entry',
  AI_SUMMARY_SESSION_GET: 'ai:summary-session-get',
  AI_TRANSLATE: 'ai:translate',
  AI_TRANSLATE_ENTRY_SEGMENTS: 'ai:translate-entry-segments',
  AI_TRANSLATION_SESSION_GET: 'ai:translation-session-get',
  AI_TRANSLATION_SESSION_CREATE: 'ai:translation-session-create',
  AI_TRANSLATION_SESSION_UPDATE: 'ai:translation-session-update',
  AI_CHAT: 'ai:chat',
  AI_CHAT_STREAM: 'ai:chat-stream',
  AI_FILTER_JUDGE: 'ai:filter-judge',
  AI_DIGEST_LIST: 'ai:digest-list',
  AI_DIGEST_GENERATE: 'ai:digest-generate',
  AI_TEST_CONNECTION: 'ai:test-connection',
  TASK_RUN_GET: 'task-run:get',
  TASK_RUN_LIST: 'task-run:list',
  AGENT_RUN: 'agent:run',
  AGENT_RESUME: 'agent:resume',
  AGENT_ABORT: 'agent:abort',
  AGENT_TRACES_LIST: 'agent:traces-list',
  AGENT_TRACES_CLEAR: 'agent:traces-clear',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  ACTIONS_SYNC: 'actions:sync',
  READABILITY_FETCH: 'readability:fetch',
  DISCOVER_CATEGORIES: 'discover:categories',
  DISCOVER_POPULAR: 'discover:popular',
  DISCOVER_SEARCH: 'discover:search',
  DISCOVER_RSSHUB_ROUTES: 'discover:rsshub-routes',
  DISCOVER_RSSHUB_INSTANCE: 'discover:rsshub-instance',
  DISCOVER_VALIDATE_FEED: 'discover:validate-feed',
  DISCOVER_PREVIEW_FEED: 'discover:preview-feed',
  DISCOVER_RESOLVE_PROFILE_URL: 'discover:resolve-profile-url',
  DISCOVER_PROBE_TWITTER_USER: 'twitter:probe-user',
  DISCOVER_PROBE_YOUTUBE_CHANNEL: 'youtube:probe-channel',
  DISCOVER_PROBE_VIDEO_SOURCES: 'discover:probe-video-sources',
  DISCOVER_PROBE_BILIBILI_UID: 'discover:probe-bilibili-uid',
  DISCOVER_PROBE_BILIBILI_USERS: 'discover:probe-bilibili-users',
  DISCOVER_PROBE_INSTAGRAM_USER: 'instagram:probe-user',
  ACCOUNT_STATUS: 'account:status',
  ACCOUNT_LINK: 'account:link',
  ACCOUNT_UNLINK: 'account:unlink',
  ACCOUNT_SET_DISPLAY_NAME: 'account:set-display-name',
  ACCOUNT_BILIBILI_FOLLOWINGS: 'account:bilibili-followings',
  DATA_CLEANUP: 'data:cleanup',
  DATA_STATS: 'data:stats',
  REFRESH_LOG_LIST: 'refresh-log:list',
  REFRESH_LOG_CLEAR: 'refresh-log:clear',
  VIDEO_RESOLVE: 'video:resolve',
  VIDEO_OPEN_IN_APP: 'video:open-in-app',
  VIDEO_YT_LOGIN: 'video:yt-login',
  VIDEO_YT_STATUS: 'video:yt-status',
  VIDEO_YT_LOGOUT: 'video:yt-logout',
  APP_GET_VERSION: 'app:version',
  APP_OPEN_EXTERNAL: 'app:open-external',
  APP_REPORT_ERROR: 'app:report-error',
  APP_READ_RECENT_LOGS: 'app:read-recent-logs',
  APP_OPEN_DATA_DIRECTORY: 'app:open-data-directory',
  APP_OPEN_CACHE_DIRECTORY: 'app:open-cache-directory',
  APP_OPEN_LOGS_DIRECTORY: 'app:open-logs-directory',
  APP_CLEAR_CACHE: 'app:clear-cache',
  APP_CHECK_FOR_UPDATES: 'app:check-for-updates',
  APP_SAVE_TEXT_FILE: 'app:save-text-file',
  APP_DOWNLOAD_URL: 'app:download-url',
  MENU_SHOW_CONTEXT: 'menu:show-context',
  FEVER_ACCOUNTS_LIST: 'fever:accounts-list',
  FEVER_ACCOUNTS_CREATE: 'fever:accounts-create',
  FEVER_ACCOUNTS_UPDATE: 'fever:accounts-update',
  FEVER_ACCOUNTS_DELETE: 'fever:accounts-delete',
  FEVER_VERIFY: 'fever:verify',
  FEVER_SYNC: 'fever:sync',
  FEVER_SYNC_ALL: 'fever:sync-all',
  FEVER_SYNC_STATE: 'fever:sync-state',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export type IpcErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'service_unavailable'
  | 'internal_error'

export interface IpcErrorPayload {
  code: IpcErrorCode
  message: string
  fields?: Record<string, string>
}

export type IpcEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcErrorPayload }

export class IpcContractError extends Error {
  constructor(
    message: string,
    public readonly code: IpcErrorCode,
    public readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'IpcContractError'
  }
}

export class IpcValidationError extends IpcContractError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'validation_error', fields)
    this.name = 'IpcValidationError'
  }
}

export function ipcOk<T>(data: T): IpcEnvelope<T> {
  return { ok: true, data }
}

export function ipcFail(error: IpcErrorPayload): IpcEnvelope<never> {
  return { ok: false, error }
}

export function isIpcEnvelope(value: unknown): value is IpcEnvelope<unknown> {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false
  if (value.ok) return 'data' in value
  return isRecord(value.error) && typeof value.error.message === 'string'
}

export function unwrapIpcEnvelope<T>(value: T | IpcEnvelope<T>): T {
  if (!isIpcEnvelope(value)) return value as T
  if (value.ok) return value.data as T
  throw new IpcContractError(
    value.error.message,
    value.error.code,
    value.error.fields,
  )
}

export type IpcArgsByChannel = {
  [IPC.FEED_ADD]: [
    url: string,
    category?: string,
    view?: FeedViewType,
    title?: string,
  ]
  [IPC.FEED_REMOVE]: [feedId: string]
  [IPC.FEED_LIST]: []
  [IPC.FEED_REFRESH]: [feedId: string]
  [IPC.FEED_REFRESH_ALL]: []
  [IPC.FEED_UPDATE]: [feedId: string, updates: Partial<Feed>]
  [IPC.FEED_IMPORT_OPML]: []
  [IPC.FEED_EXPORT_OPML]: []
  [IPC.FEED_REFRESH_IMPORTED]: [feedIds: string[]]
  [IPC.ENTRY_LIST]: [
    options: {
      feedId?: string
      feedIds?: string[]
      starred?: boolean
      unreadOnly?: boolean
      limit?: number
      offset?: number
      compact?: boolean
      maxContentLength?: number
      skipDedupe?: boolean
    },
  ]
  [IPC.ENTRY_GET]: [entryId: string]
  [IPC.ENTRY_MARK_READ]: [entryId: string, isRead: boolean]
  [IPC.ENTRY_MARK_ALL_READ]: [feedId?: string]
  [IPC.ENTRY_TOGGLE_STAR]: [entryId: string]
  [IPC.ENTRY_SAVE_PROGRESS]: [entryId: string, readProgress: number]
  [IPC.ENTRY_MARK_LISTENED]: [entryId: string, isListened: boolean]
  [IPC.ENTRY_SAVE_LISTEN_PROGRESS]: [entryId: string, listenProgress: number]
  [IPC.ENTRY_SEARCH]: [query: string, limit?: number]
  [IPC.READER_SNAPSHOT]: [input?: ReaderSnapshotRequest]
  [IPC.AI_SUMMARIZE]: [content: string, language?: string, requestId?: string]
  [IPC.AI_SUMMARIZE_ENTRY]: [
    entryId: string,
    language?: string,
    requestId?: string,
  ]
  [IPC.AI_SUMMARY_SESSION_GET]: [entryId: string]
  [IPC.AI_TRANSLATE]: [
    content: string,
    targetLanguage: string,
    requestId?: string,
  ]
  [IPC.AI_TRANSLATE_ENTRY_SEGMENTS]: [input: AITranslateEntrySegmentsInput]
  [IPC.AI_TRANSLATION_SESSION_GET]: [entryId: string]
  [IPC.AI_TRANSLATION_SESSION_CREATE]: [input: Record<string, unknown>]
  [IPC.AI_TRANSLATION_SESSION_UPDATE]: [
    sessionId: string,
    updates: Record<string, unknown>,
  ]
  [IPC.AI_CHAT]: [messages: Array<{ role: string; content: string }>]
  [IPC.AI_CHAT_STREAM]: [
    messages: Array<{ role: string; content: string }>,
    requestId: string,
  ]
  [IPC.AI_FILTER_JUDGE]: [input: AISemanticFilterInput]
  [IPC.AI_DIGEST_LIST]: [limit?: number]
  [IPC.AI_DIGEST_GENERATE]: [
    input?: { preset?: AIDigestPreset; feedId?: string },
  ]
  [IPC.AI_TEST_CONNECTION]: []
  [IPC.TASK_RUN_GET]: [runId: string]
  [IPC.TASK_RUN_LIST]: [options?: { taskName?: string; limit?: number }]
  [IPC.AGENT_RUN]: [
    payload: {
      requestId: string
      prompt: string
      history?: AgentChatHistoryMessage[]
      pageContext?: string
    },
  ]
  [IPC.AGENT_RESUME]: [payload: { requestId: string; pendingId: string }]
  [IPC.AGENT_ABORT]: [requestId: string]
  [IPC.AGENT_TRACES_LIST]: []
  [IPC.AGENT_TRACES_CLEAR]: []
  [IPC.SETTINGS_GET]: []
  [IPC.SETTINGS_SET]: [settings: Partial<AppSettings>]
  [IPC.ACTIONS_SYNC]: [rules: ActionRule[]]
  [IPC.READABILITY_FETCH]: [url: string, entryId?: string]
  [IPC.DISCOVER_CATEGORIES]: []
  [IPC.DISCOVER_POPULAR]: [category?: string]
  [IPC.DISCOVER_SEARCH]: [
    query: string,
    platform?: 'all' | 'youtube' | 'bilibili' | 'x' | 'instagram',
  ]
  [IPC.DISCOVER_RSSHUB_ROUTES]: [category?: string]
  [IPC.DISCOVER_RSSHUB_INSTANCE]: []
  [IPC.DISCOVER_VALIDATE_FEED]: [url: string]
  [IPC.DISCOVER_PREVIEW_FEED]: [url: string]
  [IPC.DISCOVER_RESOLVE_PROFILE_URL]: [url: string]
  [IPC.DISCOVER_PROBE_TWITTER_USER]: [username: string]
  [IPC.DISCOVER_PROBE_YOUTUBE_CHANNEL]: [query: string]
  [IPC.DISCOVER_PROBE_VIDEO_SOURCES]: [query: string]
  [IPC.DISCOVER_PROBE_BILIBILI_UID]: [uid: string]
  [IPC.DISCOVER_PROBE_BILIBILI_USERS]: [query: string]
  [IPC.DISCOVER_PROBE_INSTAGRAM_USER]: [username: string]
  [IPC.ACCOUNT_STATUS]: [provider: AccountProvider]
  [IPC.ACCOUNT_LINK]: [provider: AccountProvider]
  [IPC.ACCOUNT_UNLINK]: [provider: AccountProvider]
  [IPC.ACCOUNT_SET_DISPLAY_NAME]: [
    provider: AccountProvider,
    displayName: string,
  ]
  [IPC.ACCOUNT_BILIBILI_FOLLOWINGS]: []
  [IPC.DATA_CLEANUP]: [
    options?: { entriesPerFeed?: number; maxEntryAgeDays?: number },
  ]
  [IPC.DATA_STATS]: []
  [IPC.REFRESH_LOG_LIST]: []
  [IPC.REFRESH_LOG_CLEAR]: []
  [IPC.VIDEO_RESOLVE]: [url: string]
  [IPC.VIDEO_OPEN_IN_APP]: [url: string]
  [IPC.VIDEO_YT_LOGIN]: []
  [IPC.VIDEO_YT_STATUS]: []
  [IPC.VIDEO_YT_LOGOUT]: []
  [IPC.APP_GET_VERSION]: []
  [IPC.APP_OPEN_EXTERNAL]: [url: string]
  [IPC.APP_REPORT_ERROR]: [
    payload: {
      source: string
      message: string
      stack?: string
      componentStack?: string
    },
  ]
  [IPC.APP_READ_RECENT_LOGS]: [maxLines?: number]
  [IPC.APP_OPEN_DATA_DIRECTORY]: []
  [IPC.APP_OPEN_CACHE_DIRECTORY]: []
  [IPC.APP_OPEN_LOGS_DIRECTORY]: []
  [IPC.APP_CLEAR_CACHE]: []
  [IPC.APP_CHECK_FOR_UPDATES]: []
  [IPC.APP_SAVE_TEXT_FILE]: [options: SaveTextFileOptions]
  [IPC.APP_DOWNLOAD_URL]: [options: DownloadUrlOptions]
  [IPC.MENU_SHOW_CONTEXT]: [items: NativeContextMenuItem[]]
  [IPC.FEVER_ACCOUNTS_LIST]: []
  [IPC.FEVER_ACCOUNTS_CREATE]: [
    input: { baseUrl: string; username: string; apiKey: string },
  ]
  [IPC.FEVER_ACCOUNTS_UPDATE]: [id: string, updates: Partial<FeverAccount>]
  [IPC.FEVER_ACCOUNTS_DELETE]: [id: string]
  [IPC.FEVER_VERIFY]: [baseUrl: string, username: string, apiKey: string]
  [IPC.FEVER_SYNC]: [accountId: string]
  [IPC.FEVER_SYNC_ALL]: []
  [IPC.FEVER_SYNC_STATE]: [accountId: string]
}

export type IpcArgs<C extends IpcChannel> = C extends keyof IpcArgsByChannel
  ? IpcArgsByChannel[C]
  : unknown[]

type IpcArgsValidator<C extends IpcChannel> = (args: unknown[]) => IpcArgs<C>

type IpcContract<C extends IpcChannel> = {
  channel: C
  validateArgs: IpcArgsValidator<C>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertArity(
  channel: IpcChannel,
  args: unknown[],
  min: number,
  max = min,
): void {
  if (args.length < min || args.length > max) {
    throw new IpcValidationError('Invalid IPC argument count', {
      channel,
      expected: min === max ? String(min) : `${min}-${max}`,
      actual: String(args.length),
    })
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new IpcValidationError('Invalid IPC argument', {
      [field]: 'expected_string',
    })
  }
}

function assertOptionalString(
  value: unknown,
  field: string,
): asserts value is string | undefined {
  if (value !== undefined) assertString(value, field)
}

function assertOptionalNullableString(
  value: unknown,
  field: string,
): asserts value is string | null | undefined {
  if (value !== undefined && value !== null) assertString(value, field)
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IpcValidationError('Invalid IPC argument', {
      [field]: 'expected_number',
    })
  }
}

function assertOptionalNumber(
  value: unknown,
  field: string,
): asserts value is number | undefined {
  if (value !== undefined) assertNumber(value, field)
}

function assertBoolean(
  value: unknown,
  field: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new IpcValidationError('Invalid IPC argument', {
      [field]: 'expected_boolean',
    })
  }
}

function assertObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new IpcValidationError('Invalid IPC argument', {
      [field]: 'expected_object',
    })
  }
}

function assertOptionalObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> | undefined {
  if (value !== undefined) assertObject(value, field)
}

function assertTaskRunListOptions(value: unknown): void {
  assertOptionalObject(value, 'options')
  if (!value) return
  assertOptionalString(value.taskName, 'options.taskName')
  assertOptionalNumber(value.limit, 'options.limit')
}

function assertStringArray(
  value: unknown,
  field: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new IpcValidationError('Invalid IPC argument', {
      [field]: 'expected_string_array',
    })
  }
}

function assertOptionalStringArray(
  value: unknown,
  field: string,
): asserts value is string[] | undefined {
  if (value !== undefined) assertStringArray(value, field)
}

function assertOptionalBoolean(
  value: unknown,
  field: string,
): asserts value is boolean | undefined {
  if (value !== undefined) assertBoolean(value, field)
}

function noArgs<C extends IpcChannel>(channel: C): IpcContract<C> {
  return {
    channel,
    validateArgs: (args) => {
      assertArity(channel, args, 0)
      return [] as unknown as IpcArgs<C>
    },
  }
}

function oneString<C extends IpcChannel>(
  channel: C,
  field: string,
): IpcContract<C> {
  return {
    channel,
    validateArgs: (args) => {
      assertArity(channel, args, 1)
      assertString(args[0], field)
      return args as IpcArgs<C>
    },
  }
}

function optionalString<C extends IpcChannel>(
  channel: C,
  field: string,
): IpcContract<C> {
  return {
    channel,
    validateArgs: (args) => {
      assertArity(channel, args, 0, 1)
      assertOptionalString(args[0], field)
      return args as IpcArgs<C>
    },
  }
}

function oneObject<C extends IpcChannel>(
  channel: C,
  field: string,
): IpcContract<C> {
  return {
    channel,
    validateArgs: (args) => {
      assertArity(channel, args, 1)
      assertObject(args[0], field)
      return args as IpcArgs<C>
    },
  }
}

const accountProviders = new Set<AccountProvider>([
  'youtube',
  'x',
  'instagram',
  'bilibili',
])

function assertAccountProvider(
  value: unknown,
  field: string,
): asserts value is AccountProvider {
  assertString(value, field)
  if (!accountProviders.has(value as AccountProvider)) {
    throw new IpcValidationError('Invalid IPC argument', {
      [field]: 'unsupported_provider',
    })
  }
}

function assertMessages(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new IpcValidationError('Invalid IPC argument', {
      messages: 'expected_array',
    })
  }
  for (const [index, item] of value.entries()) {
    if (
      !isRecord(item) ||
      typeof item.role !== 'string' ||
      typeof item.content !== 'string'
    ) {
      throw new IpcValidationError('Invalid IPC argument', {
        [`messages.${index}`]: 'expected_message',
      })
    }
  }
}

function validateEntryListOptions(value: unknown): void {
  assertObject(value, 'options')
  assertOptionalString(value.feedId, 'options.feedId')
  assertOptionalStringArray(value.feedIds, 'options.feedIds')
  assertOptionalBoolean(value.starred, 'options.starred')
  assertOptionalBoolean(value.unreadOnly, 'options.unreadOnly')
  assertOptionalNumber(value.limit, 'options.limit')
  assertOptionalNumber(value.offset, 'options.offset')
  assertOptionalBoolean(value.compact, 'options.compact')
  assertOptionalNumber(value.maxContentLength, 'options.maxContentLength')
  assertOptionalBoolean(value.skipDedupe, 'options.skipDedupe')
}

function validateReaderSnapshotInput(value: unknown): void {
  assertOptionalObject(value, 'input')
  if (value === undefined) return
  const input = value as Record<string, unknown>
  assertOptionalNumber(input.limit, 'input.limit')
  assertOptionalNullableString(input.cursor, 'input.cursor')
  assertOptionalBoolean(input.unreadOnly, 'input.unreadOnly')
  assertOptionalBoolean(input.compact, 'input.compact')
  assertOptionalNumber(input.maxContentLength, 'input.maxContentLength')
  if (input.scope === undefined) return
  assertObject(input.scope, 'input.scope')
  const scope = input.scope
  assertString(scope.type, 'input.scope.type')
  if (scope.type === 'feed') {
    assertString(scope.feedId, 'input.scope.feedId')
    return
  }
  if (scope.type === 'all') {
    assertOptionalStringArray(scope.feedIds, 'input.scope.feedIds')
    return
  }
  if (scope.type === 'starred') return
  throw new IpcValidationError('Invalid IPC argument', {
    'input.scope.type': 'unsupported_scope',
  })
}

export const IPC_CONTRACTS = {
  [IPC.FEED_ADD]: {
    channel: IPC.FEED_ADD,
    validateArgs: (args) => {
      assertArity(IPC.FEED_ADD, args, 1, 4)
      assertString(args[0], 'url')
      assertOptionalString(args[1], 'category')
      assertOptionalNumber(args[2], 'view')
      assertOptionalString(args[3], 'title')
      return args as IpcArgs<typeof IPC.FEED_ADD>
    },
  },
  [IPC.FEED_REMOVE]: oneString(IPC.FEED_REMOVE, 'feedId'),
  [IPC.FEED_LIST]: noArgs(IPC.FEED_LIST),
  [IPC.FEED_REFRESH]: oneString(IPC.FEED_REFRESH, 'feedId'),
  [IPC.FEED_REFRESH_ALL]: noArgs(IPC.FEED_REFRESH_ALL),
  [IPC.FEED_UPDATE]: {
    channel: IPC.FEED_UPDATE,
    validateArgs: (args) => {
      assertArity(IPC.FEED_UPDATE, args, 2)
      assertString(args[0], 'feedId')
      assertObject(args[1], 'updates')
      return args as IpcArgs<typeof IPC.FEED_UPDATE>
    },
  },
  [IPC.FEED_IMPORT_OPML]: noArgs(IPC.FEED_IMPORT_OPML),
  [IPC.FEED_EXPORT_OPML]: noArgs(IPC.FEED_EXPORT_OPML),
  [IPC.FEED_REFRESH_IMPORTED]: {
    channel: IPC.FEED_REFRESH_IMPORTED,
    validateArgs: (args) => {
      assertArity(IPC.FEED_REFRESH_IMPORTED, args, 1)
      assertStringArray(args[0], 'feedIds')
      return args as IpcArgs<typeof IPC.FEED_REFRESH_IMPORTED>
    },
  },
  [IPC.ENTRY_LIST]: {
    channel: IPC.ENTRY_LIST,
    validateArgs: (args) => {
      assertArity(IPC.ENTRY_LIST, args, 1)
      validateEntryListOptions(args[0])
      return args as IpcArgs<typeof IPC.ENTRY_LIST>
    },
  },
  [IPC.ENTRY_GET]: oneString(IPC.ENTRY_GET, 'entryId'),
  [IPC.ENTRY_MARK_READ]: {
    channel: IPC.ENTRY_MARK_READ,
    validateArgs: (args) => {
      assertArity(IPC.ENTRY_MARK_READ, args, 2)
      assertString(args[0], 'entryId')
      assertBoolean(args[1], 'isRead')
      return args as IpcArgs<typeof IPC.ENTRY_MARK_READ>
    },
  },
  [IPC.ENTRY_MARK_ALL_READ]: optionalString(IPC.ENTRY_MARK_ALL_READ, 'feedId'),
  [IPC.ENTRY_TOGGLE_STAR]: oneString(IPC.ENTRY_TOGGLE_STAR, 'entryId'),
  [IPC.ENTRY_SAVE_PROGRESS]: {
    channel: IPC.ENTRY_SAVE_PROGRESS,
    validateArgs: (args) => {
      assertArity(IPC.ENTRY_SAVE_PROGRESS, args, 2)
      assertString(args[0], 'entryId')
      assertNumber(args[1], 'readProgress')
      return args as IpcArgs<typeof IPC.ENTRY_SAVE_PROGRESS>
    },
  },
  [IPC.ENTRY_MARK_LISTENED]: {
    channel: IPC.ENTRY_MARK_LISTENED,
    validateArgs: (args) => {
      assertArity(IPC.ENTRY_MARK_LISTENED, args, 2)
      assertString(args[0], 'entryId')
      assertBoolean(args[1], 'isListened')
      return args as IpcArgs<typeof IPC.ENTRY_MARK_LISTENED>
    },
  },
  [IPC.ENTRY_SAVE_LISTEN_PROGRESS]: {
    channel: IPC.ENTRY_SAVE_LISTEN_PROGRESS,
    validateArgs: (args) => {
      assertArity(IPC.ENTRY_SAVE_LISTEN_PROGRESS, args, 2)
      assertString(args[0], 'entryId')
      assertNumber(args[1], 'listenProgress')
      return args as IpcArgs<typeof IPC.ENTRY_SAVE_LISTEN_PROGRESS>
    },
  },
  [IPC.ENTRY_SEARCH]: {
    channel: IPC.ENTRY_SEARCH,
    validateArgs: (args) => {
      assertArity(IPC.ENTRY_SEARCH, args, 1, 2)
      assertString(args[0], 'query')
      assertOptionalNumber(args[1], 'limit')
      return args as IpcArgs<typeof IPC.ENTRY_SEARCH>
    },
  },
  [IPC.READER_SNAPSHOT]: {
    channel: IPC.READER_SNAPSHOT,
    validateArgs: (args) => {
      assertArity(IPC.READER_SNAPSHOT, args, 0, 1)
      validateReaderSnapshotInput(args[0])
      return args as IpcArgs<typeof IPC.READER_SNAPSHOT>
    },
  },
  [IPC.AI_SUMMARIZE]: {
    channel: IPC.AI_SUMMARIZE,
    validateArgs: (args) => {
      assertArity(IPC.AI_SUMMARIZE, args, 1, 3)
      assertString(args[0], 'content')
      assertOptionalString(args[1], 'language')
      assertOptionalString(args[2], 'requestId')
      return args as IpcArgs<typeof IPC.AI_SUMMARIZE>
    },
  },
  [IPC.AI_SUMMARIZE_ENTRY]: {
    channel: IPC.AI_SUMMARIZE_ENTRY,
    validateArgs: (args) => {
      assertArity(IPC.AI_SUMMARIZE_ENTRY, args, 1, 3)
      assertString(args[0], 'entryId')
      assertOptionalString(args[1], 'language')
      assertOptionalString(args[2], 'requestId')
      return args as IpcArgs<typeof IPC.AI_SUMMARIZE_ENTRY>
    },
  },
  [IPC.AI_SUMMARY_SESSION_GET]: oneString(
    IPC.AI_SUMMARY_SESSION_GET,
    'entryId',
  ),
  [IPC.AI_TRANSLATE]: {
    channel: IPC.AI_TRANSLATE,
    validateArgs: (args) => {
      assertArity(IPC.AI_TRANSLATE, args, 2, 3)
      assertString(args[0], 'content')
      assertString(args[1], 'targetLanguage')
      assertOptionalString(args[2], 'requestId')
      return args as IpcArgs<typeof IPC.AI_TRANSLATE>
    },
  },
  [IPC.AI_TRANSLATE_ENTRY_SEGMENTS]: oneObject(
    IPC.AI_TRANSLATE_ENTRY_SEGMENTS,
    'input',
  ),
  [IPC.AI_TRANSLATION_SESSION_GET]: oneString(
    IPC.AI_TRANSLATION_SESSION_GET,
    'entryId',
  ),
  [IPC.AI_TRANSLATION_SESSION_CREATE]: oneObject(
    IPC.AI_TRANSLATION_SESSION_CREATE,
    'input',
  ),
  [IPC.AI_TRANSLATION_SESSION_UPDATE]: {
    channel: IPC.AI_TRANSLATION_SESSION_UPDATE,
    validateArgs: (args) => {
      assertArity(IPC.AI_TRANSLATION_SESSION_UPDATE, args, 2)
      assertString(args[0], 'sessionId')
      assertObject(args[1], 'updates')
      return args as IpcArgs<typeof IPC.AI_TRANSLATION_SESSION_UPDATE>
    },
  },
  [IPC.AI_CHAT]: {
    channel: IPC.AI_CHAT,
    validateArgs: (args) => {
      assertArity(IPC.AI_CHAT, args, 1)
      assertMessages(args[0])
      return args as IpcArgs<typeof IPC.AI_CHAT>
    },
  },
  [IPC.AI_CHAT_STREAM]: {
    channel: IPC.AI_CHAT_STREAM,
    validateArgs: (args) => {
      assertArity(IPC.AI_CHAT_STREAM, args, 2)
      assertMessages(args[0])
      assertString(args[1], 'requestId')
      return args as IpcArgs<typeof IPC.AI_CHAT_STREAM>
    },
  },
  [IPC.AI_FILTER_JUDGE]: oneObject(IPC.AI_FILTER_JUDGE, 'input'),
  [IPC.AI_DIGEST_LIST]: {
    channel: IPC.AI_DIGEST_LIST,
    validateArgs: (args) => {
      assertArity(IPC.AI_DIGEST_LIST, args, 0, 1)
      assertOptionalNumber(args[0], 'limit')
      return args as IpcArgs<typeof IPC.AI_DIGEST_LIST>
    },
  },
  [IPC.AI_DIGEST_GENERATE]: {
    channel: IPC.AI_DIGEST_GENERATE,
    validateArgs: (args) => {
      assertArity(IPC.AI_DIGEST_GENERATE, args, 0, 1)
      assertOptionalObject(args[0], 'input')
      return args as IpcArgs<typeof IPC.AI_DIGEST_GENERATE>
    },
  },
  [IPC.AI_TEST_CONNECTION]: noArgs(IPC.AI_TEST_CONNECTION),
  [IPC.TASK_RUN_GET]: oneString(IPC.TASK_RUN_GET, 'runId'),
  [IPC.TASK_RUN_LIST]: {
    channel: IPC.TASK_RUN_LIST,
    validateArgs: (args) => {
      assertArity(IPC.TASK_RUN_LIST, args, 0, 1)
      assertTaskRunListOptions(args[0])
      return args as IpcArgs<typeof IPC.TASK_RUN_LIST>
    },
  },
  [IPC.AGENT_RUN]: oneObject(IPC.AGENT_RUN, 'payload'),
  [IPC.AGENT_RESUME]: oneObject(IPC.AGENT_RESUME, 'payload'),
  [IPC.AGENT_ABORT]: oneString(IPC.AGENT_ABORT, 'requestId'),
  [IPC.AGENT_TRACES_LIST]: noArgs(IPC.AGENT_TRACES_LIST),
  [IPC.AGENT_TRACES_CLEAR]: noArgs(IPC.AGENT_TRACES_CLEAR),
  [IPC.SETTINGS_GET]: noArgs(IPC.SETTINGS_GET),
  [IPC.SETTINGS_SET]: oneObject(IPC.SETTINGS_SET, 'settings'),
  [IPC.ACTIONS_SYNC]: {
    channel: IPC.ACTIONS_SYNC,
    validateArgs: (args) => {
      assertArity(IPC.ACTIONS_SYNC, args, 1)
      if (!Array.isArray(args[0])) {
        throw new IpcValidationError('Invalid IPC argument', {
          rules: 'expected_array',
        })
      }
      return args as IpcArgs<typeof IPC.ACTIONS_SYNC>
    },
  },
  [IPC.READABILITY_FETCH]: {
    channel: IPC.READABILITY_FETCH,
    validateArgs: (args) => {
      assertArity(IPC.READABILITY_FETCH, args, 1, 2)
      assertString(args[0], 'url')
      assertOptionalString(args[1], 'entryId')
      return args as IpcArgs<typeof IPC.READABILITY_FETCH>
    },
  },
  [IPC.DISCOVER_CATEGORIES]: noArgs(IPC.DISCOVER_CATEGORIES),
  [IPC.DISCOVER_POPULAR]: optionalString(IPC.DISCOVER_POPULAR, 'category'),
  [IPC.DISCOVER_SEARCH]: {
    channel: IPC.DISCOVER_SEARCH,
    validateArgs: (args) => {
      assertArity(IPC.DISCOVER_SEARCH, args, 1, 2)
      assertString(args[0], 'query')
      assertOptionalString(args[1], 'platform')
      return args as IpcArgs<typeof IPC.DISCOVER_SEARCH>
    },
  },
  [IPC.DISCOVER_RSSHUB_ROUTES]: optionalString(
    IPC.DISCOVER_RSSHUB_ROUTES,
    'category',
  ),
  [IPC.DISCOVER_RSSHUB_INSTANCE]: noArgs(IPC.DISCOVER_RSSHUB_INSTANCE),
  [IPC.DISCOVER_VALIDATE_FEED]: oneString(IPC.DISCOVER_VALIDATE_FEED, 'url'),
  [IPC.DISCOVER_PREVIEW_FEED]: oneString(IPC.DISCOVER_PREVIEW_FEED, 'url'),
  [IPC.DISCOVER_RESOLVE_PROFILE_URL]: oneString(
    IPC.DISCOVER_RESOLVE_PROFILE_URL,
    'url',
  ),
  [IPC.DISCOVER_PROBE_TWITTER_USER]: oneString(
    IPC.DISCOVER_PROBE_TWITTER_USER,
    'username',
  ),
  [IPC.DISCOVER_PROBE_YOUTUBE_CHANNEL]: oneString(
    IPC.DISCOVER_PROBE_YOUTUBE_CHANNEL,
    'query',
  ),
  [IPC.DISCOVER_PROBE_VIDEO_SOURCES]: oneString(
    IPC.DISCOVER_PROBE_VIDEO_SOURCES,
    'query',
  ),
  [IPC.DISCOVER_PROBE_BILIBILI_UID]: oneString(
    IPC.DISCOVER_PROBE_BILIBILI_UID,
    'uid',
  ),
  [IPC.DISCOVER_PROBE_BILIBILI_USERS]: oneString(
    IPC.DISCOVER_PROBE_BILIBILI_USERS,
    'query',
  ),
  [IPC.DISCOVER_PROBE_INSTAGRAM_USER]: oneString(
    IPC.DISCOVER_PROBE_INSTAGRAM_USER,
    'username',
  ),
  [IPC.ACCOUNT_STATUS]: {
    channel: IPC.ACCOUNT_STATUS,
    validateArgs: (args) => {
      assertArity(IPC.ACCOUNT_STATUS, args, 1)
      assertAccountProvider(args[0], 'provider')
      return args as IpcArgs<typeof IPC.ACCOUNT_STATUS>
    },
  },
  [IPC.ACCOUNT_LINK]: {
    channel: IPC.ACCOUNT_LINK,
    validateArgs: (args) => {
      assertArity(IPC.ACCOUNT_LINK, args, 1)
      assertAccountProvider(args[0], 'provider')
      return args as IpcArgs<typeof IPC.ACCOUNT_LINK>
    },
  },
  [IPC.ACCOUNT_UNLINK]: {
    channel: IPC.ACCOUNT_UNLINK,
    validateArgs: (args) => {
      assertArity(IPC.ACCOUNT_UNLINK, args, 1)
      assertAccountProvider(args[0], 'provider')
      return args as IpcArgs<typeof IPC.ACCOUNT_UNLINK>
    },
  },
  [IPC.ACCOUNT_SET_DISPLAY_NAME]: {
    channel: IPC.ACCOUNT_SET_DISPLAY_NAME,
    validateArgs: (args) => {
      assertArity(IPC.ACCOUNT_SET_DISPLAY_NAME, args, 2)
      assertAccountProvider(args[0], 'provider')
      assertString(args[1], 'displayName')
      return args as IpcArgs<typeof IPC.ACCOUNT_SET_DISPLAY_NAME>
    },
  },
  [IPC.ACCOUNT_BILIBILI_FOLLOWINGS]: noArgs(IPC.ACCOUNT_BILIBILI_FOLLOWINGS),
  [IPC.DATA_CLEANUP]: {
    channel: IPC.DATA_CLEANUP,
    validateArgs: (args) => {
      assertArity(IPC.DATA_CLEANUP, args, 0, 1)
      assertOptionalObject(args[0], 'options')
      return args as IpcArgs<typeof IPC.DATA_CLEANUP>
    },
  },
  [IPC.DATA_STATS]: noArgs(IPC.DATA_STATS),
  [IPC.REFRESH_LOG_LIST]: noArgs(IPC.REFRESH_LOG_LIST),
  [IPC.REFRESH_LOG_CLEAR]: noArgs(IPC.REFRESH_LOG_CLEAR),
  [IPC.VIDEO_RESOLVE]: oneString(IPC.VIDEO_RESOLVE, 'url'),
  [IPC.VIDEO_OPEN_IN_APP]: oneString(IPC.VIDEO_OPEN_IN_APP, 'url'),
  [IPC.VIDEO_YT_LOGIN]: noArgs(IPC.VIDEO_YT_LOGIN),
  [IPC.VIDEO_YT_STATUS]: noArgs(IPC.VIDEO_YT_STATUS),
  [IPC.VIDEO_YT_LOGOUT]: noArgs(IPC.VIDEO_YT_LOGOUT),
  [IPC.APP_GET_VERSION]: noArgs(IPC.APP_GET_VERSION),
  [IPC.APP_OPEN_EXTERNAL]: oneString(IPC.APP_OPEN_EXTERNAL, 'url'),
  [IPC.APP_REPORT_ERROR]: oneObject(IPC.APP_REPORT_ERROR, 'payload'),
  [IPC.APP_READ_RECENT_LOGS]: {
    channel: IPC.APP_READ_RECENT_LOGS,
    validateArgs: (args) => {
      assertArity(IPC.APP_READ_RECENT_LOGS, args, 0, 1)
      assertOptionalNumber(args[0], 'maxLines')
      return args as IpcArgs<typeof IPC.APP_READ_RECENT_LOGS>
    },
  },
  [IPC.APP_OPEN_DATA_DIRECTORY]: noArgs(IPC.APP_OPEN_DATA_DIRECTORY),
  [IPC.APP_OPEN_CACHE_DIRECTORY]: noArgs(IPC.APP_OPEN_CACHE_DIRECTORY),
  [IPC.APP_OPEN_LOGS_DIRECTORY]: noArgs(IPC.APP_OPEN_LOGS_DIRECTORY),
  [IPC.APP_CLEAR_CACHE]: noArgs(IPC.APP_CLEAR_CACHE),
  [IPC.APP_CHECK_FOR_UPDATES]: noArgs(IPC.APP_CHECK_FOR_UPDATES),
  [IPC.APP_SAVE_TEXT_FILE]: oneObject(IPC.APP_SAVE_TEXT_FILE, 'options'),
  [IPC.APP_DOWNLOAD_URL]: oneObject(IPC.APP_DOWNLOAD_URL, 'options'),
  [IPC.MENU_SHOW_CONTEXT]: {
    channel: IPC.MENU_SHOW_CONTEXT,
    validateArgs: (args) => {
      assertArity(IPC.MENU_SHOW_CONTEXT, args, 1)
      if (!Array.isArray(args[0])) {
        throw new IpcValidationError('Invalid IPC argument', {
          items: 'expected_array',
        })
      }
      return args as IpcArgs<typeof IPC.MENU_SHOW_CONTEXT>
    },
  },
  [IPC.FEVER_ACCOUNTS_LIST]: noArgs(IPC.FEVER_ACCOUNTS_LIST),
  [IPC.FEVER_ACCOUNTS_CREATE]: oneObject(IPC.FEVER_ACCOUNTS_CREATE, 'input'),
  [IPC.FEVER_ACCOUNTS_UPDATE]: {
    channel: IPC.FEVER_ACCOUNTS_UPDATE,
    validateArgs: (args) => {
      assertArity(IPC.FEVER_ACCOUNTS_UPDATE, args, 2)
      assertString(args[0], 'id')
      assertObject(args[1], 'updates')
      return args as IpcArgs<typeof IPC.FEVER_ACCOUNTS_UPDATE>
    },
  },
  [IPC.FEVER_ACCOUNTS_DELETE]: oneString(IPC.FEVER_ACCOUNTS_DELETE, 'id'),
  [IPC.FEVER_VERIFY]: {
    channel: IPC.FEVER_VERIFY,
    validateArgs: (args) => {
      assertArity(IPC.FEVER_VERIFY, args, 3)
      assertString(args[0], 'baseUrl')
      assertString(args[1], 'username')
      assertString(args[2], 'apiKey')
      return args as IpcArgs<typeof IPC.FEVER_VERIFY>
    },
  },
  [IPC.FEVER_SYNC]: oneString(IPC.FEVER_SYNC, 'accountId'),
  [IPC.FEVER_SYNC_ALL]: noArgs(IPC.FEVER_SYNC_ALL),
  [IPC.FEVER_SYNC_STATE]: oneString(IPC.FEVER_SYNC_STATE, 'accountId'),
} satisfies { [C in IpcChannel]: IpcContract<C> }

export function validateIpcArgs<C extends IpcChannel>(
  channel: C,
  args: unknown[],
): IpcArgs<C> {
  return IPC_CONTRACTS[channel].validateArgs(args) as IpcArgs<C>
}

export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === 'string' && value in IPC_CONTRACTS
}
