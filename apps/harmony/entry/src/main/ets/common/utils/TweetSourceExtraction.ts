import {
  decodeBasicHtml,
  isMetricsOnlyParagraph,
  normalizeParagraphWhitespace,
  normalizeWhitespace,
  stripHtml,
  trimValue,
} from './TweetTextNormalization.ts'

export interface TweetPresentationSource {
  title?: string
  summary?: string
  content?: string
  author?: string
  articleUrl?: string
  imageUrl?: string
  feedImageUrl?: string
  publishedAt?: number
  publishedLabel?: string
  mediaUrls?: string[]
  avatarUrl?: string
}

export interface TweetMetrics {
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
}

export function extractText(summary: string, content: string): string {
  const source = trimValue(summary) || trimValue(content)
  if (!source) {
    return ''
  }

  const raw = decodeBasicHtml(source)
  const paragraphMatches = Array.from(
    raw.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
    (item: RegExpMatchArray) =>
      normalizeParagraphWhitespace(stripHtml(item[1] || '')),
  ).filter((line: string) => !!line && !isMetricsOnlyParagraph(line))

  if (paragraphMatches.length > 0) {
    return paragraphMatches.join('\n\n')
  }

  return normalizeParagraphWhitespace(stripHtml(raw))
}

export function xAvatarUrl(username: string): string {
  const normalized = trimValue(username).replace(/^@+/, '')
  if (!normalized) {
    return ''
  }
  return `https://unavatar.io/x/${encodeURIComponent(normalized)}?fallback=false`
}

export function extractUrlUsername(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  const unavatarMatch = trimmed.match(/unavatar\.io\/(?:x|twitter)\/([^/?#]+)/i)
  if (unavatarMatch?.[1]) {
    return decodeURIComponent(unavatarMatch[1]).replace(/^@/, '').trim()
  }

  const xMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i,
  )
  if (xMatch?.[1]) {
    const candidate = decodeURIComponent(xMatch[1]).replace(/^@/, '').trim()
    const reservedPrefixes = new Set([
      'i',
      'home',
      'explore',
      'search',
      'notifications',
      'messages',
      'settings',
      'compose',
      'intent',
      'share',
      'hashtag',
      'login',
      'signup',
      'account',
      'oauth',
      'tos',
      'privacy',
      'about',
      'jobs',
    ])
    if (!candidate || reservedPrefixes.has(candidate.toLowerCase())) {
      return ''
    }
    return candidate
  }

  return ''
}

export function normalizeUsernameLabel(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

export function extractDisplayName(source: TweetPresentationSource): string {
  const author = trimValue(source.author)
  if (author) {
    return author
  }
  return trimValue(source.title)
}

export function extractUsername(source: TweetPresentationSource): string {
  const byUrl =
    extractUrlUsername(source.feedImageUrl) ||
    extractUrlUsername(source.avatarUrl) ||
    extractUrlUsername(source.articleUrl)
  if (byUrl) {
    return `@${byUrl}`
  }

  return ''
}

export function preferredSourceAvatarUrl(
  source: TweetPresentationSource,
): string {
  const explicitAvatar = trimValue(source.avatarUrl)
  if (explicitAvatar) {
    return explicitAvatar
  }

  const feedAvatar = trimValue(source.feedImageUrl)
  if (feedAvatar) {
    return feedAvatar
  }

  return xAvatarUrl(extractUsername(source))
}

export function extractMetrics(source: string): TweetMetrics {
  const text = normalizeWhitespace(stripHtml(source).toLowerCase())
  return {
    replyCount: text.match(/(\d+)\s+replies?\b/)?.[1] ?? '',
    repostCount: text.match(/(\d+)\s+(?:reposts?|retweets?)\b/)?.[1] ?? '',
    likeCount: text.match(/(\d+)\s+likes?\b/)?.[1] ?? '',
    viewCount: text.match(/(\d+)\s+views?\b/)?.[1] ?? '',
  }
}
