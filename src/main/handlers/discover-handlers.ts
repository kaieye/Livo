import { session } from 'electron'
import {
  CURATED_FEEDS,
  DISCOVER_CATEGORIES,
  RSSHUB_ROUTES,
  DEFAULT_RSSHUB_INSTANCE,
  searchCuratedFeeds,
} from '../../shared/discover-data'
import {
  normalizeDiscoverQueryToFeedUrl,
  extractBilibiliUid,
  extractTwitterUsernameFromUrl,
  decodeBasicHtmlEntities,
  extractTwitterDisplayNameFromText,
  isGenericTwitterTitle,
  FALLBACK_RSSHUB_INSTANCES,
} from '../services/discovery/discover-helpers'
import { FeedViewType, IPC } from '../../shared/types'
import type {
  DiscoverFeedPreviewEntry,
  DiscoverFeedPreviewResult,
  Entry,
  ResolvedProfileFeedCandidate,
} from '../../shared/types'
import { resolveProfileUrlToCandidates } from '../../shared/profile-resolver'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import {
  computeMatchTier,
  dedupeAndSortDiscoverResults,
  type DiscoverSearchResult,
} from '../services/discovery/discover-dedupe'
import { fetchAndParseFeed } from '../services/feed/rss-parser'
import { formatFeedTitle } from '../services/feed/feed-title'
import { deriveImageUrl } from '../services/feed/feed-utils'
import { settingsProvider } from '../services/system/settings-provider'
import { getYouTubeAccountState } from '../services/account/account-session'
import { resolveYouTubeProfileToOfficialFeed } from '../services/discovery/youtube-profile-resolver'
import {
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from '../services/feed/rsshub-url'
import { resolveFeedAvatar } from '../services/feed/feed-avatar'
import { buildEntriesFromParsedItems } from '../services/entry/entry-builder'
import { detectRouteViewFromUrl } from '../services/feed/feed-view'
import {
  searchYouTubeChannelsByKeyword,
  looksLikeYouTubeChannelId,
  type VideoProbeCandidate,
} from '../services/discovery/discover-youtube'
import {
  extractLikelyXHandle,
  extractLikelyXHandleFromKeywords,
  fetchXDisplayNameByUsername,
  probeXUsersByKeyword,
  FALLBACK_NITTER_INSTANCES,
} from '../services/discovery/discover-x'
import {
  fetchBilibiliNameByUid,
  fetchBilibiliAvatarByUid,
  probeBilibiliUsersByKeyword,
  type BilibiliUserProbeCandidate,
} from '../services/discovery/discover-bilibili'
import {
  fetchInstagramAvatarByUsername,
  probeInstagramUsersByKeyword,
} from '../services/discovery/discover-instagram-search'
import RssParser from 'rss-parser'

/** A lightweight RSS parser with a short timeout - used for quick probes. */
const fastParser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
  },
})

const DISCOVER_SEARCH_CACHE_TTL = 30 * 1000
const discoverSearchCache = new Map<
  string,
  { expiresAt: number; results: DiscoverSearchResult[] }
>()

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

async function inferDiscoverResultImage(
  feedUrl: string,
  siteUrl?: string,
): Promise<string | undefined> {
  const twitterUsername = extractTwitterUsernameFromUrl(feedUrl)
  if (twitterUsername) {
    const clean = extractLikelyXHandle(twitterUsername)
    if (clean) {
      return `https://unavatar.io/x/${encodeURIComponent(clean)}?v=${Date.now()}`
    }
  }

  const fromSite = (siteUrl || '').trim()
  if (fromSite) {
    try {
      const siteHost = new URL(fromSite).hostname.replace(/^www\./i, '')
      if (siteHost) return `https://unavatar.io/${siteHost}`
    } catch {
      // Ignore invalid site URL.
    }
  }

  return undefined
}

async function inferDiscoverResultTitle(
  feedUrl: string,
  parsedTitle?: string,
): Promise<string> {
  const twitterUsername = extractTwitterUsernameFromUrl(feedUrl)
  if (twitterUsername) {
    const normalizedByFeed = formatFeedTitle(
      feedUrl,
      parsedTitle,
      `${twitterUsername} - X`,
    )
    const parsedName = extractTwitterDisplayNameFromText(
      normalizedByFeed,
      twitterUsername,
    )
    if (parsedName) return `${parsedName} - X`
    if (
      normalizedByFeed &&
      !isGenericTwitterTitle(normalizedByFeed, twitterUsername)
    )
      return normalizedByFeed
    const fetchedName = await fetchXDisplayNameByUsername(twitterUsername)
    if (fetchedName) return `${fetchedName} - X`
    return `${twitterUsername} - X`
  }

  const normalizedByFeed = formatFeedTitle(feedUrl, parsedTitle, feedUrl)
  if (normalizedByFeed && normalizedByFeed !== feedUrl) return normalizedByFeed

  const bilibiliUid = extractBilibiliUid(feedUrl)
  if (bilibiliUid) {
    const name = await fetchBilibiliNameByUid(bilibiliUid)
    return `${name || `UID ${bilibiliUid}`} - Bilibili`
  }

  try {
    const u = new URL(feedUrl)
    const host = u.hostname.replace(/^www\./i, '')
    return `${host} - RSS`
  } catch {
    return feedUrl
  }
}

