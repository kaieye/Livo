export const DISCOVER_BROWSE_INITIAL_VISIBLE_COUNT: number = 24
export const DISCOVER_BROWSE_LOAD_MORE_COUNT: number = 24
export const DISCOVER_BROWSE_PRELOAD_REMAINING_COUNT: number = 12
export const DISCOVER_BROWSE_ESTIMATED_ROW_HEIGHT: number = 56
export const DISCOVER_BROWSE_ESTIMATED_VISIBLE_ROW_COUNT: number = 8

export function initialDiscoverBrowseVisibleCount(totalCount: number): number {
  return Math.min(
    Math.max(totalCount, 0),
    DISCOVER_BROWSE_INITIAL_VISIBLE_COUNT,
  )
}

export function nextDiscoverBrowseVisibleCount(
  currentCount: number,
  totalCount: number,
): number {
  const safeCurrent = Math.max(currentCount, 0)
  const safeTotal = Math.max(totalCount, 0)
  return Math.min(safeCurrent + DISCOVER_BROWSE_LOAD_MORE_COUNT, safeTotal)
}

export function shouldPreloadDiscoverBrowseMore(
  currentScrollOffset: number,
  totalCount: number,
  visibleCount: number,
): boolean {
  if (visibleCount >= totalCount) {
    return false
  }

  const preloadStartIndex = Math.max(
    0,
    visibleCount -
      DISCOVER_BROWSE_PRELOAD_REMAINING_COUNT -
      DISCOVER_BROWSE_ESTIMATED_VISIBLE_ROW_COUNT,
  )
  return (
    currentScrollOffset >=
    preloadStartIndex * DISCOVER_BROWSE_ESTIMATED_ROW_HEIGHT
  )
}
