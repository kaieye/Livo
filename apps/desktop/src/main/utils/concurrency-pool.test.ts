import { describe, it, expect, vi } from 'vitest'
import { runConcurrencyPool } from './concurrency-pool'

describe('runConcurrencyPool', () => {
  it('returns empty array for empty input', async () => {
    const results = await runConcurrencyPool([], 2, async (x: number) => x * 2)
    expect(results).toEqual([])
  })

  it('processes all items with concurrency=1', async () => {
    const order: number[] = []
    const results = await runConcurrencyPool([1, 2, 3], 1, async (x) => {
      order.push(x)
      return x * 10
    })

    expect(order).toEqual([1, 2, 3])
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 })
    expect(results[1]).toEqual({ status: 'fulfilled', value: 20 })
    expect(results[2]).toEqual({ status: 'fulfilled', value: 30 })
  })

  it('runs with concurrency > 1 and collects all results', async () => {
    const started: string[] = []
    const results = await runConcurrencyPool(
      ['a', 'b', 'c', 'd', 'e'],
      3,
      async (char) => {
        started.push(char)
        return char.toUpperCase()
      },
    )

    expect(started).toHaveLength(5)
    const values = results
      .filter((r) => r.status === 'fulfilled')
      .map((r: any) => r.value)
    expect(values.sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('captures rejected promises', async () => {
    const results = await runConcurrencyPool([1, 2, 3], 2, async (x) => {
      if (x === 2) throw new Error('fail')
      return x
    })

    expect(results).toHaveLength(3)
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(results[2].status).toBe('fulfilled')
  })

  it('calls onProgress callback', async () => {
    const progress: Array<[number, number]> = []
    await runConcurrencyPool(
      [1, 2, 3],
      2,
      async (x) => x,
      (completed, total) => progress.push([completed, total]),
    )

    const last = progress[progress.length - 1]
    expect(last).toEqual([3, 3])
    // Each completion fires once
    expect(progress.length).toBe(3)
  })

  it('clamps concurrency to item count', async () => {
    const maxConcurrent = { current: 0, peak: 0 }
    await runConcurrencyPool([1, 2], 100, async (x) => {
      maxConcurrent.current++
      maxConcurrent.peak = Math.max(maxConcurrent.peak, maxConcurrent.current)
      await new Promise((r) => setTimeout(r, 5))
      maxConcurrent.current--
      return x
    })

    expect(maxConcurrent.peak).toBeLessThanOrEqual(2)
  })

  it('handles single item', async () => {
    const results = await runConcurrencyPool([42], 4, async (x) => x + 1)
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 43 })
  })
})
