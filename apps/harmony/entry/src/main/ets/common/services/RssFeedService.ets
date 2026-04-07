import http from '@ohos.net.http'
import { Entry, Feed, FeedViewType } from '../models/LivoModels'
import { appendFeedMediaUrlsToContent, extractFeedMediaUrls } from '../utils/FeedMediaUrl'
import { parseBilibiliDynamicEntries } from '../utils/BilibiliDynamicFeed'
import { expandRssHubFallbackRoutes } from '../utils/RssHubFallbackRoute'

interface ParsedItem {
  id: string
  title: string
  link: string
  summary: string
  content: string
  author: string
  publishedAt: number
  tags: string[]
  mediaUrls: string[]
}

export interface FeedRefreshPayload {
  etag: string
  lastModified: string
  feedTitle: string
  siteUrl: string
  imageUrl: string
  description: string
  resolvedFeedUrl?: string
  entries: Entry[]
}

function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (matched: string, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
    .replace(/&#([0-9]+);/g, (matched: string, digits: string) => {
      const code = parseInt(digits, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : matched
    })
}

function decodeHtml(value: string): string {
  return decodeNumericEntities(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(value: string): string {
  return decodeHtml(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeRichContent(value: string, fallback: string): string {
  const raw = stripCdata(value).trim()
  if (!raw) {
    return fallback
  }

  const decoded = decodeHtml(raw).trim()
  return decoded || fallback
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
}

function pickTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i')
  const matched = block.match(regex)
  return matched && matched[1] ? stripCdata(matched[1]).trim() : ''
}

function pickFirst(block: string, tagNames: string[]): string {
  for (const tagName of tagNames) {
    const value = pickTag(block, tagName)
    if (value) {
      return value
    }
  }

  return ''
}

function pickTagFromContainer(xml: string, containerName: string, tagName: string): string {
  const containerRegex = new RegExp(`<${containerName}(?:\\s[^>]*)?>([\\s\\S]*?)</${containerName}>`, 'i')
  const container = xml.match(containerRegex)
  if (!container?.[1]) {
    return ''
  }

  return pickTag(container[1], tagName)
}

function looksLikeHtmlDocument(value: string): boolean {
  const sample = value.slice(0, 2000)
  return /<html[\s>]/i.test(sample) || /<head[\s>]/i.test(sample) || /<body[\s>]/i.test(sample)
}

function extractAttribute(tag: string, name: string): string {
  const regex = new RegExp(`${name}="([^"]+)"|${name}='([^']+)'`, 'i')
  const matched = tag.match(regex)
  return matched?.[1] ?? matched?.[2] ?? ''
}

function discoverFeedUrlFromHtml(html: string, baseUrl: string): string {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? []

  for (const tag of linkTags) {
    const rel = extractAttribute(tag, 'rel').toLowerCase()
    const type = extractAttribute(tag, 'type').toLowerCase()
    const href = extractAttribute(tag, 'href')
    if (!href) {
      continue
    }
    if (!rel.includes('alternate')) {
      continue
    }
    if (
      !type.includes('application/rss+xml')
      && !type.includes('application/atom+xml')
      && !type.includes('application/xml')
      && !type.includes('text/xml')
    ) {
      continue
    }
    return resolveAbsoluteUrl(baseUrl, href)
  }

  return ''
}

function parseDate(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Date.now() : timestamp
}

function estimateReadingMinutes(content: string): number {
  const plainText = stripHtml(content)
  return Math.max(1, Math.ceil(plainText.length / 220))
}

function createEntryId(feedId: string, identity: string, link: string, title: string, index: number): string {
  const normalized = `${feedId}-${identity || link || title || index}`.toLowerCase()
  const compact = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return compact || `${feedId}-${index}`
}

function parseTags(itemBlock: string): string[] {
  const matches = itemBlock.match(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi) ?? []
  const tags: string[] = []

  matches.forEach((tagBlock: string) => {
    const value = stripHtml(tagBlock.replace(/<\/?category(?:\s[^>]*)?>/gi, ''))
    if (value && !tags.includes(value)) {
      tags.push(value)
    }
  })

  return tags.slice(0, 6)
}

function parseAtomLink(entryBlock: string): string {
  const alternateLink = entryBlock.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i)
  if (alternateLink?.[1]) {
    return stripHtml(alternateLink[1])
  }

  const hrefLink = entryBlock.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i)
  if (hrefLink?.[1]) {
    return stripHtml(hrefLink[1])
  }

  return stripHtml(pickTag(entryBlock, 'link'))
}

function parseAtomTags(entryBlock: string): string[] {
  const matches = entryBlock.match(/<category(?:\s[^>]*)?\/?>/gi) ?? []
  const tags: string[] = []

  matches.forEach((tagBlock: string) => {
    const term = tagBlock.match(/term="([^"]+)"/i)?.[1] ?? tagBlock.match(/term='([^']+)'/i)?.[1] ?? ''
    const value = stripHtml(term)
    if (value && !tags.includes(value)) {
      tags.push(value)
    }
  })

  return tags.slice(0, 6)
}

