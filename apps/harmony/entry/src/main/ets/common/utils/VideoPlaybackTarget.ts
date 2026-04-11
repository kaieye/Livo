export type VideoPlaybackTarget = 'inline' | 'dedicated'

export function resolveVideoPlaybackTarget(
  _isYouTubeVideo: boolean,
  _isDirectVideoFile: boolean,
): VideoPlaybackTarget {
  // Keep YouTube playback inline in article detail to avoid context switches.
  // The resolver still handles direct stream/fallback URL selection.
  return 'inline'
}
