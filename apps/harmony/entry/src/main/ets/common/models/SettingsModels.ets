export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent = 'orange' | 'blue' | 'red' | 'pink' | 'green'
export type AITargetLanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru' | 'ar'
export type AIProvider = 'minimax' | 'deepseek' | 'openai' | 'anthropic' | 'glm' | 'custom'
export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AgentPermissionSettings {
  allowRead: boolean
  allowNavigate: boolean
  allowMutate: boolean
  allowDestructive: boolean
  allowExternal: boolean
}

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
  agentPermissions: AgentPermissionSettings
}
