import {
  AIAssistantSettings,
  AI_PROVIDER_OPTIONS,
  AIProvider,
  AIProviderDefinition,
  AITargetLanguage,
  DEFAULT_AI_ASSISTANT_SETTINGS,
  HarmonySettings,
} from '../models/LivoModels'

export interface SelectOption {
  label: string
  value: string
}

export interface ResolvedAIAssistantState {
  settings: AIAssistantSettings
  providerSelection: AIProvider
  modelSelection: string
  baseUrlDraft: string
  apiKeyDraft: string
}

export interface HarmonyAISettingsPatch {
  aiSummaryEnabled?: boolean
  aiSummaryAutoTrigger?: boolean
  aiTranslationEnabled?: boolean
  aiTranslationLanguage?: AITargetLanguage
  aiTranslationAutoTrigger?: boolean
}

export const AI_PROVIDER_ORDER: AIProvider[] = [
  'minimax',
  'deepseek',
  'openai',
  'anthropic',
  'glm',
  'custom',
]

export const TRANSLATION_LANGUAGE_OPTIONS: SelectOption[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Español', value: 'es' },
  { label: 'Русский', value: 'ru' },
  { label: 'العربية', value: 'ar' },
]

export function copyApiKeys(source: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of Object.keys(source)) {
    result[key] = source[key]
  }
  return result
}

export function normalizeAIProvider(provider: AIProvider): AIProvider {
  return AI_PROVIDER_ORDER.includes(provider) ? provider : DEFAULT_AI_ASSISTANT_SETTINGS.provider
}

export function aiProviderDefinition(provider: AIProvider): AIProviderDefinition {
  const normalizedProvider = normalizeAIProvider(provider)
  switch (normalizedProvider) {
    case 'minimax':
      return AI_PROVIDER_OPTIONS.minimax
    case 'deepseek':
      return AI_PROVIDER_OPTIONS.deepseek
    case 'openai':
      return AI_PROVIDER_OPTIONS.openai
    case 'anthropic':
      return AI_PROVIDER_OPTIONS.anthropic
    case 'glm':
      return AI_PROVIDER_OPTIONS.glm
    case 'custom':
      return AI_PROVIDER_OPTIONS.custom
    default:
      return AI_PROVIDER_OPTIONS.deepseek
  }
}

export function aiProviderOptions(): SelectOption[] {
  return AI_PROVIDER_ORDER.map((provider: AIProvider): SelectOption => ({
    label: aiProviderDefinition(provider).label,
    value: provider,
  }))
}

export function aiModelOptions(provider: AIProvider, modelSelection: string, fallbackModel: string): SelectOption[] {
  const providerConfig = aiProviderDefinition(provider)
  if (providerConfig.models.length > 0) {
    return providerConfig.models.map((model: string): SelectOption => ({
      label: model,
      value: model,
    }))
  }

  const resolvedModel = (modelSelection || fallbackModel || 'custom-model').trim() || 'custom-model'
  return [{
    label: resolvedModel,
    value: resolvedModel,
  }]
}

export function resolveNextAIModel(provider: AIProvider, currentModel: string, fallbackModel: string): string {
  const providerConfig = aiProviderDefinition(provider)
  if (providerConfig.models.length > 0) {
    return providerConfig.models[0]
  }
  const resolvedModel = (currentModel || fallbackModel || 'custom-model').trim()
  return resolvedModel || 'custom-model'
}

export function resolveAIAssistantState(settings: AIAssistantSettings): ResolvedAIAssistantState {
  const normalizedProvider = normalizeAIProvider(settings.provider)
  const providerConfig = aiProviderDefinition(normalizedProvider)
  const normalizedModel = providerConfig.models.includes(settings.model)
    ? settings.model
    : (providerConfig.models.length > 0 ? providerConfig.models[0] : settings.model)
  const resolvedBaseUrl = (settings.baseUrl || '').trim() || providerConfig.defaultBaseUrl
  const normalizedSettings: AIAssistantSettings = {
    provider: normalizedProvider,
    apiKeys: settings.apiKeys ?? {},
    baseUrl: resolvedBaseUrl,
    model: normalizedModel,
    enableSystemPrompt: settings.enableSystemPrompt,
    systemPromptTemplate: settings.systemPromptTemplate,
    chatPersonaPrompt: settings.chatPersonaPrompt,
  }

  return {
    settings: normalizedSettings,
    providerSelection: normalizedProvider,
    modelSelection: normalizedModel,
    baseUrlDraft: resolvedBaseUrl,
    apiKeyDraft: normalizedSettings.apiKeys[normalizedProvider] ?? '',
  }
}

export function patchHarmonyAISettings(settings: HarmonySettings, patch: HarmonyAISettingsPatch): HarmonySettings {
  return {
    autoRefresh: settings.autoRefresh,
    aiSummaryEnabled: patch.aiSummaryEnabled ?? settings.aiSummaryEnabled,
    aiSummaryAutoTrigger: patch.aiSummaryAutoTrigger ?? settings.aiSummaryAutoTrigger,
    aiTranslationEnabled: patch.aiTranslationEnabled ?? settings.aiTranslationEnabled,
    aiTranslationLanguage: patch.aiTranslationLanguage ?? settings.aiTranslationLanguage,
    aiTranslationAutoTrigger: patch.aiTranslationAutoTrigger ?? settings.aiTranslationAutoTrigger,
    imageProxyEnabled: settings.imageProxyEnabled,
    searchAllHomeCategories: settings.searchAllHomeCategories,
    refreshIntervalMinutes: settings.refreshIntervalMinutes,
    themeMode: settings.themeMode,
    themeAccent: settings.themeAccent,
    language: settings.language,
    remoteFeedUrl: settings.remoteFeedUrl,
    showUnreadDot: settings.showUnreadDot,
  }
}

export function translationLanguageLabel(value: AITargetLanguage): string {
  return TRANSLATION_LANGUAGE_OPTIONS.find((option: SelectOption) => option.value === value)?.label ?? value
}
