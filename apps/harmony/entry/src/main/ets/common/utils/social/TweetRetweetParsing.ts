import {
  normalizedPlainText,
  normalizeParagraphWhitespace,
  normalizeWhitespace,
  trimValue,
} from './TweetTextNormalization.ts'
import { xAvatarUrl } from './TweetSourceExtraction.ts'

export interface ParsedRetweet {
  style: 'pure' | 'commented'
  commentText: string
  originalDisplayName: string
  originalUsername: string
  originalText: string
  originalAvatarUrl: string
}

export function parseRetweet(rawText: string): ParsedRetweet | undefined {
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

export function parseRetweetAuthorFromTitle(title: string):
  | {
      displayName: string
      username: string
    }
  | undefined {
  const normalized = normalizedPlainText(title)
  if (!normalized) {
    return undefined
  }
  const matched = normalized.match(/^RT\s+(.+?)\s*[:：]\s*[\s\S]+$/i)
  if (!matched?.[1]) {
    return undefined
  }
  const authorRaw = trimValue(matched[1])
  if (!authorRaw) {
    return undefined
  }
  const username = /^@[A-Za-z0-9_]{1,15}$/.test(authorRaw) ? authorRaw : ''
  return {
    displayName: username ? authorRaw.replace(/^@/, '') : authorRaw,
    username,
  }
}

export function stripDuplicatedRetweetLeadingBadge(
  displayName: string,
  text: string,
): string {
  const normalizedDisplayName = trimValue(displayName)
  const normalizedText = normalizeParagraphWhitespace(text)
  if (!normalizedDisplayName || !normalizedText) {
    return normalizedText
  }

  const isDecorativeToken = (token: string): boolean => {
    return !!token && !/[A-Za-z0-9_]/.test(token)
  }

  const nameTokens = normalizedDisplayName
    .split(/\s+/)
    .map((item: string) => trimValue(item))
    .filter((item: string) => !!item)
  const textTokens = normalizedText
    .split(/\s+/)
    .map((item: string) => trimValue(item))
    .filter((item: string) => !!item)

  if (nameTokens.length === 0 || textTokens.length <= 1) {
    return normalizedText
  }

  const decorativeTail: string[] = []
  for (let index = nameTokens.length - 1; index >= 0; index--) {
    const token = nameTokens[index]
    if (!isDecorativeToken(token)) {
      break
    }
    decorativeTail.unshift(token)
  }

  const decorativeHead: string[] = []
  for (let index = 0; index < textTokens.length; index++) {
    const token = textTokens[index]
    if (!isDecorativeToken(token)) {
      break
    }
    decorativeHead.push(token)
  }

  if (decorativeTail.length === 0 || decorativeHead.length === 0) {
    return normalizedText
  }

  const maxOverlap = Math.min(decorativeTail.length, decorativeHead.length)
  let overlap = 0
  for (let size = maxOverlap; size >= 1; size--) {
    const tailSegment = decorativeTail.slice(decorativeTail.length - size)
    const headSegment = decorativeHead.slice(0, size)
    if (tailSegment.join(' ') === headSegment.join(' ')) {
      overlap = size
      break
    }
  }

  if (overlap <= 0) {
    return normalizedText
  }

  const trimmedTokens = textTokens.slice(overlap)
  if (trimmedTokens.length === 0) {
    return normalizedText
  }

  return normalizeParagraphWhitespace(trimmedTokens.join(' '))
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
    let body = normalizeParagraphWhitespace(colonMatch[2])
    if (!body) {
      return undefined
    }
    const username = /^@[A-Za-z0-9_]{1,15}$/.test(header) ? header : ''
    let displayName = username ? username.replace(/^@/, '') : header
    if (!username) {
      const headerTopicMatch = header.match(
        /^([A-Z][a-zA-Z'’-]*\s+[A-Z][a-zA-Z'’-]*)\s+([A-Z][a-zA-Z'’-]*\s+(?:on|about|regarding)\b[\s\S]*)$/i,
      )
      if (headerTopicMatch?.[1] && headerTopicMatch?.[2]) {
        displayName = trimValue(headerTopicMatch[1])
        body = normalizeParagraphWhitespace(
          `${trimValue(headerTopicMatch[2])}: ${body}`,
        )
      }
    }
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

  // 处理单行格式：`Mario Nawfal Elon on ...`
  // 其中 `Mario Nawfal` 才是转发用户名，后半段是正文。
  const topicLeadMatch = normalized.match(
    /^([A-Z][a-zA-Z'’-]*\s+[A-Z][a-zA-Z'’-]*)\s+([A-Z][a-zA-Z'’-]*)\s+(on|about|regarding)\b([\s\S]*)$/i,
  )
  if (topicLeadMatch?.[1] && topicLeadMatch?.[2] && topicLeadMatch?.[3]) {
    const displayName = trimValue(topicLeadMatch[1])
    const body = normalizeParagraphWhitespace(
      `${topicLeadMatch[2]} ${topicLeadMatch[3]}${topicLeadMatch[4] || ''}`,
    )
    if (displayName && body) {
      return {
        originalDisplayName: displayName,
        originalUsername: '',
        originalText: body,
        originalAvatarUrl: '',
      }
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
    .replace(/[^a-z0-9一-鿿]+/g, '')
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
