import type { SyntheticEvent } from 'react'
import type { Entry, MediaItem } from '../../../shared/types'
import {
  canonicalizeSocialUrl,
  extractFirstHttpUrl,
  extractFirstNonMediaUrl,
} from './social-url'
import { sanitizeHTML } from '../utils/sanitize'
import { getImageProxyFallbackUrls } from './image-proxy'
import { transformVideoUrl } from '../components/media/MediaPlayer'
import {
  decodeHtmlEntitiesUrl,
  decodeMediaUrl,
  extractIgCacheKeyFromUrl,
  extractInstagramAssetId,
  hasTinyDecorativeDimensions,
  isDecorativeSocialImageUrl,
  isPicnobMirrorHost,
  normalizePicnobMirrorRequestUrl,
} from './entry-media-url'

export function withCacheBust(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    parsed.searchParams.set('_fr_retry', String(Date.now()))
    return parsed.toString()
  } catch {
    const sep = raw.includes('?') ? '&' : '?'
    return `${raw}${sep}_fr_retry=${Date.now()}`
  }
}

export function extractPixnoyOriginUrl(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    if (
      /^media\.(picnob|pixnoy|piokok|pixwox)\./i.test(parsed.hostname) &&
      parsed.pathname === '/get'
    ) {
      const questionIndex = raw.indexOf('?')
      const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ''
      const markerIndex = rawQuery.indexOf('url=')
      const nestedRaw =
        markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ''
      let decodedRaw = nestedRaw
      if (decodedRaw) {
        try {
          decodedRaw = decodeURIComponent(decodedRaw)
        } catch {
          // Ignore malformed encoded URL and continue fallback ranking.
        }
      }
      const fromSearchParams = (parsed.searchParams.get('url') || '').trim()
      const candidates = [decodedRaw, nestedRaw, fromSearchParams].filter(
        (candidate) => /^https?:\/\//i.test(candidate),
      )
      if (candidates.length === 0) return ''
      candidates.sort((a, b) => {
        const score = (value: string) => {
          const lower = value.toLowerCase()
          let s = 0
          if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower)) s += 4
          if (lower.includes('oh=')) s += 2
          if (lower.includes('oe=')) s += 2
          if ((lower.match(/&_nc_/g) || []).length >= 2) s += 2
          if (
            /cdninstagram|fbcdn\.net|scontent\./i.test(lower) &&
            !lower.includes('oh=')
          )
            s -= 3
          if (
            /cdninstagram|fbcdn\.net|scontent\./i.test(lower) &&
            !lower.includes('oe=')
          )
            s -= 3
          if ((value.match(/https?:\/\//gi) || []).length > 1) s -= 6
          return s
        }
        return score(b) - score(a)
      })
      return candidates[0] || ''
    }
    if (!/pixnoy|pixnob|piokok|pixwox/i.test(parsed.hostname)) return ''
    const encoded = parsed.searchParams.get('o')
    if (!encoded) return ''
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const decoded = atob(padded)
    return /^https?:\/\//i.test(decoded) ? decoded : ''
  } catch {
    return ''
  }
}

export function normalizeMediaCompareKey(url: string): string {
  const raw = decodeMediaUrl(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === '/get') {
      const origin = extractPixnoyOriginUrl(raw)
      if (origin && origin !== raw) return normalizeMediaCompareKey(origin)
      const mirrorReq = normalizePicnobMirrorRequestUrl(raw)
      if (mirrorReq && mirrorReq !== raw) return mirrorReq.toLowerCase()
    }
    const pathname = decodeURIComponent(parsed.pathname).replace(/\/+$/, '')
    return `${parsed.origin.toLowerCase()}${pathname}${parsed.search || ''}`
  } catch {
    return raw.split('#')[0].trim()
  }
}

