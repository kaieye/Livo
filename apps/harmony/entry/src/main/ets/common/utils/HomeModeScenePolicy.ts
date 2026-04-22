export type HomeModeScene = 'articles' | 'social' | 'pictures' | 'videos'

export function shouldMountHomeModeScene(
  mode: HomeModeScene,
  renderedMode: HomeModeScene,
  visitedModes: HomeModeScene[],
): boolean {
  return mode === renderedMode || visitedModes.includes(mode)
}
