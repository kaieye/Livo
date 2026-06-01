// Shared types between main and renderer

export enum FeedViewType {
  Articles = 0,
  SocialMedia = 1,
  Videos = 2,
  Pictures = 3,
}

export interface ViewDefinition {
  id: FeedViewType
  name: string
  icon: string
  color: string
  gridMode: boolean
  wideMode: boolean
}

export const VIEW_DEFINITIONS: Record<FeedViewType, ViewDefinition> = {
  [FeedViewType.Articles]: {
    id: FeedViewType.Articles,
    name: '文章',
    icon: 'FileText',
    color: 'text-lime-600',
    gridMode: false,
    wideMode: false,
  },
  [FeedViewType.SocialMedia]: {
    id: FeedViewType.SocialMedia,
    name: '社交媒体',
    icon: 'MessageCircle',
    color: 'text-sky-500',
    gridMode: false,
    wideMode: true,
  },
  [FeedViewType.Videos]: {
    id: FeedViewType.Videos,
    name: '视频',
    icon: 'Play',
    color: 'text-red-500',
    gridMode: true,
    wideMode: true,
  },
  [FeedViewType.Pictures]: {
    id: FeedViewType.Pictures,
    name: '图片',
    icon: 'Image',
    color: 'text-pink-500',
    gridMode: true,
    wideMode: true,
  },
}

export interface Feed {
  id: string
  title: string
  url: string
  siteUrl?: string
  description?: string
  imageUrl?: string
  folder?: string
  category?: string
  view: FeedViewType
  maxEntries?: number
  showInAll?: boolean
  lastFetched?: number
  etag?: string
  lastModified?: string
  fetchSource?: 'auto' | 'direct' | 'local-agent' | 'private-aggregator'
  upstreamUrl?: string
  remoteFeedId?: string
  errorCount: number
  createdAt: number
}

export interface AggregatorSettings {
  mode: 'disabled' | 'prefer-local-agent' | 'prefer-remote' | 'remote-only'
  endpoint: string
  apiKey: string
  deviceId: string
  pollIntervalSeconds: number
  pushEnabled: boolean
  cacheRetentionDays: number
}

export interface MediaItem {
  url: string
  type: 'photo' | 'video' | 'audio'
  previewUrl?: string
  width?: number
  height?: number
  blurhash?: string
  duration?: number
}

export interface Entry {
  id: string
  feedId: string
  title: string
  url: string
  content?: string
  summary?: string
  /** 自动全文抓取保存的正文，不覆盖 RSS 原始正文。 */
  readabilityContent?: string
  readabilityTitle?: string
  readabilityExcerpt?: string
  readabilitySiteName?: string
  readabilityLength?: number
  readabilityFetchedAt?: number
  readabilityError?: string
  /** 自动生成的 AI 摘要。 */
  aiSummary?: string
  aiSummaryGeneratedAt?: number
  aiSummaryError?: string
  notifiedAt?: number
  author?: string
  authorAvatar?: string
  imageUrl?: string
  media?: MediaItem[]
  publishedAt: number
  isRead: boolean
  isStarred: boolean
  readProgress?: number
  createdAt: number
}

export interface EntryListResult {
  entries: Entry[]
  hasMore: boolean
}

export interface DiscoverFeedPreviewEntry {
  id: string
  title: string
  url: string
  summary?: string
  content?: string
  author?: string
  imageUrl?: string
  publishedAt: number
}

export interface DiscoverFeedPreview {
  targetUrl: string
  resolvedFeedUrl: string
  feedTitle: string
  siteUrl?: string
  description?: string
  imageUrl?: string
  itemCount: number
  entries: DiscoverFeedPreviewEntry[]
}

export type DiscoverFeedPreviewResult =
  | { success: true; preview: DiscoverFeedPreview }
  | { success: false; error: string }

export interface FeedWithCount extends Feed {
  unreadCount: number
}

export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AccountSessionState {
  provider: AccountProvider
  linked: boolean
  displayName?: string | null
  error?: string
}

export interface ResolvedProfileFeedCandidate {
  feedUrl: string
  title: string
  source: 'rss' | 'rsshub' | 'derived'
  siteUrl?: string
  description?: string
  view?: FeedViewType
  requiresAccount?: AccountProvider[]
  note?: string
}

export interface ResolvedProfileUrlResult {
  matched: boolean
  inputUrl: string
  normalizedUrl: string | null
  platform: 'youtube' | 'x' | 'instagram' | 'bilibili' | 'github' | null
  candidates: ResolvedProfileFeedCandidate[]
  accountStates?: AccountSessionState[]
  reason: 'invalid_url' | 'no_supported_profile_pattern' | null
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'ollama' | 'custom'
  apiKey: string
  apiKeys?: Record<string, string>
  baseUrl?: string
  model: string
  enableSystemPrompt?: boolean
  systemPromptTemplate?: string
  chatPersonaPrompt?: string
  summaryPrompt?: string
  translationPrompt?: string
}