export function getPhotoDedupeKeys(url: string, previewUrl?: string): string[] {
  const keys: string[] = []
  const uniq = new Set<string>()
  const push = (key: string) => {
    if (!key || uniq.has(key)) return
    uniq.add(key)
    keys.push(key)
  }

  const normalizedUrl = normalizeMediaCompareKey(url || '')
  if (normalizedUrl) push(`url:${normalizedUrl}`)
  const normalizedPreview = normalizeMediaCompareKey(previewUrl || '')
  if (normalizedPreview) push(`url:${normalizedPreview}`)

  const igCacheKey =
    extractIgCacheKeyFromUrl(url) || extractIgCacheKeyFromUrl(previewUrl || '')
  if (keys.length === 0 && igCacheKey) push(`igcache:${igCacheKey}`)

  if (keys.length === 0) {
    const assetId =
      extractInstagramAssetId(url) || extractInstagramAssetId(previewUrl || '')
    if (assetId) push(`asset:${assetId}`)
  }

  return keys
}

export function getPhotoDedupeKey(url: string, previewUrl?: string): string {
  return getPhotoDedupeKeys(url, previewUrl)[0] || ''
}

export function isLikelyImageByUrl(url: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw) return false
  const nested = raw.match(/[?&]url=([^&#]+)/i)?.[1]
  if (nested) {
    try {
      const decodedNested = decodeURIComponent(nested)
      if (/^https?:\/\//i.test(decodedNested))
        return isLikelyImageByUrl(decodedNested)
    } catch {
      // Ignore malformed nested URL and continue fallback checks.
    }
  }
  if (isDecorativeSocialImageUrl(raw)) return false
  if (/^https?:\/\/media\.(?:picnob|pixnoy|piokok|pixwox)\.[^/]+\//i.test(raw))
    return true
  if (/^https?:\/\/sp\d+\.pixnoy\.[^/]+\//i.test(raw)) return true
  if (/\.(mp4|webm|mov|m3u8)(\?|$)/i.test(raw)) return false
  if (/(?:^|[?&])(mime|type)=video/i.test(raw)) return false
  if (/(?:^|[?&])(mime|type)=image/i.test(raw)) return true
  if (/\/v\/t\d+\.\d+-16\//i.test(raw)) return false
  if (/\/o1\/v\/t16\//i.test(raw)) return false
  if (/[?&]ig_cache_key=/i.test(raw)) return true
  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(raw) ||
    raw.includes('cdninstagram') ||
    raw.includes('scontent.') ||
    raw.includes('fbcdn.net') ||
    raw.includes('/p/pt_') ||
    raw.includes('pixnoy.com/p/')
  )
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url)
}

export function isRenderableVideoUrl(url: string): boolean {
  const decoded = decodeMediaUrl(url || '')
  if (!decoded || isLikelyImageByUrl(decoded)) return false
  if (isDirectVideoUrl(decoded)) return true
  if (/(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(decoded)) return true
  return !!transformVideoUrl(decoded)
}

export function isRenderableVideoMediaItem(
  media?: Pick<MediaItem, 'url' | 'previewUrl'> | null,
): boolean {
  if (!media) return false
  const url = decodeMediaUrl(media.url || '')
  const preview = decodeMediaUrl(media.previewUrl || '')
  if (url && isRenderableVideoUrl(url)) return true
  if (preview && isDirectVideoUrl(preview)) return true
  return false
}

export function extractImagesFromHtml(html: string): string[] {
  if (!html || !html.includes('<')) return []
  try {
    const pickBestFromSrcset = (value: string): string => {
      const list = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const pieces = part.split(/\s+/).filter(Boolean)
          const url = decodeMediaUrl(pieces[0] || '')
          const descriptor = pieces[1] || ''
          const width = descriptor.endsWith('w')
            ? parseInt(descriptor.slice(0, -1), 10)
            : 0
          return { url, width: Number.isFinite(width) ? width : 0 }
        })
        .filter((item) => !!item.url)
      if (list.length === 0) return ''
      list.sort((a, b) => b.width - a.width)
      return list[0]?.url || ''
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const urls = Array.from(doc.querySelectorAll('img'))
      .flatMap((img) => {
        const width =
          img.getAttribute('width') || img.getAttribute('data-width') || ''
        const height =
          img.getAttribute('height') || img.getAttribute('data-height') || ''
        const widthValue = width ? Number.parseInt(width, 10) : undefined
        const heightValue = height ? Number.parseInt(height, 10) : undefined
        if (hasTinyDecorativeDimensions(widthValue, heightValue)) return []
        const attrs = [
          decodeMediaUrl(img.getAttribute('src') || ''),
          decodeMediaUrl(img.getAttribute('data-src') || ''),
          decodeMediaUrl(img.getAttribute('data-original') || ''),
          decodeMediaUrl(img.getAttribute('data-lazy-src') || ''),
          pickBestFromSrcset(img.getAttribute('srcset') || ''),
          pickBestFromSrcset(img.getAttribute('data-srcset') || ''),
        ]
        return attrs.filter(
          (value) => !!value && !isDecorativeSocialImageUrl(value),
        )
      })
      .concat(
        Array.from(doc.querySelectorAll('source'))
          .map((source) =>
            pickBestFromSrcset(
              source.getAttribute('srcset') ||
                source.getAttribute('data-srcset') ||
                '',
            ),
          )
          .filter(Boolean),
      )
      .concat(
        Array.from(doc.querySelectorAll('video'))
          .flatMap((video) => [
            decodeMediaUrl(video.getAttribute('poster') || ''),
            decodeMediaUrl(video.getAttribute('data-poster') || ''),
          ])
          .filter(Boolean),
      )
      .concat(
        Array.from(doc.querySelectorAll('a'))
          .map((a) => decodeMediaUrl(a.getAttribute('href') || ''))
          .filter((candidate) => /^https?:\/\//i.test(candidate))
          .filter((candidate) =>
            /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(candidate),
          ),
      )
      .filter((candidate) => /^https?:\/\//i.test(candidate))
      .filter((candidate) => isLikelyImageByUrl(candidate))
      .filter(
        (candidate) => !/profile_images|avatar|emoji|icon/i.test(candidate),
      )

    return Array.from(new Set(urls))
  } catch {
    return []
  }
}

export function cleanSocialTextHtml(html: string): string {
  if (!html) return ''
  let safe = sanitizeHTML(html)
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="root">${safe}</div>`,
      'text/html',
    )
    const root = doc.getElementById('root')
    if (!root) return safe

    root
      .querySelectorAll('img,video,iframe,audio,picture,source,svg,canvas')
      .forEach((el) => el.remove())

    const prune = (el: Element) => {
      Array.from(el.children).forEach((child) => prune(child))
      if (!(el instanceof HTMLElement)) return
      el.removeAttribute('style')
      el.removeAttribute('width')
      el.removeAttribute('height')
      const meaningfulChildren = Array.from(el.children).filter(
        (child) => !['BR', 'WBR'].includes(child.tagName),
      )
      const text = (el.textContent || '')
        .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, ' ')
        .trim()
      if (!text && meaningfulChildren.length === 0) {
        el.remove()
      }
    }

    Array.from(root.children).forEach((child) => prune(child))
    safe = root.innerHTML
  } catch {
    // Fallback to regex cleanup below.
  }

  return safe
    .replace(
      /&lt;\s*(img|video|iframe|audio|picture|source)\b[\s\S]*?(?:&gt;|$)/gi,
      '',
    )
    .replace(/<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi, '')
    .replace(/<(img|video|iframe|audio|picture|source)\b[^>]*\/?>/gi, '')
    .replace(/<\/(video|iframe|audio|picture)>/gi, '')
    .replace(
      /<(p|div|span|section|article|li|blockquote)[^>]*>(?:\s|&nbsp;|&#160;|&#8203;|&#xfeff;|<br\s*\/?>)*<\/\1>/gi,
      '',
    )
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim()
}

export function cleanSocialPlainText(value: string): string {
  if (!value) return ''
  return value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/<[^>\n]*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeImageCacheKey(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const query = parsed.search || ''
    parsed.hash = ''
    return `${parsed.origin}${parsed.pathname}${query}`
  } catch {
    return raw.split('#')[0] || raw
  }
}

export function buildImageFallbackCandidates(
  primaryUrl: string,
  coverUrl: string,
  mirrorOriginUrl: string,
  maxWidth: number,
): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(
    mirrorOriginUrl || coverUrl || primaryUrl,
    {
      width: maxWidth,
      quality: 85,
      format: 'jpg',
    },
  )
  const candidates = [
    primaryUrl,
    coverUrl,
    mirrorOriginUrl,
    ...proxyFallbacks,
  ].filter(Boolean)
  const seedForMirror = mirrorOriginUrl || coverUrl || primaryUrl
  if (
    seedForMirror &&
    /cdninstagram\.com|fbcdn\.net|scontent\./i.test(seedForMirror)
  ) {
    candidates.push(
      `https://media.pixnoy.com/get?url=${encodeURIComponent(seedForMirror)}`,
    )
  }
  const unique: string[] = []
  for (const candidate of candidates) {
    if (!/^https?:\/\//i.test(candidate)) continue
    const normalized = normalizeImageCacheKey(candidate)
    if (
      !normalized ||
      unique.some((existing) => normalizeImageCacheKey(existing) === normalized)
    )
      continue
    unique.push(candidate)
  }
  return unique
}

export function advanceImageFallback(
  e: SyntheticEvent<HTMLImageElement>,
  seedUrl: string,
  options?: {
    previewUrl?: string
    maxWidth?: number
    onExhausted?: (img: HTMLImageElement) => void
  },
): void {
  const img = e.currentTarget
  const normalizedSeed = decodeMediaUrl(seedUrl || '')
  const originFromMirror =
    extractPixnoyOriginUrl(seedUrl) || extractPixnoyOriginUrl(normalizedSeed)
  const candidates = buildImageFallbackCandidates(
    img.currentSrc || img.src || normalizedSeed,
    normalizedSeed || seedUrl,
    originFromMirror,
    options?.maxWidth ?? 1280,
  )
  const rawDecoded = decodeHtmlEntitiesUrl(seedUrl || '')
  if (
    rawDecoded &&
    rawDecoded !== normalizedSeed &&
    /^https?:\/\//i.test(rawDecoded)
  ) {
    const rawKey = normalizeImageCacheKey(rawDecoded)
    if (
      rawKey &&
      !candidates.some(
        (candidate) => normalizeImageCacheKey(candidate) === rawKey,
      )
    ) {
      candidates.splice(1, 0, rawDecoded)
    }
  }
  if (options?.previewUrl) {
    const decodedPreview = decodeMediaUrl(options.previewUrl)
    for (const previewCandidate of [options.previewUrl, decodedPreview]) {
      if (!previewCandidate || !/^https?:\/\//i.test(previewCandidate)) continue
      const previewKey = normalizeImageCacheKey(previewCandidate)
      if (
        previewKey &&
        !candidates.some(
          (candidate) => normalizeImageCacheKey(candidate) === previewKey,
        )
      ) {
        candidates.splice(1, 0, previewCandidate)
        const mirrorProxyFallbacks = getImageProxyFallbackUrls(
          previewCandidate,
          {
            width: options?.maxWidth ?? 1280,
            quality: 85,
            format: 'jpg',
          },
        )
        for (const fallback of mirrorProxyFallbacks) {
          const fallbackKey = normalizeImageCacheKey(fallback)
          if (
            fallbackKey &&
            !candidates.some(
              (candidate) => normalizeImageCacheKey(candidate) === fallbackKey,
            )
          ) {
            candidates.push(fallback)
          }
        }
      }
    }
  }
  const currentKey = normalizeImageCacheKey(img.currentSrc || img.src || '')
  const currentIdx = candidates.findIndex(
    (candidate) => normalizeImageCacheKey(candidate) === currentKey,
  )
  const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 1
  if (nextIdx < candidates.length) {
    img.dataset.fallbackIndex = String(nextIdx)
    img.src = withCacheBust(candidates[nextIdx])
    return
  }
  options?.onExhausted?.(img)
}

export function isGenericInstagramIconUrl(url: string): boolean {
  const raw = (url || '').trim()
  const src = raw.toLowerCase()
  if (!src) return false
  if (isDecorativeSocialImageUrl(raw)) return true
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isInstaAssetHost =
      host.includes('instagram.com') &&
      !host.includes('cdninstagram') &&
      !host.includes('scontent')
    if (isInstaAssetHost) return true
    if (
      host.includes('picnob') ||
      host.includes('pixnoy') ||
      host.includes('piokok') ||
      host.includes('pixwox')
    ) {
      if (
        path.includes('favicon') ||
        path.endsWith('.ico') ||
        path.includes('logo')
      )
        return true
    }
  } catch {
    // Ignore malformed URLs.
  }
  return (
    src.includes('instagram.com/static/images/ico') ||
    src.includes('instagram_static/images/ico') ||
    src.includes('instagram_logo') ||
    src.includes('instagram-logo') ||
    src.includes('/apple-touch-icon') ||
    src.includes('favicon')
  )
}

export function normalizeInstagramUnavatar(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  if (!/unavatar\.io\/instagram\//i.test(raw)) return raw
  try {
    const parsed = new URL(raw)
    parsed.searchParams.set('fallback', 'false')
    return parsed.toString()
  } catch {
    return raw.includes('?') ? `${raw}&fallback=false` : `${raw}?fallback=false`
  }
}

export function resolveEntryBrowserOpenUrl(entry: Entry): string {
  const instagramIdToShortcode = (instagramId: string): string => {
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    if (!/^\d+$/.test(instagramId)) return ''
    let n = BigInt(instagramId)
    if (n === 0n) return alphabet[0]
    let shortcode = ''
    while (n > 0n) {
      const idx = Number(n % 64n)
      shortcode = alphabet[idx] + shortcode
      n /= 64n
    }
    return shortcode
  }

  const buildInstagramPostUrlFromMedia = (): string => {
    const contentText = `${entry.content || ''}\n${entry.summary || ''}`
    const contentCandidates = Array.from(
      new Set(
        (contentText.match(/https?:\/\/[^\s"'<>]+/g) || []).map((candidate) =>
          decodeMediaUrl(candidate),
        ),
      ),
    )
    const mediaCandidates = [
      ...(entry.media || []).flatMap((media) => [
        media.url || '',
        media.previewUrl || '',
      ]),
      entry.imageUrl || '',
      ...contentCandidates,
    ]
    for (const candidate of mediaCandidates) {
      const decodedCandidate = decodeMediaUrl(candidate || '')
      const igCacheKeyRaw = extractIgCacheKeyFromUrl(decodedCandidate)
      const base64Part = decodeURIComponent(igCacheKeyRaw).split('.')[0] || ''
      if (!base64Part) continue
      try {
        const instagramId = atob(base64Part)
        const shortcode = instagramIdToShortcode(instagramId)
        if (shortcode) return `https://www.instagram.com/p/${shortcode}/`
      } catch {
        // Ignore invalid base64 payloads.
      }
    }
    return ''
  }

  const extractSocialPostUrl = (text: string): string => {
    const raw = String(text || '')
    const patterns = [
      /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s?#]+\/status\/\d+[^\s"'<>)]*/i,
      /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+[^\s"'<>)]*/i,
      /https?:\/\/(?:www\.)?(?:picnob\.com|picnob\.info|pixnoy\.com|pixwox\.com)\/post\/[a-zA-Z0-9_-]+[^\s"'<>)]*/i,
      /https?:\/\/(?:www\.)?threads\.net\/@[^/\s?#]+\/post\/[a-zA-Z0-9_-]+[^\s"'<>)]*/i,
    ]
    for (const pattern of patterns) {
      const match = raw.match(pattern)
      if (match?.[0]) return canonicalizeSocialUrl(match[0])
    }
    return ''
  }

  const direct = (entry.url || '').trim()
  if (/^https?:\/\//i.test(direct)) return canonicalizeSocialUrl(direct)
  const postUrlFromContent = extractSocialPostUrl(
    `${entry.content || ''}\n${entry.summary || ''}`,
  )
  if (postUrlFromContent) return postUrlFromContent
  const contentUrl = extractFirstNonMediaUrl(
    `${entry.content || ''}\n${entry.summary || ''}`,
  )
  if (contentUrl) return canonicalizeSocialUrl(contentUrl)
  const anyUrl = extractFirstHttpUrl(
    `${entry.content || ''}\n${entry.summary || ''}`,
  )
  if (anyUrl && !isLikelyImageByUrl(anyUrl))
    return canonicalizeSocialUrl(anyUrl)
  const igPostUrl = buildInstagramPostUrlFromMedia()
  if (igPostUrl) return canonicalizeSocialUrl(igPostUrl)
  return ''
}
