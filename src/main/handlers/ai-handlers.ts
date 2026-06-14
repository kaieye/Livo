import { registerChannel } from '../ipc/register-channel'
import OpenAI from 'openai'
import { IPC } from '../../shared/types'
import { settingsProvider } from '../services/system/settings-provider'
import { runAICompletion } from '../services/ai/ai-completion'
import { judgeSemanticFilter } from '../services/ai/ai-filter'
import { normalizeAIError } from '../services/ai/provider-protocol'
import { ConnectionTestService } from '../services/ai/connection-test'
import {
  generateAIDigest,
  hashAISummarySource,
  runAISummarizeTask,
  runAITranslateTask,
  normalizeDigestPreset,
  sendToAllWindows,
  type AIDigestGenerateInput,
} from '../services/ai/ai-pipeline'
import { translateEntrySegments } from '../services/ai/ai-translation'
import {
  AI_DIGEST_GENERATE_TASK,
  AI_SUMMARIZE_TASK,
  AI_TRANSLATE_TASK,
  type AiDigestGenerateTaskPayload,
} from '../services/system/task-contracts'
import { runLoggedTask } from '../services/system/task-operation'
import { getDb } from '../database'
import type {
  AIDigestGenerateResult,
  AISemanticFilterInput,
  EntryAITranslationSegment,
  EntryAITranslationSessionStatus,
} from '../../shared/types'
import { USER_OPERATION_KEYS } from '../../shared/user-operations'

const translationSessionStatuses = new Set<EntryAITranslationSessionStatus>([
  'queued',
  'running',
  'succeeded',
  'failed',
  'config_changed',
])

function normalizeTranslationSessionStatus(
  value: unknown,
): EntryAITranslationSessionStatus {
  return translationSessionStatuses.has(
    value as EntryAITranslationSessionStatus,
  )
    ? (value as EntryAITranslationSessionStatus)
    : 'queued'
}

function normalizeTranslationSegments(
  value: unknown,
): EntryAITranslationSegment[] {
  return Array.isArray(value) ? (value as EntryAITranslationSegment[]) : []
}

function hasOwnField(object: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field)
}

function pickEntrySummaryContent(entry: {
  readabilityContent?: string
  content?: string
  summary?: string
}): string {
  return (
    entry.readabilityContent?.trim() ||
    entry.content?.trim() ||
    entry.summary?.trim() ||
    ''
  )
}

