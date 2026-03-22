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
    name: "鏂囩珷",
    icon: "FileText",
    color: "text-lime-600",
    gridMode: false,
    wideMode: false,
  },
  [FeedViewType.SocialMedia]: {
    id: FeedViewType.SocialMedia,
    name: "社交媒体",
    icon: "MessageCircle",
    color: "text-sky-500",
    gridMode: false,
    wideMode: true,
  },
  [FeedViewType.Videos]: {
    id: FeedViewType.Videos,
    name: "瑙嗛",
    icon: "Play",
    color: "text-red-500",
    gridMode: true,
    wideMode: true,
  },
  [FeedViewType.Pictures]: {
    id: FeedViewType.Pictures,
    name: "鍥剧墖",
    icon: "Image",
    color: "text-pink-500",
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
  fetchSource?: "auto" | "direct" | "local-agent" | "private-aggregator"
  upstreamUrl?: string
  remoteFeedId?: string
  errorCount: number
  createdAt: number
}

export interface AggregatorSettings {
  mode: "disabled" | "prefer-local-agent" | "prefer-remote" | "remote-only"
  endpoint: string
  apiKey: string
  deviceId: string
  pollIntervalSeconds: number
  pushEnabled: boolean
  cacheRetentionDays: number
}

export interface MediaItem {
  url: string
  type: "photo" | "video" | "audio"
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
  author?: string
  authorAvatar?: string
  imageUrl?: string
  media?: MediaItem[]
  publishedAt: number
  isRead: boolean
  isStarred: boolean
  createdAt: number
}

export interface FeedWithCount extends Feed {
  unreadCount: number
}

export type AccountProvider = "youtube" | "x" | "instagram" | "bilibili"

export interface AccountSessionState {
  provider: AccountProvider
  linked: boolean
  displayName?: string | null
  error?: string
}

export interface ResolvedProfileFeedCandidate {
  feedUrl: string
  title: string
  source: "rss" | "rsshub" | "derived"
  siteUrl?: string
  description?: string
  view?: FeedViewType
  requiresAccount?: AccountProvider[]
  /** Optional note to display to user (e.g., limitation warnings) */
  note?: string
}

export interface ResolvedProfileUrlResult {
  matched: boolean
  inputUrl: string
  normalizedUrl: string | null
  platform: "youtube" | "x" | "instagram" | "bilibili" | "github" | null
  candidates: ResolvedProfileFeedCandidate[]
  accountStates?: AccountSessionState[]
  reason: "invalid_url" | "no_supported_profile_pattern" | null
}

export interface AIConfig {
  provider: "openai" | "anthropic" | "deepseek" | "glm" | "ollama" | "custom"
  apiKey: string
  baseUrl?: string
  model: string
  enableSystemPrompt?: boolean
  systemPromptTemplate?: string
  chatPersonaPrompt?: string
}

export const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE =
  "You are Livo AI assistant. Answer in concise Chinese. Context: {{context}}. Persona: {{persona}}."

export type FeedColumnId = "category" | "type" | "maxEntries" | "unread" | "actions"

export const FEED_COLUMN_DEFAULTS: Array<{ id: FeedColumnId; visible: boolean }> = [
  { id: "category", visible: true },
  { id: "type", visible: true },
  { id: "maxEntries", visible: true },
  { id: "unread", visible: true },
  { id: "actions", visible: true },
]

