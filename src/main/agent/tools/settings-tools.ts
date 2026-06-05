import { settingsProvider } from '../../services/system/settings-provider'
import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
  AppSettings,
  AIConfig,
} from '../../../shared/types'
import { AI_PROVIDERS } from '../../../shared/types'
import { applySettingsUpdate } from '../../handlers/settings-handlers'
import { emptyParams, objectParams } from './schema'
import { defineMutateTool, defineReadTool } from './factories'

const THEME_VALUES = ['light', 'dark', 'system']
const ACCENT_VALUES = [
  'orange',
  'red',
  'rose',
  'purple',
  'blue',
  'teal',
  'green',
  'yellow',
]
const LANGUAGE_VALUES = ['zh-CN', 'en']
const AI_PROVIDER_VALUES = [
  'openai',
  'anthropic',
  'deepseek',
  'glm',
  'minimax',
  'custom',
]
const TRANSLATION_LANGUAGE_VALUES = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'ru',
  'ar',
]

function hasAnyArg(args: AgentToolArgs): boolean {
  return Object.keys(args).length > 0
}

/** Strip secrets (API keys) before exposing AI config to the model. */
function sanitizeAISettings(ai: AIConfig): Record<string, unknown> {
  const apiKeyConfigured: Record<string, boolean> = {}
  for (const provider of AI_PROVIDER_VALUES) {
    apiKeyConfigured[provider] =
      ((ai.apiKeys?.[provider] || '') as string).trim().length > 0
  }
  return {
    provider: ai.provider,
    model: ai.model,
    baseUrl: ai.baseUrl || '',
    enableSystemPrompt: !!ai.enableSystemPrompt,
    apiKeyConfigured,
  }
}

function defaultModelForProvider(
  provider: string,
  currentModel: string,
): string {
  const known = AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]
  const models = known?.models as readonly string[] | undefined
  if (models && models.length > 0) return models[0]
  return currentModel || 'gpt-4o-mini'
}

function clampRefreshInterval(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(1440, Math.max(1, Math.floor(value)))
}

export function buildGetSettingsTool(): AgentTool {
  return defineReadTool({
    name: 'get_settings',
    title: '查看设置',
    description:
      '查看通用、翻译和 AI 运行配置摘要。不会返回 API Key 等敏感字段',
    inputSchema: emptyParams(),
    execute: async (): Promise<AgentToolResult> => {
      const s = settingsProvider.get()
      const message =
        `通用设置：语言 ${s.general.language}，主题 ${s.general.theme}，强调色 ${s.general.accentColor}，刷新间隔 ${s.general.refreshInterval} 分钟，图片代理 ${s.general.imageProxy ? '开启' : '关闭'}。\n` +
        `翻译：${s.translation.enabled ? '开启' : '关闭'}，目标语言 ${s.translation.targetLanguage}，自动翻译 ${s.translation.autoTranslate ? '开启' : '关闭'}。\n` +
        `AI 运行配置：${s.ai.provider} / ${s.ai.model}，API Key ${((s.ai.apiKeys?.[s.ai.provider] || s.ai.apiKey || '') as string).trim() ? '已配置' : '未配置'}。\n` +
        `Agent 权限：读取 ${s.agentPermissions.allowRead ? '开' : '关'}，导航 ${s.agentPermissions.allowNavigate ? '开' : '关'}，写入 ${s.agentPermissions.allowMutate ? '开' : '关'}，破坏性 ${s.agentPermissions.allowDestructive ? '开' : '关'}，外部 ${s.agentPermissions.allowExternal ? '开' : '关'}。`
      return {
        status: 'success',
        message,
        data: {
          general: s.general as unknown as object,
          translation: s.translation as unknown as object,
          ai: sanitizeAISettings(s.ai),
          agentPermissions: s.agentPermissions as unknown as object,
        },
      }
    },
  })
}

