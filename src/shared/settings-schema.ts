import type { AIConfig } from './types/ai'
import { DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE } from './types/ai'
import type { AgentPermissionSettings } from './types/agent'
import { DEFAULT_AGENT_PERMISSION_SETTINGS } from './types/agent'
import type { AggregatorSettings } from './types/fever'
import {
  FEED_COLUMN_DEFAULTS,
  FeedViewType,
  type FeedColumnId,
} from './types/feed'

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
  | 'shortcuts'
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
  | 'fever'

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
    feedColumns: FEED_COLUMN_DEFAULTS.map((column) => ({ ...column })),
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
