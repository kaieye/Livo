import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import type {
  AIAssistantSettings,
  AIProvider,
  AITargetLanguage,
  HarmonySettings,
  ThemeAccent,
  ThemeMode,
} from '../../../models/LivoModels'
import { AI_PROVIDER_OPTIONS } from '../../../models/LivoModels'
import { AIAssistantSettingsStore } from '../../../services/AIAssistantSettingsStore'
import { SettingsStore } from '../../../services/SettingsStore'

const AI_PROVIDER_VALUES: string[] = ['minimax', 'deepseek', 'openai', 'anthropic', 'glm', 'custom']
const LANGUAGE_VALUES: string[] = ['zh-CN', 'en']
const TRANSLATION_LANGUAGE_VALUES: string[] = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'ar']

class SanitizedAIAssistantSettings {
  provider: AIProvider = 'deepseek'
  baseUrl: string = ''
  model: string = ''
  enableSystemPrompt: boolean = false
  systemPromptTemplate: string = ''
  chatPersonaPrompt: string = ''
  apiKeyConfigured: Record<string, boolean> = {}
}

function emptyParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function themeModeParams(): AgentToolInputSchema {
  const modeParam: AgentToolParamSchema = {
    type: 'string',
    description: '主题模式',
    enum: ['dark', 'light', 'system'],
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['mode'] = modeParam
  const required: string[] = ['mode']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function accentColorParams(): AgentToolInputSchema {
  const colorParam: AgentToolParamSchema = {
    type: 'string',
    description: '强调色名称',
    enum: ['orange', 'blue', 'red', 'pink', 'green'],
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['color'] = colorParam
  const required: string[] = ['color']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function generalSettingsParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['language'] = { type: 'string', description: '界面语言', enum: LANGUAGE_VALUES }
  properties['refreshIntervalMinutes'] = { type: 'number', description: '自动刷新间隔分钟数，建议 15、30、60 或 120' }
  properties['searchAllHomeCategories'] = { type: 'boolean', description: '首页搜索是否覆盖全部栏目' }
  properties['autoRefresh'] = { type: 'boolean', description: '是否开启自动刷新' }
  properties['imageProxyEnabled'] = { type: 'boolean', description: '是否开启图片代理' }
  properties['showUnreadDot'] = { type: 'boolean', description: '是否显示未读提示点' }
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function aiFeatureSettingsParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['aiSummaryEnabled'] = { type: 'boolean', description: '是否启用 AI 摘要' }
  properties['aiSummaryAutoTrigger'] = { type: 'boolean', description: '是否自动触发 AI 摘要' }
  properties['aiTranslationEnabled'] = { type: 'boolean', description: '是否启用 AI 翻译' }
  properties['aiTranslationLanguage'] = {
    type: 'string',
    description: 'AI 翻译目标语言',
    enum: TRANSLATION_LANGUAGE_VALUES,
  }
  properties['aiTranslationAutoTrigger'] = { type: 'boolean', description: '是否自动触发 AI 翻译' }
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function aiRuntimeSettingsParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['provider'] = { type: 'string', description: 'AI 提供商，不包含 API Key', enum: AI_PROVIDER_VALUES }
  properties['model'] = { type: 'string', description: '模型名称' }
  properties['baseUrl'] = { type: 'string', description: 'Base URL，不包含 API Key' }
  properties['enableSystemPrompt'] = { type: 'boolean', description: '是否启用自定义系统提示词模板' }
  properties['systemPromptTemplate'] = { type: 'string', description: '系统提示词模板，不应包含密钥' }
  properties['chatPersonaPrompt'] = { type: 'string', description: 'AI 对话页人格提示，不应包含密钥' }
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function hasAnyArg(args: AgentToolArgs): boolean {
  return Object.keys(args).length > 0
}

function sanitizedAISettings(settings: AIAssistantSettings): SanitizedAIAssistantSettings {
  const apiKeyConfigured: Record<string, boolean> = {}
  for (const provider of AI_PROVIDER_VALUES) {
    apiKeyConfigured[provider] = (settings.apiKeys[provider] || '').trim().length > 0
  }

  const result = new SanitizedAIAssistantSettings()
  result.provider = settings.provider
  result.baseUrl = settings.baseUrl
  result.model = settings.model
  result.enableSystemPrompt = settings.enableSystemPrompt
  result.systemPromptTemplate = settings.systemPromptTemplate
  result.chatPersonaPrompt = settings.chatPersonaPrompt
  result.apiKeyConfigured = apiKeyConfigured
  return result
}

function defaultModelForProvider(provider: AIProvider, currentModel: string): string {
  if (provider === 'minimax') {
    return AI_PROVIDER_OPTIONS.minimax.models[0]
  }
  if (provider === 'deepseek') {
    return AI_PROVIDER_OPTIONS.deepseek.models[0]
  }
  if (provider === 'openai') {
    return AI_PROVIDER_OPTIONS.openai.models[0]
  }
  if (provider === 'anthropic') {
    return AI_PROVIDER_OPTIONS.anthropic.models[0]
  }
  if (provider === 'glm') {
    return AI_PROVIDER_OPTIONS.glm.models[0]
  }
  return currentModel || 'custom-model'
}

function clampRefreshInterval(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.min(1440, Math.max(1, Math.floor(value)))
}

export function buildToggleThemeModeTool(): AgentTool {
  return {
    name: 'toggle_theme_mode',
    title: '切换主题模式',
    description: '切换应用的深色模式、浅色模式或跟随系统',
    inputSchema: themeModeParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const mode = args['mode'] as ThemeMode
      const settings = await SettingsStore.default.load()
      settings.themeMode = mode
      await SettingsStore.default.save(settings)

      const modeName = mode === 'dark' ? '深色模式' : (mode === 'light' ? '浅色模式' : '跟随系统')
      return {
        status: 'success',
        message: `已切换到${modeName}`,
        data: { mode },
      }
    },
  }
}

export function buildGetSettingsTool(): AgentTool {
  return {
    name: 'get_settings',
    title: '查看设置',
    description: '查看通用设置、AI 功能设置和 AI 运行配置摘要。不会返回 API Key 等敏感字段',
    inputSchema: emptyParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => {
      const settings = await SettingsStore.default.load()
      const aiSettings = await AIAssistantSettingsStore.default.load()
      const aiSummary = sanitizedAISettings(aiSettings)
      const message =
        `通用设置：语言 ${settings.language}，刷新间隔 ${settings.refreshIntervalMinutes} 分钟，` +
        `跨栏目搜索 ${settings.searchAllHomeCategories ? '开启' : '关闭'}。\n` +
        `AI 功能：摘要 ${settings.aiSummaryEnabled ? '开启' : '关闭'}，翻译 ${settings.aiTranslationEnabled ? '开启' : '关闭'}，` +
        `翻译目标 ${settings.aiTranslationLanguage}。\n` +
        `AI 运行配置：${aiSettings.provider} / ${aiSettings.model}，API Key ${((aiSettings.apiKeys[aiSettings.provider] || '').trim()) ? '已配置' : '未配置'}。`
      return {
        status: 'success',
        message,
        data: { settings, aiSettings: aiSummary },
      }
    },
  }
}

export function buildUpdateGeneralSettingsTool(): AgentTool {
  return {
    name: 'update_general_settings',
    title: '更新通用设置',
    description: '更新界面语言、刷新间隔、跨栏目搜索、自动刷新、图片代理或未读提示点等通用设置',
    inputSchema: generalSettingsParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认更新通用设置',
    confirmationMessage: '将保存新的通用设置到本地偏好配置。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      if (!hasAnyArg(args)) {
        return { status: 'failed', message: '请至少提供一个要修改的通用设置项' }
      }

      const current = await SettingsStore.default.load()
      const next: HarmonySettings = {
        autoRefresh: typeof args['autoRefresh'] === 'boolean' ? args['autoRefresh'] as boolean : current.autoRefresh,
        aiSummaryEnabled: current.aiSummaryEnabled,
        aiSummaryAutoTrigger: current.aiSummaryAutoTrigger,
        aiTranslationEnabled: current.aiTranslationEnabled,
        aiTranslationLanguage: current.aiTranslationLanguage,
        aiTranslationAutoTrigger: current.aiTranslationAutoTrigger,
        imageProxyEnabled: typeof args['imageProxyEnabled'] === 'boolean' ? args['imageProxyEnabled'] as boolean : current.imageProxyEnabled,
        searchAllHomeCategories: typeof args['searchAllHomeCategories'] === 'boolean' ? args['searchAllHomeCategories'] as boolean : current.searchAllHomeCategories,
        refreshIntervalMinutes: typeof args['refreshIntervalMinutes'] === 'number'
          ? clampRefreshInterval(args['refreshIntervalMinutes'] as number, current.refreshIntervalMinutes)
          : current.refreshIntervalMinutes,
        themeMode: current.themeMode,
        themeAccent: current.themeAccent,
        language: typeof args['language'] === 'string' ? args['language'] as string : current.language,
        remoteFeedUrl: current.remoteFeedUrl,
        showUnreadDot: typeof args['showUnreadDot'] === 'boolean' ? args['showUnreadDot'] as boolean : current.showUnreadDot,
      }
      const saved = await SettingsStore.default.save(next)
      console.info('[SettingsAgent] update_general_settings saved')
      return {
        status: 'success',
        message: `已更新通用设置：语言 ${saved.language}，刷新间隔 ${saved.refreshIntervalMinutes} 分钟`,
        data: { settings: saved },
      }
    },
  }
}

export function buildUpdateAIFeatureSettingsTool(): AgentTool {
  return {
    name: 'update_ai_feature_settings',
    title: '更新 AI 功能设置',
    description: '更新 AI 摘要、AI 翻译和自动触发相关开关',
    inputSchema: aiFeatureSettingsParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认更新 AI 功能设置',
    confirmationMessage: '将保存 AI 摘要和翻译功能开关到本地偏好配置。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      if (!hasAnyArg(args)) {
        return { status: 'failed', message: '请至少提供一个要修改的 AI 功能设置项' }
      }

      const current = await SettingsStore.default.load()
      const next: HarmonySettings = {
        autoRefresh: current.autoRefresh,
        aiSummaryEnabled: typeof args['aiSummaryEnabled'] === 'boolean' ? args['aiSummaryEnabled'] as boolean : current.aiSummaryEnabled,
        aiSummaryAutoTrigger: typeof args['aiSummaryAutoTrigger'] === 'boolean' ? args['aiSummaryAutoTrigger'] as boolean : current.aiSummaryAutoTrigger,
        aiTranslationEnabled: typeof args['aiTranslationEnabled'] === 'boolean' ? args['aiTranslationEnabled'] as boolean : current.aiTranslationEnabled,
        aiTranslationLanguage: typeof args['aiTranslationLanguage'] === 'string'
          ? args['aiTranslationLanguage'] as AITargetLanguage
          : current.aiTranslationLanguage,
        aiTranslationAutoTrigger: typeof args['aiTranslationAutoTrigger'] === 'boolean'
          ? args['aiTranslationAutoTrigger'] as boolean
          : current.aiTranslationAutoTrigger,
        imageProxyEnabled: current.imageProxyEnabled,
        searchAllHomeCategories: current.searchAllHomeCategories,
        refreshIntervalMinutes: current.refreshIntervalMinutes,
        themeMode: current.themeMode,
        themeAccent: current.themeAccent,
        language: current.language,
        remoteFeedUrl: current.remoteFeedUrl,
        showUnreadDot: current.showUnreadDot,
      }
      const saved = await SettingsStore.default.save(next)
      console.info('[SettingsAgent] update_ai_feature_settings saved')
      return {
        status: 'success',
        message: `已更新 AI 功能设置：摘要 ${saved.aiSummaryEnabled ? '开启' : '关闭'}，翻译 ${saved.aiTranslationEnabled ? '开启' : '关闭'}`,
        data: { settings: saved },
      }
    },
  }
}

