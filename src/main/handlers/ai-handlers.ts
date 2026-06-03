import { registerChannel } from '../ipc/register-channel'
import { getEventBus } from '../services/system/event-bus'
import OpenAI from 'openai'
import { IPC } from '../../shared/types'
import { getSettings } from './settings-handlers'
import { createOpenAIClient, validateAIConfig } from '../services/ai/ai-client'
import { judgeSemanticFilter } from '../services/ai/ai-filter'
import { normalizeAIError } from '../services/ai/provider-protocol'
import { runWithRetry } from '../services/ai/ai-retry'
import { ConnectionTestService } from '../services/ai/connection-test'
import {
  buildSummaryPrompt,
  buildTranslatePrompt,
  clampContentToBudget,
} from '../services/ai/ai-prompts'
import {
  buildDigestBatchMessages,
  buildDigestBudgetPlan,
  buildDigestReduceMessages,
  buildDigestRerankMessages,
  selectValidDigestRerankIds,
} from '../services/ai/ai-digest'
import {
  getDigestWindow,
  listAIDigestRuns,
  listDigestCandidates,
  updateAIDigestRun,
  upsertAIDigestRun,
} from '../database'
import type {
  AIDigestGenerateResult,
  AIDigestPreset,
  AISemanticFilterInput,
} from '../../shared/types'

function sendToAllWindows(channel: string, payload: unknown): void {
  getEventBus().send(channel, payload)
}

function getDigestPresetLabel(preset: AIDigestPreset): string {
  return preset === 'week' ? '本周趋势' : '今日简报'
}

function normalizeDigestPreset(value: unknown): AIDigestPreset {
  return value === 'week' ? 'week' : 'today'
}

async function requestDigestText(
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  return runWithRetry(
    async () => {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      })
      return response.choices[0]?.message?.content || ''
    },
    { isEmpty: (text) => !text.trim() },
  )
}

