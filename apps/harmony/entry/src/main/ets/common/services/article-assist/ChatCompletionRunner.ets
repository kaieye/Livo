/**
 * Single-shot chat-completion runner.
 *
 * Wraps one HTTP POST to the chosen provider, retries up to 2× on HTTP 529
 * (provider overloaded), then either parses the response (Anthropic vs others)
 * or — for MiniMax only — falls back to the text/chatcompletion_v2 endpoint
 * when the openai-style chat endpoint returns an empty body.
 *
 * The MiniMax fallback is a pragmatic patch: some MiniMax deployments expose
 * /chat/completions as a thin wrapper that silently swallows the response;
 * /text/chatcompletion_v2 is the canonical path. We keep both so users with
 * a manually-configured /chat/completions URL still work.
 */

import { http } from '@kit.NetworkKit'
import {
  AI_REQUEST_CONNECT_TIMEOUT_MS,
  AI_REQUEST_READ_TIMEOUT_MS,
} from '../../AppConfig'
import { AIAssistantSettings } from '../../models/LivoModels'
import { ChatMessage as ChatHistoryMessage } from '../ChatHistoryStore'
import { delay, stringifyHttpResult } from './HttpResponseDecoder'
import {
  AnthropicResponse,
  ChatCompletionResponse,
  ExtractedToolCall,
  extractAnthropicResponseContent,
  extractAnthropicToolCalls,
  extractErrorDetail,
  extractFinishReason,
  extractResponseContent,
  extractSoftProviderError,
  extractToolCalls,
} from './ProviderResponseParser'
import {
  AgentMessage,
  ProviderFormat,
  ProviderRequestContext,
  buildRequestBody,
  buildRequestHeaders,
  detectProviderFormat,
  miniMaxTextEndpoint,
  resolveCompletionEndpoint,
  resolveProviderApiKey,
  resolveSystemPrompt,
} from './ProviderProtocol'
import { ChatToolDefinition } from '../AIChatTools'
import { sanitizeModelOutput } from './TranslationOutput'

const MAX_RETRY_ATTEMPTS = 2
const RATE_LIMITED_RESPONSE_CODE = 529
const RETRY_DELAY_MS = 900

export async function runChatCompletion(
  prompt: string,
  aiSettings: AIAssistantSettings,
  context: string,
  maxTokens: number,
  history?: ChatHistoryMessage[],
): Promise<string> {
  const endpoint = resolveCompletionEndpoint(aiSettings)
  const apiKey = resolveProviderApiKey(aiSettings)
  const model = (aiSettings.model || '').trim()
  if (!model) {
    throw new Error('请先在 设置 > AI助手 中配置模型')
  }

  const format = detectProviderFormat(aiSettings.provider, endpoint)
  const requestContext: ProviderRequestContext = {
    endpoint,
    format,
    apiKey,
    model,
    systemPrompt: resolveSystemPrompt(aiSettings, context),
    userContent: prompt,
    maxTokens,
    history,
  }

  const requestBody = buildRequestBody(requestContext)
  const headers = buildRequestHeaders(apiKey, format)

  const request = http.createHttp()
  try {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      const response = await request.request(endpoint, {
        method: http.RequestMethod.POST,
        connectTimeout: AI_REQUEST_CONNECT_TIMEOUT_MS,
        readTimeout: AI_REQUEST_READ_TIMEOUT_MS,
        header: headers,
        extraData: requestBody,
        expectDataType: 0,
      })
      const raw = stringifyHttpResult(response.result)
      console.error('[ChatCompletion] raw type:', typeof response.result, 'raw head:', raw.slice(0, 200))

      if (response.responseCode !== 200) {
        if (response.responseCode === RATE_LIMITED_RESPONSE_CODE && attempt < MAX_RETRY_ATTEMPTS - 1) {
          await delay(RETRY_DELAY_MS)
          continue
        }
        const detail = extractErrorDetail(raw)
        throw new Error(detail
          ? `AI 请求失败：HTTP ${response.responseCode} - ${detail}`
          : `AI 请求失败：HTTP ${response.responseCode}`)
      }

      const responseContent = parseSuccessResponse(raw, format, aiSettings)
      let content = sanitizeModelOutput(responseContent)
      console.error('[ChatCompletion] parsedContent:', typeof responseContent, 'sanitized:', content.slice(0, 200))
      if (typeof content !== 'string' || content.toLowerCase().includes('[object object]')) {
        console.error('[ChatCompletion] BLOCKED [object Object] content:', content)
        content = ''
      }
      if (!content && shouldRetryAsMiniMaxText(aiSettings, format)) {
        content = await runMiniMaxTextFallback(request, requestContext, headers)
      }
      if (!content) {
        throw new Error('AI 返回内容为空')
      }
      return content
    }
    throw new Error('AI 请求失败：未知错误')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  } finally {
    request.destroy()
  }
}

function parseSuccessResponse(
  raw: string,
  format: ProviderFormat,
  aiSettings: AIAssistantSettings,
): string {
  if (format === 'anthropic') {
    return extractAnthropicResponseContent(JSON.parse(raw) as AnthropicResponse)
  }
  const parsed = JSON.parse(raw) as ChatCompletionResponse
  const softError = extractSoftProviderError(parsed)
  if (softError) {
    throw new Error(softError)
  }
  return extractResponseContent(parsed, aiSettings.provider !== 'minimax')
}

function shouldRetryAsMiniMaxText(aiSettings: AIAssistantSettings, format: ProviderFormat): boolean {
  return aiSettings.provider === 'minimax' && format === 'openai-chat'
}

