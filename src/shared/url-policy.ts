export type ExternalUrlBlockedReason =
  | 'malformed'
  | 'unsupported-protocol'
  | 'credentials'

export interface ExternalUrlPolicyResult {
  url: string
  hostname: string
  allowed: boolean
  blocked: boolean
  suspicious: boolean
  blockedReason: ExternalUrlBlockedReason | null
}

const EXTERNAL_URL_PROTOCOLS = new Set(['http:', 'https:'])
const HTML_BLOCKED_PROTOCOLS = /^(javascript|vbscript|file|about|chrome):/i

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl.trim())
  } catch {
    return null
  }
}

function hasCredentials(url: URL): boolean {
  return url.username.length > 0 || url.password.length > 0
}

function isSuspiciousHttpUrl(rawUrl: string, url: URL): boolean {
  const hostname = url.hostname
  return (
    hostname.includes('..') ||
    hostname.match(/\d+\.\d+\.\d+\.\d+/) !== null ||
    hostname.length > 50 ||
    rawUrl.includes('@') ||
    rawUrl.includes('\\')
  )
}

export function classifyExternalUrl(rawUrl: string): ExternalUrlPolicyResult {
  const trimmed = rawUrl.trim()
  const parsed = parseUrl(trimmed)

  if (!parsed) {
    return {
      url: trimmed,
      hostname: '',
      allowed: false,
      blocked: true,
      suspicious: false,
      blockedReason: 'malformed',
    }
  }

  const protocol = parsed.protocol.toLowerCase()
  if (!EXTERNAL_URL_PROTOCOLS.has(protocol)) {
    return {
      url: trimmed,
      hostname: parsed.hostname || '',
      allowed: false,
      blocked: true,
      suspicious: false,
      blockedReason: 'unsupported-protocol',
    }
  }

  if (hasCredentials(parsed)) {
    return {
      url: trimmed,
      hostname: parsed.hostname,
      allowed: false,
      blocked: true,
      suspicious: false,
      blockedReason: 'credentials',
    }
  }

  return {
    url: trimmed,
    hostname: parsed.hostname,
    allowed: true,
    blocked: false,
    suspicious: isSuspiciousHttpUrl(trimmed, parsed),
    blockedReason: null,
  }
}

export function isExternalHttpUrl(rawUrl: string): boolean {
  return classifyExternalUrl(rawUrl).allowed
}

export function createExternalUrlWarning(rawUrl: string): {
  url: string
  hostname: string
  isSuspicious: boolean
} {
  const result = classifyExternalUrl(rawUrl)
  return {
    url: result.url,
    hostname: result.hostname || result.url,
    isSuspicious: result.suspicious,
  }
}

export function isAllowedHtmlUrl(
  rawUrl: string,
  options: { allowImageDataUrl?: boolean } = {},
): boolean {
  const trimmed = rawUrl.trim()
  if (!trimmed) return false
  if (options.allowImageDataUrl && /^data:image\//i.test(trimmed)) return true
  if (/^data:/i.test(trimmed)) return false
  if (HTML_BLOCKED_PROTOCOLS.test(trimmed)) return false

  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)
  if (!schemeMatch) return true

  const protocol = `${schemeMatch[1].toLowerCase()}:`
  if (protocol === 'mailto:') return true
  if (protocol === 'http:' || protocol === 'https:') {
    const parsed = parseUrl(trimmed)
    return parsed ? !hasCredentials(parsed) : true
  }

  return false
}

export function isAllowedHtmlSrcset(rawSrcset: string): boolean {
  return rawSrcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0] || '')
    .filter(Boolean)
    .every((url) => isAllowedHtmlUrl(url, { allowImageDataUrl: true }))
}
