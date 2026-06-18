import { FeedViewType } from '../../../shared/types'
import type {
  DiscoverFeedPreviewEntry,
  DiscoverFeedPreviewResult,
  Entry,
} from '../../../shared/types'
import {
  extractBilibiliUid,
  extractTwitterDisplayNameFromText,
  extractTwitterUsernameFromUrl,
  decodeBasicHtmlEntities,
  isGenericTwitterTitle,
} from '../../../shared/discover-helpers'
import { extractLikelyXHandle, fetchXDisplayNameByUsername } from './discover-x'
import { fetchBilibiliNameByUid } from './discover-bilibili'
import { formatFeedTitle } from '../feed/feed-title'
import {
  ensureInstagramUserFeedLimit,
  ensureTwitterUserFeedLimit,
  normalizeRsshubProtocolUrl,
  toRsshubProtocolUrl,
} from '../feed/rsshub-url'
import { detectRouteViewFromUrl } from '../feed/feed-view'
import { fetchAndParseFeed } from '../feed/rss-parser'
import { resolveFeedAvatar } from '../feed/feed-avatar'
import { getFeedImageUrl } from '../feed/feed-utils'
import { buildEntriesFromParsedItems } from '../entry/entry-builder'
import { toHandlerError } from '../../ipc/handler-error'

/**
 * Best-effort image (favicon / unavatar) for a discover search or preview
 * result. Used by DISCOVER_SEARCH and DISCOVER_PREVIEW_FEED.
 */
export async function inferDiscoverResultImage(
  feedUrl: string,
  siteUrl?: string,
): Promise<string | undefined> {
  const twitterUsername = extractTwitterUsernameFromUrl(feedUrl)
  if (twitterUsername) {
    const clean = extractLikelyXHandle(twitterUsername)
    if (clean) {
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

/**
 * Best-effort display title for a discover search or preview result.
 * Used by DISCOVER_SEARCH and DISCOVER_PREVIEW_FEED.
 */
export async function inferDiscoverResultTitle(
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

function buildPreviewFetchUrl(
  targetUrl: string,
  rsshubInstance: string,
): string {
  const rawProtocolUrl = toRsshubProtocolUrl(targetUrl.trim())
  const limitedProtocolUrl = ensureTwitterUserFeedLimit(
    ensureInstagramUserFeedLimit(rawProtocolUrl, 100),
    120,
  )
  return normalizeRsshubProtocolUrl(limitedProtocolUrl, rsshubInstance)
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

/**
 * Fetches and previews a feed for the Discover preview pane.
 * Extracted from DISCOVER_PREVIEW_FEED handler so the preview flow
 * (URL build → fetch → avatar → view detect → entry build → title infer
 * → shape map) is testable without an Electron IPC harness.
 */
export async function previewDiscoverFeed(
  url: string,
  rsshubInstance: string,
): Promise<DiscoverFeedPreviewResult> {
  const targetUrl = (url || '').trim()
  if (!targetUrl) {
    return { success: false, error: 'Feed URL is required' }
  }

  try {
    const resolvedFeedUrl = buildPreviewFetchUrl(targetUrl, rsshubInstance)
    console.log(`[Discover Preview] Loading preview for ${resolvedFeedUrl}`)
    const parsed = await fetchAndParseFeed(resolvedFeedUrl)
    const data = parsed.data
    if (!data) {
      return { success: false, error: 'Feed returned no data' }
    }

    const imageUrl = await resolveFeedAvatar(
      resolvedFeedUrl,
      getFeedImageUrl(data),
      undefined,
      data.link || resolvedFeedUrl,
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
    return toHandlerError(error)
  }
}
