export type HomeVisibleEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 24
const HOME_VISIBLE_ENTRY_LOAD_MORE_STEP: number = 24
const HOME_VISIBLE_ENTRY_PRELOAD_REMAINING_COUNT: number = 12
const HOME_VISIBLE_ENTRY_ESTIMATED_ROW_HEIGHT: number = 56
const HOME_VISIBLE_ENTRY_ESTIMATED_VISIBLE_ROW_COUNT: number = 8

export function resolveHomeVisibleEntryInitialLimit(
  _mode: HomeVisibleEntryMode,
): number {
  return HOME_VISIBLE_ENTRY_INITIAL_LIMIT
}

export function resolveHomeVisibleEntryLoadMoreStep(): number {
  return HOME_VISIBLE_ENTRY_LOAD_MORE_STEP
}

export function shouldPreloadHomeVisibleEntries(
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
      HOME_VISIBLE_ENTRY_PRELOAD_REMAINING_COUNT -
      HOME_VISIBLE_ENTRY_ESTIMATED_VISIBLE_ROW_COUNT,
  )
  return (
    currentScrollOffset >=
    preloadStartIndex * HOME_VISIBLE_ENTRY_ESTIMATED_ROW_HEIGHT
  )
}
