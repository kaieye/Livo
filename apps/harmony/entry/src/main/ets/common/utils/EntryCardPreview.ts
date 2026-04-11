import { selectArticleVideoUrls } from './ArticleVideoSource.ts'

export interface EntryCardPreviewTarget {
  title: string
  summary: string
  content: string
  articleUrl: string
  siteUrl: string
  mediaUrls: string[]
}

function decodeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function resolveAbsoluteUrl(baseUrl: string, value: string): string {
  const trimmed = (value || '').trim()
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

function extractImageUrl(tag: string, baseUrl: string): string {
  const srcMatch = tag.match(
    /\b(?:data-src|data-original|src)=["']([^"']+)["']/i,
  )
  return srcMatch?.[1]
    ? resolveAbsoluteUrl(baseUrl, decodeBasicHtml(srcMatch[1]))
    : ''
}

function extractYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

function extractBilibiliVideoToken(value: string): string {
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

function isSupportedVideoUrl(value: string): boolean {
  return !!extractYouTubeVideoId(value) || !!extractBilibiliVideoToken(value)
}

function normalizeSupportedVideoUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
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

function buildVideoPreviewUrl(videoUrl: string): string {
  const youTubeId = extractYouTubeVideoId(videoUrl)
  if (youTubeId) {
    return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`
  }
  return ''
}

function isImageUrl(value: string): boolean {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  const hasImageFormatQuery =
    /[?&]format=(jpg|jpeg|png|webp|gif|bmp|avif)(?:[&#]|$)/i.test(normalized)
  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized) ||
    hasImageFormatQuery ||
    normalized.includes('ytimg.com/') ||
    normalized.includes('googleusercontent.com/') ||
    normalized.includes('cdninstagram') ||
    normalized.includes('scontent.') ||
    normalized.includes('fbcdn.net') ||
    normalized.includes('pbs.twimg.com/media/') ||
    normalized.includes('twimg.com/media/')
  )
}

function extractSupportedVideoUrls(
  content: string,
  baseUrl: string,
  articleUrl: string,
): string[] {
  const results: string[] = []
  const pushUrl = (value: string): void => {
    const resolved = normalizeSupportedVideoUrl(
      resolveAbsoluteUrl(baseUrl, decodeBasicHtml(value)),
    )
    if (
      !resolved ||
      !isSupportedVideoUrl(resolved) ||
      results.includes(resolved)
    ) {
      return
    }
    results.push(resolved)
  }

  const normalizedArticleUrl = normalizeSupportedVideoUrl(articleUrl)
  if (normalizedArticleUrl && isSupportedVideoUrl(normalizedArticleUrl)) {
    results.push(normalizedArticleUrl)
  }

  const raw = decodeBasicHtml(content || '')
  const attributeMatches = raw.matchAll(
    /\b(?:href|src|data-src)=["']([^"']+)["']/gi,
  )
  for (const matched of attributeMatches) {
    if (matched[1]) {
      pushUrl(matched[1])
    }
  }

  const textMatches = raw.matchAll(
    /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/gi,
  )
  for (const matched of textMatches) {
    if (!matched[0]) {
      continue
    }
    const candidate = matched[0].startsWith('http')
      ? matched[0]
      : `https://${matched[0]}`
    pushUrl(candidate)
  }

  return results
}

function extractImageUrls(content: string, baseUrl: string): string[] {
  const results: string[] = []
  const pushImage = (value: string): void => {
    const resolved = resolveAbsoluteUrl(baseUrl, decodeBasicHtml(value))
    if (!resolved || !isImageUrl(resolved) || results.includes(resolved)) {
      return
    }
    results.push(resolved)
  }

  const raw = decodeBasicHtml(content || '')
  const imageTagMatches = raw.matchAll(/<img\b[^>]*>/gi)
  for (const matched of imageTagMatches) {
    if (matched[0]) {
      pushImage(extractImageUrl(matched[0], baseUrl))
    }
  }

  const textMatches = raw.matchAll(/https?:\/\/[^\s"'<>]+/gi)
  for (const matched of textMatches) {
    if (matched[0]) {
      pushImage(matched[0])
    }
  }

  return results
}

export function resolveEntryCardImageUrl(
  target: EntryCardPreviewTarget,
): string {
  const baseUrl = target.articleUrl || target.siteUrl
  const supportedVideoUrls = extractSupportedVideoUrls(
    [
      target.title,
      target.summary,
      target.content,
      target.articleUrl,
      ...(target.mediaUrls ?? []),
    ].join('\n'),
    baseUrl,
    target.articleUrl,
  )
  const selectedVideoUrls = selectArticleVideoUrls(
    target.articleUrl,
    target.mediaUrls ?? [],
    supportedVideoUrls,
  )
  const videoPreviewUrl = buildVideoPreviewUrl(selectedVideoUrls[0] ?? '')
  if (videoPreviewUrl) {
    return videoPreviewUrl
  }

  const mediaImageUrl = (target.mediaUrls ?? []).find((url: string) =>
    isImageUrl(url),
  )
  if (mediaImageUrl) {
    return mediaImageUrl
  }

  return (
    extractImageUrls(`${target.summary}\n${target.content}`, baseUrl)[0] ?? ''
  )
}
