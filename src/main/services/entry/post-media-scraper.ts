import type { Entry } from '../../../shared/types/index'

type EntryLike = Pick<
  Entry,
  'url' | 'content' | 'summary' | 'imageUrl' | 'media'
>

function decodeHtmlEntities(value: string): string {
  return (value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

function isDecorativeInstagramAssetUrl(url: string): boolean {
  const raw = decodeHtmlEntities((url || '').trim())
  const lower = raw.toLowerCase()
  if (!lower) return false
  if (lower.includes('unavatar.io/instagram/')) return true
  // Instagram static resource assets (UI icons, sprites, fonts, etc.)
  if (lower.includes('static.cdninstagram.com')) return true
  if (
    /(?:^|[/?#&_.=-])(avatar|profile|icon|logo|favicon|apple-touch-icon|android-chrome|mstile|sprite|emoji|placeholder|glyph|badge|button|download|appstore|app-store|playstore|play-store|googleplay|google-play)(?:$|[/?#&_.=-])/i.test(
      lower,
    )
  ) {
    return true
  }
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isInstagramAssetHost =
      host.includes('instagram.com') &&
      !host.includes('cdninstagram') &&
      !host.includes('scontent') &&
      !host.includes('fbcdn.net')
    if (isInstagramAssetHost) {
      const isPostMedia = /\/(?:p|reel|tv)\/[a-z0-9_-]+\/media\/?/i.test(path)
      if (!isPostMedia) return true
    }
    if (/(?:picnob|pixnoy|piokok|pixwox)\./i.test(host)) {
      if (
        /\/(?:static|assets?|images?)\//i.test(path) &&
        !/\/(?:p|post|get)\//i.test(path)
      )
        return true
      if (
        /\/(?:logos?|icons?|favicons?|downloads?|apple-touch-icon|android-chrome|mstile|sprites?|emoji|buttons?|badges?)(?:$|[\/_\-.])/i.test(
          path,
        )
      )
        return true
    }
  } catch {
    // Ignore malformed URLs.
  }
  return false
}

function isLikelyPhotoUrl(url: string): boolean {
  const raw = decodeHtmlEntities((url || '').trim())
  if (!/^https?:\/\//i.test(raw)) return false
  const lower = raw.toLowerCase()

  // Check if it's an Instagram CDN URL first - these are typically valid photos
  const isInstagramCdn = /cdninstagram|scontent[^/]*\/|fbcdn\.net/i.test(lower)

  // Exclude decorative social media images (favicons, logos, avatars, etc.)
  if (isDecorativeInstagramAssetUrl(raw)) return false

  // Exclude Instagram static assets and icons
  if (lower.includes('static.cdninstagram.com')) return false
  if (lower.includes('instagram.com/static/')) return false
  if (lower.includes('instagram_static/')) return false

  // Exclude avatar/profile/placeholder images
  if (
    /\/avatar|\/profile|\/icon|\/logo|favicon|apple-touch-icon|sprite|emoji|placeholder/i.test(
      lower,
    )
  )
    return false

  // Exclude Instagram profile picture URLs.
  // Profile pictures use the `-19` format code (e.g. t51.2885-19),
  // while post/carousel photos use `-15` (e.g. t51.2885-15, t51.82787-15).
  if (/scontent[^/]*\/v\/.*t51\.\d+-19\//i.test(lower)) {
    return false
  }

  // Exclude Instagram avatar/query parameter patterns
  if (/ig_medium=|ig_cache_key=avatar/i.test(lower)) return false

  // For Instagram CDN URLs, be more permissive
  if (isInstagramCdn) {
    // Only exclude obvious non-photo URLs
    if (/\/avatar|\/profile|\/icon|\/logo/i.test(lower)) return false
    if (/ig_cache_key=avatar/i.test(lower)) return false
    return true
  }

  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(lower) ||
    /cdninstagram|scontent\.|fbcdn\.net|pbs\.twimg\.com\/media\/|twimg\.com\/media\/|pic\.twitter\.com|media\.(?:picnob|pixnoy|piokok|pixwox)\./i.test(
      lower,
    )
  )
}

function isLikelyDirectMediaUrl(url: string): boolean {
  const lower = (url || '').trim().toLowerCase()
  if (!lower) return false
  return (
    isLikelyPhotoUrl(lower) ||
    /\.(mp4|webm|mov|m3u8|mp3|m4a|aac|wav)(\?|$)/i.test(lower)
  )
}

function extractIgCacheKeyFromUrl(rawUrl: string): string {
  const raw = decodeHtmlEntities(String(rawUrl || '').trim())
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const direct = parsed.searchParams.get('ig_cache_key') || ''
    if (direct) return direct
    const nested = parsed.searchParams.get('url') || ''
    if (nested) {
      const nestedParsed = new URL(decodeHtmlEntities(nested))
      return nestedParsed.searchParams.get('ig_cache_key') || ''
    }
  } catch {
    // Ignore parse failures.
  }
  const match = raw.match(/[?&]ig_cache_key=([^&#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function instagramIdToShortcode(instagramId: string): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  if (!/^\d+$/.test(instagramId)) return ''
  let value = BigInt(instagramId)
  if (value === 0n) return alphabet[0]
  let shortcode = ''
  while (value > 0n) {
    const idx = Number(value % 64n)
    shortcode = alphabet[idx] + shortcode
    value /= 64n
  }
  return shortcode
}

function buildInstagramPostUrlFromEntry(entry: EntryLike): string {
  const contentText = `${entry.content || ''}\n${entry.summary || ''}`
  const urls = [
    entry.url || '',
    entry.imageUrl || '',
    ...(entry.media || []).flatMap((media) => [
      media.url || '',
      media.previewUrl || '',
    ]),
    ...(contentText.match(/https?:\/\/[^\s"'<>]+/g) || []),
  ]
  for (const candidate of urls) {
    const decoded = decodeHtmlEntities(candidate)
    const igCacheKeyRaw = extractIgCacheKeyFromUrl(decoded)
    const base64Part = decodeURIComponent(igCacheKeyRaw).split('.')[0] || ''
    if (!base64Part) continue
    try {
      const instagramId = atob(base64Part)
      const shortcode = instagramIdToShortcode(instagramId)
      if (shortcode) return `https://www.instagram.com/p/${shortcode}/`
    } catch {
      // Ignore invalid payload.
    }
  }
  return ''
}

function extractPostUrlsFromText(text: string): string[] {
  const urls = new Set<string>()
  const patterns = [
    /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|nitter\.[^/]+)\/[^/\s?#]+\/status\/\d+[^\s"'<>)]*/gi,
    /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+[^\s"'<>)]*/gi,
    /https?:\/\/(?:www\.)?(?:picnob(?:\.info)?|pixnoy|pixwox|piokok)\.com\/post\/[a-zA-Z0-9_-]+[^\s"'<>)]*/gi,
    /https?:\/\/(?:www\.)?threads\.net\/@[^/\s?#]+\/post\/[a-zA-Z0-9_-]+[^\s"'<>)]*/gi,
  ]
  for (const pattern of patterns) {
    for (const match of text.match(pattern) || []) {
      urls.add(decodeHtmlEntities(match))
    }
  }
  return [...urls]
}

function buildPostUrlCandidates(entry: EntryLike): string[] {
  const unique = new Set<string>()
  const push = (value: string) => {
    const url = canonicalizePostUrl(value)
    if (!/^https?:\/\//i.test(url)) return
    if (isLikelyDirectMediaUrl(url)) return
    unique.add(url)
  }

  push(entry.url || '')
  const text = `${entry.content || ''}\n${entry.summary || ''}`
  extractPostUrlsFromText(text).forEach(push)
  const igUrl = buildInstagramPostUrlFromEntry(entry)
  if (igUrl) push(igUrl)
  return [...unique]
}

function canonicalizePostUrl(url: string): string {
  const raw = decodeHtmlEntities((url || '').trim())
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.replace(/\/+$/, '')

    const instagramMatch = path.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
    if (
      /^(?:www\.)?instagram\.com$/i.test(host) &&
      instagramMatch?.[1] &&
      instagramMatch[2]
    ) {
      return `https://www.instagram.com/${instagramMatch[1].toLowerCase()}/${instagramMatch[2]}/`
    }

    const mirrorMatch = path.match(/^\/post\/([a-zA-Z0-9_-]+)/i)
    if (
      /picnob(?:\.info)?|pixnoy\.com|pixwox\.com|piokok\.com/i.test(host) &&
      mirrorMatch?.[1]
    ) {
      const postId = mirrorMatch[1]
      // Mirror sites use Instagram media IDs (numeric, 14+ digits) as post identifiers.
      // These must be converted to base64 shortcodes for valid Instagram URLs.
      if (/^\d{14,}$/.test(postId)) {
        const shortcode = instagramIdToShortcode(postId)
        if (shortcode) return `https://www.instagram.com/p/${shortcode}/`
      }
      return `https://www.instagram.com/p/${postId}/`
    }

    parsed.hash = ''
    return parsed.toString()
  } catch {
    return raw.split('#')[0] || raw
  }
}

export function resolveCanonicalPostUrlForEntry(
  entry: EntryLike,
): string | undefined {
  return buildPostUrlCandidates(entry)[0]
}
