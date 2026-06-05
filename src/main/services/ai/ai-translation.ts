import type {
  AITranslateEntrySegmentsInput,
  AITranslateEntrySegmentsResult,
  EntryAITranslationSegment,
  EntryAITranslationSession,
  EntryAITranslationSessionStatus,
} from '../../../shared/types'
import { getDb } from '../../database'
import { settingsProvider } from '../system/settings-provider'
import { runAITranslateTask } from './ai-pipeline'

const TRANSLATION_CONCURRENCY = 3
const CONFIG_CHANGED_ERROR = 'AI 配置已变更，翻译已中止'

function getTranslationConfigFingerprint(): string {
  const { ai } = settingsProvider.get()
  return JSON.stringify({
    provider: ai.provider,
    apiKey: ai.apiKeys?.[ai.provider] ?? ai.apiKey,
    baseUrl: ai.baseUrl ?? '',
    model: ai.model,
    enableSystemPrompt: ai.enableSystemPrompt ?? false,
    systemPromptTemplate: ai.systemPromptTemplate ?? '',
    translationPrompt: ai.translationPrompt ?? '',
  })
}

function getTranslationModel(): string | undefined {
  return settingsProvider.get().ai.model
}

function shouldTranslateParagraph(paragraph: string): boolean {
  const plainText = paragraph.replace(/<[^>]*>/g, '').trim()
  return plainText.length >= 5
}

function buildSegments(
  paragraphs: string[],
  results: string[],
  errors: Record<number, string>,
  runningIndex?: number,
): EntryAITranslationSegment[] {
  return paragraphs.map((paragraph, index) => {
    const errorMessage = errors[index]
    const translatedText = results[index] ?? ''
    const status: EntryAITranslationSegment['status'] =
      !shouldTranslateParagraph(paragraph)
        ? 'skipped'
        : errorMessage
          ? 'failed'
          : translatedText
            ? 'succeeded'
            : runningIndex === index
              ? 'running'
              : 'queued'

    return {
      index,
      sourceText: paragraph,
      translatedText,
      status,
      errorMessage,
    }
  })
}

function sessionMatchesInput(
  session: EntryAITranslationSession | null,
  input: AITranslateEntrySegmentsInput,
): session is EntryAITranslationSession {
  if (!session) return false
  if (session.targetLanguage !== input.targetLanguage) return false
  if (session.segments.length !== input.paragraphs.length) return false
  return session.segments.every(
    (segment, index) => segment.sourceText === input.paragraphs[index],
  )
}

function createOrResetSession(
  input: AITranslateEntrySegmentsInput,
  fingerprint: string,
): EntryAITranslationSession {
  const current = getDb().aiTranslationSessions.getLatestSessionByEntryId(
    input.entryId,
  )
  if (sessionMatchesInput(current, input)) {
    return current
  }

  return getDb().aiTranslationSessions.createSession({
    entryId: input.entryId,
    targetLanguage: input.targetLanguage,
    status: 'running',
    segments: buildSegments(input.paragraphs, [], {}),
    model: getTranslationModel(),
    configFingerprint: fingerprint,
  })
}

function sessionToResultState(session: EntryAITranslationSession): {
  translatedParagraphs: string[]
  errorMap: Record<number, string>
} {
  const translatedParagraphs: string[] = []
  const errorMap: Record<number, string> = {}
  for (const segment of session.segments) {
    translatedParagraphs[segment.index] = segment.translatedText || ''
    if (segment.status === 'failed' && segment.errorMessage) {
      errorMap[segment.index] = segment.errorMessage
    }
  }
  return { translatedParagraphs, errorMap }
}

function updateSession(
  sessionId: string,
  input: AITranslateEntrySegmentsInput,
  status: EntryAITranslationSessionStatus,
  results: string[],
  errors: Record<number, string>,
  patch: {
    errorCode?: string
    errorMessage?: string
    finishedAt?: number
  } = {},
): EntryAITranslationSession {
  const next =
    getDb().aiTranslationSessions.updateSession(sessionId, {
      targetLanguage: input.targetLanguage,
      status,
      segments: buildSegments(input.paragraphs, results, errors),
      errorCode: patch.errorCode,
      errorMessage: patch.errorMessage,
      model: getTranslationModel(),
      configFingerprint: getTranslationConfigFingerprint(),
      finishedAt: patch.finishedAt,
    }) ?? getDb().aiTranslationSessions.getSessionById(sessionId)

  if (!next) throw new Error('AI translation session update failed')
  return next
}

export async function translateEntrySegments(
  input: AITranslateEntrySegmentsInput,
): Promise<AITranslateEntrySegmentsResult> {
  const entryId = input.entryId.trim()
  const targetLanguage = input.targetLanguage.trim() || 'zh-CN'
  const paragraphs = input.paragraphs

  if (!entryId) return { success: false, error: 'entry_id_required' }
  if (paragraphs.length === 0) return { success: false, error: 'empty_content' }

  const normalizedInput = { ...input, entryId, targetLanguage, paragraphs }
  const expectedFingerprint = getTranslationConfigFingerprint()
  let session = createOrResetSession(normalizedInput, expectedFingerprint)
  const previous = sessionToResultState(session)
  const results = [...previous.translatedParagraphs]
  const errors: Record<number, string> = { ...previous.errorMap }

  const requestedIndexes =
    normalizedInput.indexes && normalizedInput.indexes.length > 0
      ? new Set(normalizedInput.indexes)
      : null
  const queue = paragraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph, index }) => {
      if (requestedIndexes && !requestedIndexes.has(index)) return false
      return shouldTranslateParagraph(paragraph)
    })

  session = updateSession(
    session.id,
    normalizedInput,
    'running',
    results,
    errors,
  )

  let cursor = 0
  const worker = async () => {
    while (cursor < queue.length) {
      const item = queue[cursor++]
      if (getTranslationConfigFingerprint() !== expectedFingerprint) {
        errors[item.index] = CONFIG_CHANGED_ERROR
        continue
      }

      try {
        session = updateSession(
          session.id,
          normalizedInput,
          'running',
          results,
          errors,
        )
        results[item.index] = ''
        delete errors[item.index]
        const result = await runAITranslateTask({
          content: item.paragraph,
          targetLanguage,
        })
        if (result.success) {
          results[item.index] = result.translation
          delete errors[item.index]
        }
      } catch (error) {
        results[item.index] = ''
        errors[item.index] =
          error instanceof Error ? error.message : String(error)
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(TRANSLATION_CONCURRENCY, queue.length) },
      () => worker(),
    ),
  )

  const configChanged = Object.values(errors).includes(CONFIG_CHANGED_ERROR)
  const hasErrors = Object.keys(errors).length > 0
  session = updateSession(
    session.id,
    normalizedInput,
    configChanged ? 'config_changed' : hasErrors ? 'failed' : 'succeeded',
    results,
    errors,
    {
      errorCode: configChanged ? 'config_changed' : undefined,
      errorMessage: configChanged
        ? CONFIG_CHANGED_ERROR
        : hasErrors
          ? '部分段落翻译失败'
          : undefined,
      finishedAt: Date.now(),
    },
  )

  const state = sessionToResultState(session)
  return { success: true, session, ...state }
}