export function buildToggleThemeModeTool(): AgentTool {
  return defineMutateTool({
    name: 'toggle_theme_mode',
    title: '切换主题模式',
    description: '切换应用的深色模式、浅色模式或跟随系统',
    inputSchema: objectParams(
      { mode: { type: 'string', description: '主题模式', enum: THEME_VALUES } },
      ['mode'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const mode = args['mode'] as AppSettings['general']['theme']
      await applySettingsUpdate({
        general: { ...settingsProvider.get().general, theme: mode },
      })
      const label =
        mode === 'dark'
          ? '深色模式'
          : mode === 'light'
            ? '浅色模式'
            : '跟随系统'
      return { status: 'success', message: `已切换到${label}`, data: { mode } }
    },
  })
}

export function buildChangeAccentColorTool(): AgentTool {
  return defineMutateTool({
    name: 'change_accent_color',
    title: '更改强调色',
    description: '调整应用的主题强调色',
    inputSchema: objectParams(
      {
        color: {
          type: 'string',
          description: '强调色名称',
          enum: ACCENT_VALUES,
        },
      },
      ['color'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const color = String(args['color'])
      await applySettingsUpdate({
        general: { ...settingsProvider.get().general, accentColor: color },
      })
      return {
        status: 'success',
        message: `强调色已更改为 ${color}`,
        data: { color },
      }
    },
  })
}

export function buildUpdateGeneralSettingsTool(): AgentTool {
  return defineMutateTool({
    name: 'update_general_settings',
    title: '更新通用设置',
    description: '更新界面语言、刷新间隔或图片代理等通用设置',
    inputSchema: objectParams({
      language: {
        type: 'string',
        description: '界面语言',
        enum: LANGUAGE_VALUES,
      },
      refreshInterval: {
        type: 'number',
        description: '自动刷新间隔分钟数，建议 15、30、60 或 120',
      },
      imageProxy: { type: 'boolean', description: '是否开启图片代理' },
    }),
    confirmationTitle: '确认更新通用设置',
    confirmationMessage: '将保存新的通用设置到本地偏好配置。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      if (!hasAnyArg(args)) {
        return { status: 'failed', message: '请至少提供一个要修改的通用设置项' }
      }
      const current = settingsProvider.get().general
      const next = {
        ...current,
        language:
          typeof args['language'] === 'string'
            ? (args['language'] as string)
            : current.language,
        refreshInterval:
          typeof args['refreshInterval'] === 'number'
            ? clampRefreshInterval(
                args['refreshInterval'] as number,
                current.refreshInterval,
              )
            : current.refreshInterval,
        imageProxy:
          typeof args['imageProxy'] === 'boolean'
            ? (args['imageProxy'] as boolean)
            : current.imageProxy,
      }
      const saved = await applySettingsUpdate({ general: next })
      return {
        status: 'success',
        message: `已更新通用设置：语言 ${saved.general.language}，刷新间隔 ${saved.general.refreshInterval} 分钟`,
        data: { general: saved.general as unknown as object },
      }
    },
  })
}

export function buildUpdateTranslationSettingsTool(): AgentTool {
  return defineMutateTool({
    name: 'update_translation_settings',
    title: '更新翻译设置',
    description: '更新 AI 翻译开关、目标语言和自动翻译开关',
    inputSchema: objectParams({
      enabled: { type: 'boolean', description: '是否启用 AI 翻译' },
      targetLanguage: {
        type: 'string',
        description: '翻译目标语言',
        enum: TRANSLATION_LANGUAGE_VALUES,
      },
      autoTranslate: { type: 'boolean', description: '是否自动翻译' },
    }),
    confirmationTitle: '确认更新翻译设置',
    confirmationMessage: '将保存翻译功能开关到本地偏好配置。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      if (!hasAnyArg(args)) {
        return { status: 'failed', message: '请至少提供一个要修改的翻译设置项' }
      }
      const current = settingsProvider.get().translation
      const next = {
        ...current,
        enabled:
          typeof args['enabled'] === 'boolean'
            ? (args['enabled'] as boolean)
            : current.enabled,
        targetLanguage:
          typeof args['targetLanguage'] === 'string'
            ? (args['targetLanguage'] as string)
            : current.targetLanguage,
        autoTranslate:
          typeof args['autoTranslate'] === 'boolean'
            ? (args['autoTranslate'] as boolean)
            : current.autoTranslate,
      }
      const saved = await applySettingsUpdate({ translation: next })
      return {
        status: 'success',
        message: `已更新翻译设置：翻译 ${saved.translation.enabled ? '开启' : '关闭'}，目标语言 ${saved.translation.targetLanguage}`,
        data: { translation: saved.translation as unknown as object },
      }
    },
  })
}

