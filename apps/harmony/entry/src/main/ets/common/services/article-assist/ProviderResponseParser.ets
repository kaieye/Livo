/**
 * Pulls the actual reply text out of whatever shape a provider returned.
 *
 * The handful of providers we talk to all return chat completions but with
 * meaningfully different envelopes:
 *   - OpenAI / DeepSeek / GLM: choices[].message.content (string or array of parts)
 *   - Anthropic:               content[] of typed blocks
 *   - MiniMax v2:              data: { ... } nested envelope, plus reply / output_text shortcuts
 *   - Some proxies:            output_text at root, or message: "..." at root
 *
 * Plus per-provider "soft" errors (output filtered by policy, non-zero base_resp.status_code)
 * that arrive with HTTP 200 and a normal-looking body — those need to be surfaced.
 *
 * The connection-test flow consumes the same primitives plus
 * `parseProviderResponseLoose` (handles SSE `data:` chunks and JSON arrays) and
 * `stripThinkBlocks` (drops `<think>...</think>` reasoning markers some providers
 * emit even from non-streaming endpoints).
 */

interface ChatContentPart {
  text?: string
}

interface ChatMessageResponse {
  content?: string | ChatContentPart[] | ChatContentPart
  reasoning_content?: string
  tool_calls?: ExtractedToolCall[]
}

interface ChatChoiceDelta {
  content?: string
}

interface ChatChoiceResponse {
  text?: string
  message?: ChatMessageResponse
  delta?: ChatChoiceDelta
  finish_reason?: string
}

export interface ChatCompletionResponse {
  output_text?: string
  choices?: ChatChoiceResponse[]
  content?: string | ChatContentPart[] | ChatContentPart
  message?: string
  reply?: string
  data?: ChatCompletionResponse
  output_sensitive?: boolean
  output_sensitive_type?: number
  base_resp?: ProviderBaseResponse
  error?: ProviderErrorObject
  id?: string
  model?: string
  object?: string
}

export interface ExtractedToolFunction {
  name: string
  arguments: string
}

export interface ExtractedToolCall {
  id: string
  type: string
  function: ExtractedToolFunction
}

interface AnthropicTextContentBlock {
  type: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  input?: Record<string, Object>
}

export interface AnthropicResponse {
  content?: AnthropicTextContentBlock[]
}

interface ProviderBaseResponse {
  status_code?: number
  status_msg?: string
}

interface ProviderErrorObject {
  message?: string
}

interface ProviderDeltaChunk {
  choices?: ChatChoiceResponse[]
}

function safeTrim(value: Object | string | number | boolean | null | undefined): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  return ''
}

export function extractResponseContent(
  parsed: ChatCompletionResponse,
  allowReasoningFallback: boolean = true,
): string {
  if (parsed.data) {
    const nested = extractResponseContent(parsed.data, allowReasoningFallback)
    if (nested) {
      return nested
    }
  }

  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : ''
  if (reply) {
    return reply
  }

  const rootMessage = typeof parsed.message === 'string' ? parsed.message.trim() : ''
  if (rootMessage) {
    return rootMessage
  }

  const outputText = safeTrim(parsed.output_text)
  if (outputText) {
    return outputText
  }

  const firstChoice = (parsed.choices || [])[0]
  if (firstChoice) {
    const fromChoice = extractFromChoice(firstChoice, allowReasoningFallback)
    if (fromChoice) {
      return fromChoice
    }
  }

  const content = parsed.content
  if (typeof content === 'string' && content.trim()) {
    return content.trim()
  }
  return parseTextFromContentArray(content)
}

export function extractAnthropicResponseContent(
  parsed: AnthropicResponse,
  includeThinking: boolean = false,
): string {
  const blocks = parsed.content || []
  const fragments: string[] = []
  blocks.forEach((block: AnthropicTextContentBlock) => {
    if (!block) {
      return
    }
    if (block.type === 'text' && safeTrim(block.text)) {
      fragments.push(safeTrim(block.text))
    } else if (includeThinking && block.type === 'thinking' && safeTrim(block.thinking)) {
      fragments.push(safeTrim(block.thinking))
    }
  })
  return fragments.join('\n').trim()
}

export function extractSoftProviderError(parsed: ChatCompletionResponse): string {
  if (parsed.output_sensitive) {
    const sensitiveType = parsed.output_sensitive_type ? `（类型 ${parsed.output_sensitive_type}）` : ''
    return `输出被策略拦截${sensitiveType}`
  }
  const statusCode = parsed.base_resp?.status_code || 0
  if (statusCode && statusCode !== 0) {
    const statusMessage = safeTrim(parsed.base_resp?.status_msg)
    return statusMessage ? `${statusCode} ${statusMessage}` : `${statusCode}`
  }
  return ''
}

