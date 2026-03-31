export type VideoPlayerMode = 'direct' | 'web' | 'error'

export interface VideoPlayerState {
  mode: VideoPlayerMode
  playableUrl: string
  fallbackUrl: string
  actionHint: string
}

export function resolveVideoPlayerState(
  playableUrl: string,
  fallbackUrl: string,
): VideoPlayerState {
  const normalizedPlayableUrl = (playableUrl || '').trim()
  if (normalizedPlayableUrl) {
    return {
      mode: 'direct',
      playableUrl: normalizedPlayableUrl,
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
    actionHint: '当前视频暂时无法解析直链，请稍后重试',
  }
}
