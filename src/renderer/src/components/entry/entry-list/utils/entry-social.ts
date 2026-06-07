/**
 * Social media platform parsing and handle extraction
 */
import { normalizeSocialHandle } from '../../../../lib/social-url'

export type SocialPlatformType =
  | 'x'
  | 'telegram'
  | 'bluesky'
  | 'threads'
  | 'truth'
  | 'other'

export interface ParsedSocialHandle {
  type: SocialPlatformType
  handle?: string
}

/**
 * Parse social media platform handle from URL - supports X/Twitter, Telegram, Bluesky, Threads, Truth Social
 */
export function parseSocialHandle(url: string): ParsedSocialHandle {
  // X / Twitter including Nitter mirrors.
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (
      host === 'x.com' ||
      host === 'twitter.com' ||
      host === 'www.twitter.com' ||
      host.includes('nitter')
    ) {
      const first = u.pathname.split('/').filter(Boolean)[0]
      if (first && /^[a-zA-Z0-9_]+$/.test(first))
        return { type: 'x', handle: normalizeSocialHandle(first) }
    }
  } catch {
    // Ignore parse failure; regex fallbacks below.
  }
  const xMatch = url.match(
    /(?:twitter\.com|x\.com|nitter\.[^/]+)\/([a-zA-Z0-9_]+)/,
  )
  if (xMatch) return { type: 'x', handle: normalizeSocialHandle(xMatch[1]) }
  // RSSHub twitter route
  const xRss = url.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/)
  if (xRss) return { type: 'x', handle: normalizeSocialHandle(xRss[1]) }
  // Telegram
  const tgMatch = url.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/)
  if (tgMatch) return { type: 'telegram', handle: tgMatch[1] }
  const tgRss = url.match(/\/telegram\/channel\/([a-zA-Z0-9_]+)/)
  if (tgRss) return { type: 'telegram', handle: tgRss[1] }
  // Bluesky
  const bskyMatch = url.match(/bsky\.(?:app|social)\/profile\/([a-zA-Z0-9_.]+)/)
  if (bskyMatch) return { type: 'bluesky', handle: bskyMatch[1] }
  const bskyRss = url.match(/\/bsky\/profile\/([a-zA-Z0-9_.]+)/)
  if (bskyRss) return { type: 'bluesky', handle: bskyRss[1] }
  // Threads
  const threadsMatch = url.match(/threads\.net\/@?([a-zA-Z0-9_.]+)/)
  if (threadsMatch)
    return { type: 'threads', handle: normalizeSocialHandle(threadsMatch[1]) }
  const threadsRss = url.match(/\/threads\/user\/([a-zA-Z0-9_.]+)/)
  if (threadsRss)
    return { type: 'threads', handle: normalizeSocialHandle(threadsRss[1]) }
  // Truth Social
  const truthMatch = url.match(/truthsocial\.com\/@?([a-zA-Z0-9_]+)/)
  if (truthMatch)
    return { type: 'truth', handle: normalizeSocialHandle(truthMatch[1]) }
  const truthRss = url.match(/\/truthsocial\/user\/([a-zA-Z0-9_]+)/)
  if (truthRss)
    return { type: 'truth', handle: normalizeSocialHandle(truthRss[1]) }
  return { type: 'other' }
}

/**
 * Extract Twitter display name from feed title by removing platform suffixes and handles
 */
export function extractTwitterDisplayNameFromFeedTitle(
  feedTitle?: string,
  handle?: string,
): string {
  let cleaned = (feedTitle || '').trim()
  if (!cleaned) return ''

  cleaned = cleaned
    .replace(/\s*-\s*(?:x|twitter)\s*$/i, '')
    .replace(/\s+on\s+(?:x|twitter)\s*$/i, '')
    .replace(/\(\s*@?[a-zA-Z0-9_]{1,15}\s*\)/g, '')
    .trim()

  const slashParts = cleaned
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (slashParts.length > 1) {
    const nonHandle = slashParts.find(
      (part) => !/^@?[a-zA-Z0-9_]{1,15}$/.test(part),
    )
    if (nonHandle) cleaned = nonHandle
  }
  cleaned = cleaned.replace(/\/\s*@?[a-zA-Z0-9_]{1,15}\s*$/i, '').trim()

  if (!cleaned) return ''
  if (
    handle &&
    cleaned.replace(/^@/, '').toLowerCase() ===
      handle.replace(/^@/, '').toLowerCase()
  )
    return ''
  return cleaned.replace(/^@+/, '').trim()
}
