import {
  DISCOVER_CATEGORIES,
  CURATED_FEEDS,
  RSSHUB_ROUTES,
  DEFAULT_RSSHUB_INSTANCE,
} from '../../shared/discover-data'
import {
  extractBilibiliUid,
  extractTwitterDisplayNameFromText,
  FALLBACK_RSSHUB_INSTANCES,
} from '../../shared/discover-helpers'
import { IPC } from '../../shared/types'
import type {
  DiscoverFeedPreviewResult,
  ResolvedProfileFeedCandidate,
} from '../../shared/types'
import { resolveProfileUrlToCandidates } from '../../shared/profile-resolver'
import { registerChannel } from '../ipc/register-channel'
import {
  discoverSearch,
  probeVideoSourcesByKeyword,
  type DiscoverSearchPlatform,
} from '../services/discovery/discover-search'
import { previewDiscoverFeed } from '../services/discovery/discover-preview'
import { fetchAndParseFeed } from '../services/feed/rss-parser'
import { formatFeedTitle } from '../services/feed/feed-title'
import { getFeedImageUrl } from '../services/feed/feed-utils'
import { settingsProvider } from '../services/system/settings-provider'
import { getYouTubeAccountState } from '../services/account/account-session'
import { resolveYouTubeProfileToOfficialFeed } from '../services/discovery/youtube-profile-resolver'
import {
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from '../services/feed/rsshub-url'
import { resolveFeedAvatar } from '../services/feed/feed-avatar'
import { looksLikeYouTubeChannelId } from '../services/discovery/discover-youtube'
import {
  fetchXDisplayNameByUsername,
  FALLBACK_NITTER_INSTANCES,
} from '../services/discovery/discover-x'
import {
  fetchBilibiliNameByUid,
  fetchBilibiliAvatarByUid,
  probeBilibiliUsersByKeyword,
} from '../services/discovery/discover-bilibili'
import { fetchInstagramAvatarByUsername } from '../services/discovery/discover-instagram-search'

/** Return the configured RSSHub instance URL (no trailing slash) */
function getRSSHubInstance(): string {
  const settings = settingsProvider.get()
  const custom = settings.general.rsshubInstance?.trim()
  return (custom || DEFAULT_RSSHUB_INSTANCE).replace(/\/+$/, '')
}

function appendSameRouteOnFallbackInstances(
  candidates: ResolvedProfileFeedCandidate[],
  instances: string[],
): void {
  const nextCandidates = [...candidates]
  for (const candidate of candidates) {
    try {
      const u = new URL(candidate.feedUrl)
      const pathAndQuery = `${u.pathname}${u.search}`
      for (const inst of instances) {
        const feedUrl = `${inst.replace(/\/+$/, '')}${pathAndQuery}`
        if (!nextCandidates.some((x) => x.feedUrl === feedUrl)) {
          nextCandidates.push({
            ...candidate,
            feedUrl,
          })
        }
      }
    } catch {
      // Ignore malformed candidate URL and keep other candidates.
    }
  }
  candidates.splice(0, candidates.length, ...nextCandidates)
}

export function registerDiscoverHandlers(): void {
  // Get categories
  registerChannel(IPC.DISCOVER_CATEGORIES, () => {
    return DISCOVER_CATEGORIES
  })

  // Get curated feeds, optionally filtered by category
  registerChannel(IPC.DISCOVER_POPULAR, (_event, category?: string) => {
    if (category) {
      return CURATED_FEEDS.filter((f) => f.category === category)
    }
    return CURATED_FEEDS
  })

  registerChannel(
    IPC.DISCOVER_SEARCH,
    (_event, query: string, platform: DiscoverSearchPlatform = 'all') =>
      discoverSearch(query, platform, getRSSHubInstance()),
  )

  // Get RSSHub routes - prepend instance URL to make them subscribable
  registerChannel(IPC.DISCOVER_RSSHUB_ROUTES, (_event, category?: string) => {
    const routes = category
      ? RSSHUB_ROUTES.filter((r) => r.category === category)
      : RSSHUB_ROUTES
    const instance = getRSSHubInstance()
    return routes.map((r) => ({
      ...r,
      url: `${instance}${r.url}`,
    }))
  })

  // Get RSSHub instance config
  registerChannel(IPC.DISCOVER_RSSHUB_INSTANCE, () => {
    return getRSSHubInstance()
  })

  // Validate a feed URL (try to fetch and parse)
  registerChannel(IPC.DISCOVER_VALIDATE_FEED, async (_event, url: string) => {
    try {
      const fetchableUrl = normalizeRsshubProtocolUrl(url, getRSSHubInstance())
      const parsed = await fetchAndParseFeed(fetchableUrl)
      const data = parsed.data
      let image = getFeedImageUrl(data) || ''
      if (!image) {
        const bilibiliUid = extractBilibiliUid(fetchableUrl)
        if (bilibiliUid) {
          image = (await fetchBilibiliAvatarByUid(bilibiliUid)) || ''
        }
      }
      return {
        valid: !!data,
        title: data?.title || url,
        description: data?.description || '',
        image,
        itemCount: data?.items?.length || 0,
      }
    } catch (error) {
      return {
        valid: false,
        error: String(error),
      }
    }
  })

  registerChannel(
    IPC.DISCOVER_PREVIEW_FEED,
    (_event, url: string): Promise<DiscoverFeedPreviewResult> =>
      previewDiscoverFeed(url, getRSSHubInstance()),
  )

  // Quick probe for a Twitter user via RSSHub - returns name + avatar fast
  // Tries the configured instance first, then fallback instances
  registerChannel(
    IPC.DISCOVER_PROBE_TWITTER_USER,
    async (_event, username: string) => {
      const clean = username.trim().replace(/^@/, '')
      const instance = getRSSHubInstance()
      const allInstances = [
        instance,
        ...FALLBACK_RSSHUB_INSTANCES.filter((i) => i !== instance),
      ]
      const allCandidates = [
        ...allInstances.map(
          (inst) => `${inst}/twitter/user/${encodeURIComponent(clean)}`,
        ),
        ...FALLBACK_NITTER_INSTANCES.map(
          (inst) =>
            `${inst.replace(/\/+$/, '')}/${encodeURIComponent(clean)}/rss`,
        ),
      ]

      for (const feedUrl of allCandidates) {
        try {
          const fetched = await fetchAndParseFeed(feedUrl)
          const parsed = fetched.data
          if (!parsed) throw new Error('Empty feed data')
          const parsedName = extractTwitterDisplayNameFromText(
            parsed.title || '',
            clean,
          )
          const fetchedName = parsedName
            ? ''
            : await fetchXDisplayNameByUsername(clean)
          return {
            valid: true,
            username: clean,
            title: parsedName
              ? `${parsedName} - X`
              : fetchedName
                ? `${fetchedName} - X`
                : formatFeedTitle(feedUrl, parsed.title || '', `${clean} - X`),
            description: parsed.description || '',
            // Use unavatar.io for always-fresh Twitter profile pictures
            image: `https://unavatar.io/x/${encodeURIComponent(clean)}`,
            feedUrl,
          }
        } catch {
          // Try next instance
          continue
        }
      }
      return { valid: false, username: clean }
    },
  )

  // Quick probe for a YouTube channel via RSSHub - returns channel name + avatar
  // Supports: @handle or plain username (channel ID intentionally disabled)
  registerChannel(
    IPC.DISCOVER_PROBE_YOUTUBE_CHANNEL,
    async (_event, query: string) => {
      const instance = getRSSHubInstance()
      const allInstances = [
        instance,
        ...FALLBACK_RSSHUB_INSTANCES.filter((i) => i !== instance),
      ]
      const clean = query.trim().replace(/^@/, '')
      if (!clean) return { valid: false, query }

      if (looksLikeYouTubeChannelId(clean)) {
        return { valid: false, query: clean }
      }

      // Try multiple RSSHub route patterns
      const routes = [
        `/youtube/user/@${clean}`, // @handle format
        `/youtube/user/${clean}`, // plain username
      ]

      // Try all instance+route combinations in parallel for faster results
      // (some instances may time out; Promise.any returns the first success)
      const attempts = allInstances.flatMap((inst) =>
        routes.map(async (route) => {
          const feedUrl = `${inst}${route}`
          const fetched = await fetchAndParseFeed(feedUrl)
          const parsed = fetched.data
          if (!parsed) throw new Error('Empty feed data')
          const image =
            (parsed as any).image?.url || (parsed as any).itunes?.image || ''
          return {
            valid: true as const,
            query: clean,
            title: parsed.title || clean,
            description: parsed.description || '',
            image,
            feedUrl,
            feedRoute: route,
          }
        }),
      )

      try {
        return await Promise.any(attempts)
      } catch {
        // All attempts failed
        return { valid: false, query: clean }
      }
    },
  )

  // Probe multi-platform video sources by keyword (for candidate list)
  registerChannel(
    IPC.DISCOVER_PROBE_VIDEO_SOURCES,
    async (_event, query: string) => {
      const instance = getRSSHubInstance()
      const candidates = await probeVideoSourcesByKeyword(query, instance)
      return { valid: candidates.length > 0, query: query.trim(), candidates }
    },
  )

  // Fast probe for Bilibili UID (name + avatar + canonical video feed URL)
  registerChannel(
    IPC.DISCOVER_PROBE_BILIBILI_UID,
    async (_event, uidRaw: string) => {
      const uid = (uidRaw || '').trim().match(/^(\d{3,})$/)?.[1]
      if (!uid) return { valid: false, uid: uidRaw }
      const instance = getRSSHubInstance()
      const name = await fetchBilibiliNameByUid(uid)
      const image = (await fetchBilibiliAvatarByUid(uid)) || ''
      return {
        valid: true,
        uid,
        title: `${name || `UID ${uid}`} - Bilibili`,
        description: `UID ${uid}`,
        image,
        feedUrl: `${instance}/bilibili/user/video/${uid}`,
      }
    },
  )

  // Probe Bilibili users by keyword (for Social tab candidate list)
  registerChannel(
    IPC.DISCOVER_PROBE_BILIBILI_USERS,
    async (_event, query: string) => {
      const instance = getRSSHubInstance()
      const candidates = await probeBilibiliUsersByKeyword(query, instance)
      return { valid: candidates.length > 0, query: query.trim(), candidates }
    },
  )

  // Resolve a creator/profile homepage URL into one or more subscribable feed URLs.
  registerChannel(
    IPC.DISCOVER_RESOLVE_PROFILE_URL,
    async (_event, inputUrl: string) => {
      const currentInstance = getRSSHubInstance()
      const result = resolveProfileUrlToCandidates(inputUrl, currentInstance)

      // For YouTube, always try to resolve official channel RSS from homepage first.
      if (result.platform === 'youtube' && result.normalizedUrl) {
        const official = await resolveYouTubeProfileToOfficialFeed(
          result.normalizedUrl,
        )
        if (official) {
          result.candidates = [
            official,
            ...result.candidates.filter((x) => x.feedUrl !== official.feedUrl),
          ]
          result.matched = true
          result.reason = null
        }
      }

      // For Bilibili/X, append fallback RSSHub-instance candidates for the same route path.
      if (
        (result.platform === 'bilibili' || result.platform === 'x') &&
        result.candidates.length > 0
      ) {
        const instances = [
          currentInstance,
          ...FALLBACK_RSSHUB_INSTANCES.filter((i) => i !== currentInstance),
        ]
        appendSameRouteOnFallbackInstances(result.candidates, instances)
        if (result.candidates.length > 0) {
          result.matched = true
          result.reason = null
        }
      }

      // For X, also add Nitter RSS candidates to avoid stale/blocked RSSHub routes.
      if (result.platform === 'x' && result.candidates.length > 0) {
        const usernameSet = new Set<string>()
        for (const candidate of result.candidates) {
          const m = candidate.feedUrl.match(/\/twitter\/user\/([^/?#]+)/i)
          if (m?.[1]) usernameSet.add(decodeURIComponent(m[1]))
        }
        if (usernameSet.size === 0 && result.normalizedUrl) {
          try {
            const url = new URL(result.normalizedUrl)
            const maybeUser = url.pathname
              .split('/')
              .filter(Boolean)[0]
              ?.replace(/^@/, '')
            if (maybeUser) usernameSet.add(maybeUser)
          } catch {
            // Ignore malformed URL.
          }
        }

        const existing = new Set(result.candidates.map((x) => x.feedUrl))
        const nitterInstances = [...FALLBACK_NITTER_INSTANCES]
        for (const username of usernameSet) {
          for (const base of nitterInstances) {
            const feedUrl = `${base.replace(/\/+$/, '')}/${encodeURIComponent(username)}/rss`
            if (existing.has(feedUrl)) continue
            result.candidates.push({
              feedUrl,
              title: `@${username}`,
              source: 'derived',
              siteUrl: `https://x.com/${username}`,
              description: 'Nitter RSS fallback for X/Twitter user',
              view: result.candidates[0]?.view,
            })
            existing.add(feedUrl)
          }
        }
        if (result.candidates.length > 0) {
          result.matched = true
          result.reason = null
        }
      }

      if (!result.matched) {
        return result
      }

      const needsYoutube = result.candidates.some((x) =>
        x.requiresAccount?.includes('youtube'),
      )
      if (needsYoutube) {
        result.accountStates = [await getYouTubeAccountState()]
      } else {
        result.accountStates = []
      }
      return result
    },
  )

  // Quick probe for an Instagram user via RSSHub official route.
  registerChannel(
    IPC.DISCOVER_PROBE_INSTAGRAM_USER,
    async (_event, username: string) => {
      const instance = getRSSHubInstance()
      const allInstances = [
        instance,
        ...FALLBACK_RSSHUB_INSTANCES.filter((i) => i !== instance),
      ]
      const clean = username.trim().replace(/^@/, '')
      if (!clean) return { valid: false, username: clean }

      const routes = [`/instagram/user/${encodeURIComponent(clean)}`]
      const profileAvatarPromise = fetchInstagramAvatarByUsername(clean).catch(
        () => undefined,
      )
      const attempts = allInstances.flatMap((inst) =>
        routes.map(async (route) => {
          const feedUrl = `${inst}${route}`
          const fetched = await fetchAndParseFeed(feedUrl)
          const data = fetched.data
          if (!data) throw new Error('Empty feed data')
          const image =
            (await resolveFeedAvatar(
              feedUrl,
              getFeedImageUrl(data),
              undefined,
              data.link || feedUrl,
            )) ||
            (await profileAvatarPromise) ||
            `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect fill="#E1306C" width="128" height="128" rx="24"/><text x="64" y="80" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="600">${clean.charAt(0).toUpperCase()}</text></svg>`)}`
          return {
            valid: true as const,
            username: clean,
            title: data.title || `@${clean}`,
            description: data.description || '',
            image,
            feedUrl: toRsshubProtocolUrl(feedUrl),
          }
        }),
      )
      try {
        return await Promise.any(attempts)
      } catch {
        return { valid: false, username: clean }
      }
    },
  )
}
