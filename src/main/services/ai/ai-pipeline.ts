import OpenAI from 'openai'
import { createHash } from 'crypto'
import { getEventBus } from '../system/event-bus'
import { settingsProvider } from '../system/settings-provider'
import { validateAIConfig } from './ai-client'
import { runAICompletion, runAICompletionText } from './ai-completion'
import { normalizeAIError } from './provider-protocol'
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
  aiConfig: AIConfig,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  // Routes through the shared completion seam, which owns client creation,
  // empty-result retry, and the DeepSeek thinking-disabled quirk. Config is
  // already validated by generateAIDigest, so skip the redundant check and let
  // raw provider errors bubble up to its catch for normalization.
  return runAICompletionText({
    aiConfig,
    messages,
    temperature,
    maxTokens,
    validateConfig: false,
  })
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
        aiConfig,
        buildDigestBatchMessages({ topic, presetLabel, batch }),
        1200,
        0.2,
      )
      batchNotes.push(note)
    }

    const content = await requestDigestText(
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

  const summary = await runAICompletion({
    aiConfig,
    messages,
    temperature: 0.3,
    maxTokens: 500,
    requestId,
    eventPrefix: 'ai:summary',
    sendEvent: sendToAllWindows,
    context,
    progress: {
      start: {
        completed: 0,
        total: 1,
        message: '生成摘要',
        data: { streaming: Boolean(requestId), contentLength: content.length },
      },
      done: (streaming) => ({
        completed: 1,
        total: 1,
        message: '摘要已生成',
        data: { streaming, contentLength: content.length },
      }),
    },
    hooks: {
      onStart: () => {
        persistAISummarySessionPatch(sessionId, {
          status: 'running',
          model: aiConfig.model,
          sourceHash,
          runId: context?.runId,
        })
      },
      onChunk: ({ text }) => {
        persistAISummarySessionPatch(sessionId, {
          status: 'running',
          draftText: text,
        })
      },
      onSuccess: (summary) => {
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
      },
      onError: (normalized, raw) => {
        persistAISummarySessionPatch(sessionId, {
          status: 'failed',
          errorCode: 'provider_error',
          errorMessage: normalized,
          rawErrorMessage: raw instanceof Error ? raw.message : String(raw),
          finishedAt: Date.now(),
        })
        if (entryId) {
          getDb().entries.updateEntry(entryId, { aiSummaryError: normalized })
        }
      },
    },
  })

  return { success: true, summary }
}

// ── Translate pipeline ───────────────────────────────────────────────────────

export async function runAITranslateTask(
  payload: AiTranslateTaskPayload,
  context?: TaskRunContext,
): Promise<AITranslateResult> {
  const settings = settingsProvider.get()
  const aiConfig = settings.ai
  const { content, targetLanguage, requestId } = payload

  const systemPrompt = buildTranslatePrompt(
    targetLanguage,
    aiConfig.translationPrompt,
  )
  const contentBudgets = [6000, 4000, 2500]
  const messages = (attempt: number): OpenAI.ChatCompletionMessageParam[] => {
    const budget = requestId
      ? contentBudgets[0]
      : contentBudgets[Math.min(attempt, contentBudgets.length - 1)]
    return [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: clampContentToBudget(content, budget),
      },
    ]
  }

  const translation = await runAICompletion({
    aiConfig,
    messages,
    temperature: 0.2,
    maxTokens: 4000,
    requestId,
    eventPrefix: 'ai:translate',
    sendEvent: sendToAllWindows,
    context,
    progress: {
      start: {
        completed: 0,
        total: 1,
        message: '生成翻译',
        data: {
          streaming: Boolean(requestId),
          targetLanguage,
          contentLength: content.length,
        },
      },
      done: (streaming) => ({
        completed: 1,
        total: 1,
        message: '翻译已生成',
        data: {
          streaming,
          targetLanguage,
          contentLength: content.length,
        },
      }),
    },
  })

  return { success: true, translation }
}
