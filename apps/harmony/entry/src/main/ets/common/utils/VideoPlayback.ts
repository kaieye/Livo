import { isDirectVideoUrl } from './FeedMediaUrl.ts'

export interface InvidiousFormatStream {
  url?: string
  type?: string
  quality?: string
  container?: string
  resolution?: string
  audioQuality?: string
  bitrate?: string
}

export interface PipedStream {
  url?: string
  quality?: string
  mimeType?: string
  videoOnly?: boolean
}

function qualityValue(label: string): number {
  const matched = (label || '').match(/(\d+)/)
  return matched?.[1] ? Number(matched[1]) : 0
}

export function selectInvidiousPlayableUrl(
  formatStreams: InvidiousFormatStream[],
  adaptiveFormats: InvidiousFormatStream[] = [],
  hlsUrl: string = '',
): string {
  if ((hlsUrl || '').trim()) {
    return hlsUrl.trim()
  }

  const rankedFormatStreams = (formatStreams || [])
    .filter(
      (item: InvidiousFormatStream) =>
        item.container === 'mp4' || `${item.type ?? ''}`.includes('video/mp4'),
    )
    .sort(
      (left: InvidiousFormatStream, right: InvidiousFormatStream) =>
        qualityValue(right.quality ?? right.resolution ?? '') -
        qualityValue(left.quality ?? left.resolution ?? ''),
    )

  if (rankedFormatStreams.length > 0) {
    return rankedFormatStreams[0]?.url || ''
  }

  const rankedAdaptiveStreams = (adaptiveFormats || [])
    .filter(
      (item: InvidiousFormatStream) =>
        `${item.type ?? ''}`.includes('video/mp4') && !!item.audioQuality,
    )
    .sort(
      (left: InvidiousFormatStream, right: InvidiousFormatStream) =>
        qualityValue(right.quality ?? right.resolution ?? right.bitrate ?? '') -
        qualityValue(left.quality ?? left.resolution ?? left.bitrate ?? ''),
    )
  if (rankedAdaptiveStreams.length > 0) {
    return rankedAdaptiveStreams[0]?.url || ''
  }

  const best = (formatStreams || [])[0] ?? (adaptiveFormats || [])[0]
  return best?.url || ''
}

export function selectPipedPlayableUrl(
  hls: string,
  videoStreams: PipedStream[],
): string {
  if (hls) {
    return hls
  }

  if (!videoStreams || videoStreams.length === 0) {
    return ''
  }

  const combined = videoStreams
    .filter(
      (item: PipedStream) =>
        item.videoOnly !== true &&
        `${item.mimeType ?? ''}`.includes('video/mp4'),
    )
    .sort(
      (left: PipedStream, right: PipedStream) =>
        qualityValue(right.quality ?? '') - qualityValue(left.quality ?? ''),
    )

  return combined[0]?.url || ''
}

export type VideoPlaybackTarget = 'inline' | 'dedicated'

export function resolveVideoPlaybackTarget(
  _isYouTubeVideo: boolean,
  _isDirectVideoFile: boolean,
): VideoPlaybackTarget {
  return 'inline'
}

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
