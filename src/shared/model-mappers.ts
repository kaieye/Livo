import type {
  FeedCardModel,
  EntryCardModel,
  ArticleDetailModel,
} from './view-models'
import type {
  Entry,
  Feed,
  FeedWithCount,
  FeedViewType,
  MediaItem,
} from './types'
import { VIEW_DEFINITIONS } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function viewDefinitionOf(viewType: FeedViewType) {
  return VIEW_DEFINITIONS[viewType] ?? VIEW_DEFINITIONS[0]
}

function feedSiteUrl(feed: Feed): string {
  return feed.siteUrl || feed.url || ''
}

/**
 * Estimate reading time in minutes.
 * CJK characters: ~400 chars/min. Latin words: ~200 words/min.
 */
export function estimateReadingTime(text: string | undefined | null): number {
  const raw = (text || '').replace(/<[^>]*>/g, '').trim()
  const cjkCount = (raw.match(/[一-鿿぀-ヿ가-힯]/g) || []).length
  const latinText = raw.replace(/[一-鿿぀-ヿ가-힯]/g, '')
  const wordCount = latinText.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(cjkCount / 400 + wordCount / 200))
}

// ── Social feed display name resolution ─────────────────────────────────────

function extractTwitterUsername(url: string | undefined | null): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (
      ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(host) ||
      host.includes('nitter')
    ) {
      const first = parsed.pathname.split('/').filter(Boolean)[0]
      if (first) return decodeURIComponent(first).replace(/^@/, '')
    }
  } catch {
    /* ignore parse failures */
  }
  return ''
}

