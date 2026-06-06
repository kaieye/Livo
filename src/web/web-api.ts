/**
 * Web-compatible implementation of the Electron API.
 * Provides the same interface as the preload `window.api` object,
 * but uses browser-native APIs (IndexedDB, fetch with CORS proxy, etc.)
 */

import type { ElectronAPI } from '../preload/index'
import type {
  Feed,
  Entry,
  EntryListResult,
  FeedWithCount,
  FeedViewType,
  ReaderSnapshot,
  ReaderSnapshotRequest,
  ReaderSnapshotScope,
  MediaItem,
  AppSettings,
  AccountProvider,
  DiscoverFeedPreviewResult,
  AISemanticFilterInput,
  AISemanticFilterResult,
  AITranslateEntrySegmentsInput,
  AITranslateEntrySegmentsResult,
  AIDigestCandidate,
  AIDigestGenerateResult,
  AIDigestPreset,
  AIDigestRun,
  EntryAITranslationSegment,
  EntryAITranslationSession,
  EntryAITranslationSessionStatus,
  TaskRunListOptions,
  TaskRunRecord,
} from '../shared/types'
import { deriveEntryTaskSnapshot } from '../shared/entry-task-status'
import {
  normalizeDiscoverQueryToFeedUrl,
  extractBilibiliUid,
  extractTwitterUsernameFromUrl,
  decodeBasicHtmlEntities,
  extractTwitterDisplayNameFromText,
  isGenericTwitterTitle,
} from '../shared/discover-helpers'
import { FeedViewType as FVT } from '../shared/types'
import { mergeSettings, normalizeSettings } from '../shared/settings'
import { resolveOpenAIChatCompletionsUrl } from '../shared/ai-endpoint'
import { resolveProfileUrlToCandidates } from '../shared/profile-resolver'
import {
  CURATED_FEEDS,
  DISCOVER_CATEGORIES,
  RSSHUB_ROUTES,
  DEFAULT_RSSHUB_INSTANCE,
  searchCuratedFeeds,
} from '../shared/discover-data'
import {
  initWebDB,
  getAllFeeds,
  getFeedByUrl,
  insertFeed as dbInsertFeed,
  updateFeed as dbUpdateFeed,
  deleteFeed as dbDeleteFeed,
  getEntries as dbGetEntries,
  getEntryById as dbGetEntryById,
  insertEntry as dbInsertEntry,
  updateEntry as dbUpdateEntry,
  markAllRead as dbMarkAllRead,
  searchEntries as dbSearchEntries,
  getUnreadCount,
  getSettings,
  saveSettings,
} from './storage'

// ====== CORS Proxy ======
const DEFAULT_CORS_PROXY = 'https://api.allorigins.win/raw?url='

function getCorsProxyUrl(): string {
  try {
    const stored = localStorage.getItem('livo-cors-proxy')
    if (stored) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_CORS_PROXY
}

function proxiedUrl(url: string): string {
  return getCorsProxyUrl() + encodeURIComponent(url)
}

function toRsshubProtocolUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) return trimmed
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) return `rsshub://${rsshubMatch[1].replace(/^\/+/, '')}`
  try {
    const parsed = new URL(trimmed)
    const route = parsed.pathname.replace(/^\/+/, '')
    if (
      route &&
      /^(?:twitter|instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox|youtube|bilibili|github|weibo|zhihu|xiaoyuzhou)\//i.test(
        route,
      )
    ) {
      return `rsshub://${route}${parsed.search || ''}`
    }
  } catch {
    // Ignore parse failures.
  }
  return trimmed
}

function toFetchableFeedUrl(rawUrl: string, rsshubInstance: string): string {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) return trimmed
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    const base = rsshubInstance.replace(/\/+$/, '')
    return `${base}/${route}`
  }
  return trimmed
}