export interface AppSettings {
  ai: AIConfig
  general: {
    language: string
    theme: "light" | "dark" | "system"
    refreshInterval: number
    markReadOnScroll: boolean
    fontSize: number
    contentWidth: "narrow" | "normal" | "wide" | "custom"
    customContentMaxWidth: number
    contentLineHeight: number
    uiFontFamily: string
    contentFontFamily: string
    rsshubInstance: string
    accentColor: string
    opaqueSidebar: boolean
    reduceMotion: boolean
    renderInlineStyle: boolean
    thumbnailRatio: "square" | "original"
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
  }
  aggregator: AggregatorSettings
  translation: {
    enabled: boolean
    targetLanguage: string
    autoTranslate: boolean
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o-mini",
    enableSystemPrompt: false,
    systemPromptTemplate: DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
    chatPersonaPrompt: "",
  },
  general: {
    language: "zh-CN",
    theme: "system",
    refreshInterval: 30,
    markReadOnScroll: true,
    fontSize: 16,
    contentWidth: "normal",
    customContentMaxWidth: 680,
    contentLineHeight: 1.75,
    uiFontFamily: "inherit",
    contentFontFamily: "inherit",
    rsshubInstance: "https://rsshub.pseudoyu.com",
    accentColor: "orange",
    opaqueSidebar: false,
    reduceMotion: false,
    renderInlineStyle: true,
    thumbnailRatio: "square",
    customCSS: "",
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
      { id: "category" as FeedColumnId, visible: true },
      { id: "type" as FeedColumnId, visible: true },
      { id: "maxEntries" as FeedColumnId, visible: true },
      { id: "unread" as FeedColumnId, visible: true },
      { id: "actions" as FeedColumnId, visible: true },
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
  },
  aggregator: {
    mode: "prefer-local-agent",
    endpoint: "",
    apiKey: "",
    deviceId: "",
    pollIntervalSeconds: 900,
    pushEnabled: false,
    cacheRetentionDays: 7,
  },
  translation: {
    enabled: false,
    targetLanguage: "zh-CN",
    autoTranslate: false,
  },
}

export const IPC = {
  FEED_ADD: "feed:add",
  FEED_REMOVE: "feed:remove",
  FEED_LIST: "feed:list",
  FEED_REFRESH: "feed:refresh",
  FEED_REFRESH_ALL: "feed:refresh-all",
  FEED_UPDATE: "feed:update",
  FEED_IMPORT_OPML: "feed:import-opml",
  FEED_EXPORT_OPML: "feed:export-opml",

  ENTRY_LIST: "entry:list",
  ENTRY_GET: "entry:get",
  ENTRY_MARK_READ: "entry:mark-read",
  ENTRY_MARK_ALL_READ: "entry:mark-all-read",
  ENTRY_TOGGLE_STAR: "entry:toggle-star",
  ENTRY_SEARCH: "entry:search",

  AI_SUMMARIZE: "ai:summarize",
  AI_TRANSLATE: "ai:translate",
  AI_CHAT: "ai:chat",
  AI_CHAT_STREAM: "ai:chat-stream",

  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",

  READABILITY_FETCH: "readability:fetch",

  DISCOVER_CATEGORIES: "discover:categories",
  DISCOVER_POPULAR: "discover:popular",
  DISCOVER_SEARCH: "discover:search",
  DISCOVER_RSSHUB_ROUTES: "discover:rsshub-routes",
  DISCOVER_RSSHUB_INSTANCE: "discover:rsshub-instance",
  DISCOVER_VALIDATE_FEED: "discover:validate-feed",
  DISCOVER_RESOLVE_PROFILE_URL: "discover:resolve-profile-url",

  ACCOUNT_STATUS: "account:status",
  ACCOUNT_LINK: "account:link",
  ACCOUNT_UNLINK: "account:unlink",
  ACCOUNT_SET_DISPLAY_NAME: "account:set-display-name",
  ACCOUNT_BILIBILI_FOLLOWINGS: "account:bilibili-followings",

  DATA_CLEANUP: "data:cleanup",
  DATA_STATS: "data:stats",

  VIDEO_RESOLVE: "video:resolve",
  VIDEO_OPEN_IN_APP: "video:open-in-app",
  VIDEO_YT_LOGIN: "video:yt-login",
  VIDEO_YT_STATUS: "video:yt-status",
  VIDEO_YT_LOGOUT: "video:yt-logout",

  APP_GET_VERSION: "app:version",
  APP_OPEN_EXTERNAL: "app:open-external",
} as const

export const AI_PROVIDERS = {
  openai: {
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-mini", "o1-preview"],
  },
  anthropic: {
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  },
  deepseek: {
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
  },
  glm: {
    name: "GLM",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-plus", "glm-4-long", "glm-4-flash", "glm-4", "glm-4v-plus", "glm-4v"],
  },
  ollama: {
    name: "MiniMax",
    defaultBaseUrl: "http://localhost:11434/v1",
    models: ["llama3.2", "llama3.1", "mistral", "qwen2.5", "gemma2"],
  },
  custom: {
    name: "Custom",
    defaultBaseUrl: "",
    models: [],
  },
} as const

export type AIProvider = keyof typeof AI_PROVIDERS
