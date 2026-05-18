import http from '@ohos.net.http'
import { Feed, FeedViewType } from '../../models/LivoModels'
import { canonicalFeedUrl } from '../../utils/social/SocialFeedTitles'
import { looksLikeHtmlDocument } from '../../utils/HtmlParser'
import {
  RSSHUB_INSTANCES,
  DESKTOP_BROWSER_USER_AGENT,
  RSS_ACCEPT_LANGUAGE,
  ACCEPT_RSS_XML,
  BILIBILI_ORIGIN,
  LONG_REQUEST_TIMEOUT_MS,
  RSS_REQUEST_TIMEOUT_MS,
  ACCEPT_JSON,
  bilibiliSpaceReferer,
} from '../../AppConfig'
import {
  FeedRefreshPayload,
  BilibiliDynamicApiPayload,
  parseRssItems,
  parseAtomItems,
  parseFeedTitle,
  parseFeedDescription,
  parseFeedSiteUrl,
  parseFeedImageUrl,
  buildEntriesFromItems,
  parseBilibiliDynamic,
  discoverFeedUrlFromHtml,
} from './RssFeedParser'
import {
  FeedRequestResult,
  fetchUrl,
  tryRssHubInstances,
  tryNitterInstances,
  isRssHubUrl,
  extractRssHubRoute,
  isXRoute,
  extractXRouteUsername,
  isNitterFeedUrl,
} from './RssFeedFetcher'

export { FeedRefreshPayload }

const LOG_TAG = '[RssFeedService]'

function extractBilibiliDynamicUid(url: string): string {
  return (url || '').match(/\/bilibili\/user\/dynamic\/(\d+)/i)?.[1] ?? ''
}

function extractBilibiliVideoUid(url: string): string {
  return (url || '').match(/\/bilibili\/user\/video\/(\d+)/i)?.[1] ?? ''
}

function previewUrlVariants(url: string): string[] {
  const variants: string[] = []
  const trimmed = (url || '').trim()
  if (trimmed) {
    variants.push(trimmed)
  }
  const dynamicUid = extractBilibiliDynamicUid(trimmed)
  if (dynamicUid) {
    const alt = trimmed.replace(/\/bilibili\/user\/dynamic\/\d+/i, `/bilibili/user/video/${dynamicUid}`)
    if (!variants.includes(alt)) {
      variants.push(alt)
    }
  }
  const videoUid = extractBilibiliVideoUid(trimmed)
  if (videoUid) {
    const alt = trimmed.replace(/\/bilibili\/user\/video\/\d+/i, `/bilibili/user/dynamic/${videoUid}`)
    if (!variants.includes(alt)) {
      variants.push(alt)
    }
  }
  return variants
}

function convertYouTubeToRssHub(url: string): string {
  if (!url.toLowerCase().includes('youtube.com/feeds/videos.xml')) {
    return ''
  }
  const channelId = url.match(/[?&]channel_id=([^&]+)/)?.[1]
  return channelId ? `${RSSHUB_INSTANCES[0]}/youtube/channel/${channelId}` : ''
}

function buildRequestHeaders(feed: Feed): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': DESKTOP_BROWSER_USER_AGENT,
    'Accept': ACCEPT_RSS_XML,
    'Accept-Language': RSS_ACCEPT_LANGUAGE,
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  }
  if (feed.etag) {
    headers['If-None-Match'] = feed.etag
  }
  if (feed.lastModified) {
    headers['If-Modified-Since'] = feed.lastModified
  }
  return headers
}

