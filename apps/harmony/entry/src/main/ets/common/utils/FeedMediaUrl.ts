function decodeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function parseBaseUrl(url: string): {
  protocol: string
  host: string
  pathname: string
} {
  const match = url.match(/^(https?:)\/\/([^/]+)(.*)?/)
  if (!match) {
    return { protocol: 'https:', host: url, pathname: '' }
  }

  return {
    protocol: match[1],
    host: match[2],
    pathname: match[3] ?? '',
  }
}

function resolveAbsoluteUrl(baseUrl: string, rawUrl: string): string {
  const trimmed = decodeBasicHtml((rawUrl || '').trim())
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    const baseProtocol = new RegExp('^https?:').exec(baseUrl)?.[0] ?? 'https:'
    return `${baseProtocol}${trimmed}`
  }

  const parsedBase = parseBaseUrl(baseUrl)
  if (!parsedBase.host) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return `${parsedBase.protocol}//${parsedBase.host}${trimmed}`
  }

  const baseDir = parsedBase.pathname.includes('/')
    ? parsedBase.pathname.substring(0, parsedBase.pathname.lastIndexOf('/') + 1)
    : '/'

  return `${parsedBase.protocol}//${parsedBase.host}${baseDir}${trimmed}`.replace(
    /([^:]\/)\/+/g,
    '$1',
  )
}

function extractAttribute(tag: string, name: string): string {
  const regex = new RegExp(`${name}="([^"]+)"|${name}='([^']+)'`, 'i')
  const matched = tag.match(regex)
  return matched?.[1] ?? matched?.[2] ?? ''
}

function dedupeUrls(urls: string[]): string[] {
  const result: string[] = []
  urls.forEach((url: string) => {
    const trimmed = url.trim()
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed)
    }
  })
  return result
}

function isSupportedVideoPageUrl(url: string): boolean {
  const normalized = (url || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  return /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/|b23\.tv\/)/i.test(
    normalized,
  )
}

function isDirectImageMimeType(mimeType: string): boolean {
  const normalized = (mimeType || '').trim().toLowerCase()
  return normalized.startsWith('image/')
}

function isDirectImageUrl(url: string): boolean {
  const normalized = (url || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized) ||
    normalized.includes('cdninstagram') ||
    normalized.includes('scontent.') ||
    normalized.includes('fbcdn.net')
  )
}

export function isDirectVideoMimeType(mimeType: string): boolean {
  const normalized = (mimeType || '').trim().toLowerCase()
  return (
    normalized.startsWith('video/') ||
    normalized.startsWith('audio/') ||
    normalized === 'application/x-mpegurl' ||
    normalized === 'application/vnd.apple.mpegurl' ||
    normalized === 'application/dash+xml'
  )
}

export function isDirectVideoUrl(url: string): boolean {
  const normalized = (url || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  return /\.(mp4|m4v|mov|webm|m3u8|mpd|avi|mkv|mp3|m4a|aac|flac|wav)(\?|#|$)/i.test(
    normalized,
  )
}

export function extractFeedMediaUrls(
  itemBlock: string,
  baseUrl: string,
): string[] {
  const results: string[] = []
  const pushUrl = (candidate: string, mimeType: string): void => {
    const resolved = resolveAbsoluteUrl(baseUrl, candidate)
    if (!resolved) {
      return
    }
    if (
      !isDirectImageMimeType(mimeType) &&
      !isDirectImageUrl(resolved) &&
      !isDirectVideoMimeType(mimeType) &&
      !isDirectVideoUrl(resolved) &&
      !isSupportedVideoPageUrl(resolved)
    ) {
      return
    }
    if (!results.includes(resolved)) {
      results.push(resolved)
    }
  }

  const enclosureTags = itemBlock.match(/<enclosure\b[^>]*\/?>/gi) ?? []
  enclosureTags.forEach((tag: string) => {
    pushUrl(extractAttribute(tag, 'url'), extractAttribute(tag, 'type'))
  })

  const mediaContentTags = itemBlock.match(/<media:content\b[^>]*\/?>/gi) ?? []
  mediaContentTags.forEach((tag: string) => {
    pushUrl(
      extractAttribute(tag, 'url'),
      extractAttribute(tag, 'type') || extractAttribute(tag, 'medium'),
    )
  })

  const mediaThumbnailTags =
    itemBlock.match(/<media:thumbnail\b[^>]*\/?>/gi) ?? []
  mediaThumbnailTags.forEach((tag: string) => {
    pushUrl(extractAttribute(tag, 'url'), 'image/thumbnail')
  })

  const atomEnclosureTags =
    itemBlock.match(/<link\b[^>]*rel=["']enclosure["'][^>]*\/?>/gi) ?? []
  atomEnclosureTags.forEach((tag: string) => {
    pushUrl(extractAttribute(tag, 'href'), extractAttribute(tag, 'type'))
  })

  return results
}

export function appendFeedMediaUrlsToContent(
  content: string,
  mediaUrls: string[],
): string {
  const normalizedContent = content || ''
  const uniqueUrls = dedupeUrls(mediaUrls)
  if (uniqueUrls.length === 0) {
    return normalizedContent
  }

  const missingUrls = uniqueUrls.filter(
    (url: string) => !normalizedContent.includes(url),
  )
  if (missingUrls.length === 0) {
    return normalizedContent
  }

  const separator = normalizedContent.trim() ? '\n\n' : ''
  return `${normalizedContent}${separator}${missingUrls.join('\n')}`
}
