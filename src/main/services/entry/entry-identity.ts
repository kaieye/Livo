import type { Entry } from '../../../shared/types'
import { isMirrorHost } from '../../../shared/url-detect'

function isPicnobMirrorHost(host: string): boolean {
  return isMirrorHost(host)
}

export function normalizeIdentityText(value: string | undefined): string {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeIdentityUrl(value: string | undefined): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()

    if (isPicnobMirrorHost(host) && u.pathname === '/get') {
      const nested = u.searchParams.get('url') || ''
      if (nested) return normalizeIdentityUrl(nested)
    }

    if (
      host.includes('picnob') ||
      host.includes('pixnoy') ||
      host.includes('pixwox') ||
      host.includes('piokok') ||
      host.includes('dumpor') ||
      host.includes('instagram.com')
    ) {
      const pathParts = u.pathname.split('/').filter(Boolean)
      const postIndex = pathParts.findIndex(
        (p) => p === 'post' || p === 'p' || p === 'reel',
      )
      if (postIndex !== -1 && pathParts[postIndex + 1]) {
        return `https://www.instagram.com/p/${pathParts[postIndex + 1]}`
      }
    }

    const trackingParams = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'si',
      'feature',
      'spm',
      'from',
      'ref',
      'ref_src',
    ])
    const nextSearch = new URLSearchParams()
    for (const [k, v] of u.searchParams.entries()) {
      if (trackingParams.has(k.toLowerCase())) continue
      nextSearch.append(k, v)
    }
    u.hash = ''
    u.search = nextSearch.toString() ? `?${nextSearch.toString()}` : ''
    u.pathname = u.pathname.replace(/\/+$/, '') || '/'
    return u.toString()
  } catch {
    return raw.replace(/#.*$/, '')
  }
}

function getPrimaryMediaUrl(entry: Entry): string {
  const mediaUrl = entry.media?.find((m) => !!m.url)?.url || ''
  return mediaUrl || entry.imageUrl || ''
}

export function extractInstagramAssetId(input: string | undefined): string {
  const raw = (input || '').trim()
  if (!raw) return ''
  const nested = (() => {
    try {
      const u = new URL(raw)
      if (isPicnobMirrorHost(u.hostname) && u.pathname === '/get') {
        return u.searchParams.get('url') || raw
      }
      if (
        (u.hostname.includes('pixnoy') ||
          u.hostname.includes('picnob') ||
          u.hostname.includes('piokok')) &&
        u.searchParams.has('o')
      ) {
        const encoded = u.searchParams.get('o') || ''
        if (encoded) {
          const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
          const padded =
            normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
          try {
            const decoded = Buffer.from(padded, 'base64').toString('utf-8')
            const nestedUrl = decoded.match(/https?:\/\/\S+/i)?.[0] || decoded
            const nestedId = extractInstagramAssetId(nestedUrl)
            if (nestedId) return nestedId
          } catch {
            // Ignore invalid payload.
          }
        }
      }
    } catch {
      // Ignore parse errors.
    }
    return raw
  })()

  const numericMatch = nested.match(/_(\d{14,})_/)
  if (numericMatch?.[1]) return numericMatch[1]
  const directNumericMatch = raw.match(/_(\d{14,})_/)
  if (directNumericMatch?.[1]) return directNumericMatch[1]

  const shortcodeMatch = nested.match(/\/(?:p|reel)\/([a-zA-Z0-9_-]+)/i)
  if (shortcodeMatch?.[1]) return shortcodeMatch[1]
  const directShortcodeMatch = raw.match(/\/(?:p|reel)\/([a-zA-Z0-9_-]+)/i)
  if (directShortcodeMatch?.[1]) return directShortcodeMatch[1]

  const postMatch = nested.match(/\/post\/([a-zA-Z0-9_-]+)/i)
  if (postMatch?.[1]) return `post:${postMatch[1]}`
  const directPostMatch = raw.match(/\/post\/([a-zA-Z0-9_-]+)/i)
  if (directPostMatch?.[1]) return `post:${directPostMatch[1]}`

  return ''
}

export function makeEntryIdentityKey(entry: Entry): string | null {
  const assetIdCandidates: string[] = [entry.url || '', entry.imageUrl || '']
  for (const m of entry.media || []) {
    assetIdCandidates.push(m.url || '', m.previewUrl || '')
  }

  let fallbackId = ''
  for (const candidate of assetIdCandidates) {
    const id = extractInstagramAssetId(candidate)
    if (id) {
      if (/^\d+$/.test(id)) return `asset:${entry.feedId}:${id}`
      if (!fallbackId) fallbackId = id
    }
  }
  if (fallbackId) return `asset:${entry.feedId}:${fallbackId}`

  let url = normalizeIdentityUrl(entry.url)
  if (!url) {
    const rawContent = entry.content || entry.summary || ''
    const linkMatch = rawContent.match(
      /https:\/\/(?:www\.)?(?:instagram\.com\/p\/|picnob\.com\/post\/|picnob\.info\/post\/|pixnoy\.com\/post\/|pixwox\.com\/post\/|piokok\.com\/post\/|dumpor\.com\/v\/)[a-zA-Z0-9_-]+/i,
    )
    if (linkMatch) {
      url = normalizeIdentityUrl(linkMatch[0])
    }
  }

  if (url) return `url:${url}`

  const title = normalizeIdentityText(entry.title)
  const author = normalizeIdentityText(entry.author)
  const mediaUrl = normalizeIdentityUrl(getPrimaryMediaUrl(entry))
  const contentSnippet = normalizeIdentityText(
    (entry.content || entry.summary || '')
      .replace(/<[^>]+>/g, '')
      .slice(0, 180),
  )
  const publishedBucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  if (!title && !mediaUrl && !contentSnippet) return null
  if (mediaUrl) {
    return `fallback-media:${entry.feedId}\n${mediaUrl}\n${author}\n${title}\n${contentSnippet}\n${publishedBucket}`
  }
  return `fallback-text:${entry.feedId}\n${title}\n${author}\n${contentSnippet}\n${publishedBucket}`
}

function normalizeTitleLooseForRead(value: string | undefined): string {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Script=Han}#@]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getLooseNormalizedTitle(value: string | undefined): string {
  return normalizeTitleLooseForRead(value)
}

export function titlesLikelySameForRead(
  a: string | undefined,
  b: string | undefined,
): boolean {
  const ta = normalizeTitleLooseForRead(a)
  const tb = normalizeTitleLooseForRead(b)
  if (!ta || !tb) return false
  if (ta === tb) return true
  return ta.includes(tb) || tb.includes(ta)
}
