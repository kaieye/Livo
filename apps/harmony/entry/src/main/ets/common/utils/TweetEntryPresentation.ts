import { extractEntryGalleryImageUrls } from './PictureGallery.ts'

export interface TweetQuotedPresentation {
  displayName: string
  username: string
  avatarUrl: string
  text: string
  mediaUrls: string[]
}

export interface TweetEntryPresentation {
  kind: 'tweet' | 'retweet' | 'quote'
  retweetStyle: 'pure' | 'commented' | ''
  displayName: string
  username: string
  avatarUrl: string
  text: string
  mediaUrls: string[]
  publishedLabel: string
  articleUrl: string
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
  retweetByLabel: string
  quotedTweet?: TweetQuotedPresentation
}

interface TweetPresentationSource {
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

interface TweetMetrics {
  replyCount: string
  repostCount: string
  likeCount: string
  viewCount: string
}

interface ParsedRetweet {
  style: 'pure' | 'commented'
  commentText: string
  originalDisplayName: string
  originalUsername: string
  originalText: string
  originalAvatarUrl: string
}

interface ParsedQuote {
  mainText: string
  quotedTweet: TweetQuotedPresentation
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

function normalizeParagraphWhitespace(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function normalizedPlainText(value: string): string {
  return normalizeWhitespace(stripHtml(value))
}

function isMetricsOnlyParagraph(value: string): boolean {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) {
    return false
  }

  const stripped = normalized
    .replace(/\d[\d.,kmbw万]*/gi, '')
    .replace(/\b(?:repl(?:y|ies)|reposts?|retweets?|likes?|views?)\b/gi, '')
    .replace(/[·,，.:：/|()\-\s]+/g, '')

  return stripped.length === 0
}

function formatPublishedLabel(publishedAt: number | undefined): string {
  if (!publishedAt || !Number.isFinite(publishedAt)) {
    return ''
  }

  const target = new Date(publishedAt)
  if (Number.isNaN(target.getTime())) {
    return ''
  }

  const now = new Date()
  const sameYear = target.getFullYear() === now.getFullYear()
  const sameMonth = target.getMonth() === now.getMonth()
  const sameDate = target.getDate() === now.getDate()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const isYesterday =
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate()
  const hours = target.getHours().toString().padStart(2, '0')
  const minutes = target.getMinutes().toString().padStart(2, '0')

  if (sameYear && sameMonth && sameDate) {
    return `今天 ${hours}:${minutes}`
  }

  if (isYesterday) {
    return `昨天 ${hours}:${minutes}`
  }

  return `${sameYear ? '' : `${target.getFullYear()}年`}${target.getMonth() + 1}月${target.getDate()}日 ${hours}:${minutes}`
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

function extractText(summary: string, content: string): string {
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

function xAvatarUrl(username: string): string {
  const normalized = trimValue(username).replace(/^@+/, '')
  if (!normalized) {
    return ''
  }
  return `https://unavatar.io/x/${encodeURIComponent(normalized)}?fallback=false`
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

function normalizeUsernameLabel(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function extractDisplayName(source: TweetPresentationSource): string {
  const author = trimValue(source.author)
  if (author) {
    return author
  }
  return trimValue(source.title)
}

function extractUsername(source: TweetPresentationSource): string {
  const byUrl =
    extractUrlUsername(source.feedImageUrl) ||
    extractUrlUsername(source.avatarUrl) ||
    extractUrlUsername(source.articleUrl)
  if (byUrl) {
    return `@${byUrl}`
  }

  return ''
}

function preferredSourceAvatarUrl(source: TweetPresentationSource): string {
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

function extractMetrics(source: string): TweetMetrics {
  const text = normalizeWhitespace(stripHtml(source).toLowerCase())
  return {
    replyCount: text.match(/(\d+)\s+replies?\b/)?.[1] ?? '',
    repostCount: text.match(/(\d+)\s+(?:reposts?|retweets?)\b/)?.[1] ?? '',
    likeCount: text.match(/(\d+)\s+likes?\b/)?.[1] ?? '',
    viewCount: text.match(/(\d+)\s+views?\b/)?.[1] ?? '',
  }
}

function basePresentation(
  source: TweetPresentationSource,
): TweetEntryPresentation {
  const mediaUrls = uniqueUrls([
    ...(source.mediaUrls ?? []),
    ...(trimValue(source.imageUrl) ? [source.imageUrl ?? ''] : []),
    ...extractEntryGalleryImageUrls({
      summary: source.summary || '',
      content: source.content || '',
      articleUrl: source.articleUrl || '',
      siteUrl: source.articleUrl || '',
      mediaUrls: source.mediaUrls ?? [],
    }),
  ])
  const textSource = `${source.summary || ''}\n${source.content || ''}`
  const metrics = extractMetrics(textSource)
  return {
    kind: 'tweet',
    retweetStyle: '',
    displayName: extractDisplayName(source),
    username: extractUsername(source),
    avatarUrl: preferredSourceAvatarUrl(source),
    text: extractText(source.summary || '', source.content || ''),
    mediaUrls,
    publishedLabel:
      trimValue(source.publishedLabel) ||
      formatPublishedLabel(source.publishedAt),
    articleUrl: trimValue(source.articleUrl),
    replyCount: metrics.replyCount,
    repostCount: metrics.repostCount,
    likeCount: metrics.likeCount,
    viewCount: metrics.viewCount,
    retweetByLabel: '',
    quotedTweet: undefined,
  }
}

function parseRetweet(rawText: string): ParsedRetweet | undefined {
  const normalized = trimValue(rawText)
  if (!normalized) {
    return undefined
  }

  const pureMatch = normalized.match(
    /^RT\s+(@[A-Za-z0-9_]{1,15})\s*:\s*([\s\S]+)$/i,
  )
  if (pureMatch?.[1] && pureMatch?.[2]) {
    const username = trimValue(pureMatch[1])
    const text = trimValue(pureMatch[2])
    if (username && text) {
      return {
        style: 'pure',
        commentText: '',
        originalDisplayName: username.replace(/^@/, ''),
        originalUsername: username,
        originalText: normalizeParagraphWhitespace(text),
        originalAvatarUrl: xAvatarUrl(username),
      }
    }
  }

  const commentedMatch = normalized.match(
    /^([\s\S]+?)\s+RT\s+(@[A-Za-z0-9_]{1,15})\s*:\s*([\s\S]+)$/i,
  )
  if (commentedMatch?.[1] && commentedMatch?.[2] && commentedMatch?.[3]) {
    const commentText = normalizeParagraphWhitespace(commentedMatch[1])
    const username = trimValue(commentedMatch[2])
    const text = trimValue(commentedMatch[3])
    if (commentText && username && text) {
      return {
        style: 'commented',
        commentText,
        originalDisplayName: username.replace(/^@/, ''),
        originalUsername: username,
        originalText: normalizeParagraphWhitespace(text),
        originalAvatarUrl: xAvatarUrl(username),
      }
    }
  }

  return parseRetweetWithLoosePattern(normalized)
}

function parseLooseRetweetBody(
  rawBody: string,
): Omit<ParsedRetweet, 'style' | 'commentText'> | undefined {
  const normalized = normalizeParagraphWhitespace(rawBody)
  if (!normalized) {
    return undefined
  }

  const colonMatch = normalized.match(/^([^:\n：]{1,80})\s*[：:]\s*([\s\S]+)$/)
  if (colonMatch?.[1] && colonMatch?.[2]) {
    const header = trimValue(colonMatch[1])
    const body = normalizeParagraphWhitespace(colonMatch[2])
    if (!body) {
      return undefined
    }
    const username = /^@[A-Za-z0-9_]{1,15}$/.test(header) ? header : ''
    const displayName = username ? username.replace(/^@/, '') : header
    return {
      originalDisplayName: displayName,
      originalUsername: username,
      originalText: body,
      originalAvatarUrl: xAvatarUrl(username),
    }
  }

  const lines = normalized
    .split(/\n+/)
    .map((line: string) => trimValue(line))
    .filter((line: string) => !!line)
  if (lines.length >= 2) {
    const header = lines[0]
    const body = normalizeParagraphWhitespace(lines.slice(1).join('\n\n'))
    if (!body) {
      return undefined
    }
    const username = /^@[A-Za-z0-9_]{1,15}$/.test(header) ? header : ''
    const displayName = username ? username.replace(/^@/, '') : header
    return {
      originalDisplayName: displayName,
      originalUsername: username,
      originalText: body,
      originalAvatarUrl: xAvatarUrl(username),
    }
  }

  const tokens = normalized.split(/\s+/).filter((item: string) => !!item)
  const displayNameTokens: string[] = []
  for (const token of tokens) {
    if (displayNameTokens.length >= 4) {
      break
    }
    if (!/^(?:[A-Z][a-zA-Z'’-]*|[A-Z]{2,})$/.test(token)) {
      break
    }
    displayNameTokens.push(token)
  }
  if (
    displayNameTokens.length >= 2 &&
    displayNameTokens.length < tokens.length
  ) {
    const displayName = displayNameTokens.join(' ')
    const body = normalizeParagraphWhitespace(
      tokens.slice(displayNameTokens.length).join(' '),
    )
    if (body) {
      return {
        originalDisplayName: displayName,
        originalUsername: '',
        originalText: body,
        originalAvatarUrl: '',
      }
    }
  }

  if (tokens.length >= 2 && /^[A-Z][a-zA-Z'’-]*$/.test(tokens[0])) {
    const displayName = tokens[0]
    const body = normalizeParagraphWhitespace(tokens.slice(1).join(' '))
    if (body) {
      return {
        originalDisplayName: displayName,
        originalUsername: '',
        originalText: body,
        originalAvatarUrl: '',
      }
    }
  }

  return {
    originalDisplayName: '',
    originalUsername: '',
    originalText: normalized,
    originalAvatarUrl: '',
  }
}

function looksLikeLooseRetweetBody(rawBody: string): boolean {
  const normalized = normalizeWhitespace(rawBody)
  if (!normalized) {
    return false
  }
  const firstToken = (normalized.match(/^([^\s]+)/)?.[1] || '').toLowerCase()
  const plainSentenceStarters = new Set([
    'this',
    'that',
    'the',
    'a',
    'an',
    'to',
    'is',
    'it',
    'i',
    'we',
    'you',
    'he',
    'she',
    'they',
  ])
  return !plainSentenceStarters.has(firstToken)
}

function comparableRetweetText(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

function isComparableDuplicateRetweetText(a: string, b: string): boolean {
  if (!a || !b) {
    return false
  }
  if (a === b) {
    return true
  }
  const minLength = Math.min(a.length, b.length)
  const maxLength = Math.max(a.length, b.length)
  if (minLength < 20) {
    return false
  }
  if (minLength / maxLength < 0.82) {
    return false
  }
  return a.includes(b) || b.includes(a)
}

function parseRetweetWithLoosePattern(
  rawText: string,
): ParsedRetweet | undefined {
  const normalized = trimValue(rawText)
  if (!normalized) {
    return undefined
  }

  const looseCommentedMatch = normalized.match(/^([\s\S]+?)\s+RT\s+([\s\S]+)$/i)
  if (looseCommentedMatch?.[1] && looseCommentedMatch?.[2]) {
    const commentText = normalizeParagraphWhitespace(looseCommentedMatch[1])
    const retweetBodyRaw = normalizeParagraphWhitespace(looseCommentedMatch[2])
    const normalizedComment = normalizeWhitespace(commentText)
    const normalizedCommentWithoutRt = normalizeWhitespace(
      commentText.replace(/^RT\s+/i, ''),
    )
    const normalizedBody = normalizeWhitespace(retweetBodyRaw)
    const comparableCommentWithoutRt = comparableRetweetText(
      commentText.replace(/^RT\s+/i, ''),
    )
    const comparableBody = comparableRetweetText(retweetBodyRaw)
    if (
      normalizedComment === normalizedBody ||
      normalizedCommentWithoutRt === normalizedBody ||
      (!!comparableCommentWithoutRt &&
        !!comparableBody &&
        isComparableDuplicateRetweetText(
          comparableCommentWithoutRt,
          comparableBody,
        ))
    ) {
      const duplicatedPure = parseLooseRetweetBody(retweetBodyRaw)
      if (duplicatedPure?.originalText) {
        return {
          style: 'pure',
          commentText: '',
          ...duplicatedPure,
        }
      }
    }
    const retweetBody = parseLooseRetweetBody(retweetBodyRaw)
    if (commentText && retweetBody?.originalText) {
      return {
        style: 'commented',
        commentText,
        ...retweetBody,
      }
    }
  }

  if (!/^RT\s+/i.test(normalized)) {
    return undefined
  }

  const body = normalized.replace(/^RT\s+/i, '')
  if (!looksLikeLooseRetweetBody(body)) {
    return undefined
  }
  const retweetBody = parseLooseRetweetBody(body)
  if (!retweetBody?.originalText) {
    return undefined
  }
  return {
    style: 'pure',
    commentText: '',
    ...retweetBody,
  }
}

function parseQuoteDisplayName(header: string): string {
  const normalized = trimValue(header).replace(/[：:]+\s*$/, '')
  const matched = normalized.match(/^(.+?)\s+@[A-Za-z0-9_]{1,15}$/)
  return trimValue(matched?.[1] || normalized)
}

function splitQuoteHeader(header: string): {
  displayName: string
  leadingText: string
} {
  const normalized = trimValue(header)
  if (!normalized) {
    return { displayName: '', leadingText: '' }
  }

  const colonMatch = normalized.match(/^(.+?)[：:](\s*.*)$/)
  if (colonMatch?.[1]) {
    return {
      displayName: trimValue(colonMatch[1]),
      leadingText: trimValue(colonMatch[2] || ''),
    }
  }

  return {
    displayName: parseQuoteDisplayName(normalized),
    leadingText: '',
  }
}

function parseQuoteUsername(header: string): string {
  const matched = header.match(/(@[A-Za-z0-9_]{1,15})/)
  return trimValue(matched?.[1] || '')
}

function extractMediaUrlsFromHtml(rawHtml: string): string[] {
  const urls: string[] = []
  const imgMatches = Array.from(
    rawHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    (item: RegExpMatchArray) => trimValue(decodeBasicHtml(item[1] || '')),
  )
  const videoMatches = Array.from(
    rawHtml.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    (item: RegExpMatchArray) => trimValue(decodeBasicHtml(item[1] || '')),
  )

  imgMatches.concat(videoMatches).forEach((url: string) => {
    if (url && !urls.includes(url)) {
      urls.push(url)
    }
  })

  return urls
}

function parseQuotedTweetFromHtml(rawHtml: string): ParsedQuote | undefined {
  const matched = rawHtml.match(
    /([\s\S]*?)(?:<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>|<div\b[^>]*class=["'][^"']*rsshub-quote[^"']*["'][^>]*>([\s\S]*?)<\/div>)/i,
  )
  if (!matched?.[1] || !matched?.[2]) {
    if (!matched?.[1] || !matched?.[3]) {
      return undefined
    }
  }

  const mainText = normalizedPlainText(matched[1])
  const quoteRaw = matched[2] || matched[3]
  if (!mainText || !quoteRaw) {
    return undefined
  }

  const quoteMediaUrls = extractMediaUrlsFromHtml(quoteRaw)

  const paragraphMatches = Array.from(
    quoteRaw.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
    (item: RegExpMatchArray) => normalizeWhitespace(stripHtml(item[1] || '')),
  ).filter((line: string) => !!line)

  const lines =
    paragraphMatches.length > 0
      ? paragraphMatches
      : stripHtml(quoteRaw)
          .split(/\n+/)
          .map((line: string) => normalizeWhitespace(line))
          .filter((line: string) => !!line)

  if (lines.length < 1) {
    return undefined
  }

  const header = lines[0]
  const headerParts = splitQuoteHeader(header)
  const body = [headerParts.leadingText, ...lines.slice(1)]
    .map((line: string) => trimValue(line))
    .filter((line: string) => !!line)
    .join('\n\n')
    .trim()
  const username = parseQuoteUsername(header)
  const displayName = headerParts.displayName || parseQuoteDisplayName(header)
  if ((!body && quoteMediaUrls.length === 0) || (!displayName && !username)) {
    return undefined
  }

  return {
    mainText,
    quotedTweet: {
      displayName: displayName || username.replace(/^@/, ''),
      username,
      avatarUrl: xAvatarUrl(username),
      text: body,
      mediaUrls: quoteMediaUrls,
    },
  }
}

function applyRetweetSemantics(
  base: TweetEntryPresentation,
  source: TweetPresentationSource,
): TweetEntryPresentation | undefined {
  const rawText = normalizedPlainText(
    `${source.summary || ''}\n${source.content || ''}`,
  )
  const parsed = parseRetweet(rawText)
  if (!parsed) {
    return undefined
  }

  const originalAuthorLabel =
    trimValue(parsed.originalDisplayName) ||
    trimValue(parsed.originalUsername).replace(/^@/, '') ||
    ''
  const normalizedOriginalText = normalizeParagraphWhitespace(
    parsed.originalText,
  )
  const originalAvatarUrl =
    parsed.originalAvatarUrl || xAvatarUrl(parsed.originalUsername)
  const quotedTweet: TweetQuotedPresentation = {
    displayName: originalAuthorLabel,
    username: trimValue(parsed.originalUsername),
    avatarUrl: originalAvatarUrl,
    text: normalizedOriginalText,
    mediaUrls: [],
  }

  if (parsed.style === 'commented') {
    const commentText = normalizeParagraphWhitespace(parsed.commentText)
    return {
      ...base,
      kind: 'retweet',
      retweetStyle: 'commented',
      retweetByLabel: base.displayName,
      text: commentText,
      quotedTweet,
    }
  }

  return {
    ...base,
    kind: 'retweet',
    retweetStyle: 'pure',
    retweetByLabel: base.displayName,
    text: '',
    quotedTweet,
  }
}

function applyQuoteSemantics(
  base: TweetEntryPresentation,
  source: TweetPresentationSource,
): TweetEntryPresentation | undefined {
  const candidateSources = [
    `${source.content || ''}`,
    `${source.summary || ''}`,
    `${source.summary || ''}\n${source.content || ''}`,
  ]

  let parsed: ParsedQuote | undefined
  for (const candidate of candidateSources) {
    parsed = parseQuotedTweetFromHtml(candidate)
    if (parsed) {
      break
    }
  }

  if (!parsed) {
    return undefined
  }

  const quotedMediaUrls = parsed.quotedTweet.mediaUrls || []
  const mediaUrls =
    quotedMediaUrls.length > 0
      ? (base.mediaUrls || []).filter(
          (url: string) => !quotedMediaUrls.includes(url),
        )
      : base.mediaUrls

  return {
    ...base,
    kind: 'quote',
    text: parsed.mainText,
    mediaUrls,
    quotedTweet: parsed.quotedTweet,
  }
}

function presentTweetEntryFromSource(
  source: TweetPresentationSource,
): TweetEntryPresentation {
  const base = basePresentation(source)
  return (
    applyRetweetSemantics(base, source) ||
    applyQuoteSemantics(base, source) ||
    base
  )
}

export function presentTweetEntryFromEntry(
  entry: {
    title?: string
    summary?: string
    content?: string
    author?: string
    articleUrl?: string
    imageUrl?: string
    publishedAt?: number
    publishedLabel?: string
    mediaUrls?: string[]
  },
  avatarUrl: string,
): TweetEntryPresentation {
  return presentTweetEntryFromSource({
    ...entry,
    avatarUrl,
  })
}

export function presentTweetEntryFromCard(card: {
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
}): TweetEntryPresentation {
  const source = {
    ...card,
    avatarUrl: card.feedImageUrl,
  }
  const presentation = presentTweetEntryFromSource(source)
  const sourceAvatarUrl = preferredSourceAvatarUrl(source)

  return {
    ...presentation,
    username:
      presentation.username || normalizeUsernameLabel(extractUsername(source)),
    avatarUrl: sourceAvatarUrl || presentation.avatarUrl,
  }
}
