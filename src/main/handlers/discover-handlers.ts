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
  formatFollowerCount,
  normalizeXFollowersLabel,
  normalizeNameForMatch,
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
import {
  createInstagramDiscoverCandidate,
  INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS,
} from '../services/discovery/discover-instagram-search'
import {
  computeMatchTier,
  dedupeAndSortDiscoverResults,
  type DiscoverSearchResult,
} from '../services/discovery/discover-dedupe'
import { fetchAndParseFeed } from '../services/feed/rss-parser'
import { formatFeedTitle } from '../services/feed/feed-title'
import { deriveImageUrl } from '../services/feed/feed-utils'
import { getSettings } from './settings-handlers'
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
import RssParser from 'rss-parser'
import * as https from 'node:https'

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

/** Fallback RSSHub instances for Twitter probes */
const FALLBACK_RSSHUB_INSTANCES = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub-instance.zeabur.app',
]
const FALLBACK_NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.d420.de',
]

const X_AVATAR_CACHE_TTL = 10 * 60 * 1000
const X_FOLLOWER_CACHE_TTL = 10 * 60 * 1000
const YOUTUBE_SUBSCRIBER_CACHE_TTL = 10 * 60 * 1000
const YOUTUBE_SUBSCRIBER_MISS_CACHE_TTL = 30 * 1000
const DISCOVER_SEARCH_CACHE_TTL = 30 * 1000
const xAvatarCache = new Map<string, { expiresAt: number; image: string }>()
const xFollowerCache = new Map<
  string,
  { expiresAt: number; followers?: string }
>()
const youtubeSubscriberCache = new Map<
  string,
  { expiresAt: number; followers?: string }
>()

const discoverSearchCache = new Map<
  string,
  {
    expiresAt: number
    results: DiscoverSearchResult[]
  }
>()

/** Return the configured RSSHub instance URL (no trailing slash) */
function getRSSHubInstance(): string {
  const settings = getSettings()
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

function extractLikelyXHandle(query: string): string | null {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return null
  // X/Twitter username constraint: up to 15 chars, letters/digits/underscore.
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(clean)) return null
  return clean
}

function extractLikelyXHandleFromKeywords(query: string): string | null {
  const compact = query
    .trim()
    .replace(/^@+/, '')
    .replace(/[\s.-]+/g, '')
  if (!compact) return null
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(compact)) return null
  return compact
}