function extractInstagramUsername(url: string | undefined | null): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const instagram = u.pathname.match(/\/instagram\/user\/([^/?#]+)/i)
    if (instagram?.[1])
      return decodeURIComponent(instagram[1]).replace(/^@/, '')
    const picnob = u.pathname.match(/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, '')
  } catch {
    /* ignore parse failures */
  }
  return ''
}

function extractTwitterFromTitle(title: string | undefined | null): string {
  const raw = (title || '').trim()
  const match = raw.match(/@([a-zA-Z0-9_]{1,15})/)
  return match?.[1] ?? ''
}

function formatTwitterTitle(
  candidateTitle: string | undefined | null,
  username: string,
): string {
  const fallback = (username || extractTwitterFromTitle(candidateTitle))
    .replace(/^@/, '')
    .trim()
  let cleaned = (candidateTitle || '').trim()
  if (!cleaned || /^https?:\/\/\S+$/i.test(cleaned))
    return `${fallback || 'X'} - X`
  cleaned = cleaned
    .replace(/\s*(?:\/|\||／)\s*@?[a-zA-Z0-9_]{1,15}\s*$/i, '')
    .replace(/\s*\(\s*@?[a-zA-Z0-9_]{1,15}\s*\)\s*$/i, '')
    .trim()
  return cleaned || `${fallback || 'X'} - X`
}

function formatInstagramTitle(
  candidateTitle: string | undefined | null,
  usernameOrUrl: string,
): string {
  const fallback = (
    extractInstagramUsername(usernameOrUrl) ||
    usernameOrUrl ||
    ''
  )
    .trim()
    .replace(/^@/, '')
  let cleaned = (candidateTitle || '').trim()
  if (!cleaned || /^https?:\/\/\S+$/i.test(cleaned)) return `${fallback} - Ins`
  const fromAt = cleaned.match(/@([a-zA-Z0-9._]{1,30})/)
  if (fromAt?.[1]) return `${fromAt[1]} - Ins`
  const fromParenAt = cleaned.match(/\(\s*@([a-zA-Z0-9._]{1,30})\s*\)/)
  if (fromParenAt?.[1]) return `${fromParenAt[1]} - Ins`
  const fromPicnob = cleaned.match(
    /^([a-zA-Z0-9._]{1,30})\s*-\s*picnob(?:[^\s]+)?/i,
  )
  if (fromPicnob?.[1]) return `${fromPicnob[1]} - Ins`
  return cleaned || `${fallback} - Ins`
}

/**
 * Resolve a human-readable display title for a social media feed
 * by extracting Twitter/Instagram usernames from the feed URL/siteUrl.
 */
export function resolveSocialFeedDisplayTitle(
  rawTitle: string | undefined | null,
  feedUrl: string | undefined | null,
  siteUrl: string | undefined | null,
): string {
  const title = (rawTitle || '').trim()
  const twUser =
    extractTwitterUsername(feedUrl) ||
    extractTwitterUsername(siteUrl) ||
    extractTwitterFromTitle(title)
  if (twUser) return formatTwitterTitle(title, twUser)

  const igUser =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (igUser) return formatInstagramTitle(title, igUser)

  return title
}

/**
 * Resolve a display image URL for a social media feed.
 */
export function resolveSocialFeedDisplayImageUrl(
  feedImageUrl: string | undefined | null,
  feedUrl: string | undefined | null,
  siteUrl: string | undefined | null,
  _displayTitle: string,
): string {
  const existing = (feedImageUrl || '').trim()
  if (existing) return existing

  const twUser =
    extractTwitterUsername(feedUrl) || extractTwitterUsername(siteUrl)
  if (twUser) return `https://unavatar.io/twitter/${encodeURIComponent(twUser)}`

  const igUser =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (igUser)
    return `https://unavatar.io/instagram/${encodeURIComponent(igUser)}`

  return ''
}

// ── Image URL resolution ────────────────────────────────────────────────────

/**
 * Resolve the best display image for an entry card.
 * Checks media items first, then falls back to entry imageUrl,
 * then tries to extract from content HTML.
 */
export function resolveEntryCardImageUrl(
  entry: Entry,
  _feedSiteUrl: string,
): string {
  // 1. Media items — prefer first photo
  if (entry.media?.length) {
    const firstPhoto = entry.media.find((m) => m.type === 'photo')
    if (firstPhoto?.previewUrl) return firstPhoto.previewUrl
    if (firstPhoto?.url) return firstPhoto.url
  }

  // 2. Entry imageUrl (not a video URL)
  if (entry.imageUrl && !isVideoUrl(entry.imageUrl)) return entry.imageUrl

  // 3. Extract first <img> src from content
  if (entry.content) {
    const match = entry.content.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (match?.[1] && !isVideoUrl(match[1])) return match[1]
  }

  return ''
}

// ── Video detection ─────────────────────────────────────────────────────────

const DIRECT_VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|$)/i
const EMBEDDABLE_VIDEO_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/|b23\.tv\/|vimeo\.com\/\d+|ted\.com\/talks\/)/i

function isDirectVideoUrl(url: string): boolean {
  return DIRECT_VIDEO_RE.test(url || '')
}

function isEmbeddableVideoUrl(url: string): boolean {
  return EMBEDDABLE_VIDEO_RE.test(url || '')
}

function isVideoUrl(url: string): boolean {
  return isDirectVideoUrl(url) || isEmbeddableVideoUrl(url)
}

function detectHasVideo(entry: Entry): boolean {
  // Check media items
  if (entry.media?.some((m) => m.type === 'video')) return true

  // Check entry URL
  if (entry.url && isVideoUrl(entry.url)) return true

  // Scan combined text for embeddable video URLs
  const mediaUrls = entry.media?.map((m) => m.url) ?? []
  const joined = [
    entry.summary,
    entry.content,
    entry.title,
    entry.url,
    ...mediaUrls,
  ].join('\n')
  return EMBEDDABLE_VIDEO_RE.test(joined) || DIRECT_VIDEO_RE.test(joined)
}

// ── Media URL helpers ───────────────────────────────────────────────────────

function selectPictureMediaUrls(
  media: MediaItem[] | undefined | null,
): string[] {
  if (!media?.length) return []
  return media
    .filter((m) => m.type === 'photo')
    .map((m) => m.previewUrl || m.url)
}

function getRawMediaUrls(entry: Entry): string[] {
  return entry.media?.map((m) => m.url) ?? []
}

