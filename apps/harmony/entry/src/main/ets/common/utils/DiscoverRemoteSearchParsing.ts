import {
  formatInstagramFeedTitle,
  formatXFeedTitle,
  normalizeSocialFeedDescription,
} from './SocialFeedTitles.ts'

export interface SocialRemoteProfile {
  username: string
  title: string
  imageUrl: string
  followers: string
}

export type DiscoverRemoteProfilePlatform = 'x' | 'instagram'

export interface DiscoverRemoteProfileSeed {
  platform: DiscoverRemoteProfilePlatform
  username: string
  title: string
  profileUrl: string
  imageUrl: string
  followers: string
}

export interface DiscoverRemoteViewMapping {
  x: number
  instagram: number
}

export interface DiscoverRemoteCandidateCompatible {
  targetUrl: string
  targetTitle: string
  targetView: number
  description: string
  siteUrl: string
  sourceKind: string
  imageUrl?: string
}

interface ResolvedProfileUrl {
  href: string
  host: string
  pathname: string
}

function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (matched: string, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
    .replace(/&#([0-9]+);/g, (matched: string, digits: string) => {
      const code = parseInt(digits, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
}

function decodeBasicEntities(value: string): string {
  return decodeNumericEntities(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#0*64;/gi, '@')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(value: string): string {
  return decodeBasicEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeValue(value: string): string {
  return stripTags(value)
    .toLowerCase()
    .replace(/[@\s_.\-|/]+/g, '')
}

function extractAttribute(value: string, attribute: string): string {
  const matched = value.match(
    new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i'),
  )
  return matched?.[1] ? decodeBasicEntities(matched[1]) : ''
}

function normalizeHost(value: string): string {
  return value
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '')
}

function resolveUrl(
  value: string,
  baseUrl: string,
): ResolvedProfileUrl | undefined {
  const trimmed = decodeBasicEntities(value || '').trim()
  if (!trimmed) {
    return undefined
  }

  const baseMatch = decodeBasicEntities(baseUrl || '')
    .trim()
    .match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?/i)
  if (!baseMatch?.[1] || !baseMatch[2]) {
    return undefined
  }

  const protocol = baseMatch[1].toLowerCase()
  const baseHost = baseMatch[2]
  const basePath = baseMatch[3] ?? '/'
  let resolved = trimmed

  if (trimmed.startsWith('//')) {
    resolved = `https:${trimmed}`
  } else if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith('/')) {
      resolved = `${protocol}://${baseHost}${trimmed}`
    } else {
      const baseDir = basePath.replace(/\/[^/]*$/, '/')
      resolved = `${protocol}://${baseHost}${baseDir}${trimmed}`.replace(
        /([^:]\/)\/+/g,
        '$1',
      )
    }
  }

  const resolvedMatch = resolved.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?/i)
  if (!resolvedMatch?.[2]) {
    return undefined
  }

  return {
    href: resolved,
    host: resolvedMatch[2],
    pathname: resolvedMatch[3] ?? '/',
  }
}

