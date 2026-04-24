export type DiscoverOverlayOrigin = 'root' | 'browse' | 'preview'

export const DISCOVER_OVERLAY_LEVEL_ROOT: number = 0
export const DISCOVER_OVERLAY_LEVEL_BROWSE: number = 1
export const DISCOVER_OVERLAY_LEVEL_DEEP: number = 2

export function resolveDiscoverOverlayReturnLevel(
  origin: DiscoverOverlayOrigin,
): number {
  switch (origin) {
    case 'browse':
      return DISCOVER_OVERLAY_LEVEL_BROWSE
    case 'preview':
      return DISCOVER_OVERLAY_LEVEL_DEEP
    default:
      return DISCOVER_OVERLAY_LEVEL_ROOT
  }
}

export function resolveDiscoverOverlayLevelAfterDestinationDisappear(
  currentLevel: number,
  restoreLevel: number,
): number {
  if (currentLevel > DISCOVER_OVERLAY_LEVEL_BROWSE) {
    return currentLevel
  }
  return restoreLevel
}

export function shouldShowDiscoverForegroundOverlay(
  overlayLevel: number,
): boolean {
  return overlayLevel > DISCOVER_OVERLAY_LEVEL_ROOT
}
