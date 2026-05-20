import { AIAssistantSettings, AIProviderOptionMap, HarmonySettings } from './LivoTypes'

export const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE: string =
  'You are Livo AI, a helpful assistant. Answer in concise Chinese.'

export const AI_PROVIDER_OPTIONS: AIProviderOptionMap = {
  minimax: {
    label: 'MiniMax',
    defaultBaseUrl: 'https://api.minimaxi.com/v1/',
    models: ['MiniMax-M2.7'],
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
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
  model: 'deepseek-v4-flash',
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
