import http from '@ohos.net.http'
import { Feed, FeedViewType } from '../../models/LivoModels'
import { canonicalFeedUrl } from '../../utils/SocialFeedTitles'
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
  resolveAbsoluteUrl,
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
    const response = await request.request(
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

interface RssHubResolution {
  result: FeedRequestResult
  activeRequest: http.HttpRequest
  finalUrl: string
}

async function resolveRssHubResult(
  actualUrl: string,
  headers: Record<string, string>,
  mainRequest: http.HttpRequest,
): Promise<RssHubResolution> {
  const route = extractRssHubRoute(actualUrl)
  if (!route) {
    const r = await fetchUrl(actualUrl, headers, RSS_REQUEST_TIMEOUT_MS)
    const res: RssHubResolution = { result: r, activeRequest: mainRequest, finalUrl: actualUrl }
    return res
  }

  const rssResult = await tryRssHubInstances(route, headers)
  if (rssResult) {
    mainRequest.destroy()
    const res: RssHubResolution = { result: rssResult, activeRequest: rssResult.request, finalUrl: rssResult.finalUrl }
    return res
  }

  if (isXRoute(route)) {
    const username = extractXRouteUsername(route)
    const nitterResult = await tryNitterInstances(username, headers)
    if (nitterResult) {
      mainRequest.destroy()
      const res: RssHubResolution = { result: nitterResult, activeRequest: nitterResult.request, finalUrl: nitterResult.finalUrl }
      return res
    }
  }

  throw new Error('All RSSHub instances failed')
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
      } catch (_) {
        // fall through to RSS
      }
    }

    const rsshubConverted = convertYouTubeToRssHub(feed.url)
    let actualUrl = rsshubConverted || canonicalFeedUrl(feed.url, feed.siteUrl || '') || feed.url
    const headers = buildRequestHeaders(feed)
    const mainRequest = http.createHttp()
    let activeRequest = mainRequest

    try {
      let fetchResult: FeedRequestResult

      if (isNitterFeedUrl(actualUrl)) {
        fetchResult = await fetchUrl(actualUrl, headers, RSS_REQUEST_TIMEOUT_MS)
      } else if (isRssHubUrl(actualUrl)) {
        const resolved = await resolveRssHubResult(actualUrl, headers, mainRequest)
        fetchResult = resolved.result
        activeRequest = resolved.activeRequest
        actualUrl = resolved.finalUrl
      } else {
        fetchResult = await fetchUrl(actualUrl, headers, RSS_REQUEST_TIMEOUT_MS)
      }

      const response = fetchResult.response

      if (response.responseCode === 304) {
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

      if (response.responseCode !== 200) {
        throw new Error(`RSS request failed with status ${response.responseCode}`)
      }

      let requestUrl = actualUrl
      let xml = String(response.result)
      const contentType = String(
        response.header['Content-Type'] ?? response.header['content-type'] ?? '',
      ).toLowerCase()

      if (contentType.includes('text/html') || looksLikeHtmlDocument(xml)) {
        const discoveredUrl = discoverFeedUrlFromHtml(xml, requestUrl)
        if (discoveredUrl && discoveredUrl !== requestUrl) {
          const discoveryResult = await fetchUrl(discoveredUrl, headers, RSS_REQUEST_TIMEOUT_MS)
          if (discoveryResult.response.responseCode !== 200) {
            discoveryResult.request.destroy()
            throw new Error(`RSS request failed with status ${discoveryResult.response.responseCode}`)
          }
          requestUrl = discoveredUrl
          xml = String(discoveryResult.response.result)
          discoveryResult.request.destroy()
        }
      }

      const rssItems = parseRssItems(feed.id, xml, requestUrl)
      const items = rssItems.length > 0 ? rssItems : parseAtomItems(feed.id, xml, requestUrl)

      if (items.length === 0) {
        throw new Error('RSS parsed without entries')
      }

      return {
        etag: String(response.header['ETag'] ?? response.header['etag'] ?? ''),
        lastModified: String(response.header['Last-Modified'] ?? response.header['last-modified'] ?? ''),
        feedTitle: parseFeedTitle(xml) || feed.title,
        siteUrl: parseFeedSiteUrl(xml, requestUrl) || feed.siteUrl || '',
        imageUrl: parseFeedImageUrl(xml, parseFeedSiteUrl(xml, requestUrl) || requestUrl) || feed.imageUrl || '',
        description: parseFeedDescription(xml) || feed.description || '',
        resolvedFeedUrl: requestUrl,
        entries: buildEntriesFromItems(items, feed),
      }
    } finally {
      activeRequest.destroy()
    }
  }
}
