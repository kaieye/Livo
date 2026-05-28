import { useState, useCallback, useRef } from 'react'

interface AISummaryState {
  /** The generated summary text, null when no summary has been generated */
  summary: string | null
  /** Error message, null when no error occurred */
  error: string | null
  /** Whether a summarize request is in flight */
  isLoading: boolean
  /** Trigger a summary generation. Content and language are passed at call time. */
  summarize: (content: string, language?: string) => Promise<void>
  /** Reset all state (summary, error, loading) — call on entry change */
  reset: () => void
}

/**
 * Self-contained AI summary state machine.
 *
 * States: idle → loading → success (has summary) | error (has error)
 * Call `reset()` when the article context changes (e.g. entry switch).
 *
 * Design: content is passed at `summarize()` call time, not as hook param.
 * This keeps the hook content-agnostic and reusable across different content sources
 * (HTML from EntryContent, plain text from WideViewContent, social text from EntryList).
 */
export function useAISummary(): AISummaryState {
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Track in-flight request to avoid stale state updates
  const requestIdRef = useRef(0)

  const summarize = useCallback(async (content: string, language?: string) => {
    const requestId = ++requestIdRef.current

    setSummary(null)
    setError(null)
    setIsLoading(true)

    try {
      const result = await window.api.ai.summarize(content, language)

      // Guard against stale responses (user navigated away mid-request)
      if (requestId !== requestIdRef.current) return

      if (result.success) {
        setSummary(result.summary)
        setError(null)
      } else {
        setError(result.error ?? 'Unknown error')
        setSummary(null)
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(String(err))
      setSummary(null)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++ // invalidate in-flight requests
    setSummary(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return { summary, error, isLoading, summarize, reset }
}
