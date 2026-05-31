/**
 * Multi-round AI call retry strategy — the desktop equivalent of Harmony's
 * `TranslationPipeline`.
 *
 * AI providers can fail transiently (rate limits, 5xx, timeouts) or return an
 * empty body when the request degrades (context too long, model hiccup). This
 * helper retries with exponential backoff, treating an *empty* result as a
 * soft failure that also triggers a retry. Configuration errors (bad API key,
 * 4xx) are non-retryable and surface immediately so the user can fix them.
 */

export interface RetryOptions<T> {
  /** Total attempts including the first. Default 3. */
  maxAttempts?: number
  /** Base backoff delay in ms (doubles each retry). Default 400. */
  baseDelayMs?: number
  /** Upper bound on a single backoff delay. Default 4000. */
  maxDelayMs?: number
  /** Treat a produced value as a soft failure (e.g. empty string) → retry. */
  isEmpty?: (value: T) => boolean
  /** Decide whether a thrown error is worth retrying. Defaults to {@link isRetryableAIError}. */
  isRetryableError?: (error: unknown) => boolean
  /** Observability hook fired before each retry sleep. */
  onRetry?: (info: {
    attempt: number
    error?: unknown
    empty?: boolean
  }) => void
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  return undefined
}

/**
 * Heuristic for whether an AI provider error is transient.
 *
 * - 408 (timeout), 409 (conflict), 429 (rate limit) and all 5xx → retryable
 * - other 4xx (401/403 auth, 400 bad request) → non-retryable config errors
 * - errors without a status (network/timeout) → retryable
 */
export function isRetryableAIError(error: unknown): boolean {
  const status = statusOf(error)
  if (status === undefined) {
    // Network errors / aborted requests carry no HTTP status — worth a retry.
    return true
  }
  if (status === 408 || status === 409 || status === 429) return true
  if (status >= 500) return true
  return false
}

/**
 * Run `fn` with retry + exponential backoff. `fn` receives the zero-based
 * attempt index so callers can degrade the request (shorter context, fewer
 * tokens) on later tiers — mirroring the Harmony TranslationPipeline.
 *
 * Throws the last error if every attempt fails; throws an "empty result" error
 * if all attempts produced empty values.
 */
export async function runWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions<T> = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 400,
    maxDelayMs = 4000,
    isEmpty,
    isRetryableError = isRetryableAIError,
    onRetry,
    sleep = defaultSleep,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isLast = attempt === maxAttempts - 1
    try {
      const value = await fn(attempt)
      if (isEmpty?.(value)) {
        if (isLast) {
          throw new Error('AI returned an empty result')
        }
        onRetry?.({ attempt, empty: true })
        await sleep(backoff(attempt, baseDelayMs, maxDelayMs))
        continue
      }
      return value
    } catch (error) {
      lastError = error
      if (isLast || !isRetryableError(error)) {
        throw error
      }
      onRetry?.({ attempt, error })
      await sleep(backoff(attempt, baseDelayMs, maxDelayMs))
    }
  }

  // Unreachable in practice (loop either returns or throws), but keeps TS happy.
  throw lastError instanceof Error
    ? lastError
    : new Error('AI request failed after retries')
}

function backoff(attempt: number, base: number, max: number): number {
  return Math.min(base * 2 ** attempt, max)
}