function normalizeImageUrl(value: string, baseUrl: string): string {
  const trimmed = decodeBasicEntities(value || '').trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.substring('http://'.length)}`
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed
  }

  const resolved = resolveUrl(trimmed, baseUrl)
  return resolved?.href ?? trimmed
}

function extractMeaningfulSpanText(block: string): string {
  const spans = block.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)
  const chunks: string[] = []

  for (const matched of spans) {
    const text = stripTags(matched[1] ?? '')
    if (!text) {
      continue
    }

    const normalizedText = normalizeValue(text)
    if (!normalizedText) {
      continue
    }

    if (/^@/.test(text) || /followers?/i.test(text)) {
      continue
    }

    chunks.push(text)
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

function refineFallbackTitle(text: string): string {
  const normalized = stripTags(text)
  if (!normalized) {
    return ''
  }

  return normalized
    .replace(/@[\w.]+/g, ' ')
    .replace(/followers?\s*[:：]?\s*[\d]+(?:[.,]\d+)?(?:\s*[KMB])?/gi, ' ')
    .replace(/[\d]+(?:[.,]\d+)?(?:\s*[KMB])?\s*followers?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(block: string): string {
  const ariaLabel = extractAttribute(block, 'aria-label')
  if (ariaLabel) {
    return stripTags(ariaLabel)
  }

  const spanText = extractMeaningfulSpanText(block)
  if (spanText) {
    return spanText
  }

  const titleMatch = block.match(/title=["']([^"']+)["']/i)
  if (titleMatch?.[1]) {
    return stripTags(titleMatch[1])
  }

  return refineFallbackTitle(block)
}

function extractImageUrl(block: string): string {
  const imageMatch = block.match(
    /<img\b[^>]*\b(?:data-src|data-original|src)=["']([^"']+)["']/i,
  )
  return imageMatch?.[1] ? decodeBasicEntities(imageMatch[1]) : ''
}

function shouldKeepProfile(
  query: string,
  username: string,
  title: string,
  block: string,
): boolean {
  const keyword = normalizeValue(query)
  if (!keyword) {
    return true
  }

  return (
    normalizeValue(username).includes(keyword) ||
    normalizeValue(title).includes(keyword) ||
    normalizeValue(block).includes(keyword)
  )
}

export function extractXFollowersFromText(text: string): string {
  const normalized = stripTags(text)
  if (!normalized) {
    return ''
  }

  const directMatch = normalized.match(
    /([\d]+(?:[.,]\d+)?(?:\s*[KMB万亿])?)\s*(?:followers?|位?粉丝)/i,
  )
  if (directMatch?.[1]) {
    return `${directMatch[1].replace(/\s+/g, '').trim()} followers`
  }

  const prefixedMatch = normalized.match(
    /(?:followers?|粉丝)\s*[:：]?\s*([\d]+(?:[.,]\d+)?(?:\s*[KMB万亿])?)/i,
  )
  if (prefixedMatch?.[1]) {
    return `${prefixedMatch[1].replace(/\s+/g, '').trim()} followers`
  }

  return ''
}

function extractUsernameFromProfileUrl(profileUrl: ResolvedProfileUrl): string {
  const parts = profileUrl.pathname
    .split('/')
    .filter((part: string) => part.length > 0)
  const first = (parts[0] ?? '').replace(/^@/, '').trim()
  if (!first || parts.length > 1) {
    return ''
  }
  return first.toLowerCase()
}

function parseProfilesFromHtml(
  html: string,
  query: string,
  baseUrl: string,
  allowedHosts: string[],
  fallbackTitlePrefix: string,
): SocialRemoteProfile[] {
  const profiles: SocialRemoteProfile[] = []
  const seen = new Set<string>()
  const normalizedHtml = decodeBasicEntities(html || '')
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let matched: RegExpExecArray | null = pattern.exec(normalizedHtml)

  while (matched) {
    const href = matched[1] ?? ''
    const block = matched[2] ?? ''
    const profileUrl = resolveUrl(href, baseUrl)
    const username = profileUrl ? extractUsernameFromProfileUrl(profileUrl) : ''
    const host = profileUrl ? normalizeHost(profileUrl.host) : ''
    const title = username ? extractTitle(block) : ''
    const imageUrl = profileUrl
      ? normalizeImageUrl(extractImageUrl(block), profileUrl.href)
      : ''
    const followers = extractXFollowersFromText(block)

    if (
      username &&
      profileUrl &&
      allowedHosts.includes(host) &&
      !seen.has(username) &&
      shouldKeepProfile(query, username, title, block)
    ) {
      seen.add(username)
      profiles.push({
        username,
        title: title || `${fallbackTitlePrefix}${username}`,
        imageUrl,
        followers,
      })
    }

    matched = pattern.exec(normalizedHtml)
  }

  return profiles
}

export function parseXProfilesFromSearchHtml(
  html: string,
  query: string,
): SocialRemoteProfile[] {
  return parseProfilesFromHtml(
    html,
    query,
    'https://x.com',
    ['x.com', 'twitter.com'],
    '@',
  )
}

export function parseInstagramProfilesFromSearchHtml(
  html: string,
  query: string,
): SocialRemoteProfile[] {
  return parseProfilesFromHtml(
    html,
    query,
    'https://www.instagram.com',
    ['instagram.com'],
    '@',
  )
}

function normalizeProfileTitle(profile: SocialRemoteProfile): string {
  return profile.title.trim() || profile.username
}

function normalizeProfileUrl(
  platform: DiscoverRemoteProfilePlatform,
  username: string,
): string {
  if (platform === 'x') {
    return `https://x.com/${encodeURIComponent(username)}`
  }

  return `https://www.instagram.com/${encodeURIComponent(username)}/`
}

