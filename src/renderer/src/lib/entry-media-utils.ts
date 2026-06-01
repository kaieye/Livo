import { decodeHtmlEntitiesUrl, decodeMediaUrl } from './entry-media-url'
import { LRUCache } from './lru-cache'
import { normalizeInstagramUnavatar } from './social-entry-utils'

/** Return a copy of the media item with decoded URLs. */
export function decodeMediaUrls(m: {
  url: string
  previewUrl?: string
  type: string
  width?: number
  height?: number
  blurhash?: string
  duration?: number
}): typeof m {
  return {
    ...m,
    url: decodeMediaUrl(m.url),
    previewUrl: m.previewUrl
      ? decodeHtmlEntitiesUrl(m.previewUrl)
      : m.previewUrl,
  }
}

// LRU cache for expanded state of social media items
export const expandedCache = new LRUCache<string, boolean>(200)
export const mediaExpandedCache = new LRUCache<string, boolean>(200)
export const tweetTranslationCache = new LRUCache<string, string[]>(100)
export const tweetSummaryCache = new LRUCache<string, string>(100)
export const MEDIA_SRC_CACHE_STORAGE_KEY = 'livo-picture-src-cache-v4'
export const mediaSrcCache = new Map<string, string>()
export let mediaSrcCacheLoaded = false
export let mediaSrcCacheSaveTimer: number | null = null

export function normalizeImageCacheKey(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return raw
  const normalized = normalizeInstagramUnavatar(decodeMediaUrl(raw))
  return normalized.replace(/[?#].*$/, '').replace(/\/+$/, '')
}

export function getPhotoVariantQualityScore(photo: {
  width?: number
  height?: number
  url?: string
  previewUrl?: string
}): number {
  let score = 0
  const w = photo.width || 0
  const h = photo.height || 0
  if (w >= 640 && h >= 640) score += 5
  else if (w >= 320 && h >= 320) score += 3
  else if (w > 0 && h > 0) score += 1
  const hasNonThumbUrl =
    typeof photo.url === 'string' &&
    photo.url.length > 0 &&
    !/(?:\b|_)thumb(?:\b|_)/i.test(photo.url) &&
    !/(?:\b|_)150x150(?:\b|_)/i.test(photo.url)
  if (hasNonThumbUrl) score += 2
  const hasPreview =
    typeof photo.previewUrl === 'string' && photo.previewUrl.length > 0
  if (hasPreview) score += 2
  return score
}

export function dedupeGalleryPhotoVariants(
  photos: Array<{
    url: string
    previewUrl?: string
    width?: number
    height?: number
  }>,
): typeof photos {
  if (photos.length <= 1) return photos
  const seen = new Set<string>()
  const kept: typeof photos = []
  for (const photo of photos) {
    const rawKey = photo.url || photo.previewUrl || ''
    const key = normalizeImageCacheKey(decodeMediaUrl(rawKey))
    if (!key) {
      kept.push(photo)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(photo)
  }
  return kept
}

export function isInstagramLikeGalleryPhoto(photo: {
  url?: string
  previewUrl?: string
  width?: number
  height?: number
}): boolean {
  const w = photo.width || 0
  const h = photo.height || 0
  if (w > 0 && h > 0 && Math.abs(w - h) <= 2) return true
  const raw = photo.url || photo.previewUrl || ''
  return /instagram\.com|fbcdn\.net|cdninstagram\.com/i.test(raw)
}

export function ensureMediaSrcCacheLoaded(): void {
  if (mediaSrcCacheLoaded) return
  mediaSrcCacheLoaded = true
  try {
    const raw = localStorage.getItem(MEDIA_SRC_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    const entries = Object.entries(parsed as Record<string, unknown>)
    for (const [key, value] of entries) {
      if (typeof value === 'string' && value) {
        mediaSrcCache.set(key, value)
      }
    }
  } catch {
    // Ignore cache load failures — cache is best-effort.
  }
}

export function persistMediaSrcCache(): void {
  if (mediaSrcCacheSaveTimer !== null) return
  mediaSrcCacheSaveTimer = window.setTimeout(() => {
    mediaSrcCacheSaveTimer = null
    try {
      const obj: Record<string, string> = {}
      for (const [key, value] of mediaSrcCache) {
        obj[key] = value
      }
      localStorage.setItem(MEDIA_SRC_CACHE_STORAGE_KEY, JSON.stringify(obj))
    } catch {
      // Ignore.
    }
  }, 500)
}

export function buildMediaFallbackCandidates(
  media: Array<{ url: string; previewUrl?: string }>,
): Array<{ url: string; onFinalFallback?: () => void }> {
  const seen = new Set<string>()
  const candidates: Array<{ url: string; onFinalFallback?: () => void }> = []
  for (const item of media) {
    const primary = decodeMediaUrl(item.url || '')
    const preview = decodeMediaUrl(item.previewUrl || '')

    // CDN primary with mirror proxy as backup.
    if (primary && /cdninstagram\.com|fbcdn\.net/i.test(primary)) {
      if (preview && !/cdninstagram\.com|fbcdn\.net/i.test(preview)) {
        if (!seen.has(primary)) {
          seen.add(primary)
          candidates.push({ url: primary })
        }
        if (!seen.has(preview)) {
          seen.add(preview)
          candidates.push({ url: preview })
        }
        continue
      }
    }
    for (const url of [primary, preview]) {
      if (!url || seen.has(url)) continue
      seen.add(url)
      candidates.push({ url })
    }
  }
  return candidates
}

export function advanceCardImageFallback(
  e: { currentTarget: HTMLImageElement },
  candidates: Array<{ url: string }>,
): void {
  const img = e.currentTarget
  const resolved = getRememberedMediaSrc(
    img.getAttribute('data-fallback-key') || '',
    img.src,
  )
  const idx = candidates.findIndex((c) => c.url === resolved)
  const next =
    idx >= 0 && idx + 1 < candidates.length ? candidates[idx + 1] : null
  if (next) {
    const fbKey = normalizeImageCacheKey(
      img.getAttribute('data-fallback-key') || '',
    )
    rememberMediaSrc(fbKey, next.url)
    img.src = next.url
  }
}

export function getRememberedMediaSrc(
  coverUrl: string,
  primaryUrl: string,
): string {
  const key = normalizeImageCacheKey(coverUrl || primaryUrl)
  return mediaSrcCache.get(key) || primaryUrl
}

export function rememberMediaSrc(coverUrl: string, resolvedSrc: string): void {
  const key = normalizeImageCacheKey(coverUrl)
  if (!key || !resolvedSrc) return
  mediaSrcCache.set(key, resolvedSrc)
  persistMediaSrcCache()
}
