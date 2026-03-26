import {
  FeedViewType,
  type AccountProvider,
  type ResolvedProfileFeedCandidate,
  type ResolvedProfileUrlResult,
} from '@livo/models'
import {
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
} from '../main/services/rsshub-url'

function normalizeBaseUrl(input: string): URL | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const candidate =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`
  try {
    return new URL(candidate)
  } catch {
    return null
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function firstPathSegment(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? ''
}

function pushCandidate(
  candidates: ResolvedProfileFeedCandidate[],
  feedUrl: string,
  title: string,
  options?: {
    source?: 'rss' | 'rsshub' | 'derived'
    siteUrl?: string
    description?: string
    view?: FeedViewType
    requiresAccount?: AccountProvider[]
    note?: string
  },
): void {
  if (!feedUrl) return
  if (candidates.some((x) => x.feedUrl === feedUrl)) return
  candidates.push({
    feedUrl,
    title,
    source: options?.source ?? 'derived',
    siteUrl: options?.siteUrl,
    description: options?.description,
    view: options?.view,
    requiresAccount: options?.requiresAccount,
    note: options?.note,
  })
}

const RESERVED_USER_NAMES = new Set([
  'home',
  'explore',
  'search',
  'i',
  'messages',
  'settings',
  'compose',
  'notifications',
  'login',
  'signup',
  'tos',
  'privacy',
  'about',
  'intent',
  'hashtag',
])

export function resolveProfileUrlToCandidates(
  inputUrl: string,
  rsshubInstance: string,
): ResolvedProfileUrlResult {
  const url = normalizeBaseUrl(inputUrl)
  if (!url) {
    return {
      matched: false,
      inputUrl,
      normalizedUrl: null,
      platform: null,
      candidates: [],
      reason: 'invalid_url',
    }
  }

  const normalizedUrl = url.toString()
  const host = normalizeHost(url.hostname)
  const rsshub = rsshubInstance.replace(/\/+$/, '')
  const candidates: ResolvedProfileFeedCandidate[] = []
  let platform: ResolvedProfileUrlResult['platform'] = null

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be'
  ) {
    platform = 'youtube'
    const segment = firstPathSegment(url.pathname)
    const second = url.pathname.split('/').filter(Boolean)[1] ?? ''

    if (segment === 'channel' && second.startsWith('UC')) {
      pushCandidate(
        candidates,
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(second)}`,
        `YouTube ${second}`,
        {
          source: 'rss',
          siteUrl: normalizedUrl,
          description: 'Official YouTube channel RSS',
          view: FeedViewType.Videos,
          requiresAccount: ['youtube'],
        },
      )
      pushCandidate(
        candidates,
        `${rsshub}/youtube/channel/${encodeURIComponent(second)}`,
        `YouTube ${second}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub YouTube channel route',
          view: FeedViewType.Videos,
          requiresAccount: ['youtube'],
        },
      )
    } else if (segment === '@' || segment.startsWith('@')) {
      const handle = segment === '@' ? second : segment.slice(1)
      if (handle) {
        pushCandidate(
          candidates,
          `${rsshub}/youtube/user/@${encodeURIComponent(handle)}`,
          `YouTube @${handle}`,
          {
            source: 'rsshub',
            siteUrl: normalizedUrl,
            description: 'RSSHub YouTube handle route',
            view: FeedViewType.Videos,
            requiresAccount: ['youtube'],
          },
        )
      }
    } else if ((segment === 'user' || segment === 'c') && second) {
      pushCandidate(
        candidates,
        `${rsshub}/youtube/user/${encodeURIComponent(second)}`,
        `YouTube ${second}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub YouTube user route',
          view: FeedViewType.Videos,
          requiresAccount: ['youtube'],
        },
      )
    }
  } else if (host === 'x.com' || host === 'twitter.com') {
    platform = 'x'
    const username = firstPathSegment(url.pathname).replace(/^@/, '')
    const usernameLower = username.toLowerCase()
    if (usernameLower && !RESERVED_USER_NAMES.has(usernameLower)) {
      pushCandidate(
        candidates,
        ensureTwitterUserFeedLimit(
          `${rsshub}/x/user/${encodeURIComponent(usernameLower)}`,
          120,
        ),
        `@${username}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub X/Twitter user route',
          view: FeedViewType.SocialMedia,
        },
      )
    }
  } else if (host === 'instagram.com') {
    platform = 'instagram'
    const username = firstPathSegment(url.pathname).replace(/^@/, '')
    if (username) {
      const igRoute = `${rsshub}/instagram/user/${encodeURIComponent(username)}`
      pushCandidate(
        candidates,
        ensureInstagramUserFeedLimit(igRoute, 100),
        `@${username}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub Instagram user route',
          view: FeedViewType.Pictures,
          note: 'instagram_carousel_tip',
        },
      )
    }
  } else if (host === 'space.bilibili.com') {
    platform = 'bilibili'
    const uid = firstPathSegment(url.pathname)
    if (/^\d+$/.test(uid)) {
      pushCandidate(
        candidates,
        `${rsshub}/bilibili/user/video/${uid}`,
        `Bilibili ${uid}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub Bilibili video route',
          view: FeedViewType.Videos,
        },
      )
      pushCandidate(
        candidates,
        `${rsshub}/bilibili/user/dynamic/${uid}`,
        `Bilibili ${uid}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub Bilibili dynamic route',
          view: FeedViewType.SocialMedia,
        },
      )
    }
  } else if (host === 'github.com') {
    platform = 'github'
    const user = firstPathSegment(url.pathname)
    if (user) {
      pushCandidate(
        candidates,
        `${rsshub}/github/user/${encodeURIComponent(user)}`,
        `GitHub ${user}`,
        {
          source: 'rsshub',
          siteUrl: normalizedUrl,
          description: 'RSSHub GitHub user route',
          view: FeedViewType.Articles,
        },
      )
    }
  }

  return {
    matched: candidates.length > 0,
    inputUrl,
    normalizedUrl,
    platform,
    candidates,
    reason: candidates.length > 0 ? null : 'no_supported_profile_pattern',
  }
}
