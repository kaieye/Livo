import { FeedViewType } from './types'
import type { Feed } from './types'
import { resolveProfileUrlToCandidates } from './profile-resolver'
import { detectBilibiliFeedViewFromUrl } from './bilibili-feed-url'

// ── View inference from URL ──────────────────────────────────────────────────

export function inferDiscoverFeedViewFromUrl(targetUrl: string): FeedViewType {
  const lower = (targetUrl || '').toLowerCase()
  if (/\/(?:twitter|x)\/user\//i.test(lower)) return FeedViewType.SocialMedia

  const bilibiliView = detectBilibiliFeedViewFromUrl(lower)
  if (bilibiliView !== null) return bilibiliView

  if (/\/youtube\//i.test(lower)) return FeedViewType.Videos
  if (
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\//i.test(lower) ||
    /\/imginn\//i.test(lower)
  ) {
    return FeedViewType.Pictures
  }

  return FeedViewType.Articles
}

// ── URL canonicalization ─────────────────────────────────────────────────────

export function canonicalizeDiscoverRoute(inputUrl: string): string {
  const raw = (inputUrl || '').trim()
  if (!raw) return ''

  let routeWithQuery = ''
  const rsshubMatch = raw.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    routeWithQuery = rsshubMatch[1].replace(/^\/+/, '')
  } else {
    try {
      const parsed = new URL(raw)
      routeWithQuery = `${parsed.pathname.replace(/^\/+/, '')}${parsed.search || ''}`
    } catch {
      return raw.toLowerCase()
    }
  }

  const [pathPart = '', queryPart = ''] = routeWithQuery.split('?', 2)
  let path = pathPart.toLowerCase()
  path = path.replace(
    /^(picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\//i,
    'instagram/user/',
  )
  path = path.replace(
    /^(?:x|twitter)\/user\/([^/?#]+)/i,
    (_match, user: string) =>
      `twitter/user/${decodeURIComponent(user).replace(/^@/, '').toLowerCase()}`,
  )

  if (/^instagram\/user\//i.test(path) || /^twitter\/user\//i.test(path)) {
    const search = new URLSearchParams(queryPart || '')
    search.delete('limit')
    const query = search.toString()
    return `${path}${query ? `?${query}` : ''}`
  }
  return `${path}${queryPart ? `?${queryPart}` : ''}`
}

// ── Instagram username extraction ────────────────────────────────────────────

function extractPathFromFeedUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol.toLowerCase() === 'rsshub:') {
      return `/${parsed.hostname}${parsed.pathname}`
    }
    return parsed.pathname
  } catch {
    return rawUrl
  }
}

export function extractInstagramUsername(feedUrl: string): string | null {
  const path = extractPathFromFeedUrl(feedUrl)
  const match = path.match(
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\/([^/?#]+)/i,
  )
  return match?.[1] ? decodeURIComponent(match[1]).replace(/^@/, '') : null
}

// ── Existing feed lookup ─────────────────────────────────────────────────────

function normalizeForMatch(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

export function findExistingFeed<
  T extends Pick<Feed, 'url' | 'siteUrl' | 'category' | 'view'>,
>(feeds: T[], targetUrl: string, targetSiteUrl?: string): T | undefined {
  const candidates = [
    targetUrl,
    targetSiteUrl || '',
    canonicalizeDiscoverRoute(targetUrl),
    canonicalizeDiscoverRoute(targetSiteUrl || ''),
  ]
    .map(normalizeForMatch)
    .filter(Boolean)

  // Exact URL / canonical route match
  const matched = feeds.find((f) => {
    if (f.category === 'Recommended') return false
    const feedUrls = [f.url, f.siteUrl || '']
      .map(normalizeForMatch)
      .filter(Boolean)
    return feedUrls.some((fu) => candidates.includes(fu))
  })
  if (matched) return matched

  // Instagram username fallback: different RSSHub instance, same user
  const targetUsername = extractInstagramUsername(targetUrl)
  if (!targetUsername) return undefined
  const targetLower = targetUsername.toLowerCase()
  return feeds.find((f) => {
    if (f.category === 'Recommended') return false
    const user = extractInstagramUsername(f.url)
    return !!user && user.toLowerCase() === targetLower
  })
}

// ── Subscription target resolution ───────────────────────────────────────────

export interface SubscriptionTarget {
  feedUrl: string
  title: string
  view: FeedViewType
  urlCandidates: string[]
}

export interface ResolvedSubscription {
  target: SubscriptionTarget
  existingFeed?: Feed
}

/**
 * Pick the best candidate from profile resolution results.
 * Exported so renderer can reuse after async IPC resolution.
 */
export function pickBestCandidate(
  candidates: Array<{
    feedUrl: string
    title: string
    view?: FeedViewType | number
  }>,
  preferredView?: FeedViewType,
):
  | { feedUrl: string; title: string; view?: FeedViewType | number }
  | undefined {
  if (candidates.length === 0) return undefined
  if (preferredView != null) {
    return candidates.find((c) => c.view === preferredView) ?? candidates[0]
  }
  return candidates[0]
}

export function resolveSubscriptionTarget(
  input: string,
  options: {
    feeds?: Feed[]
    rsshubInstance: string
    preferredView?: FeedViewType
    /** Pre-resolved candidates from profile resolver (renderer passes IPC results). */
    resolvedCandidates?: Array<{
      feedUrl: string
      title: string
      view?: FeedViewType | number
    }>
  },
): ResolvedSubscription {
  const {
    feeds = [],
    rsshubInstance,
    preferredView,
    resolvedCandidates,
  } = options

  // Normalize rsshub:// to full URL
  let normalizedInput = input.trim()
  const rsshubMatch = normalizedInput.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const path = rsshubMatch[1].replace(/^\/+/, '')
    normalizedInput = `${rsshubInstance.replace(/\/+$/, '')}/${path}`
  }

  // Resolve profile URL → candidates
  let feedUrl = normalizedInput
  let title = ''
  let view = preferredView ?? inferDiscoverFeedViewFromUrl(normalizedInput)
  const urlCandidates: string[] = [normalizedInput]

  const candidates =
    resolvedCandidates ??
    (() => {
      try {
        return resolveProfileUrlToCandidates(normalizedInput, rsshubInstance)
          .candidates
      } catch {
        return []
      }
    })()

  if (candidates.length > 0) {
    const best = pickBestCandidate(candidates, preferredView)
    if (best) {
      feedUrl = best.feedUrl
      title = best.title
      if (typeof best.view === 'number') {
        view = best.view as FeedViewType
      }
      urlCandidates.push(...candidates.map((c) => c.feedUrl))
    }
  }

  const existingFeed = findExistingFeed(feeds, feedUrl, undefined)

  return {
    target: { feedUrl, title, view, urlCandidates },
    existingFeed: existingFeed as Feed | undefined,
  }
}

// ── Warmup strategy ──────────────────────────────────────────────────────────

export type WarmupStrategy =
  | 'sync-bootstrap'
  | 'deferred-queue'
  | 'social-bg-refresh'

export function getWarmupStrategy(
  feedUrl: string,
  view: FeedViewType,
): WarmupStrategy {
  if (
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures ||
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox|twitter|x)\/user\//i.test(
      feedUrl,
    )
  ) {
    return 'deferred-queue'
  }
  return 'sync-bootstrap'
}

/**
 * Should the renderer skip the immediate entry recount + cache warmup
 * after subscribing and instead run a multi-round background refresh?
 */
export function shouldUseSocialBackgroundRefresh(
  feedUrl: string,
  view: FeedViewType,
): boolean {
  return (
    view === FeedViewType.SocialMedia ||
    view === FeedViewType.Pictures ||
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox|twitter|x)\/user\//i.test(
      feedUrl,
    )
  )
}
