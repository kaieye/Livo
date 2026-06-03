import { isMirrorHost as _isMirrorHost } from '../../../shared/url-detect'
import type { Entry } from '../../../shared/types'

export function isPicnobMirrorHost(host: string): boolean {
  return _isMirrorHost(host)
}

export function decodeHtmlEntitiesUrl(url: string): string {
  let decoded =
    !url || !url.includes('&')
      ? url
      : url
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, num) =>
            String.fromCharCode(parseInt(num, 10)),
          )
          .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16)),
          )

  if (decoded?.startsWith('//')) decoded = `https:${decoded}`
  return decoded
}

export function normalizeNitterImageUrl(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    if (!parsed.hostname.toLowerCase().includes('nitter')) return raw
    if (!parsed.pathname.startsWith('/pic/')) return raw
    const encoded = parsed.pathname.slice('/pic/'.length)
    const decodedPath = decodeURIComponent(encoded)
    if (!decodedPath) return raw
    return `https://pbs.twimg.com/${decodedPath.replace(/^\/+/, '')}`
  } catch {
    return raw
  }
}

export function normalizePicnobImageUrl(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (!isPicnobMirrorHost(host) || parsed.pathname !== '/get') return raw

    const fromSearchParams = (parsed.searchParams.get('url') || '').trim()
    const questionIndex = raw.indexOf('?')
    const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ''
    const markerIndex = rawQuery.indexOf('url=')
    const rawSlice =
      markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ''
    let fromRawSlice = rawSlice
    if (fromRawSlice) {
      try {
        fromRawSlice = decodeURIComponent(fromRawSlice)
      } catch {
        // Keep the raw value if decoding fails.
      }
    }

    const candidates = [fromRawSlice, fromSearchParams].filter((candidate) =>
      /^https?:\/\//i.test(candidate),
    )
    if (candidates.length === 0) return raw

    const score = (value: string) => {
      let total = 0
      const lower = value.toLowerCase()
      if (/cdninstagram|fbcdn\.net|scontent\./i.test(lower)) total += 4
      if (/\.(jpe?g|png|webp|gif|bmp|avif)(\?|$)/i.test(lower)) total += 3
      if (lower.includes('ig_cache_key=')) total += 1
      if (lower.includes('oh=')) total += 2
      if (lower.includes('oe=')) total += 2
      if ((lower.match(/&_nc_/g) || []).length >= 2) total += 2
      if (
        /cdninstagram|fbcdn\.net|scontent\./i.test(lower) &&
        !lower.includes('oh=')
      )
        total -= 3
      if (
        /cdninstagram|fbcdn\.net|scontent\./i.test(lower) &&
        !lower.includes('oe=')
      )
        total -= 3
      if ((value.match(/https?:\/\//gi) || []).length > 1) total -= 6
      return total
    }

    candidates.sort((a, b) => score(b) - score(a))
    return candidates[0] || raw
  } catch {
    return raw
  }
}

export function decodeMediaUrl(url: string): string {
  const decoded = decodeHtmlEntitiesUrl(url)
  return normalizePicnobImageUrl(normalizeNitterImageUrl(decoded))
}

export function normalizePicnobMirrorRequestUrl(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (!isPicnobMirrorHost(host) || parsed.pathname !== '/get') return raw

    const questionIndex = raw.indexOf('?')
    const rawQuery = questionIndex >= 0 ? raw.slice(questionIndex + 1) : ''
    const markerIndex = rawQuery.indexOf('url=')
    const nestedRaw =
      markerIndex >= 0 ? rawQuery.slice(markerIndex + 4).trim() : ''
    let nested = nestedRaw || (parsed.searchParams.get('url') || '').trim()
    if (!nested) return raw
    try {
      nested = decodeURIComponent(nested)
    } catch {
      // Keep raw when already decoded.
    }
    if (!/^https?:\/\//i.test(nested)) return raw
    return `${parsed.origin}/get?url=${encodeURIComponent(nested)}`
  } catch {
    return raw
  }
}

export function extractInstagramAssetId(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === '/get') {
      const nested = parsed.searchParams.get('url') || ''
      if (nested) {
        const nestedId = extractInstagramAssetId(nested)
        if (nestedId) return nestedId
      }
    }
    if (
      (host.includes('pixnoy') ||
        host.includes('picnob') ||
        host.includes('pixwox') ||
        host.includes('piokok')) &&
      parsed.searchParams.has('o')
    ) {
      const encoded = parsed.searchParams.get('o') || ''
      if (encoded) {
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
        const padded =
          normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
        try {
          const decoded = atob(padded)
          const nested = decoded.match(/https?:\/\/\S+/i)?.[0] || decoded
          const nestedId = extractInstagramAssetId(nested)
          if (nestedId) return nestedId
        } catch {
          // Ignore.
        }
      }
    }
    const direct = raw.match(/_(\d{12,})_/)
    if (direct?.[1]) return direct[1]
    const decoded = decodeURIComponent(raw)
    const decodedMatch = decoded.match(/_(\d{12,})_/)
    if (decodedMatch?.[1]) return decodedMatch[1]
  } catch {
    const direct = raw.match(/_(\d{12,})_/)
    if (direct?.[1]) return direct[1]
  }
  return ''
}

