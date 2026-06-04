import { useState, useCallback, useEffect, useRef } from 'react'
import { getSettingsSnapshot } from '../store/settings-store'
import type {
  EntryAITranslationSegment,
  EntryAITranslationSessionStatus,
} from '../../../shared/types'

interface AIStreamPayload {
  requestId: string
  content?: string
  error?: string
}

/**
 * Per-paragraph error record. Key is paragraph index, value is error message.
 * Only failed paragraphs appear; successful/empty paragraphs are absent.
 */
export type TranslationErrorMap = Record<number, string>

export interface AITranslationState {
  /** Translated HTML per paragraph (same length as input after translate()) */
  translatedParagraphs: string[]
  /** Whether a translation request is in flight */
  isTranslating: boolean
  /** Whether the bilingual view is currently shown */
  showTranslation: boolean
  /** Per-paragraph errors. Only populated for failed paragraphs. */
  errorMap: TranslationErrorMap
  /**
   * Translate paragraphs to target language. Translates paragraph-by-paragraph
   * with progressive display (updates state after each paragraph completes).
   * Skips paragraphs shorter than 5 chars.
   *
   * Call sites should handle the toggle logic themselves (show/hide).
   */
  translate: (paragraphs: string[], targetLang: string) => Promise<void>
  /** Retry a single failed paragraph without discarding existing translations */
  retrySegment: (index: number) => Promise<void>
  /** Toggle bilingual view visibility without discarding translations */
  toggle: () => void
  /** Reset all state — call on entry change */
  reset: () => void
}

export interface AITranslationOptions {
  entryId?: string
}

function createAIRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isAIStreamPayload(value: unknown): value is AIStreamPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return typeof payload.requestId === 'string'
}

const TRANSLATION_CONCURRENCY = 3
const CONFIG_CHANGED_ERROR = 'AI 配置已变更，翻译已中止'

function getTranslationConfigFingerprint(): string {
  const { ai } = getSettingsSnapshot()
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
  return getSettingsSnapshot().ai.model
}

function isConfigChangedError(error: unknown): boolean {
  return error instanceof Error && error.message === CONFIG_CHANGED_ERROR
}

function shouldTranslateParagraph(paragraph: string): boolean {
  const plainText = paragraph.replace(/<[^>]*>/g, '').trim()
  return plainText.length >= 5
}

