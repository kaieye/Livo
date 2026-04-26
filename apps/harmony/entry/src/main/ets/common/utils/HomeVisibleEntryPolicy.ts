export type HomeVisibleEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 24
const HOME_VISIBLE_ENTRY_DEFAULT_LOAD_MORE_STEP: number = 24
const HOME_VISIBLE_ENTRY_PICTURE_LOAD_MORE_STEP: number = 10

interface HomeVisibleEntryPreloadPolicy {
  preloadRemainingCount: number
  estimatedItemHeight: number
  estimatedVisibleItemCount: number
}

const HOME_VISIBLE_ENTRY_DEFAULT_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 12,
    estimatedItemHeight: 56,
    estimatedVisibleItemCount: 8,
  }

const HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 7,
    estimatedItemHeight: 560,
    estimatedVisibleItemCount: 1,
  }

const HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy = {
  preloadRemainingCount: 12,
  estimatedItemHeight: 110,
  estimatedVisibleItemCount: 6,
}

export function resolveHomeVisibleEntryInitialLimit(
  _mode: HomeVisibleEntryMode,
): number {
  return HOME_VISIBLE_ENTRY_INITIAL_LIMIT
}

export function resolveHomeVisibleEntryLoadMoreStep(
  mode?: HomeVisibleEntryMode,
): number {
  return mode === 'pictures'
    ? HOME_VISIBLE_ENTRY_PICTURE_LOAD_MORE_STEP
    : HOME_VISIBLE_ENTRY_DEFAULT_LOAD_MORE_STEP
}

function resolveHomeVisibleEntryPreloadPolicy(
  mode: HomeVisibleEntryMode,
): HomeVisibleEntryPreloadPolicy {
  if (mode === 'pictures') {
    return HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY
  }
  if (mode === 'videos') {
    return HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY
  }
  return HOME_VISIBLE_ENTRY_DEFAULT_PRELOAD_POLICY
}

export function shouldPreloadHomeVisibleEntries(
  mode: HomeVisibleEntryMode,
  currentScrollOffset: number,
  totalCount: number,
  visibleCount: number,
): boolean {
  if (visibleCount >= totalCount) {
    return false
  }
  const policy = resolveHomeVisibleEntryPreloadPolicy(mode)
  const preloadStartIndex = Math.max(
    0,
    visibleCount -
      policy.preloadRemainingCount -
      policy.estimatedVisibleItemCount,
  )
  return currentScrollOffset >= preloadStartIndex * policy.estimatedItemHeight
}