export function buildUpdateAIRuntimeSettingsTool(): AgentTool {
  return defineMutateTool({
    name: 'update_ai_runtime_settings',
    title: '更新 AI 运行配置',
    description:
      '更新 AI 提供商、模型、Base URL 或提示词配置。该工具不会接收或保存 API Key',
    inputSchema: objectParams({
      provider: {
        type: 'string',
        description: 'AI 提供商，不包含 API Key',
        enum: AI_PROVIDER_VALUES,
      },
      model: { type: 'string', description: '模型名称' },
      baseUrl: { type: 'string', description: 'Base URL，不包含 API Key' },
      enableSystemPrompt: {
        type: 'boolean',
        description: '是否启用自定义系统提示词模板',
      },
      systemPromptTemplate: {
        type: 'string',
        description: '系统提示词模板，不应包含密钥',
      },
      chatPersonaPrompt: {
        type: 'string',
        description: 'AI 对话人格提示，不应包含密钥',
      },
    }),
    confirmationTitle: '确认更新 AI 运行配置',
    confirmationMessage:
      '将保存 AI 提供商、模型、Base URL 或提示词配置；API Key 不会通过 Agent 工具修改。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      if (!hasAnyArg(args)) {
        return {
          status: 'failed',
          message: '请至少提供一个要修改的 AI 运行配置项',
        }
      }
      const current = settingsProvider.get().ai
      const nextProvider = (
        typeof args['provider'] === 'string'
          ? (args['provider'] as string)
          : current.provider
      ) as AIConfig['provider']
      const nextModel =
        typeof args['model'] === 'string'
          ? (args['model'] as string).trim()
          : nextProvider !== current.provider
            ? defaultModelForProvider(nextProvider, current.model)
            : current.model
      // Keep apiKey mirrored to the (remembered) key of the active provider.
      const nextApiKey = (current.apiKeys?.[nextProvider] ||
        current.apiKey ||
        '') as string
      const next: AIConfig = {
        ...current,
        provider: nextProvider,
        model: nextModel,
        apiKey: nextApiKey,
        baseUrl:
          typeof args['baseUrl'] === 'string'
            ? (args['baseUrl'] as string).trim()
            : current.baseUrl,
        enableSystemPrompt:
          typeof args['enableSystemPrompt'] === 'boolean'
            ? (args['enableSystemPrompt'] as boolean)
            : current.enableSystemPrompt,
        systemPromptTemplate:
          typeof args['systemPromptTemplate'] === 'string'
            ? (args['systemPromptTemplate'] as string)
            : current.systemPromptTemplate,
        chatPersonaPrompt:
          typeof args['chatPersonaPrompt'] === 'string'
            ? (args['chatPersonaPrompt'] as string)
            : current.chatPersonaPrompt,
      }
      const saved = await applySettingsUpdate({ ai: next })
      return {
        status: 'success',
        message: `已更新 AI 运行配置：${saved.ai.provider} / ${saved.ai.model}。API Key 未通过本次工具调用修改。`,
        data: { ai: sanitizeAISettings(saved.ai) },
      }
    },
  })
}
