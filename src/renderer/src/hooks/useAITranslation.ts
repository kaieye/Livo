import { useState, useCallback, useEffect, useRef } from 'react'
import type { EntryAITranslationSession } from '../../../shared/types'

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
   * Translate paragraphs to target language.
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

function sessionToState(session: EntryAITranslationSession): {
  translatedParagraphs: string[]
  errorMap: TranslationErrorMap
} {
  const translatedParagraphs: string[] = []
  const errorMap: TranslationErrorMap = {}
  const segments = [...session.segments].sort(
    (left, right) => left.index - right.index,
  )
  for (const segment of segments) {
    translatedParagraphs[segment.index] = segment.translatedText || ''
    if (segment.status === 'failed' && segment.errorMessage) {
      errorMap[segment.index] = segment.errorMessage
    }
  }
  return { translatedParagraphs, errorMap }
}

/**
 * UI Adapter for Entry AI Translation.
 *
 * The translation run, segment persistence, concurrency, and failure state live
 * behind the Main/Web platform API. This hook preserves the previous Renderer
 * Interface for reader views.
 */
export function useAITranslation(
  options: AITranslationOptions = {},
): AITranslationState {
  const { entryId } = options
  const [translatedParagraphs, setTranslatedParagraphs] = useState<string[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [errorMap, setErrorMap] = useState<TranslationErrorMap>({})
  const requestIdRef = useRef(0)
  const contextRef = useRef<{
    paragraphs: string[]
    targetLang: string
  } | null>(null)

  useEffect(() => {
    if (!entryId) return
    let canceled = false

    window.api.ai
      .getTranslationSession(entryId)
      .then((session) => {
        if (canceled || !session) return
        const next = sessionToState(session)
        setTranslatedParagraphs(next.translatedParagraphs)
        setErrorMap(next.errorMap)
        setShowTranslation(
          next.translatedParagraphs.some((text) => text.length > 0) ||
            Object.keys(next.errorMap).length > 0,
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

  const applySession = useCallback(
    (session: EntryAITranslationSession | undefined) => {
      if (!session) return
      const next = sessionToState(session)
      setTranslatedParagraphs(next.translatedParagraphs)
      setErrorMap(next.errorMap)
      setShowTranslation(true)
    },
    [],
  )

  const translate = useCallback(
    async (paragraphs: string[], targetLang: string) => {
      const requestId = ++requestIdRef.current
      contextRef.current = { paragraphs, targetLang }
      setTranslatedParagraphs(paragraphs.map(() => ''))
      setErrorMap({})
      setIsTranslating(true)
      setShowTranslation(true)

      if (!entryId) {
        if (requestId === requestIdRef.current) {
          setErrorMap({ 0: 'entry_id_required' })
          setIsTranslating(false)
        }
        return
      }

      const result = await window.api.ai.translateEntrySegments({
        entryId,
        paragraphs,
        targetLanguage: targetLang,
      })

      if (requestId !== requestIdRef.current) return
      if (result.success) {
        setTranslatedParagraphs(result.translatedParagraphs)
        setErrorMap(result.errorMap)
        applySession(result.session)
      } else {
        setErrorMap({ 0: result.error })
        applySession(result.session)
      }
      setIsTranslating(false)
    },
    [applySession, entryId],
  )

  const retrySegment = useCallback(
    async (index: number) => {
      const context = contextRef.current
      if (!context || !context.paragraphs[index]) return
      if (!entryId) return

      const requestId = ++requestIdRef.current
      setIsTranslating(true)
      setShowTranslation(true)

      const result = await window.api.ai.translateEntrySegments({
        entryId,
        paragraphs: context.paragraphs,
        targetLanguage: context.targetLang,
        indexes: [index],
      })

      if (requestId !== requestIdRef.current) return
      if (result.success) {
        setTranslatedParagraphs(result.translatedParagraphs)
        setErrorMap(result.errorMap)
        applySession(result.session)
      } else {
        setErrorMap((current) => ({ ...current, [index]: result.error }))
        applySession(result.session)
      }
      setIsTranslating(false)
    },
    [applySession, entryId],
  )

  const toggle = useCallback(() => {
    setShowTranslation((prev) => !prev)
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++
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
