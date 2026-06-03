/**
 * Shared pure utility functions for discover search / feed resolution.
 * Used by both the Electron main-process handler and the web adapter.
 */

export function normalizeDiscoverQueryToFeedUrl(
  query: string,
  rsshubInstance: string,
): string {
  const trimmed = query.trim()
  if (!trimmed) return trimmed
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    const base = rsshubInstance.replace(/\/+$/, '')
    return `${base}/${route}`
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function extractBilibiliUid(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const m = u.pathname.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    return m?.[1] || null
  } catch {
    return null
  }
}

export function extractTwitterUsernameFromUrl(value: string): string {
  try {
    const u = new URL(value)
    const rsshubMatch = u.pathname.match(/\/twitter\/user\/([^/?#]+)/i)
    if (rsshubMatch?.[1])
      return decodeURIComponent(rsshubMatch[1]).replace(/^@/, '')
    if (u.hostname.toLowerCase().includes('nitter')) {
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length >= 2 && parts[1].toLowerCase() === 'rss') {
        return decodeURIComponent(parts[0]).replace(/^@/, '')
      }
    }
    if (/^(www\.)?(x\.com|twitter\.com)$/i.test(u.hostname)) {
      return (u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '')
    }
  } catch {
    // Ignore malformed URL.
  }
  return ''
}

export function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function extractTwitterDisplayNameFromText(
  text: string,
  username: string,
): string {
  const raw = (text || '').trim()
  if (!raw) return ''
  const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const withHandle = new RegExp(
    `^(.+?)\\s*\\(\\s*@?${escapedUser}\\s*\\)\\s*(?:\\/|[-\\u2013\\u2014]|on)\\s*(?:x|twitter)\\s*$`,
    'i',
  )
  const m1 = raw.match(withHandle)
  if (m1?.[1]) return m1[1].trim()
  const withoutHandle = raw.match(
    /^(.+?)\s*(?:\/|[-–—]|on)\s*(?:x|twitter)\s*$/i,
  )
  if (withoutHandle?.[1]) {
    const name = withoutHandle[1].trim().replace(/^@/, '')
    if (name && name.toLowerCase() !== username.toLowerCase()) return name
  }
  return ''
}

export function isGenericTwitterTitle(
  title: string,
  username: string,
): boolean {
  const cleaned = (title || '').trim().toLowerCase()
  const user = username.trim().replace(/^@/, '').toLowerCase()
  if (!cleaned || !user) return true
  return (
    cleaned === user ||
    cleaned === `@${user}` ||
    cleaned === `${user} - x` ||
    cleaned === `@${user} - x`
  )
}

/** Format follower count number to human-readable string like "1.2M" */
export function formatFollowerCount(count: number): string {
  if (count >= 1_000_000_000) {
    return (count / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  }
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return count.toString()
}

export function normalizeXFollowersLabel(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  const numberFirst = text.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
  if (numberFirst?.[1]) {
    const value = Number(
      numberFirst[1].replace(/[, ]/g, '').replace(/[KMB]$/i, ''),
    )
    if (Number.isFinite(value) && value <= 0) return undefined
    return `${numberFirst[1].trim()} followers`
  }
  const wordFirst = text.match(/followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i)
  if (wordFirst?.[1]) {
    const value = Number(
      wordFirst[1].replace(/[, ]/g, '').replace(/[KMB]$/i, ''),
    )
    if (Number.isFinite(value) && value <= 0) return undefined
    return `${wordFirst[1].trim()} followers`
  }
  return undefined
}

export function normalizeNameForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[@\s_.-]+/g, '')
    .trim()
}
