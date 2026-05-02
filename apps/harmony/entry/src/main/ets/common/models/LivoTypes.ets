export enum FeedViewType {
  Articles = 0,
  SocialMedia = 1,
  Videos = 2,
  Pictures = 3,
}

export interface ViewDefinition {
  id: FeedViewType
  label: string
  badgeColor: string
  accentColor: string
}

export interface Feed {
  id: string
  title: string
  url: string
  siteUrl?: string
  imageUrl?: string
  description?: string
  category?: string
  view: FeedViewType
  showInAll: boolean
  lastFetched?: number
  etag?: string
  lastModified?: string
  errorCount: number
  createdAt: number
  updatedAt: number
}

export interface Entry {
  id: string
  feedId: string
  title: string
  url: string
  summary: string
  content: string
  author: string
  publishedAt: number
  readingTimeMinutes: number
  tags: string[]
  mediaUrls?: string[]
  isRead: boolean
  isStarred: boolean
  createdAt: number
  updatedAt: number
}

export interface FeedWithCount extends Feed {
  unreadCount: number
}

export interface DashboardMetric {
  label: string
  value: string
  hint: string
}

export interface FeedCardModel {
  id: string
  title: string
  description: string
  category: string
  url: string
  siteUrl: string
  imageUrl: string
  unreadLabel: string
  unreadCount: number
  viewLabel: string
  viewBadgeColor: string
  accentColor: string
}

export interface EntryCardModel {
  id: string
  feedId: string
  title: string
  summary: string
  content: string
  imageUrl: string
  feedImageUrl: string
  author: string
  articleUrl: string
  publishedAt: number
  publishedLabel: string
  readingLabel: string
  tags: string[]
  mediaUrls?: string[]
  rawMediaUrls?: string[]
  feedTitle: string
  feedCategory: string
  viewLabel: string
  viewBadgeColor: string
  hasVideoMedia: boolean
  isRead: boolean
  isStarred: boolean
}

export interface ArticleDetailModel extends EntryCardModel {
  contentParagraphs: string[]
  contentBlocks: ArticleContentBlock[]
  articleUrl: string
  siteUrl: string
}

export interface ArticleContentBlock {
  id: string
  type: 'paragraph' | 'image' | 'video'
  text: string
  imageUrl: string
  videoUrl: string
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent = 'orange' | 'blue' | 'red' | 'pink' | 'green'
export type AITargetLanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru' | 'ar'
export type AIProvider = 'minimax' | 'deepseek' | 'openai' | 'anthropic' | 'glm' | 'custom'
export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface HarmonySettings {
  autoRefresh: boolean
  aiSummaryEnabled: boolean
  aiSummaryAutoTrigger: boolean
  aiTranslationEnabled: boolean
  aiTranslationLanguage: AITargetLanguage
  aiTranslationAutoTrigger: boolean
  imageProxyEnabled: boolean
  searchAllHomeCategories: boolean
  refreshIntervalMinutes: number
  themeMode: ThemeMode
  themeAccent: ThemeAccent
  language: string
  remoteFeedUrl: string
  showUnreadDot: boolean
}

export interface AIProviderDefinition {
  label: string
  defaultBaseUrl: string
  models: string[]
}

export interface AIProviderOptionMap {
  minimax: AIProviderDefinition
  deepseek: AIProviderDefinition
  openai: AIProviderDefinition
  anthropic: AIProviderDefinition
  glm: AIProviderDefinition
  custom: AIProviderDefinition
}

export interface AIAssistantSettings {
  provider: AIProvider
  apiKeys: Record<string, string>
  baseUrl: string
  model: string
  enableSystemPrompt: boolean
  systemPromptTemplate: string
  chatPersonaPrompt: string
}

export interface RemoteFeedResult {
  entries: EntryCardModel[]
  sourceLabel: string
  newEntriesCount?: number
  failedFeedCount?: number
  failedFeedLabels?: string[]
  failedFeedDetails?: string[]
  skippedByCooldown?: boolean
  skippedFeedCount?: number
  allSkippedByCooldown?: boolean
  fallbackUsed: boolean
}

export interface RefreshLogEntry {
  id: string
  refreshedAt: number
  successFeedCount: number
  failedFeedCount: number
  failedFeedTitles: string[]
}

export interface AccountStatusResult {
  provider: AccountProvider
  linked: boolean
  displayName: string
  error: string
}

export interface AccountSelfCheckRow {
  name: string
  pass: boolean
  detail: string
}

export interface AccountSelfCheckResult {
  summary: string
  rows: AccountSelfCheckRow[]
}

export interface PendingBilibiliCreator {
  mid: number
  uname: string
  exists: boolean
}

export interface BilibiliImportProgress {
  total: number
  completed: number
  imported: number
  skipped: number
  failed: number
}

export const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE: string =
  'You are Livo AI assistant. Answer in concise Chinese. Context: {{context}}. Persona: {{persona}}.'

export const AI_PROVIDER_OPTIONS: AIProviderOptionMap = {
  minimax: {
    label: 'MiniMax',
    defaultBaseUrl: 'https://api.minimaxi.com/v1/',
    models: ['MiniMax-M2.7'],
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.4', 'gpt-5.4-mini'],
  },
  anthropic: {
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  glm: {
    label: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['GLM-5.1', 'GLM-5'],
  },
  custom: {
    label: '自定义',
    defaultBaseUrl: '',
    models: [],
  },
}

export const DEFAULT_AI_ASSISTANT_SETTINGS: AIAssistantSettings = {
  provider: 'deepseek',
  apiKeys: {},
  baseUrl: '',
  model: 'deepseek-chat',
  enableSystemPrompt: false,
  systemPromptTemplate: DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  chatPersonaPrompt: '',
}

export const DEFAULT_HARMONY_SETTINGS: HarmonySettings = {
  autoRefresh: false,
  aiSummaryEnabled: true,
  aiSummaryAutoTrigger: false,
  aiTranslationEnabled: false,
  aiTranslationLanguage: 'zh-CN',
  aiTranslationAutoTrigger: false,
  imageProxyEnabled: false,
  searchAllHomeCategories: true,
  refreshIntervalMinutes: 30,
  themeMode: 'system',
  themeAccent: 'pink',
  language: 'zh-CN',
  remoteFeedUrl: 'https://sspai.com/feed',
  showUnreadDot: true,
}