async function fetchXAvatarByUsername(username: string): Promise<string> {
  const clean = extractLikelyXHandle(username)
  if (!clean) return ''
  const now = Date.now()
  const cached = xAvatarCache.get(clean.toLowerCase())
  if (cached && cached.expiresAt > now) return cached.image
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(clean)}`
    // Use session fetch to respect proxy settings
    const res = await session.defaultSession.fetch(profileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    const raw =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      )?.[1] ||
      ''
    const decoded = decodeBasicHtmlEntities(raw)
    if (!/^https?:\/\//i.test(decoded)) return ''
    const image = decoded.replace(/_normal(\.[a-z0-9]+)(\?.*)?$/i, '$1')
    xAvatarCache.set(clean.toLowerCase(), {
      expiresAt: now + X_AVATAR_CACHE_TTL,
      image,
    })
    return image
  } catch {
    return ''
  }
}

async function inferDiscoverResultImage(
  feedUrl: string,
  siteUrl?: string,
): Promise<string | undefined> {
  const twitterUsername = extractTwitterUsernameFromUrl(feedUrl)
  if (twitterUsername) {
    const clean = extractLikelyXHandle(twitterUsername)
    if (clean) {
      const liveAvatar = await fetchXAvatarByUsername(clean)
      if (liveAvatar) return liveAvatar
      // Add a small cache-buster to reduce stale CDN/browser caches.
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

async function fetchXDisplayNameByUsername(username: string): Promise<string> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return ''
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(clean)}`
    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    const ogTitle =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      )?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      ''
    const decoded = decodeBasicHtmlEntities(ogTitle)
    return extractTwitterDisplayNameFromText(decoded, clean)
  } catch {
    return ''
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

async function fetchBilibiliNameByUid(uid: string): Promise<string | null> {
  const referer = `https://space.bilibili.com/${encodeURIComponent(uid)}`
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
    `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json, text/plain, */*',
          Referer: referer,
          Origin: 'https://www.bilibili.com',
        },
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        code?: number
        data?: { card?: { name?: string }; name?: string }
      }
      if (json.code !== 0) continue
      const name = (json.data?.card?.name || json.data?.name || '').trim()
      if (name) return name
    } catch {
      // Ignore single endpoint failure.
    }
  }
  return null
}

async function fetchBilibiliAvatarByUid(uid: string): Promise<string | null> {
  const referer = `https://space.bilibili.com/${encodeURIComponent(uid)}`
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
    `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json, text/plain, */*',
          Referer: referer,
          Origin: 'https://www.bilibili.com',
        },
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        code?: number
        data?: { card?: { face?: string }; face?: string }
      }
      if (json.code !== 0) continue
      const face = (json.data?.card?.face || json.data?.face || '').trim()
      if (face) return face
    } catch {
      // Ignore single endpoint failure.
    }
  }
  return null
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

type VideoProbeCandidate = {
  platform: 'youtube' | 'bilibili'
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}
type BilibiliUserProbeCandidate = {
  uid: string
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

type XUserProbeCandidate = {
  username: string
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

function isUsernameMatch(query: string, candidateName: string): boolean {
  const q = normalizeNameForMatch(query)
  const c = normalizeNameForMatch(candidateName)
  if (!q || !c) return false
  return c.includes(q)
}

function flattenTextRuns(node: any): string {
  if (!node) return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs))
    return node.runs
      .map((r: any) => r?.text || '')
      .join('')
      .trim()
  return ''
}

function parseYouTubeSubscriberLabel(raw: string): string | undefined {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text || text.startsWith('@')) return undefined

  // Keep full matched phrase so we preserve locale style (e.g. "1.2M subscribers", "3.4万位订阅者", "3.4萬位訂閱者").
  const patterns = [
    /([\d.,]+(?:\s*[KMB])?)\s*subscribers?/i,
    /([\d.,]+(?:\s*[KMB])?)\s*subscriber/i,
    /([\d.,]+(?:\s*[万亿萬億])?)\s*(?:位)?(?:订阅者|訂閱者)/i,
    /(?:订阅者|訂閱者)(?:数|數)?\s*([\d.,]+(?:\s*[万亿萬億])?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const phrase = match[0].trim()
      const hasNumber = /\d/.test(phrase)
      if (hasNumber) return phrase
    }
  }

  return undefined
}

function extractYouTubeSubscriberText(renderer: any): string {
  const candidates = [
    flattenTextRuns(renderer?.subscriberCountText),
    String(
      renderer?.subscriberCountText?.accessibility?.accessibilityData?.label ||
        '',
    ),
    flattenTextRuns(renderer?.longBylineText),
  ]

  for (const candidate of candidates) {
    const parsed = parseYouTubeSubscriberLabel(candidate || '')
    if (parsed) return parsed
  }

  return ''
}

function collectChannelRenderers(node: any, out: any[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const n of node) collectChannelRenderers(n, out)
    return
  }
  if (typeof node !== 'object') return
  if (node.channelRenderer) out.push(node.channelRenderer)
  for (const key of Object.keys(node)) {
    collectChannelRenderers(node[key], out)
  }
}

function extractYouTubeHandleFromChannelRenderer(renderer: any): string {
  const canonical =
    renderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    ''
  const matched = String(canonical).match(/\/@([^/?#]+)/)
  return matched?.[1] ? decodeURIComponent(matched[1]).trim() : ''
}

function extractYouTubeUserRouteFromChannelRenderer(
  renderer: any,
): string | null {
  const canonical =
    renderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    ''
  const path = String(canonical).trim()
  if (!path.startsWith('/')) return null
  const atMatch = path.match(/^\/@([^/?#]+)/)
  if (atMatch?.[1])
    return `/youtube/user/@${encodeURIComponent(decodeURIComponent(atMatch[1]).trim())}`
  const userMatch = path.match(/^\/(?:user|c)\/([^/?#]+)/i)
  if (userMatch?.[1])
    return `/youtube/user/${encodeURIComponent(decodeURIComponent(userMatch[1]).trim())}`
  return null
}

function extractYouTubeChannelPathFromChannelRenderer(
  renderer: any,
): string | null {
  const canonical =
    renderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    ''
  let path = String(canonical).trim()
  if (!path) return null
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname
    } catch {
      return null
    }
  }
  if (!path.startsWith('/')) return null
  const atMatch = path.match(/^\/@[^/?#]+/i)
  if (atMatch?.[0]) return atMatch[0]
  const channelMatch = path.match(/^\/channel\/[^/?#]+/i)
  if (channelMatch?.[0]) return channelMatch[0]
  const userMatch = path.match(/^\/(?:user|c)\/[^/?#]+/i)
  if (userMatch?.[0]) return userMatch[0]
  return null
}

function decodeEscapedUnicode(input: string): string {
  return input
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
}

async function fetchYouTubeFollowersByChannelPath(
  path: string,
): Promise<string | undefined> {
  const normalizedPath = path.trim()
  if (!normalizedPath.startsWith('/')) return undefined
  const key = normalizedPath.toLowerCase()
  const now = Date.now()
  const cached = youtubeSubscriberCache.get(key)
  if (cached && cached.expiresAt > now) return cached.followers

  try {
    const pathsToTry = [
      normalizedPath,
      `${normalizedPath.replace(/\/+$/, '')}/about`,
    ]
    for (const pagePath of pathsToTry) {
      const res = await session.defaultSession.fetch(
        `https://www.youtube.com${pagePath}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            Cookie: 'CONSENT=YES+',
          },
        },
      )
      if (!res.ok) continue
      const html = await res.text()
      const rawCandidates: string[] = []

      const patterns = [
        /"subscriberCountText"\s*:\s*\{"simpleText"\s*:\s*"([^"]+)"/i,
        /"subscriberCountText"\s*:\s*\{"runs"\s*:\s*\[\s*\{"text"\s*:\s*"([^"]+)"/i,
        /"accessibilityData"\s*:\s*\{"label"\s*:\s*"([^"]*subscribers?[^"]*)"/i,
        /\\\"subscriberCountText\\\"\s*:\s*\\\{\\\"simpleText\\\"\s*:\s*\\\"([^\\\"]+)\\\"/i,
        /\\\"subscriberCountText\\\"\s*:\s*\\\{\\\"runs\\\"\s*:\s*\\\[\s*\\\{\\\"text\\\"\s*:\s*\\\"([^\\\"]+)\\\"/i,
      ]

      for (const pattern of patterns) {
        const m = html.match(pattern)
        if (m?.[1]) rawCandidates.push(m[1].trim())
      }

      // Generic extraction from decoded page source for structural variations.
      const decodedHtml = decodeEscapedUnicode(html)
      const genericPatterns = [
        /([\d][\d.,]*\s*[KMB]?)\s*subscribers?/i,
        /([\d][\d.,]*\s*[万亿萬億]?)\s*(?:位)?(?:订阅者|訂閱者)/i,
        /(?:订阅者|訂閱者)(?:数|數)?\s*[:：]?\s*([\d][\d.,]*\s*[万亿萬億]?)/i,
      ]
      for (const pattern of genericPatterns) {
        const m = decodedHtml.match(pattern)
        if (m?.[0]) rawCandidates.push(m[0].trim())
      }

      for (const raw of rawCandidates) {
        const parsed = parseYouTubeSubscriberLabel(decodeEscapedUnicode(raw))
        if (parsed) {
          youtubeSubscriberCache.set(key, {
            expiresAt: now + YOUTUBE_SUBSCRIBER_CACHE_TTL,
            followers: parsed,
          })
          return parsed
        }
      }
    }
  } catch {
    // Ignore network failures; fall back to description text.
  }

  youtubeSubscriberCache.set(key, {
    expiresAt: now + YOUTUBE_SUBSCRIBER_MISS_CACHE_TTL,
  })
  return undefined
}

