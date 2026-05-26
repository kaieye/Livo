/**
 * One-shot probe used by 设置 > AI助手 to verify the user's provider configuration.
 *
 * Sends the smallest possible chat-completion ("identify yourself in <15 chars")
 * against the resolved endpoint, retries up to 2× on HTTP 529 (provider
 * overloaded), and — for MiniMax with a manually-configured /chat/completions
 * URL — falls back to the canonical /text/chatcompletion_v2 endpoint when the
 * primary response comes back empty.
 *
 * All response shaping, body building, and parsing live behind two seams:
 *   - article-assist/ProviderProtocol     — endpoint + headers + request body
 *   - connection-test/ResponseAnalyzer    — raw HTTP body → user-facing message
 *
 * The orchestrator below only owns HTTP transport and retry timing.
 */

import { http } from '@kit.NetworkKit'
import { util } from '@kit.ArkTS'
import { AIProvider } from '../models/LivoModels'
import { delay, stringifyHttpResult } from './article-assist/HttpResponseDecoder'
import {
  ProviderFormat,
  ProviderRequestContext,
  buildRequestBody,
  buildRequestHeaders,
  detectProviderFormat,
  miniMaxTextEndpoint,
  resolveCompletionEndpointFor,
} from './article-assist/ProviderProtocol'
import {
  CONNECTION_TEST_CONNECT_TIMEOUT_MS,
  CONNECTION_TEST_EMPTY_RETRY_DELAY_MS,
  CONNECTION_TEST_MAX_ATTEMPTS,
  CONNECTION_TEST_MAX_TOKENS,
  CONNECTION_TEST_PROMPT,
  CONNECTION_TEST_READ_TIMEOUT_MS,
  CONNECTION_TEST_RETRY_DELAY_MS,
} from './connection-test/ConnectionTestPrompt'
import {
  analyzeConnectionTestContent,
  analyzeConnectionTestDebugHint,
  analyzeConnectionTestError,
  analyzeConnectionTestSuccessHint,
} from './connection-test/ConnectionTestResponseAnalyzer'

const RATE_LIMITED_RESPONSE_CODE = 529

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
  static async run(input: AIAssistantConnectionTestInput): Promise<AIAssistantConnectionTestResult> {
    const endpoint = resolveCompletionEndpointFor(input.provider, input.baseUrl)
    const format = detectProviderFormat(input.provider, endpoint)
    const useAnthropicFormat = format === 'anthropic'
    const requestContext = AIAssistantConnectionTestService.buildContext(input, endpoint, format)
    const body = buildRequestBody(requestContext)
    const headers = buildRequestHeaders(input.apiKey, format)
    const bodyBuf = new util.TextEncoder().encodeInto(body).buffer

    const request = http.createHttp()
    try {
      for (let attempt = 0; attempt < CONNECTION_TEST_MAX_ATTEMPTS; attempt += 1) {
        const response = await request.request(endpoint, {
          method: http.RequestMethod.POST,
          connectTimeout: CONNECTION_TEST_CONNECT_TIMEOUT_MS,
          readTimeout: CONNECTION_TEST_READ_TIMEOUT_MS,
          header: headers,
          extraData: bodyBuf,
        })
        const raw = stringifyHttpResult(response.result)

        if (response.responseCode === 200) {
          const successResult = await AIAssistantConnectionTestService.handleSuccessBody(
            raw,
            useAnthropicFormat,
            input,
            requestContext,
            headers,
            request,
            attempt,
          )
          if (successResult) {
            return successResult
          }
          continue
        }

        if (response.responseCode === RATE_LIMITED_RESPONSE_CODE
          && attempt < CONNECTION_TEST_MAX_ATTEMPTS - 1) {
          await delay(CONNECTION_TEST_RETRY_DELAY_MS)
          continue
        }
        const errorDetail = analyzeConnectionTestError(raw)
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

  private static buildContext(
    input: AIAssistantConnectionTestInput,
    endpoint: string,
    format: ProviderFormat,
  ): ProviderRequestContext {
    return {
      endpoint,
      format,
      apiKey: input.apiKey,
      model: input.model,
      systemPrompt: '',
      userContent: CONNECTION_TEST_PROMPT,
      maxTokens: CONNECTION_TEST_MAX_TOKENS,
    }
  }

  private static async handleSuccessBody(
    raw: string,
    useAnthropicFormat: boolean,
    input: AIAssistantConnectionTestInput,
    requestContext: ProviderRequestContext,
    headers: Record<string, string>,
    request: http.HttpRequest,
    attempt: number,
  ): Promise<AIAssistantConnectionTestResult | undefined> {
    let content = analyzeConnectionTestContent(raw, useAnthropicFormat)
    if (!content && AIAssistantConnectionTestService.shouldFallbackToMiniMaxText(input, requestContext)) {
      content = await AIAssistantConnectionTestService.tryMiniMaxTextFallback(
        request,
        requestContext,
        headers,
      )
    }
    if (content) {
      return { message: content, duration: 4000 }
    }

    const errorDetail = analyzeConnectionTestError(raw)
    if (errorDetail) {
      return { message: `无响应内容：${errorDetail}`, duration: 4000 }
    }
    if (attempt < CONNECTION_TEST_MAX_ATTEMPTS - 1) {
      await delay(CONNECTION_TEST_EMPTY_RETRY_DELAY_MS)
      return undefined
    }
    const successHint = analyzeConnectionTestSuccessHint(raw)
    if (successHint) {
      return { message: successHint, duration: 3500 }
    }
    const debugHint = analyzeConnectionTestDebugHint(raw)
    return {
      message: debugHint ? `无响应内容（${debugHint}）` : '无响应内容',
      duration: 4500,
    }
  }

  private static shouldFallbackToMiniMaxText(
    input: AIAssistantConnectionTestInput,
    requestContext: ProviderRequestContext,
  ): boolean {
    return input.provider === 'minimax' && requestContext.format === 'openai-chat'
  }

  private static async tryMiniMaxTextFallback(
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
        connectTimeout: CONNECTION_TEST_CONNECT_TIMEOUT_MS,
        readTimeout: CONNECTION_TEST_READ_TIMEOUT_MS,
        header: headers,
          extraData: new util.TextEncoder().encodeInto(buildRequestBody(fallbackContext)).buffer,
      })
      if (fallbackResponse.responseCode !== 200) {
        return ''
      }
      const fallbackRaw = stringifyHttpResult(fallbackResponse.result)
      return analyzeConnectionTestContent(fallbackRaw, false)
    } catch (_error) {
      return ''
    }
  }
}
