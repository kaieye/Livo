import OpenAI from 'openai'
import type { AIConfig } from '../../../shared/types/index'

/**
 * Provider protocol helpers shared by every AI flow (summarize / translate /
 * chat / agent). Two concerns live here:
 *
 *   1. Format detection — given the configured provider + baseUrl, decide which
 *      wire protocol the endpoint speaks. Desktop drives all OpenAI-compatible
 *      providers through the OpenAI SDK; Anthropic's native `/v1/messages` API
 *      is a different shape, so we detect it and warn instead of silently 404ing.
 *   2. Error normalization — turn raw SDK / HTTP / network failures into short,
 *      actionable Chinese messages so the chat panel and feature cards surface a
 *      consistent voice instead of leaking stack traces.
 *
 * This mirrors the intent of Harmony's ProviderProtocol without re-implementing
 * a second transport: the OpenAI SDK already handles request shaping and
 * response parsing for the OpenAI-compatible family.
 */

export type ProviderFormat = 'anthropic' | 'openai-chat'

/** Detect the wire format an endpoint speaks from provider + baseUrl. */
export function detectProviderFormat(config: AIConfig): ProviderFormat {
  const baseUrl = (config.baseUrl || '').trim().toLowerCase()
  if (baseUrl.includes('/v1/messages') || baseUrl.includes('/anthropic/')) {
    return 'anthropic'
  }
  // A custom baseUrl that exposes the OpenAI chat route is OpenAI-compatible,
  // even for the Anthropic provider (i.e. an OpenAI-compatible gateway).
  if (
    config.provider === 'anthropic' &&
    !baseUrl.includes('/chat/completions')
  ) {
    return 'anthropic'
  }
  return 'openai-chat'
}

/**
 * Whether the active config can be driven through the OpenAI SDK. Anthropic's
 * native messages API cannot, so we flag it for a clearer error message.
 */
export function isOpenAICompatible(config: AIConfig): boolean {
  return detectProviderFormat(config) !== 'anthropic'
}

/** Whether the configured endpoint can receive OpenAI-style function tools. */
export function supportsToolCalls(config: AIConfig): boolean {
  return isOpenAICompatible(config)
}

/** Whether the configured endpoint can be attempted with chat-completion streams. */
export function supportsStreaming(config: AIConfig): boolean {
  return isOpenAICompatible(config)
}

/** Whether we should proactively request token usage metadata from the provider. */
export function supportsUsage(config: AIConfig): boolean {
  return config.provider === 'openai' && isOpenAICompatible(config)
}

interface ErrorLike {
  status?: number
  code?: string
  name?: string
  message?: string
}

function statusMessage(status: number): string | null {
  if (status === 401) return 'API Key 无效或未授权，请在「设置 > AI」中检查密钥'
  if (status === 403) return 'AI 服务拒绝访问（可能是区域、额度或权限限制）'
  if (status === 404) return '模型或接口地址不存在，请检查模型名与 Base URL'
  if (status === 408) return 'AI 服务请求超时，请稍后重试'
  if (status === 429) return 'AI 请求过于频繁或额度不足，请稍后再试'
  if (status >= 500) return 'AI 服务暂时不可用，请稍后重试'
  if (status === 400)
    return 'AI 请求被拒绝（参数或模型不被支持），请检查模型配置'
  return null
}

/**
 * Convert any thrown value into a concise, user-facing Chinese error string.
 * Non-API errors (e.g. parked-confirmation expiry) pass through unchanged.
 */
export function normalizeAIError(error: unknown, config?: AIConfig): string {
  if (config && !isOpenAICompatible(config)) {
    return 'Anthropic 原生接口暂不支持，请在「设置 > AI」中将 Base URL 指向 OpenAI 兼容网关'
  }

  const err = error as ErrorLike
  const status = typeof err?.status === 'number' ? err.status : undefined

  if (typeof status === 'number') {
    const mapped = statusMessage(status)
    if (mapped) return mapped
  }

  // Connection / timeout failures from the SDK carry no HTTP status.
  const name = err?.name || ''
  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    name.includes('Timeout')
  ) {
    return '连接 AI 服务超时，请检查网络或代理后重试'
  }
  if (
    error instanceof OpenAI.APIConnectionError ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ECONNRESET'
  ) {
    return '无法连接 AI 服务，请检查网络、Base URL 或代理设置'
  }

  if (err?.message) return err.message
  return String(error)
}