function looksLikeYouTubeChannelId(input: string): boolean {
  return /^UC[a-zA-Z0-9_-]{20,}$/.test(input.trim())
}

async function searchYouTubeChannelsByKeyword(
  query: string,
): Promise<VideoProbeCandidate[]> {
  if (looksLikeYouTubeChannelId(query)) return []
  const endpoint = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`
  try {
    // Use Electron session fetch to respect system proxy settings
    const res = await session.defaultSession.fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return []
    const html = await res.text()
    const m =
      html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/) ||
      html.match(/window\["ytInitialData"\] = (\{[\s\S]*?\});<\/script>/)
    if (!m?.[1]) return []

    const data = JSON.parse(m[1])
    const renderers: any[] = []
    collectChannelRenderers(data, renderers)

    const seen = new Set<string>()
    const out: VideoProbeCandidate[] = []
    const pendingFollowerFetches: Array<{
      index: number
      channelPath: string
    }> = []
    for (const r of renderers) {
      const channelId = (r.channelId || '').trim()
      if (!channelId || seen.has(channelId)) continue
      seen.add(channelId)
      const name = flattenTextRuns(r.title) || channelId
      const handle = extractYouTubeHandleFromChannelRenderer(r)
      const route = extractYouTubeUserRouteFromChannelRenderer(r)
      const channelPath = extractYouTubeChannelPathFromChannelRenderer(r)
      if (!route) continue
      // Username-only search: channel ID is not used as a search key.
      // Keep the filter soft to avoid dropping relevant candidates for CJK names.
      const searchable = [name, handle, flattenTextRuns(r.descriptionSnippet)]
        .filter(Boolean)
        .join(' ')
      if (!isUsernameMatch(query, searchable) && out.length >= 30) continue
      const description =
        flattenTextRuns(r.descriptionSnippet) || 'YouTube channel'
      const subscriberText = extractYouTubeSubscriberText(r)
      const followers = subscriberText || undefined
      const thumbs = r.thumbnail?.thumbnails as
        | Array<{ url?: string }>
        | undefined
      const image =
        (thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '') ||
        ''
      out.push({
        platform: 'youtube',
        title: `${name} - YouTube`,
        description: handle ? `${description} (@${handle})` : description,
        image,
        feedUrl: `${getRSSHubInstance()}${route}`,
        followers,
      })
      if (!followers && channelPath && pendingFollowerFetches.length < 12) {
        pendingFollowerFetches.push({ index: out.length - 1, channelPath })
      }
      if (out.length >= 120) break
    }

    if (pendingFollowerFetches.length > 0) {
      await Promise.all(
        pendingFollowerFetches.map(async ({ index, channelPath }) => {
          const followers =
            await fetchYouTubeFollowersByChannelPath(channelPath)
          if (followers && out[index]) out[index].followers = followers
        }),
      )
    }
    return out
  } catch {
    return []
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
    searchPromises.push(searchYouTubeChannelsByKeyword(clean))
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

async function probeBilibiliUsersByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<BilibiliUserProbeCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return []
  const candidates: Array<BilibiliUserProbeCandidate & { score: number }> = []
  const seen = new Set<string>()
  try {
    const endpoint = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(clean)}`
    // Use Electron session fetch for consistent network behavior
    const res = await session.defaultSession.fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
      },
    })
    if (res.ok) {
      const json = (await res.json()) as {
        code?: number
        data?: {
          result?: Array<{
            mid?: number
            uname?: string
            usign?: string
            upic?: string
            fans?: number | string
          }>
        }
      }
      if (json.code === 0) {
        for (const user of (json.data?.result || []).slice(0, 80)) {
          const mid = user.mid ? String(user.mid) : ''
          if (!mid || seen.has(mid)) continue
          seen.add(mid)
          const uname = (user.uname || `UID ${mid}`)
            .replace(/<[^>]+>/g, '')
            .trim()
          const usign = (user.usign || 'Bilibili user')
            .replace(/<[^>]+>/g, '')
            .trim()
          const nameTier = computeMatchTier(clean, uname)
          const signTier = computeMatchTier(clean, usign)
          const midTier = computeMatchTier(clean, mid)
          const score = nameTier * 1000 + signTier * 200 + midTier * 120
          if (score <= 0) continue
          const rawFans =
            typeof user.fans === 'string' ? Number(user.fans) : user.fans
          const followers =
            typeof rawFans === 'number' &&
            Number.isFinite(rawFans) &&
            rawFans >= 0
              ? `${formatFollowerCount(rawFans)} 粉丝`
              : undefined
          candidates.push({
            uid: mid,
            title: `${uname} - Bilibili`,
            description: usign,
            image: user.upic || '',
            // Social tab should use dynamic route.
            feedUrl: `${rsshubInstance}/bilibili/user/dynamic/${mid}`,
            followers,
            score,
          })
        }
      }
    }
  } catch {
    // Ignore Bilibili search failures.
  }
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .map(({ score: _score, ...candidate }) => candidate)
}