export function buildXProfileSeedFromProfile(
  profile: SocialRemoteProfile,
): DiscoverRemoteProfileSeed {
  return {
    platform: 'x',
    username: profile.username,
    title: normalizeProfileTitle(profile),
    profileUrl: normalizeProfileUrl('x', profile.username),
    imageUrl: profile.imageUrl,
    followers: profile.followers,
  }
}

export function buildInstagramProfileSeedFromProfile(
  profile: SocialRemoteProfile,
): DiscoverRemoteProfileSeed {
  return {
    platform: 'instagram',
    username: profile.username,
    title: normalizeProfileTitle(profile),
    profileUrl: normalizeProfileUrl('instagram', profile.username),
    imageUrl: profile.imageUrl,
    followers: profile.followers,
  }
}

export function buildXCandidateFromProfile(
  profile: DiscoverRemoteProfileSeed,
  viewMapping: DiscoverRemoteViewMapping,
): DiscoverRemoteCandidateCompatible {
  return toDiscoverCandidateFromProfileSeed(profile, viewMapping)
}

export function buildInstagramCandidateFromProfile(
  profile: DiscoverRemoteProfileSeed,
  viewMapping: DiscoverRemoteViewMapping,
): DiscoverRemoteCandidateCompatible {
  return toDiscoverCandidateFromProfileSeed(profile, viewMapping)
}

export function dedupeAndLimitDiscoverCandidates(
  items: DiscoverRemoteProfileSeed[],
  limit: number,
): DiscoverRemoteProfileSeed[] {
  const deduped: DiscoverRemoteProfileSeed[] = []
  const seen = new Set<string>()

  items.forEach((item: DiscoverRemoteProfileSeed) => {
    const key = `${item.platform}:${item.username}`
    if (!item?.username || seen.has(key)) {
      return
    }
    seen.add(key)
    deduped.push(item)
  })

  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  return deduped.slice(0, safeLimit)
}

export function toDiscoverCandidateFromProfileSeed(
  seed: DiscoverRemoteProfileSeed,
  viewMapping: DiscoverRemoteViewMapping,
): DiscoverRemoteCandidateCompatible {
  const targetTitle = seed.title.trim()
  const displayTitle = targetTitle || `@${seed.username}`

  if (seed.platform === 'x') {
    return {
      targetUrl: `https://rsshub.pseudoyu.com/twitter/user/${encodeURIComponent(seed.username)}`,
      targetTitle: formatXFeedTitle(displayTitle, seed.username),
      targetView: viewMapping.x,
      description: normalizeSocialFeedDescription(
        seed.followers || 'X 用户',
        seed.profileUrl,
        seed.profileUrl,
      ),
      siteUrl: seed.profileUrl,
      sourceKind: 'X',
      imageUrl: seed.imageUrl,
    }
  }

  return {
    targetUrl: `https://rsshub.pseudoyu.com/instagram/user/${encodeURIComponent(seed.username)}`,
    targetTitle: formatInstagramFeedTitle(displayTitle, seed.username),
    targetView: viewMapping.instagram,
    description: normalizeSocialFeedDescription(
      seed.followers || 'Instagram 用户',
      seed.profileUrl,
      seed.profileUrl,
    ),
    siteUrl: seed.profileUrl,
    sourceKind: 'Instagram',
    imageUrl: seed.imageUrl,
  }
}
