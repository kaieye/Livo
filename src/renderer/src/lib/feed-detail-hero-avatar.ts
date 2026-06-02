/**
 * FeedDetailHeroAvatar — candidate URL building utilities ported from Harmony's
 * `FeedDetailHeroAvatar.ets`. Builds an ordered list of avatar image URLs for
 * the feed detail hero card, with platform-specific unavatar.io candidates and
 * favicon fallback.
 */

function extractInstagramUsername(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const path = (u.pathname || '').toLowerCase()
    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return decodeURIComponent(ig[1]).replace(/^@/, '')
    const picnob = path.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, '')
    const pixnoy = path.match(/\/pixnoy\/user\/([^/?#]+)/i)
    if (pixnoy?.[1]) return decodeURIComponent(pixnoy[1]).replace(/^@/, '')
    const piokok = path.match(/\/piokok\/user\/([^/?#]+)/i)
    if (piokok?.[1]) return decodeURIComponent(piokok[1]).replace(/^@/, '')
    const pixwox = path.match(/\/pixwox\/user\/([^/?#]+)/i)
    if (pixwox?.[1]) return decodeURIComponent(pixwox[1]).replace(/^@/, '')
    if (
      /^(picnob|picnob\.info|pixnoy|piokok|pixwox|instagram)$/i.test(u.hostname)
    ) {
      const hostRoute = path.match(/\/user\/([^/?#]+)/i)
      if (hostRoute?.[1])
        return decodeURIComponent(hostRoute[1]).replace(/^@/, '')
    }
    if (/^(www\.)?instagram\.com$/i.test(u.hostname)) {
      const user = path.split('/').filter(Boolean)[0]
      if (user) return decodeURIComponent(user).replace(/^@/, '')
    }
  } catch {
    // Fall through to non-URL parsing.
  }
  // rsshub:// protocol
  const proto = raw.match(
    /^rsshub:\/\/(?:picnob(?:\.info)?|pixnoy|piokok|pixwox|instagram)\/user\/([^/?#]+)/i,
  )
  if (proto?.[1]) return decodeURIComponent(proto[1]).replace(/^@/, '')
  // Title-based extraction
  const titleMatch = raw.match(/(?:^|\s)@([a-zA-Z0-9_.]+)/)
  if (titleMatch?.[1]) return titleMatch[1]
  return null
}

function extractXUsername(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const path = (u.pathname || '').toLowerCase()
    const x = path.match(/\/(?:twitter|x)\/user\/([^/?#]+)/i)
    if (x?.[1]) return decodeURIComponent(x[1]).replace(/^@/, '')
  } catch {
    // Fall through.
  }
  const proto = raw.match(
    /^rsshub:\/\/.*(?:\/twitter\/user\/|\/x\/user\/)([^/?#]+)/i,
  )
  if (proto?.[1]) return decodeURIComponent(proto[1]).replace(/^@/, '')
  const titleMatch = raw.match(/(?:^|\s)@([a-zA-Z0-9_]+)/)
  if (titleMatch?.[1]) return titleMatch[1]
  return null
}

function extractBilibiliUid(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const m = u.pathname.match(
      /\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    if (m?.[1]) return m[1]
  } catch {
    // Fall through.
  }
  const proto = raw.match(
    /^rsshub:\/\/.*\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
  )
  if (proto?.[1]) return proto[1]
  return null
}

function extractYouTubeIdentity(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const path = (u.pathname || '').toLowerCase()
    const channel = path.match(/\/youtube\/channel\/([^/?#]+)/i)
    if (channel?.[1]) return `channel:${channel[1]}`
    const handle = path.match(/\/youtube\/@([^/?#]+)/i)
    if (handle?.[1]) return `handle:${decodeURIComponent(handle[1])}`
    const user = path.match(/\/youtube\/user\/([^/?#]+)/i)
    if (user?.[1]) return `user:${decodeURIComponent(user[1])}`
  } catch {
    // Fall through.
  }
  const protoChannel = raw.match(/^rsshub:\/\/.*\/youtube\/channel\/([^/?#]+)/i)
  if (protoChannel?.[1]) return `channel:${protoChannel[1]}`
  const protoHandle = raw.match(/^rsshub:\/\/.*\/youtube\/@([^/?#]+)/i)
  if (protoHandle?.[1]) return `handle:${decodeURIComponent(protoHandle[1])}`
  return null
}

function dedupeUrls(urls: string[]): string[] {
  const result: string[] = []
  for (const url of urls) {
    const trimmed = url.trim()
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed)
    }
  }
  return result
}

function pushCandidate(values: string[], value: string): void {
  const trimmed = (value || '').trim()
  if (!trimmed) return
  values.push(trimmed)
}

interface FeedDetailHeroAvatarInput {
  imageUrl?: string | null
  url?: string
  siteUrl?: string | null
  title?: string | null
}

/**
 * Build ordered avatar candidate URLs for a feed detail hero card.
 *
 * Priority order:
 * 1. The feed's own `imageUrl` (if non-empty)
 * 2. Platform-specific unavatar.io URLs (Instagram, X, Bilibili, YouTube)
 * 3. favicon.ico fallback from the site hostname
 */
export function buildFeedDetailHeroAvatarCandidates(
  feed: FeedDetailHeroAvatarInput,
): string[] {
  const candidates: string[] = []

  // 1. Direct image URL from feed
  pushCandidate(candidates, feed.imageUrl || '')

  // Collect all candidate source URLs for identity extraction
  const sourceUrls = [feed.url || '', feed.siteUrl || ''].filter(Boolean)

  // 2. Instagram unavatar
  let instagramUsername: string | null = null
  for (const sourceUrl of sourceUrls) {
    instagramUsername = extractInstagramUsername(sourceUrl)
    if (instagramUsername) break
  }
  if (!instagramUsername) {
    instagramUsername = extractInstagramUsername(feed.title || '')
  }
  if (instagramUsername) {
    pushCandidate(
      candidates,
      `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`,
    )
  }

  // 3. X/Twitter unavatar
  let xUsername: string | null = null
  for (const sourceUrl of sourceUrls) {
    xUsername = extractXUsername(sourceUrl)
    if (xUsername) break
  }
  if (!xUsername) {
    xUsername = extractXUsername(feed.title || '')
  }
  if (xUsername) {
    pushCandidate(
      candidates,
      `https://unavatar.io/x/${encodeURIComponent(xUsername)}`,
    )
  }

  // 4. Bilibili & YouTube unavatar from source URLs
  for (const sourceUrl of sourceUrls) {
    const bilibiliUid = extractBilibiliUid(sourceUrl)
    if (bilibiliUid) {
      pushCandidate(
        candidates,
        `https://unavatar.io/bilibili/${encodeURIComponent(bilibiliUid)}?fallback=false`,
      )
    }

    const ytIdentity = extractYouTubeIdentity(sourceUrl)
    if (ytIdentity) {
      if (ytIdentity.startsWith('channel:')) {
        pushCandidate(
          candidates,
          `https://unavatar.io/youtube/${encodeURIComponent(ytIdentity.replace(/^channel:/, ''))}?fallback=false`,
        )
      } else if (ytIdentity.startsWith('handle:')) {
        pushCandidate(
          candidates,
          `https://unavatar.io/youtube/${encodeURIComponent(ytIdentity.replace(/^handle:/, ''))}?fallback=false`,
        )
      } else if (ytIdentity.startsWith('user:')) {
        pushCandidate(
          candidates,
          `https://unavatar.io/youtube/${encodeURIComponent(ytIdentity.replace(/^user:/, ''))}?fallback=false`,
        )
      }
    }
  }

  // 5. favicon.ico fallback
  const host = extractHost(feed.siteUrl || feed.url || '')
  if (host) {
    pushCandidate(candidates, `https://${host}/favicon.ico`)
  }

  return dedupeUrls(candidates)
}

function extractHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/**
 * Derive a fallback label (single uppercase character) from a feed title.
 */
export function fallbackLabel(title: string): string {
  const trimmed = (title || '').trim()
  return trimmed ? trimmed.substring(0, 1).toUpperCase() : '?'
}