function resolveAbsoluteUrl(baseUrl: string, rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return ''
  }

  // ArkTS 不支持 URL 构造函数，使用简单的字符串处理
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  
  if (trimmed.startsWith('//')) {
    try {
      const baseProtocol = new RegExp('^https?:').exec(baseUrl)?.[0] ?? 'https:'
      return `${baseProtocol}${trimmed}`
    } catch (_) {
      return trimmed
    }
  }
  
  if (trimmed.startsWith('/')) {
    try {
      const baseUrlObj = parseBaseUrl(baseUrl)
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${trimmed}`
    } catch (_) {
      return trimmed
    }
  }
  
  // 相对路径
  try {
    const baseUrlObj = parseBaseUrl(baseUrl)
    const basePath = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1)
    return `${baseUrlObj.protocol}//${baseUrlObj.host}${basePath}${trimmed}`
  } catch (_) {
    return trimmed
  }
}

interface ParsedUrl {
  protocol: string
  host: string
  pathname: string
}

function parseBaseUrl(url: string): ParsedUrl {
  const match = url.match(/^(https?:)\/\/([^/]+)(.*)?/)
  if (!match) {
    return { protocol: 'https:', host: url, pathname: '' }
  }
  return {
    protocol: match[1],
    host: match[2],
    pathname: match[3] ?? '',
  }
}

function parseFeedTitle(xml: string): string {
  return stripHtml(pickTagFromContainer(xml, 'channel', 'title') || pickTag(xml, 'title'))
}

function parseFeedDescription(xml: string): string {
  return stripHtml(
    pickTagFromContainer(xml, 'channel', 'description')
      || pickTag(xml, 'subtitle')
      || pickTag(xml, 'description'),
  )
}

function parseFeedSiteUrl(xml: string, feedUrl: string): string {
  const rssLink = stripHtml(pickTagFromContainer(xml, 'channel', 'link'))
  if (rssLink) {
    return resolveAbsoluteUrl(feedUrl, rssLink)
  }

  const atomAlternate = xml.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i)
  if (atomAlternate?.[1]) {
    return resolveAbsoluteUrl(feedUrl, atomAlternate[1])
  }

  const atomHref = xml.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i)
  if (atomHref?.[1]) {
    return resolveAbsoluteUrl(feedUrl, atomHref[1])
  }

  return ''
}

function parseFeedImageUrl(xml: string, baseUrl: string): string {
  const rssImage = xml.match(/<image[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i)
  if (rssImage?.[1]) {
    return resolveAbsoluteUrl(baseUrl, stripHtml(stripCdata(rssImage[1])))
  }

  const itunesImage = xml.match(/<itunes:image[^>]*href="([^"]+)"[^>]*\/?>/i)
  if (itunesImage?.[1]) {
    return resolveAbsoluteUrl(baseUrl, stripHtml(itunesImage[1]))
  }

  const atomLogo = pickFirst(xml, ['logo', 'icon'])
  if (atomLogo) {
    return resolveAbsoluteUrl(baseUrl, stripHtml(atomLogo))
  }

  return ''
}

function extractBilibiliDynamicUid(url: string): string {
  const matched = (url || '').match(/\/bilibili\/user\/dynamic\/(\d+)/i)
  return matched?.[1] ?? ''
}

