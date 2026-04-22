export type HomeVisibleEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 48
const HOME_VISIBLE_VIDEO_ENTRY_INITIAL_LIMIT: number = 24

export function resolveHomeVisibleEntryInitialLimit(
  mode: HomeVisibleEntryMode,
): number {
  return mode === 'videos'
    ? HOME_VISIBLE_VIDEO_ENTRY_INITIAL_LIMIT
    : HOME_VISIBLE_ENTRY_INITIAL_LIMIT
}