async function probeXUsersByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<XUserProbeCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return []
  console.log(`[X Search] Starting search for "${clean}"`)

  const out: XUserProbeCandidate[] = []
  const candidateIndexByKey = new Map<string, number>()
  const pushCandidate = (
    usernameRaw: string,
    displayName = '',
    description = 'X user',
    sourceScore = 1,
    followers?: string,
  ) => {
    const username = usernameRaw.trim().replace(/^@+/, '')
    if (!username) return 0
    const key = username.toLowerCase()
    const existingIndex = candidateIndexByKey.get(key)
    if (existingIndex !== undefined) {
      const existing = out[existingIndex] as
        | (XUserProbeCandidate & { sourceScore?: number })
        | undefined
      if (!existing) return 0
      const existingScore = existing.sourceScore || 1
      const nextTitle = displayName
        ? `${displayName} (@${username}) - X`
        : `${username} - X`
      if (followers && !existing.followers) existing.followers = followers
      if (
        description &&
        (existing.description === 'X user' || !existing.description)
      )
        existing.description = description
      if (displayName && !/\(@/.test(existing.title)) existing.title = nextTitle
      if (sourceScore > existingScore) existing.sourceScore = sourceScore
      return 0
    }
    const image = `https://unavatar.io/x/${encodeURIComponent(username)}`
    const title = displayName
      ? `${displayName} (@${username}) - X`
      : `${username} - X`
    out.push({
      username,
      title,
      description,
      image,
      feedUrl: `${rsshubInstance}/x/user/${encodeURIComponent(username)}`,
      followers,
      sourceScore,
    } as XUserProbeCandidate & { sourceScore?: number })
    candidateIndexByKey.set(key, out.length - 1)
    return 1
  }

  // If input already looks like a username, always keep it as a high-priority candidate.
  const directHandle = extractLikelyXHandle(clean)
  if (directHandle) {
    console.log(`[X Search] Input looks like a handle: @${directHandle}`)
    pushCandidate(directHandle, '', 'X user', 3)
  } else {
    // Also support keyword input like "elon musk" -> "elonmusk".
    const compactHandle = extractLikelyXHandleFromKeywords(clean)
    if (compactHandle) {
      console.log(
        `[X Search] Input compacted to handle candidate: @${compactHandle}`,
      )
      pushCandidate(compactHandle, '', 'X user', 2)
    }
  }

  // Try Nitter instances for display name search (works without login)
  for (const nitterInstance of FALLBACK_NITTER_INSTANCES) {
    try {
      const searchUrl = `${nitterInstance}/search?f=users&q=${encodeURIComponent(clean)}`
      console.log(`[X Search] Trying Nitter: ${searchUrl}`)
      const res = await session.defaultSession.fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      console.log(`[X Search] Nitter status: ${res.status}`)
      if (res.ok) {
        const html = await res.text()
        console.log(`[X Search] Nitter HTML length: ${html.length}`)

        // Nitter search results contain user profiles in specific patterns
        // Look for profile links: <a class="profile-link" href="/username">
        const profileLinkRegex =
          /<a[^>]*class="[^"]*profile-card[^"]*"[^>]*href="\/([a-zA-Z0-9_]{1,15})"/gi
        let match
        while ((match = profileLinkRegex.exec(html)) !== null) {
          const username = match[1]
          if (username) {
            // Try to extract display name from the card
            const cardStart = html.lastIndexOf('<', match.index)
            const cardEnd = html.indexOf('</a>', match.index)
            const cardHtml = html.slice(
              Math.max(0, cardStart),
              cardEnd > 0 ? cardEnd + 4 : html.length,
            )
            const nameMatch = cardHtml.match(
              /<div[^>]*class="[^"]*fullname[^"]*"[^>]*>([^<]+)</i,
            )
            const displayName = nameMatch ? nameMatch[1].trim() : ''
            const followersMatch = cardHtml.match(
              /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
            )
            const followers = followersMatch
              ? normalizeXFollowersLabel(followersMatch[0])
              : undefined
            console.log(
              `[X Search] Found via Nitter: @${username} (${displayName})`,
            )
            pushCandidate(username, displayName, '', 2, followers)
            if (out.length >= 10) break
          }
        }

        // Alternative pattern: generic user links
        if (out.length === 0) {
          const userLinkRegex =
            /href="\/([a-zA-Z0-9_]{1,15})"(?![^<]*class="[^"]*(?:search|explore|home)[^"]*")/gi
          const excludePaths = [
            'search',
            'home',
            'explore',
            'i',
            'settings',
            'about',
            'privacy',
            'terms',
          ]
          while ((match = userLinkRegex.exec(html)) !== null) {
            const username = match[1]
            if (excludePaths.includes(username.toLowerCase())) continue
            if (username) {
              console.log(`[X Search] Found via Nitter (alt): @${username}`)
              pushCandidate(username, '', '', 1)
              if (out.length >= 10) break
            }
          }
        }

        if (out.length > 0) break // Found results, no need to try other instances
      }
    } catch (e) {
      console.log(`[X Search] Nitter error:`, e)
    }
  }

  // Try X.com search (requires login for most results, but may work for some queries)
  try {
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(clean)}&f=user`
    console.log(`[X Search] Trying X.com: ${searchUrl}`)
    const res = await session.defaultSession.fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    console.log(`[X Search] X.com status: ${res.status}`)
    if (res.ok) {
      const html = await res.text()
      console.log(`[X Search] X.com HTML length: ${html.length}`)

      // Try to extract user data from __INITIAL_STATE__
      const stateMatch = html.match(
        /<script[^>]*>window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
      )
      if (stateMatch?.[1]) {
        try {
          const data = JSON.parse(stateMatch[1])
          const users = data?.entities?.users?.users || {}
          console.log(
            `[X Search] Found ${Object.keys(users).length} users in __INITIAL_STATE__`,
          )
          for (const [, user] of Object.entries(users) as [string, any][]) {
            const screenName = user?.screen_name
            if (!screenName) continue
            const name = user?.name || ''
            const desc = user?.description || ''
            const followersCount = Number(user?.followers_count)
            const followers =
              Number.isFinite(followersCount) && followersCount > 0
                ? `${formatFollowerCount(followersCount)} followers`
                : undefined
            pushCandidate(screenName, name, desc, 2, followers)
            if (out.length >= 20) break
          }
        } catch (_e) {
          console.log(`[X Search] Failed to parse __INITIAL_STATE__`)
        }
      }

      // Fallback: extract from HTML meta tags and links
      if (out.length === 0) {
        // Look for user profile links in the HTML
        const userLinkRegex =
          /href="\/([a-zA-Z0-9_]{1,15})"(?![^<]*class="[^"]*(?:search|explore|home|status|hashtag)[^"]*")/gi
        let match
        const excludePaths = [
          'search',
          'home',
          'explore',
          'i',
          'status',
          'hashtag',
          'settings',
          'notifications',
          'messages',
          'bookmarks',
          'lists',
          'compose',
          'intent',
          'share',
        ]
        while ((match = userLinkRegex.exec(html)) !== null) {
          const username = match[1]
          if (excludePaths.includes(username.toLowerCase())) continue
          if (username) {
            console.log(`[X Search] Found via HTML: @${username}`)
            pushCandidate(username, '', '', 1)
            if (out.length >= 10) break
          }
        }
      }
    }
  } catch (e) {
    console.log(`[X Search] X.com error:`, e)
  }

  console.log(`[X Search] Total candidates: ${out.length}`)

  // Use sourceScore for sorting
  const scored = out
    .map((candidate: any) => {
      return { candidate, score: candidate.sourceScore || 1 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((item) => {
      const { sourceScore: _sourceScore, ...rest } = item.candidate as any
      return rest as XUserProbeCandidate
    })

  console.log(`[X Search] Final results: ${scored.length}`)
  return scored
}

async function fetchTextViaNodeHttps(
  url: string,
  timeoutMs = 8000,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          resolve(undefined)
          res.resume()
          return
        }
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => resolve(data))
      },
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(undefined)
    })
    req.on('error', () => resolve(undefined))
  })
}

async function fetchXFollowersViaJinaNode(
  usernameRaw: string,
): Promise<string | undefined> {
  const username = usernameRaw.trim().replace(/^@+/, '')
  if (!username) return undefined
  for (const mirrorUrl of [
    `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://mobile.x.com/${encodeURIComponent(username)}`,
  ]) {
    const text = await fetchTextViaNodeHttps(mirrorUrl, 10000)
    if (!text) continue
    const decodedText = decodeHtmlEntities(text)
    const patterns = [
      /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
      /followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i,
    ]
    for (const pattern of patterns) {
      const m = decodedText.match(pattern)
      const raw = m?.[0] || m?.[1] || ''
      const followers = normalizeXFollowersLabel(raw)
      if (followers) return followers
    }
  }
  return undefined
}

