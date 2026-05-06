function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_matched: string, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _matched
    })
    .replace(/&#([0-9]+);/g, (_matched: string, digits: string) => {
      const code = parseInt(digits, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _matched
    })
}

function safeDecode(value: string): string {
  return decodeNumericEntities(value)
    .replace(/&#0*64;/gi, '@')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function trimTitle(value: string): string {
  return safeDecode(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value)
}

function getPathLike(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) {
    return ''
  }

  const matched = trimmed.match(/^https?:\/\/[^/]+(\/[^?#]*)?/i)
  if (matched?.[1]) {
    return matched[1]
  }

  return trimmed
}

function getHostLike(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) {
    return ''
  }

  const matched = trimmed.match(/^https?:\/\/([^/?#]+)/i)
  return (matched?.[1] || '').trim().toLowerCase()
}

function extractBilibiliUid(value: string): string {
  const matched = getPathLike(value).match(
    /\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i,
  )
  return matched?.[1]?.trim() || ''
}

function isKnownXHost(host: string): boolean {
  return (
    host === 'x.com' ||
    host === 'www.x.com' ||
    host === 'twitter.com' ||
    host === 'www.twitter.com' ||
    host === 'mobile.twitter.com' ||
    host === 'nitter.net' ||
    host.endsWith('.nitter.net')
  )
}

function isKnownInstagramHost(host: string): boolean {
  return (
    host === 'instagram.com' ||
    host === 'www.instagram.com' ||
    host === 'm.instagram.com' ||
    host === 'dumpor.com' ||
    host === 'www.dumpor.com' ||
    host === 'picnob.com' ||
    host === 'www.picnob.com' ||
    host === 'picnob.info' ||
    host === 'www.picnob.info' ||
    host === 'pixnoy.com' ||
    host === 'www.pixnoy.com' ||
    host === 'piokok.com' ||
    host === 'www.piokok.com'
  )
}

function isLikelyInstagramHandle(value: string): boolean {
  const normalized = (value || '').trim().replace(/^@/, '')
  if (!normalized) {
    return false
  }

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(normalized)) {
    return false
  }

  if (
    normalized.startsWith('.') ||
    normalized.endsWith('.') ||
    normalized.includes('..')
  ) {
    return false
  }

  return true
}

function isLikelyXHandle(value: string): boolean {
  const normalized = (value || '').trim().replace(/^@/, '')
  if (!normalized) {
    return false
  }

  return /^[a-zA-Z0-9_]{1,15}$/.test(normalized)
}

export function extractInstagramUsername(value: string): string {
  const trimmed = (value || '').trim()
  const pathLike = getPathLike(value)
  const rsshub = pathLike.match(/\/instagram\/user\/([^/?#]+)/i)
  if (rsshub?.[1]) {
    return decodeURIComponent(rsshub[1]).replace(/^@/, '').trim().toLowerCase()
  }

  const picnob = pathLike.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
  if (picnob?.[1]) {
    return decodeURIComponent(picnob[1]).replace(/^@/, '').trim().toLowerCase()
  }

  const pixnoy = pathLike.match(/\/pixnoy\/user\/([^/?#]+)/i)
  if (pixnoy?.[1]) {
    return decodeURIComponent(pixnoy[1]).replace(/^@/, '').trim().toLowerCase()
  }

  const piokok = pathLike.match(/\/piokok\/user\/([^/?#]+)/i)
  if (piokok?.[1]) {
    return decodeURIComponent(piokok[1]).replace(/^@/, '').trim().toLowerCase()
  }

  const dumpor = pathLike.match(/\/v\/([^/?#]+)/i)
  if (dumpor?.[1]) {
    return decodeURIComponent(dumpor[1]).replace(/^@/, '').trim().toLowerCase()
  }

  if (looksLikeUrl(trimmed) && !isKnownInstagramHost(getHostLike(trimmed))) {
    return ''
  }

  const direct = pathLike.match(/^\/?([^/?#]+)\/?$/)
  if (direct?.[1] && !/^https?:/i.test(direct[1])) {
    const candidate = decodeURIComponent(direct[1])
      .replace(/^@/, '')
      .trim()
      .toLowerCase()
    return isLikelyInstagramHandle(candidate) ? candidate : ''
  }

  return ''
}

export function extractXUsername(value: string): string {
  const trimmed = (value || '').trim()
  const pathLike = getPathLike(value)
  const rsshub = pathLike.match(/\/(?:x|twitter)\/user\/([^/?#]+)/i)
  if (rsshub?.[1]) {
    return decodeURIComponent(rsshub[1]).replace(/^@/, '').trim().toLowerCase()
  }

  const host = getHostLike(trimmed)
  if (looksLikeUrl(trimmed) && isKnownXHost(host)) {
    const knownPath = pathLike.match(/^\/([^/?#]+)(?:\/|$)/)
    const firstSegment = decodeURIComponent(knownPath?.[1] || '')
      .replace(/^@/, '')
      .trim()
      .toLowerCase()
    if (
      firstSegment &&
      firstSegment !== 'home' &&
      firstSegment !== 'explore' &&
      firstSegment !== 'search' &&
      firstSegment !== 'hashtag' &&
      firstSegment !== 'i' &&
      firstSegment !== 'intent' &&
      firstSegment !== 'share'
    ) {
      return isLikelyXHandle(firstSegment) ? firstSegment : ''
    }
  }

  if (looksLikeUrl(trimmed) && !isKnownXHost(getHostLike(trimmed))) {
    return ''
  }

  const direct = pathLike.match(/^\/?([^/?#]+)\/?$/)
  if (direct?.[1] && !/^https?:/i.test(direct[1])) {
    const candidate = decodeURIComponent(direct[1])
      .replace(/^@/, '')
      .trim()
      .toLowerCase()
    return isLikelyXHandle(candidate) ? candidate : ''
  }

  return ''
}

export function canonicalInstagramFeedUrl(
  rawUrl: string,
  siteUrl: string = '',
): string {
  const trimmed = (rawUrl || '').trim()
  const username =
    extractInstagramUsername(trimmed) || extractInstagramUsername(siteUrl)
  if (!username) {
    return trimmed
  }

  const instanceMatch = trimmed.match(/^(https?:\/\/[^/]+)/i)
  const instance = instanceMatch?.[1]?.trim()
  if (!instance) {
    return trimmed
  }

  return `${instance.replace(/\/+$/, '')}/picnob/user/${encodeURIComponent(username)}`
}

export function canonicalXFeedUrl(
  rawUrl: string,
  siteUrl: string = '',
): string {
  const trimmed = (rawUrl || '').trim()
  const username = extractXUsername(trimmed) || extractXUsername(siteUrl)
  if (!username) {
    return trimmed
  }

  const instanceMatch = trimmed.match(/^(https?:\/\/[^/]+)/i)
  const instance = instanceMatch?.[1]?.trim()
  if (!instance) {
    return trimmed
  }

  return `${instance.replace(/\/+$/, '')}/twitter/user/${encodeURIComponent(username)}`
}

export function canonicalFeedUrl(rawUrl: string, siteUrl: string = ''): string {
  const trimmed = (rawUrl || '').trim()
  const instagramUsername =
    extractInstagramUsername(trimmed) || extractInstagramUsername(siteUrl)
  const xUsername = extractXUsername(trimmed) || extractXUsername(siteUrl)

  if (xUsername && !instagramUsername) {
    return canonicalXFeedUrl(rawUrl, siteUrl)
  }

  if (instagramUsername) {
    return canonicalInstagramFeedUrl(rawUrl, siteUrl)
  }

  return trimmed
}

function isGenericInstagramTitle(value: string): boolean {
  const normalized = trimTitle(value).toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    normalized === 'instagram' ||
    normalized === 'log into instagram' ||
    normalized === 'instagram from meta'
  )
}

function isSuspiciousInstagramTitle(value: string): boolean {
  const normalized = trimTitle(value)
  if (!normalized) {
    return true
  }

  return (
    normalized.includes('�') ||
    /watch instagram stories/i.test(normalized) ||
    /profile anonymous/i.test(normalized) ||
    /view latest posts/i.test(normalized)
  )
}

export function formatInstagramFeedTitle(
  candidateTitle: string | undefined,
  usernameOrUrl: string,
): string {
  const fallback =
    extractInstagramUsername(usernameOrUrl) ||
    trimTitle(usernameOrUrl).replace(/^@/, '')
  let cleaned = trimTitle(candidateTitle || '')

  if (
    !cleaned ||
    looksLikeUrl(cleaned) ||
    isGenericInstagramTitle(cleaned) ||
    isSuspiciousInstagramTitle(cleaned)
  ) {
    return fallback
  }

  const hasMirrorMarkers =
    /public\s+posts|picnob|watch instagram stories|view latest posts/i.test(
      cleaned,
    )
  const fromParenAt = cleaned.match(/\(\s*@([a-zA-Z0-9._]{1,30})\s*\)/)
  if (fromParenAt?.[1] && hasMirrorMarkers) {
    cleaned = cleaned
      .replace(/\s*\(\s*@([a-zA-Z0-9._]{1,30})\s*\)\s*/i, ' ')
      .trim()
  }

  const fromDumporTitle = cleaned.match(
    /^([a-zA-Z0-9._]{1,30})\s+(?:watch instagram stories|view latest posts)/i,
  )
  if (fromDumporTitle?.[1]) {
    return fromDumporTitle[1]
  }

  cleaned = cleaned
    .replace(/^instagram\s*@?/i, '')
    .replace(/^ins\s*@?/i, '')
    .replace(/^(?:instagram|ins)\s*-\s*/i, '')
    .replace(/\s*-\s*(?:instagram|ins)\s*$/i, '')
    .replace(/\s*-\s*picnob(?:\.[^\s]+)?[\s\S]*$/i, '')
    .replace(/\s+(?:watch instagram stories|view latest posts)[\s\S]*$/i, '')
    .replace(/\s+public\s+posts[\s\S]*$/i, '')
    .replace(/^@/, '')
    .trim()

  return cleaned || fallback
}

export function formatXFeedTitle(
  candidateTitle: string | undefined,
  usernameOrUrl: string,
): string {
  const extractedUsername = extractXUsername(usernameOrUrl)
  const fallbackUsername =
    extractedUsername || trimTitle(usernameOrUrl).replace(/^@/, '')
  const normalizedHandle = fallbackUsername.toLowerCase()
  const fallback = fallbackUsername
  const withXSuffix = (value: string): string => {
    const base = trimTitle(value)
      .replace(/^@/, '')
      .replace(/\s*\/\s*x\s*$/i, '')
      .replace(/\s*-\s*x\s*$/i, '')
      .replace(/\s*[/-]\s*$/, '')
      .trim()
    return base ? `${base} - X` : ''
  }
  const cleaned = trimTitle(candidateTitle || '')
  if (
    !cleaned ||
    looksLikeUrl(cleaned) ||
    cleaned === 'X' ||
    cleaned.includes('Page not found')
  ) {
    return withXSuffix(fallback)
  }

  const fromRssHubTitle = cleaned.match(/^(?:twitter|x)\s*@(.+)$/i)
  if (fromRssHubTitle?.[1]) {
    return withXSuffix(fromRssHubTitle[1]) || withXSuffix(fallback)
  }

  const fromParenAt = cleaned.match(/^(.*?)\s*\(@([a-zA-Z0-9_]+)\)\s*\/\s*X$/i)
  if (fromParenAt?.[1]) {
    const normalizedName = trimTitle(fromParenAt[1])
    return withXSuffix(normalizedName) || withXSuffix(fallback)
  }

  const normalizedLower = cleaned.toLowerCase()
  if (normalizedHandle) {
    if (
      normalizedLower === normalizedHandle ||
      normalizedLower === `@${normalizedHandle}`
    ) {
      return withXSuffix(cleaned) || withXSuffix(fallback)
    }

    const trailingHandle = new RegExp(
      `\\s+@\\s*${escapeRegex(normalizedHandle)}$`,
      'i',
    )
    if (trailingHandle.test(cleaned)) {
      const withoutHandle = trimTitle(cleaned.replace(trailingHandle, ''))
      if (withoutHandle) {
        if (/^(?:x|twitter)$/i.test(withoutHandle)) {
          return withXSuffix(fallback)
        }
        return withXSuffix(withoutHandle) || withXSuffix(fallback)
      }
    }
  }

  const strippedPrefix = cleaned
    .replace(/^twitter\s*@?/i, '')
    .replace(/^x\s*@?/i, '')
    .replace(/\s*\/\s*x\s*$/i, '')
    .replace(/\s*-\s*x\s*$/i, '')
    .trim()

  if (normalizedHandle) {
    const strippedLower = strippedPrefix.toLowerCase()
    if (
      strippedLower === normalizedHandle ||
      strippedLower === `@${normalizedHandle}`
    ) {
      return withXSuffix(strippedPrefix) || withXSuffix(fallback)
    }
  }

  const displayName = (strippedPrefix || cleaned)
    .replace(/^@/, '')
    .replace(/\s+@\s*[a-z0-9_]{1,15}\s*$/i, '')
    .trim()
  return (
    withXSuffix(displayName) || withXSuffix(fallback) || withXSuffix(cleaned)
  )
}

export function formatBilibiliFeedTitle(
  candidateTitle: string | undefined,
  fallbackUidOrUrl: string,
): string {
  const fallbackUid =
    extractBilibiliUid(fallbackUidOrUrl) || trimTitle(fallbackUidOrUrl)
  const cleanedCandidate = trimTitle(candidateTitle || '')
  if (!cleanedCandidate || looksLikeUrl(cleanedCandidate)) {
    return fallbackUid ? `Bilibili ${fallbackUid}` : cleanedCandidate
  }

  const normalizedBase = cleanedCandidate
    .replace(/\s*的\s*bilibili\s*空间\s*$/i, '')
    .replace(/\s*的\s*bilibili\s*(?:动态|视频|专栏)\s*$/i, '')
    .replace(/\s*-\s*bilibili\s*$/i, '')
    .trim()

  if (!normalizedBase) {
    return fallbackUid ? `Bilibili ${fallbackUid}` : cleanedCandidate
  }

  return `${normalizedBase} - Bilibili`
}

export function normalizeSocialFeedTitle(
  candidateTitle: string | undefined,
  feedUrl: string,
  siteUrl: string = '',
): string {
  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (instagramUsername) {
    return formatInstagramFeedTitle(candidateTitle, instagramUsername)
  }

  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  if (xUsername) {
    return formatXFeedTitle(candidateTitle, xUsername)
  }

  const bilibiliUid = extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
  if (bilibiliUid) {
    return formatBilibiliFeedTitle(candidateTitle, bilibiliUid)
  }

  return trimTitle(candidateTitle || '')
}

export function normalizeSocialFeedDescription(
  description: string | undefined,
  feedUrl: string,
  siteUrl: string = '',
): string {
  const normalized = trimTitle(description || '')
    .replace(/\s*[|·•\-–—]?\s*powered\s+by\s+rsshub\.?\s*$/i, '')
    .trim()
  if (normalized && !/^(instagram|x)\s+用户$/i.test(normalized)) {
    return normalized
  }

  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (instagramUsername) {
    return `@${instagramUsername}`
  }

  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  if (xUsername) {
    return `@${xUsername}`
  }

  return normalized
}
