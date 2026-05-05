import { isDirectVideoUrl } from '../utils/FeedMediaUrl'

export function decodeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ')
}

export function resolveAbsoluteUrl(baseUrl: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }
  const base = (baseUrl || '').trim()
  if (!base) {
    return trimmed
  }
  const originMatch = base.match(/^(https?:\/\/[^/]+)(\/.*)?$/i)
  const origin = originMatch?.[1] ?? ''
  const basePath = originMatch?.[2] ?? '/'
  if (!origin) {
    return trimmed
  }
  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`
  }
  const normalizedBaseDir = basePath.includes('/')
    ? basePath.replace(/\/[^/]*$/, '/')
    : '/'
  return `${origin}${normalizedBaseDir}${trimmed}`.replace(/([^:]\/)\/+/g, '$1')
}

function extractYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

function extractBilibiliVideoToken(value: string): string {
  const bvid = (value || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1]
  if (bvid) {
    return `BV:${bvid}`
  }
  const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
  if (aid) {
    return `AV:${aid}`
  }
  return ''
}

export function isSupportedVideoUrl(value: string): boolean {
  return isDirectVideoUrl(value) || !!extractYouTubeVideoId(value) || !!extractBilibiliVideoToken(value)
}

export function normalizeSupportedVideoUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }
  if (isDirectVideoUrl(trimmed)) {
    return trimmed
  }
  const youTubeId = extractYouTubeVideoId(trimmed)
  if (youTubeId) {
    return `https://www.youtube.com/watch?v=${youTubeId}`
  }
  const bilibiliToken = extractBilibiliVideoToken(trimmed)
  if (bilibiliToken.startsWith('BV:')) {
    return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`
  }
  if (bilibiliToken.startsWith('AV:')) {
    return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`
  }
  return trimmed
}

export function buildVideoPreviewUrl(videoUrl: string): string {
  const youTubeId = extractYouTubeVideoId(videoUrl)
  return youTubeId ? `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg` : ''
}

export function extractSupportedVideoUrls(content: string, baseUrl: string, articleUrl: string): string[] {
  const results: string[] = []
  const pushUrl = (value: string): void => {
    const resolved = normalizeSupportedVideoUrl(resolveAbsoluteUrl(baseUrl, decodeBasicHtml(value)))
    if (!resolved || !isSupportedVideoUrl(resolved) || results.includes(resolved)) {
      return
    }
    results.push(resolved)
  }

  const normalizedArticleUrl = normalizeSupportedVideoUrl(articleUrl)
  if (normalizedArticleUrl && isSupportedVideoUrl(normalizedArticleUrl)) {
    results.push(normalizedArticleUrl)
  }

  // 快速跳过：内容中不含任何视频平台关键词或 HTML 属性，直接返回
  const lowerContent = (content || '').toLowerCase()
  if (
    !lowerContent.includes('youtube') &&
    !lowerContent.includes('youtu.be') &&
    !lowerContent.includes('bilibili') &&
    !lowerContent.includes('href=')
  ) {
    return results
  }

  const raw = decodeBasicHtml(content || '')
  for (const matched of raw.matchAll(/\b(?:href|src|data-src)=[\"']([^\"']+)[\"']/gi)) {
    if (matched[1]) {
      pushUrl(matched[1])
    }
  }
  for (const matched of raw.matchAll(
    /https?:\/\/[^\s\"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s\"'<>]+/gi,
  )) {
    if (!matched[0]) {
      continue
    }
    pushUrl(matched[0].startsWith('http') ? matched[0] : `https://${matched[0]}`)
  }

  return results
}