function getFeedImageUrl(parsed: any): string | undefined {
  if (!parsed) return undefined
  const imageUrl =
    (parsed['image'] as { url?: string } | undefined)?.url ||
    (parsed['itunes'] as { image?: string } | undefined)?.image
  if (imageUrl) return imageUrl

  const items =
    (parsed['items'] as Array<Record<string, unknown>> | undefined) || []
  for (const item of items.slice(0, 3)) {
    const image = deriveImageUrl(item)
    if (image) return image
  }
  return undefined
}

function buildPreviewFetchUrl(targetUrl: string): string {
  const rawProtocolUrl = toRsshubProtocolUrl(targetUrl.trim())
  const limitedProtocolUrl = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(rawProtocolUrl, 100),
    120,
  )
  return normalizeRsshubProtocolUrl(limitedProtocolUrl, getRSSHubInstance())
}

function inferPreviewViewFromUrl(feedUrl: string): FeedViewType {
  const routeView = detectRouteViewFromUrl(feedUrl)
  if (routeView !== null) return routeView

  const raw = (feedUrl || '').toLowerCase()
  if (/\/(?:twitter|x)\/user\//i.test(raw)) return FeedViewType.SocialMedia
  if (
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\//i.test(raw)
  ) {
    return FeedViewType.Pictures
  }
  return FeedViewType.Articles
}

function stripPreviewText(raw?: string): string {
  return decodeBasicHtmlEntities(String(raw || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPreviewEntryImage(entry: Entry): string | undefined {
  return (
    entry.imageUrl ||
    entry.media?.find((media) => media.type === 'photo')?.previewUrl ||
    entry.media?.find((media) => media.type === 'photo')?.url
  )
}

function toDiscoverPreviewEntry(entry: Entry): DiscoverFeedPreviewEntry {
  const summary = stripPreviewText(entry.summary || entry.content || '')
  return {
    id: entry.id,
    title: entry.title || entry.author || entry.url,
    url: entry.url,
    summary: summary ? summary.slice(0, 240) : undefined,
    content: entry.content || '',
    author: entry.author || undefined,
    imageUrl: getPreviewEntryImage(entry),
    publishedAt: entry.publishedAt,
  }
}

async function probeVideoSourcesByKeyword(
  query: string,
  rsshubInstance: string,
  platform: 'all' | 'youtube' | 'bilibili' | 'x' = 'all',
): Promise<
  Array<{
    platform: 'youtube' | 'bilibili'
    title: string
    description: string
    image: string
    feedUrl: string
    followers?: string
  }>
> {
  const results: VideoProbeCandidate[] = []
  const clean = query.trim().replace(/^@/, '')
  if (!clean) return results
  if (looksLikeYouTubeChannelId(clean)) return results

  // Run searches in parallel based on selected platform
  const searchPromises: Promise<VideoProbeCandidate[]>[] = []

  if (platform === 'all' || platform === 'youtube') {
    searchPromises.push(searchYouTubeChannelsByKeyword(clean, rsshubInstance))
  } else {
    searchPromises.push(Promise.resolve([]))
  }

  if (platform === 'all' || platform === 'bilibili') {
    searchPromises.push(
      probeBilibiliUsersByKeyword(clean, rsshubInstance).then((users) =>
        users.map((user) => ({
          platform: 'bilibili' as const,
          title: user.title,
          description: user.description,
          image: user.image,
          feedUrl: user.feedUrl,
          followers: user.followers,
        })),
      ),
    )
  } else {
    searchPromises.push(Promise.resolve([]))
  }

  const [ytSearchCandidates, biliCandidates] = await Promise.all(searchPromises)

  for (const c of ytSearchCandidates) {
    if (!results.some((x) => x.feedUrl === c.feedUrl)) results.push(c)
  }

  for (const candidate of biliCandidates) {
    if (!results.some((x) => x.feedUrl === candidate.feedUrl))
      results.push(candidate)
  }

  return results
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

  type DiscoverSearchPlatform =
    | 'all'
    | 'youtube'
    | 'bilibili'
    | 'x'
    | 'instagram'

  // Search feeds by query (check curated feeds + try as URL)
  registerChannel(
    IPC.DISCOVER_SEARCH,
    async (_event, query: string, platform: DiscoverSearchPlatform = 'all') => {
      const cacheKey = `${query.trim().toLowerCase()}:${platform}`
      const shouldUseCache = platform !== 'instagram'
      const cached = discoverSearchCache.get(cacheKey)
      if (
        shouldUseCache &&
        cacheKey &&
        cached &&
        cached.expiresAt > Date.now()
      ) {
        return cached.results
      }

      console.log(`[Discover Search] ========== START SEARCH ==========`)
      console.log(
        `[Discover Search] Query: "${query}", Platform: "${platform}"`,
      )
      const startTime = Date.now()
      const results: DiscoverSearchResult[] = []

      // Search curated feeds (fast, local) - only for "all" or matching platform
      if (platform === 'all') {
        const curated = searchCuratedFeeds(query)
        console.log(`[Discover Search] Curated feeds: ${curated.length}`)
        for (const feed of curated) {
          results.push({
            title: feed.title,
            url: feed.url,
            siteUrl: feed.siteUrl,
            description: feed.description,
            source: 'curated',
            image: feed.imageUrl || '',
          })
        }

        // Search RSSHub routes (fast, local)
        const q = query.toLowerCase()
        const matchingRoutes = RSSHUB_ROUTES.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q),
        )
        console.log(`[Discover Search] RSSHub routes: ${matchingRoutes.length}`)
        const instance = getRSSHubInstance()
        for (const route of matchingRoutes.slice(0, 20)) {
          results.push({
            title: route.name,
            url: `${instance}${route.url}`,
            siteUrl: `${instance}${route.url}`,
            description: `${route.description} (RSSHub)`,
            source: 'rsshub',
            image: '',
          })
        }
      }

      const instance = getRSSHubInstance()

      // Run platform-specific searches based on selected platform
      const searchPromises: Promise<void>[] = []

      if (
        platform === 'all' ||
        platform === 'youtube' ||
        platform === 'bilibili'
      ) {
        searchPromises.push(
          probeVideoSourcesByKeyword(query, instance, platform).then(
            (videoCandidates) => {
              console.log(
                `[Discover Search] Video candidates: ${videoCandidates.length}`,
              )
              for (const candidate of videoCandidates) {
                if (results.some((r) => r.url === candidate.feedUrl)) continue
                results.push({
                  title: candidate.title,
                  url: candidate.feedUrl,
                  siteUrl: candidate.feedUrl,
                  description:
                    candidate.description ||
                    (candidate.platform === 'youtube'
                      ? 'YouTube channel'
                      : 'Bilibili user'),
                  source: 'rsshub',
                  image: candidate.image || '',
                  followers: candidate.followers,
                })
              }
            },
          ),
        )
      }

      if (platform === 'all' || platform === 'x') {
        searchPromises.push(
          probeXUsersByKeyword(query, instance).then((xCandidates) => {
            console.log(`[Discover Search] X candidates: ${xCandidates.length}`)
            for (const candidate of xCandidates) {
              if (results.some((r) => r.url === candidate.feedUrl)) continue
              results.push({
                title: candidate.title,
                url: candidate.feedUrl,
                siteUrl: `https://x.com/${encodeURIComponent(candidate.username)}`,
                description: candidate.followers || candidate.description,
                source: 'rsshub',
                image: candidate.image,
                followers: candidate.followers,
              })
            }
          }),
        )
      }

      if (platform === 'all' || platform === 'instagram') {
        searchPromises.push(
          probeInstagramUsersByKeyword(query, instance).then((igCandidates) => {
            console.log(
              `[Discover Search] Instagram candidates: ${igCandidates.length}`,
            )
            for (const candidate of igCandidates) {
              if (results.some((r) => r.url === candidate.feedUrl)) continue
              results.push({
                title: candidate.title,
                url: candidate.feedUrl,
                siteUrl: `https://www.instagram.com/${encodeURIComponent(candidate.username)}/`,
                description: candidate.description,
                source: 'rsshub',
                image: candidate.image,
                followers: candidate.followers,
              })
            }
          }),
        )
      }

      await Promise.all(searchPromises)

      const trimmedQuery = query.trim()

      // Resolve profile-like inputs. For X search, keyword mode already generates
      // candidates, so only keep explicit URL resolution to avoid noisy fallback routes.
      if (platform !== 'instagram') {
        const profileInputs = new Set<string>()
        if (trimmedQuery) {
          const isExplicitUrl = /^https?:\/\//i.test(trimmedQuery)
          if (platform === 'x') {
            if (isExplicitUrl) profileInputs.add(trimmedQuery)
          } else {
            profileInputs.add(trimmedQuery)
            const xHandle = extractLikelyXHandle(trimmedQuery)
            if (xHandle) profileInputs.add(`https://x.com/${xHandle}`)
            const compactXHandle =
              extractLikelyXHandleFromKeywords(trimmedQuery)
            if (compactXHandle)
              profileInputs.add(`https://x.com/${compactXHandle}`)
          }
        }
        for (const profileInput of profileInputs) {
          const resolved = resolveProfileUrlToCandidates(profileInput, instance)
          for (const candidate of resolved.candidates) {
            if (results.some((r) => r.url === candidate.feedUrl)) continue
            results.push({
              title: candidate.title,
              url: candidate.feedUrl,
              siteUrl: candidate.siteUrl || profileInput,
              description: candidate.description || 'Profile feed',
              source: candidate.source === 'rss' ? 'url' : 'rsshub',
              image: '', // Skip image fetch for speed
            })
          }
        }
      }

      // If query looks like a URL, try to fetch it as RSS
      const looksLikeUrl =
        /^rsshub:\/\//i.test(trimmedQuery) ||
        /^https?:\/\//i.test(trimmedQuery) ||
        (platform !== 'instagram' &&
          trimmedQuery.includes('.') &&
          !trimmedQuery.includes(' '))
      if (looksLikeUrl) {
        const feedUrl = normalizeDiscoverQueryToFeedUrl(trimmedQuery, instance)
        try {
          const parsed = await fetchAndParseFeed(feedUrl)
          const data = parsed.data
          // Only add if not already in results
          if (data && !results.some((r) => r.url === feedUrl)) {
            const displayTitle = await inferDiscoverResultTitle(
              feedUrl,
              data.title || undefined,
            )
            results.push({
              title: displayTitle,
              url: feedUrl,
              siteUrl: data.link || feedUrl,
              description: data.description || '直接 URL 订阅',
              source: 'url',
              image:
                getFeedImageUrl(data) ||
                (await inferDiscoverResultImage(feedUrl, data.link || feedUrl)),
            })
          }
        } catch {
          // Keep a direct subscribable option even when probe fails.
          if (!results.some((r) => r.url === feedUrl)) {
            const displayTitle = await inferDiscoverResultTitle(feedUrl)
            results.push({
              title: displayTitle,
              url: feedUrl,
              siteUrl: feedUrl,
              description: 'Direct URL subscription',
              source: 'url',
              image: await inferDiscoverResultImage(feedUrl, feedUrl),
            })
          }
        }
      }

      const finalResults = dedupeAndSortDiscoverResults(query, results)

      console.log(`[Discover Search] Final results: ${finalResults.length}`)
      console.log(`[Discover Search] Elapsed: ${Date.now() - startTime}ms`)
      console.log(`[Discover Search] ========== END SEARCH ==========`)

      if (shouldUseCache && cacheKey) {
        discoverSearchCache.set(cacheKey, {
          expiresAt: Date.now() + DISCOVER_SEARCH_CACHE_TTL,
          results: finalResults,
        })
      }

      return finalResults
    },
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
    async (_event, url: string): Promise<DiscoverFeedPreviewResult> => {
      const targetUrl = (url || '').trim()
      if (!targetUrl) {
        return { success: false, error: 'Feed URL is required' }
      }

      try {
        const resolvedFeedUrl = buildPreviewFetchUrl(targetUrl)
        console.log(`[Discover Preview] Loading preview for ${resolvedFeedUrl}`)
        const parsed = await fetchAndParseFeed(resolvedFeedUrl)
        const data = parsed.data
        if (!data) {
          return { success: false, error: 'Feed returned no data' }
        }

        const imageUrl = await resolveFeedAvatar(
          resolvedFeedUrl,
          getFeedImageUrl(data),
        )
        const view = inferPreviewViewFromUrl(resolvedFeedUrl)
        const entries = await buildEntriesFromParsedItems(
          'discover-preview',
          ((data.items || []) as Array<Record<string, any>>).slice(0, 6),
          imageUrl,
          view,
          Date.now(),
        )
        const displayTitle = await inferDiscoverResultTitle(
          resolvedFeedUrl,
          data.title || undefined,
        )

        return {
          success: true,
          preview: {
            targetUrl,
            resolvedFeedUrl,
            feedTitle: displayTitle || data.title || targetUrl,
            siteUrl: data.link || resolvedFeedUrl,
            description: data.description || '',
            imageUrl,
            itemCount: data.items?.length || 0,
            entries: entries.map(toDiscoverPreviewEntry),
          },
        }
      } catch (error) {
        console.warn(`[Discover Preview] Failed to preview ${targetUrl}`, error)
        return toHandlerError(error)
      }
    },
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
          const parsed = await fastParser.parseURL(feedUrl)
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
          const parsed = await fastParser.parseURL(feedUrl)
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
            (await resolveFeedAvatar(feedUrl, getFeedImageUrl(data))) ||
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
