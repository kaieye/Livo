export function bumpFeedsChangedSignal(): number {
  const currentValue = AppStorage.get<number>('feedsChangedAt') ?? 0
  const nextValue = Math.max(Date.now(), currentValue + 1)
  AppStorage.setOrCreate('feedsChangedAt', nextValue)
  return nextValue
}

export function shouldBumpFeedsChangedSignal(
  completedCount: number,
  totalCount: number,
  batchSize: number,
): boolean {
  const safeTotalCount = Math.max(0, Math.floor(totalCount))
  if (safeTotalCount === 0) {
    return false
  }

  const safeCompletedCount = Math.max(0, Math.floor(completedCount))
  const safeBatchSize = Math.max(1, Math.floor(batchSize))

  return safeCompletedCount >= safeTotalCount || safeCompletedCount % safeBatchSize === 0
}
