import { FeedViewType } from '../../../shared/types/index'
import {
  isInstagramFeedUrl as isInstagramKeywordUrl,
  isInstagramUserFeedUrl as isInstagramUserRouteUrl,
} from '../../../shared/url-detect'

/**
 * Single source of truth for feed-route classification and the per-route
 * refresh policy (timeouts, slow-feed weighting, bootstrap deferral).
 *
 * Instagram detection already lives in shared/url-detect; this module finishes
 * the consolidation for Bilibili / Twitter routes so the same predicate that
 * decides "is this a slow social feed" is not copy-pasted across feed-refresh.
 */

const TWITTER_USER_ROUTE_RE = /\/(?:twitter|x)\/user\//i
const BILIBILI_DYNAMIC_ROUTE_RE = /\/bilibili\/user\/dynamic\//i
const BILIBILI_VIDEO_ROUTE_RE = /\/bilibili\/user\/video\//i
const BILIBILI_USER_ROUTE_RE = /\/bilibili\/user\/(?:dynamic|video|article)\//i

// Default refresh timeout for ordinary feeds (overridden per slow route below).
export const DEFAULT_FEED_REFRESH_TIMEOUT_MS = 12000

export type FeedRouteKind =
  | 'instagram-user'
  | 'bilibili-dynamic'
  | 'bilibili-video'
  | 'twitter-user'
  | 'generic'

interface FeedRoutePolicy {
  refreshTimeoutMs: number
  initialFetchTimeoutMs?: number
  bootstrapRefreshTimeoutMs?: number
  slow: boolean
  deferBootstrap: boolean
}

const SOCIAL_INITIAL_FETCH_TIMEOUT_MS = 18000
const SOCIAL_BOOTSTRAP_REFRESH_TIMEOUT_MS = 45000
const VIDEO_INITIAL_FETCH_TIMEOUT_MS = 45000
const VIDEO_BOOTSTRAP_REFRESH_TIMEOUT_MS = 120000
const DEFAULT_INITIAL_FETCH_TIMEOUT_MS = 6000
const DEFAULT_BOOTSTRAP_REFRESH_TIMEOUT_MS = 18000

const ROUTE_POLICIES = {
  'instagram-user': {
    refreshTimeoutMs: 40000,
    initialFetchTimeoutMs: SOCIAL_INITIAL_FETCH_TIMEOUT_MS,
    bootstrapRefreshTimeoutMs: SOCIAL_BOOTSTRAP_REFRESH_TIMEOUT_MS,
    slow: true,
    deferBootstrap: true,
  },
  'bilibili-dynamic': {
    refreshTimeoutMs: 40000,
    initialFetchTimeoutMs: SOCIAL_INITIAL_FETCH_TIMEOUT_MS,
    bootstrapRefreshTimeoutMs: SOCIAL_BOOTSTRAP_REFRESH_TIMEOUT_MS,
    slow: true,
    deferBootstrap: true,
  },
  'bilibili-video': {
    refreshTimeoutMs: 120000,
    initialFetchTimeoutMs: VIDEO_INITIAL_FETCH_TIMEOUT_MS,
    bootstrapRefreshTimeoutMs: VIDEO_BOOTSTRAP_REFRESH_TIMEOUT_MS,
    slow: true,
    deferBootstrap: false,
  },
  'twitter-user': {
    refreshTimeoutMs: DEFAULT_FEED_REFRESH_TIMEOUT_MS,
    initialFetchTimeoutMs: SOCIAL_INITIAL_FETCH_TIMEOUT_MS,
    bootstrapRefreshTimeoutMs: SOCIAL_BOOTSTRAP_REFRESH_TIMEOUT_MS,
    slow: false,
    deferBootstrap: true,
  },
  generic: {
    refreshTimeoutMs: DEFAULT_FEED_REFRESH_TIMEOUT_MS,
    slow: false,
    deferBootstrap: false,
  },
} as const satisfies Record<FeedRouteKind, FeedRoutePolicy>

function lower(url: string | undefined): string {
  return (url || '').toLowerCase()
}

/** Broad keyword match (instagram or any mirror site) — used for avatar policy. */
export function isInstagramKeywordFeedUrl(url: string | undefined): boolean {
  return isInstagramKeywordUrl(url || '')
}

