import { Feed } from '../../models/LivoModels'
import { RecommendedFeed, ResolvedDiscoverCandidate } from '../../services/discover/DiscoverTypes'
import { extractInstagramUsername, extractXUsername } from '../social/SocialFeedTitles'

export function normalizeFeedIdentity(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  return normalized
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
}

function pushIdentityKey(keys: string[], value: string): void {
  const trimmed = value.trim()
  if (!trimmed || keys.includes(trimmed)) {
    return
  }
  keys.push(trimmed)
}

export function extractBilibiliIdentity(value: string): string {
  const matched = value.match(/\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i)
  return matched?.[1]?.trim() ? `bilibili:${matched[1].trim()}` : ''
}

export function extractYouTubeIdentity(value: string): string {
  const channelId = value.match(/[?&]channel_id=([^&]+)/i)?.[1]
    || value.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1]
    || value.match(/\/channel\/([^/?#]+)/i)?.[1]
  if (channelId?.trim()) {
    return `youtube:channel:${decodeURIComponent(channelId).trim().toLowerCase()}`
  }

  const handle = value.match(/\/youtube\/user\/(@[^/?#]+)/i)?.[1]
    || value.match(/\/(@[^/?#]+)/i)?.[1]
  if (handle?.trim()) {
    return `youtube:handle:${decodeURIComponent(handle).trim().replace(/^@/, '').toLowerCase()}`
  }

  const user = value.match(/\/youtube\/user\/([^/?#]+)/i)?.[1]
    || value.match(/\/(?:user|c)\/([^/?#]+)/i)?.[1]
  if (user?.trim()) {
    return `youtube:user:${decodeURIComponent(user).trim().toLowerCase()}`
  }

  return ''
}

function extractCanonicalFeedIdentity(primaryUrl: string, secondaryUrl: string): string {
  const xUsername = extractXUsername(primaryUrl) || extractXUsername(secondaryUrl)
  if (xUsername) {
    return `x:${xUsername}`
  }

  const instagramUsername = extractInstagramUsername(primaryUrl) || extractInstagramUsername(secondaryUrl)
  if (instagramUsername) {
    return `instagram:${instagramUsername}`
  }

  const bilibiliIdentity = extractBilibiliIdentity(primaryUrl) || extractBilibiliIdentity(secondaryUrl)
  if (bilibiliIdentity) {
    return bilibiliIdentity
  }

  const youTubeIdentity = extractYouTubeIdentity(primaryUrl) || extractYouTubeIdentity(secondaryUrl)
  if (youTubeIdentity) {
    return youTubeIdentity
  }

  return ''
}

function collectFeedIdentityKeys(url: string, siteUrl: string, title: string): string[] {
  const keys: string[] = []
  const normalizedUrl = normalizeFeedIdentity(url)
  const normalizedSiteUrl = normalizeFeedIdentity(siteUrl)
  const normalizedTitle = title.trim().toLowerCase()
  const canonicalIdentity = extractCanonicalFeedIdentity(url, siteUrl)

  pushIdentityKey(keys, normalizedUrl)
  pushIdentityKey(keys, normalizedSiteUrl)
  pushIdentityKey(keys, canonicalIdentity)
  pushIdentityKey(keys, normalizedTitle)

  return keys
}

function identityKeysOverlap(left: string[], right: string[]): boolean {
  for (const leftKey of left) {
    if (leftKey && right.includes(leftKey)) {
      return true
    }
  }
  return false
}

// 社交平台订阅源常有多种 RSSHub / 原站 URL 形态，这里集中做 canonical identity 匹配。
export function isSubscribedFeedIdentity(
  subscribedFeeds: Feed[],
  url: string,
  siteUrl: string,
  title: string,
): boolean {
  const candidateKeys = collectFeedIdentityKeys(url, siteUrl, title)

  for (const subscribedFeed of subscribedFeeds) {
    const subscribedKeys = collectFeedIdentityKeys(
      subscribedFeed.url,
      subscribedFeed.siteUrl ?? '',
      subscribedFeed.title,
    )

    if (identityKeysOverlap(candidateKeys, subscribedKeys)) {
      return true
    }

    const subscribedUrl = normalizeFeedIdentity(subscribedFeed.url)
    const subscribedSiteUrl = normalizeFeedIdentity(subscribedFeed.siteUrl ?? '')
    if (
      (candidateKeys.includes(subscribedUrl) && !!subscribedUrl)
      || (candidateKeys.includes(subscribedSiteUrl) && !!subscribedSiteUrl)
    ) {
      return true
    }
  }

  return false
}

export function isSubscribedRecommendedFeed(subscribedFeeds: Feed[], feed: RecommendedFeed): boolean {
  return isSubscribedFeedIdentity(subscribedFeeds, feed.url, feed.siteUrl, feed.title)
}

export function isSubscribedCandidate(subscribedFeeds: Feed[], candidate: ResolvedDiscoverCandidate): boolean {
  return isSubscribedFeedIdentity(subscribedFeeds, candidate.targetUrl, candidate.siteUrl, candidate.targetTitle)
}