function parseRssItems(feedId: string, xml: string, baseUrl: string): ParsedItem[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []

  return itemMatches.map((itemBlock: string, index: number) => {
    const title = stripHtml(pickTag(itemBlock, 'title')) || `远程条目 ${index + 1}`
    const link = stripHtml(pickTag(itemBlock, 'link'))
    const guid = stripHtml(pickTag(itemBlock, 'guid'))
    const description = pickFirst(itemBlock, ['content:encoded', 'description'])
    const summary = stripHtml(description) || '这条内容暂时没有摘要。'
    const author = stripHtml(pickFirst(itemBlock, ['author', 'dc:creator'])) || '未知作者'
    const pubDate = stripHtml(pickFirst(itemBlock, ['pubDate', 'published', 'updated']))
    const mediaUrls = extractFeedMediaUrls(itemBlock, baseUrl)
    const content = appendFeedMediaUrlsToContent(normalizeRichContent(description, summary), mediaUrls)
    
    const parsedItem: ParsedItem = {
      id: createEntryId(feedId, guid, link, title, index),
      title,
      link,
      summary,
      content,
      author,
      publishedAt: parseDate(pubDate),
      tags: parseTags(itemBlock),
      mediaUrls,
    }
    return parsedItem
  })
}

function parseAtomItems(feedId: string, xml: string, baseUrl: string): ParsedItem[] {
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []

  return entryMatches.map((entryBlock: string, index: number) => {
    const title = stripHtml(pickTag(entryBlock, 'title')) || `远程条目 ${index + 1}`
    const link = parseAtomLink(entryBlock)
    const entryId = stripHtml(pickTag(entryBlock, 'id'))
    const contentBlock = pickFirst(entryBlock, ['content', 'summary'])
    const summary = stripHtml(contentBlock) || '这条内容暂时没有摘要。'
    const authorBlock = pickTag(entryBlock, 'author')
    const author = stripHtml(pickTag(authorBlock, 'name') || pickTag(entryBlock, 'name') || pickTag(entryBlock, 'dc:creator')) || '未知作者'
    const pubDate = stripHtml(pickFirst(entryBlock, ['published', 'updated']))
    const mediaUrls = extractFeedMediaUrls(entryBlock, baseUrl)
    const content = appendFeedMediaUrlsToContent(normalizeRichContent(contentBlock, summary), mediaUrls)

    const parsedItem: ParsedItem = {
      id: createEntryId(feedId, entryId, link, title, index),
      title,
      link,
      summary,
      content,
      author,
      publishedAt: parseDate(pubDate),
      tags: parseAtomTags(entryBlock),
      mediaUrls,
    }
    return parsedItem
  })
}

// RSSHub 备选实例列表（按优先级排序）
const RSSHUB_INSTANCES = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub-instance.zeabur.app',
  'https://rss.shab.fun',
  'https://rsshub.ktachibana.party',
  'https://rsshub.liumingye.cn',
  'https://rsshub.feeded.xyz',
]

// RSSHub 实例尝试结果
interface RssHubInstanceResult {
  response: http.HttpResponse
  request: http.HttpRequest
  finalUrl: string
}

interface BilibiliDynamicApiPayload {
  data?: object
}

