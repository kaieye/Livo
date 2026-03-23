import { BrowserWindow, session } from "electron"
import type { Entry, FeedViewType, MediaItem } from "../../shared/types"
import { normalizeKnownMediaUrl } from "./feed-utils"

const SCRAPE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const FAILED_SCRAPE_CACHE_TTL_MS = 30 * 60 * 1000
const scrapeCache = new Map<string, { media: MediaItem[]; ts: number }>()
const failedScrapeCache = new Map<string, number>()
const photoReachabilityCache = new Map<string, { ok: boolean; ts: number }>()
const PHOTO_REACHABILITY_TTL_MS = 30 * 60 * 1000

export function clearPhotoScrapeCaches(): void {
  scrapeCache.clear()
  failedScrapeCache.clear()
  photoReachabilityCache.clear()
}

type EntryLike = Pick<Entry, "url" | "content" | "summary" | "imageUrl" | "media">

function isPictureLikeView(feedView: FeedViewType): boolean {
  // SocialMedia = 1, Pictures = 3
  return feedView === 1 || feedView === 3
}

function decodeHtmlEntities(value: string): string {
  return (value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

function isDecorativeInstagramAssetUrl(url: string): boolean {
  const raw = decodeHtmlEntities((url || "").trim())
  const lower = raw.toLowerCase()
  if (!lower) return false
  if (lower.includes("unavatar.io/instagram/")) return true
  // Instagram static resource assets (UI icons, sprites, fonts, etc.)
  if (lower.includes("static.cdninstagram.com")) return true
  if (/(?:^|[/?#&_.=-])(avatar|profile|icon|logo|favicon|apple-touch-icon|android-chrome|mstile|sprite|emoji|placeholder|glyph|badge|button|download|appstore|app-store|playstore|play-store|googleplay|google-play)(?:$|[/?#&_.=-])/i.test(lower)) {
    return true
  }
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isInstagramAssetHost = host.includes("instagram.com") && !host.includes("cdninstagram") && !host.includes("scontent") && !host.includes("fbcdn.net")
    if (isInstagramAssetHost) {
      const isPostMedia = /\/(?:p|reel|tv)\/[a-z0-9_-]+\/media\/?/i.test(path)
      if (!isPostMedia) return true
    }
    if (/(?:picnob|pixnoy|piokok|pixwox)\./i.test(host)) {
      if (/\/(?:static|assets?|images?)\//i.test(path) && !/\/(?:p|post|get)\//i.test(path)) return true
      if (/\/(?:logos?|icons?|favicons?|downloads?|apple-touch-icon|android-chrome|mstile|sprites?|emoji|buttons?|badges?)(?:$|[\/_\-.])/i.test(path)) return true
    }
  } catch {
    // Ignore malformed URLs.
  }
  return false
}

function hasTinyDecorativeDimensions(width?: number, height?: number): boolean {
  const safeWidth = width || 0
  const safeHeight = height || 0
  if (safeWidth <= 0 || safeHeight <= 0) return false
  const maxDimension = Math.max(safeWidth, safeHeight)
  const minDimension = Math.min(safeWidth, safeHeight)
  return maxDimension <= 180 || (maxDimension <= 240 && minDimension <= 180)
}

function isDecorativePhotoCandidate(url: string, width?: number, height?: number): boolean {
  return isDecorativeInstagramAssetUrl(url) || hasTinyDecorativeDimensions(width, height)
}

function isLikelyPhotoUrl(url: string): boolean {
  const raw = decodeHtmlEntities((url || "").trim())
  if (!/^https?:\/\//i.test(raw)) return false
  const lower = raw.toLowerCase()

  // Check if it's an Instagram CDN URL first - these are typically valid photos
  const isInstagramCdn = /cdninstagram|scontent[^/]*\/|fbcdn\.net/i.test(lower)

  // Exclude decorative social media images (favicons, logos, avatars, etc.)
  if (isDecorativeInstagramAssetUrl(raw)) return false

  // Exclude Instagram static assets and icons
  if (lower.includes("static.cdninstagram.com")) return false
  if (lower.includes("instagram.com/static/")) return false
  if (lower.includes("instagram_static/")) return false

  // Exclude avatar/profile/placeholder images
  if (/\/avatar|\/profile|\/icon|\/logo|favicon|apple-touch-icon|sprite|emoji|placeholder/i.test(lower)) return false

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
    /cdninstagram|scontent\.|fbcdn\.net|pbs\.twimg\.com\/media\/|twimg\.com\/media\/|pic\.twitter\.com|media\.(?:picnob|pixnoy|piokok|pixwox)\./i.test(lower)
  )
}

function isLikelyDirectMediaUrl(url: string): boolean {
  const lower = (url || "").trim().toLowerCase()
  if (!lower) return false
  return isLikelyPhotoUrl(lower) || /\.(mp4|webm|mov|m3u8|mp3|m4a|aac|wav)(\?|$)/i.test(lower)
}

function extractIgCacheKeyFromUrl(rawUrl: string): string {
  const raw = decodeHtmlEntities(String(rawUrl || "").trim())
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const direct = parsed.searchParams.get("ig_cache_key") || ""
    if (direct) return direct
    const nested = parsed.searchParams.get("url") || ""
    if (nested) {
      const nestedParsed = new URL(decodeHtmlEntities(nested))
      return nestedParsed.searchParams.get("ig_cache_key") || ""
    }
  } catch {
    // Ignore parse failures.
  }
  const match = raw.match(/[?&]ig_cache_key=([^&#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ""
}

function instagramIdToShortcode(instagramId: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  if (!/^\d+$/.test(instagramId)) return ""
  let value = BigInt(instagramId)
  if (value === 0n) return alphabet[0]
  let shortcode = ""
  while (value > 0n) {
    const idx = Number(value % 64n)
    shortcode = alphabet[idx] + shortcode
    value /= 64n
  }
  return shortcode
}

function buildInstagramPostUrlFromEntry(entry: EntryLike): string {
  const contentText = `${entry.content || ""}\n${entry.summary || ""}`
  const urls = [
    entry.url || "",
    entry.imageUrl || "",
    ...(entry.media || []).flatMap((media) => [media.url || "", media.previewUrl || ""]),
    ...(contentText.match(/https?:\/\/[^\s"'<>]+/g) || []),
  ]
  for (const candidate of urls) {
    const decoded = decodeHtmlEntities(candidate)
    const igCacheKeyRaw = extractIgCacheKeyFromUrl(decoded)
    const base64Part = decodeURIComponent(igCacheKeyRaw).split(".")[0] || ""
    if (!base64Part) continue
    try {
      const instagramId = atob(base64Part)
      const shortcode = instagramIdToShortcode(instagramId)
      if (shortcode) return `https://www.instagram.com/p/${shortcode}/`
    } catch {
      // Ignore invalid payload.
    }
  }
  return ""
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

  push(entry.url || "")
  const text = `${entry.content || ""}\n${entry.summary || ""}`
  extractPostUrlsFromText(text).forEach(push)
  const igUrl = buildInstagramPostUrlFromEntry(entry)
  if (igUrl) push(igUrl)
  return [...unique]
}

function normalizePhotoUrl(url: string): string {
  const raw = normalizeKnownMediaUrl(url)
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return raw.split("#")[0] || raw
  }
}

function decodeEscapedHtmlPayload(html: string): string {
  return (html || "")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u0025/gi, "%")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
}

function canonicalizePostUrl(url: string): string {
  const raw = decodeHtmlEntities((url || "").trim())
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.replace(/\/+$/, "")

    const instagramMatch = path.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
    if (/^(?:www\.)?instagram\.com$/i.test(host) && instagramMatch?.[1] && instagramMatch[2]) {
      return `https://www.instagram.com/${instagramMatch[1].toLowerCase()}/${instagramMatch[2]}/`
    }

    const mirrorMatch = path.match(/^\/post\/([a-zA-Z0-9_-]+)/i)
    if (/picnob(?:\.info)?|pixnoy\.com|pixwox\.com|piokok\.com/i.test(host) && mirrorMatch?.[1]) {
      const postId = mirrorMatch[1]
      // Mirror sites use Instagram media IDs (numeric, 14+ digits) as post identifiers.
      // These must be converted to base64 shortcodes for valid Instagram URLs.
      if (/^\d{14,}$/.test(postId)) {
        const shortcode = instagramIdToShortcode(postId)
        if (shortcode) return `https://www.instagram.com/p/${shortcode}/`
      }
      return `https://www.instagram.com/p/${postId}/`
    }

    parsed.hash = ""
    return parsed.toString()
  } catch {
    return raw.split("#")[0] || raw
  }
}

function shouldUseBrowserFallback(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return /^(?:www\.)?threads\.net$/i.test(host)
  } catch {
    return false
  }
}

function isInstagramPostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return /^(?:www\.)?instagram\.com$/i.test(parsed.hostname) && /^\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

function isTwitterPostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    return (
      (/^(?:www\.)?(?:x\.com|twitter\.com)$/i.test(host) &&
        /^\/[^/\s?#]+\/status\/\d+\/?$/i.test(parsed.pathname)) ||
      /^(?:www\.)?nitter\.[^/]+$/i.test(host)
    )
  } catch {
    return false
  }
}

function buildInstagramEmbedUrl(url: string): string {
  const normalized = canonicalizePostUrl(url)
  return normalized ? `${normalized}embed/captioned/` : ""
}

function scorePhotoCandidate(url: string, width?: number, height?: number): number {
  const normalized = normalizePhotoUrl(url).toLowerCase()
  if (isDecorativePhotoCandidate(normalized, width, height)) return -100
  let score = 0
  if (/cdninstagram|scontent\.|fbcdn\.net/.test(normalized)) score += 8
  if (/pbs\.twimg\.com\/media\/|twimg\.com\/media\//.test(normalized)) score += 8
  if (/media\.(?:picnob|pixnoy|piokok|pixwox)\./.test(normalized)) score += 4
  if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/.test(normalized)) score += 3
  if ((width || 0) > 0 && (height || 0) > 0) {
    const maxDimension = Math.max(width || 0, height || 0)
    const minDimension = Math.min(width || 0, height || 0)
    if (maxDimension <= 320 && Math.abs((width || 0) - (height || 0)) <= 24) score -= 2
    if (maxDimension <= 240 || minDimension <= 140) score -= 4
  }
  if ((width || 0) >= 320) score += 2
  if ((height || 0) >= 320) score += 2
  if ((width || 0) * (height || 0) >= 200000) score += 4
  return score
}

function extractPhotosFromHtml(html: string): MediaItem[] {
  const found = new Map<string, MediaItem & { score: number }>()
  const push = (url: string, width?: number, height?: number) => {
    const normalized = normalizePhotoUrl(url)
    if (!isLikelyPhotoUrl(normalized)) return
    const score = scorePhotoCandidate(normalized, width, height)
    if (score < 0) return
    const existing = found.get(normalized)
    if (!existing || score > existing.score) {
      found.set(normalized, { url: normalized, type: "photo", width, height, score })
    }
  }

  const htmlVariants = Array.from(new Set([html, decodeEscapedHtmlPayload(html)]))
  for (const variant of htmlVariants) {
    for (const match of variant.matchAll(/<(?:img|source)\b[^>]+(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)) {
      const tag = match[0] || ""
      const width = tag.match(/\b(?:data-)?width=["']?(\d+)/i)?.[1]
      const height = tag.match(/\b(?:data-)?height=["']?(\d+)/i)?.[1]
      push(
        match[1] || "",
        width ? Number.parseInt(width, 10) : undefined,
        height ? Number.parseInt(height, 10) : undefined,
      )
    }

    for (const match of variant.matchAll(/srcset=["']([^"']+)["']/gi)) {
      const srcset = match[1] || ""
      for (const part of srcset.split(",")) {
        const [url, descriptor] = part.trim().split(/\s+/)
        const width = descriptor?.endsWith("w") ? Number.parseInt(descriptor.slice(0, -1), 10) : undefined
        push(url || "", width)
      }
    }

    for (const match of variant.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)['"]/gi)) {
      push(match[1] || "")
    }

    for (const match of variant.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
      push(match[0] || "")
    }
  }

  return [...found.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...media }) => media)
}

export function resolveCanonicalPostUrlForEntry(entry: EntryLike): string | undefined {
  return buildPostUrlCandidates(entry)[0]
}

function hasMirrorWrappedPhotoUrl(url: string): boolean {
  const value = decodeHtmlEntities((url || "").trim()).toLowerCase()
  if (!value) return false
  return (
    value.includes("ig_cache_key=") ||
    value.includes("media.picnob") ||
    value.includes("media.pixnoy") ||
    value.includes("media.piokok") ||
    value.includes("media.pixwox") ||
    /https?:\/\/sp\d+\.pixnoy\./i.test(value)
  )
}

function isSuspiciousInstagramPhotoUrl(url: string): boolean {
  const normalized = decodeHtmlEntities((url || "").trim()).toLowerCase()
  if (!normalized) return false
  if (!/cdninstagram|scontent\.|fbcdn\.net/.test(normalized)) return false
  if (normalized.includes("ig_cache_key=")) return false
  if (normalized.includes("oh=") && normalized.includes("oe=")) return false
  if (normalized.includes("&_nc_") || normalized.includes("?_nc_")) return false
  return true
}

function mediaSignature(media: MediaItem[] | undefined): string {
  return JSON.stringify((media || []).map((item) => `${item.type}|${item.url}|${item.previewUrl || ""}`))
}

function extractInstagramAssetId(url: string): string {
  const normalized = normalizePhotoUrl(url)
  if (!normalized) return ""
  const direct = normalized.match(/_(\d{12,})_/)
  if (direct?.[1]) return direct[1]
  try {
    const decoded = decodeURIComponent(normalized)
    const decodedMatch = decoded.match(/_(\d{12,})_/)
    return decodedMatch?.[1] || ""
  } catch {
    return ""
  }
}

function photoQualityScore(media: MediaItem): number {
  const normalized = normalizePhotoUrl(media.url)
  let score = 0
  if (!normalized) return score
  const lower = normalized.toLowerCase()
  if (lower.includes("ig_cache_key=")) score += 12
  if (lower.includes("oh=") && lower.includes("oe=")) score += 8
  if (lower.includes("&_nc_") || lower.includes("?_nc_")) score += 5
  if (/cdninstagram|scontent\.|fbcdn\.net/.test(lower)) score += 4
  if (/(?:^|[?&])stp=/.test(lower)) score += 1
  return score
}

function dedupePhotoMedia(media: MediaItem[]): MediaItem[] {
  const picked = new Map<string, { item: MediaItem; score: number; order: number }>()
  const fallback = new Map<string, { item: MediaItem; score: number; order: number }>()

  const register = (
    map: Map<string, { item: MediaItem; score: number; order: number }>,
    key: string,
    payload: { item: MediaItem; score: number; order: number },
  ) => {
    const existing = map.get(key)
    if (!existing || payload.score > existing.score || (payload.score === existing.score && payload.order < existing.order)) {
      map.set(key, payload)
    }
  }

  for (let index = 0; index < media.length; index += 1) {
    const item = media[index]
    if (item.type !== "photo") {
      register(fallback, `non-photo:${index}:${item.url}`, { item, score: 0, order: index })
      continue
    }

    const score = photoQualityScore(item)
    const igCacheKey = extractIgCacheKeyFromUrl(item.url || "")
    const assetId = extractInstagramAssetId(item.url || "")
    const normalizedUrl = normalizePhotoUrl(item.url)
    const normalizedPreviewUrl = normalizePhotoUrl(item.previewUrl || "")
    const payload = { item, score, order: index }

    if (normalizedUrl) register(picked, `url:${normalizedUrl}`, payload)
    if (normalizedPreviewUrl) register(picked, `preview:${normalizedPreviewUrl}`, payload)
    if (!normalizedUrl && !normalizedPreviewUrl && igCacheKey) register(picked, `ig:${igCacheKey}`, payload)
    if (!normalizedUrl && !normalizedPreviewUrl && !igCacheKey && assetId) register(picked, `asset:${assetId}`, payload)
    if (!normalizedUrl && !normalizedPreviewUrl && !igCacheKey && !assetId) {
      register(fallback, `photo:${index}:${item.url}`, payload)
    }
  }

  const merged = [...picked.values(), ...fallback.values()]
    .sort((a, b) => a.order - b.order)

  const unique: MediaItem[] = []
  const seenOrders = new Set<number>()
  for (const entry of merged) {
    if (seenOrders.has(entry.order)) continue
    seenOrders.add(entry.order)
    unique.push(entry.item)
  }

  return unique
}

function isUsableRemoteMediaUrl(url: string): boolean {
  const normalized = normalizePhotoUrl(url)
  if (!normalized) return false
  try {
    const parsed = new URL(normalized)
    return /^https?:$/i.test(parsed.protocol) && parsed.hostname.includes(".")
  } catch {
    return false
  }
}

function hasMirrorDerivedPhotoContent(entry: EntryLike): boolean {
  return /media\.(?:picnob|pixnoy|piokok|pixwox)\.|sp\d+\.pixnoy\./i.test(`${entry.content || ""}\n${entry.summary || ""}`)
}

async function isReachablePhotoUrl(url: string): Promise<boolean> {
  const normalized = normalizePhotoUrl(url)
  if (!normalized) return false

  const cached = photoReachabilityCache.get(normalized)
  const now = Date.now()
  if (cached && now - cached.ts < PHOTO_REACHABILITY_TTL_MS) return cached.ok

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    Referer: "https://www.instagram.com/",
  }

  const remember = (ok: boolean) => {
    photoReachabilityCache.set(normalized, { ok, ts: now })
    return ok
  }

  try {
    const head = await fetch(normalized, {
      method: "HEAD",
      headers,
      signal: AbortSignal.timeout(8000),
    })
    const contentType = head.headers.get("content-type") || ""
    if (head.ok && /^image\//i.test(contentType)) return remember(true)
  } catch {
    // Fall through to GET validation.
  }

  try {
    const get = await fetch(normalized, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8000),
    })
    const contentType = get.headers.get("content-type") || ""
    return remember(get.ok && /^image\//i.test(contentType))
  } catch {
    return remember(false)
  }
}

async function pruneTrailingUnreachableMirrorPhotos(entry: EntryLike, media: MediaItem[]): Promise<MediaItem[]> {
  if (!hasMirrorDerivedPhotoContent(entry)) return media

  const photoIndexes = media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "photo")
    .map(({ index }) => index)

  if (photoIndexes.length < 2) return media

  const nextMedia = [...media]
  let changed = false
  for (let pointer = photoIndexes.length - 1; pointer >= 0; pointer -= 1) {
    const mediaIndex = photoIndexes[pointer]
    const candidate = nextMedia[mediaIndex]
    if (!candidate || candidate.type !== "photo") continue
    const ok = await isReachablePhotoUrl(candidate.url)
    if (ok) break
    nextMedia.splice(mediaIndex, 1)
    changed = true
  }

  return changed ? nextMedia : media
}

function extractPhotoMediaFromEntryHtml(entry: EntryLike): MediaItem[] {
  const html = `${entry.content || ""}\n${entry.summary || ""}`
  if (!html.trim()) return []
  return extractPhotosFromHtml(html)
    .filter((item) => item.type === "photo" && isUsableRemoteMediaUrl(item.url))
    .filter((item) => !isDecorativePhotoCandidate(item.url, item.width, item.height))
}

function countPhotoMedia(media: MediaItem[] | undefined): number {
  return (media || []).filter((item) => item.type === "photo").length
}

function buildEntryFallbackPhotoMedia(entry: EntryLike): MediaItem[] {
  const normalizedMedia = normalizeEntryPhotoMedia(entry)
  const contentDerivedMedia = extractPhotoMediaFromEntryHtml(entry)
  const baseMedia = countPhotoMedia(contentDerivedMedia) >= countPhotoMedia(normalizedMedia)
    ? [...contentDerivedMedia, ...normalizedMedia.filter((item) => item.type !== "photo")]
    : normalizedMedia
  const deduped = dedupePhotoMedia(baseMedia)
  if (countPhotoMedia(deduped) > 0) return deduped

  const normalizedImageUrl = normalizePhotoUrl(entry.imageUrl || "")
  if (
    normalizedImageUrl
    && isUsableRemoteMediaUrl(normalizedImageUrl)
    && isLikelyPhotoUrl(normalizedImageUrl)
    && !isDecorativeInstagramAssetUrl(normalizedImageUrl)
  ) {
    return [{ url: normalizedImageUrl, type: "photo" }]
  }

  return deduped
}

function mergePreferredAndFallbackPhotoMedia(preferred: MediaItem[], fallback: MediaItem[]): MediaItem[] {
  const preferredPhotos = preferred.filter((item) => item.type === "photo")
  const fallbackPhotos = fallback.filter((item) => item.type === "photo")
  const fallbackNonPhotos = fallback.filter((item) => item.type !== "photo")
  return dedupePhotoMedia([...preferredPhotos, ...fallbackPhotos, ...fallbackNonPhotos])
}

function normalizeEntryPhotoMedia(entry: EntryLike): MediaItem[] {
  const normalized = (entry.media || [])
    .filter((item) => {
      if (item.type === "photo") {
        return isUsableRemoteMediaUrl(item.url) && !isDecorativePhotoCandidate(item.url, item.width, item.height)
      }
      if (item.type === "video" || item.type === "audio") {
        const candidate = decodeHtmlEntities(item.url || "")
        if (!candidate) return false
        try {
          const parsed = new URL(candidate)
          return parsed.hostname.includes(".")
        } catch {
          return false
        }
      }
      return true
    })
    .map((item) => {
    if (item.type !== "photo") return item
    const nextUrl = normalizePhotoUrl(item.url)
    const nextPreviewUrl = item.previewUrl ? normalizePhotoUrl(item.previewUrl) : item.previewUrl
    if (nextUrl === item.url && nextPreviewUrl === item.previewUrl) return item
    return {
      ...item,
      url: nextUrl || item.url,
      previewUrl: nextPreviewUrl || item.previewUrl,
    }
  })

  return dedupePhotoMedia(normalized)
}

function firstPhotoUrl(entry: Pick<EntryLike, "media" | "imageUrl">): string {
  const photo = (entry.media || []).find((item) => item.type === "photo" && item.url)
  return photo?.url || normalizePhotoUrl(entry.imageUrl || "") || entry.imageUrl || ""
}

export function entryNeedsStoredPhotoRepair(entry: EntryLike, feedView: FeedViewType): boolean {
  if (!isPictureLikeView(feedView)) return false
  const canonicalPostUrl = resolveCanonicalPostUrlForEntry(entry)
  if (countPhotoMedia(entry.media) === 0 && canonicalPostUrl) return true
  if ((entry.media || []).some((item) => item.type === "photo" && isDecorativePhotoCandidate(item.url, item.width, item.height))) return true
  if (isDecorativeInstagramAssetUrl(entry.imageUrl || "")) return true
  const urls = [
    entry.url || "",
    entry.imageUrl || "",
    ...(entry.media || []).flatMap((media) => [media.url || "", media.previewUrl || ""]),
  ]
  if (urls.some(hasMirrorWrappedPhotoUrl)) return true
  if (urls.some(isSuspiciousInstagramPhotoUrl)) return true
  const html = `${entry.content || ""}\n${entry.summary || ""}`.toLowerCase()
  if (/media\.(?:picnob|pixnoy|piokok|pixwox)\.|sp\d+\.pixnoy\./i.test(html)) return true
  if (!entry.url && !!canonicalPostUrl) return true

  // Instagram posts with only 1 photo likely missed carousel images
  if (canonicalPostUrl && /instagram\.com/i.test(canonicalPostUrl)) {
    const photoCount = countPhotoMedia(entry.media)
    if (photoCount === 1) return true
  }

  return false
}

export async function repairStoredEntryPhotos(
  entry: EntryLike,
  feedView: FeedViewType,
): Promise<Pick<Entry, "url" | "imageUrl" | "media"> | undefined> {
  if (!isPictureLikeView(feedView)) return undefined

  const dedupedBaseMedia = buildEntryFallbackPhotoMedia(entry)
  const normalizedImageUrl = normalizePhotoUrl(entry.imageUrl || "") || entry.imageUrl || ""
  const canonicalPostUrl = resolveCanonicalPostUrlForEntry({
    ...entry,
    media: dedupedBaseMedia,
    imageUrl: normalizedImageUrl,
  })

  let nextMedia = dedupedBaseMedia
  let nextImageUrl = firstPhotoUrl({ media: dedupedBaseMedia, imageUrl: normalizedImageUrl })
  let nextUrl = canonicalPostUrl || entry.url || ""

  if (entryNeedsStoredPhotoRepair(entry, feedView) && canonicalPostUrl) {
    const scrapedMedia = await scrapePhotosForEntry(
      {
        ...entry,
        url: nextUrl,
        media: dedupedBaseMedia,
        imageUrl: nextImageUrl,
      },
      feedView,
    )
    if (scrapedMedia && scrapedMedia.length > 0) {
      nextMedia = dedupePhotoMedia(scrapedMedia)
      nextImageUrl = firstPhotoUrl({ media: scrapedMedia, imageUrl: nextImageUrl })
      nextUrl = canonicalPostUrl
    }
  }

  nextMedia = await pruneTrailingUnreachableMirrorPhotos(entry, nextMedia)
  nextImageUrl = firstPhotoUrl({ media: nextMedia, imageUrl: nextImageUrl })

  const mediaChanged = mediaSignature(nextMedia) !== mediaSignature(entry.media)
  const imageChanged = nextImageUrl !== (entry.imageUrl || "")
  const urlChanged = nextUrl !== (entry.url || "")
  if (!mediaChanged && !imageChanged && !urlChanged) return undefined

  return {
    url: nextUrl,
    imageUrl: nextImageUrl,
    media: nextMedia,
  }
}

async function fetchHtml(url: string): Promise<string> {
  const isInstagramRelated = /instagram|cdninstagram|fbcdn|picnob|pixnoy|piokok/i.test(url)

  // For Instagram-related URLs, use session.fetch to include cookies
  if (isInstagramRelated) {
    const response = await session.defaultSession.fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  }

  // For non-Instagram URLs, use standard fetch
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Referer: "https://www.google.com/",
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function extractPhotosFromBrowserPage(url: string): Promise<MediaItem[]> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
    },
  })

  try {
    win.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
    await win.loadURL(url, {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      httpReferrer: "https://www.google.com/",
    })

    const isInstagram = /instagram\.com/i.test(url)

    // For Instagram, wait longer and click through carousel
    if (isInstagram) {
      await new Promise((resolve) => setTimeout(resolve, 4000))

      // Click through carousel navigation to load all images
      await win.webContents.executeJavaScript(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const results = []
        const seenUrls = new Set()

        const collectImages = () => {
          const imgs = Array.from(document.querySelectorAll('article img, main img, [role="main"] img, .x1lliihq img'))
          for (const img of imgs) {
            const src = img.currentSrc || img.src || ''
            if (src && !seenUrls.has(src)) {
              seenUrls.add(src)
              results.push({
                url: src,
                width: img.naturalWidth || img.width || undefined,
                height: img.naturalHeight || img.height || undefined,
              })
            }
          }
        }

        collectImages()

        // Click through carousel dots/buttons
        for (let step = 0; step < 20; step += 1) {
          // Try to find next button - Instagram uses various selectors
          const nextButton = Array.from(document.querySelectorAll('button')).find((btn) => {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase()
            const btnClass = btn.className || ''
            return ariaLabel.includes('next') ||
                   ariaLabel.includes('下一') ||
                   ariaLabel.includes('Next') ||
                   btnClass.includes('x1lliihq') // Instagram carousel dot container
          })

          if (!nextButton) break

          nextButton.click()
          await wait(1500)
          collectImages()
        }

        return results
      })()`, true)

      // carouselResults used silently
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }

    const raw = await win.webContents.executeJavaScript(`(() => {
      const items = [];
      const push = (url, width, height, score = 0) => {
        const value = String(url || '').trim();
        if (!value) return;
        if (value.includes('static.cdninstagram.com')) return;
        items.push({ url: value, width: Number(width) || undefined, height: Number(height) || undefined, score });
      };
      for (const img of Array.from(document.images || [])) {
        const inMain = !!img.closest('article, main, [role="main"], .main, .content');
        const score = (inMain ? 10 : 0) + ((img.naturalWidth || 0) * (img.naturalHeight || 0) >= 120000 ? 10 : 0);
        push(img.currentSrc || img.src, img.naturalWidth, img.naturalHeight, score);
        const srcset = img.getAttribute('srcset') || '';
        for (const part of srcset.split(',')) {
          const [candidate] = part.trim().split(/\s+/);
          push(candidate || '', img.naturalWidth, img.naturalHeight, score - 1);
        }
      }
      for (const meta of Array.from(document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[name="twitter:image:src"]'))) {
        push(meta.getAttribute('content'), undefined, undefined, 4);
      }
      return items;
    })()`, true)

    const found = new Map<string, MediaItem & { score: number }>()
    for (const item of Array.isArray(raw) ? raw : []) {
      if (!item || typeof item !== "object") continue
      const urlValue = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url : ""
      const widthValue = typeof (item as { width?: unknown }).width === "number" ? (item as { width: number }).width : undefined
      const heightValue = typeof (item as { height?: unknown }).height === "number" ? (item as { height: number }).height : undefined
      const scoreValue = typeof (item as { score?: unknown }).score === "number" ? (item as { score: number }).score : 0
      const normalized = normalizePhotoUrl(urlValue)
      if (!isLikelyPhotoUrl(normalized)) continue
      const score = scorePhotoCandidate(normalized, widthValue, heightValue) + scoreValue
      if (score < 0) continue
      const existing = found.get(normalized)
      if (!existing || score > existing.score) {
        found.set(normalized, { url: normalized, type: "photo", width: widthValue, height: heightValue, score })
      }
    }
    return [...found.values()].sort((a, b) => b.score - a.score).map(({ score: _score, ...media }) => media)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

async function extractPhotosFromInstagramEmbed(postUrl: string): Promise<MediaItem[]> {
  const embedUrl = buildInstagramEmbedUrl(postUrl)
  if (!embedUrl) return []

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      // Use default session to inherit cookies from logged-in Instagram account
      partition: undefined,
    },
  })

  try {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    win.webContents.setUserAgent(userAgent)
    await win.loadURL(embedUrl, {
      userAgent,
      httpReferrer: "https://www.instagram.com/",
    })
    // Wait longer for embed to load all carousel images
    await new Promise((resolve) => setTimeout(resolve, 8000))

    // Get page HTML and any embedded data
    const scrapeResults = await win.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const results = []
      const seen = new Set()
      const push = (url, width, height, score = 0) => {
        const value = String(url || '').trim()
        if (!value || seen.has(value)) return
        // Skip Instagram static resource assets (UI icons, sprites, fonts)
        if (value.includes('static.cdninstagram.com')) return
        seen.add(value)
        results.push({
          url: value,
          width: Number(width) || undefined,
          height: Number(height) || undefined,
          score,
        })
      }

      // Strategy 1: Look for Instagram's internal JSON data in scripts
      try {
        const scripts = Array.from(document.querySelectorAll('script'))
        for (const script of scripts) {
          try {
            const content = script.textContent || ''

            // Look for Instagram's internal data structure with carousel edges
            if (content.includes('"edge_sidecar_to_children"') || content.includes('"__additionalData"')) {
              // Extract all display_url values (carousel item images)
              const displayUrlRegex = /"display_url"\s*:\s*"([^"]+)"/gi
              let match
              while ((match = displayUrlRegex.exec(content)) !== null) {
                if (match[1]) {
                  const decoded = match[1].replace(/\\u0026/g, '&').replace(/\\u003A/g, ':').replace(/\\u002F/g, '/').replace(/\\u003D/g, '=')
                  push(decoded, undefined, undefined, 50)
                }
              }

              // Also extract thumbnail_src
              const thumbRegex = /"thumbnail_src"\s*:\s*"([^"]+)"/gi
              while ((match = thumbRegex.exec(content)) !== null) {
                if (match[1]) {
                  const decoded = match[1].replace(/\\u0026/g, '&').replace(/\\u003A/g, ':').replace(/\\u002F/g, '/').replace(/\\u003D/g, '=')
                  push(decoded, undefined, undefined, 40)
                }
              }

              // Extract any Instagram CDN URLs from the JSON
              const cdnInJson = content.match(/https:\\/\\/[^\s"'<>\\]*cdninstagram[^\s"'<>\\]*\.jpg[^\s"'<>\\]*/gi) || []
              for (const url of cdnInJson) {
                const clean = url.replace(/\\/g, '').replace(/&amp;/g, '&')
                push(clean, undefined, undefined, 45)
              }
            }

            // Look for any Instagram CDN URLs in script content
            const cdnMatches = content.match(/https?:\/\/[^\s"'<>\\]*cdninstagram[^\s"'<>\\]*[^\s"'<>\\]/gi) || []
            for (const url of cdnMatches) {
              const clean = url.replace(/\\&quot;/g, '').replace(/\\\\"/g, '').replace(/\\\\/g, '').replace(/&amp;/g, '&')
              push(clean, undefined, undefined, 25)
            }
          } catch (e) {
            // Ignore script parse errors
          }
        }
      } catch (e) {
        // Ignore strategy 1 errors
      }

      // Strategy 2: Extract from all images in the DOM
      const allImages = Array.from(document.querySelectorAll('img'))
      for (const img of allImages) {
        const src = img.currentSrc || img.src || ''
        const width = img.naturalWidth || img.width || 0
        const height = img.naturalHeight || img.height || 0

        // Skip tiny decorative images
        if (width <= 100 && height <= 100) continue

        const score = ((width * height) >= 120000 ? 20 : 10)
        push(src, width, height, score)

        const srcset = img.getAttribute('srcset') || ''
        for (const part of srcset.split(',')) {
          const [candidate] = part.trim().split(/\s+/)
          push(candidate || '', width, height, score - 1)
        }
      }

      // Strategy 3: Look for carousel navigation buttons
      const carouselButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase()
        return label.includes('next') || label.includes('previous') || label.includes('下一') || label.includes('上一')
      })

      // Click through carousel to load more images
      for (let step = 0; step < 15; step += 1) {
        const button = carouselButtons[step % Math.max(1, carouselButtons.length)]
        if (button && step < carouselButtons.length) {
          button.click()
          await wait(1500)
          // Collect newly loaded images
          for (const img of Array.from(document.querySelectorAll('img'))) {
            const src = img.currentSrc || img.src || ''
            const width = img.naturalWidth || img.width || 0
            const height = img.naturalHeight || img.height || 0
            if (width > 100 || height > 100) {
              push(src, width, height, 15)
            }
          }
        }
      }

      // Strategy 4: Extract all Instagram CDN URLs from page HTML
      const html = document.documentElement.outerHTML
      const allCdnUrls = html.match(/https?:\/\/[^\s"'<>]*cdninstagram[^\s"'<>]*\.jpg[^\s"'<>]*/gi) || []
      for (const url of allCdnUrls) {
        const clean = url.replace(/\\&quot;/g, '').replace(/\\\\"/g, '').replace(/\\\\/g, '\\').replace(/&amp;/g, '&')
        push(clean, undefined, undefined, 15)
      }

      // Strategy 5: Look for image URLs in any data attributes
      const elementsWithData = Array.from(document.querySelectorAll('[data-visualcompletion], [style]'))
      for (const el of elementsWithData) {
        for (const attr of Array.from(el.attributes)) {
          const value = attr.value || ''
          const cdnInAttr = value.match(/https?:\/\/[^\s"'<>]*cdninstagram[^\s"'<>]*\.jpg[^\s"'<>]*/gi) || []
          for (const url of cdnInAttr) {
            push(url, undefined, undefined, 10)
          }
        }
      }

      return results
    })()`, true)

    const found = new Map<string, MediaItem & { score: number }>()
    for (const item of Array.isArray(scrapeResults) ? scrapeResults : []) {
      if (!item || typeof item !== "object") continue
      const urlValue = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url : ""
      const widthValue = typeof (item as { width?: unknown }).width === "number" ? (item as { width: number }).width : undefined
      const heightValue = typeof (item as { height?: unknown }).height === "number" ? (item as { height: number }).height : undefined
      const scoreValue = typeof (item as { score?: unknown }).score === "number" ? (item as { score: number }).score : 0
      const normalized = normalizePhotoUrl(urlValue)
      if (!isLikelyPhotoUrl(normalized)) continue
      const score = scorePhotoCandidate(normalized, widthValue, heightValue) + scoreValue
      if (score < 0) continue
      const existing = found.get(normalized)
      if (!existing || score > existing.score) {
        found.set(normalized, { url: normalized, type: "photo", width: widthValue, height: heightValue, score })
      }
    }

    return [...found.values()].sort((a, b) => b.score - a.score).map(({ score: _score, ...media }) => media)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/**
 * Extract photos from Instagram post page using BrowserWindow.
 * This is more reliable than embed for carousel posts.
 */
async function extractPhotosFromInstagramBrowser(postUrl: string): Promise<MediaItem[]> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1000,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      // Use default session to inherit cookies from logged-in Instagram account
      partition: undefined,
    },
  })

  // Listen to console messages from the BrowserWindow
  win.webContents.on('console-message', (_event, _level, message, _line, _sourceId) => {
    if (message.includes('[IG Browser]') || message.includes('[Instagram]')) {
      console.log(message)
    }
  })

  try {
    // Use mobile user agent to get simpler page layout and better carousel support
    const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    win.webContents.setUserAgent(userAgent)

    // Set referer to Instagram itself to avoid triggering login redirects
    await win.loadURL(postUrl, {
      userAgent,
      httpReferrer: "https://www.instagram.com/",
      extraHeaders: "Sec-Fetch-Dest: document\nSec-Fetch-Mode: navigate\nSec-Fetch-Site: same-site\n",
    })

    // Wait for page to load and JavaScript to execute
    // Instagram carousel posts need extra time to load all images
    await new Promise((resolve) => setTimeout(resolve, 8000))

    // Try to click through carousel to load all images, then extract
    const scrapeResults = await win.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const results = []
      const seen = new Set()
      const push = (url, width, height, score = 0) => {
        const value = String(url || '').trim()
        if (!value || seen.has(value)) return
        // Skip Instagram static resource assets (UI icons, sprites, fonts)
        if (value.includes('static.cdninstagram.com')) return
        seen.add(value)
        results.push({ url: value, width: Number(width) || undefined, height: Number(height) || undefined, score })
      }

      console.log('[IG Browser] Starting carousel navigation...')

      // Try to navigate through carousel to load all images
      // Instagram loads carousel images lazily as you navigate
      const tryNavigateCarousel = async () => {
        const maxAttempts = 12
        let attempts = 0
        let consecutiveNoChange = 0

        while (attempts < maxAttempts && consecutiveNoChange < 2) {
          // Look for next button in carousel - Instagram uses various class names
          const nextButton =
            document.querySelector('button[aria-label="Next"]') ||
            document.querySelector('button[aria-label="下一张"]') ||
            document.querySelector('button._acan') ||
            document.querySelector('div[role="button"][aria-label="Next"]') ||
            document.querySelector('svg[aria-label="Next"]').closest('button') ||
            document.querySelector('button.x1n2onr6.xzka7k3')

          console.log('[IG Browser] Next button found:', !!nextButton, 'attempt:', attempts + 1)

          if (!nextButton) break

          // Count CDN images before click
          const imagesBefore = document.querySelectorAll('article img[src*="cdninstagram.com"], article img[src*="instagram.com"]').length
          console.log('[IG Browser] Images before click:', imagesBefore)

          // Click next button
          nextButton.click()
          await wait(700)
          attempts++

          // Count CDN images after click
          const imagesAfter = document.querySelectorAll('article img[src*="cdninstagram.com"], article img[src*="instagram.com"]').length
          console.log('[IG Browser] Images after click:', imagesAfter, 'consecutiveNoChange:', consecutiveNoChange)

          if (imagesAfter <= imagesBefore) {
            consecutiveNoChange++
          } else {
            consecutiveNoChange = 0
          }
        }

        console.log('[IG Browser] Carousel navigation completed, total attempts:', attempts)

        // Navigate back to first slide
        for (let i = 0; i < attempts - 1; i++) {
          const prevButton =
            document.querySelector('button[aria-label="Previous"]') ||
            document.querySelector('button[aria-label="上一张"]') ||
            document.querySelector('button._acam') ||
            document.querySelector('svg[aria-label="Previous"]').closest('button')

          if (!prevButton) break
          prevButton.click()
          await wait(250)
        }
      }

      // Navigate carousel to load all images
      await tryNavigateCarousel()
      await wait(1500)

      console.log('[IG Browser] Starting image extraction...')

      // Extract from all images in the article
      const article = document.querySelector('article')
      const allImages = article ? Array.from(article.querySelectorAll('img')) : Array.from(document.querySelectorAll('img'))
      console.log('[IG Browser] Total images in DOM:', allImages.length)

      // Debug: Log all image sources
      for (const img of allImages) {
        const src = img.currentSrc || img.src || ''
        if (src.includes('cdninstagram.com')) {
          console.log('[IG Browser] CDN image found:', src.substring(0, 80))
        }
      }

      for (const img of allImages) {
        const src = img.currentSrc || img.src || ''
        const width = img.naturalWidth || img.width || 0
        const height = img.naturalHeight || img.height || 0

        // Skip tiny images (icons, avatars, etc.)
        if (width <= 150 && height <= 150) continue

        // Skip data URLs
        if (src.startsWith('data:')) continue

        // Skip profile/avatar images - Instagram uses specific class patterns
        const parent = img.closest('[role="button"]') || img.closest('a[href*="instagram.com"]')
        if (parent && width < 300) continue

        push(src, width, height, ((width * height) >= 100000 ? 20 : 10))
      }

      // Extract from scripts containing Instagram's internal JSON data
      // This is the most reliable source for carousel images
      const scripts = Array.from(document.querySelectorAll('script'))
      console.log('[IG Browser] Total scripts to parse:', scripts.length)
      for (const script of scripts) {
        const content = script.textContent || ''

        // Strategy 1: Look for display_url in JSON data (main image URLs)
        // Instagram stores images as: "display_url":"https://..."
        const displayRegex = /"display_url"\s*:\s*"([^"]+)"/gi
        let match
        while ((match = displayRegex.exec(content)) !== null) {
          if (match[1]) {
            // Decode unicode escapes: \\u0026 -> &, etc.
            const decoded = match[1]
              .replace(/\\\\u0026/g, '&')
              .replace(/\\\\u003A/g, ':')
              .replace(/\\\\u002F/g, '/')
              .replace(/\\\\u003D/g, '=')
              .replace(/\\u0026/g, '&')
              .replace(/\\u003A/g, ':')
              .replace(/\\u002F/g, '/')
              .replace(/\\u003D/g, '=')
            push(decoded, undefined, undefined, 50)
          }
        }

        // Strategy 2: Look for thumbnail_src (carousel thumbnail URLs)
        const thumbRegex = /"thumbnail_src"\s*:\s*"([^"]+)"/gi
        while ((match = thumbRegex.exec(content)) !== null) {
          if (match[1]) {
            const decoded = match[1]
              .replace(/\\\\u0026/g, '&')
              .replace(/\\\\u003A/g, ':')
              .replace(/\\\\u002F/g, '/')
              .replace(/\\\\u003D/g, '=')
              .replace(/\\u0026/g, '&')
              .replace(/\\u003A/g, ':')
              .replace(/\\u002F/g, '/')
              .replace(/\\u003D/g, '=')
            push(decoded, undefined, undefined, 40)
          }
        }

        // Strategy 3: Look for carousel_media structure with balanced bracket matching
        // Instagram stores carousel as: "carousel_media":[{"id":"...","media_type":1,"image_versions2":{"candidates":[...]}}]
        const findCarouselMedia = function(text) {
          const startMarker = '"carousel_media":['
          const startIndex = text.indexOf(startMarker)
          if (startIndex === -1) return null

          let bracketCount = 0
          let inString = false
          let escapeNext = false
          let startIndexActual = startIndex + startMarker.length

          for (let i = startIndexActual; i < text.length; i++) {
            const char = text[i]

            if (escapeNext) {
              escapeNext = false
              continue
            }

            if (char === '\\\\') {
              escapeNext = true
              continue
            }

            if (char === '"' && !escapeNext) {
              inString = !inString
              continue
            }

            if (!inString) {
              if (char === '[') bracketCount++
              if (char === ']') {
                if (bracketCount === 0) {
                  return text.substring(startIndexActual, i)
                }
                bracketCount--
              }
            }
          }
          return null
        }

        const carouselContent = findCarouselMedia(content)
        console.log('[IG Browser] Strategy 3 - carousel_media found:', !!carouselContent)
        if (carouselContent) {
          // Extract all image URLs from carousel_media items
          // Each item has: "image_versions2":{"candidates":[{"url":"...", ...}, ...]}
          const findImageVersions = function(text) {
            const results = []
            const marker = '"image_versions2"'
            let idx = 0

            while ((idx = text.indexOf(marker, idx)) !== -1) {
              // Find the candidates array
              const objStart = text.indexOf('{', idx)
              if (objStart === -1) {
                idx++
                continue
              }

              // Find candidates array within this object
              let bracketCount = 0
              let inString = false
              let escapeNext = false
              let candidatesStart = -1
              let candidatesEnd = -1

              for (let i = objStart; i < Math.min(objStart + 2000, text.length); i++) {
                const char = text[i]

                if (escapeNext) {
                  escapeNext = false
                  continue
                }

                if (char === '\\\\') {
                  escapeNext = true
                  continue
                }

                if (char === '"' && !escapeNext) {
                  inString = !inString
                  continue
                }

                if (!inString) {
                  if (text.substring(i, i + 12) === '"candidates"') {
                    const arrStart = text.indexOf('[', i)
                    if (arrStart !== -1) {
                      let arrBracketCount = 0
                      for (let j = arrStart; j < text.length; j++) {
                        const c = text[j]
                        if (c === '"' && !escapeNext) {
                          inString = !inString
                        } else if (!inString) {
                          if (c === '[') arrBracketCount++
                          if (c === ']') {
                            arrBracketCount--
                            if (arrBracketCount === 0) {
                              candidatesStart = arrStart + 1
                              candidatesEnd = j
                              break
                            }
                          }
                        }
                      }
                    }
                    break
                  }
                }
              }

              if (candidatesStart !== -1 && candidatesEnd !== -1) {
                const candidatesStr = text.substring(candidatesStart, candidatesEnd)
                // Extract all "url":"..." patterns from candidates
                const urlRegex = /"url"\s*:\s*"([^"]+)"/gi
                let urlMatch
                while ((urlMatch = urlRegex.exec(candidatesStr)) !== null) {
                  if (urlMatch[1]) {
                    const decoded = urlMatch[1]
                      .replace(/\\\\u0026/g, '&')
                      .replace(/\\\\u003A/g, ':')
                      .replace(/\\\\u002F/g, '/')
                      .replace(/\\\\u003D/g, '=')
                      .replace(/\\u0026/g, '&')
                      .replace(/\\u003A/g, ':')
                      .replace(/\\u002F/g, '/')
                      .replace(/\\u003D/g, '=')
                    results.push(decoded)
                  }
                }
              }
              idx++
            }
            return results
          }

          const imageUrls = findImageVersions(carouselContent)
          console.log('[IG Browser] Strategy 3 - extracted', imageUrls.length, 'URLs from carousel_media')
          for (const url of imageUrls) {
            push(url, undefined, undefined, 60)
          }
        }

        // Strategy 4: Look for edge_sidecar_to_children (older Instagram API format)
        if (content.includes('"edge_sidecar_to_children"')) {
          console.log('[IG Browser] Strategy 4 - edge_sidecar_to_children found')
          // Use balanced bracket matching for edge_sidecar_to_children
          const findSidecarEdges = function(text) {
            const startMarker = '"edge_sidecar_to_children":{'
            const startIndex = text.indexOf(startMarker)
            if (startIndex === -1) return null

            // Find "edges":[ array
            const edgesStart = text.indexOf('"edges":[', startIndex)
            if (edgesStart === -1) return null

            const arrayStart = edgesStart + '"edges":['.length
            let bracketCount = 0
            let inString = false
            let escapeNext = false

            for (let i = arrayStart; i < text.length; i++) {
              const char = text[i]

              if (escapeNext) {
                escapeNext = false
                continue
              }

              if (char === '\\\\') {
                escapeNext = true
                continue
              }

              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }

              if (!inString) {
                if (char === '[') bracketCount++
                if (char === ']') {
                  if (bracketCount === 0) {
                    return text.substring(arrayStart, i)
                  }
                  bracketCount--
                }
              }
            }
            return null
          }

          const sidecarContent = findSidecarEdges(content)
          if (sidecarContent) {
            console.log('[IG Browser] Strategy 4 - extracted sidecar content, length:', sidecarContent.length)
            // Extract display_url from each edge.node
            const nodeRegex = /"node"\s*:\s*\{[^}]*"display_url"\s*:\s*"([^"]+)"/gi
            let nodeMatch
            while ((nodeMatch = nodeRegex.exec(sidecarContent)) !== null) {
              if (nodeMatch[1]) {
                const decoded = nodeMatch[1]
                  .replace(/\\\\u0026/g, '&')
                  .replace(/\\\\u003A/g, ':')
                  .replace(/\\\\u002F/g, '/')
                  .replace(/\\\\u003D/g, '=')
                  .replace(/\\u0026/g, '&')
                  .replace(/\\u003A/g, ':')
                  .replace(/\\u002F/g, '/')
                  .replace(/\\u003D/g, '=')
                push(decoded, undefined, undefined, 55)
              }
            }
          }
        }

        // Strategy 5: Look for any CDN URLs in scripts
        const cdnRegex = /https:\\/\\/[^\s"'<>\\]*cdninstagram[^\s"'<>\\]*\.jpg[^\s"'<>\\]*/gi
        const cdnMatches = content.match(cdnRegex) || []
        console.log('[IG Browser] Strategy 5 - CDN URLs in scripts:', cdnMatches.length)
        for (const url of cdnMatches) {
          const clean = url.replace(/\\\\/g, '').replace(/\\/g, '').replace(/&amp;/g, '&')
          push(clean, undefined, undefined, 35)
        }
      }

      // Extract from meta tags (Open Graph)
      const ogImages = document.querySelectorAll('meta[property="og:image"]')
      ogImages.forEach((meta) => {
        const content = meta.getAttribute('content')
        if (content) push(content, undefined, undefined, 30)
      })

      // Extract from outerHTML
      const html = document.documentElement.outerHTML
      const htmlCdnRegex = /https?:\/\/[^\s"'<>]*cdninstagram[^\s"'<>]*\.jpg[^\s"'<>]*/gi
      const htmlCdnUrls = html.match(htmlCdnRegex) || []
      console.log('[IG Browser] Strategy 6 - CDN URLs in HTML:', htmlCdnUrls.length)
      for (const url of htmlCdnUrls) {
        const clean = url.replace(/&amp;/g, '&').replace(/\\&quot;/g, '').replace(/\\"/g, '')
        push(clean, undefined, undefined, 15)
      }

      console.log('[Instagram scrape debug] Final results:', results.length, 'photos', results.map(r => r.url.substring(0, 60)))
      return results
    })()`, true)

    const found = new Map<string, MediaItem & { score: number }>()
    for (const item of Array.isArray(scrapeResults) ? scrapeResults : []) {
      if (!item || typeof item !== "object") continue
      const urlValue = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url : ""
      const widthValue = typeof (item as { width?: unknown }).width === "number" ? (item as { width: number }).width : undefined
      const heightValue = typeof (item as { height?: unknown }).height === "number" ? (item as { height: number }).height : undefined
      const scoreValue = typeof (item as { score?: unknown }).score === "number" ? (item as { score: number }).score : 0
      const normalized = normalizePhotoUrl(urlValue)
      if (!isLikelyPhotoUrl(normalized)) continue
      const score = scorePhotoCandidate(normalized, widthValue, heightValue) + scoreValue
      if (score < 0) continue
      const existing = found.get(normalized)
      if (!existing || score > existing.score) {
        found.set(normalized, { url: normalized, type: "photo", width: widthValue, height: heightValue, score })
      }
    }

    return [...found.values()].sort((a, b) => b.score - a.score).map(({ score: _score, ...media }) => media)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/**
 * Extract photos from Twitter/X post page using BrowserWindow.
 * Twitter requires JavaScript to load images, especially for multi-image posts (carousels).
 */
async function extractPhotosFromTwitterBrowser(postUrl: string): Promise<MediaItem[]> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1000,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
    },
  })

  try {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    win.webContents.setUserAgent(userAgent)

    await win.loadURL(postUrl, {
      userAgent,
      httpReferrer: "https://www.google.com/",
    })

    // Wait for page to load and JavaScript to execute
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const scrapeResults = await win.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const results = []
      const seen = new Set()
      const push = (url, width, height, score = 0) => {
        const value = String(url || '').trim()
        if (!value || seen.has(value)) return
        seen.add(value)
        results.push({ url: value, width: Number(width) || undefined, height: Number(height) || undefined, score })
      }

      // Strategy 1: Extract from all images in the DOM
      const allImages = Array.from(document.querySelectorAll('img'))

      for (const img of allImages) {
        const src = img.currentSrc || img.src || ''
        const width = img.naturalWidth || img.width || 0
        const height = img.naturalHeight || img.height || 0

        // Skip tiny images (icons, avatars, etc.)
        if (width <= 100 && height <= 100) continue

        // Skip data URLs
        if (src.startsWith('data:')) continue

        // Skip profile pictures and emojis
        if (src.includes('/profile_images/') || src.includes('/emoji/')) continue

        push(src, width, height, ((width * height) >= 100000 ? 20 : 10))
      }

      // Strategy 2: Look for carousel navigation and click through
      const carouselButtons = Array.from(document.querySelectorAll('[data-testid="carousel-nav-next"], [aria-label*="下一"], [aria-label*="Next"], [aria-label*="previous"], [aria-label*="上一"]'))

      // Click through carousel to load all images
      for (let step = 0; step < 10; step += 1) {
        const nextBtn = carouselButtons.find(btn => {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase()
          return label.includes('next') || label.includes('下一')
        })

        if (!nextBtn) break

        nextBtn.click()
        await wait(1500)

        // Collect newly loaded images
        for (const img of Array.from(document.querySelectorAll('img'))) {
          const src = img.currentSrc || img.src || ''
          const width = img.naturalWidth || img.width || 0
          const height = img.naturalHeight || img.height || 0
          if ((width > 100 || height > 100) && !src.includes('/profile_images/') && !src.includes('/emoji/')) {
            push(src, width, height, 15)
          }
        }
      }

      // Strategy 3: Extract from page HTML - look for Twitter media URLs
      const html = document.documentElement.outerHTML

      // Match pbs.twimg.com/media URLs (these are the actual tweet images)
      const mediaUrls = html.match(/https?:\\/\\/pbs\\.twimg\\.com\\/media\\/[^\\s"'<>]+/gi) || []
      for (const url of mediaUrls) {
        const clean = url.replace(/\\\\/g, '').replace(/&amp;/g, '&')
        push(clean, undefined, undefined, 25)
      }

      // Also match twimg.com/media in various formats
      const twimgUrls = html.match(/https?:\\/\\/[^\\s"'<>]*twimg[^\\s"'<>]*\\/media\\/[^\\s"'<>]+/gi) || []
      for (const url of twimgUrls) {
        const clean = url.replace(/\\\\/g, '').replace(/&amp;/g, '&')
        push(clean, undefined, undefined, 25)
      }

      // Strategy 4: Look for JSON data in scripts (Twitter embeds data in page)
      const scripts = Array.from(document.querySelectorAll('script'))
      for (const script of scripts) {
        const content = script.textContent || ''
        // Look for media_url in JSON
        const mediaUrlMatches = content.match(/"media_url_https?"\\s*:\\s*"([^"]+)"/gi) || []
        for (const match of mediaUrlMatches) {
          const urlMatch = match.match(/"([^"]+)"$/)
          if (urlMatch?.[1]) {
            const decoded = urlMatch[1].replace(/\\\\u002F/g, '/').replace(/\\\\u0026/g, '&')
            push(decoded, undefined, undefined, 30)
          }
        }
      }

      return results
    })()`, true)

    const found = new Map<string, MediaItem & { score: number }>()
    for (const item of Array.isArray(scrapeResults) ? scrapeResults : []) {
      if (!item || typeof item !== "object") continue
      const urlValue = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url : ""
      const widthValue = typeof (item as { width?: unknown }).width === "number" ? (item as { width: number }).width : undefined
      const heightValue = typeof (item as { height?: unknown }).height === "number" ? (item as { height: number }).height : undefined
      const scoreValue = typeof (item as { score?: unknown }).score === "number" ? (item as { score: number }).score : 0
      const normalized = normalizePhotoUrl(urlValue)
      if (!isLikelyPhotoUrl(normalized)) continue
      const score = scorePhotoCandidate(normalized, widthValue, heightValue) + scoreValue
      if (score < 0) continue
      const existing = found.get(normalized)
      if (!existing || score > existing.score) {
        found.set(normalized, { url: normalized, type: "photo", width: widthValue, height: heightValue, score })
      }
    }

    return [...found.values()].sort((a, b) => b.score - a.score).map(({ score: _score, ...media }) => media)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export async function scrapePhotosFromPostUrl(postUrl: string): Promise<MediaItem[] | undefined> {
  const normalized = canonicalizePostUrl(postUrl)
  if (!normalized) return undefined

  const isInstagramPost = isInstagramPostUrl(normalized)
  const isTwitterPost = isTwitterPostUrl(normalized)
  const cached = scrapeCache.get(normalized)
  const now = Date.now()
  const cachedPhotoCount = countPhotoMedia(cached?.media)
  const shouldBypassLowPhotoCache = (isInstagramPost || isTwitterPost) && cachedPhotoCount <= 1
  if (cached && now - cached.ts < SCRAPE_CACHE_TTL_MS && !shouldBypassLowPhotoCache) return cached.media
  if (shouldBypassLowPhotoCache) {
    scrapeCache.delete(normalized)
  }

  const failedAt = failedScrapeCache.get(normalized)
  if (failedAt && now - failedAt < FAILED_SCRAPE_CACHE_TTL_MS && !isInstagramPost && !isTwitterPost) return undefined
  if ((isInstagramPost || isTwitterPost) && failedAt) {
    failedScrapeCache.delete(normalized)
  }

  const collectedMedia: MediaItem[] = []
  const mergeMedia = (candidates: MediaItem[] | undefined) => {
    if (!candidates || candidates.length === 0) return
    collectedMedia.push(...candidates)
  }

  if (isInstagramPost) {
    // For Instagram, try browser-based scraping first (more reliable for carousels)
    // then fall back to embed
    try {
      console.log('[Instagram scrape] Starting browser scrape for:', normalized)
      const browserPhotos = await extractPhotosFromInstagramBrowser(normalized)
      console.log('[Instagram scrape] Browser scrape result:', browserPhotos?.length || 0, 'photos')
      mergeMedia(browserPhotos)
    } catch (err) {
      console.log('[Instagram scrape] Browser scrape error:', err)
      // Ignore browser fallback errors
    }

    // Also try embed as supplementary source
    try {
      const embedPhotos = await extractPhotosFromInstagramEmbed(normalized)
      console.log('[Instagram embed] Result:', embedPhotos?.length || 0, 'photos')
      mergeMedia(embedPhotos)
    } catch (err) {
      console.log('[Instagram embed] Error:', err)
      // Ignore embed failures
    }

    // Log collected media before mirror fallback
    console.log('[Instagram scrape] Total collected before mirror:', countPhotoMedia(collectedMedia), 'photos')

    // If we still have only 0-1 photos, try multiple mirror sites
    if (countPhotoMedia(collectedMedia) <= 1) {
      // Extract post ID from Instagram URL
      const postIdMatch = normalized.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
      if (postIdMatch?.[1]) {
        const postId = postIdMatch[1]
        // Try multiple mirror sites
        const mirrorUrls = [
          `https://picnob.com/post/${postId}/`,
          `https://pixnoy.com/post/${postId}/`,
          `https://piokok.com/post/${postId}/`,
          `https://pixwox.com/post/${postId}/`,
        ]
        for (const mirrorUrl of mirrorUrls) {
          if (countPhotoMedia(collectedMedia) > 1) break
          try {
            // First try simple HTML fetch
            const mirrorHtml = await fetchHtml(mirrorUrl)
            const mirrorPhotos = extractPhotosFromHtml(mirrorHtml)
            if (mirrorPhotos.length > 1) {
              mergeMedia(mirrorPhotos)
            }
            // If simple fetch didn't get enough photos, try browser-based scraping
            // Mirror sites often use JavaScript to load images
            if (countPhotoMedia(collectedMedia) <= 1) {
              try {
                const browserPhotos = await extractPhotosFromBrowserPage(mirrorUrl)
                if (browserPhotos.length > 1) {
                  mergeMedia(browserPhotos)
                }
              } catch {
                // Ignore browser-based mirror scraping errors
              }
            }
          } catch {
            // Ignore mirror fetch errors
          }
        }
      }
    }
  }

  // For Twitter/X posts, use browser-based scraping to get all carousel images
  if (isTwitterPost) {
    try {
      const browserPhotos = await extractPhotosFromTwitterBrowser(normalized)
      mergeMedia(browserPhotos)
    } catch {
      // Ignore Twitter browser errors
    }
  }

  try {
    const html = await fetchHtml(normalized)
    mergeMedia(extractPhotosFromHtml(html))
  } catch {
    // Fall through to BrowserWindow-based scraping.
  }

  const shouldTryBrowserFallback = shouldUseBrowserFallback(normalized) && (!isInstagramPost || countPhotoMedia(collectedMedia) <= 1)
  if (shouldTryBrowserFallback && !isInstagramPost) {
    try {
      mergeMedia(await extractPhotosFromBrowserPage(normalized))
    } catch {
      // Ignore browser fallback failures.
    }
  }

  const media = dedupePhotoMedia(collectedMedia)

  console.log('[Instagram scrape] Final media count:', media?.length || 0, 'photos')
  if (media && media.length > 0) {
    console.log('[Instagram scrape] Media URLs:', media.map(m => m.url.substring(0, 60) + '...'))
  }

  if (media.length > 0) {
    failedScrapeCache.delete(normalized)
    scrapeCache.set(normalized, { media, ts: now })
    return media
  }
  failedScrapeCache.set(normalized, now)
  return undefined
}