export function buildUpdateAIRuntimeSettingsTool(): AgentTool {
  return {
    name: 'update_ai_runtime_settings',
    title: '更新 AI 运行配置',
    description: '更新 AI 提供商、模型、Base URL 或提示词配置。该工具不会接收或保存 API Key',
    inputSchema: aiRuntimeSettingsParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认更新 AI 运行配置',
    confirmationMessage: '将保存 AI 提供商、模型、Base URL 或提示词配置；API Key 不会通过 Agent 工具修改。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      if (!hasAnyArg(args)) {
        return { status: 'failed', message: '请至少提供一个要修改的 AI 运行配置项' }
      }

      const current = await AIAssistantSettingsStore.default.load()
      const nextProvider = typeof args['provider'] === 'string'
        ? args['provider'] as AIProvider
        : current.provider
      const nextModel = typeof args['model'] === 'string'
        ? (args['model'] as string).trim()
        : (nextProvider !== current.provider ? defaultModelForProvider(nextProvider, current.model) : current.model)
      const next: AIAssistantSettings = {
        provider: nextProvider,
        apiKeys: current.apiKeys,
        baseUrl: typeof args['baseUrl'] === 'string' ? (args['baseUrl'] as string).trim() : current.baseUrl,
        model: nextModel,
        enableSystemPrompt: typeof args['enableSystemPrompt'] === 'boolean'
          ? args['enableSystemPrompt'] as boolean
          : current.enableSystemPrompt,
        systemPromptTemplate: typeof args['systemPromptTemplate'] === 'string'
          ? args['systemPromptTemplate'] as string
          : current.systemPromptTemplate,
        chatPersonaPrompt: typeof args['chatPersonaPrompt'] === 'string'
          ? args['chatPersonaPrompt'] as string
          : current.chatPersonaPrompt,
      }
      const saved = await AIAssistantSettingsStore.default.save(next)
      console.info('[SettingsAgent] update_ai_runtime_settings saved provider:', saved.provider)
      return {
        status: 'success',
        message: `已更新 AI 运行配置：${saved.provider} / ${saved.model}。API Key 未通过本次工具调用修改。`,
        data: { aiSettings: sanitizedAISettings(saved) },
      }
    },
  }
}

export function buildChangeAccentColorTool(): AgentTool {
  return {
    name: 'change_accent_color',
    title: '更改主题色',
    description: '调整应用的主题强调色',
    inputSchema: accentColorParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const color = args['color'] as ThemeAccent
      const settings = await SettingsStore.default.load()
      settings.themeAccent = color
      await SettingsStore.default.save(settings)

      const colorName = color === 'blue' ? '蓝色'
        : color === 'red' ? '红色'
          : color === 'pink' ? '粉色'
            : color === 'green' ? '绿色'
              : '橙色'
      return {
        status: 'success',
        message: `主题色已更改为${colorName}`,
        data: { color },
      }
    },
  }
}
