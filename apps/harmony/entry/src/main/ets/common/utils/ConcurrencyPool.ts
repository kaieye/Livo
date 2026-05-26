export async function runConcurrencyPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0
  let completedCount = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }

      try {
        const value = await worker(items[currentIndex], currentIndex)
        results[currentIndex] = { status: 'fulfilled', value }
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }

      completedCount += 1
      onProgress?.(completedCount, items.length)
    }
  }

  const workers: Promise<void>[] = []
  const workerCount = Math.min(concurrency, items.length)
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(runWorker())
  }
  await Promise.all(workers)
  return results
}
