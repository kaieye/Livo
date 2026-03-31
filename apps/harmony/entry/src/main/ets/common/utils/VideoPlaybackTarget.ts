export type VideoPlaybackTarget = 'inline' | 'dedicated'

export function resolveVideoPlaybackTarget(
  isYouTubeVideo: boolean,
  isDirectVideoFile: boolean,
): VideoPlaybackTarget {
  if (isYouTubeVideo && !isDirectVideoFile) {
    return 'dedicated'
  }

  return 'inline'
}
