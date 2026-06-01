import { describe, expect, it, vi } from 'vitest'
import { isRetryableAIError, runWithRetry } from './ai-retry'

const noSleep = () => Promise.resolve()

describe('isRetryableAIError', () => {
  it('retries 5xx, 429, 408 and network errors', () => {
    expect(isRetryableAIError({ status: 500 })).toBe(true)
    expect(isRetryableAIError({ status: 503 })).toBe(true)
    expect(isRetryableAIError({ status: 429 })).toBe(true)
    expect(isRetryableAIError({ status: 408 })).toBe(true)
    expect(isRetryableAIError(new Error('ECONNRESET'))).toBe(true)
  })

  it('does not retry auth / bad-request errors', () => {
    expect(isRetryableAIError({ status: 401 })).toBe(false)
    expect(isRetryableAIError({ status: 403 })).toBe(false)
    expect(isRetryableAIError({ status: 400 })).toBe(false)
  })

  it('does not retry AbortError (the caller already gave up)', () => {
    expect(isRetryableAIError({ name: 'AbortError' })).toBe(false)
    const err = new Error('cancelled')
    err.name = 'AbortError'
    expect(isRetryableAIError(err)).toBe(false)
  })
})

describe('runWithRetry', () => {
  it('returns the first successful non-empty result', async () => {
    const fn = vi.fn(async () => 'ok')
    const result = await runWithRetry(fn, { sleep: noSleep })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries transient errors then succeeds', async () => {
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls < 3) throw { status: 503 }
      return 'recovered'
    })
    const result = await runWithRetry(fn, { sleep: noSleep })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('retries empty results, degrading via the attempt index', async () => {
    const attempts: number[] = []
    const fn = vi.fn(async (attempt: number) => {
      attempts.push(attempt)
      return attempt < 2 ? '' : 'finally'
    })
    const result = await runWithRetry(fn, {
      isEmpty: (text) => !text.trim(),
      sleep: noSleep,
    })
    expect(result).toBe('finally')
    expect(attempts).toEqual([0, 1, 2])
  })

  it('throws immediately on non-retryable errors', async () => {
    const fn = vi.fn(async () => {
      throw { status: 401 }
    })
    await expect(runWithRetry(fn, { sleep: noSleep })).rejects.toEqual({
      status: 401,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws an empty-result error when all attempts are empty', async () => {
    const fn = vi.fn(async () => '   ')
    await expect(
      runWithRetry(fn, {
        maxAttempts: 2,
        isEmpty: (text) => !text.trim(),
        sleep: noSleep,
      }),
    ).rejects.toThrow(/empty result/i)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fires onRetry for both error and empty retries', async () => {
    const onRetry = vi.fn()
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls === 1) throw { status: 500 }
      if (calls === 2) return ''
      return 'done'
    })
    await runWithRetry(fn, {
      isEmpty: (t) => !t.trim(),
      onRetry,
      sleep: noSleep,
    })
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 0 })
    expect(onRetry.mock.calls[1][0]).toMatchObject({ attempt: 1, empty: true })
  })

  it('aborts the loop when the signal is already triggered', async () => {
    const fn = vi.fn(async () => 'never')
    const controller = new AbortController()
    controller.abort()
    await expect(
      runWithRetry(fn, { sleep: noSleep, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('interrupts the in-flight backoff sleep when the signal fires', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)
    const fn = vi.fn(async () => {
      throw { status: 500 }
    })
    const start = Date.now()
    await expect(
      runWithRetry(fn, {
        baseDelayMs: 5000,
        maxDelayMs: 5000,
        sleep: noSleep,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    // 5000ms backoff was interrupted almost immediately by the abort at 10ms.
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it('does not retry when fn throws an AbortError', async () => {
    const fn = vi.fn(async () => {
      const err = new Error('cancelled')
      err.name = 'AbortError'
      throw err
    })
    await expect(runWithRetry(fn, { sleep: noSleep })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