export const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE =
  'You are Livo AI assistant. Answer in concise Chinese. Context: {{context}}. Persona: {{persona}}.'

export type FeedColumnId =
  | 'category'
  | 'type'
  | 'maxEntries'
  | 'unread'
  | 'actions'

export const FEED_COLUMN_DEFAULTS: Array<{
  id: FeedColumnId
  visible: boolean
}> = [
  { id: 'category', visible: true },
  { id: 'type', visible: true },
  { id: 'maxEntries', visible: true },
  { id: 'unread', visible: true },
  { id: 'actions', visible: true },
]

export type AgentToolCapability =
  | 'read'
  | 'navigate'
  | 'mutate'
  | 'destructive'
  | 'external'

export interface AgentPermissionSettings {
  allowRead: boolean
  allowNavigate: boolean
  allowMutate: boolean
  allowDestructive: boolean
  allowExternal: boolean
}

export const DEFAULT_AGENT_PERMISSION_SETTINGS: AgentPermissionSettings = {
  allowRead: true,
  allowNavigate: true,
  allowMutate: true,
  allowDestructive: true,
  allowExternal: true,
}

export function normalizeAgentPermissionSettings(
  permissions?: Partial<AgentPermissionSettings>,
): AgentPermissionSettings {
  return {
    allowRead:
      permissions?.allowRead ?? DEFAULT_AGENT_PERMISSION_SETTINGS.allowRead,
    allowNavigate:
      permissions?.allowNavigate ??
      DEFAULT_AGENT_PERMISSION_SETTINGS.allowNavigate,
    allowMutate:
      permissions?.allowMutate ?? DEFAULT_AGENT_PERMISSION_SETTINGS.allowMutate,
    allowDestructive:
      permissions?.allowDestructive ??
      DEFAULT_AGENT_PERMISSION_SETTINGS.allowDestructive,
    allowExternal:
      permissions?.allowExternal ??
      DEFAULT_AGENT_PERMISSION_SETTINGS.allowExternal,
  }
}

export function isAgentCapabilityAllowed(
  capability: AgentToolCapability,
  permissions?: Partial<AgentPermissionSettings>,
): boolean {
  const normalized = normalizeAgentPermissionSettings(permissions)
  switch (capability) {
    case 'read':
      return normalized.allowRead
    case 'navigate':
      return normalized.allowNavigate
    case 'mutate':
      return normalized.allowMutate
    case 'destructive':
      return normalized.allowDestructive
    case 'external':
      return normalized.allowExternal
    default:
      return false
  }
}

export interface AppSettings {
  ai: AIConfig
  agentPermissions: AgentPermissionSettings
  general: {
    language: string
    theme: 'light' | 'dark' | 'system'
    proxyMode: 'system' | 'custom'
    proxyUrl: string
    minimizeToTray: boolean
    startInTray: boolean
    refreshInterval: number
    markReadOnScroll: boolean
    fontSize: number
    contentWidth: 'narrow' | 'normal' | 'wide' | 'custom'
    customContentMaxWidth: number
    contentLineHeight: number
    uiFontFamily: string
    contentFontFamily: string
    rsshubInstance: string
    accentColor: string
    opaqueSidebar: boolean
    reduceMotion: boolean
    renderInlineStyle: boolean
    thumbnailRatio: 'square' | 'original'
    customCSS: string
    contentMaxWidth: number
    hoverMarkAsRead: boolean
    autoExpandLongSocialMedia: boolean
    dimRead: boolean
    groupByDate: boolean
    renderMarkAsRead: boolean
    imageProxy: boolean
    showRecommended: boolean
    viewTabs: Array<{ id: FeedViewType; visible: boolean }>
    feedColumns: Array<{ id: FeedColumnId; visible: boolean }>
    videoPagination: boolean
    videosPerPage: number
    bilibiliOpenInPage: boolean
  }
  data: {
    entriesPerFeed: number
    maxEntryAgeDays: number
    freshnessTTL: number
    refreshConcurrency: number
    enrichVideoDuration: boolean
    autoCleanCache: boolean
    cacheSizeLimitMB: number
    codeCacheLimitMB: number
  }
  aggregator: AggregatorSettings
  translation: {
    enabled: boolean
    targetLanguage: string
    autoTranslate: boolean
  }
  summary: {
    enabled: boolean
    autoTrigger: boolean
    language: string
  }
}

export type SettingsTabId =
  | 'general'
  | 'appearance'
  | 'reading'
  | 'subscriptions'
  | 'ai'
  | 'translation'
  | 'actions'
  | 'accounts'
  | 'data'
  | 'privacy'
  | 'about'
  | 'refreshLogs'
  | 'agentPermissions'
  | 'favorites'

