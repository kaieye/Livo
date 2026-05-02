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
 * NOTE: A leaner version of this parser also lives in
 * `services/AIAssistantConnectionTestService.ets`. Future refactor: converge.
 */

interface ChatContentPart {
  text?: string
}

interface ChatMessageResponse {
  content?: string | ChatContentPart[] | ChatContentPart
  reasoning_content?: string
}

interface ChatChoiceDelta {
  content?: string
}

interface ChatChoiceResponse {
  text?: string
  message?: ChatMessageResponse
  delta?: ChatChoiceDelta
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
}

interface AnthropicTextContentBlock {
  type: string
  text?: string
  thinking?: string
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

interface ProviderErrorResponse {
  base_resp?: ProviderBaseResponse
  message?: string
  error?: ProviderErrorObject
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

  const reply = (parsed.reply || '').trim()
  if (reply) {
    return reply
  }

  const rootMessage = (parsed.message || '').trim()
  if (rootMessage) {
    return rootMessage
  }

  const outputText = (parsed.output_text || '').trim()
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

export function extractAnthropicResponseContent(parsed: AnthropicResponse): string {
  const blocks = parsed.content || []
  const fragments: string[] = []
  blocks.forEach((block: AnthropicTextContentBlock) => {
    if (!block) {
      return
    }
    if (block.type === 'text' && (block.text || '').trim()) {
      fragments.push((block.text || '').trim())
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
    const statusMessage = (parsed.base_resp?.status_msg || '').trim()
    return statusMessage ? `${statusCode} ${statusMessage}` : `${statusCode}`
  }
  return ''
}

export function extractErrorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as ProviderErrorResponse
    const statusMessage = (parsed.base_resp?.status_msg || '').trim()
    if (statusMessage) {
      return statusMessage
    }
    const message = (parsed.message || '').trim()
    if (message) {
      return message
    }
    return (parsed.error?.message || '').trim()
  } catch (_error) {
    return ''
  }
}

function extractFromChoice(choice: ChatChoiceResponse, allowReasoningFallback: boolean): string {
  const deltaContent = (choice.delta?.content || '').trim()
  if (deltaContent) {
    return deltaContent
  }

  const choiceText = (choice.text || '').trim()
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
    const singlePartText = ((messageContent as ChatContentPart).text || '').trim()
    if (singlePartText) {
      return singlePartText
    }
  }

  const messageArrayText = parseTextFromContentArray(messageContent)
  if (messageArrayText) {
    return messageArrayText
  }

  if (allowReasoningFallback) {
    return (message.reasoning_content || '').trim()
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
    return (content.text || '').trim()
  }
  const fragments: string[] = []
  content.forEach((item: ChatContentPart) => {
    const text = (item?.text || '').trim()
    if (text) {
      fragments.push(text)
    }
  })
  return fragments.join('\n').trim()
}
