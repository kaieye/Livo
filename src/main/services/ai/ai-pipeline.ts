import OpenAI from 'openai'
import { createHash } from 'crypto'
import { getEventBus } from '../system/event-bus'
import { settingsProvider } from '../system/settings-provider'
import { createOpenAIClient, validateAIConfig } from './ai-client'
import { normalizeAIError } from './provider-protocol'
import { runWithRetry } from './ai-retry'
import {
  buildSummaryPrompt,
  buildTranslatePrompt,
  clampContentToBudget,
} from './ai-prompts'
import {
  buildDigestBatchMessages,
  buildDigestBudgetPlan,
  buildDigestReduceMessages,
  buildDigestRerankMessages,
  dedupeDigestCandidates,
  selectValidDigestRerankIds,
} from './ai-digest'
import type { TaskRunContext } from '../system/task-runner'
import type {
  AiSummarizeTaskPayload,
  AiTranslateTaskPayload,
} from '../system/task-contracts'
import { getDb } from '../../database'
import type {
  AIDigestGenerateResult,
  AIDigestPreset,
  AIConfig,
} from '../../../shared/types'

// ── Types ────────────────────────────────────────────────────────────────────

export type AIDigestGenerateInput = { preset?: AIDigestPreset; feedId?: string }

export type AISummarizeResult = { success: true; summary: string }
export type AITranslateResult = { success: true; translation: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

export function sendToAllWindows(channel: string, payload: unknown): void {
  getEventBus().send(channel, payload)
}

export function getDigestPresetLabel(preset: AIDigestPreset): string {
  return preset === 'week' ? '本周趋势' : '今日简报'
}

export function normalizeDigestPreset(value: unknown): AIDigestPreset {
  return value === 'week' ? 'week' : 'today'
}

export function hashAISummarySource(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function persistAISummarySessionPatch(
  sessionId: string | undefined,
  patch: Parameters<
    ReturnType<typeof getDb>['aiSummarySessions']['updateSession']
  >[1],
): void {
  if (!sessionId) return
  getDb().aiSummarySessions.updateSession(sessionId, patch)
}

function persistEntryAISummary(
  entryId: string | undefined,
  summary: string,
): void {
  if (!entryId) return
  getDb().entries.updateEntry(entryId, {
    aiSummary: summary,
    aiSummaryGeneratedAt: Date.now(),
    aiSummaryError: undefined,
  })
}

async function requestDigestText(
  client: OpenAI,
  aiConfig: AIConfig,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  return runWithRetry(
    async () => {
      const response = await client.chat.completions.create({
        model: aiConfig.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // DeepSeek 的 thinking 模式会消耗 max_tokens，可能导致可见正文为空。
        ...(aiConfig.provider === 'deepseek'
          ? { thinking: { type: 'disabled' as const } }
          : {}),
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
      return response.choices[0]?.message?.content || ''
    },
    { isEmpty: (text) => !text.trim() },
  )
}

// ── Digest pipeline ──────────────────────────────────────────────────────────

export async function generateAIDigest(
  input?: AIDigestGenerateInput,
  context?: TaskRunContext,
): Promise<AIDigestGenerateResult> {
  const settings = settingsProvider.get()
  const aiConfig = settings.ai
  const preset = normalizeDigestPreset(input?.preset)
  const presetLabel = getDigestPresetLabel(preset)
  const now = Date.now()

  context?.reportProgress({
    completed: 0,
    total: 4,
    message: '筛选候选文章',
    data: { preset, feedId: input?.feedId },
  })

  const { windowStartAt, windowEndAt } = getDb().digests.getDigestWindow(
    preset,
    now,
  )
  const rawCandidates = getDb().digests.listDigestCandidates({
    preset,
    feedId: input?.feedId,
    limit: 80,
    now,
  })
  const candidates = dedupeDigestCandidates(rawCandidates)
  const run = getDb().digests.upsertAIDigestRun({
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

  context?.reportProgress({
    completed: 1,
    total: 4,
    message: '候选文章已就绪',
    data: {
      preset,
      feedId: input?.feedId,
      digestRunId: run.id,
      rawCandidateCount: rawCandidates.length,
      candidateCount: candidates.length,
    },
  })

  if (candidates.length === 0) {
    const failed = getDb().digests.updateAIDigestRun(run.id, {
      status: 'failed',
      error: '当前时间窗内没有可用于生成简报的文章',
    })
    context?.reportProgress({
      completed: 4,
      total: 4,
      message: '没有可用于生成简报的文章',
      data: { preset, feedId: input?.feedId, digestRunId: run.id },
    })
    return {
      success: false,
      error: failed?.error || '当前时间窗内没有可用于生成简报的文章',
      run: failed || run,
    }
  }

  const configError = validateAIConfig(aiConfig)
  if (configError) {
    const failed = getDb().digests.updateAIDigestRun(run.id, {
      status: 'failed',
      error: configError,
    })
    context?.reportProgress({
      completed: 4,
      total: 4,
      message: 'AI 配置不可用',
      data: { preset, feedId: input?.feedId, digestRunId: run.id },
    })
    return { success: false, error: configError, run: failed || run }
  }

  try {
    const client = createOpenAIClient(aiConfig)
    const topic = presetLabel
    const maxIds = Math.min(12, candidates.length)
    let selectedIds = candidates.slice(0, 1).map((candidate) => candidate.id)

    if (candidates.length > 1) {
      context?.reportProgress({
        completed: 2,
        total: 4,
        message: '重排候选文章',
        data: { preset, feedId: input?.feedId, digestRunId: run.id },
      })
      const rerankRaw = await requestDigestText(
        client,
        aiConfig,
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

    context?.reportProgress({
      completed: 3,
      total: 4,
      message: '生成批次摘要',
      data: {
        preset,
        feedId: input?.feedId,
        digestRunId: run.id,
        selectedCount: selectedCandidates.length,
      },
    })

    for (const batch of plan.batches) {
      const note = await requestDigestText(
        client,
        aiConfig,
        buildDigestBatchMessages({ topic, presetLabel, batch }),
        1200,
        0.2,
      )
      batchNotes.push(note)
    }

    const content = await requestDigestText(
      client,
      aiConfig,
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
    const completed = getDb().digests.updateAIDigestRun(run.id, {
      status: 'completed',
      title: presetLabel,
      sourceEntryIds: selectedIds,
      content,
      error: undefined,
    })

    context?.reportProgress({
      completed: 4,
      total: 4,
      message: '简报生成完成',
      data: { preset, feedId: input?.feedId, digestRunId: run.id },
    })

    return {
      success: true,
      run: completed || run,
      candidates: selectedCandidates,
    }
  } catch (error) {
    const normalized = normalizeAIError(error, aiConfig)
    const failed = getDb().digests.updateAIDigestRun(run.id, {
      status: 'failed',
      error: normalized,
    })
    context?.reportProgress({
      completed: 4,
      total: 4,
      message: '简报生成失败',
      data: { preset, feedId: input?.feedId, digestRunId: run.id },
    })
    return { success: false, error: normalized, run: failed || run }
  }
}

// ── Summarize pipeline ───────────────────────────────────────────────────────

export async function runAISummarizeTask(
  payload: AiSummarizeTaskPayload,
  context?: TaskRunContext,
): Promise<AISummarizeResult> {
  const settings = settingsProvider.get()
  const aiConfig = settings.ai
  const { content, language, requestId, entryId, sessionId, sourceHash } =
    payload

  const fail = (error: string): never => {
    if (requestId) {
      sendToAllWindows('ai:summary-stream-error', { requestId, error })
    }
    persistAISummarySessionPatch(sessionId, {
      status: 'failed',
      errorCode: 'provider_error',
      errorMessage: error,
      rawErrorMessage: error,
      finishedAt: Date.now(),
    })
    throw new Error(error)
  }

  const configError = validateAIConfig(aiConfig)
  if (configError) fail(configError)

  try {
    context?.reportProgress({
      completed: 0,
      total: 1,
      message: '生成摘要',
      data: { streaming: Boolean(requestId), contentLength: content.length },
    })

    const client = createOpenAIClient(aiConfig)
    persistAISummarySessionPatch(sessionId, {
      status: 'running',
      model: aiConfig.model,
      sourceHash,
      runId: context?.runId,
    })
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
        persistAISummarySessionPatch(sessionId, {
          status: 'running',
          draftText: summary,
        })
        sendToAllWindows('ai:summary-stream-chunk', {
          requestId,
          content: delta,
        })
      }
      sendToAllWindows('ai:summary-stream-done', { requestId })
      context?.reportProgress({
        completed: 1,
        total: 1,
        message: '摘要已生成',
        data: { streaming: true, contentLength: content.length },
      })

      persistAISummarySessionPatch(sessionId, {
        status: 'succeeded',
        draftText: summary,
        finalText: summary,
        errorCode: undefined,
        errorMessage: undefined,
        rawErrorMessage: undefined,
        finishedAt: Date.now(),
      })
      persistEntryAISummary(entryId, summary)
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

    context?.reportProgress({
      completed: 1,
      total: 1,
      message: '摘要已生成',
      data: { streaming: false, contentLength: content.length },
    })
    persistAISummarySessionPatch(sessionId, {
      status: 'succeeded',
      draftText: summary,
      finalText: summary,
      errorCode: undefined,
      errorMessage: undefined,
      rawErrorMessage: undefined,
      finishedAt: Date.now(),
    })
    persistEntryAISummary(entryId, summary)
    return { success: true, summary }
  } catch (error) {
    const normalized = normalizeAIError(error, aiConfig)
    if (requestId) {
      sendToAllWindows('ai:summary-stream-error', {
        requestId,
        error: normalized,
      })
    }
    persistAISummarySessionPatch(sessionId, {
      status: 'failed',
      errorCode: 'provider_error',
      errorMessage: normalized,
      rawErrorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: Date.now(),
    })
    if (entryId) {
      getDb().entries.updateEntry(entryId, { aiSummaryError: normalized })
    }
    throw new Error(normalized)
  }
}

// ── Translate pipeline ───────────────────────────────────────────────────────

export async function runAITranslateTask(
  payload: AiTranslateTaskPayload,
  context?: TaskRunContext,
): Promise<AITranslateResult> {
  const settings = settingsProvider.get()
  const aiConfig = settings.ai
  const { content, targetLanguage, requestId } = payload

  const fail = (error: string): never => {
    if (requestId) {
      sendToAllWindows('ai:translate-stream-error', { requestId, error })
    }
    throw new Error(error)
  }

  const configError = validateAIConfig(aiConfig)
  if (configError) fail(configError)

  try {
    context?.reportProgress({
      completed: 0,
      total: 1,
      message: '生成翻译',
      data: {
        streaming: Boolean(requestId),
        targetLanguage,
        contentLength: content.length,
      },
    })

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
      context?.reportProgress({
        completed: 1,
        total: 1,
        message: '翻译已生成',
        data: {
          streaming: true,
          targetLanguage,
          contentLength: content.length,
        },
      })

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

    context?.reportProgress({
      completed: 1,
      total: 1,
      message: '翻译已生成',
      data: {
        streaming: false,
        targetLanguage,
        contentLength: content.length,
      },
    })
    return { success: true, translation }
  } catch (error) {
    const normalized = normalizeAIError(error, aiConfig)
    if (requestId) {
      sendToAllWindows('ai:translate-stream-error', {
        requestId,
        error: normalized,
      })
    }
    throw new Error(normalized)
  }
}