async function _fetchXFollowersByUsername(
  usernameRaw: string,
): Promise<string | undefined> {
  const username = usernameRaw.trim().replace(/^@+/, '')
  if (!username) return undefined
  const cacheKey = username.toLowerCase()
  const now = Date.now()
  const cached = xFollowerCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.followers

  // Preferred source: official mobile profile page (usually contains server-rendered follower stats).
  for (const profileUrl of [
    `https://mobile.x.com/${encodeURIComponent(username)}`,
    `https://x.com/${encodeURIComponent(username)}?lang=en`,
  ]) {
    try {
      const res = await session.defaultSession.fetch(profileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) continue
      const html = await res.text()
      const decoded = decodeHtmlEntities(html)

      const patterns = [
        // e.g. "219.3M Followers" / "219.3M followers"
        /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
        // e.g. "Followers: 219.3M"
        /followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i,
        // e.g. href="/elonmusk/followers"...>219.3M</span>
        /\/followers["'][^>]*>[\s\S]{0,240}?>([\d][\d.,]*\s*[KMB]?)</i,
      ]

      for (const pattern of patterns) {
        const m = decoded.match(pattern)
        const raw = m?.[0] || m?.[1] || ''
        const followers = normalizeXFollowersLabel(raw)
        if (followers) {
          xFollowerCache.set(cacheKey, {
            expiresAt: now + X_FOLLOWER_CACHE_TTL,
            followers,
          })
          return followers
        }
      }
    } catch {
      // Continue to next official source.
    }
  }

  // Preferred source: public syndication endpoint (no login required).
  try {
    const endpoint = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(username)}`
    const res = await session.defaultSession.fetch(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://x.com/',
      },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const data = (await res.json()) as Array<{ followers_count?: number }>
      const followersCount = Number(data?.[0]?.followers_count)
      if (Number.isFinite(followersCount) && followersCount > 0) {
        const followers = `${formatFollowerCount(followersCount)} followers`
        xFollowerCache.set(cacheKey, {
          expiresAt: now + X_FOLLOWER_CACHE_TTL,
          followers,
        })
        return followers
      }
    }
  } catch {
    // Ignore and continue with Nitter fallback.
  }

  // Fallback source: parse profile page metadata/state from x.com directly.
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(username)}`
    const res = await session.defaultSession.fetch(profileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const html = await res.text()
      const decoded = decodeHtmlEntities(html)

      // 1) og:description often includes follower count text.
      const ogDescMatch =
        decoded.match(
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        ) ||
        decoded.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        )
      const ogDesc = (ogDescMatch?.[1] || '').trim()
      const ogFollowers =
        normalizeXFollowersLabel(ogDesc) ||
        (() => {
          const m = ogDesc.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
          return m?.[0]?.trim()
        })()
      if (ogFollowers) {
        xFollowerCache.set(cacheKey, {
          expiresAt: now + X_FOLLOWER_CACHE_TTL,
          followers: ogFollowers,
        })
        return ogFollowers
      }

      // 2) JSON state may include followers_count as raw number.
      const numericPatterns = [
        /"followers_count"\s*:\s*(\d{1,12})/i,
        /\\\"followers_count\\\"\s*:\s*(\d{1,12})/i,
      ]
      for (const pattern of numericPatterns) {
        const m = decoded.match(pattern)
        const count = Number(m?.[1])
        if (Number.isFinite(count) && count > 0) {
          const followers = `${formatFollowerCount(count)} followers`
          xFollowerCache.set(cacheKey, {
            expiresAt: now + X_FOLLOWER_CACHE_TTL,
            followers,
          })
          return followers
        }
      }
    }
  } catch {
    // Ignore and continue with Nitter fallback.
  }

  // Fallback source (network-bypass): server-side fetched mirror of x.com page.
  // Useful when local environment can open X in browser but Electron main-process requests are blocked.
  for (const mirrorUrl of [
    `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://mobile.x.com/${encodeURIComponent(username)}`,
  ]) {
    try {
      const res = await session.defaultSession.fetch(mirrorUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (!res.ok) continue
      const text = decodeHtmlEntities(await res.text())
      const patterns = [
        /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
        /followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i,
      ]
      for (const pattern of patterns) {
        const m = text.match(pattern)
        const raw = m?.[0] || m?.[1] || ''
        const followers = normalizeXFollowersLabel(raw)
        if (followers) {
          xFollowerCache.set(cacheKey, {
            expiresAt: now + X_FOLLOWER_CACHE_TTL,
            followers,
          })
          return followers
        }
      }
    } catch {
      // Continue to next fallback source.
    }
  }

  // Final fallback: use Node https client for environments where Electron fetch path differs from browser/proxy behavior.
  const jinaFollowers = await fetchXFollowersViaJinaNode(username)
  if (jinaFollowers) {
    xFollowerCache.set(cacheKey, {
      expiresAt: now + X_FOLLOWER_CACHE_TTL,
      followers: jinaFollowers,
    })
    return jinaFollowers
  }

  for (const nitterInstance of FALLBACK_NITTER_INSTANCES) {
    try {
      const profileUrl = `${nitterInstance}/${encodeURIComponent(username)}`
      const res = await session.defaultSession.fetch(profileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue

      const html = await res.text()
      const decoded = decodeHtmlEntities(html)
      const patterns = [
        /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
        /title=["']followers["'][^>]*>\s*<span[^>]*>\s*([\d][\d.,]*\s*[KMB]?)\s*</i,
      ]
      let followers: string | undefined
      for (const pattern of patterns) {
        const m = decoded.match(pattern)
        const raw = m?.[0] || m?.[1] || ''
        followers = normalizeXFollowersLabel(raw)
        if (followers) break
      }
      if (followers) {
        xFollowerCache.set(cacheKey, {
          expiresAt: now + X_FOLLOWER_CACHE_TTL,
          followers,
        })
        return followers
      }
    } catch {
      // Ignore single-instance failures and continue to next instance.
    }
  }

  xFollowerCache.set(cacheKey, { expiresAt: now + 30 * 1000 })
  return undefined
}

function decodeHtmlEntities(input: string): string {
  if (!input) return ''
  return input
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m
    })
}

