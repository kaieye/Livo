import { useState, useCallback, useRef } from 'react'

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
  /** Toggle bilingual view visibility without discarding translations */
  toggle: () => void
  /** Reset all state — call on entry change */
  reset: () => void
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

  const translate = useCallback(
    async (paragraphs: string[], targetLang: string) => {
      const requestId = ++requestIdRef.current

      setTranslatedParagraphs([])
      setErrorMap({})
      setIsTranslating(true)
      setShowTranslation(true)

      const results: string[] = []
      const errors: TranslationErrorMap = {}

      for (let i = 0; i < paragraphs.length; i++) {
        // Guard against stale request (user navigated away mid-translation)
        if (requestId !== requestIdRef.current) return

        const plainText = paragraphs[i].replace(/<[^>]*>/g, '').trim()
        if (!plainText || plainText.length < 5) {
          results.push('')
          continue
        }

        try {
          const result = await window.api.ai.translate(
            paragraphs[i],
            targetLang,
          )
          // Guard again after async boundary
          if (requestId !== requestIdRef.current) return

          if (result.success) {
            results.push(result.translation)
          } else {
            results.push('')
            errors[i] = result.error ?? 'Translation failed'
          }
        } catch (err) {
          if (requestId !== requestIdRef.current) return
          results.push('')
          errors[i] = String(err)
        }

        // Progressive update — show each paragraph as it completes
        if (requestId === requestIdRef.current) {
          setTranslatedParagraphs([...results])
          if (Object.keys(errors).length > 0) {
            setErrorMap({ ...errors })
          }
        }
      }

      if (requestId === requestIdRef.current) {
        setIsTranslating(false)
      }
    },
    [],
  )

  const toggle = useCallback(() => {
    setShowTranslation((prev) => !prev)
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++ // invalidate in-flight requests
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
    toggle,
    reset,
  }
}
