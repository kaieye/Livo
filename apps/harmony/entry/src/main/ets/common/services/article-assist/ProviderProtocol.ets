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
import { ChatMessage as ChatHistoryMessage } from '../ChatHistoryStore'
import type {
  AgentToolDefinition,
  AgentToolInputSchema,
} from '../../agent/AgentTypes.ts'
import type { ExtractedToolFunction } from './ProviderResponseParser'

interface ChatMessage {
  role: string
  content: string | null
  tool_calls?: ChatToolCallMessage[]
  tool_call_id?: string
  name?: string
  reasoning_content?: string
}

export interface ChatToolCallMessage {
  id: string
  type: string
  function: ExtractedToolFunction
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ChatToolCallMessage[]
  tool_call_id?: string
  name?: string
  reasoning_content?: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  max_tokens: number
  tools?: AgentToolDefinition[]
  tool_choice?: string
}

interface AnthropicToolBlock {
  type: string
  id?: string
  name?: string
  input?: Record<string, Object>
  text?: string
  tool_use_id?: string
}

interface AnthropicTextBlock {
  type: string
  text: string
}

interface AnthropicToolSchema {
  name: string
  description: string
  input_schema: AgentToolInputSchema
}

interface AnthropicMessageRequest {
  role: string
  content: string | AnthropicToolBlock[]
}

interface AnthropicRequest {
  model: string
  messages: AnthropicMessageRequest[]
  max_tokens: number
  system?: string
  tools?: object[]
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
  history?: ChatHistoryMessage[]
  tools?: AgentToolDefinition[]
  agentMessages?: AgentMessage[]
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
    // 系统提示词未启用时，至少将文章上下文作为 system prompt 送出，
    // 避免模型收不到任何文章数据而产生空响应或幻觉。
    const base = persona ? `Persona: ${persona}` : ''
    return context ? `${base}\n\n${context}`.trim() : base
  }

  const template = aiSettings.systemPromptTemplate || ''
  let result = template
    .replace(/\{\{context\}\}/g, context)
    .replace(/\{\{persona\}\}/g, persona)
    .trim()

  // 即使用户模板未包含 {{context}}，也确保文章数据送达模型。
  if (context && !template.includes('{{context}}')) {
    result = result ? `${result}\n\n${context}` : context
  }
  return result
}

function buildAnthropicBody(context: ProviderRequestContext): string {
  let messages: AnthropicMessageRequest[] = []
  if (context.agentMessages && context.agentMessages.length > 0) {
    messages = []
    for (const am of context.agentMessages) {
      if (am.role === 'system') {
        continue
      }
      if (am.role === 'tool') {
        const toolResultBlock: AnthropicToolBlock = {
          type: 'tool_result',
          text: am.content || '',
          tool_use_id: am.tool_call_id || '',
        }
        const toolResultMsg: AnthropicMessageRequest = {
          role: 'user',
          content: [toolResultBlock],
        }
        messages.push(toolResultMsg)
        continue
      }
      if (am.tool_calls && am.tool_calls.length > 0) {
        const blocks: AnthropicToolBlock[] = []
        for (const tc of am.tool_calls) {
          let input: Record<string, Object> = {}
          try { input = JSON.parse(tc.function.arguments) as Record<string, Object> } catch (_e) {}
          const toolUseBlock: AnthropicToolBlock = {
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: input,
          }
          blocks.push(toolUseBlock)
        }
        const toolCallMsg: AnthropicMessageRequest = {
          role: am.role,
          content: blocks,
        }
        messages.push(toolCallMsg)
        continue
      }
      const textMsg: AnthropicMessageRequest = {
        role: am.role,
        content: am.content || '',
      }
      messages.push(textMsg)
    }
  } else if (context.history && context.history.length > 0) {
    messages = context.history
      .filter((m: ChatHistoryMessage) => m.role === 'user' || m.role === 'assistant')
      .map((m: ChatHistoryMessage) => {
        const msg: AnthropicMessageRequest = {
          role: m.role,
          content: m.content
        }
        return msg
      })
  } else {
    const textBlock: AnthropicToolBlock = { type: 'text', text: context.userContent }
    messages = [{
      role: 'user',
      content: [textBlock],
    }]
  }
  const body: AnthropicRequest = {
    model: context.model,
    messages,
    max_tokens: context.maxTokens,
  }
  if (context.systemPrompt) {
    body.system = context.systemPrompt
  }
  if (context.tools && context.tools.length > 0) {
    const anthropicTools: object[] = []
    for (const t of context.tools) {
      const schema: AnthropicToolSchema = {
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }
      anthropicTools.push(schema as object)
    }
    body.tools = anthropicTools
  }
  return JSON.stringify(body)
}

function buildMiniMaxTextBody(context: ProviderRequestContext): string {
  const messages: ChatMessage[] = []
  if (context.systemPrompt) {
    messages.push({ role: 'system', content: context.systemPrompt })
  }
  if (context.agentMessages && context.agentMessages.length > 0) {
    for (const am of context.agentMessages) {
      const msg: ChatMessage = { role: am.role, content: am.content }
      if (am.tool_calls) {
        msg.tool_calls = am.tool_calls
      }
      if (am.tool_call_id) {
        msg.tool_call_id = am.tool_call_id
        msg.name = am.name
      }
      if (am.reasoning_content) {
        msg.reasoning_content = am.reasoning_content
      }
      messages.push(msg)
    }
  } else if (context.history && context.history.length > 0) {
    const filteredHistory = context.history
      .filter((m: ChatHistoryMessage) => m.role === 'user' || m.role === 'assistant')
      .map((m: ChatHistoryMessage) => {
        const msg: ChatMessage = { role: m.role, content: m.content }
        if (m.reasoning_content) {
          msg.reasoning_content = m.reasoning_content
        }
        return msg
      })
    messages.push(...filteredHistory)
  } else {
    messages.push({ role: 'user', content: context.userContent })
  }
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
  if (context.agentMessages && context.agentMessages.length > 0) {
    for (const am of context.agentMessages) {
      const msg: ChatMessage = {
        role: am.role,
        content: am.content,
      }
      if (am.tool_calls) {
        msg.tool_calls = am.tool_calls
      }
      if (am.tool_call_id) {
        msg.tool_call_id = am.tool_call_id
        msg.name = am.name
      }
      if (am.reasoning_content) {
        msg.reasoning_content = am.reasoning_content
      }
      messages.push(msg)
    }
  } else if (context.history && context.history.length > 0) {
    const filteredHistory = context.history
      .filter((m: ChatHistoryMessage) => m.role === 'user' || m.role === 'assistant')
      .map((m: ChatHistoryMessage) => {
        const msg: ChatMessage = { role: m.role, content: m.content }
        if (m.reasoning_content) {
          msg.reasoning_content = m.reasoning_content
        }
        return msg
      })
    messages.push(...filteredHistory)
  } else {
    messages.push({ role: 'user', content: context.userContent })
  }
  const body: ChatRequest = {
    model: context.model,
    messages,
    max_tokens: context.maxTokens,
  }
  if (context.tools && context.tools.length > 0) {
    body.tools = context.tools
    body.tool_choice = 'auto'
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
