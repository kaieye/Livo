/**
 * Generic concurrency-limited pool executor.
 * Spawns workers that pull items from a shared queue and collect results.
 *
 * Ported from Harmony's `ConcurrencyPool.runConcurrencyPool`.
 */
export async function runConcurrencyPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<PromiseSettledResult<R>[]> {
  const total = items.length
  if (total === 0) return []

  const effectiveConcurrency = Math.max(1, Math.min(concurrency, total))
  const results: PromiseSettledResult<R>[] = new Array(total)
  let nextIndex = 0
  let completedCount = 0

  const runWorker = async () => {
    while (nextIndex < total) {
      const index = nextIndex++
      try {
        const value = await worker(items[index], index)
        results[index] = { status: 'fulfilled', value }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
      completedCount++
      onProgress?.(completedCount, total)
    }
  }

  const workers = Array.from({ length: effectiveConcurrency }, () =>
    runWorker(),
  )
  await Promise.all(workers)

  return results
}
