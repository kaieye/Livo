import { Entry, Feed } from '../../models/LivoModels'
import { appendFeedMediaUrlsToContent, extractFeedMediaUrls } from '../../utils/FeedMediaUrl'
import { parseBilibiliDynamicEntries } from '../../utils/BilibiliDynamicFeed'
import {
  stripHtml,
  normalizeRichContent,
  stripCdata,
  pickTag,
  pickFirst,
  pickTagFromContainer,
} from '../../utils/HtmlParser'

export interface ParsedItem {
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

export interface BilibiliDynamicApiPayload {
  data?: object
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
  return { protocol: match[1], host: match[2], pathname: match[3] ?? '' }
}

export function resolveAbsoluteUrl(baseUrl: string, rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  if (trimmed.startsWith('//')) {
    const baseProtocol = new RegExp('^https?:').exec(baseUrl)?.[0] ?? 'https:'
    return `${baseProtocol}${trimmed}`
  }
  const base = parseBaseUrl(baseUrl)
  if (trimmed.startsWith('/')) {
    return `${base.protocol}//${base.host}${trimmed}`
  }
  const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1)
  return `${base.protocol}//${base.host}${basePath}${trimmed}`
}

export function discoverFeedUrlFromHtml(html: string, baseUrl: string): string {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? []
  for (const tag of linkTags) {
    const rel = extractAttribute(tag, 'rel').toLowerCase()
    const type = extractAttribute(tag, 'type').toLowerCase()
    const href = extractAttribute(tag, 'href')
    if (!href || !rel.includes('alternate')) {
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

function extractAttribute(tag: string, name: string): string {
  const regex = new RegExp(`${name}="([^"]+)"|${name}='([^']+)'`, 'i')
  const matched = tag.match(regex)
  return matched?.[1] ?? matched?.[2] ?? ''
}

export function parseRssItems(feedId: string, xml: string, baseUrl: string): ParsedItem[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  return itemMatches.map((itemBlock: string, index: number): ParsedItem => {
    const title = stripHtml(pickTag(itemBlock, 'title')) || `远程条目 ${index + 1}`
    const link = stripHtml(pickTag(itemBlock, 'link'))
    const guid = stripHtml(pickTag(itemBlock, 'guid'))
    const description = pickFirst(itemBlock, ['content:encoded', 'description'])
    const summary = stripHtml(description) || '这条内容暂时没有摘要。'
    const author = stripHtml(pickFirst(itemBlock, ['author', 'dc:creator'])) || '未知作者'
    const pubDate = stripHtml(pickFirst(itemBlock, ['pubDate', 'published', 'updated']))
    const mediaUrls = extractFeedMediaUrls(itemBlock, baseUrl)
    const content = appendFeedMediaUrlsToContent(normalizeRichContent(description, summary), mediaUrls)
    const item: ParsedItem = {
      id: createEntryId(feedId, guid, link, title, index),
      title: title, link: link, summary: summary, content: content, author: author,
      publishedAt: parseDate(pubDate),
      tags: parseTags(itemBlock),
      mediaUrls: mediaUrls,
    }
    return item
  })
}

export function parseAtomItems(feedId: string, xml: string, baseUrl: string): ParsedItem[] {
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  return entryMatches.map((entryBlock: string, index: number): ParsedItem => {
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
    const item: ParsedItem = {
      id: createEntryId(feedId, entryId, link, title, index),
      title: title, link: link, summary: summary, content: content, author: author,
      publishedAt: parseDate(pubDate),
      tags: parseAtomTags(entryBlock),
      mediaUrls: mediaUrls,
    }
    return item
  })
}

export function parseFeedTitle(xml: string): string {
  return stripHtml(pickTagFromContainer(xml, 'channel', 'title') || pickTag(xml, 'title'))
}

export function parseFeedDescription(xml: string): string {
  return stripHtml(
    pickTagFromContainer(xml, 'channel', 'description')
      || pickTag(xml, 'subtitle')
      || pickTag(xml, 'description'),
  )
}

export function parseFeedSiteUrl(xml: string, feedUrl: string): string {
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

export function parseFeedImageUrl(xml: string, baseUrl: string): string {
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

export function buildEntriesFromItems(items: ParsedItem[], feed: Feed): Entry[] {
  const now = Date.now()
  return items.map((item: ParsedItem): Entry => ({
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
}

export function parseBilibiliDynamic(feedId: string, data: object): Entry[] {
  return parseBilibiliDynamicEntries(feedId, data)
}
