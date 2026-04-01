export interface TweetEntryPresentation {
  displayName: string
  username: string
  text: string
  mediaUrls: string[]
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
}

function trimValue(value: string | undefined): string {
  return (value || '').trim()
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

function stripHtml(value: string): string {
  return decodeBasicHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|blockquote|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractText(summary: string, content: string): string {
  const source = trimValue(summary) || trimValue(content)
  if (!source) {
    return ''
  }

  const raw = decodeBasicHtml(source)
  const paragraphMatch = raw.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)
  const text = paragraphMatch?.[1]
    ? stripHtml(paragraphMatch[1])
    : stripHtml(raw)
  return normalizeWhitespace(text.split(/\n{2,}/)[0] ?? '')
}

function uniqueUrls(urls: string[]): string[] {
  const result: string[] = []
  urls.forEach((url: string) => {
    const trimmed = trimValue(url)
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed)
    }
  })
  return result
}

function extractUrlUsername(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  const unavatarMatch = trimmed.match(/unavatar\.io\/(?:x|twitter)\/([^/?#]+)/i)
  if (unavatarMatch?.[1]) {
    return decodeURIComponent(unavatarMatch[1]).replace(/^@/, '').trim()
  }

  const xMatch = trimmed.match(/(?:x|twitter)\.com\/([^/?#]+)/i)
  if (xMatch?.[1]) {
    return decodeURIComponent(xMatch[1]).replace(/^@/, '').trim()
  }

  return ''
}

function extractDisplayName(source: {
  author?: string
  title?: string
}): string {
  const author = trimValue(source.author)
  if (author) {
    return author
  }
  return trimValue(source.title)
}

function extractUsername(source: {
  author?: string
  articleUrl?: string
  feedImageUrl?: string
}): string {
  const byUrl =
    extractUrlUsername(source.feedImageUrl) ||
    extractUrlUsername(source.articleUrl)
  if (byUrl) {
    return `@${byUrl}`
  }

  const author = trimValue(source.author).replace(/^@/, '')
  return author ? `@${author}` : ''
}

function extractMetrics(
  source: string,
): Pick<
  TweetEntryPresentation,
  'replyCount' | 'repostCount' | 'likeCount' | 'viewCount'
> {
  const text = normalizeWhitespace(stripHtml(source).toLowerCase())
  const replyCount = text.match(/(\d+)\s+replies?\b/)?.[1] ?? ''
  const repostCount = text.match(/(\d+)\s+(?:reposts?|retweets?)\b/)?.[1] ?? ''
  const likeCount = text.match(/(\d+)\s+likes?\b/)?.[1] ?? ''
  const viewCount = text.match(/(\d+)\s+views?\b/)?.[1] ?? ''

  return {
    replyCount,
    repostCount,
    likeCount,
    viewCount,
  }
}

function presentTweetEntryFromSource(source: {
  title?: string
  summary?: string
  content?: string
  author?: string
  articleUrl?: string
  imageUrl?: string
  feedImageUrl?: string
  mediaUrls?: string[]
}): TweetEntryPresentation {
  const mediaUrls = uniqueUrls([
    ...(source.mediaUrls ?? []),
    ...(trimValue(source.imageUrl) ? [source.imageUrl ?? ''] : []),
  ])
  const textSource = `${source.summary || ''}\n${source.content || ''}`
  const metrics = extractMetrics(textSource)

  return {
    displayName: extractDisplayName(source),
    username: extractUsername(source),
    text: extractText(source.summary || '', source.content || ''),
    mediaUrls,
    replyCount: metrics.replyCount,
    repostCount: metrics.repostCount,
    likeCount: metrics.likeCount,
    viewCount: metrics.viewCount,
  }
}

export function presentTweetEntryFromEntry(entry: {
  title?: string
  summary?: string
  content?: string
  author?: string
  articleUrl?: string
  imageUrl?: string
  mediaUrls?: string[]
}): TweetEntryPresentation {
  return presentTweetEntryFromSource(entry)
}

export function presentTweetEntryFromCard(card: {
  title?: string
  summary?: string
  content?: string
  author?: string
  articleUrl?: string
  imageUrl?: string
  feedImageUrl?: string
  mediaUrls?: string[]
}): TweetEntryPresentation {
  return presentTweetEntryFromSource(card)
}