export function extractErrorDetail(raw: string): string {
  try {
    return extractErrorDetailFromParsed(JSON.parse(raw) as ChatCompletionResponse)
  } catch (_error) {
    return ''
  }
}

export function extractErrorDetailFromParsed(parsed: ChatCompletionResponse | undefined): string {
  if (!parsed) {
    return ''
  }
  const statusMessage = safeTrim(parsed.base_resp?.status_msg)
  if (statusMessage) {
    return statusMessage
  }
  const message = safeTrim(parsed.message)
  if (message) {
    return message
  }
  return safeTrim(parsed.error?.message)
}

export function stripThinkBlocks(text: string): string {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export function parseProviderResponseLoose(raw: string): ChatCompletionResponse | undefined {
  const normalized = (raw || '').trim()
  if (!normalized) {
    return undefined
  }
  try {
    const parsedObject = JSON.parse(normalized) as ChatCompletionResponse
    if (parsedObject) {
      return parsedObject
    }
  } catch (_error) {
  }

  try {
    const parsedArray = JSON.parse(normalized) as ProviderDeltaChunk[]
    if (Array.isArray(parsedArray) && parsedArray.length > 0) {
      return parsedArray[parsedArray.length - 1] as ChatCompletionResponse
    }
  } catch (_error) {
  }

  const dataLines = normalized
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.startsWith('data:'))
  for (let index = dataLines.length - 1; index >= 0; index -= 1) {
    const payload = dataLines[index].slice(5).trim()
    if (!payload || payload === '[DONE]') {
      continue
    }
    try {
      return JSON.parse(payload) as ChatCompletionResponse
    } catch (_error) {
    }
  }
  return undefined
}

function extractFromChoice(choice: ChatChoiceResponse, allowReasoningFallback: boolean): string {
  const deltaContent = safeTrim(choice.delta?.content)
  if (deltaContent) {
    return deltaContent
  }

  const choiceText = safeTrim(choice.text)
  if (choiceText) {
    return choiceText
  }

  const message = choice.message
  if (!message) {
    return ''
  }

  const messageContent = message.content
  if (typeof messageContent === 'string' && messageContent.trim()) {
    return messageContent.trim()
  }

  if (messageContent && !Array.isArray(messageContent)) {
    const singlePartText = safeTrim((messageContent as ChatContentPart).text)
    if (singlePartText) {
      return singlePartText
    }
  }

  const messageArrayText = parseTextFromContentArray(messageContent)
  if (messageArrayText) {
    return messageArrayText
  }

  if (allowReasoningFallback) {
    return safeTrim(message.reasoning_content)
  }
  return ''
}

function parseTextFromContentArray(
  content?: string | ChatContentPart[] | ChatContentPart,
): string {
  if (!content || typeof content === 'string') {
    return ''
  }
  if (!Array.isArray(content)) {
    return safeTrim(content.text)
  }
  const fragments: string[] = []
  content.forEach((item: ChatContentPart) => {
    const text = safeTrim(item?.text)
    if (text) {
      fragments.push(text)
    }
  })
  return fragments.join('\n').trim()
}

export function extractToolCalls(parsed: ChatCompletionResponse): ExtractedToolCall[] {
  const firstChoice = (parsed.choices || [])[0]
  if (!firstChoice?.message?.tool_calls) {
    return []
  }
  const result: ExtractedToolCall[] = []
  const rawCalls = firstChoice.message.tool_calls
  for (let i = 0; i < rawCalls.length; i += 1) {
    const tc = rawCalls[i]
    const func: ExtractedToolFunction = {
      name: tc.function.name,
      arguments: tc.function.arguments,
    }
    const call: ExtractedToolCall = {
      id: tc.id,
      type: 'function',
      function: func,
    }
    result.push(call)
  }
  return result
}

export function extractFinishReason(parsed: ChatCompletionResponse): string {
  const firstChoice = (parsed.choices || [])[0]
  return firstChoice?.finish_reason ?? ''
}

export interface AnthropicToolUseBlock {
  type: string
  id: string
  name: string
  input: Record<string, Object>
}

export function extractAnthropicToolCalls(parsed: AnthropicResponse): ExtractedToolCall[] {
  const blocks = parsed.content || []
  const result: ExtractedToolCall[] = []
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]
    if (!b) {
      continue
    }
    if (b.type !== 'tool_use') {
      continue
    }
    const func: ExtractedToolFunction = {
      name: b.name || '',
      arguments: JSON.stringify(b.input || {}),
    }
    const call: ExtractedToolCall = {
      id: b.id || '',
      type: 'function',
      function: func,
    }
    result.push(call)
  }
  return result
}
