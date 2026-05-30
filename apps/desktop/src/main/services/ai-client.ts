import OpenAI from 'openai'
import type { AIConfig } from '../../shared/types'

/** Resolve the effective base URL for a provider, honoring explicit overrides. */
export function resolveBaseUrl(config: AIConfig): string {
  if (config.baseUrl) return config.baseUrl
  switch (config.provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'anthropic':
      return 'https://api.anthropic.com/v1'
    case 'deepseek':
      return 'https://api.deepseek.com/v1'
    case 'glm':
      return 'https://open.bigmodel.cn/api/paas/v4'
    case 'ollama':
      return 'http://localhost:11434/v1'
    default:
      return 'https://api.openai.com/v1'
  }
}

export function createOpenAIClient(config: AIConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey || 'ollama', // ollama doesn't require a key
    baseURL: resolveBaseUrl(config),
  })
}

/** Returns an error message string when the config is unusable, otherwise null. */
export function validateAIConfig(config: AIConfig): string | null {
  const apiKey = (config.apiKey || '').trim()
  const model = (config.model || '').trim()
  const baseUrl = (config.baseUrl || '').trim()

  if (config.provider !== 'ollama' && !apiKey) {
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
