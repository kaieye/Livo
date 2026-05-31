import type { AIConfig } from '../../shared/types'
import { createOpenAIClient, validateAIConfig } from './ai-client'
import { normalizeAIError, isOpenAICompatible } from './provider-protocol'

export interface ConnectionTestInput {
  apiKey: string
  model: string
  baseUrl: string
  provider: string
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  duration?: number
  modelInfo?: string
}

const TEST_PROMPT = '简短告诉我你是什么公司的什么模型、是什么版本，不超过15个字'
const MAX_TOKENS = 32
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 900
const EMPTY_RETRY_DELAY_MS = 700

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Dedicated connection test service for AI providers.
 *
 * Sends a short probe prompt to the configured AI endpoint and inspects the
 * response. Retries on rate limiting (HTTP 429) and empty responses before
 * returning a user-friendly result. Mirrors Harmony's
 * `AIAssistantConnectionTestService`.
 */
export class ConnectionTestService {
  static async run(input: ConnectionTestInput): Promise<ConnectionTestResult> {
    // 1. Build a minimal AIConfig for validation and client creation.
    const config: AIConfig = {
      provider: input.provider as AIConfig['provider'],
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
    }

    // 2. Basic validation.
    const configError = validateAIConfig(config)
    if (configError) {
      return { success: false, message: configError }
    }

    // 3. Anthropic native format is not OpenAI-compatible — surface a clear
    //    error instead of letting the SDK 404.
    if (!isOpenAICompatible(config)) {
      return {
        success: false,
        message:
          'Anthropic 原生接口暂不支持，请在「设置 > AI」中将 Base URL 指向 OpenAI 兼容网关',
      }
    }

    const client = createOpenAIClient(config)

    // 4. Attempt probe with retries.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: TEST_PROMPT }],
          max_tokens: MAX_TOKENS,
          temperature: 0,
        })

        const content = (response.choices[0]?.message?.content || '').trim()

        // 5. Successful response with content.
        if (content) {
          return {
            success: true,
            message: content,
            duration: 4000,
            modelInfo: content,
          }
        }

        // 6. Empty response — retry once after a short delay.
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(EMPTY_RETRY_DELAY_MS)
          continue
        }

        return {
          success: false,
          message: 'AI 服务未返回有效内容，请检查模型是否可用或尝试切换模型',
        }
      } catch (error) {
        const status = (error as { status?: number }).status

        // 7. HTTP 429 — rate limited, retry if we have attempts left.
        if (status === 429 && attempt < MAX_ATTEMPTS - 1) {
          await sleep(RETRY_DELAY_MS)
          continue
        }

        // 8. Other errors — normalize and return.
        return {
          success: false,
          message: normalizeAIError(error, config),
        }
      }
    }

    // Should be unreachable, but satisfies TypeScript.
    return {
      success: false,
      message: '连接测试失败，请稍后重试',
    }
  }
}
