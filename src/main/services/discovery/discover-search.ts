/**
 * Discover Search pipeline.
 *
 * Single source of truth for `DISCOVER_SEARCH` orchestration: local curated +
 * RSSHub route search, per-platform probe dispatch (YouTube/Bilibili/X/Instagram),
 * profile-URL resolution, direct-URL fetch, dedupe, and 30s in-process cache.
 *
 * Extracted from `discover-handlers.ts` so the search flow has a real interface
 * and a unit-test surface that doesn't require spawning an Electron IPC round-trip.
 */
import {
  RSSHUB_ROUTES,
  searchCuratedFeeds,
} from '../../../shared/discover-data'
import { normalizeDiscoverQueryToFeedUrl } from '../../../shared/discover-helpers'
import { resolveProfileUrlToCandidates } from '../../../shared/profile-resolver'
import {
  dedupeAndSortDiscoverResults,
  type DiscoverSearchResult,
} from './discover-dedupe'
import {
  inferDiscoverResultImage,
  inferDiscoverResultTitle,
} from './discover-preview'
import { fetchAndParseFeed } from '../feed/rss-parser'
import { getFeedImageUrl } from '../feed/feed-utils'
import { logInfo } from '../system/logger'
import {
  looksLikeYouTubeChannelId,
  searchYouTubeChannelsByKeyword,
  type VideoProbeCandidate,
} from './discover-youtube'
import {
  extractLikelyXHandle,
  extractLikelyXHandleFromKeywords,
  probeXUsersByKeyword,
} from './discover-x'
import { probeBilibiliUsersByKeyword } from './discover-bilibili'
import { probeInstagramUsersByKeyword } from './discover-instagram-search'
import { searchWechatMp } from './wechat-mp-client'

export type DiscoverSearchPlatform =
  | 'all'
  | 'youtube'
  | 'bilibili'
  | 'x'
  | 'instagram'
  | 'wechat-mp'

const DISCOVER_SEARCH_CACHE_TTL = 30 * 1000

interface DiscoverSearchCacheEntry {
  expiresAt: number
  results: DiscoverSearchResult[]
}

const discoverSearchCache = new Map<string, DiscoverSearchCacheEntry>()

interface VideoProbeAggregate {
  platform: 'youtube' | 'bilibili'
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

/**
 * Probe YouTube + Bilibili in parallel by keyword. Shared between
 * `DISCOVER_SEARCH` (via `discoverSearch`) and the standalone
 * `DISCOVER_PROBE_VIDEO_SOURCES` handler.
 */
export async function probeVideoSourcesByKeyword(
  query: string,
  rsshubInstance: string,
  platform: 'all' | 'youtube' | 'bilibili' | 'x' = 'all',
): Promise<VideoProbeAggregate[]> {
  const results: VideoProbeAggregate[] = []
  const clean = query.trim().replace(/^@/, '')
  if (!clean) return results
  if (looksLikeYouTubeChannelId(clean)) return results

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

/**
 * Map a batch of platform probe candidates into IPC discover results and append
 * them (skipping URLs already present). Each platform supplies only how to
 * derive `siteUrl` and `description` from its candidate; everything else is
 * identical.
 */
function appendProbeCandidatesToResults<
  Candidate extends {
    title: string
    feedUrl: string
    description: string
    image: string
    followers?: string
  },
>(
  results: DiscoverSearchResult[],
  candidates: Candidate[],
  mapper: {
    siteUrl: (candidate: Candidate) => string
    description: (candidate: Candidate) => string
  },
): void {
  for (const candidate of candidates) {
    if (results.some((r) => r.url === candidate.feedUrl)) continue
    results.push({
      title: candidate.title,
      url: candidate.feedUrl,
      siteUrl: mapper.siteUrl(candidate),
      description: mapper.description(candidate),
      source: 'rsshub',
      image: candidate.image || '',
      followers: candidate.followers,
    })
  }
}

async function collectLocalResults(
  query: string,
  rsshubInstance: string,
): Promise<DiscoverSearchResult[]> {
  const results: DiscoverSearchResult[] = []

  const curated = searchCuratedFeeds(query)
  logInfo('[discover-search] curated feeds', curated.length)
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

  const q = query.toLowerCase()
  const matchingRoutes = RSSHUB_ROUTES.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q),
  )
  logInfo('[discover-search] rsshub routes', matchingRoutes.length)
  for (const route of matchingRoutes.slice(0, 20)) {
    results.push({
      title: route.name,
      url: `${rsshubInstance}${route.url}`,
      siteUrl: `${rsshubInstance}${route.url}`,
      description: `${route.description} (RSSHub)`,
      source: 'rsshub',
      image: '',
    })
  }

  return results
}

