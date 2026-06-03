import { v4 as uuidv4 } from 'uuid'
import type { Entry, FeedViewType } from '../../../shared/types/index'
import {
  deriveImageUrl,
  extractAuthorAvatar,
  extractContent,
  extractMedia,
} from '../feed/feed-utils'
import { resolveCanonicalPostUrlForEntry } from './post-media-scraper'

/**
 * Derive the best possible title from the raw RSS item fields.
 *
 * Rules (applied in order):
 * 1. If title is missing or "Untitled", use the plain-text of summary as the
 *    title (many Instagram / social feeds have no <title> for photo-only posts
 *    but may still carry a short caption in <description>).  If summary is also
 *    empty, fall back to "".
 * 2. If the summary plain-text starts with the title and is strictly longer,
 *    adopt the summary text (handles RSS generators that truncate multi-line
 *    captions to the first line in <title>).
 */
function bestTitle(rawTitle: string, summary: string): string {
  const summaryPlain = (summary || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const titleNorm = (rawTitle || '').replace(/\s+/g, ' ').trim()

  // Rule 1: "Untitled" or empty → use summary text, or ""
  if (!titleNorm || titleNorm === 'Untitled') {
    return summaryPlain || ''
  }

  // Rule 2: truncated title → adopt longer summary
  if (
    summaryPlain.length > titleNorm.length &&
    summaryPlain.startsWith(titleNorm)
  ) {
    return summaryPlain
  }

  return rawTitle
}

function resolvePublishedAt(
  item: Record<string, any>,
  rawItem: Record<string, unknown>,
  now: number,
): number {
  const candidates: Array<unknown> = [
    item.isoDate,
    item.pubDate,
    item.published,
    item.updated,
    rawItem['dc:date'],
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const ts = new Date(String(candidate)).getTime()
    if (Number.isFinite(ts) && ts > 0) return ts
  }

  return now
}

function extractTwitterStatusUrl(raw: string): string {
  const text = String(raw || '')
  const m = text.match(
    /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|nitter\.[^/]+)\/[^/\s?#]+\/status\/\d+[^"]*/i,
  )
  return m?.[0] || ''
}

function hasTwitterStatusUrl(raw: string): boolean {
  return /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|nitter\.[^/]+)\/[^/\s?#]+\/status\/\d+/i.test(
    String(raw || ''),
  )
}

function resolveBestEntryUrl(
  item: Record<string, any>,
  rawItem: Record<string, unknown>,
  content: string,
  summary: string,
): string {
  const link = String(item.link || '').trim()
  const guid = String(item.guid || rawItem.guid || '').trim()
  const id = String(item.id || rawItem.id || '').trim()
  const textBlob = `${content || ''}\n${summary || ''}`

  // For X/Twitter feeds, prefer concrete status URLs from any available field.
  if (
    link.toLowerCase().includes('x.com') ||
    link.toLowerCase().includes('twitter.com') ||
    /\/status\//i.test(guid) ||
    /\/status\//i.test(id)
  ) {
    const fromLink = extractTwitterStatusUrl(link)
    if (fromLink) return fromLink
    const fromGuid = extractTwitterStatusUrl(guid)
    if (fromGuid) return fromGuid
    const fromId = extractTwitterStatusUrl(id)
    if (fromId) return fromId
    const fromText = extractTwitterStatusUrl(textBlob)
    if (fromText) return fromText
  }

  return link || guid || id
}

function appendAudioUrlContentFallback(
  content: string,
  media: NonNullable<Entry['media']>,
): string {
  if (content.trim()) return content

  const audioUrls = media
    .filter((item) => item.type === 'audio' && item.url)
    .map((item) => item.url)
  return audioUrls[0] || content
}

function buildSingleEntry(
  feedId: string,
  rawItem: Record<string, unknown>,
  item: Record<string, any>,
  authorAvatarSeed: string | undefined,
  _feedView: FeedViewType,
  now: number,
): Entry {
  const extractedContent = extractContent(rawItem)
  const extractedMedia = extractMedia(rawItem) || []
  // 播客条目可能只有 enclosure 音频而没有 description；保留一个可展示正文。
  const content = appendAudioUrlContentFallback(
    extractedContent,
    extractedMedia,
  )
  const derivedImage = deriveImageUrl(rawItem)
  const descStr = rawItem['description']
  const summaryStr = rawItem.summary
  const summary =
    item.contentSnippet ||
    (typeof descStr === 'string' ? descStr : '') ||
    (typeof summaryStr === 'string' ? summaryStr : '') ||
    extractedContent ||
    ''
  const bestSourceUrl = resolveBestEntryUrl(item, rawItem, content, summary)
  const canonicalUrl = resolveCanonicalPostUrlForEntry({
    url: bestSourceUrl,
    content,
    summary,
    imageUrl: derivedImage,
    media: extractedMedia,
  })
  const canonicalOrBest = canonicalUrl || bestSourceUrl
  const finalUrl = hasTwitterStatusUrl(bestSourceUrl)
    ? bestSourceUrl
    : canonicalOrBest || item.link || ''

  const firstPhoto = extractedMedia.find((m) => m.type === 'photo' && m.url)

  return {
    id: uuidv4(),
    feedId,
    title: bestTitle(item.title || '', summary),
    url: finalUrl,
    content,
    summary,
    author: item.creator || item.author || '',
    authorAvatar: extractAuthorAvatar(rawItem, authorAvatarSeed),
    imageUrl: firstPhoto?.url || derivedImage,
    media: extractedMedia,
    publishedAt: resolvePublishedAt(item, rawItem, now),
    isRead: false,
    isStarred: false,
    createdAt: now,
  }
}

export async function buildEntriesFromParsedItems(
  feedId: string,
  items: Array<Record<string, any>>,
  authorAvatarSeed: string | undefined,
  feedView: FeedViewType,
  now: number,
): Promise<Entry[]> {
  return items.map((item) => {
    const rawItem = item as Record<string, unknown>
    return buildSingleEntry(
      feedId,
      rawItem,
      item,
      authorAvatarSeed,
      feedView,
      now,
    )
  })
}