export function classifyFeedRoute(url: string | undefined): FeedRouteKind {
  if (isInstagramUserFeedUrl(url)) return 'instagram-user'
  if (isBilibiliDynamicFeedUrl(url)) return 'bilibili-dynamic'
  if (isBilibiliVideoFeedUrl(url)) return 'bilibili-video'
  if (isTwitterUserFeedUrl(url)) return 'twitter-user'
  return 'generic'
}

export function getFeedRoutePolicy(url: string | undefined): FeedRoutePolicy {
  return ROUTE_POLICIES[classifyFeedRoute(url)]
}

/** Instagram user-route feed (/instagram/user/, /picnob/user/, ...). */
export function isInstagramUserFeedUrl(url: string | undefined): boolean {
  return isInstagramUserRouteUrl(url || '')
}

export function isTwitterUserFeedUrl(url: string | undefined): boolean {
  return TWITTER_USER_ROUTE_RE.test(lower(url))
}

export function isBilibiliDynamicFeedUrl(url: string | undefined): boolean {
  return BILIBILI_DYNAMIC_ROUTE_RE.test(lower(url))
}

export function isBilibiliVideoFeedUrl(url: string | undefined): boolean {
  return BILIBILI_VIDEO_ROUTE_RE.test(lower(url))
}

/** Any Bilibili user feed route (dynamic / video / article). */
export function isBilibiliUserFeedUrl(url: string | undefined): boolean {
  return BILIBILI_USER_ROUTE_RE.test(lower(url))
}

/**
 * Slow upstreams that need lower concurrency and refresh-order de-prioritization.
 */
export function isSlowFeedUrl(url: string | undefined): boolean {
  return getFeedRoutePolicy(url).slow
}

/** Social user routes (Twitter / Instagram / Bilibili dynamic). */
function isSocialUserRouteUrl(url: string | undefined): boolean {
  return getFeedRoutePolicy(url).deferBootstrap
}

/** Social-like feed by URL route or declared view type. */
function isSocialLikeFeed(
  url: string | undefined,
  view?: FeedViewType,
): boolean {
  return (
    isSocialUserRouteUrl(url) ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  )
}

/** Video-like feed by URL route or declared view type. */
function isVideoLikeFeed(
  url: string | undefined,
  view?: FeedViewType,
): boolean {
  return isBilibiliVideoFeedUrl(url) || view === FeedViewType.Videos
}

/**
 * Per-feed refresh timeout. Instagram fans out across many RSSHub candidates and
 * Bilibili video fallbacks use a serialized hidden-window scraper, so both need a
 * wider budget than ordinary feeds.
 */
export function getRefreshTimeoutMs(url: string | undefined): number {
  return getFeedRoutePolicy(url).refreshTimeoutMs
}

/** Timeout budget for the very first fetch when subscribing. */
export function getInitialFetchTimeoutMs(
  url: string,
  view?: FeedViewType,
): number {
  const policy = getFeedRoutePolicy(url)
  if (isSocialLikeFeed(url, view)) {
    return policy.initialFetchTimeoutMs ?? SOCIAL_INITIAL_FETCH_TIMEOUT_MS
  }
  if (isVideoLikeFeed(url, view)) {
    return policy.initialFetchTimeoutMs ?? VIDEO_INITIAL_FETCH_TIMEOUT_MS
  }
  return DEFAULT_INITIAL_FETCH_TIMEOUT_MS
}

/** Timeout budget for bootstrap (post-subscribe priming) refreshes. */
export function getBootstrapRefreshTimeoutMs(
  url: string,
  view?: FeedViewType,
): number {
  const policy = getFeedRoutePolicy(url)
  if (isSocialLikeFeed(url, view)) {
    return (
      policy.bootstrapRefreshTimeoutMs ?? SOCIAL_BOOTSTRAP_REFRESH_TIMEOUT_MS
    )
  }
  if (isVideoLikeFeed(url, view)) {
    return (
      policy.bootstrapRefreshTimeoutMs ?? VIDEO_BOOTSTRAP_REFRESH_TIMEOUT_MS
    )
  }
  return DEFAULT_BOOTSTRAP_REFRESH_TIMEOUT_MS
}

/** Whether subscription should defer bootstrap to the background queue. */
export function shouldDeferBootstrap(
  url: string,
  view?: FeedViewType,
): boolean {
  return (
    getFeedRoutePolicy(url).deferBootstrap ||
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures
  )
}