async function fetchBilibiliDynamicFeed(feed: Feed, uid: string): Promise<FeedRefreshPayload> {
  const request = http.createHttp()
  try {
    let response: http.HttpResponse
    try {
      response = await request.request(
        `https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space?host_mid=${encodeURIComponent(uid)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: LONG_REQUEST_TIMEOUT_MS,
          readTimeout: LONG_REQUEST_TIMEOUT_MS,
          header: {
            'User-Agent': DESKTOP_BROWSER_USER_AGENT,
            'Accept': ACCEPT_JSON,
            'Referer': bilibiliSpaceReferer(uid),
            'Origin': BILIBILI_ORIGIN,
          },
        },
      )
    } catch (error) {
      throw new Error(`Bilibili dynamic request failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    if (response.responseCode !== 200) {
      throw new Error(`Bilibili dynamic request failed with status ${response.responseCode}`)
    }
    const payload = JSON.parse(String(response.result)) as BilibiliDynamicApiPayload
    const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : undefined
    const entries = data ? parseBilibiliDynamic(feed.id, data) : []
    if (entries.length === 0) {
      throw new Error('Bilibili dynamic feed returned no entries')
    }
    return {
      etag: '',
      lastModified: '',
      feedTitle: feed.title,
      siteUrl: feed.siteUrl || `https://space.bilibili.com/${uid}`,
      imageUrl: feed.imageUrl || '',
      description: feed.description || '',
      resolvedFeedUrl: feed.url,
      entries,
    }
  } finally {
    request.destroy()
  }
}

/**
 * Resolve a feed URL to a successful FeedRequestResult by trying:
 *   1) Direct fetch when the URL is not a known RSSHub route
 *   2) Each preferred RSSHub instance × fallback route combination
 *   3) Each Nitter fallback for X/Twitter routes when RSSHub fails
 *
 * The returned result owns the http.HttpRequest handle and the caller
 * is responsible for destroying it.
 */
async function resolveRssHubFetch(
  actualUrl: string,
  headers: Record<string, string>,
): Promise<FeedRequestResult> {
  const route = extractRssHubRoute(actualUrl)
  if (!route) {
    return await fetchUrl(actualUrl, headers, RSS_REQUEST_TIMEOUT_MS)
  }
  console.info(`${LOG_TAG} Detected RSSHub route: ${route}`)
  const rssResult = await tryRssHubInstances(route, headers)
  if (rssResult) {
    return rssResult
  }
  if (isXRoute(route)) {
    const username = extractXRouteUsername(route)
    const nitterResult = await tryNitterInstances(username, headers)
    if (nitterResult) {
      return nitterResult
    }
    throw new Error('All RSSHub and Nitter instances failed')
  }
  throw new Error('All RSSHub instances failed')
}

/**
 * Follow an HTML response: look for an <link rel="alternate"> RSS hint,
 * fetch the discovered URL, and return the resolved (xml, finalUrl).
 *
 * Returns null when the response is already RSS or no hint is found.
 */
async function followHtmlFeedDiscovery(
  xml: string,
  requestUrl: string,
  contentType: string,
  headers: Record<string, string>,
): Promise<FeedRequestResult | null> {
  if (!contentType.includes('text/html') && !looksLikeHtmlDocument(xml)) {
    return null
  }
  console.info(`${LOG_TAG} Detected HTML, attempting RSS discovery`)
  const discoveredUrl = discoverFeedUrlFromHtml(xml, requestUrl)
  if (!discoveredUrl || discoveredUrl === requestUrl) {
    console.warn(`${LOG_TAG} No RSS feed discovered in HTML`)
    return null
  }
  console.info(`${LOG_TAG} Discovered RSS feed: ${discoveredUrl}`)
  const discovered = await fetchUrl(discoveredUrl, headers, RSS_REQUEST_TIMEOUT_MS)
  if (discovered.response.responseCode !== 200) {
    discovered.request.destroy()
    throw new Error(`RSS request failed with status ${discovered.response.responseCode}`)
  }
  return discovered
}

function notModifiedPayload(feed: Feed): FeedRefreshPayload {
  return {
    etag: feed.etag ?? '',
    lastModified: feed.lastModified ?? '',
    feedTitle: feed.title,
    siteUrl: feed.siteUrl ?? '',
    imageUrl: feed.imageUrl ?? '',
    description: feed.description ?? '',
    resolvedFeedUrl: feed.url,
    entries: [],
  }
}

function buildSuccessPayload(
  feed: Feed,
  xml: string,
  requestUrl: string,
  etag: string,
  lastModified: string,
): FeedRefreshPayload {
  const rssItems = parseRssItems(feed.id, xml, requestUrl)
  const items = rssItems.length > 0 ? rssItems : parseAtomItems(feed.id, xml, requestUrl)
  console.info(`${LOG_TAG} Parsed ${items.length} items (RSS: ${rssItems.length})`)
  if (items.length === 0) {
    throw new Error('RSS parsed without entries')
  }
  const resolvedSiteUrl = parseFeedSiteUrl(xml, requestUrl) || feed.siteUrl || ''
  return {
    etag,
    lastModified,
    feedTitle: parseFeedTitle(xml) || feed.title,
    siteUrl: resolvedSiteUrl,
    imageUrl: parseFeedImageUrl(xml, resolvedSiteUrl || requestUrl) || feed.imageUrl || '',
    description: parseFeedDescription(xml) || feed.description || '',
    resolvedFeedUrl: requestUrl,
    entries: buildEntriesFromItems(items, feed),
  }
}

function readHeader(response: http.HttpResponse, names: string[]): string {
  for (const name of names) {
    const raw = String(response.header[name] ?? '')
    if (raw) {
      return raw
    }
  }
  return ''
}

export class RssFeedService {
  static async previewFeedUrl(url: string): Promise<FeedRefreshPayload> {
    const candidates = previewUrlVariants(url)
    let lastError = 'unknown error'
    for (const candidateUrl of candidates) {
      const dummyFeed: Feed = {
        id: `preview-${Date.now()}`,
        title: 'Preview',
        url: candidateUrl,
        view: FeedViewType.Articles,
        showInAll: true,
        errorCount: 0,
        createdAt: 0,
        updatedAt: 0,
      }
      try {
        return await RssFeedService.fetchFeedEntries(dummyFeed)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    throw new Error(lastError)
  }

  static async fetchFeedEntries(feed: Feed): Promise<FeedRefreshPayload> {
    const bilibiliDynamicUid = extractBilibiliDynamicUid(feed.url)
    if (bilibiliDynamicUid) {
      try {
        return await fetchBilibiliDynamicFeed(feed, bilibiliDynamicUid)
      } catch (error) {
        console.warn(`${LOG_TAG} Bilibili dynamic fallback failed: ${error instanceof Error ? error.message : error}`)
      }
    }

    const rsshubConverted = convertYouTubeToRssHub(feed.url)
    if (rsshubConverted) {
      console.info(`${LOG_TAG} Converting YouTube RSS to RSSHub: ${rsshubConverted}`)
    }
    const actualUrl = rsshubConverted || canonicalFeedUrl(feed.url, feed.siteUrl || '') || feed.url
    const headers = buildRequestHeaders(feed)

    console.info(`${LOG_TAG} Fetching feed: ${actualUrl}`)

    let fetchResult: FeedRequestResult
    if (isNitterFeedUrl(actualUrl)) {
      fetchResult = await fetchUrl(actualUrl, headers, RSS_REQUEST_TIMEOUT_MS)
    } else if (isRssHubUrl(actualUrl)) {
      fetchResult = await resolveRssHubFetch(actualUrl, headers)
    } else {
      fetchResult = await fetchUrl(actualUrl, headers, RSS_REQUEST_TIMEOUT_MS)
    }

    let activeRequest = fetchResult.request
    try {
      const response = fetchResult.response

      if (response.responseCode === 304) {
        console.info(`${LOG_TAG} Feed not modified (304): ${feed.url}`)
        return notModifiedPayload(feed)
      }

      if (response.responseCode !== 200) {
        console.error(`${LOG_TAG} HTTP error ${response.responseCode} for ${fetchResult.finalUrl}`)
        throw new Error(`RSS request failed with status ${response.responseCode}`)
      }

      let requestUrl = fetchResult.finalUrl
      let xml = String(response.result)
      const contentType = String(
        response.header['Content-Type'] ?? response.header['content-type'] ?? '',
      ).toLowerCase()

      const discovered = await followHtmlFeedDiscovery(xml, requestUrl, contentType, headers)
      let etag = readHeader(response, ['ETag', 'etag'])
      let lastModified = readHeader(response, ['Last-Modified', 'last-modified'])
      if (discovered) {
        activeRequest.destroy()
        activeRequest = discovered.request
        requestUrl = discovered.finalUrl
        xml = String(discovered.response.result)
        etag = readHeader(discovered.response, ['ETag', 'etag'])
        lastModified = readHeader(discovered.response, ['Last-Modified', 'last-modified'])
      }

      return buildSuccessPayload(feed, xml, requestUrl, etag, lastModified)
    } finally {
      activeRequest.destroy()
    }
  }
}