async function runPlatformProbes(
  query: string,
  rsshubInstance: string,
  platform: DiscoverSearchPlatform,
  results: DiscoverSearchResult[],
): Promise<void> {
  const searchPromises: Promise<void>[] = []

  if (platform === 'all' || platform === 'youtube' || platform === 'bilibili') {
    searchPromises.push(
      probeVideoSourcesByKeyword(query, rsshubInstance, platform).then(
        (videoCandidates) => {
          logInfo('[discover-search] video candidates', videoCandidates.length)
          appendProbeCandidatesToResults(results, videoCandidates, {
            siteUrl: (candidate) => candidate.feedUrl,
            description: (candidate) =>
              candidate.description ||
              (candidate.platform === 'youtube'
                ? 'YouTube channel'
                : 'Bilibili user'),
          })
        },
      ),
    )
  }

  if (platform === 'all' || platform === 'x') {
    searchPromises.push(
      probeXUsersByKeyword(query, rsshubInstance).then((xCandidates) => {
        logInfo('[discover-search] x candidates', xCandidates.length)
        appendProbeCandidatesToResults(results, xCandidates, {
          siteUrl: (candidate) =>
            `https://x.com/${encodeURIComponent(candidate.username)}`,
          description: (candidate) =>
            candidate.followers || candidate.description,
        })
      }),
    )
  }

  if (platform === 'all' || platform === 'instagram') {
    searchPromises.push(
      probeInstagramUsersByKeyword(query, rsshubInstance).then(
        (igCandidates) => {
          logInfo('[discover-search] instagram candidates', igCandidates.length)
          appendProbeCandidatesToResults(results, igCandidates, {
            siteUrl: (candidate) =>
              `https://www.instagram.com/${encodeURIComponent(candidate.username)}/`,
            description: (candidate) => candidate.description,
          })
        },
      ),
    )
  }

  if (platform === 'all' || platform === 'wechat-mp') {
    searchPromises.push(
      searchWechatMp(query, { limit: 10, offset: 0 }).then((payload) => {
        logInfo(
          '[discover-search] wechat mp candidates',
          payload.results.length,
        )
        for (const candidate of payload.results) {
          if (results.some((r) => r.url === candidate.rssUrl)) continue
          results.push({
            title: candidate.title,
            url: candidate.rssUrl,
            siteUrl: candidate.siteUrl,
            description: candidate.description,
            source: 'wechat-rss',
            image: candidate.image || '',
            requiresLogin: candidate.requiresLogin,
            metadata: {
              fakeId: candidate.fakeId,
              source: candidate.source,
            },
          })
        }
      }),
    )
  }

  await Promise.all(searchPromises)
}

function appendProfileResolutionCandidates(
  query: string,
  rsshubInstance: string,
  platform: DiscoverSearchPlatform,
  results: DiscoverSearchResult[],
): void {
  if (platform === 'instagram' || platform === 'wechat-mp') return

  const trimmedQuery = query.trim()
  const profileInputs = new Set<string>()
  if (trimmedQuery) {
    const isExplicitUrl = /^https?:\/\//i.test(trimmedQuery)
    if (platform === 'x') {
      if (isExplicitUrl) profileInputs.add(trimmedQuery)
    } else {
      profileInputs.add(trimmedQuery)
      const xHandle = extractLikelyXHandle(trimmedQuery)
      if (xHandle) profileInputs.add(`https://x.com/${xHandle}`)
      const compactXHandle = extractLikelyXHandleFromKeywords(trimmedQuery)
      if (compactXHandle) profileInputs.add(`https://x.com/${compactXHandle}`)
    }
  }

  for (const profileInput of profileInputs) {
    const resolved = resolveProfileUrlToCandidates(profileInput, rsshubInstance)
    for (const candidate of resolved.candidates) {
      if (results.some((r) => r.url === candidate.feedUrl)) continue
      results.push({
        title: candidate.title,
        url: candidate.feedUrl,
        siteUrl: candidate.siteUrl || profileInput,
        description: candidate.description || 'Profile feed',
        source: candidate.source === 'rss' ? 'url' : 'rsshub',
        image: '',
      })
    }
  }
}

function looksLikeDirectUrl(
  query: string,
  platform: DiscoverSearchPlatform,
): boolean {
  const trimmed = query.trim()
  return (
    /^rsshub:\/\//i.test(trimmed) ||
    /^https?:\/\//i.test(trimmed) ||
    (platform !== 'instagram' &&
      platform !== 'wechat-mp' &&
      trimmed.includes('.') &&
      !trimmed.includes(' '))
  )
}

async function appendDirectUrlResult(
  query: string,
  rsshubInstance: string,
  results: DiscoverSearchResult[],
): Promise<void> {
  const trimmedQuery = query.trim()
  const feedUrl = normalizeDiscoverQueryToFeedUrl(trimmedQuery, rsshubInstance)
  if (results.some((r) => r.url === feedUrl)) return

  try {
    const parsed = await fetchAndParseFeed(feedUrl)
    const data = parsed.data
    if (!data) throw new Error('Empty feed data')
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
  } catch {
    // Keep a direct subscribable option even when probe fails.
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

/**
 * Run a Discover search across curated feeds, RSSHub routes, platform probes,
 * profile resolution, and direct-URL fetch. Results are deduped, ranked, and
 * cached for 30s (Instagram is exempt from caching — fresh results matter
 * more there).
 */
export async function discoverSearch(
  query: string,
  platform: DiscoverSearchPlatform,
  rsshubInstance: string,
): Promise<DiscoverSearchResult[]> {
  const cacheKey = `${query.trim().toLowerCase()}:${platform}`
  const shouldUseCache = platform !== 'instagram'

  if (shouldUseCache && cacheKey) {
    const cached = discoverSearchCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results
    }
  }

  logInfo('[discover-search] start', { query, platform })
  const startTime = Date.now()
  const results: DiscoverSearchResult[] = []

  if (platform === 'all') {
    const local = await collectLocalResults(query, rsshubInstance)
    results.push(...local)
  }

  await runPlatformProbes(query, rsshubInstance, platform, results)
  appendProfileResolutionCandidates(query, rsshubInstance, platform, results)

  if (looksLikeDirectUrl(query, platform)) {
    await appendDirectUrlResult(query, rsshubInstance, results)
  }

  const finalResults = dedupeAndSortDiscoverResults(query, results)

  logInfo('[discover-search] done', {
    finalCount: finalResults.length,
    elapsedMs: Date.now() - startTime,
  })

  if (shouldUseCache && cacheKey) {
    discoverSearchCache.set(cacheKey, {
      expiresAt: Date.now() + DISCOVER_SEARCH_CACHE_TTL,
      results: finalResults,
    })
  }

  return finalResults
}
