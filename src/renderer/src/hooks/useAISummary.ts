import { useState, useCallback, useRef } from 'react'

interface AIStreamPayload {
  requestId: string
  content?: string
  error?: string
}

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

function createAIRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isAIStreamPayload(value: unknown): value is AIStreamPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return typeof payload.requestId === 'string'
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
    const streamRequestId = createAIRequestId('summary')

    setSummary(null)
    setError(null)
    setIsLoading(true)

    const cleanupChunk = window.api.on('ai:summary-stream-chunk', (data) => {
      if (!isAIStreamPayload(data)) return
      if (data.requestId !== streamRequestId || !data.content) return
      if (requestId !== requestIdRef.current) return
      setSummary((prev) => `${prev ?? ''}${data.content}`)
    })
    const cleanupError = window.api.on('ai:summary-stream-error', (data) => {
      if (!isAIStreamPayload(data)) return
      if (data.requestId !== streamRequestId) return
      if (requestId !== requestIdRef.current) return
      setError(data.error ?? 'Unknown error')
    })

    try {
      const result = await window.api.ai.summarize(
        content,
        language,
        streamRequestId,
      )

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
      cleanupChunk()
      cleanupError()
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
