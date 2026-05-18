export function trimValue(value: string | undefined): string {
  return (value || '').trim()
}

export function decodeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export function stripHtml(value: string): string {
  return decodeBasicHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|blockquote|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeParagraphWhitespace(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function normalizedPlainText(value: string): string {
  return normalizeWhitespace(stripHtml(value))
}

export function isMetricsOnlyParagraph(value: string): boolean {
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

export function formatPublishedLabel(publishedAt: number | undefined): string {
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

export function uniqueUrls(urls: string[]): string[] {
  const result: string[] = []
  urls.forEach((url: string) => {
    const trimmed = trimValue(url)
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed)
    }
  })
  return result
}