export function registerAIHandlers(): void {
  // Summarize content
  registerChannel(
    IPC.AI_SUMMARIZE,
    async (_event, content: string, language?: string, requestId?: string) => {
      const { runId, promise } = runLoggedTask({
        contract: AI_SUMMARIZE_TASK,
        payload: { content, language, requestId },
        handler: runAISummarizeTask,
        operationKey: USER_OPERATION_KEYS.AI_SUMMARIZE,
        metadata: {
          streaming: Boolean(requestId),
          language,
          contentLength: content.length,
        },
        details: {
          queued: {
            streaming: Boolean(requestId),
            language,
            contentLength: content.length,
          },
        },
      })
      try {
        const result = await promise
        return { ...result, runId }
      } catch (error) {
        return {
          success: false,
          error: normalizeAIError(error, settingsProvider.get().ai),
          runId,
        }
      }
    },
  )

  registerChannel(
    IPC.AI_SUMMARY_SESSION_GET,
    async (_event, entryId: string) => {
      return getDb().aiSummarySessions.getLatestSessionByEntryId(entryId)
    },
  )

  registerChannel(
    IPC.AI_TRANSLATION_SESSION_GET,
    async (_event, entryId: string) => {
      return getDb().aiTranslationSessions.getLatestSessionByEntryId(entryId)
    },
  )

  registerChannel(
    IPC.AI_TRANSLATION_SESSION_CREATE,
    async (_event, input: Record<string, unknown>) => {
      return getDb().aiTranslationSessions.createSession({
        entryId: String(input.entryId || ''),
        targetLanguage: String(input.targetLanguage || 'zh-CN'),
        status: normalizeTranslationSessionStatus(input.status),
        segments: normalizeTranslationSegments(input.segments),
        errorCode: input.errorCode ? String(input.errorCode) : undefined,
        errorMessage: input.errorMessage
          ? String(input.errorMessage)
          : undefined,
        model: input.model ? String(input.model) : undefined,
        configFingerprint: input.configFingerprint
          ? String(input.configFingerprint)
          : undefined,
        runId: input.runId ? String(input.runId) : undefined,
      })
    },
  )

  registerChannel(
    IPC.AI_TRANSLATION_SESSION_UPDATE,
    async (_event, sessionId: string, updates: Record<string, unknown>) => {
      return getDb().aiTranslationSessions.updateSession(sessionId, {
        targetLanguage: updates.targetLanguage
          ? String(updates.targetLanguage)
          : undefined,
        status: updates.status
          ? normalizeTranslationSessionStatus(updates.status)
          : undefined,
        segments: updates.segments
          ? normalizeTranslationSegments(updates.segments)
          : undefined,
        errorCode: hasOwnField(updates, 'errorCode')
          ? String(updates.errorCode || '')
          : undefined,
        errorMessage: hasOwnField(updates, 'errorMessage')
          ? String(updates.errorMessage || '')
          : undefined,
        model: updates.model ? String(updates.model) : undefined,
        configFingerprint: updates.configFingerprint
          ? String(updates.configFingerprint)
          : undefined,
        runId: updates.runId ? String(updates.runId) : undefined,
        finishedAt:
          typeof updates.finishedAt === 'number'
            ? updates.finishedAt
            : undefined,
      })
    },
  )

  registerChannel(
    IPC.AI_SUMMARIZE_ENTRY,
    async (_event, entryId: string, language?: string, requestId?: string) => {
      const entry = getDb().entries.getEntryById(entryId)
      if (!entry) return { success: false, error: 'entry_not_found' }

      const content = pickEntrySummaryContent(entry)
      if (!content) return { success: false, error: 'entry_content_empty' }

      const sourceHash = hashAISummarySource(content)
      const session = getDb().aiSummarySessions.createSession({
        entryId,
        status: 'queued',
        draftText: '',
        model: settingsProvider.get().ai.model,
        sourceHash,
      })
      const { runId, promise } = runLoggedTask({
        contract: AI_SUMMARIZE_TASK,
        payload: {
          content,
          language,
          requestId,
          entryId,
          sessionId: session.id,
          sourceHash,
        },
        handler: runAISummarizeTask,
        operationKey: USER_OPERATION_KEYS.AI_SUMMARIZE,
        metadata: {
          streaming: Boolean(requestId),
          language,
          entryId,
          sessionId: session.id,
          contentLength: content.length,
        },
        target: { id: entryId, label: entry.title },
        details: {
          queued: {
            streaming: Boolean(requestId),
            language,
            sessionId: session.id,
            contentLength: content.length,
          },
        },
      })
      getDb().aiSummarySessions.updateSession(session.id, {
        runId,
      })
      try {
        const result = await promise
        return {
          ...result,
          session:
            getDb().aiSummarySessions.getSessionById(session.id) || session,
          runId,
        }
      } catch (error) {
        return {
          success: false,
          error: normalizeAIError(error, settingsProvider.get().ai),
          session:
            getDb().aiSummarySessions.getSessionById(session.id) || session,
          runId,
        }
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
      const { runId, promise } = runLoggedTask({
        contract: AI_TRANSLATE_TASK,
        payload: { content, targetLanguage, requestId },
        handler: runAITranslateTask,
        operationKey: USER_OPERATION_KEYS.AI_TRANSLATE,
        metadata: {
          streaming: Boolean(requestId),
          targetLanguage,
          contentLength: content.length,
        },
        details: {
          queued: {
            streaming: Boolean(requestId),
            targetLanguage,
            contentLength: content.length,
          },
        },
      })
      try {
        const result = await promise
        return { ...result, runId }
      } catch (error) {
        return {
          success: false,
          error: normalizeAIError(error, settingsProvider.get().ai),
          runId,
        }
      }
    },
  )

  registerChannel(IPC.AI_TRANSLATE_ENTRY_SEGMENTS, async (_event, input) => {
    return translateEntrySegments(input)
  })

  // AI Chat (non-streaming)
  registerChannel(
    IPC.AI_CHAT,
    async (_event, messages: Array<{ role: string; content: string }>) => {
      const settings = settingsProvider.get()
      const aiConfig = settings.ai

      try {
        const message = await runAICompletion({
          aiConfig,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          temperature: 0.7,
          maxTokens: 2000,
          eventPrefix: 'ai:chat',
          sendEvent: sendToAllWindows,
        })

        return { success: true, message }
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
      const settings = settingsProvider.get()
      const aiConfig = settings.ai

      try {
        await runAICompletion({
          aiConfig,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          temperature: 0.7,
          maxTokens: 4000,
          requestId,
          eventPrefix: 'ai:chat',
          sendEvent: sendToAllWindows,
        })
        return { success: true }
      } catch (error) {
        return { success: false, error: normalizeAIError(error, aiConfig) }
      }
    },
  )

  registerChannel(
    IPC.AI_FILTER_JUDGE,
    async (_event, input: AISemanticFilterInput) => {
      const settings = settingsProvider.get()
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
    return getDb().digests.listAIDigestRuns(limit)
  })

  registerChannel(
    IPC.AI_DIGEST_GENERATE,
    async (
      _event,
      input?: AIDigestGenerateInput,
    ): Promise<AIDigestGenerateResult> => {
      const preset = normalizeDigestPreset(input?.preset)
      const { promise } = runLoggedTask<
        AiDigestGenerateTaskPayload,
        AIDigestGenerateResult
      >({
        contract: AI_DIGEST_GENERATE_TASK,
        payload: { preset, feedId: input?.feedId },
        handler: async (payload, context) =>
          generateAIDigest(
            {
              preset: normalizeDigestPreset(payload.preset),
              feedId: payload.feedId,
            },
            context,
          ),
        operationKey: USER_OPERATION_KEYS.AI_DIGEST_GENERATE,
        metadata: {
          preset,
          feedId: input?.feedId,
        },
        target: { id: input?.feedId },
        resultStatus: (result) => (result.success ? 'succeeded' : 'failed'),
        resultError: (result) => (result.success ? undefined : result.error),
        details: {
          queued: { preset },
          succeeded: (result) => ({
            preset,
            digestRunId: result.run?.id,
          }),
          resultFailed: (result) => ({
            preset,
            digestRunId: result.success ? undefined : result.run?.id,
          }),
        },
      })
      try {
        return await promise
      } catch (error) {
        const settings = settingsProvider.get()
        return { success: false, error: normalizeAIError(error, settings.ai) }
      }
    },
  )

  // Connection test
  registerChannel(IPC.AI_TEST_CONNECTION, async () => {
    const settings = settingsProvider.get()
    const aiConfig = settings.ai

    return ConnectionTestService.run({
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl || '',
      provider: aiConfig.provider,
    })
  })
}