function buildTranslationSegments(
  paragraphs: string[],
  results: string[],
  errors: TranslationErrorMap,
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

/**
 * Self-contained paragraph-by-paragraph AI translation state machine.
 *
 * States: idle → loading (progressive updates) → complete
 * Call `reset()` when the article context changes; call `toggle()` to
 * show/hide the bilingual view without re-fetching.
 *
 * Design: content is passed at `translate()` call time, keeping the hook
 * content-agnostic and reusable across components (EntryContent, WideViewContent, etc.).
 */
export function useAITranslation(
  options: AITranslationOptions = {},
): AITranslationState {
  const { entryId } = options
  const [translatedParagraphs, setTranslatedParagraphs] = useState<string[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [errorMap, setErrorMap] = useState<TranslationErrorMap>({})

  // Track in-flight request to avoid stale state updates
  const requestIdRef = useRef(0)
  const contextRef = useRef<{
    paragraphs: string[]
    targetLang: string
  } | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!entryId) return
    let canceled = false

    window.api.ai
      .getTranslationSession(entryId)
      .then((session) => {
        if (canceled || !session) return
        sessionIdRef.current = session.id

        const segments = [...session.segments].sort(
          (left, right) => left.index - right.index,
        )
        const nextTranslations: string[] = []
        const nextErrors: TranslationErrorMap = {}
        for (const segment of segments) {
          nextTranslations[segment.index] = segment.translatedText || ''
          if (segment.status === 'failed' && segment.errorMessage) {
            nextErrors[segment.index] = segment.errorMessage
          }
        }

        setTranslatedParagraphs(nextTranslations)
        setErrorMap(nextErrors)
        setShowTranslation(
          nextTranslations.some((text) => text.length > 0) ||
            Object.keys(nextErrors).length > 0,
        )
        setIsTranslating(
          session.status === 'queued' || session.status === 'running',
        )
      })
      .catch(() => {})

    return () => {
      canceled = true
    }
  }, [entryId])

  const persistSession = useCallback(
    async (
      status: EntryAITranslationSessionStatus,
      segments: EntryAITranslationSegment[],
      patch?: {
        targetLanguage?: string
        errorCode?: string
        errorMessage?: string
        runId?: string
        finishedAt?: number
      },
    ) => {
      if (!entryId) return
      const payload = {
        targetLanguage: patch?.targetLanguage,
        status,
        segments,
        errorCode: patch?.errorCode,
        errorMessage: patch?.errorMessage,
        model: getTranslationModel(),
        configFingerprint: getTranslationConfigFingerprint(),
        runId: patch?.runId,
        finishedAt: patch?.finishedAt,
      }

      if (sessionIdRef.current) {
        await window.api.ai.updateTranslationSession(
          sessionIdRef.current,
          payload,
        )
        return
      }

      const session = await window.api.ai.createTranslationSession({
        entryId,
        targetLanguage: patch?.targetLanguage || 'zh-CN',
        status,
        segments,
        model: payload.model,
        configFingerprint: payload.configFingerprint,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        runId: payload.runId,
      })
      sessionIdRef.current = session.id
    },
    [entryId],
  )

  const translateSegment = useCallback(
    async (
      index: number,
      paragraphs: string[],
      targetLang: string,
      requestId: number,
      expectedFingerprint: string,
      results: string[],
      errors: TranslationErrorMap,
    ) => {
      if (requestId !== requestIdRef.current) return
      if (!shouldTranslateParagraph(paragraphs[index])) {
        results[index] = ''
        return
      }
      if (getTranslationConfigFingerprint() !== expectedFingerprint) {
        requestIdRef.current++
        results[index] = ''
        errors[index] = CONFIG_CHANGED_ERROR
        setErrorMap({ ...errors })
        setIsTranslating(false)
        void persistSession(
          'config_changed',
          buildTranslationSegments(paragraphs, results, errors),
          {
            targetLanguage: targetLang,
            errorCode: 'config_changed',
            errorMessage: CONFIG_CHANGED_ERROR,
            finishedAt: Date.now(),
          },
        )
        return
      }

      let cleanupChunk = () => {}
      let cleanupError = () => {}
      try {
        const streamRequestId = createAIRequestId(`translate-${index}`)
        cleanupChunk = window.api.on('ai:translate-stream-chunk', (data) => {
          if (!isAIStreamPayload(data)) return
          if (data.requestId !== streamRequestId || !data.content) return
          if (requestId !== requestIdRef.current) return
          if (getTranslationConfigFingerprint() !== expectedFingerprint) {
            requestIdRef.current++
            errors[index] = CONFIG_CHANGED_ERROR
            setErrorMap({ ...errors })
            setIsTranslating(false)
            void persistSession(
              'config_changed',
              buildTranslationSegments(paragraphs, results, errors),
              {
                targetLanguage: targetLang,
                errorCode: 'config_changed',
                errorMessage: CONFIG_CHANGED_ERROR,
                finishedAt: Date.now(),
              },
            )
            return
          }

          results[index] = `${results[index] ?? ''}${data.content}`
          delete errors[index]
          setTranslatedParagraphs([...results])
          setErrorMap({ ...errors })
        })
        cleanupError = window.api.on('ai:translate-stream-error', (data) => {
          if (!isAIStreamPayload(data)) return
          if (data.requestId !== streamRequestId) return
          if (requestId !== requestIdRef.current) return

          errors[index] = data.error ?? 'Translation failed'
          setErrorMap({ ...errors })
        })

        const result = await window.api.ai.translate(
          paragraphs[index],
          targetLang,
          streamRequestId,
        )

        if (requestId !== requestIdRef.current) return
        if (getTranslationConfigFingerprint() !== expectedFingerprint) {
          throw new Error(CONFIG_CHANGED_ERROR)
        }

        if (result.success) {
          results[index] = result.translation
          delete errors[index]
          void persistSession(
            'running',
            buildTranslationSegments(paragraphs, results, errors),
            {
              targetLanguage: targetLang,
              runId: (result as { runId?: string }).runId,
            },
          )
        } else {
          results[index] = ''
          errors[index] = result.error ?? 'Translation failed'
          void persistSession(
            'running',
            buildTranslationSegments(paragraphs, results, errors),
            { targetLanguage: targetLang },
          )
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        results[index] = ''
        errors[index] = isConfigChangedError(err)
          ? CONFIG_CHANGED_ERROR
          : String(err)
        if (isConfigChangedError(err)) {
          requestIdRef.current++
          setErrorMap({ ...errors })
          setIsTranslating(false)
          void persistSession(
            'config_changed',
            buildTranslationSegments(paragraphs, results, errors),
            {
              targetLanguage: targetLang,
              errorCode: 'config_changed',
              errorMessage: CONFIG_CHANGED_ERROR,
              finishedAt: Date.now(),
            },
          )
          return
        }
        void persistSession(
          'running',
          buildTranslationSegments(paragraphs, results, errors),
          { targetLanguage: targetLang },
        )
      } finally {
        cleanupChunk()
        cleanupError()
      }

      if (requestId === requestIdRef.current) {
        setTranslatedParagraphs([...results])
        setErrorMap({ ...errors })
      }
    },
    [persistSession],
  )

  const translate = useCallback(
    async (paragraphs: string[], targetLang: string) => {
      const requestId = ++requestIdRef.current
      const expectedFingerprint = getTranslationConfigFingerprint()

      contextRef.current = { paragraphs, targetLang }
      const results = paragraphs.map(() => '')
      const errors: TranslationErrorMap = {}
      sessionIdRef.current = null

      setTranslatedParagraphs(results)
      setErrorMap({})
      setIsTranslating(true)
      setShowTranslation(true)
      await persistSession(
        'running',
        buildTranslationSegments(paragraphs, results, errors),
        { targetLanguage: targetLang },
      ).catch(() => {})

      const queue = paragraphs
        .map((paragraph, index) => ({ paragraph, index }))
        .filter(({ paragraph }) => shouldTranslateParagraph(paragraph))
      let cursor = 0

      async function worker() {
        while (cursor < queue.length && requestId === requestIdRef.current) {
          const item = queue[cursor++]
          await translateSegment(
            item.index,
            paragraphs,
            targetLang,
            requestId,
            expectedFingerprint,
            results,
            errors,
          )
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(TRANSLATION_CONCURRENCY, queue.length) },
          () => worker(),
        ),
      )

      if (requestId === requestIdRef.current) {
        setIsTranslating(false)
        const hasErrors = Object.keys(errors).length > 0
        void persistSession(
          hasErrors ? 'failed' : 'succeeded',
          buildTranslationSegments(paragraphs, results, errors),
          {
            targetLanguage: targetLang,
            errorMessage: hasErrors ? '部分段落翻译失败' : undefined,
            finishedAt: Date.now(),
          },
        )
      }
    },
    [persistSession, translateSegment],
  )

  const retrySegment = useCallback(
    async (index: number) => {
      const context = contextRef.current
      if (!context || !context.paragraphs[index]) return

      const requestId = ++requestIdRef.current
      const expectedFingerprint = getTranslationConfigFingerprint()
      const results = [...translatedParagraphs]
      const errors: TranslationErrorMap = { ...errorMap }

      results[index] = ''
      delete errors[index]
      setTranslatedParagraphs(results)
      setErrorMap(errors)
      setIsTranslating(true)
      setShowTranslation(true)
      await persistSession(
        'running',
        buildTranslationSegments(context.paragraphs, results, errors, index),
        { targetLanguage: context.targetLang },
      ).catch(() => {})

      await translateSegment(
        index,
        context.paragraphs,
        context.targetLang,
        requestId,
        expectedFingerprint,
        results,
        errors,
      )

      if (requestId === requestIdRef.current) {
        setIsTranslating(false)
        const hasErrors = Object.keys(errors).length > 0
        void persistSession(
          hasErrors ? 'failed' : 'succeeded',
          buildTranslationSegments(context.paragraphs, results, errors),
          {
            targetLanguage: context.targetLang,
            errorMessage: hasErrors ? '部分段落翻译失败' : undefined,
            finishedAt: Date.now(),
          },
        )
      }
    },
    [errorMap, persistSession, translateSegment, translatedParagraphs],
  )

  const toggle = useCallback(() => {
    setShowTranslation((prev) => !prev)
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++ // invalidate in-flight requests
    contextRef.current = null
    sessionIdRef.current = null
    setTranslatedParagraphs([])
    setIsTranslating(false)
    setShowTranslation(false)
    setErrorMap({})
  }, [])

  return {
    translatedParagraphs,
    isTranslating,
    showTranslation,
    errorMap,
    translate,
    retrySegment,
    toggle,
    reset,
  }
}
