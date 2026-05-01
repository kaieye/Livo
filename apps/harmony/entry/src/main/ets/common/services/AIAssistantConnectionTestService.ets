import { http } from '@kit.NetworkKit'
import { AIProvider } from '../models/LivoModels'

interface ConnectionTestChatMessage {
  role: string
  content: string
}

interface ConnectionTestChatRequest {
  model: string
  messages: ConnectionTestChatMessage[]
  max_tokens: number
}

interface ConnectionTestAnthropicTextBlock {
  type: string
  text: string
}

interface ConnectionTestAnthropicMessage {
  role: string
  content: ConnectionTestAnthropicTextBlock[]
}

interface ConnectionTestAnthropicRequest {
  model: string
  messages: ConnectionTestAnthropicMessage[]
  max_tokens: number
}

interface ConnectionTestMiniMaxTextRequest {
  model: string
  messages: ConnectionTestChatMessage[]
  max_completion_tokens: number
}

interface ConnectionTestAnthropicResponseBlock {
  type?: string
  text?: string
  thinking?: string
}

interface ConnectionTestChoiceMessage {
  content?: string | ConnectionTestContentPart[] | ConnectionTestContentPart
  reasoning_content?: string
}

interface ConnectionTestContentPart {
  text?: string
}

interface ConnectionTestChoiceDelta {
  content?: string
}

interface ConnectionTestChoice {
  message?: ConnectionTestChoiceMessage
  text?: string
  delta?: ConnectionTestChoiceDelta
}

interface ConnectionTestResponse {
  id?: string
  model?: string
  object?: string
  output_text?: string
  choices?: ConnectionTestChoice[]
  content?: ConnectionTestAnthropicResponseBlock[] | ConnectionTestContentPart[] | ConnectionTestContentPart
  message?: string
  reply?: string
  data?: ConnectionTestResponse
  output_sensitive?: boolean
  output_sensitive_type?: number
  base_resp?: ConnectionTestBaseResp
  error?: ConnectionTestErrorObject
}

interface ConnectionTestBaseResp {
  status_code?: number
  status_msg?: string
}

interface ConnectionTestErrorObject {
  message?: string
}

interface ConnectionTestDeltaChunk {
  choices?: ConnectionTestChoice[]
}

export interface AIAssistantConnectionTestInput {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl: string
}

export interface AIAssistantConnectionTestResult {
  message: string
  duration?: number
}

export class AIAssistantConnectionTestService {
  private static readonly CONNECTION_TEST_PROMPT: string =
    '简短告诉我你是什么公司的什么模型、是什么版本，不超过15个字'

