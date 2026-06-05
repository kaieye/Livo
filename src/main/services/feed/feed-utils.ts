/**
 * Shared feed parsing utilities — used by both feed-handlers.ts and feed-refresh.ts.
 * Extracts media, images, content, and author avatars from parsed RSS items.
 */
import type { MediaItem } from '../../../shared/types/index'
import { isMirrorMediaUrl } from '../../../shared/url-detect'

type MediaAttrs = {
  url?: string
  type?: string
  medium?: string
  width?: string
  height?: string
  duration?: string
}

type AtomLinkAttrs = {
  href?: string
  rel?: string
  type?: string
}

function readMediaAttrs(raw: unknown): MediaAttrs | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  // rss-parser may return MediaRSS attrs in either `.$` or flat object form.
  const attrs = (rec.$ && typeof rec.$ === 'object' ? rec.$ : rec) as Record<
    string,
    unknown
  >
  const asStr = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    url: asStr(attrs.url),
    type: asStr(attrs.type),
    medium: asStr(attrs.medium),
    width: asStr(attrs.width),
    height: asStr(attrs.height),
    duration: asStr(attrs.duration),
  }
}

function readXmlString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return readXmlString(value[0])
  if (!value || typeof value !== 'object') return undefined

  const rec = value as Record<string, unknown>
  const text = rec._
  return typeof text === 'string' ? text : undefined
}

function readXmlHref(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return readXmlHref(value[0])
  if (!value || typeof value !== 'object') return undefined

  const rec = value as Record<string, unknown>
  const attrs =
    rec.$ && typeof rec.$ === 'object'
      ? (rec.$ as Record<string, unknown>)
      : rec
  const href = attrs.href
  if (typeof href === 'string') return href
  return readXmlString(value)
}

function readAtomLinkAttrs(raw: unknown): AtomLinkAttrs | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  const attrs =
    rec.$ && typeof rec.$ === 'object'
      ? (rec.$ as Record<string, unknown>)
      : rec
  const asStr = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    href: asStr(attrs.href),
    rel: asStr(attrs.rel),
    type: asStr(attrs.type),
  }
}

function collectAtomEnclosureLinks(
  item: Record<string, unknown>,
): Array<AtomLinkAttrs & { href: string }> {
  const rawLinks = item.atomLinks as unknown
  const links = rawLinks
    ? Array.isArray(rawLinks)
      ? rawLinks
      : [rawLinks]
    : []
  return links
    .map(readAtomLinkAttrs)
    .filter(
      (attrs): attrs is AtomLinkAttrs & { href: string } =>
        !!attrs?.href && (attrs.rel || '').toLowerCase() === 'enclosure',
    )
}

function readItunesItemData(item: Record<string, unknown>): {
  image?: string
  duration?: string
  summary?: string
  subtitle?: string
} {
  const direct =
    item.itunes && typeof item.itunes === 'object'
      ? (item.itunes as Record<string, unknown>)
      : {}
  return {
    image:
      readXmlHref(direct.image) ||
      readXmlHref(item.itunesImage) ||
      readXmlHref(item['itunes:image']),
    duration:
      readXmlString(direct.duration) ||
      readXmlString(item.itunesDuration) ||
      readXmlString(item['itunes:duration']),
    summary:
      readXmlString(direct.summary) ||
      readXmlString(item.itunesSummary) ||
      readXmlString(item['itunes:summary']),
    subtitle:
      readXmlString(direct.subtitle) ||
      readXmlString(item.itunesSubtitle) ||
      readXmlString(item['itunes:subtitle']),
  }
}

