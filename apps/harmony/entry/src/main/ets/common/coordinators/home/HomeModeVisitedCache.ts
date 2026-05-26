export type HomeMode = 'articles' | 'social' | 'pictures' | 'videos'

export function rememberVisitedMode(
  visitedModes: HomeMode[],
  mode: HomeMode,
): HomeMode[] {
  if (visitedModes.includes(mode)) {
    return visitedModes
  }

  return [...visitedModes, mode]
}