function cleanInstagramDisplayName(
  rawTitle: string | undefined,
  username: string,
): string {
  const decoded = decodeHtmlEntities((rawTitle || '').trim())
  if (!decoded) return ''
  const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return decoded
    .replace(new RegExp(`\\s*\\(@?${escapedUser}\\)\\s*`, 'i'), ' ')
    .replace(/\s*[•·]\s*Instagram photos and videos\s*$/i, '')
    .replace(/\s*-\s*Instagram\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeImageUrl(input: string): string {
  return decodeHtmlEntities((input || '').trim()).replace(/\\\//g, '/')
}

function _isInstagramLetterFallbackAvatar(url?: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw.startsWith('data:image/svg+xml')) return false
  return (
    raw.includes('833ab4') || raw.includes('e1306c') || raw.includes('f77737')
  )
}

async function _withSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(undefined)
      })
  })
}

async function tryConvertImageUrlToDataUri(
  imageUrl: string,
): Promise<string | undefined> {
  const normalizedUrl = normalizeImageUrl(imageUrl)
  if (!/^https?:\/\//i.test(normalizedUrl)) return undefined
  try {
    const res = await session.defaultSession.fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.instagram.com/',
        Origin: 'https://www.instagram.com',
        'x-ig-app-id': '936619743392459',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.startsWith('image/')) return undefined
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length < 64) return undefined
    const ext = normalizedUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
    const mime = contentType.startsWith('image/')
      ? contentType.split(';')[0]
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  }
}