function pickImgUrlFromTag(tagHtml: string): string | null {
  const pickBestFromSrcset = (rawSrcset: string | undefined): string | null => {
    if (!rawSrcset) return null
    const candidates = rawSrcset
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const pieces = part.split(/\s+/).filter(Boolean)
        const url = decodeHTMLEntities(pieces[0] || '')
        const descriptor = pieces[1] || ''
        const width = descriptor.endsWith('w')
          ? parseInt(descriptor.slice(0, -1), 10)
          : 0
        return { url, width: Number.isFinite(width) ? width : 0 }
      })
      .filter((item) => !!item.url)
    if (candidates.length === 0) return null
    candidates.sort((a, b) => b.width - a.width)
    return candidates[0]?.url || null
  }

  const attrPatterns = [
    /src=["']([^"']+)["']/i,
    /data-src=["']([^"']+)["']/i,
    /data-original=["']([^"']+)["']/i,
    /data-lazy-src=["']([^"']+)["']/i,
  ]
  for (const p of attrPatterns) {
    const m = tagHtml.match(p)
    if (m?.[1]) return decodeHTMLEntities(m[1])
  }

  const srcset = tagHtml.match(/srcset=["']([^"']+)["']/i)?.[1]
  const dataSrcset = tagHtml.match(/data-srcset=["']([^"']+)["']/i)?.[1]
  const bestSrcset =
    pickBestFromSrcset(srcset) || pickBestFromSrcset(dataSrcset)
  if (bestSrcset) return bestSrcset

  return null
}

function collectMediaContentNodes(item: Record<string, unknown>): unknown[] {
  const nodes: unknown[] = []
  const direct = item['media:content'] as unknown
  if (direct) nodes.push(...(Array.isArray(direct) ? direct : [direct]))

  const groups = item['media:group'] as unknown
  if (groups) {
    const groupList = Array.isArray(groups) ? groups : [groups]
    for (const group of groupList) {
      if (!group || typeof group !== 'object') continue
      const groupRec = group as Record<string, unknown>
      const groupContent = groupRec['media:content'] as unknown
      if (groupContent)
        nodes.push(
          ...(Array.isArray(groupContent) ? groupContent : [groupContent]),
        )
    }
  }

  return nodes
}

/**
 * Safely extract a string from an RSS item field that may be a plain string
 * or an xml2js object `{ _: "text", $: { type: "html" } }` (common for Atom
 * `<content>` and `<summary>` elements with type attributes).
 */
function unwrapXmlValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (
    value &&
    typeof value === 'object' &&
    '_' in (value as Record<string, unknown>)
  ) {
    const inner = (value as Record<string, unknown>)._
    return typeof inner === 'string' ? inner : ''
  }
  return ''
}

function collectMediaThumbnailNodes(item: Record<string, unknown>): unknown[] {
  const nodes: unknown[] = []
  const direct = item['media:thumbnail'] as unknown
  if (direct) nodes.push(...(Array.isArray(direct) ? direct : [direct]))

  const groups = item['media:group'] as unknown
  if (groups) {
    const groupList = Array.isArray(groups) ? groups : [groups]
    for (const group of groupList) {
      if (!group || typeof group !== 'object') continue
      const groupRec = group as Record<string, unknown>
      const groupThumb = groupRec['media:thumbnail'] as unknown
      if (groupThumb)
        nodes.push(...(Array.isArray(groupThumb) ? groupThumb : [groupThumb]))
    }
  }

  return nodes
}

function isKnownSocialMirrorImageUrl(url: string): boolean {
  const value = (url || '').toLowerCase()
  if (!value) return false
  return isMirrorMediaUrl(value)
}

function decodeUrlSafeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  try {
    return Buffer.from(padded, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

/**
 * Check whether rawUrl is a mirror proxy URL (picnob/pixnoy/etc) that wraps
 * a direct CDN URL.  Returns true when normalizeKnownMediaUrl would unwrap it.
 */
export function isMirrorProxyUrl(rawUrl: string): boolean {
  const decoded = decodeHTMLEntities((rawUrl || '').trim())
  if (!decoded) return false
  try {
    const parsed = new URL(decoded)
    const host = parsed.hostname.toLowerCase()
    return (
      isKnownSocialMirrorImageUrl(decoded) ||
      host.includes('picnob') ||
      host.includes('pixnoy') ||
      host.includes('pixwox') ||
      host.includes('piokok')
    )
  } catch {
    return false
  }
}

export function normalizeKnownMediaUrl(rawUrl: string): string {
  const decoded = decodeHTMLEntities((rawUrl || '').trim())
  if (!decoded) return ''

  try {
    const parsed = new URL(decoded)
    const host = parsed.hostname.toLowerCase()
    const isMirrorHost =
      isKnownSocialMirrorImageUrl(decoded) ||
      host.includes('picnob') ||
      host.includes('pixnoy') ||
      host.includes('pixwox') ||
      host.includes('piokok')

    if (isMirrorHost) {
      const questionIndex = decoded.indexOf('?')
      const rawQuery =
        questionIndex >= 0 ? decoded.slice(questionIndex + 1) : ''
      const markerIndex = rawQuery.indexOf('url=')
      let rawSlice =
        markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ''
      if (rawSlice) {
        try {
          rawSlice = decodeURIComponent(rawSlice)
        } catch {
          // Keep as-is when the nested URL is already decoded.
        }
      }

      const nested = (parsed.searchParams.get('url') || '').trim()
      const candidates = [rawSlice, nested]
        .map((value) => decodeHTMLEntities(value))
        .filter((value) => /^https?:\/\//i.test(value))

      if (candidates.length > 0) {
        const best = candidates.sort((a, b) => b.length - a.length)[0]
        if (best) return normalizeKnownMediaUrl(best)
      }

      const encodedOrigin = parsed.searchParams.get('o') || ''
      if (encodedOrigin) {
        const decodedOrigin = decodeUrlSafeBase64(encodedOrigin)
        const nestedUrl =
          decodedOrigin.match(/https?:\/\/\S+/i)?.[0] || decodedOrigin
        if (nestedUrl) return normalizeKnownMediaUrl(nestedUrl)
      }
    }

    // For Instagram CDN URLs, preserve the full URL including all query parameters
    // Instagram carousel photos have unique ig_cache_key and other parameters that distinguish them
    const isInstagramCdn = /cdninstagram\.com|fbcdn\.net|scontent\./i.test(host)
    if (isInstagramCdn) {
      parsed.hash = ''
      return parsed.toString()
    }

    parsed.hash = ''
    return parsed.toString()
  } catch {
    return decoded.split('#')[0] || decoded
  }
}

function isLikelyImageUrl(url: string): boolean {
  const u = url.toLowerCase()
  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(u) ||
    u.includes('/media/') ||
    u.includes('cdninstagram') ||
    u.includes('fbcdn.net') ||
    isKnownSocialMirrorImageUrl(u)
  )
}

function isLikelyAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:[?#]|$)/i.test(
    url.toLowerCase(),
  )
}

function isLikelyVideoUrl(url: string): boolean {
  return /\.(mp4|m4v|webm|mov|m3u8)(?:[?#]|$)/i.test(url.toLowerCase())
}

function isDecorativeInstagramAssetUrl(url: string): boolean {
  const raw = (url || '').trim()
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

/**
 * Extract media items (photos, videos, audio) from a parsed RSS item.
 *
 * Sources checked:
 * 1. <enclosure> (RSS 2.0 standard)
 * 2. <media:content> (Media RSS namespace)
 * 3. <media:thumbnail>
 * 4. <img> tags in HTML content
 * 5. <video> tags / <source> tags in HTML content
 * 6. YouTube/Bilibili/Vimeo URLs in content
 * 7. Entry link URL (YouTube/TED)
 * 8. <itunes:image> (podcast)
 */
export function extractMedia(
  item: Record<string, unknown>,
): MediaItem[] | undefined {
  const media: MediaItem[] = []
  const enclosure = item.enclosure as
    | { url?: string; type?: string }
    | undefined

  // 1. Enclosure
  if (enclosure?.url) {
    const type = enclosure.type || ''
    const enclosureUrl = enclosure.url.toLowerCase()
    const normalizedEnclosureUrl = normalizeKnownMediaUrl(enclosure.url)
    // Check if URL looks like an image - some feeds incorrectly set type="video/*" for images
    const urlLooksLikeImage =
      /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(enclosureUrl) ||
      enclosureUrl.includes('cdninstagram') ||
      enclosureUrl.includes('scontent.') ||
      enclosureUrl.includes('fbcdn.net') ||
      isKnownSocialMirrorImageUrl(enclosureUrl)
    if (type.startsWith('audio/')) {
      media.push({ url: enclosure.url, type: 'audio' })
    } else if (type.startsWith('video/') && !urlLooksLikeImage) {
      media.push({ url: enclosure.url, type: 'video' })
    } else if (
      (type.startsWith('image/') || urlLooksLikeImage) &&
      !isDecorativeInstagramAssetUrl(enclosure.url)
    ) {
      const finalUrl = normalizedEnclosureUrl || enclosure.url
      // When normalizing unwraps a mirror proxy URL (picnob/pixnoy) to a CDN URL,
      // keep the original mirror URL as previewUrl fallback — CDN signed URLs expire.
      const mirrorPreview =
        finalUrl !== decodeHTMLEntities(enclosure.url) &&
        isMirrorProxyUrl(enclosure.url)
          ? decodeHTMLEntities(enclosure.url)
          : undefined
      media.push({ url: finalUrl, type: 'photo', previewUrl: mirrorPreview })
    }
  }

  for (const link of collectAtomEnclosureLinks(item)) {
    const type = (link.type || '').toLowerCase()
    const decodedUrl = decodeHTMLEntities(link.href)
    const normalizedUrl = normalizeKnownMediaUrl(link.href)
    const finalUrl = normalizedUrl || decodedUrl
    if (!finalUrl || media.some((m) => m.url === finalUrl)) continue

    const lowerUrl = decodedUrl.toLowerCase()
    const urlLooksLikeImage =
      /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(lowerUrl) ||
      lowerUrl.includes('cdninstagram') ||
      lowerUrl.includes('scontent.') ||
      lowerUrl.includes('fbcdn.net') ||
      isKnownSocialMirrorImageUrl(lowerUrl)

    if (type.startsWith('audio/') || (!type && isLikelyAudioUrl(decodedUrl))) {
      media.push({ url: decodedUrl, type: 'audio' })
    } else if (
      (type.startsWith('video/') || (!type && isLikelyVideoUrl(decodedUrl))) &&
      !urlLooksLikeImage
    ) {
      media.push({ url: decodedUrl, type: 'video' })
    } else if (
      (type.startsWith('image/') || urlLooksLikeImage) &&
      !isDecorativeInstagramAssetUrl(decodedUrl)
    ) {
      const mirrorPreview =
        finalUrl !== decodedUrl && isMirrorProxyUrl(link.href)
          ? decodedUrl
          : undefined
      media.push({ url: finalUrl, type: 'photo', previewUrl: mirrorPreview })
    }
  }

  // 2. media:content (Media RSS) — can be single object or array
  const contentItems = collectMediaContentNodes(item)
  if (contentItems.length > 0) {
    for (const mc of contentItems) {
      const attrs = readMediaAttrs(mc)
      const mediaUrl = attrs?.url
      const normalizedMediaUrl = mediaUrl
        ? normalizeKnownMediaUrl(mediaUrl)
        : ''
      const dedupeUrl = normalizedMediaUrl || decodeHTMLEntities(mediaUrl || '')
      if (mediaUrl && !media.some((m) => m.url === dedupeUrl)) {
        const mimeType = attrs.type || ''
        const medium = attrs.medium || ''
        const decodedUrl = decodeHTMLEntities(mediaUrl).toLowerCase()
        let itemType: 'photo' | 'video' | 'audio' = 'photo'

        // Check if URL looks like an image - some mirror feeds incorrectly set medium="video" for images
        const urlLooksLikeImage =
          /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(decodedUrl) ||
          decodedUrl.includes('cdninstagram') ||
          decodedUrl.includes('scontent.') ||
          decodedUrl.includes('fbcdn.net') ||
          isKnownSocialMirrorImageUrl(decodedUrl)

        if (urlLooksLikeImage && !isDecorativeInstagramAssetUrl(mediaUrl)) {
          itemType = 'photo'
        } else if (mimeType.startsWith('video/') || medium === 'video') {
          itemType = 'video'
        } else if (mimeType.startsWith('audio/') || medium === 'audio') {
          itemType = 'audio'
        } else if (mimeType.startsWith('image/') || medium === 'image') {
          itemType = 'photo'
        }
        // When normalizing unwraps a mirror proxy URL to a CDN URL,
        // keep the original mirror URL as previewUrl fallback — CDN signed URLs expire.
        const mirrorPreview =
          itemType === 'photo' &&
          normalizedMediaUrl &&
          normalizedMediaUrl !== decodeHTMLEntities(mediaUrl || '') &&
          isMirrorProxyUrl(mediaUrl || '')
            ? decodeHTMLEntities(mediaUrl || '')
            : undefined
        media.push({
          url: itemType === 'photo' ? dedupeUrl : decodeHTMLEntities(mediaUrl),
          type: itemType,
          width: attrs.width ? parseInt(attrs.width) : undefined,
          height: attrs.height ? parseInt(attrs.height) : undefined,
          previewUrl: mirrorPreview,
        })
      }
    }
  }

  // Extract images and videos from content body
  const content =
    unwrapXmlValue(item['content:encoded']) ||
    unwrapXmlValue(item.content) ||
    unwrapXmlValue(item['description']) ||
    unwrapXmlValue(item.summary) ||
    ''

  // 3. Extract <img> tags (src/data-src/srcset lazy fields)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = imgRegex.exec(content)) !== null) {
    const rawUrl = pickImgUrlFromTag(match[0]) || decodeHTMLEntities(match[1])
    const url = normalizeKnownMediaUrl(rawUrl)
    if (
      url &&
      !media.some((m) => m.url === url) &&
      !isTrackingPixel(url) &&
      !isDecorativeInstagramAssetUrl(url)
    ) {
      // Try to extract width/height from attributes
      const wMatch = match[0].match(/width=["']?(\d+)/)
      const hMatch = match[0].match(/height=["']?(\d+)/)
      const mirrorPreview =
        url !== decodeHTMLEntities(rawUrl) && isMirrorProxyUrl(rawUrl)
          ? decodeHTMLEntities(rawUrl)
          : undefined
      media.push({
        url,
        type: 'photo',
        width: wMatch ? parseInt(wMatch[1]) : undefined,
        height: hMatch ? parseInt(hMatch[1]) : undefined,
        previewUrl: mirrorPreview,
      })
    }
  }
  // Also match <img> tags that don't expose a plain src attribute.
  const lazyImgRegex = /<img[^>]*>/gi
  while ((match = lazyImgRegex.exec(content)) !== null) {
    const imgRawUrl = pickImgUrlFromTag(match[0] || '') || ''
    const url = normalizeKnownMediaUrl(imgRawUrl)
    if (
      url &&
      !media.some((m) => m.url === url) &&
      !isTrackingPixel(url) &&
      !isDecorativeInstagramAssetUrl(url)
    ) {
      const mirrorPreview =
        url !== decodeHTMLEntities(imgRawUrl) && isMirrorProxyUrl(imgRawUrl)
          ? decodeHTMLEntities(imgRawUrl)
          : undefined
      media.push({ url, type: 'photo', previewUrl: mirrorPreview })
    }
  }

  // 3.5 Extract direct image links from <a href="..."> when feeds omit <img>.
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  while ((match = anchorRegex.exec(content)) !== null) {
    const href = normalizeKnownMediaUrl(match[1])
    if (
      href &&
      isLikelyImageUrl(href) &&
      !media.some((m) => m.url === href) &&
      !isDecorativeInstagramAssetUrl(href)
    ) {
      const mirrorPreview =
        href !== decodeHTMLEntities(match[1]) && isMirrorProxyUrl(match[1])
          ? decodeHTMLEntities(match[1])
          : undefined
      media.push({ url: href, type: 'photo', previewUrl: mirrorPreview })
    }
  }

  // 4. Extract <video> tags and <source> inside them
  const videoSrcRegex = /<(?:video|source)[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((match = videoSrcRegex.exec(content)) !== null) {
    const url = decodeHTMLEntities(match[1])
    const urlLower = url.toLowerCase()
    // Skip if URL looks like an image - some feeds incorrectly use <video> for images
    const urlLooksLikeImage =
      /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(urlLower) ||
      urlLower.includes('cdninstagram') ||
      urlLower.includes('scontent.') ||
      urlLower.includes('fbcdn.net') ||
      isKnownSocialMirrorImageUrl(urlLower)
    if (url && !media.some((m) => m.url === url) && !urlLooksLikeImage) {
      media.push({ url, type: 'video' })
    }
  }
  // Also look for <video poster="..."> for preview images
  const videoPosterRegex = /<video[^>]+poster=["']([^"']+)["'][^>]*>/gi
  while ((match = videoPosterRegex.exec(content)) !== null) {
    // Find the corresponding video media item and set its previewUrl
    const posterUrl = decodeHTMLEntities(match[1])
    const videoSrc = match[0].match(/src=["']([^"']+)["']/)
    if (videoSrc && posterUrl) {
      const decodedVideoSrc = decodeHTMLEntities(videoSrc[1])
      const videoItem = media.find(
        (m) => m.url === decodedVideoSrc && m.type === 'video',
      )
      if (videoItem)
        videoItem.previewUrl = normalizeKnownMediaUrl(posterUrl) || posterUrl
      else {
        // If video not found with decoded URL, try all videos (fallback)
        const lastVideo = [...media].reverse().find((m) => m.type === 'video')
        if (lastVideo && !lastVideo.previewUrl)
          lastVideo.previewUrl = normalizeKnownMediaUrl(posterUrl) || posterUrl
      }
    }
  }

  // 5. Extract YouTube videos from content
  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/g
  while ((match = youtubeRegex.exec(content)) !== null) {
    const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`
    if (!media.some((m) => m.url === url)) {
      media.push({
        url,
        type: 'video',
        previewUrl: `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`,
      })
    }
  }

  // Extract Bilibili videos
  const bilibiliRegex =
    /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]+)|(av\d+)/g
  while ((match = bilibiliRegex.exec(content)) !== null) {
    const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`
    if (!media.some((m) => m.url === url)) {
      media.push({ url, type: 'video' })
    }
  }

  // Extract Vimeo videos
  const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/g
  while ((match = vimeoRegex.exec(content)) !== null) {
    const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`
    if (!media.some((m) => m.url === url)) {
      media.push({ url, type: 'video' })
    }
  }

  // 6. Detect video platform URLs from the entry link itself
  const entryUrl = String(item.link || '')
  if (entryUrl) {
    const ytMatch = entryUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
    )
    if (ytMatch && !media.some((m) => m.url === entryUrl)) {
      media.push({
        url: entryUrl,
        type: 'video',
        previewUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      })
    }

    const tedMatch = entryUrl.match(/ted\.com\/talks\/([a-zA-Z0-9_]+)/)
    if (tedMatch && !media.some((m) => m.type === 'video')) {
      const cleanTedUrl = `https://www.ted.com/talks/${tedMatch[1]}`
      media.push({
        url: cleanTedUrl,
        type: 'video',
        previewUrl:
          (item['media:thumbnail'] as { $?: { url?: string } })?.$?.url ||
          readItunesItemData(item).image ||
          undefined,
      })
    }
  }

  // 7. itunes:image as photo
  const itunesData = readItunesItemData(item)
  if (itunesData.image && !media.some((m) => m.url === itunesData.image)) {
    if (!media.some((m) => m.type === 'photo')) {
      media.push({
        url: normalizeKnownMediaUrl(itunesData.image) || itunesData.image,
        type: 'photo',
      })
    }
  }

  // 8. media:thumbnail
  const thumbnailItems = collectMediaThumbnailNodes(item)
  for (const thumbNode of thumbnailItems) {
    const thumbAttrs = readMediaAttrs(thumbNode)
    const thumbUrl = thumbAttrs?.url
    const normalizedThumbUrl = thumbUrl ? normalizeKnownMediaUrl(thumbUrl) : ''
    if (
      !thumbUrl ||
      media.some(
        (m) => m.url === (normalizedThumbUrl || decodeHTMLEntities(thumbUrl)),
      )
    )
      continue
    media.push({
      url: normalizedThumbUrl || decodeHTMLEntities(thumbUrl),
      type: 'photo',
      width: thumbAttrs.width ? parseInt(thumbAttrs.width) : undefined,
      height: thumbAttrs.height ? parseInt(thumbAttrs.height) : undefined,
    })
  }

  // Back-fill previewUrl for YouTube video items extracted from content
  for (const m of media) {
    if (m.type === 'video' && !m.previewUrl) {
      const ytId = m.url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
      )
      if (ytId) {
        m.previewUrl = `https://img.youtube.com/vi/${ytId[1]}/hqdefault.jpg`
      }
    }
  }

  // Extract duration for video/audio items from itunes:duration or media:content duration
  const durationSeconds = parseDuration(item)
  if (durationSeconds && durationSeconds > 0) {
    // Apply to the first video or audio media item that lacks a duration
    const target = media.find(
      (m) => (m.type === 'video' || m.type === 'audio') && !m.duration,
    )
    if (target) target.duration = durationSeconds
  }

  return media.length > 0 ? media : undefined
}

/** Derive primary imageUrl from enclosure, itunes:image, media:thumbnail, or YouTube link */
export function deriveImageUrl(item: Record<string, unknown>): string {
  const enclosure = item.enclosure as
    | { url?: string; type?: string }
    | undefined
  if (enclosure?.url && enclosure.type?.startsWith('image/')) {
    if (isDecorativeInstagramAssetUrl(enclosure.url)) return ''
    return normalizeKnownMediaUrl(enclosure.url) || enclosure.url
  }

  for (const link of collectAtomEnclosureLinks(item)) {
    const type = (link.type || '').toLowerCase()
    const lowerUrl = (link.href || '').toLowerCase()
    const urlLooksLikeImage =
      /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(lowerUrl) ||
      lowerUrl.includes('cdninstagram') ||
      lowerUrl.includes('scontent.') ||
      lowerUrl.includes('fbcdn.net') ||
      isKnownSocialMirrorImageUrl(lowerUrl)
    if (!(type.startsWith('image/') || (!type && urlLooksLikeImage))) {
      continue
    }
    if (isDecorativeInstagramAssetUrl(link.href)) continue
    return normalizeKnownMediaUrl(link.href) || link.href
  }

  // media:content with image type
  const mediaContentItems = collectMediaContentNodes(item)
  for (const mc of mediaContentItems) {
    const attrs = readMediaAttrs(mc)
    if (
      attrs?.url &&
      (attrs.type?.startsWith('image/') || attrs.medium === 'image')
    ) {
      if (isDecorativeInstagramAssetUrl(attrs.url)) continue
      return normalizeKnownMediaUrl(attrs.url) || attrs.url
    }
  }
  for (const mc of mediaContentItems) {
    const attrs = readMediaAttrs(mc)
    if (attrs?.url && !attrs.type && !attrs.medium) {
      if (isDecorativeInstagramAssetUrl(attrs.url)) continue
      return normalizeKnownMediaUrl(attrs.url) || attrs.url
    }
  }

  const itunes = readItunesItemData(item)
  if (itunes?.image) {
    if (!isDecorativeInstagramAssetUrl(itunes.image))
      return normalizeKnownMediaUrl(itunes.image) || itunes.image
  }

  const thumbnailItems = collectMediaThumbnailNodes(item)
  for (const thumbNode of thumbnailItems) {
    const thumbAttrs = readMediaAttrs(thumbNode)
    if (thumbAttrs?.url)
      return normalizeKnownMediaUrl(thumbAttrs.url) || thumbAttrs.url
  }

  // Fallback from HTML content for feeds that only provide lazy image tags.
  const content =
    unwrapXmlValue(item['content:encoded']) ||
    unwrapXmlValue(item.content) ||
    unwrapXmlValue(item['description']) ||
    unwrapXmlValue(item.summary) ||
    ''
  if (content) {
    const imgTags = content.match(/<img[^>]*>/gi) || []
    for (const tag of imgTags) {
      const fromTag = pickImgUrlFromTag(tag)
      const normalizedTagUrl = normalizeKnownMediaUrl(fromTag || '')
      if (
        normalizedTagUrl &&
        !isTrackingPixel(normalizedTagUrl) &&
        !isDecorativeInstagramAssetUrl(normalizedTagUrl)
      )
        return normalizedTagUrl
    }

    const sourceTags = content.match(/<source[^>]*>/gi) || []
    for (const tag of sourceTags) {
      const fromTag = pickImgUrlFromTag(tag)
      const normalizedTagUrl = normalizeKnownMediaUrl(fromTag || '')
      if (
        normalizedTagUrl &&
        !isTrackingPixel(normalizedTagUrl) &&
        !isDecorativeInstagramAssetUrl(normalizedTagUrl)
      )
        return normalizedTagUrl
    }

    const hrefMatches = [...content.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    for (const hrefMatch of hrefMatches) {
      const decodedHref = normalizeKnownMediaUrl(hrefMatch[1] || '')
      if (
        decodedHref &&
        isLikelyImageUrl(decodedHref) &&
        !isDecorativeInstagramAssetUrl(decodedHref)
      )
        return decodedHref
    }
  }

  const link = String(item.link || '')
  const ytMatch = link.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
  )
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`

  const tedMatch = link.match(/ted\.com\/talks\/([a-zA-Z0-9_]+)/)
  if (tedMatch) {
    return `https://pi.tedcdn.com/r/talkstar-photos.s3.amazonaws.com/uploads/talk/${tedMatch[1]}.jpg?w=480`
  }

  return ''
}

/** Extract content from RSS item with fallback to multiple possible fields */
export function extractContent(item: Record<string, unknown>): string {
  const itunes = readItunesItemData(item)
  const contentSources = [
    item['content:encoded'],
    item.content,
    item['description'],
    item.summary,
    itunes.summary,
    itunes.subtitle,
  ]

  for (const source of contentSources) {
    const content = unwrapXmlValue(source)
    if (content.trim().length > 0) return content
  }

  return ''
}

/**
 * Extract author avatar URL from RSS item.
 * RSSHub Twitter feeds don't provide a dedicated avatar field, but the feed-level
 * image is typically the profile picture. We also try common patterns.
 */
export function extractAuthorAvatar(
  item: Record<string, unknown>,
  feedImageUrl?: string,
): string {
  // Some feeds carry atom:author with uri pointing to a profile image
  const author = item.author as
    | { avatar?: string; image?: string; uri?: string }
    | string
    | undefined
  if (typeof author === 'object' && author) {
    if (author.avatar) return author.avatar
    if (author.image) return author.image
  }

  // Use the feed-level image as author avatar (RSSHub Twitter feeds set this to the profile pic)
  if (feedImageUrl) return feedImageUrl

  return ''
}

export function getFeedImageUrl(parsed: any): string | undefined {
  const imageUrl =
    (parsed['image'] as { url?: string } | undefined)?.url ||
    (parsed['itunes'] as { image?: string } | undefined)?.image
  if (imageUrl) return imageUrl
  return undefined
}

/** Decode HTML entities in URLs extracted from RSS HTML content */
function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
}

/** Check if a URL is likely a tracking pixel (1×1 images, analytics, etc.) */
function isTrackingPixel(url: string): boolean {
  const lc = url.toLowerCase()
  return (
    lc.includes('pixel') ||
    lc.includes('tracker') ||
    lc.includes('beacon') ||
    lc.includes('1x1') ||
    lc.includes('spacer') ||
    /feeds\.feedburner\.com\/~ff/i.test(lc) ||
    /feedsportal\.com/i.test(lc)
  )
}

/**
 * Parse duration from RSS item.
 * Handles itunes:duration (HH:MM:SS, MM:SS, or plain seconds)
 * and media:content duration attribute (seconds).
 */
function parseDuration(item: Record<string, unknown>): number | undefined {
  // 1. itunes:duration — can be "HH:MM:SS", "MM:SS", or plain seconds string
  const itunes = readItunesItemData(item)
  if (itunes.duration != null) {
    const raw = String(itunes.duration).trim()
    if (/^\d+$/.test(raw)) return parseInt(raw, 10)
    const parts = raw.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
  }

  // 2. media:content duration attribute (seconds)
  const items = collectMediaContentNodes(item)
  for (const mc of items) {
    const attrs = readMediaAttrs(mc)
    if (attrs?.duration) {
      const secs = parseInt(attrs.duration, 10)
      if (!isNaN(secs) && secs > 0) return secs
    }
  }

  return undefined
}