async function runMiniMaxTextFallback(
  request: http.HttpRequest,
  primary: ProviderRequestContext,
  headers: Record<string, string>,
): Promise<string> {
  const fallbackContext: ProviderRequestContext = {
    endpoint: miniMaxTextEndpoint(primary.endpoint),
    format: 'minimax-text',
    apiKey: primary.apiKey,
    model: primary.model,
    systemPrompt: primary.systemPrompt,
    userContent: primary.userContent,
    maxTokens: primary.maxTokens,
  }
  try {
    const fallbackResponse = await request.request(fallbackContext.endpoint, {
      method: http.RequestMethod.POST,
      connectTimeout: AI_REQUEST_CONNECT_TIMEOUT_MS,
      readTimeout: AI_REQUEST_READ_TIMEOUT_MS,
      header: headers,
      extraData: buildRequestBody(fallbackContext),
      expectDataType: 0,
    })
    if (fallbackResponse.responseCode !== 200) {
      return ''
    }
    const fallbackRaw = stringifyHttpResult(fallbackResponse.result)
    const parsed = JSON.parse(fallbackRaw) as ChatCompletionResponse
    const fallbackContent = extractResponseContent(parsed, false)
    return sanitizeModelOutput(fallbackContent)
  } catch (_error) {
    return ''
  }
}

export interface AgentChatCompletionResult {
  content: string
  toolCalls: ExtractedToolCall[]
  finishReason: string
}

export async function runChatCompletionForAgent(
  agentMessages: AgentMessage[],
  tools: ChatToolDefinition[],
  aiSettings: AIAssistantSettings,
  maxTokens: number,
): Promise<AgentChatCompletionResult> {
  const endpoint = resolveCompletionEndpoint(aiSettings)
  const apiKey = resolveProviderApiKey(aiSettings)
  const model = (aiSettings.model || '').trim()
  if (!model) {
    throw new Error('请先在 设置 > AI助手 中配置模型')
  }

  const format = detectProviderFormat(aiSettings.provider, endpoint)
  const systemPrompt = resolveSystemPrompt(aiSettings, '')

  const requestContext: ProviderRequestContext = {
    endpoint,
    format,
    apiKey,
    model,
    systemPrompt,
    userContent: '',
    maxTokens,
    tools,
    agentMessages: agentMessages,
  }

  const requestBody = buildRequestBody(requestContext)
  const headers = buildRequestHeaders(apiKey, format)

  console.info('[ChatAgent] endpoint:', sanitizeEndpointForLog(endpoint))
  console.info('[ChatAgent] model:', model, 'format:', format, 'tools:', tools.length, 'messages:', agentMessages.length)
  console.info('[ChatAgent] reqBody head:', requestBody.slice(0, 400))

  const request = http.createHttp()
  try {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      const response = await request.request(endpoint, {
        method: http.RequestMethod.POST,
        connectTimeout: AI_REQUEST_CONNECT_TIMEOUT_MS,
        readTimeout: AI_REQUEST_READ_TIMEOUT_MS,
        header: headers,
        extraData: requestBody,
        expectDataType: 0,
      })
      const raw = stringifyHttpResult(response.result)
      console.info('[ChatAgent] resp code:', response.responseCode, 'raw head:', raw.slice(0, 300))

      if (response.responseCode !== 200) {
        if (response.responseCode === RATE_LIMITED_RESPONSE_CODE && attempt < MAX_RETRY_ATTEMPTS - 1) {
          await delay(RETRY_DELAY_MS)
          continue
        }
        const detail = extractErrorDetail(raw)
        throw new Error(detail
          ? `AI 请求失败：HTTP ${response.responseCode} - ${detail}`
          : `AI 请求失败：HTTP ${response.responseCode}`)
      }

      const result = parseAgentResponse(raw, format)
      console.info('[ChatAgent] content:', result.content.slice(0, 200), 'toolCalls:', result.toolCalls.length, 'finish:', result.finishReason)
      return result
    }
    throw new Error('AI 请求失败：未知错误')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  } finally {
    request.destroy()
  }
}

function parseAgentResponse(raw: string, format: ProviderFormat): AgentChatCompletionResult {
  if (format === 'anthropic') {
    const parsed = JSON.parse(raw) as AnthropicResponse
    const content = extractAnthropicResponseContent(parsed)
    const toolCalls = extractAnthropicToolCalls(parsed)
    console.info('[ChatAgent] anthropic parsed - contentLen:', content.length, 'toolCalls:', toolCalls.length)
    return { content: sanitizeModelOutput(content), toolCalls, finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop' }
  }
  const parsed = JSON.parse(raw) as ChatCompletionResponse
  const softError = extractSoftProviderError(parsed)
  if (softError) {
    throw new Error(softError)
  }
  const content = extractResponseContent(parsed)
  const toolCalls = extractToolCalls(parsed)
  const finishReason = extractFinishReason(parsed)
  console.info('[ChatAgent] openai parsed - contentLen:', content.length, 'toolCalls:', toolCalls.length, 'finish:', finishReason)
  if (toolCalls.length > 0) {
    for (let i = 0; i < toolCalls.length; i += 1) {
      console.info('[ChatAgent] toolCall', i, 'name:', toolCalls[i].function.name, 'args:', toolCalls[i].function.arguments.slice(0, 100))
    }
  }
  return {
    content: sanitizeModelOutput(content),
    toolCalls,
    finishReason: finishReason || (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
  }
}

function sanitizeEndpointForLog(endpoint: string): string {
  const trimmed = (endpoint || '').trim()
  const idx = trimmed.indexOf('?')
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed
}
