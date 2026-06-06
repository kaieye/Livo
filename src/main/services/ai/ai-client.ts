import OpenAI from 'openai'
import type { AIConfig } from '../../../shared/types/index'
import { resolveOpenAICompatibleBaseUrl } from '../../../shared/ai-endpoint'

/** Resolve the effective base URL for a provider, honoring explicit overrides. */
export function resolveBaseUrl(config: AIConfig): string {
  const explicitBaseUrl = (config.baseUrl || '').trim()
  if (explicitBaseUrl) return resolveOpenAICompatibleBaseUrl(explicitBaseUrl)

  let defaultBaseUrl: string
  switch (config.provider) {
    case 'openai':
      defaultBaseUrl = 'https://api.openai.com/v1'
      break
    case 'anthropic':
      defaultBaseUrl = 'https://api.anthropic.com/v1'
      break
    case 'deepseek':
      defaultBaseUrl = 'https://api.deepseek.com/v1'
      break
    case 'glm':
      defaultBaseUrl = 'https://open.bigmodel.cn/api/paas/v4'
      break
    case 'minimax':
      defaultBaseUrl = 'https://api.minimax.chat/v1'
      break
    default:
      defaultBaseUrl = 'https://api.openai.com/v1'
  }
  return resolveOpenAICompatibleBaseUrl(defaultBaseUrl)
}

export function createOpenAIClient(config: AIConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: resolveBaseUrl(config),
  })
}

/** Returns an error message string when the config is unusable, otherwise null. */
export function validateAIConfig(config: AIConfig): string | null {
  const apiKey = (config.apiKey || '').trim()
  const model = (config.model || '').trim()
  const baseUrl = (config.baseUrl || '').trim()

  if (!apiKey) {
    return '请先在设置中配置 AI API Key'
  }
  if (!model) {
    return '请先配置 AI 模型'
  }
  if (config.provider === 'custom') {
    if (!baseUrl) return 'Custom provider requires API base URL'
    if (!apiKey) return 'Custom provider requires API Key'
    if (!model) return 'Custom provider requires model'
  }
  return null
}
