import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  pollWithBackoff,
  PollingAbortedError,
  PollingExhaustedError,
} from './polling'

afterEach(() => {
  vi.useRealTimers()
})

describe('pollWithBackoff', () => {
  it('returns immediately when the first result is complete', async () => {
    const poll = vi.fn(async () => 'done')

    await expect(
      pollWithBackoff(poll, (value) => value === 'done'),
    ).resolves.toBe('done')
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it('retries with exponential backoff until complete', async () => {
    vi.useFakeTimers()
    const poll = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('done')

    const task = pollWithBackoff(poll, (value) => value === 'done', {
      baseDelayMs: 100,
      backoffFactor: 2,
      maxAttempts: 3,
    })

    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)

    await expect(task).resolves.toBe('done')
    expect(poll).toHaveBeenCalledTimes(3)
  })

  it('throws when attempts are exhausted', async () => {
    vi.useFakeTimers()
    const poll = vi.fn(async () => 'pending')

    const task = pollWithBackoff(poll, (value) => value === 'done', {
      baseDelayMs: 10,
      maxAttempts: 2,
    })
    const assertion = expect(task).rejects.toBeInstanceOf(PollingExhaustedError)

    await vi.advanceTimersByTimeAsync(10)

    await assertion
    expect(poll).toHaveBeenCalledTimes(2)
  })

  it('can be aborted while waiting for the next attempt', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const poll = vi.fn(async () => 'pending')

    const task = pollWithBackoff(poll, (value) => value === 'done', {
      baseDelayMs: 1000,
      maxAttempts: 3,
      signal: controller.signal,
    })
    const assertion = expect(task).rejects.toBeInstanceOf(PollingAbortedError)

    await vi.advanceTimersByTimeAsync(100)
    controller.abort()

    await assertion
    expect(poll).toHaveBeenCalledTimes(1)
  })
})