export async function scrapePhotosForEntry(entry: EntryLike, feedView: FeedViewType): Promise<MediaItem[] | undefined> {
  if (!isPictureLikeView(feedView)) return undefined

  // First, try to get media from entry's existing data (from RSS feed parsing)
  // This is the most reliable source when Instagram blocks scraping
  const fallbackMedia = buildEntryFallbackPhotoMedia(entry)
  const fallbackPhotoCount = countPhotoMedia(fallbackMedia)

  // For Instagram posts, check if we need to scrape for more photos
  // RSS feeds often only provide the first image of a carousel
  const postUrls = buildPostUrlCandidates(entry)
  const isInstagramPost = postUrls.some((url) => /instagram\.com/i.test(url))

  // For Instagram, if we have only 1 photo from RSS, try to scrape for more
  // Carousel posts can have many images but RSS typically only shows the first
  if (isInstagramPost && fallbackPhotoCount >= 1) {
    // If we already have multiple photos from RSS, use them directly
    if (fallbackPhotoCount > 1) {
      return fallbackMedia
    }

    // Try to scrape for more photos - carousel posts often have multiple images
    let bestScrapedMedia: MediaItem[] | undefined
    for (const postUrl of postUrls) {
      try {
        const scrapedMedia = await scrapePhotosFromPostUrl(postUrl)
        if (scrapedMedia && scrapedMedia.length > 1) {
          // Found multiple photos, return immediately
          return scrapedMedia
        }
        // Keep track of best scrape result
        if (scrapedMedia && scrapedMedia.length > (bestScrapedMedia?.length || 0)) {
          bestScrapedMedia = scrapedMedia
        }
      } catch {
        // Ignore scrape errors
      }
    }

    // If we found any scraped photos, merge with fallback
    if (bestScrapedMedia && bestScrapedMedia.length > 0) {
      return mergePreferredAndFallbackPhotoMedia(bestScrapedMedia, fallbackMedia)
    }

    // Fallback to RSS media if scraping didn't get more photos
    return fallbackMedia
  }

  // For non-Instagram posts, try to scrape for more/better photos
  for (const postUrl of postUrls) {
    const media = await scrapePhotosFromPostUrl(postUrl)
    if (!media || media.length === 0) continue
    const scrapedPhotoCount = countPhotoMedia(media)
    if (scrapedPhotoCount < fallbackPhotoCount) {
      return fallbackMedia.length > 0 ? fallbackMedia : media
    }
    if (scrapedPhotoCount === fallbackPhotoCount && fallbackPhotoCount > 0) {
      return mergePreferredAndFallbackPhotoMedia(media, fallbackMedia)
    }
    return media
  }

  return fallbackMedia.length > 0 ? fallbackMedia : undefined
}