  static async run(input: AIAssistantConnectionTestInput): Promise<AIAssistantConnectionTestResult> {
    const endpoint = AIAssistantConnectionTestService.resolveCompletionEndpoint(input.baseUrl, input.provider)
    const useAnthropicFormat = endpoint.includes('/anthropic/')
    const useMiniMaxTextFormat = input.provider === 'minimax' && endpoint.includes('/text/chatcompletion_v2')
    const body = AIAssistantConnectionTestService.createRequestBody(
      input.model,
      useAnthropicFormat,
      useMiniMaxTextFormat,
    )
    const request = http.createHttp()
    try {
      const headers = AIAssistantConnectionTestService.createHeaders(input.apiKey, useAnthropicFormat)
      const maxAttempts = 2
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await request.request(endpoint, {
          method: http.RequestMethod.POST,
          connectTimeout: 10000,
          readTimeout: 15000,
          header: headers,
          extraData: body,
        })
        const raw = AIAssistantConnectionTestService.stringifyHttpResult(response.result)
        if (response.responseCode === 200) {
          let content = AIAssistantConnectionTestService.extractConnectionTestContent(raw, useAnthropicFormat)
          if (!content && input.provider === 'minimax' && endpoint.includes('/chat/completions')) {
            content = await AIAssistantConnectionTestService.tryMiniMaxTextEndpoint(
              request,
              endpoint,
              input.model,
              headers,
            )
          }
          if (content) {
            return { message: content, duration: 4000 }
          }

          const errorDetail = AIAssistantConnectionTestService.extractConnectionTestError(raw)
          if (errorDetail) {
            return { message: `无响应内容：${errorDetail}`, duration: 4000 }
          }
          if (attempt < maxAttempts - 1) {
            await AIAssistantConnectionTestService.delay(700)
            continue
          }
          const successHint = AIAssistantConnectionTestService.extractConnectionTestSuccessHint(raw)
          if (successHint) {
            return { message: successHint, duration: 3500 }
          }
          const debugHint = AIAssistantConnectionTestService.extractConnectionTestDebugHint(raw)
          return {
            message: debugHint ? `无响应内容（${debugHint}）` : '无响应内容',
            duration: 4500,
          }
        }

        const errorDetail = AIAssistantConnectionTestService.extractConnectionTestError(raw)
        if (response.responseCode === 529 && attempt < maxAttempts - 1) {
          await AIAssistantConnectionTestService.delay(900)
          continue
        }
        if (errorDetail) {
          return { message: `错误 ${response.responseCode}：${errorDetail}`, duration: 4000 }
        }
        return { message: `错误 ${response.responseCode}` }
      }
      return { message: '无响应内容' }
    } catch (error) {
      return { message: `连接失败：${error instanceof Error ? error.message : String(error)}` }
    } finally {
      request.destroy()
    }
  }

  private static createRequestBody(
    model: string,
    useAnthropicFormat: boolean,
    useMiniMaxTextFormat: boolean,
  ): string {
    if (useAnthropicFormat) {
      return JSON.stringify({
        model,
        max_tokens: 32,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: AIAssistantConnectionTestService.CONNECTION_TEST_PROMPT,
          }],
        }],
      } as ConnectionTestAnthropicRequest)
    }

    if (useMiniMaxTextFormat) {
      return JSON.stringify({
        model,
        max_completion_tokens: 32,
        messages: [{
          role: 'user',
          content: AIAssistantConnectionTestService.CONNECTION_TEST_PROMPT,
        }],
      } as ConnectionTestMiniMaxTextRequest)
    }

    return JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: AIAssistantConnectionTestService.CONNECTION_TEST_PROMPT,
      }],
      max_tokens: 32,
    } as ConnectionTestChatRequest)
  }

  private static createHeaders(apiKey: string, useAnthropicFormat: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
    if (useAnthropicFormat) {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    }
    return headers
  }

  private static async tryMiniMaxTextEndpoint(
    request: http.HttpRequest,
    endpoint: string,
    model: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const fallbackEndpoint = AIAssistantConnectionTestService.resolveMiniMaxTextEndpoint(endpoint)
    const fallbackBody = AIAssistantConnectionTestService.createRequestBody(model, false, true)
    try {
      const fallbackResponse = await request.request(fallbackEndpoint, {
        method: http.RequestMethod.POST,
        connectTimeout: 10000,
        readTimeout: 15000,
        header: headers,
        extraData: fallbackBody,
      })
      if (fallbackResponse.responseCode !== 200) {
        return ''
      }
      const fallbackRaw = AIAssistantConnectionTestService.stringifyHttpResult(fallbackResponse.result)
      return AIAssistantConnectionTestService.extractConnectionTestContent(fallbackRaw, false)
    } catch (_error) {
      return ''
    }
  }

  private static decodeByteArray(bytes: Uint8Array): string {
    let output = ''
    for (let index = 0; index < bytes.length; index += 1) {
      output += String.fromCharCode(bytes[index])
    }
    return output
  }

  private static stringifyHttpResult(result: Object | string | number | boolean | null | undefined): string {
    if (typeof result === 'string') {
      return result
    }
    if (result instanceof ArrayBuffer) {
      try {
        return AIAssistantConnectionTestService.decodeByteArray(new Uint8Array(result))
      } catch (_error) {
        return ''
      }
    }
    if (result instanceof Uint8Array) {
      try {
        return AIAssistantConnectionTestService.decodeByteArray(result)
      } catch (_error) {
        return ''
      }
    }
    try {
      return JSON.stringify(result ?? '')
    } catch (_error) {
      return String(result ?? '')
    }
  }

  private static resolveMiniMaxTextEndpoint(endpoint: string): string {
    const normalized = (endpoint || '').trim().replace(/\/+$/g, '')
    if (normalized.includes('/text/chatcompletion_v2')) {
      return normalized
    }
    if (normalized.endsWith('/chat/completions')) {
      return normalized.replace(/\/chat\/completions$/g, '/text/chatcompletion_v2')
    }
    return `${normalized}/text/chatcompletion_v2`
  }

  private static resolveCompletionEndpoint(baseUrl: string, provider: AIProvider): string {
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
    const normalizedBase = trimmed.replace(/\/+$/g, '')
    if (provider === 'anthropic') {
      return `${normalizedBase}/messages`
    }
    if (provider === 'minimax') {
      return `${normalizedBase}/text/chatcompletion_v2`
    }
    return `${normalizedBase}/chat/completions`
  }

  private static async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve: () => void) => {
      setTimeout(() => resolve(), milliseconds)
    })
  }

  private static extractConnectionTestError(raw: string): string {
    try {
      const parsed = AIAssistantConnectionTestService.parseConnectionTestResponse(raw)
      if (!parsed) {
        return ''
      }
      if (parsed.output_sensitive) {
        const sensitiveType = parsed.output_sensitive_type ? `，类型 ${parsed.output_sensitive_type}` : ''
        return `输出被策略拦截${sensitiveType}`
      }
      const statusCode = parsed.base_resp?.status_code
      if (statusCode && statusCode !== 0) {
        const statusMessage = (parsed.base_resp?.status_msg || '').trim()
        return statusMessage ? `${statusCode} ${statusMessage}` : `${statusCode}`
      }
      const statusMessage = (parsed.base_resp?.status_msg || '')
      if ((statusMessage || '').trim()) {
        return statusMessage.trim()
      }
      const message = (parsed.message || '')
      if ((message || '').trim()) {
        return message.trim()
      }
      const errorMessage = (parsed.error?.message || '').trim()
      return errorMessage
    } catch (_error) {
      return ''
    }
  }

  private static extractConnectionTestDebugHint(raw: string): string {
    const normalized = (raw || '').trim()
    if (!normalized) {
      return ''
    }
    const parsed = AIAssistantConnectionTestService.parseConnectionTestResponse(normalized)
    if (!parsed) {
      return normalized.slice(0, 80)
    }
    const keys = Object.keys(parsed as Object)
    if (keys.length > 0) {
      return `响应字段: ${keys.join(', ').slice(0, 80)}`
    }
    return normalized.slice(0, 80)
  }

  private static extractConnectionTestSuccessHint(raw: string): string {
    const parsed = AIAssistantConnectionTestService.parseConnectionTestResponse(raw)
    if (!parsed) {
      return ''
    }
    const model = (parsed.model || '').trim()
    const objectType = (parsed.object || '').trim()
    if (model && objectType) {
      return `连接成功（${model} / ${objectType}）`
    }
    if (model) {
      return `连接成功（${model}）`
    }
    if (objectType) {
      return `连接成功（${objectType}）`
    }
    if ((parsed.id || '').trim()) {
      return '连接成功（已返回请求ID）'
    }
    return ''
  }

  private static extractConnectionTestContent(raw: string, useAnthropicFormat: boolean): string {
    const parsed = AIAssistantConnectionTestService.parseConnectionTestResponse(raw)
    if (!parsed) {
      return ''
    }
    if (parsed.data) {
      const nested = AIAssistantConnectionTestService.extractConnectionTestContent(
        JSON.stringify(parsed.data),
        useAnthropicFormat,
      )
      if (nested) {
        return nested
      }
    }
    const reply = (parsed.reply || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (reply) {
      return reply
    }
    const rootMessage = (parsed.message || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (rootMessage) {
      return rootMessage
    }
    if (useAnthropicFormat) {
      const content = parsed.content as ConnectionTestAnthropicResponseBlock[]
      if (!content || !Array.isArray(content)) {
        return ''
      }
      const fragments: string[] = []
      content.forEach((item: ConnectionTestAnthropicResponseBlock) => {
        const itemType = (item.type || '').trim()
        if (itemType === 'text' && (item.text || '').trim()) {
          fragments.push((item.text || '').trim())
        } else if (itemType === 'thinking' && (item.thinking || '').trim()) {
          fragments.push((item.thinking || '').trim())
        }
      })
      return fragments.join('\n').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }

    const outputText = (parsed.output_text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (outputText) {
      return outputText
    }

    const choices = parsed.choices as ConnectionTestChoice[]
    if (!choices || choices.length === 0) {
      const contentBlocks = parsed.content || []
      if (Array.isArray(contentBlocks) && contentBlocks.length > 0) {
        const blockTexts: string[] = []
        contentBlocks.forEach((block: ConnectionTestAnthropicResponseBlock | ConnectionTestContentPart) => {
          if ((block.text || '').trim()) {
            blockTexts.push((block.text || '').trim())
          }
        })
        return blockTexts.join('\n').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      }
      return ''
    }
    const firstChoice = choices[0]
    if (!firstChoice) {
      return ''
    }
    const message = firstChoice.message as ConnectionTestChoiceMessage
    if (message) {
      if (typeof message.content === 'string') {
        return message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      }
      if (Array.isArray(message.content)) {
        const messageParts: string[] = []
        message.content.forEach((part: ConnectionTestContentPart) => {
          if ((part.text || '').trim()) {
            messageParts.push((part.text || '').trim())
          }
        })
        const arrayText = messageParts.join('\n').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
        if (arrayText) {
          return arrayText
        }
      }
      if (message.content && !Array.isArray(message.content)) {
        const singlePartText = ((message.content as ConnectionTestContentPart).text || '')
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .trim()
        if (singlePartText) {
          return singlePartText
        }
      }
      const reasoningContent = (message.reasoning_content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (reasoningContent) {
        return reasoningContent
      }
    }
    const choiceText = firstChoice.text
    if (typeof choiceText === 'string') {
      return choiceText.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }
    const deltaContent = (firstChoice.delta?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (deltaContent) {
      return deltaContent
    }
    return ''
  }

  private static parseConnectionTestResponse(raw: string): ConnectionTestResponse | undefined {
    const normalizedRaw = (raw || '').trim()
    if (!normalizedRaw) {
      return undefined
    }
    try {
      const parsedObject = JSON.parse(normalizedRaw) as ConnectionTestResponse
      if (parsedObject) {
        return parsedObject
      }
    } catch (_error) {
    }

    try {
      const parsedArray = JSON.parse(normalizedRaw) as ConnectionTestDeltaChunk[]
      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        return parsedArray[parsedArray.length - 1] as ConnectionTestResponse
      }
    } catch (_error) {
    }

    const dataLines = normalizedRaw
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith('data:'))
    for (let index = dataLines.length - 1; index >= 0; index -= 1) {
      const payload = dataLines[index].slice(5).trim()
      if (!payload || payload === '[DONE]') {
        continue
      }
      try {
        return JSON.parse(payload) as ConnectionTestResponse
      } catch (_error) {
      }
    }
    return undefined
  }
}
