/**
 * Image proxy utility for better loading and privacy.
 * Provides 2x resolution proxy URLs and optional WebP conversion.
 */

// Disabled by default: the public weserv endpoint is unstable/404 in many regions.
// Keep direct-origin URLs unless a working proxy base is explicitly provided.
const PROXY_BASE = ''
const FOLO_PROXY_BASE = 'https://img.folo.is'

function canUseFoloProxy(url: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw) return false
  return (
    raw.includes('cdninstagram.com') ||
    raw.includes('fbcdn.net') ||
    raw.includes('instagram.com') ||
    raw.includes('pixnoy.com') ||
    raw.includes('picnob.info') ||
    raw.includes('picnob.com') ||
    raw.includes('piokok.com') ||
    raw.includes('pixwox.com') ||
    raw.includes('sp1.pixnoy.com') ||
    raw.includes('sp2.pixnoy.com') ||
    raw.includes('sp3.pixnoy.com') ||
    raw.includes('sp4.pixnoy.com') ||
    raw.includes('sp5.pixnoy.com')
  )
}

function createProxyUrl(
  proxyBase: string,
  originalUrl: string,
  options?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'jpg' | 'png'
  },
): string {
  if (!proxyBase || !originalUrl) return ''
  const params = new URLSearchParams()
  params.set('url', originalUrl)
  if (options?.width) params.set('w', String(options.width * 2))
  if (options?.height) params.set('h', String(options.height * 2))
  if (options?.quality) params.set('q', String(options.quality))
  params.set('output', options?.format || 'webp')
  params.set('fit', 'cover')
  return `${proxyBase.replace(/\/+$/, '')}/?${params.toString()}`
}

/**
 * Generate a proxied image URL via weserv.nl (or similar CDN proxy).
 * This provides:
 * - Better caching and CDN delivery
 * - WebP conversion for smaller sizes
 * - Resize to 2x display density
 * - Privacy (origin server doesn't see user's IP)
 */
export function getProxiedImageUrl(
  originalUrl: string,
  options?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'jpg' | 'png'
  },
): string {
  if (!originalUrl) return ''
  if (!PROXY_BASE) return originalUrl

  // Don't proxy data URLs or blob URLs
  if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
    return originalUrl
  }

  try {
    return createProxyUrl(PROXY_BASE, originalUrl, options)
  } catch {
    return originalUrl
  }
}

export function getImageProxyFallbackUrls(
  originalUrl: string,
  options?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'jpg' | 'png'
  },
): string[] {
  if (!originalUrl) return []
  if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:'))
    return []

  const candidates = [
    canUseFoloProxy(originalUrl)
      ? createProxyUrl(FOLO_PROXY_BASE, originalUrl, options)
      : '',
    createProxyUrl(PROXY_BASE, originalUrl, options),
    createProxyUrl('https://images.weserv.nl', originalUrl, options),
    createProxyUrl('https://wsrv.nl', originalUrl, options),
  ].filter(Boolean)

  const uniq: string[] = []
  for (const url of candidates) {
    if (!uniq.includes(url)) uniq.push(url)
  }
  return uniq
}

/**
 * Get a thumbnail proxy URL for list items (80x80 or similar).
 */
export function getThumbnailUrl(originalUrl: string, size = 80): string {
  return getProxiedImageUrl(originalUrl, {
    width: size,
    height: size,
    quality: 80,
  })
}

/**
 * Get a gallery-quality proxy URL for social media photos.
 */
export function getGalleryImageUrl(
  originalUrl: string,
  maxWidth = 600,
): string {
  return getProxiedImageUrl(originalUrl, { width: maxWidth, quality: 85 })
}