async function fetchXDisplayNameByUsername(username: string): Promise<string> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return ''
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(clean)}`
    const res = await fetch(proxiedUrl(profileUrl), {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
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

async function inferDiscoverResultTitle(
  feedUrl: string,
  parsedTitle?: string,
): Promise<string> {
  const twitterUsername = extractTwitterUsernameFromUrl(feedUrl)
  if (twitterUsername) {
    const candidate = (parsedTitle || '').trim()
    const parsedName = extractTwitterDisplayNameFromText(
      candidate,
      twitterUsername,
    )
    if (parsedName) return `${parsedName} - X`
    if (candidate && !isGenericTwitterTitle(candidate, twitterUsername))
      return candidate
    const fetchedName = await fetchXDisplayNameByUsername(twitterUsername)
    if (fetchedName) return `${fetchedName} - X`
    return `${twitterUsername} - X`
  }

  if (parsedTitle) {
    const m = parsedTitle.match(/^(.+?)\s+的\s+bilibili\s+/i)
    if (m?.[1]) return `${m[1].trim()} - Bilibili`
    const normalizedBilibili = parsedTitle
      .replace(
        /\s*bilibili\s*(?:space|\u7A7A\u95F4|\u6295\u7A3F|\u89C6\u9891|\u52A8\u6001)?\s*$/i,
        '',
      )
      .replace(/\s*[-\u2013\u2014:|/]+\s*$/g, '')
      .trim()
    return normalizedBilibili || parsedTitle
  }

  const bilibiliUid = extractBilibiliUid(feedUrl)
  if (bilibiliUid) return `UID ${bilibiliUid} - Bilibili`

  try {
    const u = new URL(feedUrl)
    return `${u.hostname.replace(/^www\./i, '')} - RSS`
  } catch {
    return feedUrl
  }
}

export function getFeedImageFromParsed(
  parsed:
    | {
        image?: { url?: string }
        items?: unknown
      }
    | null
    | undefined,
): string {
  return parsed?.image?.url?.trim() || ''
}

function readHtmlAttribute(tag: string, name: string): string {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  )
  const match = tag.match(pattern)
  return decodeBasicHtmlEntities(match?.[1] || match?.[2] || match?.[3] || '')
}

function resolveHttpUrl(rawUrl: string, baseUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''
  try {
    const resolved = new URL(trimmed, baseUrl).toString()
    return /^https?:\/\//i.test(resolved) ? resolved : ''
  } catch {
    return ''
  }
}

export function getSiteAvatarFromHtml(html: string, siteUrl: string): string {
  // 与主进程保持同样优先级：标准元数据、站点图标、头像语义图片。
  const metaTags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of metaTags) {
    const key = `${readHtmlAttribute(tag, 'property')} ${readHtmlAttribute(tag, 'name')}`
    if (!/\b(?:og:image|twitter:image|image)\b/i.test(key)) continue
    const resolved = resolveHttpUrl(readHtmlAttribute(tag, 'content'), siteUrl)
    if (resolved) return resolved
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const rel = readHtmlAttribute(tag, 'rel')
    if (!/(?:^|\s)(?:apple-touch-icon|icon|shortcut icon)(?:\s|$)/i.test(rel))
      continue
    const resolved = resolveHttpUrl(readHtmlAttribute(tag, 'href'), siteUrl)
    if (resolved) return resolved
  }

  const imageTags = html.match(/<img\b[^>]*>/gi) || []
  for (const tag of imageTags) {
    const semanticText = [
      readHtmlAttribute(tag, 'alt'),
      readHtmlAttribute(tag, 'title'),
      readHtmlAttribute(tag, 'class'),
      readHtmlAttribute(tag, 'id'),
    ].join(' ')
    if (
      !/(?:头像|个人照片|作者|关于|avatar|profile|portrait|author|person|photo)/i.test(
        semanticText,
      )
    )
      continue
    const resolved = resolveHttpUrl(readHtmlAttribute(tag, 'src'), siteUrl)
    if (resolved) return resolved
  }

  return ''
}

async function getSiteAvatar(siteUrl?: string): Promise<string> {
  if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) return ''
  try {
    const res = await fetch(proxiedUrl(siteUrl), {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!res.ok) return ''
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.includes('text/html')) return ''
    return getSiteAvatarFromHtml(await res.text(), siteUrl)
  } catch {
    return ''
  }
}

async function getFeedAvatarFromParsed(
  parsed: ParsedFeed,
  siteUrl?: string,
): Promise<string> {
  return getFeedImageFromParsed(parsed) || (await getSiteAvatar(siteUrl))
}

async function fetchInstagramAvatarByUsername(
  username: string,
): Promise<string> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return ''
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`
  try {
    const res = await fetch(proxiedUrl(profileUrl), {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    const og =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      )
    if (og?.[1] && /^https?:\/\//i.test(og[1])) return og[1]
    const hd = html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)
    if (hd?.[1]) {
      const decoded = hd[1].replace(/\\\//g, '/')
      if (/^https?:\/\//i.test(decoded)) return decoded
    }
  } catch {
    // Ignore fallback failure.
  }
  return ''
}

// ====== RSS Parsing in Browser ======

type ParsedFeedItem = {
  title: string
  link: string
  content: string
  contentSnippet: string
  creator: string
  isoDate: string
  enclosure?: { url: string; type: string }
  imageUrl?: string
  media?: MediaItem[]
}

type ParsedFeed = {
  title: string
  link: string
  description: string
  image?: { url: string }
  items: ParsedFeedItem[]
}

/** Minimal RSS parser for the browser (no external dependency needed) */
async function parseFeedFromUrl(feedUrl: string): Promise<ParsedFeed> {
  let url = feedUrl.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  const response = await fetch(proxiedUrl(url), {
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const text = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid XML')

  // Detect RSS vs Atom
  const isAtom = !!doc.querySelector('feed')

  if (isAtom) return parseAtom(doc)
  return parseRSS(doc)
}

function isParsedImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|bmp|avif)(?:[?#]|$)/i.test(url)
}

function isParsedAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:[?#]|$)/i.test(url)
}

function isParsedVideoUrl(url: string): boolean {
  return /\.(mp4|m4v|webm|mov|m3u8)(?:[?#]|$)/i.test(url)
}

function mediaFromEnclosure(url: string, type: string): MediaItem | undefined {
  const cleanUrl = url.trim()
  if (!cleanUrl) return undefined
  const mime = type.trim().toLowerCase()
  if (mime.startsWith('audio/') || (!mime && isParsedAudioUrl(cleanUrl))) {
    return { url: cleanUrl, type: 'audio' }
  }
  if (mime.startsWith('video/') || (!mime && isParsedVideoUrl(cleanUrl))) {
    return { url: cleanUrl, type: 'video' }
  }
  if (mime.startsWith('image/') || isParsedImageUrl(cleanUrl)) {
    return { url: cleanUrl, type: 'photo' }
  }
  return undefined
}

function parseDurationSeconds(
  raw: string | null | undefined,
): number | undefined {
  const value = (raw || '').trim()
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10)
  const parts = value.split(':').map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => !Number.isFinite(part))) return undefined
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return undefined
}

function getItunesImageUrl(scope: Element): string {
  const image = scope.querySelector('itunes\\:image')
  return image?.getAttribute('href')?.trim() || image?.textContent?.trim() || ''
}

function getItunesText(scope: Element, name: 'summary' | 'subtitle'): string {
  return scope.querySelector(`itunes\\:${name}`)?.textContent?.trim() || ''
}

function buildParsedMedia(
  enclosure: { url: string; type: string } | undefined,
  itunesImageUrl: string,
  duration: number | undefined,
): { media?: MediaItem[]; imageUrl?: string } {
  const media: MediaItem[] = []
  const append = (item: MediaItem | undefined) => {
    if (!item || media.some((existing) => existing.url === item.url)) return
    media.push(item)
  }

  if (enclosure) append(mediaFromEnclosure(enclosure.url, enclosure.type))
  if (itunesImageUrl) append({ url: itunesImageUrl, type: 'photo' })

  const timed = media.find(
    (item) =>
      (item.type === 'audio' || item.type === 'video') && !item.duration,
  )
  if (timed && duration && duration > 0) timed.duration = duration

  return {
    media: media.length > 0 ? media : undefined,
    imageUrl: media.find((item) => item.type === 'photo')?.url,
  }
}

function getParsedItemImageUrl(item: ParsedFeedItem): string | undefined {
  return (
    item.imageUrl || item.media?.find((media) => media.type === 'photo')?.url
  )
}

function appendAudioContentFallback(
  content: string,
  media: MediaItem[] | undefined,
): string {
  if (content.trim()) return content
  return media?.find((item) => item.type === 'audio')?.url || content
}

function parseRSS(doc: Document) {
  const channel = doc.querySelector('channel')
  const items = Array.from(doc.querySelectorAll('item')).map((item) => {
    const contentEncoded =
      item.querySelector('content\\:encoded, encoded')?.textContent || ''
    const description = item.querySelector('description')?.textContent || ''
    const date = item.querySelector('pubDate')?.textContent
    const enclosure = item.querySelector('enclosure')
    const enclosureData = enclosure
      ? {
          url: enclosure.getAttribute('url') || '',
          type: enclosure.getAttribute('type') || '',
        }
      : undefined
    const mediaData = buildParsedMedia(
      enclosureData,
      getItunesImageUrl(item),
      parseDurationSeconds(
        item.querySelector('itunes\\:duration')?.textContent,
      ),
    )
    const rawContent =
      contentEncoded ||
      description ||
      getItunesText(item, 'summary') ||
      getItunesText(item, 'subtitle')
    const content = appendAudioContentFallback(rawContent, mediaData.media)
    const creator =
      item.querySelector('dc\\:creator, creator')?.textContent ||
      item.querySelector('author')?.textContent ||
      ''
    return {
      title: item.querySelector('title')?.textContent || 'Untitled',
      link: item.querySelector('link')?.textContent || '',
      content,
      contentSnippet: stripHTML(content).slice(0, 200),
      creator,
      isoDate: date ? new Date(date).toISOString() : '',
      enclosure: enclosureData,
      imageUrl: mediaData.imageUrl,
      media: mediaData.media,
    }
  })

  return {
    title: channel?.querySelector('title')?.textContent || '',
    link: channel?.querySelector('link')?.textContent || '',
    description: channel?.querySelector('description')?.textContent || '',
    image: channel?.querySelector('image > url')?.textContent
      ? { url: channel.querySelector('image > url')!.textContent! }
      : undefined,
    items,
  }
}

function parseAtom(doc: Document) {
  const feed = doc.querySelector('feed')
  const items = Array.from(doc.querySelectorAll('entry')).map((entry) => {
    const link =
      entry.querySelector("link[rel='alternate']")?.getAttribute('href') ||
      entry.querySelector('link')?.getAttribute('href') ||
      ''
    const date = entry.querySelector('published, updated')?.textContent || ''
    const enclosureLink = entry.querySelector("link[rel='enclosure']")
    const enclosure = enclosureLink
      ? {
          url: enclosureLink.getAttribute('href') || '',
          type: enclosureLink.getAttribute('type') || '',
        }
      : undefined
    const mediaData = buildParsedMedia(
      enclosure,
      getItunesImageUrl(entry),
      parseDurationSeconds(
        entry.querySelector('itunes\\:duration')?.textContent,
      ),
    )
    const rawContent =
      entry.querySelector('content')?.textContent ||
      entry.querySelector('summary')?.textContent ||
      getItunesText(entry, 'summary') ||
      getItunesText(entry, 'subtitle')
    const content = appendAudioContentFallback(rawContent, mediaData.media)
    return {
      title: entry.querySelector('title')?.textContent || 'Untitled',
      link,
      content,
      contentSnippet: stripHTML(content).slice(0, 200),
      creator: entry.querySelector('author > name')?.textContent || '',
      isoDate: date ? new Date(date).toISOString() : '',
      enclosure,
      imageUrl: mediaData.imageUrl,
      media: mediaData.media,
    }
  })

  const altLink =
    feed?.querySelector("link[rel='alternate']")?.getAttribute('href') ||
    feed?.querySelector('link')?.getAttribute('href') ||
    ''

  return {
    title: feed?.querySelector('title')?.textContent || '',
    link: altLink,
    description: feed?.querySelector('subtitle')?.textContent || '',
    image: feed?.querySelector('icon')?.textContent
      ? { url: feed.querySelector('icon')!.textContent! }
      : undefined,
    items,
  }
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface WebSnapshotCursorPayload {
  v: 1
  offset: number
  queryKey: string
}

function normalizeSnapshotLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 10
  return Math.max(1, Math.min(Math.floor(limit), 1000))
}

function normalizeSnapshotScope(
  scope: ReaderSnapshotRequest['scope'],
): ReaderSnapshotScope {
  if (!scope) return { type: 'all' }
  if (scope.type === 'feed') return { type: 'feed', feedId: scope.feedId }
  if (scope.type === 'starred') return { type: 'starred' }
  return {
    type: 'all',
    feedIds: Array.from(new Set((scope.feedIds || []).filter(Boolean))).sort(),
  }
}

function buildSnapshotQueryKey(input: {
  scope: ReaderSnapshotScope
  unreadOnly: boolean
  limit: number
}): string {
  return JSON.stringify({
    scope: input.scope,
    unreadOnly: input.unreadOnly,
    limit: input.limit,
  })
}

function decodeSnapshotCursor(
  cursor: string | null | undefined,
  queryKey: string,
): number {
  if (!cursor) return 0
  try {
    const payload = JSON.parse(
      atob(cursor),
    ) as Partial<WebSnapshotCursorPayload>
    if (
      payload.v !== 1 ||
      payload.queryKey !== queryKey ||
      typeof payload.offset !== 'number' ||
      !Number.isFinite(payload.offset)
    ) {
      return 0
    }
    return Math.max(0, Math.floor(payload.offset))
  } catch {
    return 0
  }
}

function encodeSnapshotCursor(payload: WebSnapshotCursorPayload): string {
  return btoa(JSON.stringify(payload))
}

function toSnapshotEntryOptions(input: {
  scope: ReaderSnapshotScope
  unreadOnly: boolean
}): {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
} {
  const base = input.unreadOnly ? { unreadOnly: true } : {}
  switch (input.scope.type) {
    case 'feed':
      return { ...base, feedId: input.scope.feedId }
    case 'starred':
      return { ...base, starred: true }
    case 'all':
      return input.scope.feedIds?.length
        ? { ...base, feedIds: input.scope.feedIds }
        : base
    default:
      return base
  }
}

function normalizeAvatarComparisonKey(value: string | undefined): string {
  return (value || '').trim()
}

function collectEntryImageKeys(entry: Entry): Set<string> {
  const keys = new Set<string>()
  const push = (value: string | undefined): void => {
    const key = normalizeAvatarComparisonKey(value)
    if (key) keys.add(key)
  }

  push(entry.imageUrl)
  for (const media of entry.media || []) {
    if (media.type !== 'photo') continue
    push(media.url)
    push(media.previewUrl)
  }

  return keys
}

function findPollutedFeedAvatarKeys(
  feeds: FeedWithCount[],
  entries: Entry[],
): Map<string, string> {
  const entryImageKeysByFeedId = new Map<string, Set<string>>()
  for (const entry of entries) {
    const current = entryImageKeysByFeedId.get(entry.feedId) || new Set()
    for (const key of collectEntryImageKeys(entry)) current.add(key)
    entryImageKeysByFeedId.set(entry.feedId, current)
  }

  const polluted = new Map<string, string>()
  for (const feed of feeds) {
    const feedImageKey = normalizeAvatarComparisonKey(feed.imageUrl)
    if (!feedImageKey) continue
    if (entryImageKeysByFeedId.get(feed.id)?.has(feedImageKey)) {
      polluted.set(feed.id, feedImageKey)
    }
  }
  return polluted
}

async function buildWebReaderSnapshot(
  input: ReaderSnapshotRequest = {},
): Promise<ReaderSnapshot> {
  const scope = normalizeSnapshotScope(input.scope)
  const limit = normalizeSnapshotLimit(input.limit)
  const unreadOnly = !!input.unreadOnly
  const queryKey = buildSnapshotQueryKey({ scope, unreadOnly, limit })
  const offset = decodeSnapshotCursor(input.cursor, queryKey)
  const feeds = await getAllFeeds()
  const unreadByFeedId: Record<string, number> = {}
  const feedsWithCount: FeedWithCount[] = []
  for (const feed of feeds) {
    const unreadCount = await getUnreadCount(feed.id)
    unreadByFeedId[feed.id] = unreadCount
    feedsWithCount.push({ ...feed, unreadCount })
  }
  const entries = await dbGetEntries({
    ...toSnapshotEntryOptions({ scope, unreadOnly }),
    limit: limit + 1,
    offset,
  })
  const pageEntries = entries.slice(0, limit)
  const pollutedFeedAvatarKeys = findPollutedFeedAvatarKeys(
    feedsWithCount,
    pageEntries,
  )
  const snapshotEntries = pageEntries.map((entry) => {
    const authorAvatarKey = normalizeAvatarComparisonKey(entry.authorAvatar)
    const pollutedFeedAvatarKey = pollutedFeedAvatarKeys.get(entry.feedId)
    const authorAvatar =
      authorAvatarKey &&
      (authorAvatarKey === pollutedFeedAvatarKey ||
        collectEntryImageKeys(entry).has(authorAvatarKey))
        ? ''
        : entry.authorAvatar
    return {
      ...entry,
      authorAvatar,
      taskSnapshot: deriveEntryTaskSnapshot(entry),
    }
  })
  const snapshotFeeds = feedsWithCount.map((feed) =>
    pollutedFeedAvatarKeys.has(feed.id)
      ? { ...feed, imageUrl: undefined }
      : feed,
  )
  const nextCursor =
    entries.length > limit
      ? encodeSnapshotCursor({ v: 1, offset: offset + limit, queryKey })
      : null
  const totalUnread = Object.values(unreadByFeedId).reduce(
    (total, count) => total + count,
    0,
  )
  const scopeUnread =
    scope.type === 'feed'
      ? unreadByFeedId[scope.feedId] || 0
      : scope.type === 'all' && scope.feedIds?.length
        ? scope.feedIds.reduce(
            (total, feedId) => total + (unreadByFeedId[feedId] || 0),
            0,
          )
        : totalUnread

  return {
    feeds: snapshotFeeds.sort((a, b) => a.title.localeCompare(b.title)),
    entries: snapshotEntries,
    counts: {
      totalFeeds: feedsWithCount.length,
      totalUnread,
      unreadByFeedId,
      scopeUnread,
    },
    nextCursor,
  }
}

/** Auto-detect view type from feed items */
function detectViewType(
  items: Array<{
    content: string
    enclosure?: { type: string }
    media?: MediaItem[]
  }>,
): FVT {
  let videoCount = 0,
    imageCount = 0
  for (const item of items.slice(0, 10)) {
    const enc = item.enclosure
    if (
      item.media?.some((media) => media.type === 'video') ||
      enc?.type?.startsWith('video/') ||
      item.content.includes('<video') ||
      item.content.includes('youtube.com/embed')
    )
      videoCount++
    else if ((item.content.match(/<img/g) || []).length >= 3) imageCount++
  }
  const total = items.length || 1
  if (videoCount / total > 0.5) return FVT.Videos
  if (imageCount / total > 0.5) return FVT.SocialMedia
  return FVT.Articles
}

async function buildDiscoverFeedPreview(
  targetUrl: string,
): Promise<DiscoverFeedPreviewResult> {
  const cleanUrl = (targetUrl || '').trim()
  if (!cleanUrl) return { success: false, error: 'Feed URL is required' }

  try {
    const storedUrl = toRsshubProtocolUrl(cleanUrl)
    const fetchUrl = toFetchableFeedUrl(storedUrl, DEFAULT_RSSHUB_INSTANCE)
    const parsed = await parseFeedFromUrl(fetchUrl)
    const now = Date.now()
    const displayTitle = await inferDiscoverResultTitle(
      fetchUrl,
      parsed.title || undefined,
    )
    const imageUrl = await getFeedAvatarFromParsed(
      parsed,
      parsed.link || fetchUrl,
    )

    return {
      success: true,
      preview: {
        targetUrl: cleanUrl,
        resolvedFeedUrl: fetchUrl,
        feedTitle: displayTitle || parsed.title || cleanUrl,
        siteUrl: parsed.link || fetchUrl,
        description: parsed.description || '',
        imageUrl,
        itemCount: parsed.items.length,
        entries: parsed.items.slice(0, 6).map((item, index) => ({
          id: `${fetchUrl}#preview-${index}`,
          title: item.title || item.creator || item.link || '',
          url: item.link || '',
          summary: item.contentSnippet || stripHTML(item.content || ''),
          author: item.creator || undefined,
          imageUrl: getParsedItemImageUrl(item),
          publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : now,
        })),
      },
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// ====== OpenAI Client for Browser ======

const WEB_DIGEST_RUNS_KEY = 'livo-ai-digest-runs'

function getWebDigestPresetLabel(preset: AIDigestPreset): string {
  return preset === 'week' ? '本周趋势' : '今日简报'
}

function getWebDigestWindow(
  preset: AIDigestPreset,
  now = Date.now(),
): { windowStartAt: number; windowEndAt: number } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (preset === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  }
  return { windowStartAt: start.getTime(), windowEndAt: now }
}

function readWebDigestRuns(): AIDigestRun[] {
  try {
    const raw = localStorage.getItem(WEB_DIGEST_RUNS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as AIDigestRun[]) : []
  } catch {
    return []
  }
}

function writeWebDigestRuns(runs: AIDigestRun[]): void {
  localStorage.setItem(WEB_DIGEST_RUNS_KEY, JSON.stringify(runs.slice(0, 100)))
}

function saveWebDigestRun(run: AIDigestRun): AIDigestRun {
  const runs = readWebDigestRuns()
  const index = runs.findIndex((item) => item.id === run.id)
  if (index >= 0) runs[index] = run
  else runs.unshift(run)
  writeWebDigestRuns(runs)
  return run
}

function stripDigestText(value: string | undefined): string {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function listWebDigestCandidates(options: {
  preset: AIDigestPreset
  feedId?: string
  now?: number
}): Promise<AIDigestCandidate[]> {
  const now = options.now ?? Date.now()
  const { windowStartAt, windowEndAt } = getWebDigestWindow(options.preset, now)
  const [feeds, entries] = await Promise.all([getAllFeeds(), dbGetEntries({})])
  const feedsById = new Map(feeds.map((feed) => [feed.id, feed]))
  return entries
    .filter((entry) => {
      if (options.feedId && entry.feedId !== options.feedId) return false
      return (
        entry.publishedAt >= windowStartAt && entry.publishedAt <= windowEndAt
      )
    })
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 80)
    .map((entry) => {
      const feed = feedsById.get(entry.feedId)
      const content = stripDigestText(
        entry.readabilityContent || entry.content || entry.summary,
      )
      const summary = stripDigestText(entry.aiSummary || entry.summary)
      return {
        id: entry.id,
        title: entry.title || summary.slice(0, 80) || content.slice(0, 80),
        summary,
        content,
        feedTitle: feed?.title,
        url: entry.url,
        publishedAt: entry.publishedAt,
      }
    })
    .filter(
      (candidate) => candidate.title || candidate.summary || candidate.content,
    )
}

function buildWebDigestMessages(input: {
  presetLabel: string
  candidates: AIDigestCandidate[]
}): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content:
        '你是 RSS 阅读简报编辑。只依据输入文章生成结构化 Markdown 报告，不编造事实。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        preset: input.presetLabel,
        articles: input.candidates.slice(0, 12).map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          source: candidate.feedTitle,
          text: (candidate.summary || candidate.content || '').slice(0, 2400),
        })),
        output: '生成关键趋势、值得关注、后续观察三部分；每个判断附来源 id。',
      }),
    },
  ]
}

