import { describe, expect, it, vi } from 'vitest'
import { TaskRunner } from './task-runner'
import type { TaskContract } from './task-contracts'

describe('TaskRunner', () => {
  it('dedupes active runs by task name and key', async () => {
    let calls = 0
    const runner = new TaskRunner()
    const contract: TaskContract<{ id: string }> = {
      name: 'test.dedupe',
      concurrency: 1,
      dedupeKey: (payload) => payload.id,
    }

    const first = runner.enqueue(contract, { id: 'a' }, async () => {
      calls++
      return 42
    })
    const second = runner.enqueue(contract, { id: 'a' }, async () => 0)

    expect(second.runId).toBe(first.runId)
    await expect(second.promise).resolves.toBe(42)
    expect(calls).toBe(1)
  })

  it('respects per-task concurrency', async () => {
    const runner = new TaskRunner()
    const contract: TaskContract<{ id: number }> = {
      name: 'test.concurrency',
      concurrency: 1,
    }
    const order: string[] = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = runner.enqueue(contract, { id: 1 }, async () => {
      order.push('start-1')
      await firstGate
      order.push('end-1')
      return 1
    })
    const second = runner.enqueue(contract, { id: 2 }, async () => {
      order.push('start-2')
      return 2
    })

    await Promise.resolve()
    expect(order).toEqual(['start-1'])
    releaseFirst()
    await expect(Promise.all([first.promise, second.promise])).resolves.toEqual(
      [1, 2],
    )
    expect(order).toEqual(['start-1', 'end-1', 'start-2'])
  })

  it('records retry attempts before succeeding', async () => {
    const runner = new TaskRunner()
    const contract: TaskContract<void> = {
      name: 'test.retry',
      concurrency: 1,
      retry: { maxAttempts: 2 },
    }
    let calls = 0

    const run = runner.enqueue(contract, undefined, async () => {
      calls++
      if (calls === 1) throw new Error('first failed')
      return 'ok'
    })

    await expect(run.promise).resolves.toBe('ok')
    expect(calls).toBe(2)
    expect(run.getRecord()).toMatchObject({
      status: 'succeeded',
      attempt: 2,
    })
  })

  it('marks timed out runs', async () => {
    vi.useFakeTimers()
    try {
      const runner = new TaskRunner()
      const contract: TaskContract<void> = {
        name: 'test.timeout',
        concurrency: 1,
        timeoutMs: 10,
      }

      const run = runner.enqueue(contract, undefined, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 'late'
      })

      const assertion = expect(run.promise).rejects.toThrow('timeout')
      await vi.advanceTimersByTimeAsync(10)
      await assertion
      expect(run.getRecord()).toMatchObject({ status: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })
})