// ── Conversion functions ────────────────────────────────────────────────────

/**
 * Convert a `FeedWithCount` domain object into a `FeedCardModel` view model
 * suitable for rendering in sidebars or feed lists.
 */
export function toFeedCardModel(feed: FeedWithCount): FeedCardModel {
  const displayTitle = resolveSocialFeedDisplayTitle(
    feed.title,
    feed.url,
    feed.siteUrl,
  )
  const definition = viewDefinitionOf(feed.view)
  return {
    id: feed.id,
    title: displayTitle,
    description: feed.description ?? null,
    category: feed.category ?? '未分类',
    url: feed.url,
    siteUrl: feedSiteUrl(feed),
    imageUrl: feed.imageUrl ?? null,
    unreadCount: feed.unreadCount,
    unreadLabel: `${feed.unreadCount}`,
    viewType: feed.view,
    viewLabel: definition.name,
    viewBadgeColor: definition.color,
    lastFetched: null,
    isRefreshing: false,
    isRecommended: false,
  }
}

/**
 * Convert an `Entry` + its parent `Feed` into an `EntryCardModel` view model
 * suitable for rendering in entry lists, grids, and timeline views.
 */
export function toEntryCardModel(entry: Entry, feed: Feed): EntryCardModel {
  const siteUrl = feedSiteUrl(feed)
  const displayTitle = resolveSocialFeedDisplayTitle(
    feed.title,
    feed.url,
    feed.siteUrl,
  )
  const definition = viewDefinitionOf(feed.view)

  const imageUrl = resolveEntryCardImageUrl(entry, siteUrl)
  const feedImageUrl =
    feed.imageUrl ||
    resolveSocialFeedDisplayImageUrl(
      feed.imageUrl,
      feed.url,
      feed.siteUrl,
      displayTitle,
    )
  const hasVideoMedia = detectHasVideo(entry)

  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary ?? '',
    content: entry.content ?? '',
    imageUrl,
    feedImageUrl,
    author: entry.author ?? '',
    articleUrl: entry.url,
    publishedAt: entry.publishedAt,
    publishedLabel: '',
    readingLabel: `${estimateReadingTime(entry.content)} min`,
    tags: [],
    mediaUrls: selectPictureMediaUrls(entry.media),
    rawMediaUrls: getRawMediaUrls(entry),
    feedTitle: displayTitle,
    feedCategory: feed.category ?? '未分类',
    viewType: feed.view,
    viewLabel: definition.name,
    viewBadgeColor: definition.color,
    hasVideoMedia,
    isRead: entry.isRead,
    isStarred: entry.isStarred,
  }
}

/**
 * Convert an `Entry` + its parent `Feed` into an `ArticleDetailModel` view model
 * suitable for rendering a full article detail page.
 */
export function toArticleDetailModel(
  entry: Entry,
  feed: Feed,
): ArticleDetailModel {
  const siteUrl = feedSiteUrl(feed)
  const card = toEntryCardModel(entry, feed)
  const readingTime = estimateReadingTime(entry.content)

  return {
    id: card.id,
    feedId: card.feedId,
    title: card.title,
    content: card.content,
    summary: card.summary,
    author: entry.author ?? null,
    authorAvatar: entry.authorAvatar ?? null,
    imageUrl: card.imageUrl || null,
    media: entry.media ?? [],
    publishedAt: card.publishedAt,
    publishedLabel: '',
    sourceName: card.feedTitle,
    sourceUrl: siteUrl,
    sourceIcon: card.feedImageUrl || null,
    articleUrl: card.articleUrl,
    isRead: card.isRead,
    isStarred: card.isStarred,
    aiSummary: entry.aiSummary ?? null,
    aiTranslation: null,
    isSummaryLoading: false,
    isTranslationLoading: false,
    aiError: null,
    tags: card.tags,
    readingTimeMinutes: readingTime,
    readingLabel: `${readingTime} min`,
    viewType: card.viewType,
  }
}