async function fetchInstagramAvatarByUsername(
  username: string,
): Promise<string | undefined> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return undefined

  // Method 1: Use Instagram's public JSON endpoint (no auth required)
  try {
    const jsonUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/?__a=1&__d=dis`
    const jsonRes = await session.defaultSession.fetch(jsonUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (jsonRes.ok) {
      const text = await jsonRes.text()
      let jsonText = text
      // Handle JSONP wrapper: for (;;);{...}
      if (jsonText.startsWith('for (;;);')) {
        jsonText = jsonText.substring('for (;;);'.length)
      }
      try {
        const json = JSON.parse(jsonText) as {
          graphql?: {
            user?: { profile_pic_url?: string; profile_pic_url_hd?: string }
          }
          logging_page_id?: string
        }
        const avatarUrl =
          json?.graphql?.user?.profile_pic_url_hd ||
          json?.graphql?.user?.profile_pic_url
        if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) {
          const normalizedAvatarUrl = normalizeImageUrl(avatarUrl)
          console.log(
            `[Instagram Avatar] Found via __a=1 for ${clean}: ${normalizedAvatarUrl.substring(0, 80)}...`,
          )
          const inlined = await tryConvertImageUrlToDataUri(normalizedAvatarUrl)
          if (inlined) return inlined
          return normalizedAvatarUrl
        }
      } catch {
        console.log(`[Instagram Avatar] __a=1 JSON parse failed for ${clean}`)
      }
    }
  } catch (e) {
    console.log(`[Instagram Avatar] __a=1 failed for ${clean}:`, e)
  }

  // Method 2: Parse profile page HTML for og:image
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`
  try {
    const res = await session.defaultSession.fetch(profileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return undefined
    const html = await res.text()

    // Try og:image meta tag
    let avatarUrl: string | undefined
    const ogPatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:image["']/i,
    ]
    for (const pattern of ogPatterns) {
      const og = html.match(pattern)
      if (og?.[1] && /^https?:\/\//i.test(og[1])) {
        avatarUrl = normalizeImageUrl(og[1])
        break
      }
    }

    // Try JSON-LD structured data
    if (!avatarUrl) {
      const jsonLdMatch = html.match(
        /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
      )
      if (jsonLdMatch?.[1]) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1])
          const imageUrl =
            jsonLd?.image?.url || jsonLd?.image?.[0]?.url || jsonLd?.image?.[0]
          if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl))
            avatarUrl = normalizeImageUrl(imageUrl)
        } catch {
          // JSON parse failed, continue
        }
      }
    }

    // Try profile_pic_url_hd in scripts
    if (!avatarUrl) {
      const hd = html.match(/"profile_pic_url_hd"\s*:\s*"(https?:[^"]+)"/i)
      if (hd?.[1]) {
        const decoded = normalizeImageUrl(hd[1])
        if (/^https?:\/\//i.test(decoded)) avatarUrl = decoded
      }
    }

    if (avatarUrl) {
      console.log(
        `[Instagram Avatar] Found via HTML parse for ${clean}: ${avatarUrl.substring(0, 80)}...`,
      )
      // Try to fetch avatar image and convert to base64 data URI
      // Instagram CDN requires specific headers to avoid 403
      try {
        const avatarRes = await session.defaultSession.fetch(avatarUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
            Referer: 'https://www.instagram.com/',
            Origin: 'https://www.instagram.com',
            'x-ig-app-id': '936619743392459',
          },
        })
        if (avatarRes.ok) {
          const contentType = (
            avatarRes.headers.get('content-type') || ''
          ).toLowerCase()
          if (contentType && !contentType.startsWith('image/')) {
            console.log(
              `[Instagram Avatar] Avatar response is not image for ${clean}: ${contentType}`,
            )
            return undefined
          }
          const arrayBuffer = await avatarRes.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          if (buffer.length < 64) return undefined
          const extension = avatarUrl
            .split('.')
            .pop()
            ?.split('?')[0]
            ?.toLowerCase()
          const mimeType = contentType.startsWith('image/')
            ? contentType.split(';')[0]
            : extension === 'jpg' || extension === 'jpeg'
              ? 'image/jpeg'
              : extension === 'png'
                ? 'image/png'
                : extension === 'webp'
                  ? 'image/webp'
                  : extension === 'gif'
                    ? 'image/gif'
                    : 'image/jpeg'
          const base64 = buffer.toString('base64')
          console.log(
            `[Instagram Avatar] Converted to base64 for ${clean} (${buffer.length} bytes)`,
          )
          return `data:${mimeType};base64,${base64}`
        } else {
          console.log(
            `[Instagram Avatar] Avatar fetch failed for ${clean}: ${avatarRes.status}`,
          )
        }
      } catch (e) {
        console.log(`[Instagram Avatar] Avatar fetch error for ${clean}:`, e)
      }
      return avatarUrl
    }

    // Try picuki.com (Instagram第三方查看器) as alternative source
    try {
      const picukiUrl = `https://www.picuki.com/profile/${encodeURIComponent(clean)}`
      const picukiRes = await session.defaultSession.fetch(picukiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })
      if (picukiRes.ok) {
        const picukiHtml = await picukiRes.text()
        // Try to extract profile image from picuki
        const picukiAvatarMatch =
          picukiHtml.match(
            /<img[^>]+class="[^"]*profile[^"]*"[^>]+src=["']([^"']+)["']/i,
          ) ||
          picukiHtml.match(
            /<img[^>]+src=["']([^"']*picuki[^"']*profile[^"']*)["'][^>]*class=["'][^"']*profile[^"']*["']/i,
          ) ||
          picukiHtml.match(
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          )
        if (
          picukiAvatarMatch?.[1] &&
          /^https?:\/\//i.test(picukiAvatarMatch[1])
        ) {
          const avatarFromPicuki = picukiAvatarMatch[1]
          console.log(
            `[Instagram Avatar] Found via picuki for ${clean}: ${avatarFromPicuki.substring(0, 80)}...`,
          )
          // Try to fetch as base64
          try {
            const res = await session.defaultSession.fetch(avatarFromPicuki, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
              },
            })
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              const ext = avatarFromPicuki
                .split('.')
                .pop()
                ?.split('?')[0]
                ?.toLowerCase()
              const mime =
                ext === 'jpg' || ext === 'jpeg'
                  ? 'image/jpeg'
                  : ext === 'png'
                    ? 'image/png'
                    : ext === 'webp'
                      ? 'image/webp'
                      : ext === 'gif'
                        ? 'image/gif'
                        : 'image/jpeg'
              return `data:${mime};base64,${buffer.toString('base64')}`
            }
          } catch {
            // Ignore and continue to fallback avatar
          }
        }
      }
    } catch (e) {
      console.log(`[Instagram Avatar] picuki failed for ${clean}:`, e)
    }

    console.log(`[Instagram Avatar] No avatar found for ${clean}`)
    return undefined
  } catch (e) {
    console.log(`[Instagram Avatar] HTML parse failed for ${clean}:`, e)
  }

  return undefined
}

