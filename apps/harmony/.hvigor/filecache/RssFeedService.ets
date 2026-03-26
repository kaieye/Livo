import http from '@ohos.net.http'
import { Entry, Feed } from '../models/LivoModels'

interface ParsedItem {
  id: string
  title: string
  link: string
  summary: string
  content: string
  author: string
  publishedAt: number
  tags: string[]
}

export interface FeedRefreshPayload {
  etag: string
  lastModified: string
  entries: Entry[]
}

function decodeHtml(value: string): string {
  return value
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

function parseDate(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Date.now() : timestamp
}

function estimateReadingMinutes(content: string): number {
  const plainText = stripHtml(content)
  return Math.max(1, Math.ceil(plainText.length / 220))
}

function createEntryId(feedId: string, link: string, title: string, index: number): string {
  const normalized = `${feedId}-${link || title || index}`.toLowerCase()
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

function parseRssItems(feedId: string, xml: string): ParsedItem[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []

  return itemMatches.map((itemBlock: string, index: number) => {
    const title = stripHtml(pickTag(itemBlock, 'title')) || `远程条目 ${index + 1}`
    const link = stripHtml(pickTag(itemBlock, 'link'))
    const description = pickFirst(itemBlock, ['content:encoded', 'description'])
    const summary = stripHtml(description) || '这条内容暂时没有摘要。'
    const author = stripHtml(pickFirst(itemBlock, ['author', 'dc:creator'])) || '未知作者'
    const pubDate = stripHtml(pickFirst(itemBlock, ['pubDate', 'published', 'updated']))
    const content = stripHtml(description) ? stripHtml(description) : summary

    return {
      id: createEntryId(feedId, link, title, index),
      title,
      link,
      summary,
      content,
      author,
      publishedAt: parseDate(pubDate),
      tags: parseTags(itemBlock),
    }
  })
}

export class RssFeedService {
  static async fetchFeedEntries(feed: Feed): Promise<FeedRefreshPayload> {
    const request = http.createHttp()

    try {
      const headers: Record<string, string> = {
        Accept: 'application/rss+xml, application/xml, text/xml',
      }

      if (feed.etag) {
        headers['If-None-Match'] = feed.etag
      }

      if (feed.lastModified) {
        headers['If-Modified-Since'] = feed.lastModified
      }

      const response = await request.request(feed.url, {
        method: http.RequestMethod.GET,
        connectTimeout: 10000,
        readTimeout: 10000,
        header: headers,
      })

      if (response.responseCode === 304) {
        return {
          etag: feed.etag ?? '',
          lastModified: feed.lastModified ?? '',
          entries: [],
        }
      }

      if (response.responseCode !== 200) {
        throw new Error(`RSS request failed with status ${response.responseCode}`)
      }

      const xml = String(response.result)
      const items = parseRssItems(feed.id, xml)

      if (items.length === 0) {
        throw new Error('RSS parsed without entries')
      }

      const now = Date.now()
      const entries: Entry[] = items.map((item: ParsedItem) => ({
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
        isRead: false,
        isStarred: false,
        createdAt: now,
        updatedAt: now,
      }))

      const etagHeader = String(response.header['ETag'] ?? response.header['etag'] ?? '')
      const lastModifiedHeader = String(response.header['Last-Modified'] ?? response.header['last-modified'] ?? '')

      return {
        etag: etagHeader,
        lastModified: lastModifiedHeader,
        entries,
      }
    } finally {
      request.destroy()
    }
  }
}
