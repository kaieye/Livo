import { useState, useCallback, useRef } from 'react'
import { getSettingsSnapshot } from '../store/settings-store'

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

function isConfigChangedError(error: unknown): boolean {
  return error instanceof Error && error.message === CONFIG_CHANGED_ERROR
}

function shouldTranslateParagraph(paragraph: string): boolean {
  const plainText = paragraph.replace(/<[^>]*>/g, '').trim()
  return plainText.length >= 5
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
export function useAITranslation(): AITranslationState {
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
        } else {
          results[index] = ''
          errors[index] = result.error ?? 'Translation failed'
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
          return
        }
      } finally {
        cleanupChunk()
        cleanupError()
      }

      if (requestId === requestIdRef.current) {
        setTranslatedParagraphs([...results])
        setErrorMap({ ...errors })
      }
    },
    [],
  )

  const translate = useCallback(
    async (paragraphs: string[], targetLang: string) => {
      const requestId = ++requestIdRef.current
      const expectedFingerprint = getTranslationConfigFingerprint()

      contextRef.current = { paragraphs, targetLang }
      const results = paragraphs.map(() => '')
      const errors: TranslationErrorMap = {}

      setTranslatedParagraphs(results)
      setErrorMap({})
      setIsTranslating(true)
      setShowTranslation(true)

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
      }
    },
    [translateSegment],
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
      }
    },
    [errorMap, translateSegment, translatedParagraphs],
  )

  const toggle = useCallback(() => {
    setShowTranslation((prev) => !prev)
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++ // invalidate in-flight requests
    contextRef.current = null
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