async function callAI(
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; max_tokens?: number; stream?: false },
): Promise<{ content: string }> {
  const settings = await getSettings()
  const ai = settings.ai
  if (!ai.apiKey) throw new Error('请先在设置中配置 AI API Key')

  const baseUrl = ai.baseUrl?.trim() || getDefaultBaseUrl(ai.provider)
  const response = await fetch(resolveOpenAIChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model: ai.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
      stream: false,
    }),
  })

  if (!response.ok)
    throw new Error(`AI API Error: ${response.status} ${response.statusText}`)
  const data = await response.json()
  return { content: data.choices?.[0]?.message?.content || '' }
}

async function callAIStream(
  messages: Array<{ role: string; content: string }>,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  options: { temperature?: number; max_tokens?: number } = {},
): Promise<void> {
  const settings = await getSettings()
  const ai = settings.ai
  if (!ai.apiKey) {
    const message = '请先在设置中配置 AI API Key'
    onError(message)
    throw new Error(message)
  }

  const baseUrl = ai.baseUrl?.trim() || getDefaultBaseUrl(ai.provider)
  try {
    const response = await fetch(resolveOpenAIChatCompletionsUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4000,
        stream: true,
      }),
    })

    if (!response.ok) throw new Error(`AI API Error: ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            onDone()
            return
          }
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content || ''
            if (content) onChunk(content)
          } catch {
            /* skip invalid JSON */
          }
        }
      }
    }
    onDone()
  } catch (error) {
    const message = String(error)
    onError(message)
    throw error
  }
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
    glm: 'https://open.bigmodel.cn/api/paas/v4',
    minimax: 'https://api.minimax.chat/v1',
  }
  return urls[provider] || 'https://api.openai.com/v1'
}

function normalizeAIText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function buildWebSemanticFilterMessages(
  input: AISemanticFilterInput,
): Array<{ role: string; content: string }> {
  const condition = normalizeAIText(input.condition)
  const title = normalizeAIText(input.title)
  if (!condition) throw new Error('过滤条件 不能为空')
  if (!title) throw new Error('标题 不能为空')

  const summary = normalizeAIText(input.summary).slice(0, 2400)
  const evidence = [
    `订阅源：${normalizeAIText(input.feedTitle) || '未知'}`,
    `标题：${title}`,
    input.author ? `作者：${normalizeAIText(input.author)}` : '',
    input.url ? `URL：${normalizeAIText(input.url)}` : '',
    summary ? `摘要：${summary}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return [
    {
      role: 'system',
      content:
        '你是文章过滤判定器。只根据给定的标题、摘要和元数据判断文章是否符合过滤条件。输出严格 JSON，不要输出解释性正文。',
    },
    {
      role: 'user',
      content: [
        `过滤条件：${condition}`,
        '',
        '文章信息：',
        evidence,
        '',
        '输出格式：{"matched":true|false,"confidence":0到1之间的数字,"reason":"不超过40字的中文原因"}',
      ].join('\n'),
    },
  ]
}

