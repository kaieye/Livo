import OpenAI from 'openai'
import type { AIConfig } from '../../../shared/types'
import type { TaskRunContext, TaskRunProgress } from '../system/task-runner'
import { createOpenAIClient, validateAIConfig } from './ai-client'
import { runWithRetry } from './ai-retry'
import { normalizeAIError } from './provider-protocol'

export type AICompletionEventPrefix = 'ai:summary' | 'ai:translate' | 'ai:chat'

export type AICompletionMessages =
  | OpenAI.ChatCompletionMessageParam[]
  | ((attempt: number) => OpenAI.ChatCompletionMessageParam[])

/**
 * Provider-specific request tweaks that must be applied on every completion
 * regardless of caller. DeepSeek's default "thinking" mode consumes the
 * `max_tokens` budget on internal reasoning, which can leave the visible
 * content empty — so we disable it. This is the single source of truth for the
 * quirk; connection-test and the digest pipeline both go through here.
 */
export function providerRequestQuirks(
  aiConfig: AIConfig,
): Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> {
  if (aiConfig.provider === 'deepseek') {
    return {
      thinking: { type: 'disabled' as const },
    } as Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  }
  return {}
}

export interface AICompletionHooks {
  onStart?: (input: { aiConfig: AIConfig; context?: TaskRunContext }) => void
  onChunk?: (state: { delta: string; text: string }) => void
  onSuccess?: (text: string) => void
  onError?: (normalized: string, raw: unknown) => void
}

export interface RunAICompletionParams {
  aiConfig: AIConfig
  messages: AICompletionMessages
  temperature: number
  maxTokens: number
  requestId?: string
  eventPrefix: AICompletionEventPrefix
  sendEvent: (channel: string, payload: unknown) => void
  context?: TaskRunContext
  progress?: {
    start: TaskRunProgress
    done: TaskRunProgress | ((streaming: boolean) => TaskRunProgress)
  }
  hooks?: AICompletionHooks
  nonStreaming?: {
    maxAttempts?: number
  }
  extraParams?: Partial<
    Omit<
      OpenAI.Chat.Completions.ChatCompletionCreateParams,
      'model' | 'messages' | 'temperature' | 'max_tokens' | 'stream'
    >
  >
}

function resolveMessages(
  messages: AICompletionMessages,
  attempt: number,
): OpenAI.ChatCompletionMessageParam[] {
  return typeof messages === 'function' ? messages(attempt) : messages
}

function doneProgress(
  progress: RunAICompletionParams['progress'],
  streaming: boolean,
): TaskRunProgress | undefined {
  if (!progress) return undefined
  return typeof progress.done === 'function'
    ? progress.done(streaming)
    : progress.done
}

function emitStreamEvent(
  params: Pick<
    RunAICompletionParams,
    'eventPrefix' | 'requestId' | 'sendEvent'
  >,
  suffix: 'chunk' | 'done' | 'error',
  payload: Record<string, unknown> = {},
): void {
  if (!params.requestId) return
  params.sendEvent(`${params.eventPrefix}-stream-${suffix}`, {
    requestId: params.requestId,
    ...payload,
  })
}

async function requestNonStreamingCompletion(
  client: OpenAI,
  params: RunAICompletionParams,
): Promise<string> {
  return runWithRetry(
    async (attempt) => {
      const response = await client.chat.completions.create({
        model: params.aiConfig.model,
        messages: resolveMessages(params.messages, attempt),
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        ...providerRequestQuirks(params.aiConfig),
        ...params.extraParams,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
      return response.choices[0]?.message?.content || ''
    },
    {
      maxAttempts: params.nonStreaming?.maxAttempts,
      isEmpty: (text) => !text.trim(),
    },
  )
}

async function requestStreamingCompletion(
  client: OpenAI,
  params: RunAICompletionParams,
): Promise<string> {
  const stream = await client.chat.completions.create({
    model: params.aiConfig.model,
    messages: resolveMessages(params.messages, 0),
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    stream: true,
    ...providerRequestQuirks(params.aiConfig),
    ...params.extraParams,
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)

  let text = ''
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || ''
    if (!delta) continue
    text += delta
    params.hooks?.onChunk?.({ delta, text })
    emitStreamEvent(params, 'chunk', { content: delta })
  }

  emitStreamEvent(params, 'done')
  return text
}

/**
 * Shared AI chat-completion surface for Summary, Translation, and Chat.
 * It owns config validation, OpenAI-compatible client creation, streaming event
 * protocol, empty-result retry, provider error normalization, and progress.
 */
export async function runAICompletion(
  params: RunAICompletionParams,
): Promise<string> {
  const configError = validateAIConfig(params.aiConfig)
  if (configError) {
    emitStreamEvent(params, 'error', { error: configError })
    params.hooks?.onError?.(configError, configError)
    throw new Error(configError)
  }

  try {
    params.context?.reportProgress(params.progress?.start ?? {})
    const client = createOpenAIClient(params.aiConfig)
    params.hooks?.onStart?.({
      aiConfig: params.aiConfig,
      context: params.context,
    })

    const streaming = Boolean(params.requestId)
    const text = streaming
      ? await requestStreamingCompletion(client, params)
      : await requestNonStreamingCompletion(client, params)

    const completeProgress = doneProgress(params.progress, streaming)
    if (completeProgress) params.context?.reportProgress(completeProgress)
    params.hooks?.onSuccess?.(text)
    return text
  } catch (error) {
    const normalized = normalizeAIError(error, params.aiConfig)
    emitStreamEvent(params, 'error', { error: normalized })
    params.hooks?.onError?.(normalized, error)
    throw new Error(normalized)
  }
}

export interface RunAICompletionTextParams<T = string> {
  aiConfig: AIConfig
  messages: AICompletionMessages
  temperature: number
  maxTokens: number
  /** Total retry attempts (including the first). Defaults to runWithRetry's 3. */
  maxAttempts?: number
  /**
   * Validate the config up front. Defaults to true. Callers that already
   * validated (e.g. the digest pipeline) can opt out to avoid a redundant pass.
   */
  validateConfig?: boolean
  /**
   * Post-process the raw model text inside the retry loop. Throwing here (e.g.
   * on unparseable JSON) is treated as a retryable failure, mirroring the
   * filter's original parse-then-retry behavior. Defaults to identity.
   */
  parse?: (text: string) => T
  extraParams?: RunAICompletionParams['extraParams']
}

/**
 * Non-streaming entry point onto the shared completion seam: config validation,
 * client creation, the DeepSeek quirk, and empty-result retry — without the
 * streaming event protocol. Used by AI Digest and the semantic filter so they
 * no longer hand-roll their own client + retry loops. Errors surface raw so the
 * caller can normalize (digest) or inspect them (filter) as before.
 */
export async function runAICompletionText<T = string>(
  params: RunAICompletionTextParams<T>,
): Promise<T> {
  if (params.validateConfig !== false) {
    const configError = validateAIConfig(params.aiConfig)
    if (configError) throw new Error(configError)
  }

  const client = createOpenAIClient(params.aiConfig)
  const parse = params.parse ?? ((text: string) => text as unknown as T)

  return runWithRetry(
    async (attempt) => {
      const response = await client.chat.completions.create({
        model: params.aiConfig.model,
        messages: resolveMessages(params.messages, attempt),
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        ...providerRequestQuirks(params.aiConfig),
        ...params.extraParams,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
      const text = response.choices[0]?.message?.content || ''
      return parse(text)
    },
    {
      maxAttempts: params.maxAttempts,
      isEmpty: (value) => typeof value === 'string' && !value.trim(),
    },
  )
}