export class RssFeedService {
  private static async fetchBilibiliDynamicFeed(
    feed: Feed,
    uid: string,
  ): Promise<FeedRefreshPayload> {
    const request = http.createHttp()

    try {
      const response = await request.request(
        `https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space?host_mid=${encodeURIComponent(uid)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 10000,
          readTimeout: 10000,
          header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://space.bilibili.com/${encodeURIComponent(uid)}`,
            'Origin': 'https://www.bilibili.com',
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
      const entries = data ? parseBilibiliDynamicEntries(feed.id, data) : []

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

  static async previewFeedUrl(url: string): Promise<FeedRefreshPayload> {
    const dummyFeed: Feed = {
      id: `preview-${Date.now()}`,
      title: 'Preview',
      url: url,
      view: FeedViewType.Articles,
      showInAll: true,
      errorCount: 0,
      createdAt: 0,
      updatedAt: 0
    }
    return RssFeedService.fetchFeedEntries(dummyFeed)
  }

  /**
   * 将 YouTube 官方 RSS URL 转换为 RSSHub 代理 URL
   */
  private static convertYouTubeToRssHub(url: string): string | null {
    try {
      // 手动解析 URL，因为 ArkTS 不支持 URL 构造函数
      const lowerUrl = url.toLowerCase()
      if (!lowerUrl.includes('youtube.com/feeds/videos.xml')) {
        return null
      }
      
      // 提取 channel_id 参数
      const channelIdMatch = url.match(/[?&]channel_id=([^&]+)/)
      if (channelIdMatch && channelIdMatch[1]) {
        const channelId = channelIdMatch[1]
        // 使用 RSSHub 代理 YouTube RSS
        return `${RSSHUB_INSTANCES[0]}/youtube/channel/${channelId}`
      }
    } catch (e) {
      console.error('[RssFeedService] Error converting YouTube URL:', e)
    }
    return null
  }

  /**
   * 检查 URL 是否是 RSSHub 路由
   */
  private static isRssHubUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase()
    for (const instance of RSSHUB_INSTANCES) {
      if (lowerUrl.startsWith(instance.toLowerCase())) {
        return true
      }
    }
    // 检查是否包含常见的 RSSHub 路由
    return lowerUrl.includes('/bilibili/') || 
           lowerUrl.includes('/twitter/') || 
           lowerUrl.includes('/youtube/') ||
           lowerUrl.includes('/instagram/')
  }

  /**
   * 提取 RSSHub 路由路径
   */
  private static extractRssHubRoute(url: string): string | null {
    try {
      // 尝试从各个实例中提取路由
      for (const instance of RSSHUB_INSTANCES) {
        const instanceLower = instance.toLowerCase()
        const urlLower = url.toLowerCase()
        const index = urlLower.indexOf(instanceLower)
        if (index !== -1) {
          const route = url.substring(index + instance.length)
          if (route.startsWith('/')) {
            return route
          }
        }
      }
      
      // 如果不是标准实例，尝试提取路径部分
      const pathMatch = url.match(/https?:\/\/[^/]+(\/[^?#]+)/)
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1]
      }
    } catch (e) {
      console.error('[RssFeedService] Error extracting RSSHub route:', e)
    }
    return null
  }

  /**
   * 尝试多个 RSSHub 实例，返回成功的响应和请求对象
   */
  private static async tryRssHubInstances(
    route: string,
    headers: Record<string, string>
  ): Promise<RssHubInstanceResult | null> {
    const errors: string[] = []
    let bestResult: RssHubInstanceResult | null = null
    let bestStatusCode = 0
    const routes = expandRssHubFallbackRoutes(route)

    for (const instance of RSSHUB_INSTANCES) {
      for (const candidateRoute of routes) {
        const url = `${instance}${candidateRoute}`
        console.info(`[RssFeedService] Trying RSSHub instance: ${url}`)

        const instanceHeaders: Record<string, string> = {}
        const headerKeys = Object.keys(headers)
        for (let i = 0; i < headerKeys.length; i++) {
          const key = headerKeys[i]
          if (key !== 'Accept-Encoding') {
            instanceHeaders[key] = headers[key]
          }
        }
        instanceHeaders['Referer'] = instance

        const request = http.createHttp()
        try {
          console.info(`[RssFeedService] Request headers:`, JSON.stringify(instanceHeaders))

          const response = await request.request(url, {
            method: http.RequestMethod.GET,
            connectTimeout: 8000,
            readTimeout: 8000,
            header: instanceHeaders,
          })

          console.info(`[RssFeedService] Instance ${instance} response: ${response.responseCode}`)
          console.info(`[RssFeedService] Response headers:`, JSON.stringify(response.header))
          console.info(`[RssFeedService] Response content-type: ${response.header['Content-Type'] ?? response.header['content-type']}`)
          console.info(`[RssFeedService] Response length: ${String(response.result).length}`)

          if (response.responseCode >= 400) {
            const preview = String(response.result).substring(0, 500)
            console.warn(`[RssFeedService] Error response preview: ${preview}`)
          }

          if (response.responseCode === 200) {
            console.info(`[RssFeedService] Success with instance: ${instance} route: ${candidateRoute}`)
            if (bestResult) {
              bestResult.request.destroy()
            }
            const result: RssHubInstanceResult = {
              response: response,
              request: request,
              finalUrl: url,
            }
            return result
          }

          if (response.responseCode > bestStatusCode && response.responseCode < 400) {
            if (bestResult) {
              bestResult.request.destroy()
            }
            bestStatusCode = response.responseCode
            bestResult = {
              response: response,
              request: request,
              finalUrl: url,
            }
            console.info(`[RssFeedService] Saved best result so far: ${instance}${candidateRoute} (${response.responseCode})`)
          } else {
            request.destroy()
          }

          const errorMsg = `Instance ${instance}${candidateRoute} returned ${response.responseCode}`
          console.warn(`[RssFeedService] ${errorMsg}`)
          errors.push(errorMsg)
        } catch (e) {
          const errorMsg = `Instance ${instance}${candidateRoute} failed: ${e}`
          console.warn(`[RssFeedService] ${errorMsg}`)
          errors.push(errorMsg)
          request.destroy()
        }
      }
    }

    // 如果有保存的最佳结果，返回它
    if (bestResult) {
      console.info(`[RssFeedService] Returning best result with status ${bestStatusCode}`)
      return bestResult
    }
    
    console.error(`[RssFeedService] All RSSHub instances failed:`, errors.join('; '))
    return null
  }

  static async fetchFeedEntries(feed: Feed): Promise<FeedRefreshPayload> {
    let mainRequest = http.createHttp()
    let activeRequest = mainRequest
    
    try {
      const bilibiliDynamicUid = extractBilibiliDynamicUid(feed.url)
      if (bilibiliDynamicUid) {
        try {
          return await RssFeedService.fetchBilibiliDynamicFeed(feed, bilibiliDynamicUid)
        } catch (error) {
          console.warn(`[RssFeedService] Bilibili dynamic fallback failed: ${error instanceof Error ? error.message : error}`)
        }
      }

      // 尝试将 YouTube 官方 RSS 转换为 RSSHub 代理
      let actualUrl = feed.url
      const rsshubUrl = RssFeedService.convertYouTubeToRssHub(feed.url)
      if (rsshubUrl) {
        console.info(`[RssFeedService] Converting YouTube RSS to RSSHub: ${rsshubUrl}`)
        actualUrl = rsshubUrl
      }

      const headers: Record<string, string> = {}
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      headers['Accept'] = 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*'
      headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
      headers['Connection'] = 'keep-alive'
      headers['Cache-Control'] = 'no-cache'
      headers['Pragma'] = 'no-cache'

      if (feed.etag) {
        headers['If-None-Match'] = feed.etag
      }

      if (feed.lastModified) {
        headers['If-Modified-Since'] = feed.lastModified
      }

      console.info(`[RssFeedService] Fetching feed: ${actualUrl}`)
      console.info(`[RssFeedService] Original URL: ${feed.url}`)

      let response: http.HttpResponse
      
      // 如果是 RSSHub URL，尝试多个实例
      if (RssFeedService.isRssHubUrl(actualUrl)) {
        const route = RssFeedService.extractRssHubRoute(actualUrl)
        if (route) {
          console.info(`[RssFeedService] Detected RSSHub route: ${route}`)
          const result = await RssFeedService.tryRssHubInstances(route, headers)
          
          if (!result) {
            throw new Error('All RSSHub instances failed')
          }
          
          response = result.response
          activeRequest = result.request
          actualUrl = result.finalUrl
          // 销毁原始的 mainRequest，因为我们使用了新的 request
          if (mainRequest !== activeRequest) {
            mainRequest.destroy()
          }
        } else {
          // 无法提取路由，使用原始 URL
          try {
            response = await mainRequest.request(actualUrl, {
              method: http.RequestMethod.GET,
              connectTimeout: 15000,
              readTimeout: 15000,
              header: headers,
            })
          } catch (error) {
            throw new Error(`RSS request failed: ${error instanceof Error ? error.message : 'unknown error'}`)
          }
        }
      } else {
        // 不是 RSSHub URL，使用原始 URL
        try {
          response = await mainRequest.request(actualUrl, {
            method: http.RequestMethod.GET,
            connectTimeout: 15000,
            readTimeout: 15000,
            header: headers,
          })
        } catch (error) {
          throw new Error(`RSS request failed: ${error instanceof Error ? error.message : 'unknown error'}`)
        }
      }

      if (response.responseCode === 304) {
        console.info(`[RssFeedService] Feed not modified (304): ${feed.url}`)
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
        console.error(`[RssFeedService] HTTP error ${response.responseCode} for ${actualUrl}`)
        console.error(`[RssFeedService] Response headers:`, JSON.stringify(response.header))
        throw new Error(`RSS request failed with status ${response.responseCode}`)
      }

      let requestUrl = actualUrl
      let xml = String(response.result)
      const contentType = String(response.header['Content-Type'] ?? response.header['content-type'] ?? '').toLowerCase()

      console.info(`[RssFeedService] Response content-type: ${contentType}`)
      console.info(`[RssFeedService] Response length: ${xml.length}`)

      if (contentType.includes('text/html') || looksLikeHtmlDocument(xml)) {
        console.info(`[RssFeedService] Detected HTML, attempting RSS discovery`)
        const discoveredFeedUrl = discoverFeedUrlFromHtml(xml, requestUrl)
        if (discoveredFeedUrl && discoveredFeedUrl !== requestUrl) {
          console.info(`[RssFeedService] Discovered RSS feed: ${discoveredFeedUrl}`)
          const discoveryRequest = http.createHttp()
          let discoveryResponse: http.HttpResponse
          try {
            discoveryResponse = await discoveryRequest.request(discoveredFeedUrl, {
              method: http.RequestMethod.GET,
              connectTimeout: 15000,
              readTimeout: 15000,
              header: headers,
            })
          } catch (error) {
            discoveryRequest.destroy()
            throw new Error(`RSS discovery request failed: ${error instanceof Error ? error.message : 'unknown error'}`)
          }
          if (discoveryResponse.responseCode !== 200) {
            console.error(`[RssFeedService] Discovered feed HTTP error ${discoveryResponse.responseCode}`)
            discoveryRequest.destroy()
            throw new Error(`RSS request failed with status ${discoveryResponse.responseCode}`)
          }
          requestUrl = discoveredFeedUrl
          xml = String(discoveryResponse.result)
          console.info(`[RssFeedService] Successfully fetched discovered feed`)
          discoveryRequest.destroy()
        } else {
          console.warn(`[RssFeedService] No RSS feed discovered in HTML`)
        }
      }

      const rssItems = parseRssItems(feed.id, xml, requestUrl)
      const items = rssItems.length > 0 ? rssItems : parseAtomItems(feed.id, xml, requestUrl)
      
      console.info(`[RssFeedService] Parsed ${items.length} items (RSS: ${rssItems.length})`)
      
      const resolvedSiteUrl = parseFeedSiteUrl(xml, requestUrl) || feed.siteUrl || ''
      const resolvedImageUrl = parseFeedImageUrl(xml, resolvedSiteUrl || requestUrl) || feed.imageUrl || ''
      const resolvedDescription = parseFeedDescription(xml) || feed.description || ''
      const resolvedTitle = parseFeedTitle(xml) || feed.title

      console.info(`[RssFeedService] Feed title: ${resolvedTitle}`)
      console.info(`[RssFeedService] Site URL: ${resolvedSiteUrl}`)

      if (items.length === 0) {
        console.error(`[RssFeedService] No entries parsed from feed`)
        throw new Error('RSS parsed without entries')
      }

      const now = Date.now()
      const entries: Entry[] = items.map((item: ParsedItem): Entry => ({
        id: item.id,
        feedId: feed.id,
        title: item.title,
        url: item.link || feed.siteUrl || feed.url,
        summary: item.summary,
        content: item.content,
        author: item.author,
        publishedAt: item.publishedAt,
        readingTimeMinutes: estimateReadingMinutes(item.content),
        tags: item.tags,
        mediaUrls: item.mediaUrls,
        isRead: false,
        isStarred: false,
        createdAt: now,
        updatedAt: now,
      }))

      return {
        etag: String(response.header['ETag'] ?? response.header['etag'] ?? ''),
        lastModified: String(response.header['Last-Modified'] ?? response.header['last-modified'] ?? ''),
        feedTitle: resolvedTitle,
        siteUrl: resolvedSiteUrl,
        imageUrl: resolvedImageUrl,
        description: resolvedDescription,
        resolvedFeedUrl: requestUrl,
        entries,
      }
    } finally {
      activeRequest.destroy()
    }
  }
}
