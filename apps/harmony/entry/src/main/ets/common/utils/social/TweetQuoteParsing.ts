import {
  decodeBasicHtml,
  normalizedPlainText,
  normalizeParagraphWhitespace,
  normalizeWhitespace,
  stripHtml,
  trimValue,
  uniqueUrls,
} from './TweetTextNormalization.ts'
import { xAvatarUrl } from './TweetSourceExtraction.ts'
import { parseRetweet } from './TweetRetweetParsing.ts'
import type { ParsedRetweet } from './TweetRetweetParsing.ts'

export interface TweetQuotedPresentation {
  displayName: string
  username: string
  avatarUrl: string
  text: string
  mediaUrls: string[]
  nestedQuotedTweet?: TweetQuotedPresentation
}

export interface ParsedQuote {
  mainText: string
  quotedTweet: TweetQuotedPresentation
}

export interface ParsedRetweetWithNestedQuote {
  retweet: ParsedRetweet
  quotedTweet: TweetQuotedPresentation
}

interface TweetQuoteContentSource {
  summary?: string
  content?: string
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
  const pushUrl = (value: string): void => {
    const normalized = trimValue(decodeBasicHtml(value || ''))
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized)
    }
  }

  const imgMatches = Array.from(
    rawHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    (item: RegExpMatchArray) => item[1] || '',
  )
  imgMatches.forEach((url: string) => {
    pushUrl(url)
  })

  const videoTagMatches = Array.from(rawHtml.matchAll(/<video\b[^>]*>/gi))
  videoTagMatches.forEach((matched: RegExpMatchArray) => {
    const tag = matched[0] || ''
    const poster = tag.match(/\bposter=["']([^"']+)["']/i)?.[1] || ''
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || ''
    if (poster) {
      pushUrl(poster)
    }
    if (src) {
      pushUrl(src)
    }
  })

  const sourceTagMatches = Array.from(
    rawHtml.matchAll(/<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    (item: RegExpMatchArray) => item[1] || '',
  )
  sourceTagMatches.forEach((url: string) => {
    pushUrl(url)
  })

  return urls
}

export function parseQuotedTweetFromHtml(
  rawHtml: string,
): ParsedQuote | undefined {
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

  // Nitter blockquote format: <b>DisplayName (@handle)</b> followed by <p>content</p>
  const nitterAuthor = parseNitterBlockquoteAuthor(quoteRaw)

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

  if (lines.length < 1 && !nitterAuthor) {
    return undefined
  }

  // When Nitter author is available, the first paragraph is the tweet body
  // (not the author name). Use it directly.
  let header = ''
  let bodyLines: string[] = []
  if (nitterAuthor && lines.length >= 1) {
    // All paragraph lines are tweet body; no header-style author line to split
    bodyLines = lines
  } else if (lines.length >= 1) {
    header = lines[0]
    bodyLines = lines.slice(1)
  }

  const headerParts = splitQuoteHeader(header)
  const body = [headerParts.leadingText, ...bodyLines]
    .map((line: string) => trimValue(line))
    .filter((line: string) => !!line)
    .join('\n\n')
    .trim()

  const username = nitterAuthor?.username || parseQuoteUsername(header) || ''
  const displayName =
    nitterAuthor?.displayName ||
    headerParts.displayName ||
    parseQuoteDisplayName(header) ||
    ''

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

/**
 * Parse Nitter's blockquote author format: <b>DisplayName (@handle)</b>
 * Returns undefined when no <b> tag with @handle is found.
 */
function parseNitterBlockquoteAuthor(
  quoteRaw: string,
): { displayName: string; username: string } | undefined {
  const bMatch = quoteRaw.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)
  if (!bMatch?.[1]) {
    return undefined
  }

  const authorText = normalizeWhitespace(stripHtml(bMatch[1]))
  const usernameMatch = authorText.match(/@([A-Za-z0-9_]{1,15})/)
  if (!usernameMatch?.[1]) {
    return undefined
  }

  const username = `@${usernameMatch[1]}`
  // Strip the trailing " (@handle)" or "@handle" from the display name
  const displayName = authorText
    .replace(/\s*\(?\s*@[A-Za-z0-9_]{1,15}\s*\)?\s*$/, '')
    .trim()

  return {
    displayName: displayName || username.replace(/^@/, ''),
    username,
  }
}

export function findFirstParsedQuote(
  source: TweetQuoteContentSource,
): ParsedQuote | undefined {
  const candidateSources = [
    `${source.content || ''}`,
    `${source.summary || ''}`,
    `${source.summary || ''}\n${source.content || ''}`,
  ]

  for (const candidate of candidateSources) {
    const parsed = parseQuotedTweetFromHtml(candidate)
    if (parsed) {
      return parsed
    }
  }

  return undefined
}

export function parseRetweetWithNestedQuote(
  source: TweetQuoteContentSource,
): ParsedRetweetWithNestedQuote | undefined {
  const candidateSources = [
    `${source.content || ''}`,
    `${source.summary || ''}`,
    `${source.summary || ''}\n${source.content || ''}`,
  ]

  for (const candidate of candidateSources) {
    if (!candidate || !candidate.includes('<')) {
      continue
    }

    const parsedQuote = parseQuotedTweetFromHtml(candidate)
    if (!parsedQuote) {
      continue
    }

    const parsedRetweet = parseRetweet(parsedQuote.mainText)
    if (!parsedRetweet) {
      continue
    }

    return {
      retweet: parsedRetweet,
      quotedTweet: {
        displayName: trimValue(parsedQuote.quotedTweet.displayName),
        username: trimValue(parsedQuote.quotedTweet.username),
        avatarUrl: trimValue(parsedQuote.quotedTweet.avatarUrl),
        text: normalizeParagraphWhitespace(parsedQuote.quotedTweet.text || ''),
        mediaUrls: uniqueUrls(parsedQuote.quotedTweet.mediaUrls || []),
      },
    }
  }

  return undefined
}
