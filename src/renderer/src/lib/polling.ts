export interface PollWithBackoffOptions {
  /** 最大尝试次数，包含首次立即执行。 */
  maxAttempts?: number
  /** 首次重试前的等待时间。 */
  baseDelayMs?: number
  /** 单次等待时间上限。 */
  maxDelayMs?: number
  /** 每次失败后的退避倍率。 */
  backoffFactor?: number
  /** 外部取消信号，常用于组件卸载或视图切换。 */
  signal?: AbortSignal
}

export class PollingAbortedError extends Error {
  constructor() {
    super('Polling aborted')
    this.name = 'PollingAbortedError'
  }
}

export class PollingExhaustedError extends Error {
  constructor(attempts: number) {
    super(`Polling exhausted after ${attempts} attempt(s)`)
    this.name = 'PollingExhaustedError'
  }
}

export interface PollAttemptContext {
  attempt: number
}

const DEFAULT_MAX_ATTEMPTS = 8
const DEFAULT_BASE_DELAY_MS = 400
const DEFAULT_MAX_DELAY_MS = 5000
const DEFAULT_BACKOFF_FACTOR = 1.8

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new PollingAbortedError()
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  assertNotAborted(signal)

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener('abort', abort)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const abort = () => {
      clearTimeout(timer)
      cleanup()
      reject(new PollingAbortedError())
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

function getBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
): number {
  const safeAttempt = Math.max(0, attempt)
  const delay = baseDelayMs * Math.pow(backoffFactor, safeAttempt)
  return Math.min(Math.round(delay), maxDelayMs)
}

/**
 * 执行“立即请求 + 退避轮询”，直到 `isDone` 判定完成或达到最大尝试次数。
 */
export async function pollWithBackoff<T>(
  poll: (context: PollAttemptContext) => Promise<T>,
  isDone: (result: T, context: PollAttemptContext) => boolean,
  options: PollWithBackoffOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR

  if (maxAttempts <= 0) {
    throw new PollingExhaustedError(0)
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    assertNotAborted(options.signal)

    const context = { attempt }
    const result = await poll(context)
    if (isDone(result, context)) {
      return result
    }

    if (attempt === maxAttempts - 1) {
      throw new PollingExhaustedError(maxAttempts)
    }

    await sleep(
      getBackoffDelay(attempt, baseDelayMs, maxDelayMs, backoffFactor),
      options.signal,
    )
  }

  throw new PollingExhaustedError(maxAttempts)
}
