import { isDirectVideoUrl } from './FeedMediaUrl.ts'

export interface FeedDetailVideoPreviewCacheItem {
  videoUrl: string
  previewUrl: string
}

export interface FeedDetailVideoEntryLike {
  url: string
  summary: string
  content: string
  mediaUrls?: string[]
}

export function extractFeedDetailYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

export function extractFeedDetailBilibiliVideoToken(value: string): string {
  const bvid = (value || '').match(
    /(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i,
  )?.[1]
  if (bvid) {
    return `BV:${bvid}`
  }

  const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
  if (aid) {
    return `AV:${aid}`
  }

  return ''
}

export function normalizeFeedDetailVideoUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }

  if (isDirectVideoUrl(trimmed)) {
    return trimmed
  }

  const youTubeId = extractFeedDetailYouTubeVideoId(trimmed)
  if (youTubeId) {
    return `https://www.youtube.com/watch?v=${youTubeId}`
  }

  const bilibiliToken = extractFeedDetailBilibiliVideoToken(trimmed)
  if (bilibiliToken.startsWith('BV:')) {
    return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`
  }
  if (bilibiliToken.startsWith('AV:')) {
    return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`
  }

  return ''
}

export function resolveFeedDetailEntryVideoUrl(
  entry: FeedDetailVideoEntryLike,
): string {
  const directMediaUrl = (entry.mediaUrls ?? []).find((url: string) =>
    isDirectVideoUrl(url),
  )
  if (directMediaUrl) {
    return directMediaUrl
  }

  const candidates: string[] = [entry.url, entry.content, entry.summary]
  for (const candidate of candidates) {
    const normalized = normalizeFeedDetailVideoUrl(candidate || '')
    if (normalized) {
      return normalized
    }
  }

  const rawContent = `${entry.content || ''}\n${entry.summary || ''}`
  const matched =
    rawContent.match(
      /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/i,
    )?.[0] ?? ''
  if (!matched) {
    return ''
  }
  return normalizeFeedDetailVideoUrl(
    matched.startsWith('http') ? matched : `https://${matched}`,
  )
}

export function resolveStaticFeedDetailVideoPreviewUrl(
  videoUrl: string,
): string {
  const youTubeId = extractFeedDetailYouTubeVideoId(videoUrl)
  if (youTubeId) {
    return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`
  }
  return ''
}

export function resolveFeedDetailVideoSourceLabel(videoUrl: string): string {
  const lower = (videoUrl || '').toLowerCase()
  if (isDirectVideoUrl(lower)) {
    return '直链'
  }
  if (lower.includes('youtube.com')) {
    return 'YouTube'
  }
  if (lower.includes('bilibili.com')) {
    return 'Bilibili'
  }
  return ''
}

export function findFeedDetailVideoPreviewCacheItem(
  cache: FeedDetailVideoPreviewCacheItem[],
  videoUrl: string,
): FeedDetailVideoPreviewCacheItem | undefined {
  return cache.find(
    (item: FeedDetailVideoPreviewCacheItem) => item.videoUrl === videoUrl,
  )
}

export function resolveFeedDetailEntryVideoPreviewUrl(
  entry: FeedDetailVideoEntryLike,
  cache: FeedDetailVideoPreviewCacheItem[],
): string {
  const videoUrl = resolveFeedDetailEntryVideoUrl(entry)
  const cached = findFeedDetailVideoPreviewCacheItem(cache, videoUrl)
  if (cached?.previewUrl) {
    return cached.previewUrl
  }
  return resolveStaticFeedDetailVideoPreviewUrl(videoUrl)
}

export function mergeFeedDetailVideoPreviewCacheItem(
  cache: FeedDetailVideoPreviewCacheItem[],
  item: FeedDetailVideoPreviewCacheItem,
): FeedDetailVideoPreviewCacheItem[] {
  const existingIndex = cache.findIndex(
    (cached: FeedDetailVideoPreviewCacheItem) =>
      cached.videoUrl === item.videoUrl,
  )
  const nextCache = [...cache]
  if (existingIndex >= 0) {
    nextCache[existingIndex] = item
  } else {
    nextCache.push(item)
  }
  return nextCache
}
