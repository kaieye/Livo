import RssParser from 'rss-parser'
import https from 'https'
import http from 'http'
import { session } from 'electron'
import { fetchBilibiliDynamicFeedFromOfficialApi } from '../bilibili/bilibili-dynamic'
import { isMirrorHost } from '../../../shared/url-detect'
import {
  fetchBilibiliVideoFeedFromSpacePage,
  mapParsedDynamicFeedToVideoFeed,
} from '../bilibili/bilibili-video-feed'
import { assertNetworkFetchUrl } from '../system/network-url-policy'

const parser = new RssParser({
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
  },
  customFields: {
    item: [
      ['content:encoded', 'content:encoded'],
      // NOTE: Do NOT add ["content", "content"] here — it overwrites rss-parser's
      // built-in Atom handling and turns the content string into an xml2js object
      // { _: "html", $: { type: "html" } }, breaking image extraction from HTML body.
      ['description', 'description'],
      ['summary', 'summary'],
      ['link', 'atomLinks', { keepArray: true }],
      ['itunes:summary', 'itunesSummary'],
      ['itunes:subtitle', 'itunesSubtitle'],
      ['itunes:duration', 'itunesDuration'],
      ['itunes:image', 'itunesImage'],
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['media:group', 'media:group'],
    ],
  },
})

export interface FetchFeedOptions {
  /** Skip fallback path probing — use when the URL is already a known feed URL (e.g. from OPML) */
  skipFallback?: boolean
  /** ETag from previous fetch — enables conditional GET (returns null on 304) */
  etag?: string
  /** Last-Modified from previous fetch — enables conditional GET (returns null on 304) */
  lastModified?: string
}

export interface FetchFeedResult {
  data: RssParser.Output<Record<string, any>> | null
  /** HTTP 304 Not Modified — no new data */
  notModified: boolean
  /** Response ETag header (store for next request) */
  etag?: string
  /** Response Last-Modified header (store for next request) */
  lastModified?: string
}

const TWITTER_RSSHUB_FALLBACKS = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub-instance.zeabur.app',
]
const RSSHUB_FALLBACK_ROUTE_PREFIX =
  /^\/(?:bilibili|twitter|youtube|instagram|github|weibo|zhihu|xiaoyuzhou)\//i
const TWITTER_NITTER_FALLBACKS = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.space',
  'https://nitter.1d4.us',
]

const INSTAGRAM_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

async function getInstagramSessionCookie(): Promise<string | null> {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: 'instagram.com',
    })
    const sessionid = cookies.find((c) => c.name === 'sessionid')
    const dsUserId = cookies.find((c) => c.name === 'ds_user_id')
    if (sessionid?.value) {
      const cookieParts = [`sessionid=${sessionid.value}`]
      if (dsUserId?.value) {
        cookieParts.push(`ds_user_id=${dsUserId.value}`)
      }
      return cookieParts.join('; ')
    }
  } catch {
    // Ignore cookie retrieval errors.
  }
  return null
}

function isInstagramRelatedUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('instagram.com') ||
    lower.includes('cdninstagram.com') ||
    lower.includes('fbcdn.net') ||
    /\/instagram\//i.test(lower) ||
    /\/picnob\//i.test(lower) ||
    /\/pixnoy\//i.test(lower) ||
    /\/piokok\//i.test(lower) ||
    /\/pixwox\//i.test(lower)
  )
}

const FEED_REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
}

function buildRequestHeaders(
  url: string,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const headers = { ...FEED_REQUEST_HEADERS, ...extraHeaders }

  // For Instagram-related URLs, use mobile User-Agent
  if (isInstagramRelatedUrl(url)) {
    headers['User-Agent'] = INSTAGRAM_MOBILE_UA
  }

  return headers
}
const DEFAULT_FETCH_TIMEOUTS = [8000, 12000]
const DEFAULT_CONDITIONAL_TIMEOUT_MS = 15000
const FAST_FETCH_TIMEOUTS = [4000, 7000]
const FAST_CONDITIONAL_TIMEOUT_MS = 7000

interface FetchTextOptions {
  attemptTimeouts?: number[]
  conditionalTimeoutMs?: number
}

function isPlaceholderMirrorPostUrl(url: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw) return false
  return /https?:\/\/(?:www\.)?(?:pixnoy|picnob|piokok)\.com\/post\/[^/?#]+\/undefined(?:[?#]|$)/i.test(
    raw,
  )
}

function isPicnobMirrorHost(host: string): boolean {
  return isMirrorHost(host)
}

function collectMediaContentNodes(item: Record<string, any>): unknown[] {
  const nodes: unknown[] = []
  const direct = item['media:content'] as unknown
  if (direct) nodes.push(...(Array.isArray(direct) ? direct : [direct]))

  const groups = item['media:group'] as unknown
  if (groups) {
    const groupList = Array.isArray(groups) ? groups : [groups]
    for (const group of groupList) {
      if (!group || typeof group !== 'object') continue
      const groupRec = group as Record<string, unknown>
      const groupContent = groupRec['media:content'] as unknown
      if (groupContent)
        nodes.push(
          ...(Array.isArray(groupContent) ? groupContent : [groupContent]),
        )
    }
  }

  return nodes
}

