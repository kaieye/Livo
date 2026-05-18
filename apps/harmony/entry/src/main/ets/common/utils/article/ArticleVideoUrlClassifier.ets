import { isDirectVideoUrl } from '../FeedMediaUrl'
import { VideoResolverService } from '../../services/VideoResolverService'

export type ArticleVideoKind = 'youtube' | 'bilibili-bvid' | 'bilibili-aid' | 'direct' | 'web'

interface ArticleVideoClassification {
  kind: ArticleVideoKind
  youTubeVideoId: string
  bilibiliId: string
}

export function classifyArticleVideoUrl(videoUrl: string): ArticleVideoClassification {
  const youTubeVideoId = VideoResolverService.extractYouTubeVideoId(videoUrl || '')
  if (youTubeVideoId) {
    return { kind: 'youtube', youTubeVideoId, bilibiliId: '' }
  }

  const bvid = (videoUrl || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1]
  if (bvid) {
    return { kind: 'bilibili-bvid', youTubeVideoId: '', bilibiliId: bvid }
  }

  const aid = (videoUrl || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
  if (aid) {
    return { kind: 'bilibili-aid', youTubeVideoId: '', bilibiliId: aid }
  }

  if (isDirectVideoUrl(videoUrl || '')) {
    return { kind: 'direct', youTubeVideoId: '', bilibiliId: '' }
  }

  return { kind: 'web', youTubeVideoId: '', bilibiliId: '' }
}

export function isArticleYouTubeVideo(videoUrl: string): boolean {
  return classifyArticleVideoUrl(videoUrl).kind === 'youtube'
}

export function isArticleDirectVideo(videoUrl: string): boolean {
  return classifyArticleVideoUrl(videoUrl).kind === 'direct'
}

/**
 * Resolves the in-app embed URL for a video block when launching its native
 * preview is not desirable. YouTube falls back to a caller-provided fallback URL
 * (typically a Web fallback resolved by VideoResolverService).
 */
export function resolveInAppEmbedUrl(videoUrl: string, youTubeFallbackUrl: string): string {
  const classification = classifyArticleVideoUrl(videoUrl)
  switch (classification.kind) {
    case 'youtube':
      return youTubeFallbackUrl
    case 'bilibili-bvid':
      return `https://www.bilibili.com/blackboard/newplayer.html?autoplay=true&danmaku=true&highQuality=true&bvid=${encodeURIComponent(classification.bilibiliId)}`
    case 'bilibili-aid':
      return `https://www.bilibili.com/blackboard/newplayer.html?autoplay=true&danmaku=true&highQuality=true&aid=${encodeURIComponent(classification.bilibiliId)}`
    default:
      return videoUrl
  }
}