export interface RefreshLogEntry {
  id: string
  refreshedAt: number
  successFeedCount: number
  failedFeedCount: number
  failedFeedTitles: string[]
}

export type AppCommandType =
  | 'open-settings'
  | 'open-search'
  | 'show-shortcuts'
  | 'refresh-all'
  | 'open-data-settings'

export interface AppCommandPayload {
  type: AppCommandType
  tab?: SettingsTabId
}

export interface AppUpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  publishedAt?: string
  notes?: string
  error?: string
}

export interface SaveTextFileOptions {
  content: string
  defaultFileName: string
  title?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface SaveTextFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface DownloadUrlOptions {
  url: string
  suggestedFileName?: string
  title?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface DownloadUrlResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface NativeContextMenuItem {
  id: string
  label?: string
  separator?: boolean
  disabled?: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: 'openai',
    apiKey: '',
    apiKeys: {},
    baseUrl: '',
    model: 'gpt-4o-mini',
    enableSystemPrompt: false,
    systemPromptTemplate: DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
    chatPersonaPrompt: '',
    summaryPrompt: '',
    translationPrompt: '',
  },
  agentPermissions: { ...DEFAULT_AGENT_PERMISSION_SETTINGS },
  general: {
    language: 'zh-CN',
    theme: 'system',
    proxyMode: 'system',
    proxyUrl: '',
    minimizeToTray: false,
    startInTray: false,
    refreshInterval: 30,
    markReadOnScroll: true,
    fontSize: 16,
    contentWidth: 'normal',
    customContentMaxWidth: 680,
    contentLineHeight: 1.75,
    uiFontFamily: 'inherit',
    contentFontFamily: 'inherit',
    rsshubInstance: 'https://rsshub.pseudoyu.com',
    accentColor: 'orange',
    opaqueSidebar: false,
    reduceMotion: false,
    renderInlineStyle: true,
    thumbnailRatio: 'square',
    customCSS: '',
    contentMaxWidth: 680,
    hoverMarkAsRead: false,
    autoExpandLongSocialMedia: false,
    dimRead: true,
    groupByDate: true,
    renderMarkAsRead: true,
    imageProxy: false,
    showRecommended: true,
    viewTabs: [
      { id: FeedViewType.Articles, visible: true },
      { id: FeedViewType.SocialMedia, visible: true },
      { id: FeedViewType.Videos, visible: true },
      { id: FeedViewType.Pictures, visible: true },
    ],
    feedColumns: [
      { id: 'category' as FeedColumnId, visible: true },
      { id: 'type' as FeedColumnId, visible: true },
      { id: 'maxEntries' as FeedColumnId, visible: true },
      { id: 'unread' as FeedColumnId, visible: true },
      { id: 'actions' as FeedColumnId, visible: true },
    ],
    videoPagination: false,
    videosPerPage: 20,
    bilibiliOpenInPage: true,
  },
  data: {
    entriesPerFeed: 128,
    maxEntryAgeDays: 90,
    freshnessTTL: 10,
    refreshConcurrency: 5,
    enrichVideoDuration: false,
    autoCleanCache: true,
    cacheSizeLimitMB: 1024,
    codeCacheLimitMB: 100,
  },
  aggregator: {
    mode: 'prefer-local-agent',
    endpoint: '',
    apiKey: '',
    deviceId: '',
    pollIntervalSeconds: 900,
    pushEnabled: false,
    cacheRetentionDays: 7,
  },
  translation: {
    enabled: false,
    targetLanguage: 'zh-CN',
    autoTranslate: false,
  },
  summary: {
    enabled: false,
    autoTrigger: false,
    language: 'zh-CN',
  },
}

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
  ENTRY_SEARCH: 'entry:search',
  AI_SUMMARIZE: 'ai:summarize',
  AI_TRANSLATE: 'ai:translate',
  AI_CHAT: 'ai:chat',
  AI_CHAT_STREAM: 'ai:chat-stream',
  AI_TEST_CONNECTION: 'ai:test-connection',
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
} as const

export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'o1-mini',
      'o1-preview',
    ],
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  },
  glm: {
    name: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      'glm-4-plus',
      'glm-4-long',
      'glm-4-flash',
      'glm-4',
      'glm-4v-plus',
      'glm-4v',
    ],
  },
  ollama: {
    name: 'MiniMax',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5', 'gemma2'],
  },
  custom: {
    name: 'Custom',
    defaultBaseUrl: '',
    models: [],
  },
} as const

export type AIProvider = keyof typeof AI_PROVIDERS

export * from './agent'
export * from './view-models'
export * from './model-mappers'
export * from './discover-data'
export * from './shortcuts'
export * from './settings'
export * from './actions'
export * from './bilibili-feed-url'
export * from './i18n-completeness'
export * from './video-url'
