import {
  extractInstagramUsername,
  extractXUsername,
} from '../../utils/social/SocialFeedTitles'
import { resolveSocialFeedDisplayImageUrl } from '../../utils/social/SocialFeedPresentation'

export interface SubscriptionAvatarFeedRef {
  url: string
  siteUrl: string
  imageUrl: string
  title: string
}

export function normalizeSubscriptionFeedSiteUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/\/+/, '')}`
  }
  return trimmed
}

export function deriveSubscriptionFallbackIcon(siteUrl: string): string {
  const trimmed = siteUrl.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const withoutProtocol = trimmed.replace(/^https?:\/\//, '')
    const host = withoutProtocol.split('/')[0]
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
  } catch (_) {
    return ''
  }
}

export function extractSubscriptionBilibiliUid(value: string): string {
  const matched = (value || '')
    .trim()
    .match(
      /\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i,
    )
  return matched?.[1]?.trim() || ''
}

export function extractSubscriptionYouTubeIdentity(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }

  const identity =
    trimmed.match(/[?&]channel_id=([^&]+)/i)?.[1] ||
    trimmed.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1] ||
    trimmed.match(/\/channel\/([^/?#]+)/i)?.[1] ||
    trimmed.match(/\/youtube\/user\/(@?[^/?#]+)/i)?.[1] ||
    trimmed.match(/\/@([^/?#]+)/i)?.[1] ||
    trimmed.match(/youtube\.com\/(?:user|c)\/([^/?#]+)/i)?.[1]

  return identity
    ? decodeURIComponent(identity).trim().replace(/^@+/, '').toLowerCase()
    : ''
}

export function isSubscriptionFeedAvatarHydratable(
  feedUrl: string,
  siteUrl: string,
): boolean {
  const primaryUrl = normalizeSubscriptionFeedSiteUrl(feedUrl)
  const secondaryUrl = normalizeSubscriptionFeedSiteUrl(siteUrl)
  return (
    !!(extractXUsername(primaryUrl) || extractXUsername(secondaryUrl)) ||
    !!(
      extractInstagramUsername(primaryUrl) ||
      extractInstagramUsername(secondaryUrl)
    ) ||
    !!(
      extractSubscriptionYouTubeIdentity(primaryUrl) ||
      extractSubscriptionYouTubeIdentity(secondaryUrl)
    ) ||
    !!(
      extractSubscriptionBilibiliUid(primaryUrl) ||
      extractSubscriptionBilibiliUid(secondaryUrl)
    )
  )
}

export function buildSubscriptionPlatformAvatarCandidates(
  feedUrl: string,
  siteUrl: string,
): string[] {
  const result: string[] = []
  const push = (value: string): void => {
    const trimmed = (value || '').trim()
    if (!trimmed || result.includes(trimmed)) {
      return
    }
    result.push(trimmed)
  }

  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  if (xUsername) {
    push(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
  }

  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (instagramUsername) {
    push(
      `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`,
    )
  }

  const youTubeIdentity =
    extractSubscriptionYouTubeIdentity(feedUrl) ||
    extractSubscriptionYouTubeIdentity(siteUrl)
  if (youTubeIdentity) {
    push(
      `https://unavatar.io/youtube/${encodeURIComponent(youTubeIdentity)}?fallback=false`,
    )
  }

  const bilibiliUid =
    extractSubscriptionBilibiliUid(feedUrl) ||
    extractSubscriptionBilibiliUid(siteUrl)
  if (bilibiliUid) {
    push(
      `https://unavatar.io/bilibili/${encodeURIComponent(bilibiliUid)}?fallback=false`,
    )
  }

  return result
}

export function resolveSubscriptionFeedIconSource(
  feed: SubscriptionAvatarFeedRef | undefined,
): string {
  if (!feed) {
    return ''
  }

  const normalizedFeedUrl = normalizeSubscriptionFeedSiteUrl(feed.url)
  const normalizedSiteUrl = normalizeSubscriptionFeedSiteUrl(feed.siteUrl)

  const resolved = resolveSocialFeedDisplayImageUrl(
    feed.imageUrl,
    normalizedFeedUrl,
    normalizedSiteUrl,
    feed.title,
  )
  if (resolved.trim().length > 0) {
    return resolved.trim()
  }

  return deriveSubscriptionFallbackIcon(normalizedSiteUrl)
}

export function buildSubscriptionFeedIconCandidates(
  feed: SubscriptionAvatarFeedRef | undefined,
): string[] {
  if (!feed) {
    return []
  }

  const candidates: string[] = []
  const pushCandidate = (value: string): void => {
    const trimmed = (value || '').trim()
    if (!trimmed || candidates.includes(trimmed)) {
      return
    }
    candidates.push(trimmed)
  }

  const normalizedSiteUrl = normalizeSubscriptionFeedSiteUrl(feed.siteUrl)
  const normalizedFeedUrl = normalizeSubscriptionFeedSiteUrl(feed.url)
  pushCandidate(resolveSubscriptionFeedIconSource(feed))
  buildSubscriptionPlatformAvatarCandidates(
    normalizedFeedUrl,
    normalizedSiteUrl,
  ).forEach((url: string) => pushCandidate(url))

  const hostSource = (normalizedSiteUrl || normalizedFeedUrl || '').trim()
  const host = hostSource
    ? hostSource
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .replace(/^www\./i, '')
    : ''

  if (host) {
    pushCandidate(`https://icons.duckduckgo.com/ip3/${host}.ico`)
    pushCandidate(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    )
    pushCandidate(`https://${host}/favicon.ico`)
    pushCandidate(`https://www.${host}/favicon.ico`)
  }

  return candidates
}
