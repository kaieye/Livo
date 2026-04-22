export function bumpFeedsChangedSignal(): number {
  const currentValue = AppStorage.get<number>('feedsChangedAt') ?? 0
  const nextValue = Math.max(Date.now(), currentValue + 1)
  AppStorage.setOrCreate('feedsChangedAt', nextValue)
  return nextValue
}
