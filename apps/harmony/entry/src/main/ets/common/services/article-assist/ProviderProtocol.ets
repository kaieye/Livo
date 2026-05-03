/**
 * Provider-protocol adapter: knows how each AI provider expects its requests.
 *
 * Three concerns live here:
 *   1. Endpoint resolution — given user-supplied baseUrl + provider, derive the
 *      concrete completion URL (and detect whether it's an Anthropic-format
 *      proxy or MiniMax text-completion endpoint).
 *   2. Request body shaping — OpenAI-style chat, Anthropic messages, MiniMax
 *      text/chatcompletion_v2; each has a slightly different schema.
 *   3. System-prompt resolution — substitute {{context}} / {{persona}} placeholders.
 *
 * The connection-test flow consumes the lower-level entry points
 * (`resolveCompletionEndpointFor`, `detectProviderFormat`, `miniMaxTextEndpoint`,
 * `buildRequestHeaders`) directly, since it works from raw provider/baseUrl
 * fields rather than a full `AIAssistantSettings` snapshot.
 */

import {
  AIAssistantSettings,
  AIProvider,
  AIProviderDefinition,
  AI_PROVIDER_OPTIONS,
} from '../../models/LivoModels'

interface ChatMessage {
  role: string
  content: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  max_tokens: number
}

interface AnthropicTextInputBlock {
  type: string
  text: string
}

interface AnthropicMessageRequest {
  role: string
  content: string | AnthropicTextInputBlock[]
}

interface AnthropicRequest {
  model: string
  messages: AnthropicMessageRequest[]
  max_tokens: number
  system?: string
}

interface MiniMaxTextRequest {
  model: string
  messages: ChatMessage[]
  max_completion_tokens: number
}

export interface ProviderRequestContext {
  endpoint: string
  format: ProviderFormat
  apiKey: string
  model: string
  systemPrompt: string
  userContent: string
  maxTokens: number
}

export type ProviderFormat = 'anthropic' | 'minimax-text' | 'openai-chat'

export function resolveCompletionEndpoint(aiSettings: AIAssistantSettings): string {
  const providerConfig = providerDefinition(aiSettings.provider)
  const baseUrl = (aiSettings.baseUrl || providerConfig.defaultBaseUrl || '').trim()
  if (!baseUrl) {
    throw new Error('请先在 设置 > AI助手 中配置 Base URL')
  }
  return resolveCompletionEndpointFor(aiSettings.provider, baseUrl)
}

export function resolveCompletionEndpointFor(provider: AIProvider, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim()
  const normalized = trimmed.toLowerCase()
  if (
    normalized.includes('/chat/completions')
    || normalized.includes('/text/chatcompletion_v2')
    || normalized.includes('/v1/messages')
    || normalized.includes('/anthropic/')
  ) {
    return trimmed
  }
  if (provider === 'anthropic') {
    return joinBaseUrl(trimmed, '/messages')
  }
  if (provider === 'minimax') {
    return joinBaseUrl(trimmed, '/text/chatcompletion_v2')
  }
  return joinBaseUrl(trimmed, '/chat/completions')
}

export function resolveProviderApiKey(aiSettings: AIAssistantSettings): string {
  const apiKey = (aiSettings.apiKeys[aiSettings.provider] ?? '').trim()
  if (!apiKey) {
    throw new Error('请先在 设置 > AI助手 中填写当前提供商 API Key')
  }
  return apiKey
}

export function detectProviderFormat(provider: AIProvider, endpoint: string): ProviderFormat {
  if (provider === 'minimax' && endpoint.includes('/anthropic/')) {
    return 'anthropic'
  }
  if (provider === 'minimax' && endpoint.includes('/text/chatcompletion_v2')) {
    return 'minimax-text'
  }
  if (provider === 'anthropic') {
    return 'anthropic'
  }
  return 'openai-chat'
}

export function miniMaxTextEndpoint(endpoint: string): string {
  const normalized = (endpoint || '').trim().replace(/\/+$/, '')
  if (normalized.includes('/text/chatcompletion_v2')) {
    return normalized
  }
  if (normalized.endsWith('/chat/completions')) {
    return normalized.replace(/\/chat\/completions$/, '/text/chatcompletion_v2')
  }
  return `${normalized}/text/chatcompletion_v2`
}

export function buildRequestHeaders(apiKey: string, format: ProviderFormat): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (format === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  }
  return headers
}

export function buildRequestBody(context: ProviderRequestContext): string {
  switch (context.format) {
    case 'anthropic':
      return buildAnthropicBody(context)
    case 'minimax-text':
      return buildMiniMaxTextBody(context)
    case 'openai-chat':
    default:
      return buildOpenAiChatBody(context)
  }
}

export function resolveSystemPrompt(
  aiSettings: AIAssistantSettings,
  context: string,
): string {
  const persona = (aiSettings.chatPersonaPrompt || '').trim()
  if (!aiSettings.enableSystemPrompt) {
    return persona ? `Persona: ${persona}` : ''
  }
  return (aiSettings.systemPromptTemplate || '')
    .replace(/\{\{context\}\}/g, context)
    .replace(/\{\{persona\}\}/g, persona)
    .trim()
}

function buildAnthropicBody(context: ProviderRequestContext): string {
  const messages: AnthropicMessageRequest[] = [{
    role: 'user',
    content: [{ type: 'text', text: context.userContent }],
  }]
  const body: AnthropicRequest = {
    model: context.model,
    messages,
    max_tokens: context.maxTokens,
  }
  if (context.systemPrompt) {
    body.system = context.systemPrompt
  }
  return JSON.stringify(body)
}

function buildMiniMaxTextBody(context: ProviderRequestContext): string {
  const messages: ChatMessage[] = []
  if (context.systemPrompt) {
    messages.push({ role: 'system', content: context.systemPrompt })
  }
  messages.push({ role: 'user', content: context.userContent })
  const body: MiniMaxTextRequest = {
    model: context.model,
    messages,
    max_completion_tokens: context.maxTokens,
  }
  return JSON.stringify(body)
}

function buildOpenAiChatBody(context: ProviderRequestContext): string {
  const messages: ChatMessage[] = []
  if (context.systemPrompt) {
    messages.push({ role: 'system', content: context.systemPrompt })
  }
  messages.push({ role: 'user', content: context.userContent })
  const body: ChatRequest = {
    model: context.model,
    messages,
    max_tokens: context.maxTokens,
  }
  return JSON.stringify(body)
}

function providerDefinition(provider: AIProvider): AIProviderDefinition {
  switch (provider) {
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

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = (baseUrl || '').trim().replace(/\/+$/, '')
  return `${normalizedBase}${path}`
}