export function registerAIHandlers(): void {
  // Summarize content
  registerChannel(
    IPC.AI_SUMMARIZE,
    async (_event, content: string, language?: string, requestId?: string) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)
        const lang = language || settings.general.language || 'zh-CN'
        const messages: OpenAI.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: buildSummaryPrompt(lang, aiConfig.summaryPrompt),
          },
          {
            role: 'user',
            content: `Please summarize the following article:\n\n${clampContentToBudget(content, 8000)}`,
          },
        ]

        if (requestId) {
          const stream = await client.chat.completions.create({
            model: aiConfig.model,
            messages,
            temperature: 0.3,
            max_tokens: 500,
            stream: true,
          })

          let summary = ''
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''
            if (!delta) continue
            summary += delta
            sendToAllWindows('ai:summary-stream-chunk', {
              requestId,
              content: delta,
            })
          }
          sendToAllWindows('ai:summary-stream-done', { requestId })

          return { success: true, summary }
        }

        const summary = await runWithRetry(
          async () => {
            const response = await client.chat.completions.create({
              model: aiConfig.model,
              messages,
              temperature: 0.3,
              max_tokens: 500,
            })
            return response.choices[0]?.message?.content || ''
          },
          { isEmpty: (text) => !text.trim() },
        )

        return { success: true, summary }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        if (requestId) {
          sendToAllWindows('ai:summary-stream-error', {
            requestId,
            error: normalized,
          })
        }
        return { success: false, error: normalized }
      }
    },
  )

  // Translate content
  registerChannel(
    IPC.AI_TRANSLATE,
    async (
      _event,
      content: string,
      targetLanguage: string,
      requestId?: string,
    ) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)
        const systemPrompt = buildTranslatePrompt(
          targetLanguage,
          aiConfig.translationPrompt,
        )

        if (requestId) {
          const stream = await client.chat.completions.create({
            model: aiConfig.model,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: clampContentToBudget(content, 6000),
              },
            ],
            temperature: 0.2,
            max_tokens: 4000,
            stream: true,
          })

          let translation = ''
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''
            if (!delta) continue
            translation += delta
            sendToAllWindows('ai:translate-stream-chunk', {
              requestId,
              content: delta,
            })
          }
          sendToAllWindows('ai:translate-stream-done', { requestId })

          return { success: true, translation }
        }

        // Each retry trims the context further so an over-long request that
        // returned empty can still succeed on a shorter one.
        const contentBudgets = [6000, 4000, 2500]

        const translation = await runWithRetry(
          async (attempt) => {
            const budget =
              contentBudgets[Math.min(attempt, contentBudgets.length - 1)]
            const response = await client.chat.completions.create({
              model: aiConfig.model,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: clampContentToBudget(content, budget),
                },
              ],
              temperature: 0.2,
              max_tokens: 4000,
            })
            return response.choices[0]?.message?.content || ''
          },
          { isEmpty: (text) => !text.trim() },
        )

        return { success: true, translation }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        if (requestId) {
          sendToAllWindows('ai:translate-stream-error', {
            requestId,
            error: normalized,
          })
        }
        return { success: false, error: normalized }
      }
    },
  )

  // AI Chat (non-streaming)
  registerChannel(
    IPC.AI_CHAT,
    async (_event, messages: Array<{ role: string; content: string }>) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)

        const response = await client.chat.completions.create({
          model: aiConfig.model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          temperature: 0.7,
          max_tokens: 2000,
        })

        return {
          success: true,
          message: response.choices[0]?.message?.content || '',
        }
      } catch (error) {
        return { success: false, error: normalizeAIError(error, aiConfig) }
      }
    },
  )

  // AI Chat (streaming via IPC events)
  registerChannel(
    IPC.AI_CHAT_STREAM,
    async (
      _event,
      messages: Array<{ role: string; content: string }>,
      requestId: string,
    ) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)

        const stream = await client.chat.completions.create({
          model: aiConfig.model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        })

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            sendToAllWindows('ai:chat-stream-chunk', {
              requestId,
              content,
            })
          }
        }

        sendToAllWindows('ai:chat-stream-done', { requestId })

        return { success: true }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        sendToAllWindows('ai:chat-stream-error', {
          requestId,
          error: normalized,
        })
        return { success: false, error: normalized }
      }
    },
  )

  registerChannel(
    IPC.AI_FILTER_JUDGE,
    async (_event, input: AISemanticFilterInput) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      try {
        const decision = await judgeSemanticFilter(input, aiConfig)
        return { success: true, decision }
      } catch (error) {
        return { success: false, error: normalizeAIError(error, aiConfig) }
      }
    },
  )

  registerChannel(IPC.AI_DIGEST_LIST, async (_event, limit?: number) => {
    return listAIDigestRuns(limit)
  })

  registerChannel(
    IPC.AI_DIGEST_GENERATE,
    async (
      _event,
      input?: { preset?: AIDigestPreset; feedId?: string },
    ): Promise<AIDigestGenerateResult> => {
      const settings = getSettings()
      const aiConfig = settings.ai
      const preset = normalizeDigestPreset(input?.preset)
      const presetLabel = getDigestPresetLabel(preset)
      const now = Date.now()
      const { windowStartAt, windowEndAt } = getDigestWindow(preset, now)
      const candidates = listDigestCandidates({
        preset,
        feedId: input?.feedId,
        limit: 80,
        now,
      })
      const run = upsertAIDigestRun({
        preset,
        feedId: input?.feedId,
        title: presetLabel,
        status: 'running',
        windowStartAt,
        windowEndAt,
        sourceEntryIds: [],
        candidateCount: candidates.length,
        content: '',
        error: undefined,
      })

      if (candidates.length === 0) {
        const failed = updateAIDigestRun(run.id, {
          status: 'failed',
          error: '当前时间窗内没有可用于生成简报的文章',
        })
        return {
          success: false,
          error: failed?.error || '当前时间窗内没有可用于生成简报的文章',
          run: failed || run,
        }
      }

      const configError = validateAIConfig(aiConfig)
      if (configError) {
        const failed = updateAIDigestRun(run.id, {
          status: 'failed',
          error: configError,
        })
        return { success: false, error: configError, run: failed || run }
      }

      try {
        const client = createOpenAIClient(aiConfig)
        const topic = presetLabel
        const maxIds = Math.min(12, candidates.length)
        let selectedIds = candidates
          .slice(0, 1)
          .map((candidate) => candidate.id)

        if (candidates.length > 1) {
          const rerankRaw = await requestDigestText(
            client,
            aiConfig.model,
            buildDigestRerankMessages({ topic, candidates, maxIds }),
            800,
            0,
          )
          const selection = selectValidDigestRerankIds(
            rerankRaw,
            candidates.map((candidate) => candidate.id),
            maxIds,
          )
          if (selection.ids.length === 0) {
            throw new Error('AI 未返回有效候选文章 id')
          }
          selectedIds = selection.ids
        }

        const candidateById = new Map(
          candidates.map((candidate) => [candidate.id, candidate]),
        )
        const selectedCandidates = selectedIds
          .map((id) => candidateById.get(id))
          .filter((candidate): candidate is (typeof candidates)[number] =>
            Boolean(candidate),
          )
        const plan = buildDigestBudgetPlan(selectedCandidates, {
          totalContextChars: 60_000,
          promptReserveChars: 8_000,
        })
        const batchNotes: string[] = []

        for (const batch of plan.batches) {
          const note = await requestDigestText(
            client,
            aiConfig.model,
            buildDigestBatchMessages({ topic, presetLabel, batch }),
            1200,
            0.2,
          )
          batchNotes.push(note)
        }

        const content = await requestDigestText(
          client,
          aiConfig.model,
          buildDigestReduceMessages({
            topic,
            presetLabel,
            windowStartAt,
            windowEndAt,
            batchNotes,
          }),
          2200,
          0.3,
        )
        const completed = updateAIDigestRun(run.id, {
          status: 'completed',
          title: presetLabel,
          sourceEntryIds: selectedIds,
          content,
          error: undefined,
        })

        return {
          success: true,
          run: completed || run,
          candidates: selectedCandidates,
        }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        const failed = updateAIDigestRun(run.id, {
          status: 'failed',
          error: normalized,
        })
        return { success: false, error: normalized, run: failed || run }
      }
    },
  )

  // Connection test
  registerChannel(IPC.AI_TEST_CONNECTION, async () => {
    const settings = getSettings()
    const aiConfig = settings.ai

    return ConnectionTestService.run({
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl || '',
      provider: aiConfig.provider,
    })
  })
}