function parseWebSemanticFilterDecision(raw: string): AISemanticFilterResult {
  const text = raw.trim()
  if (!text) return { success: false, error: 'AI 返回为空' }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) {
      return { success: false, error: 'AI 返回不是 JSON 对象' }
    }
    try {
      parsed = JSON.parse(text.slice(start, end + 1))
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, error: 'AI 返回不是 JSON 对象' }
  }

  const record = parsed as Record<string, unknown>
  if (typeof record.matched !== 'boolean') {
    return { success: false, error: 'AI 返回缺少 matched 布尔值' }
  }

  const confidence =
    typeof record.confidence === 'number' && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : 0

  return {
    success: true,
    decision: {
      matched: record.matched,
      confidence,
      reason: normalizeAIText(record.reason).slice(0, 80),
    },
  }
}

// ====== Readability for Web ======

async function fetchReadableContent(url: string) {
  const response = await fetch(proxiedUrl(url), {
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()

  // Parse with DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove unwanted elements
  const removeSelectors = [
    'script',
    'style',
    'noscript',
    'svg',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'iframe',
    '.sidebar',
    '.widget',
    '.ad',
    '.ads',
    '.advert',
    '.social-share',
    '.related-posts',
    '.comments',
    '.newsletter',
    '.popup',
    '.modal',
    '.cookie',
    '.banner',
  ]
  for (const sel of removeSelectors) {
    doc.querySelectorAll(sel).forEach((el) => el.remove())
  }

  // Find main content
  const contentEl =
    doc.querySelector('article') ||
    doc.querySelector("[role='main']") ||
    doc.querySelector('.article-content, .post-content, .entry-content') ||
    doc.querySelector('main') ||
    doc.body

  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('title')?.textContent?.replace(/\s*[|\-–—].*$/, '') ||
    ''

  const siteName =
    doc
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute('content') || new URL(url).hostname.replace(/^www\./, '')

  const content = contentEl?.innerHTML || ''
  const textContent = contentEl?.textContent?.trim() || ''

  return {
    success: true,
    title: title.trim(),
    content,
    excerpt: textContent.slice(0, 200),
    siteName,
    length: textContent.length,
  }
}

// ====== OPML Parsing for Web ======

function parseOPMLContent(xml: string): Array<{
  title: string
  xmlUrl: string
  htmlUrl?: string
  category?: string
}> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const feeds: Array<{
    title: string
    xmlUrl: string
    htmlUrl?: string
    category?: string
  }> = []

  function traverse(
    outlines: NodeListOf<Element> | Element[],
    parentCategory = '',
  ) {
    for (const outline of outlines) {
      const xmlUrl =
        outline.getAttribute('xmlUrl') || outline.getAttribute('xmlurl')
      const title =
        outline.getAttribute('title') || outline.getAttribute('text') || ''
      const htmlUrl =
        outline.getAttribute('htmlUrl') || outline.getAttribute('htmlurl')

      if (xmlUrl) {
        feeds.push({
          title: title || xmlUrl,
          xmlUrl,
          htmlUrl: htmlUrl || undefined,
          category: parentCategory || undefined,
        })
      } else {
        // Folder — recurse
        const children = outline.querySelectorAll(':scope > outline')
        if (children.length > 0) {
          traverse(children, title || parentCategory)
        }
      }
    }
  }

  const body = doc.querySelector('body')
  if (body) {
    traverse(body.querySelectorAll(':scope > outline'))
  }

  return feeds
}

function generateOPMLContent(feeds: Feed[]): string {
  const cats = new Map<string, Feed[]>()
  for (const f of feeds) {
    const cat = f.category || ''
    if (!cats.has(cat)) cats.set(cat, [])
    cats.get(cat)!.push(f)
  }
  let body = ''
  for (const [cat, catFeeds] of cats) {
    if (cat) {
      body += `    <outline text="${escXML(cat)}" title="${escXML(cat)}">\n`
      for (const f of catFeeds)
        body += `      <outline type="rss" text="${escXML(f.title)}" title="${escXML(f.title)}" xmlUrl="${escXML(f.url)}"${f.siteUrl ? ` htmlUrl="${escXML(f.siteUrl)}"` : ''} />\n`
      body += `    </outline>\n`
    } else {
      for (const f of catFeeds)
        body += `    <outline type="rss" text="${escXML(f.title)}" title="${escXML(f.title)}" xmlUrl="${escXML(f.url)}"${f.siteUrl ? ` htmlUrl="${escXML(f.siteUrl)}"` : ''} />\n`
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>Livo Subscriptions</title>\n    <dateCreated>${new Date().toUTCString()}</dateCreated>\n  </head>\n  <body>\n${body}  </body>\n</opml>`
}

function escXML(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ====== Event System ======

type EventCallback = (...args: unknown[]) => void
const eventListeners = new Map<string, Set<EventCallback>>()

function emit(channel: string, ...args: unknown[]) {
  const listeners = eventListeners.get(channel)
  if (listeners) listeners.forEach((cb) => cb(...args))
}

const webTaskRuns = new Map<string, TaskRunRecord>()
const webTranslationSessions = new Map<string, EntryAITranslationSession>()

function listWebTaskRuns(options?: TaskRunListOptions): TaskRunRecord[] {
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200))
  return Array.from(webTaskRuns.values())
    .filter((run) =>
      options?.taskName ? run.taskName === options.taskName : true,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

// ====== Build the WebAPI object ======

export function createWebAPI(): ElectronAPI {
  const api: ElectronAPI = {
    feeds: {
      add: async (
        url: string,
        category?: string,
        view?: FeedViewType,
        title?: string,
      ) => {
        try {
          const storedUrl = toRsshubProtocolUrl(url)
          const fetchUrl = toFetchableFeedUrl(
            storedUrl,
            DEFAULT_RSSHUB_INSTANCE,
          )
          const parsed = await parseFeedFromUrl(fetchUrl)
          const id = generateId()
          const now = Date.now()
          const detectedView = view ?? detectViewType(parsed.items)

          const feed: Feed = {
            id,
            title: title?.trim() || parsed.title || storedUrl,
            url: storedUrl,
            siteUrl: parsed.link,
            description: parsed.description,
            imageUrl: await getFeedAvatarFromParsed(
              parsed,
              parsed.link || fetchUrl,
            ),
            category: category || '',
            view: detectedView,
            showInAll: true,
            lastFetched: now,
            errorCount: 0,
            createdAt: now,
          }

          await dbInsertFeed(feed)

          for (const item of parsed.items || []) {
            await dbInsertEntry({
              id: generateId(),
              feedId: id,
              title: item.title || 'Untitled',
              url: item.link || '',
              content: item.content || '',
              summary: item.contentSnippet || '',
              author: item.creator || '',
              imageUrl: getParsedItemImageUrl(item) || '',
              media: item.media,
              publishedAt: item.isoDate
                ? new Date(item.isoDate).getTime()
                : now,
              isRead: false,
              isStarred: false,
              createdAt: now,
            })
          }

          return { success: true, feed }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      remove: async (feedId: string) => {
        await dbDeleteFeed(feedId)
        return { success: true }
      },

      list: async (): Promise<FeedWithCount[]> => {
        const feeds = await getAllFeeds()
        const result: FeedWithCount[] = []
        for (const f of feeds) {
          const unreadCount = await getUnreadCount(f.id)
          result.push({ ...f, unreadCount })
        }
        return result.sort((a, b) => a.title.localeCompare(b.title))
      },

      refresh: async (feedId: string) => {
        const feeds = await getAllFeeds()
        const feed = feeds.find((f) => f.id === feedId)
        if (!feed) return { success: false, error: 'Feed not found' }
        try {
          const parsed = await parseFeedFromUrl(
            toFetchableFeedUrl(feed.url, DEFAULT_RSSHUB_INSTANCE),
          )
          const now = Date.now()
          await dbUpdateFeed(feedId, {
            title: parsed.title || feed.title,
            description: parsed.description,
            imageUrl: await getFeedAvatarFromParsed(
              parsed,
              parsed.link || feed.siteUrl,
            ),
            lastFetched: now,
            errorCount: 0,
          })
          let newCount = 0
          for (const item of parsed.items || []) {
            const added = await dbInsertEntry({
              id: generateId(),
              feedId,
              title: item.title || 'Untitled',
              url: item.link || '',
              content: item.content || '',
              summary: item.contentSnippet || '',
              author: item.creator || '',
              imageUrl: getParsedItemImageUrl(item) || '',
              media: item.media,
              publishedAt: item.isoDate
                ? new Date(item.isoDate).getTime()
                : now,
              isRead: false,
              isStarred: false,
              createdAt: now,
            })
            if (added) newCount++
          }
          const refreshed = (await getAllFeeds()).find((f) => f.id === feedId)
          const unreadCount = await getUnreadCount(feedId)
          return {
            success: true,
            newEntries: newCount,
            feed: refreshed,
            unreadCount,
          }
        } catch (error) {
          await dbUpdateFeed(feedId, { errorCount: feed.errorCount + 1 })
          return { success: false, error: String(error) }
        }
      },

      refreshAll: async () => {
        const feeds = await getAllFeeds()
        const results: Array<{
          feedId: string
          success: boolean
          newEntries?: number
        }> = []
        for (const feed of feeds) {
          try {
            const parsed = await parseFeedFromUrl(
              toFetchableFeedUrl(feed.url, DEFAULT_RSSHUB_INSTANCE),
            )
            const now = Date.now()
            await dbUpdateFeed(feed.id, {
              title: parsed.title || feed.title,
              description: parsed.description,
              imageUrl: await getFeedAvatarFromParsed(
                parsed,
                parsed.link || feed.siteUrl,
              ),
              lastFetched: now,
              errorCount: 0,
            })
            let newCount = 0
            for (const item of parsed.items || []) {
              const added = await dbInsertEntry({
                id: generateId(),
                feedId: feed.id,
                title: item.title || 'Untitled',
                url: item.link || '',
                content: item.content || '',
                summary: item.contentSnippet || '',
                author: item.creator || '',
                imageUrl: getParsedItemImageUrl(item) || '',
                media: item.media,
                publishedAt: item.isoDate
                  ? new Date(item.isoDate).getTime()
                  : now,
                isRead: false,
                isStarred: false,
                createdAt: now,
              })
              if (added) newCount++
            }
            results.push({
              feedId: feed.id,
              success: true,
              newEntries: newCount,
            })
          } catch {
            await dbUpdateFeed(feed.id, { errorCount: feed.errorCount + 1 })
            results.push({ feedId: feed.id, success: false })
          }
        }
        return results
      },

      update: async (feedId: string, updates: Partial<Feed>) => {
        await dbUpdateFeed(feedId, updates)
        return { success: true }
      },

      importOPML: async () => {
        // Web: use file input
        return new Promise((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.opml,.xml'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) {
              resolve({ success: false, canceled: true })
              return
            }
            try {
              const content = await file.text()
              const opmlFeeds = parseOPMLContent(content)
              if (opmlFeeds.length === 0) {
                resolve({ success: false, error: 'OPML 文件中没有找到订阅源' })
                return
              }
              let imported = 0,
                skipped = 0
              const importedFeedIds: string[] = []
              const errors: string[] = []
              for (const opmlFeed of opmlFeeds) {
                const storedXmlUrl = toRsshubProtocolUrl(opmlFeed.xmlUrl)
                const fetchXmlUrl = toFetchableFeedUrl(
                  storedXmlUrl,
                  DEFAULT_RSSHUB_INSTANCE,
                )
                const existing = await getFeedByUrl(storedXmlUrl)
                if (existing) {
                  skipped++
                  continue
                }
                try {
                  const parsed = await parseFeedFromUrl(fetchXmlUrl)
                  const id = generateId()
                  const now = Date.now()
                  await dbInsertFeed({
                    id,
                    title: opmlFeed.title || parsed.title || storedXmlUrl,
                    url: storedXmlUrl,
                    siteUrl: opmlFeed.htmlUrl || parsed.link,
                    description: parsed.description,
                    imageUrl: await getFeedAvatarFromParsed(
                      parsed,
                      opmlFeed.htmlUrl || parsed.link,
                    ),
                    category: opmlFeed.category || '',
                    view: detectViewType(parsed.items),
                    showInAll: true,
                    lastFetched: now,
                    errorCount: 0,
                    createdAt: now,
                  })
                  for (const item of parsed.items || []) {
                    await dbInsertEntry({
                      id: generateId(),
                      feedId: id,
                      title: item.title || 'Untitled',
                      url: item.link || '',
                      content: item.content || '',
                      summary: item.contentSnippet || '',
                      author: item.creator || '',
                      imageUrl: getParsedItemImageUrl(item) || '',
                      media: item.media,
                      publishedAt: item.isoDate
                        ? new Date(item.isoDate).getTime()
                        : now,
                      isRead: false,
                      isStarred: false,
                      createdAt: now,
                    })
                  }
                  importedFeedIds.push(id)
                  imported++
                } catch (err) {
                  errors.push(`${opmlFeed.title}: ${String(err).slice(0, 100)}`)
                }
              }
              resolve({
                success: true,
                total: opmlFeeds.length,
                imported,
                skipped,
                importedFeedIds,
                errors: errors.length > 0 ? errors : undefined,
              })
            } catch (err) {
              resolve({ success: false, error: String(err) })
            }
          }
          input.click()
        })
      },

      exportOPML: async () => {
        const feeds = await getAllFeeds()
        if (feeds.length === 0)
          return { success: false, error: '没有可导出的订阅源' }
        const opml = generateOPMLContent(feeds)
        const blob = new Blob([opml], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'livo-subscriptions.opml'
        a.click()
        URL.revokeObjectURL(url)
        return { success: true, count: feeds.length }
      },

      refreshImportedFeeds: async (_feedIds: string[]) => {
        // Web: stub — full refresh cycle not supported in web mode.
        // The import itself already parses feeds inline.
        return { success: true, total: 0, refreshed: 0, failed: 0 }
      },
    },

    entries: {
      list: async (options: {
        feedId?: string
        feedIds?: string[]
        starred?: boolean
        unreadOnly?: boolean
        limit?: number
        offset?: number
        compact?: boolean
        maxContentLength?: number
        skipDedupe?: boolean
      }): Promise<EntryListResult> => {
        const limit = options.limit ?? 50
        const entries = await dbGetEntries({ ...options, limit: limit + 1 })
        return {
          entries: entries.slice(0, limit),
          hasMore: entries.length > limit,
        }
      },
      get: async (entryId: string): Promise<Entry | null> => {
        return (await dbGetEntryById(entryId)) || null
      },
      markRead: async (entryId: string, isRead: boolean) => {
        await dbUpdateEntry(entryId, { isRead })
        return { success: true }
      },
      markAllRead: async (feedId?: string) => {
        await dbMarkAllRead(feedId)
        return { success: true }
      },
      toggleStar: async (entryId: string) => {
        const entry = await dbGetEntryById(entryId)
        if (!entry) return { success: false, isStarred: false }
        const newStarred = !entry.isStarred
        await dbUpdateEntry(entryId, { isStarred: newStarred })
        return { success: true, isStarred: newStarred }
      },
      saveProgress: async (entryId: string, readProgress: number) => {
        await dbUpdateEntry(entryId, { readProgress })
        return { success: true }
      },
      search: async (query: string, limit?: number): Promise<Entry[]> => {
        return dbSearchEntries(query, limit)
      },
      markListened: async (_entryId: string, _isListened: boolean) => ({
        success: true,
      }),
      saveListenProgress: async (
        _entryId: string,
        _listenProgress: number,
      ) => ({ success: true }),
    },

    reader: {
      snapshot: buildWebReaderSnapshot,
    },

    ai: {
      summarize: async (
        content: string,
        language?: string,
        requestId?: string,
      ) => {
        const settings = await getSettings()
        if (!settings.ai.apiKey)
          return { success: false, error: '请先在设置中配置 AI API Key' }
        try {
          const lang = language || settings.general.language || 'zh-CN'
          const messages = [
            {
              role: 'system',
              content: `You are a helpful assistant that summarizes articles. Provide a concise summary in ${lang}. Keep it under 200 words. Focus on key points and main ideas.`,
            },
            {
              role: 'user',
              content: `Please summarize the following article:\n\n${content.slice(0, 8000)}`,
            },
          ]
          if (requestId) {
            let summary = ''
            await callAIStream(
              messages,
              (delta) => {
                summary += delta
                emit('ai:summary-stream-chunk', { requestId, content: delta })
              },
              () => emit('ai:summary-stream-done', { requestId }),
              (error) => emit('ai:summary-stream-error', { requestId, error }),
              { temperature: 0.3, max_tokens: 500 },
            )
            return { success: true, summary }
          }

          const result = await callAI(messages, {
            temperature: 0.3,
            max_tokens: 500,
          })
          return { success: true, summary: result.content }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      summarizeEntry: async (
        entryId: string,
        language?: string,
        requestId?: string,
      ) => {
        const entry = await dbGetEntryById(entryId)
        if (!entry) return { success: false, error: 'entry_not_found' }
        const content =
          entry.readabilityContent?.trim() ||
          entry.content?.trim() ||
          entry.summary?.trim() ||
          ''
        if (!content) return { success: false, error: 'entry_content_empty' }
        const result = await api.ai.summarize(content, language, requestId)
        const now = Date.now()
        if (result.success) {
          await dbUpdateEntry(entryId, {
            aiSummary: result.summary,
            aiSummaryGeneratedAt: now,
            aiSummaryError: undefined,
          })
          return {
            success: true,
            summary: result.summary,
            runId: `web-ai-summary-${now}`,
            session: {
              id: `web-ai-summary-${entryId}-${now}`,
              entryId,
              status: 'succeeded' as const,
              draftText: result.summary,
              finalText: result.summary,
              createdAt: now,
              updatedAt: now,
              finishedAt: now,
            },
          }
        }
        await dbUpdateEntry(entryId, { aiSummaryError: result.error })
        return {
          success: false,
          error: result.error,
          session: {
            id: `web-ai-summary-${entryId}-${now}`,
            entryId,
            status: 'failed' as const,
            draftText: '',
            errorMessage: result.error,
            rawErrorMessage: result.error,
            createdAt: now,
            updatedAt: now,
            finishedAt: now,
          },
        }
      },

      getSummarySession: async (entryId: string) => {
        const entry = await dbGetEntryById(entryId)
        if (!entry?.aiSummary && !entry?.aiSummaryError) return null
        const now = entry.aiSummaryGeneratedAt || Date.now()
        return {
          id: `web-ai-summary-${entryId}-${now}`,
          entryId,
          status: entry.aiSummary
            ? ('succeeded' as const)
            : ('failed' as const),
          draftText: entry.aiSummary || '',
          finalText: entry.aiSummary,
          errorMessage: entry.aiSummaryError,
          rawErrorMessage: entry.aiSummaryError,
          createdAt: now,
          updatedAt: now,
          finishedAt: now,
        }
      },

      translate: async (
        content: string,
        targetLanguage: string,
        requestId?: string,
      ) => {
        const settings = await getSettings()
        if (!settings.ai.apiKey)
          return { success: false, error: '请先在设置中配置 AI API Key' }
        try {
          const messages = [
            {
              role: 'system',
              content: `You are a professional translator. Translate the following content to ${targetLanguage}. Preserve original HTML formatting and tags. Only output the translation, no explanations.`,
            },
            { role: 'user', content: content.slice(0, 6000) },
          ]
          if (requestId) {
            let translation = ''
            await callAIStream(
              messages,
              (delta) => {
                translation += delta
                emit('ai:translate-stream-chunk', {
                  requestId,
                  content: delta,
                })
              },
              () => emit('ai:translate-stream-done', { requestId }),
              (error) =>
                emit('ai:translate-stream-error', { requestId, error }),
              { temperature: 0.2, max_tokens: 4000 },
            )
            return { success: true, translation }
          }

          const result = await callAI(messages, {
            temperature: 0.2,
            max_tokens: 4000,
          })
          return { success: true, translation: result.content }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      translateEntrySegments: async (
        input: AITranslateEntrySegmentsInput,
      ): Promise<AITranslateEntrySegmentsResult> => {
        const entryId = input.entryId.trim()
        const targetLanguage = input.targetLanguage.trim() || 'zh-CN'
        if (!entryId) return { success: false, error: 'entry_id_required' }
        if (input.paragraphs.length === 0) {
          return { success: false, error: 'empty_content' }
        }

        const now = Date.now()
        const shouldTranslateParagraph = (paragraph: string) =>
          paragraph.replace(/<[^>]*>/g, '').trim().length >= 5
        let session =
          Array.from(webTranslationSessions.values())
            .filter(
              (item) =>
                item.entryId === entryId &&
                item.targetLanguage === targetLanguage &&
                item.segments.length === input.paragraphs.length &&
                item.segments.every(
                  (segment, index) =>
                    segment.sourceText === input.paragraphs[index],
                ),
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null

        const buildSegments = (
          translatedParagraphs: string[],
          errorMap: Record<number, string>,
        ): EntryAITranslationSegment[] =>
          input.paragraphs.map((paragraph, index) => {
            const errorMessage = errorMap[index]
            const translatedText = translatedParagraphs[index] ?? ''
            return {
              index,
              sourceText: paragraph,
              translatedText,
              status: !shouldTranslateParagraph(paragraph)
                ? 'skipped'
                : errorMessage
                  ? 'failed'
                  : translatedText
                    ? 'succeeded'
                    : 'queued',
              errorMessage,
            }
          })

        const translatedParagraphs: string[] = []
        const errorMap: Record<number, string> = {}
        if (session) {
          for (const segment of session.segments) {
            translatedParagraphs[segment.index] = segment.translatedText || ''
            if (segment.status === 'failed' && segment.errorMessage) {
              errorMap[segment.index] = segment.errorMessage
            }
          }
        } else {
          session = {
            id: `web-ai-translation-${entryId}-${now}`,
            entryId,
            targetLanguage,
            status: 'running',
            segments: buildSegments(translatedParagraphs, errorMap),
            model: undefined,
            configFingerprint: undefined,
            createdAt: now,
            updatedAt: now,
          }
          webTranslationSessions.set(session.id, session)
        }

        const requestedIndexes =
          input.indexes && input.indexes.length > 0
            ? new Set(input.indexes)
            : null
        const targets = input.paragraphs
          .map((paragraph, index) => ({ paragraph, index }))
          .filter(({ paragraph, index }) => {
            if (requestedIndexes && !requestedIndexes.has(index)) return false
            return shouldTranslateParagraph(paragraph)
          })

        for (const target of targets) {
          try {
            translatedParagraphs[target.index] = ''
            delete errorMap[target.index]
            const result = await callAI(
              [
                {
                  role: 'system',
                  content: `Translate the following content to ${targetLanguage}. Preserve meaning and formatting where possible. Return only the translation.`,
                },
                { role: 'user', content: target.paragraph },
              ],
              { temperature: 0.2, max_tokens: 4000 },
            )
            translatedParagraphs[target.index] = result.content
          } catch (error) {
            errorMap[target.index] = String(error)
          }
        }

        const hasErrors = Object.keys(errorMap).length > 0
        const next: EntryAITranslationSession = {
          ...session,
          status: hasErrors ? 'failed' : 'succeeded',
          segments: buildSegments(translatedParagraphs, errorMap),
          errorMessage: hasErrors ? '部分段落翻译失败' : undefined,
          updatedAt: Date.now(),
          finishedAt: Date.now(),
        }
        webTranslationSessions.set(next.id, next)
        return { success: true, session: next, translatedParagraphs, errorMap }
      },

      getTranslationSession: async (entryId: string) => {
        return (
          Array.from(webTranslationSessions.values())
            .filter((session) => session.entryId === entryId)
            .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null
        )
      },

      createTranslationSession: async (input: {
        entryId: string
        targetLanguage: string
        status: EntryAITranslationSessionStatus
        segments?: EntryAITranslationSegment[]
        errorCode?: string
        errorMessage?: string
        model?: string
        configFingerprint?: string
        runId?: string
      }) => {
        const now = Date.now()
        const session: EntryAITranslationSession = {
          id: `web-ai-translation-${input.entryId}-${now}`,
          entryId: input.entryId,
          targetLanguage: input.targetLanguage,
          status: input.status,
          segments: input.segments ?? [],
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          model: input.model,
          configFingerprint: input.configFingerprint,
          runId: input.runId,
          createdAt: now,
          updatedAt: now,
        }
        webTranslationSessions.set(session.id, session)
        return session
      },

      updateTranslationSession: async (
        sessionId: string,
        updates: {
          targetLanguage?: string
          status?: EntryAITranslationSessionStatus
          segments?: EntryAITranslationSegment[]
          errorCode?: string
          errorMessage?: string
          model?: string
          configFingerprint?: string
          runId?: string
          finishedAt?: number
        },
      ) => {
        const current = webTranslationSessions.get(sessionId)
        if (!current) return null
        const next: EntryAITranslationSession = {
          ...current,
          ...updates,
          updatedAt: Date.now(),
        }
        webTranslationSessions.set(sessionId, next)
        return next
      },

      chat: async (messages: Array<{ role: string; content: string }>) => {
        try {
          const result = await callAI(messages, {
            temperature: 0.7,
            max_tokens: 2000,
          })
          return { success: true, message: result.content }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      chatStream: async (
        messages: Array<{ role: string; content: string }>,
        requestId: string,
      ) => {
        try {
          await callAIStream(
            messages,
            (content) => emit('ai:chat-stream-chunk', { requestId, content }),
            () => emit('ai:chat-stream-done', { requestId }),
            (error) => emit('ai:chat-stream-error', { requestId, error }),
          )
          return { success: true }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      judgeFilter: async (
        input: AISemanticFilterInput,
      ): Promise<AISemanticFilterResult> => {
        const settings = await getSettings()
        if (!settings.ai.apiKey) {
          return { success: false, error: '请先在设置中配置 AI API Key' }
        }

        try {
          const result = await callAI(buildWebSemanticFilterMessages(input), {
            temperature: 0,
            max_tokens: 180,
          })
          return parseWebSemanticFilterDecision(result.content)
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },

      digest: {
        listRuns: async (limit = 20): Promise<AIDigestRun[]> => {
          return readWebDigestRuns()
            .sort(
              (a, b) =>
                (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
            )
            .slice(0, Math.max(1, Math.min(limit, 100)))
        },
        generate: async (input: {
          preset: AIDigestPreset
          feedId?: string
        }): Promise<AIDigestGenerateResult> => {
          const preset = input.preset === 'week' ? 'week' : 'today'
          const presetLabel = getWebDigestPresetLabel(preset)
          const now = Date.now()
          const { windowStartAt, windowEndAt } = getWebDigestWindow(preset, now)
          const candidates = await listWebDigestCandidates({
            preset,
            feedId: input.feedId,
            now,
          })
          const run = saveWebDigestRun({
            id: `digest-${now}-${Math.random().toString(36).slice(2, 8)}`,
            preset,
            feedId: input.feedId,
            title: presetLabel,
            status: 'running',
            windowStartAt,
            windowEndAt,
            sourceEntryIds: [],
            candidateCount: candidates.length,
            createdAt: now,
            updatedAt: now,
          })

          if (candidates.length === 0) {
            const failed = saveWebDigestRun({
              ...run,
              status: 'failed',
              error: '当前时间窗内没有可用于生成简报的文章',
              updatedAt: Date.now(),
            })
            return { success: false, error: failed.error || '', run: failed }
          }

          try {
            const selected = candidates.slice(0, 12)
            const result = await callAI(
              buildWebDigestMessages({ presetLabel, candidates: selected }),
              { temperature: 0.3, max_tokens: 2200 },
            )
            const completed = saveWebDigestRun({
              ...run,
              status: 'completed',
              sourceEntryIds: selected.map((candidate) => candidate.id),
              content: result.content,
              updatedAt: Date.now(),
            })
            return { success: true, run: completed, candidates: selected }
          } catch (error) {
            const failed = saveWebDigestRun({
              ...run,
              status: 'failed',
              error: String(error),
              updatedAt: Date.now(),
            })
            return { success: false, error: String(error), run: failed }
          }
        },
      },

      onStreamChunk: (
        callback: (data: { requestId: string; content: string }) => void,
      ) => {
        const cb = (...args: unknown[]) =>
          callback(args[0] as { requestId: string; content: string })
        if (!eventListeners.has('ai:chat-stream-chunk'))
          eventListeners.set('ai:chat-stream-chunk', new Set())
        eventListeners.get('ai:chat-stream-chunk')!.add(cb)
        return (() =>
          eventListeners.get('ai:chat-stream-chunk')?.delete(cb)) as any
      },
      onStreamDone: (callback: (data: { requestId: string }) => void) => {
        const cb = (...args: unknown[]) =>
          callback(args[0] as { requestId: string })
        if (!eventListeners.has('ai:chat-stream-done'))
          eventListeners.set('ai:chat-stream-done', new Set())
        eventListeners.get('ai:chat-stream-done')!.add(cb)
        return (() =>
          eventListeners.get('ai:chat-stream-done')?.delete(cb)) as any
      },
      onStreamError: (
        callback: (data: { requestId: string; error: string }) => void,
      ) => {
        const cb = (...args: unknown[]) =>
          callback(args[0] as { requestId: string; error: string })
        if (!eventListeners.has('ai:chat-stream-error'))
          eventListeners.set('ai:chat-stream-error', new Set())
        eventListeners.get('ai:chat-stream-error')!.add(cb)
        return (() =>
          eventListeners.get('ai:chat-stream-error')?.delete(cb)) as any
      },
      testConnection: async () => ({
        success: false,
        message: 'Not available on web',
      }),
    },

    tasks: {
      getRun: async (runId: string): Promise<TaskRunRecord | null> =>
        webTaskRuns.get(runId) ?? null,
      listRuns: async (
        options?: TaskRunListOptions,
      ): Promise<TaskRunRecord[]> => listWebTaskRuns(options),
    },

    settings: {
      get: async (): Promise<AppSettings> => {
        return normalizeSettings(await getSettings())
      },
      set: async (updates: Partial<AppSettings>) => {
        const current = await getSettings()
        const merged = mergeSettings(current, updates)
        await saveSettings(merged)
        return { success: true, settings: merged }
      },
      onChanged: () => (() => {}) as any,
    },

    data: {
      cleanup: async () => ({
        removed: 0,
        removedByCap: 0,
        removedByAge: 0,
        remaining: (await dbGetEntries({})).length,
      }),
      stats: async () => {
        const [feeds, entries] = await Promise.all([
          getAllFeeds(),
          dbGetEntries({}),
        ])
        return {
          totalFeeds: feeds.length,
          totalEntries: entries.length,
          readEntries: entries.filter((entry) => entry.isRead).length,
          starredEntries: entries.filter((entry) => entry.isStarred).length,
          dataSizeBytes: 0,
          cacheSizeBytes: 0,
        }
      },
    },

    app: {
      getVersion: async () => 'web-dev',
      openExternal: async (url: string) => {
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
          return { success: true }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      reportError: async (payload: {
        source: string
        message: string
        stack?: string
        componentStack?: string
      }) => {
        console.error('[Livo Web Error]', payload)
        return { success: true }
      },
      readRecentLogs: async () => ({
        success: true,
        content: 'Web 平台暂无主进程日志，可使用浏览器控制台查看错误。',
      }),
      openDataDirectory: async () => ({
        success: false,
        error: 'Web 平台没有本地数据目录',
      }),
      openCacheDirectory: async () => ({
        success: false,
        error: 'Web 平台没有本地缓存目录',
      }),
      openLogsDirectory: async () => ({
        success: false,
        error: 'Web 平台没有主进程日志目录',
      }),
      clearCache: async () => ({
        success: true,
        clearedBytes: 0,
      }),
      saveTextFile: async () => ({
        success: false,
        error: 'Web 平台暂不支持原生保存文件',
      }),
      downloadUrl: async () => ({
        success: false,
        error: 'Web 平台暂不支持原生下载文件',
      }),
      checkForUpdates: async () => ({
        hasUpdate: false,
        currentVersion: 'web-dev',
      }),
    },

    // Readability
    readability: {
      fetch: async (url: string) => {
        try {
          return await fetchReadableContent(url)
        } catch (error) {
          return { success: false, error: `无法获取原文: ${String(error)}` }
        }
      },
    },

    // Discover
    discover: {
      categories: async () => DISCOVER_CATEGORIES,
      popular: async (category?: string) =>
        category
          ? CURATED_FEEDS.filter((f) => f.category === category)
          : CURATED_FEEDS,
      search: async (query: string, _platform?: string) => {
        const results: Array<{
          title: string
          url: string
          siteUrl: string
          description: string
          source: 'curated' | 'url' | 'rsshub'
        }> = []
        const curated = searchCuratedFeeds(query)
        for (const f of curated)
          results.push({
            title: f.title,
            url: f.url,
            siteUrl: f.siteUrl,
            description: f.description,
            source: 'curated',
          })
        const q = query.toLowerCase()
        for (const r of RSSHUB_ROUTES.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q),
        )) {
          results.push({
            title: r.name,
            url: `${DEFAULT_RSSHUB_INSTANCE}${r.url}`,
            siteUrl: `${DEFAULT_RSSHUB_INSTANCE}${r.url}`,
            description: `${r.description} (RSSHub)`,
            source: 'rsshub',
          })
        }
        const trimmedQuery = query.trim()
        const looksLikeUrl =
          /^rsshub:\/\//i.test(trimmedQuery) ||
          /^https?:\/\//i.test(trimmedQuery) ||
          (trimmedQuery.includes('.') && !trimmedQuery.includes(' '))
        if (looksLikeUrl) {
          const feedUrl = normalizeDiscoverQueryToFeedUrl(
            trimmedQuery,
            DEFAULT_RSSHUB_INSTANCE,
          )
          try {
            const parsed = await parseFeedFromUrl(feedUrl)
            if (!results.some((r) => r.url === feedUrl)) {
              const displayTitle = await inferDiscoverResultTitle(
                feedUrl,
                parsed.title || undefined,
              )
              results.push({
                title: displayTitle,
                url: feedUrl,
                siteUrl: parsed.link || feedUrl,
                description: parsed.description || '直接 URL 订阅',
                source: 'url',
              })
            }
          } catch {
            if (!results.some((r) => r.url === feedUrl)) {
              const displayTitle = await inferDiscoverResultTitle(feedUrl)
              results.push({
                title: displayTitle,
                url: feedUrl,
                siteUrl: feedUrl,
                description: '直接 URL 订阅',
                source: 'url',
              })
            }
          }
        }
        return results
      },
      rsshubRoutes: async (category?: string) =>
        category
          ? RSSHUB_ROUTES.filter((r) => r.category === category)
          : RSSHUB_ROUTES,
      rsshubInstance: async () => DEFAULT_RSSHUB_INSTANCE,
      validateFeed: async (url: string) => {
        try {
          const fetchUrl = toFetchableFeedUrl(url, DEFAULT_RSSHUB_INSTANCE)
          const parsed = await parseFeedFromUrl(fetchUrl)
          return {
            valid: true,
            title: parsed.title,
            description: parsed.description,
            image: await getFeedAvatarFromParsed(parsed, parsed.link || url),
            itemCount: parsed.items.length,
          }
        } catch (error) {
          return { valid: false, error: String(error) }
        }
      },
      previewFeed: buildDiscoverFeedPreview,
      resolveProfileUrl: async (url: string) => {
        const resolved = resolveProfileUrlToCandidates(
          url,
          DEFAULT_RSSHUB_INSTANCE,
        )
        if (resolved.platform === 'x') {
          const usernames = new Set<string>()
          for (const c of resolved.candidates) {
            const m = c.feedUrl.match(/\/twitter\/user\/([^/?#]+)/i)
            if (m?.[1]) usernames.add(decodeURIComponent(m[1]))
          }
          if (usernames.size === 0 && resolved.normalizedUrl) {
            try {
              const u = new URL(resolved.normalizedUrl)
              const maybeUser = u.pathname
                .split('/')
                .filter(Boolean)[0]
                ?.replace(/^@/, '')
              if (maybeUser) usernames.add(maybeUser)
            } catch {
              // Ignore malformed URLs.
            }
          }
          const existing = new Set(resolved.candidates.map((x) => x.feedUrl))
          for (const username of usernames) {
            const nitterUrl = `https://nitter.net/${encodeURIComponent(username)}/rss`
            if (existing.has(nitterUrl)) continue
            resolved.candidates.push({
              feedUrl: nitterUrl,
              title: `@${username}`,
              source: 'derived',
              siteUrl: `https://x.com/${username}`,
              description: 'Nitter RSS fallback for X/Twitter user',
            })
            existing.add(nitterUrl)
          }
          if (resolved.candidates.length > 0) {
            resolved.matched = true
            resolved.reason = null
          }
        }
        if (
          resolved.candidates.some((c) =>
            c.requiresAccount?.includes('youtube'),
          )
        ) {
          resolved.accountStates = [
            { provider: 'youtube', linked: false, displayName: null },
          ]
        } else {
          resolved.accountStates = []
        }
        return resolved
      },
      probeVideoSources: async (query: string) => {
        const clean = query.trim().replace(/^@/, '')
        if (!clean) return { valid: false, query: clean, candidates: [] }
        const candidates: Array<{
          platform: 'youtube' | 'bilibili'
          title: string
          description: string
          image: string
          feedUrl: string
        }> = []
        try {
          const yt = await (window as any).api?.discover?.probeYouTubeChannel?.(
            clean,
          )
          if (yt?.valid && yt.feedUrl) {
            candidates.push({
              platform: 'youtube',
              title: yt.title || `${clean} - YouTube`,
              description: yt.description || 'YouTube',
              image: yt.image || '',
              feedUrl: yt.feedUrl,
            })
          }
        } catch {
          // Ignore.
        }
        return { valid: candidates.length > 0, query: clean, candidates }
      },
      probeBilibiliUid: async (uid: string) => {
        const clean = (uid || '').trim().match(/^(\d{3,})$/)?.[1]
        if (!clean) return { valid: false, uid }
        const feedUrl = `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${clean}`
        return {
          valid: true,
          uid: clean,
          title: `UID ${clean} - Bilibili`,
          description: `UID ${clean}`,
          image: '',
          feedUrl,
        }
      },
      probeBilibiliUsers: async (query: string) => {
        const clean = (query || '').trim()
        if (!clean) return { valid: false, query: clean, candidates: [] }
        const candidates: Array<{
          uid: string
          title: string
          description: string
          image: string
          feedUrl: string
        }> = []
        try {
          const endpoint = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(clean)}`
          const res = await fetch(endpoint)
          if (res.ok) {
            const json = (await res.json()) as {
              code?: number
              data?: {
                result?: Array<{
                  mid?: number
                  uname?: string
                  usign?: string
                  upic?: string
                }>
              }
            }
            if (json.code === 0) {
              const q = clean.toLowerCase()
              const seen = new Set<string>()
              for (const user of (json.data?.result || []).slice(0, 6)) {
                const uid = user.mid ? String(user.mid) : ''
                if (!uid || seen.has(uid)) continue
                seen.add(uid)
                const uname = (user.uname || `UID ${uid}`)
                  .replace(/<[^>]+>/g, '')
                  .trim()
                const usign = (user.usign || '').replace(/<[^>]+>/g, '').trim()
                const searchable = `${uname} ${usign} ${uid}`.toLowerCase()
                if (!searchable.includes(q)) continue
                candidates.push({
                  uid,
                  title: `${uname} - Bilibili`,
                  description: usign || `UID ${uid}`,
                  image: user.upic || '',
                  feedUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/${uid}`,
                })
              }
            }
          }
        } catch {
          // Ignore.
        }
        return { valid: candidates.length > 0, query: clean, candidates }
      },
      probeTwitterUser: async (username: string) => {
        const clean = username.trim().replace(/^@/, '')
        const fallbackTitle = `${clean} - X`
        const candidates = [
          `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/${encodeURIComponent(clean)}`,
          `https://nitter.net/${encodeURIComponent(clean)}/rss`,
        ]
        for (const feedUrl of candidates) {
          try {
            const parsed = await parseFeedFromUrl(feedUrl)
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
                  : parsed.title || fallbackTitle,
              description: parsed.description || '',
              image: `https://unavatar.io/x/${encodeURIComponent(clean)}`,
              feedUrl,
            }
          } catch {
            continue
          }
        }
        return { valid: false, username: clean }
      },
      probeYouTubeChannel: async (query: string) => {
        const clean = query.trim().replace(/^@/, '')
        if (!clean) return { valid: false, query: clean }
        const routes = [
          `/youtube/user/@${clean}`,
          `/youtube/user/${clean}`,
          `/youtube/channel/${clean}`,
        ]
        for (const route of routes) {
          try {
            const feedUrl = `${DEFAULT_RSSHUB_INSTANCE}${route}`
            const parsed = await parseFeedFromUrl(feedUrl)
            return {
              valid: true,
              query: clean,
              title: parsed.title || clean,
              description: parsed.description || '',
              image: (parsed as any).image?.url || '',
              feedUrl,
              feedRoute: route,
            }
          } catch {
            continue
          }
        }
        return { valid: false, query: clean }
      },
      probeInstagramUser: async (username: string) => {
        const clean = username.trim().replace(/^@/, '')
        if (!clean) return { valid: false, username: clean }
        const routes = [`/instagram/user/${encodeURIComponent(clean)}`]
        const profileAvatar = await fetchInstagramAvatarByUsername(clean)
        for (const route of routes) {
          try {
            const feedUrl = `${DEFAULT_RSSHUB_INSTANCE}${route}`
            const parsed = await parseFeedFromUrl(feedUrl)
            const image =
              getFeedImageFromParsed(parsed) ||
              (await getSiteAvatar(parsed.link || feedUrl)) ||
              profileAvatar ||
              `https://unavatar.io/instagram/${encodeURIComponent(clean)}`
            return {
              valid: true,
              username: clean,
              title: parsed.title || `@${clean}`,
              description: parsed.description || '',
              image,
              feedUrl,
            }
          } catch {
            continue
          }
        }
        return { valid: false, username: clean }
      },
    },

    // Video resolution & YouTube account — web platform stubs
    video: {
      resolve: async (_url: string) => ({
        success: false as const,
        error: 'Not available on web platform',
      }),
      openInApp: async (url: string) => {
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
          return { success: true }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      ytLogin: async () => ({ success: false, error: 'Not available on web' }),
      ytStatus: async () => ({ loggedIn: false, name: null }),
      ytLogout: async () => ({ success: false, error: 'Not available on web' }),
    },

    accounts: {
      status: async (provider: AccountProvider) => ({
        provider,
        linked: false as const,
        displayName: null,
      }),
      link: async (_provider: AccountProvider) => ({
        success: false as const,
        error: 'Not available on web',
      }),
      unlink: async (_provider: AccountProvider) => ({
        success: false as const,
        error: 'Not available on web',
      }),
      setDisplayName: async (
        _provider: AccountProvider,
        _displayName: string,
      ) => ({ success: false as const, error: 'Not available on web' }),
      bilibiliFollowings: async () => ({
        success: false as const,
        error: 'Not available on web',
      }),
    },

    actions: {
      sync: async () => ({ success: true }),
    },

    agent: {
      run: async () => ({
        success: false as const,
        error: 'Not available on web',
      }),
      resume: async () => ({
        success: false as const,
        error: 'Not available on web',
      }),
      abort: async () => ({ success: true }),
      listTraces: async () => [],
      clearTraces: async () => ({ success: true }),
      onToolEvent: () => (() => {}) as any,
      onNavigate: () => (() => {}) as any,
    },

    menu: {
      showContextMenu: async () => ({ id: null }),
    },

    windowControls: {
      minimize: async () => ({ success: true }),
      maximizeToggle: async () => ({ success: true }),
      close: async () => ({ success: true }),
      isMaximized: async () => false,
      onMaximizeChange: () => () => {},
      platform: 'web',
    },

    refreshLogs: {
      list: async () => [],
      clear: async () => ({ success: true }),
    },

    fever: {
      listAccounts: async () => [],
      createAccount: async () => {
        throw new Error('Not available on web')
      },
      updateAccount: async () => ({
        success: false,
        error: 'Not available on web',
      }),
      deleteAccount: async () => ({
        success: false,
        error: 'Not available on web',
      }),
      verify: async () => ({ success: false, error: 'Not available on web' }),
      sync: async () => ({
        success: false,
        feedsSynced: 0,
        itemsSynced: 0,
        newEntries: 0,
        error: 'Not available on web',
      }),
      syncAll: async () => ({ success: false, results: [] }),
      getSyncState: async () => null,
      onSyncProgress: () => (() => {}) as any,
    },

    on: (channel: string, callback: (...args: unknown[]) => void) => {
      if (!eventListeners.has(channel)) eventListeners.set(channel, new Set())
      eventListeners.get(channel)!.add(callback)
      return (() => eventListeners.get(channel)?.delete(callback)) as any
    },
  }

  return api
}

/** Initialize the web platform and return the API */
export async function initWebPlatform(): Promise<ElectronAPI> {
  await initWebDB()
  return createWebAPI()
}
