import test from 'node:test'
import assert from 'node:assert/strict'
import { runConcurrencyPool } from '../entry/src/main/ets/common/utils/ConcurrencyPool.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('runConcurrencyPool: processes all items', async () => {
  const items = [1, 2, 3, 4, 5]
  const results = await runConcurrencyPool(items, 2, async (n) => n * 2)
  assert.equal(results.length, 5)
  const fulfilled = results.filter((r) => r.status === 'fulfilled')
  assert.equal(fulfilled.length, 5)
  const values = fulfilled.map(
    (r) => (r as PromiseFulfilledResult<number>).value,
  )
  values.sort((a, b) => a - b)
  assert.deepEqual(values, [2, 4, 6, 8, 10])
})

test('runConcurrencyPool: respects concurrency limit', async () => {
  let maxConcurrent = 0
  let currentConcurrent = 0
  const items = [1, 2, 3, 4]

  await runConcurrencyPool(items, 2, async (_n) => {
    currentConcurrent += 1
    maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
    await sleep(10)
    currentConcurrent -= 1
    return 0
  })

  assert.equal(maxConcurrent, 2)
})

test('runConcurrencyPool: calls onProgress for each item', async () => {
  const items = [1, 2, 3]
  const progressCalls: Array<[number, number]> = []

  await runConcurrencyPool(
    items,
    3,
    async (n) => n,
    (completed, total) => {
      progressCalls.push([completed, total])
    },
  )

  assert.equal(progressCalls.length, 3)
  const lastCall = progressCalls[progressCalls.length - 1]
  assert.deepEqual(lastCall, [3, 3])
})

test('runConcurrencyPool: handles empty items', async () => {
  const results = await runConcurrencyPool([], 3, async () => 'x')
  assert.equal(results.length, 0)
})

test('runConcurrencyPool: single item with concurrency 1', async () => {
  const results = await runConcurrencyPool(['a'], 1, async (s) =>
    s.toUpperCase(),
  )
  assert.equal(results.length, 1)
  assert.equal((results[0] as PromiseFulfilledResult<string>).value, 'A')
})

test('runConcurrencyPool: captures errors as rejected', async () => {
  const items = [1, 2, 3]
  const results = await runConcurrencyPool(items, 2, async (n) => {
    if (n === 2) {
      throw new Error('boom')
    }
    return n
  })

  assert.equal(results.length, 3)
  const rejected = results.filter((r) => r.status === 'rejected')
  assert.equal(rejected.length, 1)
  assert.ok((rejected[0] as PromiseRejectedResult).reason instanceof Error)
  assert.equal((rejected[0] as PromiseRejectedResult).reason.message, 'boom')
})

test('runConcurrencyPool: items keep their original index', async () => {
  const items = ['a', 'b', 'c', 'd']
  const results = await runConcurrencyPool(items, 2, async (s, i) => `${s}${i}`)
  assert.equal((results[0] as PromiseFulfilledResult<string>).value, 'a0')
  assert.equal((results[1] as PromiseFulfilledResult<string>).value, 'b1')
  assert.equal((results[2] as PromiseFulfilledResult<string>).value, 'c2')
  assert.equal((results[3] as PromiseFulfilledResult<string>).value, 'd3')
})

test('runConcurrencyPool: concurrency larger than items uses items count', async () => {
  let concurrent = 0
  let peak = 0

  await runConcurrencyPool([1, 2], 100, async () => {
    concurrent += 1
    peak = Math.max(peak, concurrent)
    await sleep(10)
    concurrent -= 1
    return 0
  })

  assert.equal(peak, 2)
})

test('runConcurrencyPool: handles mixed success and failure with progress', async () => {
  const items = [1, 2, 3, 4]
  const progressVals: number[] = []

  const results = await runConcurrencyPool(
    items,
    2,
    async (n) => {
      if (n % 2 === 0) {
        throw new Error(`fail ${n}`)
      }
      await sleep(5)
      return n * 10
    },
    (completed) => {
      progressVals.push(completed)
    },
  )

  assert.equal(results.length, 4)
  const fulfilled = results.filter((r) => r.status === 'fulfilled')
  const rejected = results.filter((r) => r.status === 'rejected')
  assert.equal(fulfilled.length, 2)
  assert.equal(rejected.length, 2)
  assert.deepEqual(progressVals, [1, 2, 3, 4])
})
