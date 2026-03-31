import { isDirectVideoUrl } from './FeedMediaUrl.ts'

export type VideoPlayerLaunchMode = 'direct' | 'web' | 'error'

export interface VideoPlayerLaunchState {
  mode: VideoPlayerLaunchMode
  playableUrl: string
  fallbackUrl: string
  actionHint: string
}

export function resolveVideoPlayerLaunchState(
  videoUrl: string,
  fallbackUrl: string,
): VideoPlayerLaunchState {
  const normalizedVideoUrl = (videoUrl || '').trim()
  if (isDirectVideoUrl(normalizedVideoUrl)) {
    return {
      mode: 'direct',
      playableUrl: normalizedVideoUrl,
      fallbackUrl: '',
      actionHint: '',
    }
  }

  const normalizedFallbackUrl = (fallbackUrl || '').trim()
  if (normalizedFallbackUrl) {
    return {
      mode: 'web',
      playableUrl: '',
      fallbackUrl: normalizedFallbackUrl,
      actionHint: '',
    }
  }

  return {
    mode: 'error',
    playableUrl: '',
    fallbackUrl: '',
    actionHint: '当前视频暂时无法在应用内播放',
  }
}