export function extractInstagramAssetIdFromEntry(entry: Entry): string {
  const parts: string[] = [
    entry.url || '',
    entry.imageUrl || '',
    entry.content || '',
    entry.summary || '',
  ]
  for (const m of entry.media || []) {
    parts.push(m.url || '', m.previewUrl || '')
  }
  for (const part of parts) {
    const id = extractInstagramAssetId(part)
    if (id) return id
  }
  return ''
}

export function extractIgCacheKeyFromUrl(rawUrl: string): string {
  const raw = decodeMediaUrl(String(rawUrl || '').trim())
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const direct = parsed.searchParams.get('ig_cache_key') || ''
    if (direct) return direct
    const nested = parsed.searchParams.get('url') || ''
    if (nested) {
      const nestedParsed = new URL(decodeMediaUrl(nested))
      return nestedParsed.searchParams.get('ig_cache_key') || ''
    }
  } catch {
    // ignore malformed URLs
  }
  const match = raw.match(/[?&]ig_cache_key=([^&#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

export function hasTinyDecorativeDimensions(
  width?: number,
  height?: number,
): boolean {
  const safeWidth = width || 0
  const safeHeight = height || 0
  if (safeWidth <= 0 || safeHeight <= 0) return false
  const maxDimension = Math.max(safeWidth, safeHeight)
  const minDimension = Math.min(safeWidth, safeHeight)
  return maxDimension <= 180 || (maxDimension <= 240 && minDimension <= 180)
}

export function isDecorativeSocialImageUrl(url: string): boolean {
  const raw = (url || '').trim()
  const lower = raw.toLowerCase()
  if (!lower) return false
  const nested = lower.match(/[?&]url=([^&#]+)/i)?.[1]
  if (nested) {
    try {
      const decodedNested = decodeURIComponent(nested)
      if (
        decodedNested &&
        decodedNested !== raw &&
        isDecorativeSocialImageUrl(decodedNested)
      )
        return true
    } catch {
      // Ignore malformed nested URLs.
    }
  }
  if (lower.includes('unavatar.io/instagram/')) return true
  if (
    /(?:^|[/?#&_.=-])(avatar|profile|icon|logo|favicon|apple-touch-icon|android-chrome|mstile|sprite|emoji|placeholder|glyph|badge|button|download|appstore|app-store|playstore|play-store|googleplay|google-play)(?:$|[/?#&_.=-])/i.test(
      lower,
    )
  ) {
    return true
  }
  if (lower.includes('static.cdninstagram.com')) return true
  if (lower.includes('instagram.com/static/')) return true
  if (lower.includes('instagram_static/')) return true
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
    if (
      host.includes('cdninstagram.com') &&
      /\/(?:static|assets?|images?)\//i.test(path) &&
      !/\/(?:p|post|get)\//i.test(path)
    )
      return true
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