function isLikelyImageCandidateUrl(url: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw || isPlaceholderMirrorPostUrl(raw)) return false
  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(?:\?[^\s"'<>]*)?$/i.test(raw) ||
    raw.includes('cdninstagram') ||
    raw.includes('scontent.') ||
    raw.includes('fbcdn.net') ||
    raw.includes('pbs.twimg.com/media/') ||
    raw.includes('twimg.com/media/') ||
    raw.includes('/pic/media%2f') ||
    raw.includes('/pic/orig/media%2f') ||
    raw.includes('/p/pt_')
  )
}

function countContentImageCandidates(content: string): number {
  const raw = String(content || '')
  if (!raw) return 0

  const candidates = new Set<string>()
  const push = (value: string) => {
    const normalized = String(value || '').trim()
    if (normalized && isLikelyImageCandidateUrl(normalized))
      candidates.add(normalized)
  }

  for (const match of raw.matchAll(
    /<(?:img|source)\b[^>]+(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/gi,
  )) {
    push(match[1] || '')
  }

  for (const match of raw.matchAll(/srcset=["']([^"']+)["']/gi)) {
    const srcset = match[1] || ''
    for (const part of srcset.split(',')) {
      push(part.trim().split(/\s+/)[0] || '')
    }
  }

  for (const match of raw.match(/https?:\/\/[^\s"'<>]+/g) || []) {
    push(match)
  }

  const imgTagCount = (raw.match(/<img\b/gi) || []).length
  return Math.max(candidates.size, imgTagCount)
}

function countItemImageSignals(item: Record<string, any>): number {
  let count = 0
  const seen = new Set<string>()
  const push = (value: string) => {
    const normalized = String(value || '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    count += 1
  }

  for (const media of collectMediaContentNodes(item)) {
    const rec =
      media && typeof media === 'object' ? (media as Record<string, any>) : null
    const attrs = rec?.$ && typeof rec.$ === 'object' ? rec.$ : rec
    const url = String(attrs?.url || '')
    const type = String(attrs?.type || '').toLowerCase()
    const medium = String(attrs?.medium || '').toLowerCase()
    if (
      url &&
      (type.startsWith('image/') ||
        medium === 'image' ||
        isLikelyImageCandidateUrl(url))
    ) {
      push(url)
    }
  }

  const thumb = item['media:thumbnail'] as unknown
  if (thumb) {
    const thumbs = Array.isArray(thumb) ? thumb : [thumb]
    for (const media of thumbs) {
      const rec =
        media && typeof media === 'object'
          ? (media as Record<string, any>)
          : null
      const attrs = rec?.$ && typeof rec.$ === 'object' ? rec.$ : rec
      const url = String(attrs?.url || '')
      if (url) push(url)
    }
  }

  const enclosureType = String(item.enclosure?.type || '').toLowerCase()
  const enclosureUrl = String(item.enclosure?.url || '')
  if (
    enclosureUrl &&
    (enclosureType.startsWith('image/') ||
      isLikelyImageCandidateUrl(enclosureUrl))
  ) {
    push(enclosureUrl)
  }

  count += countContentImageCandidates(
    String(item['content:encoded'] || item.content || item.description || ''),
  )
  return count
}

function extractTwitterUsernameFromFeedUrl(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    if (u.protocol.toLowerCase() === 'rsshub:') {
      const host = (u.hostname || '').toLowerCase()
      const parts = u.pathname.split('/').filter(Boolean)
      if (
        (host === 'twitter' || host === 'x') &&
        parts[0]?.toLowerCase() === 'user' &&
        parts[1]
      ) {
        return decodeURIComponent(parts[1]).replace(/^@/, '').toLowerCase()
      }
    }

    const rsshubMatch = u.pathname.match(/\/(?:twitter|x)\/user\/([^/?#]+)/i)
    if (rsshubMatch?.[1])
      return decodeURIComponent(rsshubMatch[1]).replace(/^@/, '').toLowerCase()

    if (u.hostname.toLowerCase().includes('nitter')) {
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length >= 2 && parts[1].toLowerCase() === 'rss') {
        return decodeURIComponent(parts[0]).replace(/^@/, '').toLowerCase()
      }
    }
  } catch {
    // Ignore invalid URL.
  }
  return null
}

function extractTwitterUserRoutePathAndQuery(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    if (u.protocol.toLowerCase() === 'rsshub:') {
      const host = (u.hostname || '').toLowerCase()
      if (host === 'twitter' || host === 'x') {
        const path = `/${host}${u.pathname || ''}`.replace(/\/+/g, '/')
        if (/^\/(?:twitter|x)\/user\//i.test(path)) {
          return `${path}${u.search || ''}`
        }
      }
    }

    const match = u.pathname.match(/(\/(?:twitter|x)\/user\/[^?#]+)/i)
    if (match?.[1]) {
      return `${match[1]}${u.search || ''}`
    }
  } catch {
    // Ignore invalid URL.
  }
  return null
}

function extractInstagramUsernameFromFeedUrl(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    if (u.protocol.toLowerCase() === 'rsshub:') {
      const host = (u.hostname || '').toLowerCase()
      const parts = u.pathname.split('/').filter(Boolean)
      if (
        (host === 'instagram' ||
          host === 'picnob' ||
          host === 'picnob.info' ||
          host === 'pixnoy' ||
          host === 'piokok' ||
          host === 'pixwox') &&
        parts[0]?.toLowerCase() === 'user' &&
        parts[1]
      ) {
        return decodeURIComponent(parts[1]).replace(/^@/, '')
      }
    }

    const path = u.pathname || ''
    const instagramMatch = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (instagramMatch?.[1])
      return decodeURIComponent(instagramMatch[1]).replace(/^@/, '')
    const picnobMatch = path.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnobMatch?.[1])
      return decodeURIComponent(picnobMatch[1]).replace(/^@/, '')
    const pixnoyMatch = path.match(/\/pixnoy\/user\/([^/?#]+)/i)
    if (pixnoyMatch?.[1])
      return decodeURIComponent(pixnoyMatch[1]).replace(/^@/, '')
    const piokokMatch = path.match(/\/piokok\/user\/([^/?#]+)/i)
    if (piokokMatch?.[1])
      return decodeURIComponent(piokokMatch[1]).replace(/^@/, '')
    const pixwoxMatch = path.match(/\/pixwox\/user\/([^/?#]+)/i)
    if (pixwoxMatch?.[1])
      return decodeURIComponent(pixwoxMatch[1]).replace(/^@/, '')
  } catch {
    // Ignore invalid URL.
  }
  return null
}

function getLatestItemTimestamp(
  feed: RssParser.Output<Record<string, any>>,
): number {
  let latest = 0
  for (const item of feed.items || []) {
    const iso = item.isoDate || item.pubDate
    const t = iso ? new Date(iso).getTime() : 0
    if (Number.isFinite(t) && t > latest) latest = t
  }
  return latest
}

function scoreFeedQuality(feed: RssParser.Output<Record<string, any>>): number {
  let score = 0
  for (const item of feed.items || []) {
    const record = item as Record<string, any>
    score += Math.max(0, scoreFeedItemRichness(record))
    if (itemHasImageSignal(record)) score += 180
  }
  return score
}

function pickBetterFeed(
  current: RssParser.Output<Record<string, any>> | null,
  incoming: RssParser.Output<Record<string, any>>,
): RssParser.Output<Record<string, any>> {
  if (!current) return incoming
  const currentCount = current.items?.length || 0
  const incomingCount = incoming.items?.length || 0
  if (incomingCount > currentCount) return incoming
  if (incomingCount < currentCount) return current

  const currentLatest = getLatestItemTimestamp(current)
  const incomingLatest = getLatestItemTimestamp(incoming)
  if (incomingLatest > currentLatest) return incoming
  if (incomingLatest < currentLatest) return current

  const currentQuality = scoreFeedQuality(current)
  const incomingQuality = scoreFeedQuality(incoming)
  return incomingQuality > currentQuality ? incoming : current
}

function isLikelyThinOrStaleFeed(
  feed: RssParser.Output<Record<string, any>> | null,
): boolean {
  if (!feed) return true
  const count = feed.items?.length || 0
  if (count <= 3) return true
  const latestTs = getLatestItemTimestamp(feed)
  if (!latestTs) return true
  const ageMs = Date.now() - latestTs
  // If latest item is older than 3 days, treat as stale and try slower fallback merge.
  return ageMs > 3 * 24 * 60 * 60 * 1000
}

function pickBetterNullableFeed(
  current: RssParser.Output<Record<string, any>> | null,
  incoming: RssParser.Output<Record<string, any>> | null,
): RssParser.Output<Record<string, any>> | null {
  if (!incoming) return current
  return pickBetterFeed(current, incoming)
}

function getFeedItemKey(item: Record<string, any>): string {
  const link = String(item.link || '').trim()

  const extractInstagramAssetIdFromUrl = (rawUrl: string): string => {
    const raw = (rawUrl || '').trim()
    if (!raw) return ''
    try {
      const parsed = new URL(raw)
      const host = parsed.hostname.toLowerCase()
      if (isPicnobMirrorHost(host) && parsed.pathname === '/get') {
        const nested = parsed.searchParams.get('url') || ''
        if (nested) return extractInstagramAssetIdFromUrl(nested)
      }
      if (
        (host.includes('pixnoy') ||
          host.includes('picnob') ||
          host.includes('piokok') ||
          host.includes('pixwox')) &&
        parsed.searchParams.has('o')
      ) {
        const encoded = parsed.searchParams.get('o') || ''
        if (encoded) {
          const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
          const padded =
            normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
          try {
            const decoded = Buffer.from(padded, 'base64').toString('utf-8')
            const nestedMatch = decoded.match(/https?:\/\/\S+/i)
            const nested = nestedMatch?.[0] || decoded
            const nestedId = extractInstagramAssetIdFromUrl(nested)
            if (nestedId) return nestedId
          } catch {
            // Ignore invalid base64 payload.
          }
        }
      }
      const directMatch = raw.match(/_(\d{14,})_/)
      if (directMatch?.[1]) return directMatch[1]
      const normalizedUrl = decodeURIComponent(raw)
      const normalizedMatch = normalizedUrl.match(/_(\d{14,})_/)
      if (normalizedMatch?.[1]) return normalizedMatch[1]
    } catch {
      // Ignore parse failures and try direct fallback below.
    }
    const directMatch = raw.match(/_(\d{14,})_/)
    if (directMatch?.[1]) return directMatch[1]
    return ''
  }

  const extractInstagramAssetIdFromItem = (
    record: Record<string, any>,
  ): string => {
    const candidates: string[] = []
    const maybePush = (value: unknown): void => {
      if (typeof value === 'string' && value.trim())
        candidates.push(value.trim())
    }
    maybePush(record.link)
    maybePush(record.enclosure?.url)

    const mediaContent = record['media:content'] as unknown
    if (mediaContent) {
      const mediaList = Array.isArray(mediaContent)
        ? mediaContent
        : [mediaContent]
      for (const media of mediaList) {
        if (!media || typeof media !== 'object') continue
        const rec = media as Record<string, any>
        const attrs = rec.$ && typeof rec.$ === 'object' ? rec.$ : rec
        maybePush(attrs?.url)
      }
    }

    const thumb = record['media:thumbnail'] as unknown
    if (thumb && typeof thumb === 'object') {
      const rec = thumb as Record<string, any>
      const attrs = rec.$ && typeof rec.$ === 'object' ? rec.$ : rec
      maybePush(attrs?.url)
    }

    const content = String(
      record['content:encoded'] || record.content || record.description || '',
    )
    for (const m of content.match(/https?:\/\/[^\s"'<>]+/g) || []) {
      candidates.push(m)
    }

    for (const candidate of candidates) {
      const id = extractInstagramAssetIdFromUrl(candidate)
      if (id) return id
    }
    return ''
  }

  const instagramAssetId = extractInstagramAssetIdFromItem(item)
  if (instagramAssetId) {
    return `iga:${instagramAssetId}`
  }

  // For Instagram/Picnob feeds, try to extract post ID from URL first
  // This handles cases where different RSSHub instances return different URL formats
  // (e.g., picnob.com/post/xxx vs picnob.info/post/xxx vs instagram.com/p/xxx)
  if (link) {
    const picnobMatch = link.match(
      /\/(?:picnob\.com\/post\/|picnob\.info\/post\/|pixnoy\.com\/post\/|pixwox\.com\/post\/|piokok\.com\/post\/|instagram\.com\/p\/|instagram\.com\/reel\/|dumpor\.com\/v\/)([a-zA-Z0-9_-]+)/i,
    )
    if (picnobMatch?.[1]) {
      return `ig:${picnobMatch[1]}`
    }
    return `u:${link}`
  }

  // Try to extract post ID from content/description if no link
  const content = String(
    item['content:encoded'] || item.content || item.description || '',
  )
  const contentLinkMatch = content.match(
    /https:\/\/(?:www\.)?(?:picnob\.com\/post\/|picnob\.info\/post\/|pixnoy\.com\/post\/|pixwox\.com\/post\/|piokok\.com\/post\/|instagram\.com\/p\/|instagram\.com\/reel\/|dumpor\.com\/v\/)([a-zA-Z0-9_-]+)/i,
  )
  if (contentLinkMatch?.[1]) {
    return `ig:${contentLinkMatch[1]}`
  }

  const title = String(item.title || '')
    .trim()
    .toLowerCase()
  const iso = String(item.isoDate || item.pubDate || '').trim()
  return `t:${title}\n${iso}`
}

function scoreFeedItemRichness(item: Record<string, any>): number {
  const contentLen = String(
    item['content:encoded'] || item.content || item.description || '',
  ).length
  const summaryLen = String(item.contentSnippet || item.summary || '').length
  const mediaCount = collectMediaContentNodes(item).length
  const imageSignalCount = countItemImageSignals(item)
  const thumbnail = item['media:thumbnail'] ? 1 : 0
  const enclosure = item.enclosure?.url ? 1 : 0

  let placeholderPenalty = 0
  if (
    item.enclosure?.url &&
    isPlaceholderMirrorPostUrl(String(item.enclosure.url))
  ) {
    placeholderPenalty += 600
  }

  const mediaContent = collectMediaContentNodes(item)
  if (mediaContent.length > 0) {
    const list = mediaContent
    for (const media of list) {
      const rec =
        media && typeof media === 'object'
          ? (media as Record<string, any>)
          : null
      const attrs = rec?.$ && typeof rec.$ === 'object' ? rec.$ : rec
      const url = String(attrs?.url || '')
      if (url && isPlaceholderMirrorPostUrl(url)) placeholderPenalty += 600
    }
  }

  const content = String(
    item['content:encoded'] || item.content || item.description || '',
  )
  for (const candidate of content.match(/https?:\/\/[^\s"'<>]+/g) || []) {
    if (isPlaceholderMirrorPostUrl(candidate)) placeholderPenalty += 400
  }

  return (
    mediaCount * 300 +
    imageSignalCount * 220 +
    thumbnail * 180 +
    enclosure * 140 +
    contentLen +
    summaryLen -
    placeholderPenalty
  )
}

function mergeFeedsPreferRicher(
  first: RssParser.Output<Record<string, any>>,
  second: RssParser.Output<Record<string, any>>,
): RssParser.Output<Record<string, any>> {
  const merged = new Map<string, Record<string, any>>()
  const put = (item: Record<string, any>) => {
    const key = getFeedItemKey(item)
    const existing = merged.get(key)
    if (
      !existing ||
      scoreFeedItemRichness(item) >= scoreFeedItemRichness(existing)
    ) {
      merged.set(key, item)
    }
  }
  for (const item of first.items || []) put(item)
  for (const item of second.items || []) put(item)

  const items = Array.from(merged.values()).sort((a, b) => {
    const aTs = new Date(a.isoDate || a.pubDate || 0).getTime() || 0
    const bTs = new Date(b.isoDate || b.pubDate || 0).getTime() || 0
    return bTs - aTs
  })

  return {
    ...(first || second),
    title: first.title || second.title,
    link: first.link || second.link,
    description: first.description || second.description,
    image: first.image || second.image,
    items,
  } as RssParser.Output<Record<string, any>>
}

function itemHasImageSignal(item: Record<string, any>): boolean {
  const mediaContent = collectMediaContentNodes(item)
  if (mediaContent.length > 0) {
    const list = mediaContent
    for (const media of list) {
      const rec =
        media && typeof media === 'object'
          ? (media as Record<string, any>)
          : null
      const attrs = rec?.$ && typeof rec.$ === 'object' ? rec.$ : rec
      const url = String(attrs?.url || '')
      const type = String(attrs?.type || '').toLowerCase()
      const medium = String(attrs?.medium || '').toLowerCase()
      if (
        url &&
        !isPlaceholderMirrorPostUrl(url) &&
        (type.startsWith('image/') ||
          medium === 'image' ||
          isLikelyImageCandidateUrl(url))
      ) {
        return true
      }
    }
  }

  const thumb = item['media:thumbnail'] as unknown
  if (thumb) return true

  const enclosureType = String(item.enclosure?.type || '').toLowerCase()
  const enclosureUrl = String(item.enclosure?.url || '')
  if (
    !isPlaceholderMirrorPostUrl(enclosureUrl) &&
    ((enclosureType.startsWith('image/') && enclosureUrl) ||
      /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(enclosureUrl))
  ) {
    return true
  }

  const content = String(
    item['content:encoded'] || item.content || item.description || '',
  )
  if (/(?:data-src|data-original|data-lazy-src|srcset)\s*=/i.test(content))
    return true
  const contentCandidates = content.match(/https?:\/\/[^\s"'<>]+/g) || []
  for (const candidate of contentCandidates) {
    if (isLikelyImageCandidateUrl(candidate)) {
      return true
    }
  }

  return false
}

async function pickBestRsshubFallbackFeed(
  candidates: string[],
  fast = false,
): Promise<RssParser.Output<Record<string, any>> | null> {
  let bestFeed: RssParser.Output<Record<string, any>> | null = null
  const fetchOptions = fast
    ? {
        attemptTimeouts: FAST_FETCH_TIMEOUTS,
        conditionalTimeoutMs: FAST_CONDITIONAL_TIMEOUT_MS,
      }
    : undefined
  const tasks = candidates.map(async (candidate) => {
    try {
      return await parseFeedUrl(candidate, fetchOptions)
    } catch {
      return null
    }
  })
  const results = await Promise.all(tasks)
  for (const parsed of results) {
    if (!parsed) continue
    bestFeed = pickBetterFeed(bestFeed, parsed)
  }
  return bestFeed
}

async function mergeAllRsshubFallbackFeeds(
  candidates: string[],
  fast = false,
): Promise<RssParser.Output<Record<string, any>> | null> {
  const fetchOptions = fast
    ? {
        attemptTimeouts: FAST_FETCH_TIMEOUTS,
        conditionalTimeoutMs: FAST_CONDITIONAL_TIMEOUT_MS,
      }
    : undefined
  const tasks = candidates.map(async (candidate) => {
    try {
      return await parseFeedUrl(candidate, fetchOptions)
    } catch {
      return null
    }
  })
  const results = await Promise.all(tasks)
  let merged: RssParser.Output<Record<string, any>> | null = null
  for (const parsed of results) {
    if (!parsed) continue
    merged = merged ? mergeFeedsPreferRicher(merged, parsed) : parsed
  }
  return merged
}

function buildRsshubFallbackCandidates(feedUrl: string): string[] {
  try {
    const parsed = new URL(feedUrl)
    const host = parsed.hostname.toLowerCase()
    const pathAndQuery = `${parsed.pathname}${parsed.search}`
    const looksLikeRsshubRoute = RSSHUB_FALLBACK_ROUTE_PREFIX.test(
      parsed.pathname,
    )
    if (!pathAndQuery || (!host.includes('rsshub') && !looksLikeRsshubRoute))
      return [feedUrl]

    const candidates = new Set<string>()
    candidates.add(feedUrl)
    for (const base of TWITTER_RSSHUB_FALLBACKS) {
      candidates.add(`${base.replace(/\/+$/, '')}${pathAndQuery}`)
    }
    return [...candidates]
  } catch {
    return [feedUrl]
  }
}

function isRsshubLikeUrl(feedUrl: string): boolean {
  try {
    const parsed = new URL(feedUrl)
    const host = parsed.hostname.toLowerCase()
    if (host.includes('rsshub')) return true
    return RSSHUB_FALLBACK_ROUTE_PREFIX.test(parsed.pathname)
  } catch {
    return false
  }
}

function isBilibiliDynamicUrl(feedUrl: string): boolean {
  try {
    const parsed = new URL(feedUrl)
    return /(?:^|\/)bilibili\/user\/dynamic\//i.test(
      `${parsed.hostname}${parsed.pathname}`,
    )
  } catch {
    return /(?:^|\/)bilibili\/user\/dynamic\//i.test(feedUrl)
  }
}

function isBilibiliVideoUrl(feedUrl: string): boolean {
  try {
    const parsed = new URL(feedUrl)
    return /(?:^|\/)bilibili\/user\/video\//i.test(
      `${parsed.hostname}${parsed.pathname}`,
    )
  } catch {
    return /(?:^|\/)bilibili\/user\/video\//i.test(feedUrl)
  }
}

/**
 * Fetch URL with conditional GET support (ETag / If-Modified-Since).
 * Returns null body + notModified=true on 304.
 */
async function fetchWithConditional(
  url: string,
  etag?: string,
  lastModified?: string,
  timeoutMs = DEFAULT_CONDITIONAL_TIMEOUT_MS,
  cookie?: string | null,
  redirectDepth = 0,
): Promise<{
  body: string | null
  notModified: boolean
  etag?: string
  lastModified?: string
}> {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 5) {
      reject(new Error('Too many redirects'))
      return
    }
    const parsedUrl = new URL(url)
    const transport = parsedUrl.protocol === 'https:' ? https : http

    const headers: Record<string, string> = { ...FEED_REQUEST_HEADERS }
    if (etag) headers['If-None-Match'] = etag
    if (lastModified) headers['If-Modified-Since'] = lastModified
    if (cookie) headers['Cookie'] = cookie

    // Use mobile UA for Instagram
    if (isInstagramRelatedUrl(url)) {
      headers['User-Agent'] = INSTAGRAM_MOBILE_UA
    }

    const req = transport.get(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        // Follow redirects
        if (
          res.statusCode &&
          [301, 302, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, url).href
          assertNetworkFetchUrl(redirectUrl, {
            allowLoopback: true,
            allowPrivateNetwork: true,
          })
            .then(() => {
              // For redirect, re-fetch cookie for the new URL
              const isRedirectInstagram = isInstagramRelatedUrl(redirectUrl)
              if (isRedirectInstagram && !cookie) {
                getInstagramSessionCookie().then((newCookie) => {
                  fetchWithConditional(
                    redirectUrl,
                    etag,
                    lastModified,
                    timeoutMs,
                    newCookie,
                    redirectDepth + 1,
                  )
                    .then(resolve)
                    .catch(reject)
                })
              } else {
                fetchWithConditional(
                  redirectUrl,
                  etag,
                  lastModified,
                  timeoutMs,
                  cookie,
                  redirectDepth + 1,
                )
                  .then(resolve)
                  .catch(reject)
              }
            })
            .catch(reject)
          res.resume()
          return
        }

        if (res.statusCode === 304) {
          res.resume()
          resolve({
            body: null,
            notModified: true,
            etag: res.headers.etag,
            lastModified: res.headers['last-modified'],
          })
          return
        }

        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          resolve({
            body,
            notModified: false,
            etag: res.headers.etag,
            lastModified: res.headers['last-modified'],
          })
        })
        res.on('error', reject)
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })
    req.on('error', reject)
  })
}

async function fetchFeedText(
  url: string,
  options?: FetchTextOptions,
): Promise<string> {
  const safeUrl = await assertNetworkFetchUrl(url, {
    allowLoopback: true,
    allowPrivateNetwork: true,
  })
  // Prefer Electron network stack, which follows app/session proxy and cert settings.
  const timeouts = options?.attemptTimeouts?.length
    ? options.attemptTimeouts
    : DEFAULT_FETCH_TIMEOUTS
  let lastError: unknown = null

  for (const timeout of timeouts) {
    try {
      // Build headers with Instagram cookie if available
      let headers = buildRequestHeaders(safeUrl)

      // For Instagram-related URLs, try to include session cookie
      if (isInstagramRelatedUrl(safeUrl)) {
        const cookie = await getInstagramSessionCookie()
        if (cookie) {
          headers = { ...headers, Cookie: cookie }
        }
      }

      const res = await session.defaultSession.fetch(safeUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeout),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (error) {
      lastError = error
    }
  }

  try {
    // Get cookie for Instagram URLs before fallback fetch
    let cookie: string | null = null
    if (isInstagramRelatedUrl(safeUrl)) {
      cookie = await getInstagramSessionCookie()
    }

    const fallback = await fetchWithConditional(
      safeUrl,
      undefined,
      undefined,
      options?.conditionalTimeoutMs ?? DEFAULT_CONDITIONAL_TIMEOUT_MS,
      cookie,
    )
    if (!fallback.body) throw new Error('Empty response body')
    return fallback.body
  } catch (error) {
    lastError = error
  }

  throw new Error(`Failed to fetch feed text: ${String(lastError)}`)
}

async function parseFeedUrl(
  url: string,
  options?: FetchTextOptions,
): Promise<RssParser.Output<Record<string, any>>> {
  const text = await fetchFeedText(url, options)
  return parser.parseString(text)
}

export async function fetchAndParseFeed(
  url: string,
  options?: FetchFeedOptions,
): Promise<FetchFeedResult> {
  // Handle special URL formats
  let feedUrl = url.trim()

  // If it looks like a URL without protocol, add https
  if (!feedUrl.startsWith('http://') && !feedUrl.startsWith('https://')) {
    feedUrl = 'https://' + feedUrl
  }
  const rsshubCandidates = buildRsshubFallbackCandidates(feedUrl)

  // For Twitter/X feeds, bypass conditional GET and select the freshest source across fallbacks.
  // Some RSSHub instances return stale 304 responses or very old caches.
  const twitterUser = extractTwitterUsernameFromFeedUrl(feedUrl)
  if (twitterUser) {
    const candidates: string[] = []
    const originalRoute = extractTwitterUserRoutePathAndQuery(feedUrl)
    const pushUnique = (u: string) => {
      if (!candidates.includes(u)) candidates.push(u)
    }

    pushUnique(feedUrl)
    for (const base of TWITTER_RSSHUB_FALLBACKS) {
      const b = base.replace(/\/+$/, '')
      if (originalRoute) {
        pushUnique(`${b}${originalRoute}`)
        pushUnique(
          `${b}${originalRoute.replace(/^\/(?:twitter|x)\//i, '/twitter/')}`,
        )
        pushUnique(`${b}${originalRoute.replace(/^\/(?:twitter|x)\//i, '/x/')}`)
      }
      pushUnique(`${b}/twitter/user/${encodeURIComponent(twitterUser)}`)
      pushUnique(`${b}/x/user/${encodeURIComponent(twitterUser)}`)
    }
    for (const base of TWITTER_NITTER_FALLBACKS) {
      pushUnique(
        `${base.replace(/\/+$/, '')}/${encodeURIComponent(twitterUser)}/rss`,
      )
    }

    // Fast path first for responsiveness.
    const bestFeedFast = await pickBestRsshubFallbackFeed(candidates, true)
    // If fast result looks thin/stale, continue with slower merge and choose the better feed.
    if (bestFeedFast && !isLikelyThinOrStaleFeed(bestFeedFast)) {
      return { data: bestFeedFast, notModified: false }
    }

    // Slow path retry for unstable / throttled instances.
    const mergedFeedSlow = await mergeAllRsshubFallbackFeeds(candidates, false)
    const improved = pickBetterNullableFeed(
      bestFeedFast || null,
      mergedFeedSlow,
    )
    if (improved) return { data: improved, notModified: false }

    const bestFeedSlow = await pickBestRsshubFallbackFeed(candidates, false)
    if (bestFeedSlow)
      return {
        data: pickBetterFeed(bestFeedFast || null, bestFeedSlow),
        notModified: false,
      }
    // Do not throw here: fall through to generic RSS fetch/fallback logic below.
  }

  // For Instagram routes, try official route variants across fallback instances.
  const instagramUser = extractInstagramUsernameFromFeedUrl(feedUrl)
  if (instagramUser) {
    const candidates: string[] = []
    const pushUnique = (u: string) => {
      if (!candidates.includes(u)) candidates.push(u)
    }

    pushUnique(feedUrl)
    const bases = new Set<string>([...TWITTER_RSSHUB_FALLBACKS])
    try {
      const parsed = new URL(feedUrl)
      const base = `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '')
      bases.add(base)
    } catch {
      // Ignore invalid URL.
    }

    for (const base of bases) {
      const b = base.replace(/\/+$/, '')
      pushUnique(`${b}/instagram/user/${encodeURIComponent(instagramUser)}`)

      // Route-parameter / query-parameter variants to request larger windows when supported.
      // Some instances/routes cap default item count very low (e.g. ~8) unless explicit params are provided.
      pushUnique(
        `${b}/instagram/user/${encodeURIComponent(instagramUser)}/count=100`,
      )
      pushUnique(
        `${b}/instagram/user/${encodeURIComponent(instagramUser)}?limit=100`,
      )

      // Try mirror routes (picnob, pixnoy, piokok, pixwox) which may provide all carousel images
      // unlike the official Instagram route which typically only provides the first image
      pushUnique(`${b}/picnob/user/${encodeURIComponent(instagramUser)}`)
      pushUnique(`${b}/picnob.info/user/${encodeURIComponent(instagramUser)}`)
      pushUnique(`${b}/pixnoy/user/${encodeURIComponent(instagramUser)}`)
      pushUnique(`${b}/piokok/user/${encodeURIComponent(instagramUser)}`)
      pushUnique(`${b}/pixwox/user/${encodeURIComponent(instagramUser)}`)
    }

    // Instagram/Picnob routes on public instances are often slow and uneven:
    // some nodes are fresh but thin, while others are richer but delayed.
    // Prefer a quick freshest pick first, then fall back to a slower merge only
    // when the fast result still looks thin/stale.
    const bestFeedFast = await pickBestRsshubFallbackFeed(candidates, true)
    if (bestFeedFast && !isLikelyThinOrStaleFeed(bestFeedFast)) {
      return { data: bestFeedFast, notModified: false }
    }

    const mergedFeedSlow = await mergeAllRsshubFallbackFeeds(candidates, false)
    const improved = pickBetterNullableFeed(
      bestFeedFast || null,
      mergedFeedSlow,
    )
    if (improved) return { data: improved, notModified: false }

    const bestFeedSlow = await pickBestRsshubFallbackFeed(candidates, false)
    if (bestFeedSlow) {
      return {
        data: pickBetterFeed(bestFeedFast || null, bestFeedSlow),
        notModified: false,
      }
    }
  }

  // Bilibili dynamic routes are frequently anti-crawler throttled on public RSSHub nodes.
  // Prefer a quick freshest pick first, then widen the timeout budget and merge
  // slower instances when the fast result is missing or too thin.
  if (isBilibiliDynamicUrl(feedUrl)) {
    const bestFeedFast = await pickBestRsshubFallbackFeed(
      rsshubCandidates,
      true,
    )
    if (bestFeedFast && !isLikelyThinOrStaleFeed(bestFeedFast)) {
      return { data: bestFeedFast, notModified: false }
    }

    const mergedFeedSlow = await mergeAllRsshubFallbackFeeds(
      rsshubCandidates,
      false,
    )
    const improved = pickBetterNullableFeed(
      bestFeedFast || null,
      mergedFeedSlow,
    )
    if (improved) return { data: improved, notModified: false }

    const bestFeedSlow = await pickBestRsshubFallbackFeed(
      rsshubCandidates,
      false,
    )
    if (bestFeedSlow) {
      return {
        data: pickBetterFeed(bestFeedFast || null, bestFeedSlow),
        notModified: false,
      }
    }

    try {
      const officialFeed =
        await fetchBilibiliDynamicFeedFromOfficialApi(feedUrl)
      if (officialFeed) {
        return { data: officialFeed, notModified: false }
      }
    } catch {
      // Keep generic fallback path below.
    }
  }

  if (isBilibiliVideoUrl(feedUrl)) {
    const bestFeedFast = await pickBestRsshubFallbackFeed(
      rsshubCandidates,
      true,
    )
    if (bestFeedFast && (bestFeedFast.items?.length || 0) > 0) {
      return { data: bestFeedFast, notModified: false }
    }

    const mergedFeedSlow = await mergeAllRsshubFallbackFeeds(
      rsshubCandidates,
      false,
    )
    const improved = pickBetterNullableFeed(
      bestFeedFast || null,
      mergedFeedSlow,
    )
    if (improved && (improved.items?.length || 0) > 0) {
      return { data: improved, notModified: false }
    }

    const bestFeedSlow = await pickBestRsshubFallbackFeed(
      rsshubCandidates,
      false,
    )
    if (bestFeedSlow && (bestFeedSlow.items?.length || 0) > 0) {
      return {
        data: pickBetterFeed(bestFeedFast || null, bestFeedSlow),
        notModified: false,
      }
    }

    try {
      const spaceFeed = await fetchBilibiliVideoFeedFromSpacePage(feedUrl)
      if (spaceFeed && (spaceFeed.items?.length || 0) > 0) {
        return { data: spaceFeed, notModified: false }
      }
    } catch {
      // Keep generic fallback path below.
    }

    try {
      const uid = feedUrl.match(/\/bilibili\/user\/video\/(\d+)/i)?.[1]
      if (uid) {
        const dynamicFeed = await fetchBilibiliDynamicFeedFromOfficialApi(
          feedUrl.replace('/user/video/', '/user/dynamic/'),
        )
        const filteredVideoFeed = mapParsedDynamicFeedToVideoFeed(
          uid,
          dynamicFeed,
        )
        if (filteredVideoFeed && (filteredVideoFeed.items?.length || 0) > 0) {
          return { data: filteredVideoFeed, notModified: false }
        }
      }
    } catch {
      // Keep generic fallback path below.
    }
  }

  // Use conditional GET if ETag or Last-Modified are available
  const hasConditional = options?.etag || options?.lastModified

  try {
    // For RSSHub-like routes, race fallback instances first to avoid hanging on a single slow node.
    if (isRsshubLikeUrl(feedUrl) && rsshubCandidates.length > 1) {
      const best = await pickBestRsshubFallbackFeed(rsshubCandidates, true)
      if (best) return { data: best, notModified: false }
    }

    if (hasConditional) {
      const result = await fetchWithConditional(
        feedUrl,
        options?.etag,
        options?.lastModified,
      )
      if (result.notModified) {
        return {
          data: null,
          notModified: true,
          etag: result.etag,
          lastModified: result.lastModified,
        }
      }
      // Parse the fetched body
      const parsed = await parser.parseString(result.body!)
      return {
        data: parsed,
        notModified: false,
        etag: result.etag,
        lastModified: result.lastModified,
      }
    }

    // No conditional headers — plain fetch
    const parsed = await parseFeedUrl(feedUrl)

    // RSSHub instance may return a valid but empty feed; try same route on fallback instances
    // and pick the best (most items, then newest item timestamp).
    if ((parsed.items?.length || 0) === 0 && rsshubCandidates.length > 1) {
      const bestFeed = pickBestRsshubFallbackFeed(rsshubCandidates, true)
      const resolved = await bestFeed
      if (resolved) {
        return { data: resolved, notModified: false }
      }
    }

    return { data: parsed, notModified: false }
  } catch (error) {
    // Try RSSHub fallback instances for the same route before generic path probing.
    // This avoids creating/keeping empty subscriptions when one instance is blocked.
    if (rsshubCandidates.length > 1) {
      const bestFeed = await pickBestRsshubFallbackFeed(rsshubCandidates, true)
      if (bestFeed) {
        return { data: bestFeed, notModified: false }
      }
    }

    // If skipFallback is set (OPML import), don't try common paths
    if (options?.skipFallback) {
      throw new Error(`Failed to parse RSS feed: ${error}`)
    }

    // Try common RSS paths if direct URL fails
    const commonPaths = [
      '/feed',
      '/rss',
      '/atom.xml',
      '/feed.xml',
      '/rss.xml',
      '/index.xml',
    ]

    for (const path of commonPaths) {
      try {
        const baseUrl = new URL(feedUrl)
        const tryUrl = `${baseUrl.origin}${path}`
        const parsed = await parseFeedUrl(tryUrl)
        return { data: parsed, notModified: false }
      } catch {
        continue
      }
    }

    throw new Error(`Failed to parse RSS feed: ${error}`)
  }
}
