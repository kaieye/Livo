/**
 * SubscriptionsAvatarHydration — utilities for pre-resolving feed avatars
 * in the subscriptions list. Ported from Harmony's `SubscriptionsAvatarPolicy.ts`
 * and `DiscoverFeedIdentity.ets`.
 */

import type { FeedWithCount } from '../../../shared/types'

/** Maximum number of feeds to hydrate per page load (matches Harmony). */
export const SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT = 12

/** Gap between individual avatar resolutions to avoid rate-limiting. */
export const HYDRATION_GAP_MS = 180

function extractInstagramUsername(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const path = (u.pathname || '').toLowerCase()
    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return decodeURIComponent(ig[1]).replace(/^@/, '')
    const picnob = path.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, '')
    const pixnoy = path.match(/\/pixnoy\/user\/([^/?#]+)/i)
    if (pixnoy?.[1]) return decodeURIComponent(pixnoy[1]).replace(/^@/, '')
    const piokok = path.match(/\/piokok\/user\/([^/?#]+)/i)
    if (piokok?.[1]) return decodeURIComponent(piokok[1]).replace(/^@/, '')
  } catch {
    // Fall through.
  }
  const proto = raw.match(
    /^rsshub:\/\/(?:picnob(?:\.info)?|pixnoy|piokok|instagram)\/user\/([^/?#]+)/i,
  )
  if (proto?.[1]) return decodeURIComponent(proto[1]).replace(/^@/, '')
  return null
}

function extractXUsername(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const x = u.pathname.match(/\/(?:twitter|x)\/user\/([^/?#]+)/i)
    if (x?.[1]) return decodeURIComponent(x[1]).replace(/^@/, '')
  } catch {
    // Fall through.
  }
  const proto = raw.match(
    /^rsshub:\/\/.*(?:\/twitter\/user\/|\/x\/user\/)([^/?#]+)/i,
  )
  if (proto?.[1]) return decodeURIComponent(proto[1]).replace(/^@/, '')
  return null
}

function extractBilibiliUid(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const m = u.pathname.match(
      /\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    if (m?.[1]) return m[1]
  } catch {
    // Fall through.
  }
  const proto = raw.match(
    /^rsshub:\/\/.*\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
  )
  if (proto?.[1]) return proto[1]
  return null
}

function extractYouTubeIdentity(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const path = (u.pathname || '').toLowerCase()
    const channel = path.match(/\/youtube\/channel\/([^/?#]+)/i)
    if (channel?.[1]) return `channel:${channel[1]}`
    const handle = path.match(/\/youtube\/@([^/?#]+)/i)
    if (handle?.[1]) return `handle:${decodeURIComponent(handle[1])}`
    const user = path.match(/\/youtube\/user\/([^/?#]+)/i)
    if (user?.[1]) return `user:${decodeURIComponent(user[1])}`
  } catch {
    // Fall through.
  }
  const protoChannel = raw.match(/^rsshub:\/\/.*\/youtube\/channel\/([^/?#]+)/i)
  if (protoChannel?.[1]) return `channel:${protoChannel[1]}`
  const protoHandle = raw.match(/^rsshub:\/\/.*\/youtube\/@([^/?#]+)/i)
  if (protoHandle?.[1]) return `handle:${decodeURIComponent(protoHandle[1])}`
  return null
}

/**
 * Check if a feed is a candidate for avatar hydration (matches a social
 * platform whose avatar can be resolved).
 */
export function isSubscriptionFeedAvatarHydratable(
  feed: Pick<FeedWithCount, 'url' | 'siteUrl'>,
): boolean {
  const feedUrl = feed.url || ''
  const siteUrl = feed.siteUrl || ''

  return (
    extractInstagramUsername(feedUrl) !== null ||
    extractInstagramUsername(siteUrl) !== null ||
    extractXUsername(feedUrl) !== null ||
    extractXUsername(siteUrl) !== null ||
    extractBilibiliUid(feedUrl) !== null ||
    extractBilibiliUid(siteUrl) !== null ||
    extractYouTubeIdentity(feedUrl) !== null ||
    extractYouTubeIdentity(siteUrl) !== null
  )
}

/**
 * Build platform-avatar candidate URLs for a feed in the subscriptions list.
 * These are unavatar.io URLs used when the main process can't resolve a
 * higher-quality avatar.
 */
export function buildSubscriptionPlatformAvatarCandidates(
  feedUrl: string,
  siteUrl: string,
): string[] {
  const candidates: string[] = []

  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (instagramUsername) {
    candidates.push(
      `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`,
    )
  }

  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  if (xUsername) {
    candidates.push(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
  }

  const bilibiliUid = extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
  if (bilibiliUid) {
    candidates.push(
      `https://unavatar.io/bilibili/${encodeURIComponent(bilibiliUid)}?fallback=false`,
    )
  }

  const ytIdentity =
    extractYouTubeIdentity(feedUrl) || extractYouTubeIdentity(siteUrl)
  if (ytIdentity) {
    if (ytIdentity.startsWith('channel:')) {
      candidates.push(
        `https://unavatar.io/youtube/${encodeURIComponent(ytIdentity.replace(/^channel:/, ''))}?fallback=false`,
      )
    } else if (ytIdentity.startsWith('handle:')) {
      candidates.push(
        `https://unavatar.io/youtube/${encodeURIComponent(ytIdentity.replace(/^handle:/, ''))}?fallback=false`,
      )
    } else if (ytIdentity.startsWith('user:')) {
      candidates.push(
        `https://unavatar.io/youtube/${encodeURIComponent(ytIdentity.replace(/^user:/, ''))}?fallback=false`,
      )
    }
  }

  return candidates
}

/**
 * Score a stored feed image URL: higher = better quality.
 * 0 = empty, 1 = generic (favicon), 2 = unavatar, 3 = specific image.
 */
export function scoreStoredFeedImage(imageUrl: string): number {
  const raw = (imageUrl || '').trim()
  if (!raw) return 0
  const lower = raw.toLowerCase()
  if (lower.includes('favicon')) return 1
  if (lower.includes('unavatar.io')) return 2
  return 3
}
