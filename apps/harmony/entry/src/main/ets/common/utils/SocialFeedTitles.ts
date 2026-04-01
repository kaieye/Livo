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

export function extractInstagramUsername(value: string): string {
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

  const direct = pathLike.match(/^\/?([^/?#]+)\/?$/)
  if (direct?.[1] && !/^https?:/i.test(direct[1])) {
    return decodeURIComponent(direct[1]).replace(/^@/, '').trim().toLowerCase()
  }

  return ''
}

export function extractXUsername(value: string): string {
  const pathLike = getPathLike(value)
  const rsshub = pathLike.match(/\/(?:x|twitter)\/user\/([^/?#]+)/i)
  if (rsshub?.[1]) {
    return decodeURIComponent(rsshub[1]).replace(/^@/, '').trim().toLowerCase()
  }

  const direct = pathLike.match(/^\/?([^/?#]+)\/?$/)
  if (direct?.[1] && !/^https?:/i.test(direct[1])) {
    return decodeURIComponent(direct[1]).replace(/^@/, '').trim().toLowerCase()
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
  const fallback =
    extractXUsername(usernameOrUrl) ||
    trimTitle(usernameOrUrl).replace(/^@/, '')
  const cleaned = trimTitle(candidateTitle || '')
  if (
    !cleaned ||
    looksLikeUrl(cleaned) ||
    cleaned === 'X' ||
    cleaned.includes('Page not found')
  ) {
    return fallback
  }

  const fromAt = cleaned.match(/^(.*?)\s*\(@[a-zA-Z0-9_]+\)\s*\/\s*X$/i)
  if (fromAt?.[1]) {
    return trimTitle(fromAt[1])
  }

  return cleaned
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

  return trimTitle(candidateTitle || '')
}

export function normalizeSocialFeedDescription(
  description: string | undefined,
  feedUrl: string,
  siteUrl: string = '',
): string {
  const normalized = trimTitle(description || '')
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
