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
})
