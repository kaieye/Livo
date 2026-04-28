import {
  resolvePreferredStoredFeedImageUrl,
  resolveSocialFeedDisplayImageUrl,
} from './SocialFeedPresentation.ts'
import { canonicalFeedUrl } from './SocialFeedTitles.ts'

export interface DiscoverAvatarPresentationInput {
  imageUrl: string
  targetUrl: string
  siteUrl: string
  title: string
  cachedImageUrl?: string
  cachedSiteUrl?: string
  cachedTitle?: string
  cachedResolvedFeedUrl?: string
  hydratedImageUrl?: string
}

function pushUnique(values: string[], value: string): void {
  const trimmed = (value || '').trim()
  if (!trimmed || values.includes(trimmed)) {
    return
  }
  values.push(trimmed)
}

function rssHubRouteIdentity(value: string): string {
  const trimmed = (value || '').trim()
  const matched = trimmed.match(/^https?:\/\/[^/]*rsshub[^/]*\/(.+)$/i)
  if (!matched?.[1]) {
    return ''
  }

  const route = matched[1].replace(/^\/+/, '').replace(/\/+$/, '')
  return route ? `rsshub://${route.toLowerCase()}` : ''
}

function discoverAvatarTargetIdentities(
  targetUrl: string,
  siteUrl: string,
): string[] {
  const identities: string[] = []
  const trimmedTargetUrl = (targetUrl || '').trim()
  const canonicalUrl = canonicalFeedUrl(trimmedTargetUrl, siteUrl)

  pushUnique(identities, trimmedTargetUrl)
  pushUnique(identities, canonicalUrl)
  pushUnique(identities, rssHubRouteIdentity(trimmedTargetUrl))
  pushUnique(identities, rssHubRouteIdentity(canonicalUrl))
  return identities
}

export function discoverAvatarCacheKey(
  targetUrl: string,
  siteUrl: string,
): string {
  return `${targetUrl.trim()}|${siteUrl.trim()}`
}

export function discoverAvatarCacheKeys(
  targetUrl: string,
  siteUrl: string,
): string[] {
  const keys: string[] = []
  const targetIdentities = discoverAvatarTargetIdentities(targetUrl, siteUrl)
  const siteIdentities: string[] = []
  pushUnique(siteIdentities, siteUrl)
  siteIdentities.push('')

  targetIdentities.forEach((targetIdentity: string) => {
    siteIdentities.forEach((siteIdentity: string) => {
      pushUnique(keys, discoverAvatarCacheKey(targetIdentity, siteIdentity))
    })
  })
  return keys
}

export function isDiscoverAvatarPlaceholderUrl(imageUrl: string): boolean {
  const normalized = (imageUrl || '').trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    normalized.includes('google.com/s2/favicons') ||
    normalized.includes('icons.duckduckgo.com/ip3/') ||
    normalized.includes('/favicon') ||
    normalized.includes('/apple-touch-icon') ||
    normalized.includes('unavatar.io/')
  )
}

export function isDiscoverAvatarCacheableImageUrl(imageUrl: string): boolean {
  const normalized = (imageUrl || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  const googleRssHubFavicon =
    normalized.includes('google.com/s2/favicons') &&
    (normalized.includes('domain=rsshub') ||
      normalized.includes('domain=www.rsshub'))
  const duckDuckGoRssHubFavicon = normalized.includes(
    'icons.duckduckgo.com/ip3/rsshub',
  )
  const directRssHubFavicon =
    /^https?:\/\/[^/]*rsshub[^/]*\/(?:favicon|apple-touch-icon)/i.test(
      normalized,
    ) ||
    /^https?:\/\/[^/]*rsshub[^/]*\/.*\/(?:favicon|apple-touch-icon)/i.test(
      normalized,
    )
  const inferredPlatformAvatar = normalized.includes('unavatar.io/')

  return !(
    googleRssHubFavicon ||
    duckDuckGoRssHubFavicon ||
    directRssHubFavicon ||
    inferredPlatformAvatar
  )
}

export function resolveDiscoverAvatarImageUrl(
  input: DiscoverAvatarPresentationInput,
): string {
  const previewImageUrl = resolvePreferredStoredFeedImageUrl(
    input.imageUrl,
    input.cachedImageUrl || '',
  )
  const imageUrl = resolvePreferredStoredFeedImageUrl(
    previewImageUrl,
    input.hydratedImageUrl || '',
  )
  const targetUrl = (
    input.cachedResolvedFeedUrl ||
    input.targetUrl ||
    ''
  ).trim()
  const siteUrl = (input.cachedSiteUrl || input.siteUrl || '').trim()
  const title = (input.cachedTitle || input.title || '').trim()

  return resolveSocialFeedDisplayImageUrl(imageUrl, targetUrl, siteUrl, title)
}