// Extract likely Instagram username from query
function extractLikelyInstagramHandle(query: string): string | null {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return null
  // Instagram username: 1-30 chars, letters/digits/underscores/periods
  if (!/^[a-zA-Z0-9_.]{1,30}$/.test(clean)) return null
  return clean
}

type InstagramUserProbeCandidate = {
  username: string
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

async function probeInstagramUsersByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<InstagramUserProbeCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return []
  console.log(`[Instagram Search] Starting search for "${clean}"`)

  const out: InstagramUserProbeCandidate[] = []
  const seen = new Set<string>()
  const pushCandidate = (
    usernameRaw: string,
    displayName = '',
    description = 'Instagram user',
    _sourceScore = 1,
  ) => {
    const username = usernameRaw.trim().replace(/^@+/, '')
    if (!username) return 0
    const key = username.toLowerCase()
    if (seen.has(key)) return 0
    seen.add(key)
    out.push({
      ...createInstagramDiscoverCandidate({
        username,
        rsshubInstance,
        displayName,
        description,
      }),
    } as InstagramUserProbeCandidate & { sourceScore?: number })
    return 1
  }

  // If input already looks like a username, always keep it as a high-priority candidate
  const directHandle = extractLikelyInstagramHandle(clean)
  if (directHandle) {
    console.log(
      `[Instagram Search] Input looks like a handle: @${directHandle}`,
    )
    pushCandidate(directHandle, '', '', 3)
  }

  // Try to fetch profile info if it looks like a valid username
  if (directHandle) {
    try {
      const profileUrl = `https://www.instagram.com/${encodeURIComponent(directHandle)}/`
      console.log(`[Instagram Search] Trying to fetch profile: ${profileUrl}`)
      const res = await session.defaultSession.fetch(profileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS),
      })
      if (res.ok) {
        const html = await res.text()
        // Try to extract display name from meta tags
        const ogTitle =
          html.match(
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
          )?.[1] ||
          html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
          )?.[1]
        const ogDesc =
          html.match(
            /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
          )?.[1] ||
          html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
          )?.[1]

        // Try to extract followers from JSON-LD structured data
        let followersFromJsonLd: string | undefined
        const jsonLdScripts = html.match(
          /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        )
        if (jsonLdScripts) {
          for (const script of jsonLdScripts) {
            const jsonMatch = script.match(
              /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
            )
            if (jsonMatch?.[1]) {
              try {
                const jsonLd = JSON.parse(jsonMatch[1])
                // Instagram uses @type: "Profile" with followedBy count
                const followedBy =
                  jsonLd?.aggregateRating?.ratingCount ||
                  jsonLd?.interactionStatistic?.find(
                    (s: {
                      interactionType: string
                      userInteractionCount: number
                    }) => s?.interactionType?.includes('Follow'),
                  )?.userInteractionCount ||
                  jsonLd?.aggregateRating?.reviewCount
                if (followedBy && typeof followedBy === 'number') {
                  followersFromJsonLd = formatFollowerCount(followedBy)
                  break
                }
              } catch {
                // JSON parse failed, continue to next script
              }
            }
          }
        }

        // Also try to extract from window._sharedData if available
        if (!followersFromJsonLd) {
          const sharedDataMatch = html.match(
            /window\._sharedData\s*=\s*({.+?});\s*<\/script>/i,
          )
          if (sharedDataMatch?.[1]) {
            try {
              const sharedData = JSON.parse(sharedDataMatch[1])
              const entryData =
                sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user
              if (entryData) {
                const count =
                  entryData.edge_followed_by?.count || entryData.follower_count
                if (count) {
                  followersFromJsonLd = formatFollowerCount(count)
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        if (ogTitle || ogDesc || followersFromJsonLd) {
          // Extract follower count from og:description (e.g., "1.2M followers")
          let followers: string | undefined
          if (ogDesc) {
            const followersMatch = ogDesc.match(/([\d.]+[KMB]?)\s*followers?/i)
            if (followersMatch) {
              followers = followersMatch[1] + ' followers'
            }
          }
          // Use JSON-LD followers if og:description didn't have it
          followers = followers || followersFromJsonLd
          const displayName = cleanInstagramDisplayName(ogTitle, directHandle)
          if (
            displayName &&
            displayName.toLowerCase() !== directHandle.toLowerCase()
          ) {
            console.log(`[Instagram Search] Found display name: ${displayName}`)
            // Update the first candidate with better info
            const first = out[0]
            if (first) {
              first.title = `${displayName} (@${directHandle}) - Instagram`
              first.description = followers
                ? `${followers}`
                : ogDesc || 'Instagram user'
              first.followers = followers
            }
          } else if (followers) {
            // Even without display name, update with follower count
            const first = out[0]
            if (first) {
              first.description = followers
              first.followers = followers
            }
          }
        }
      }
    } catch (e) {
      console.log(`[Instagram Search] Profile fetch error:`, e)
    }
  }

  console.log(`[Instagram Search] Total candidates: ${out.length}`)
  return out
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
              description: data.description || '鐩存帴 URL 璁㈤槄',
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
        return { success: false, error: String(error) }
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
