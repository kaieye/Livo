import {
  resolvePreferredStoredFeedImageUrl,
  resolveSocialFeedDisplayDescription,
  resolveSocialFeedDisplayImageUrl,
  resolveSocialFeedDisplayTitle,
} from '../social/SocialFeedPresentation.ts'

export interface FeedDetailEntryLike {
  publishedAt: number
}

export interface FeedDetailFeedLike {
  url: string
  siteUrl?: string
}

export interface FeedDetailPreviewPayloadLike<
  T extends FeedDetailEntryLike = FeedDetailEntryLike,
> {
  etag: string
  lastModified: string
  feedTitle: string
  siteUrl: string
  imageUrl: string
  description: string
  resolvedFeedUrl?: string
  entries: T[]
}

export interface FeedDetailDisplayFeedState {
  title: string
  imageUrl: string
  description: string
}

export function resolveFeedDetailDisplayState(
  title: string,
  imageUrl: string,
  description: string,
  feedUrl: string,
  siteUrl: string,
): FeedDetailDisplayFeedState {
  const displayTitle = resolveSocialFeedDisplayTitle(title, feedUrl, siteUrl)
  return {
    title: displayTitle,
    imageUrl: resolveSocialFeedDisplayImageUrl(
      imageUrl,
      feedUrl,
      siteUrl,
      displayTitle,
    ),
    description: resolveSocialFeedDisplayDescription(
      description,
      feedUrl,
      siteUrl,
    ),
  }
}

export function normalizeFeedDetailPreviewPayload<
  T extends FeedDetailEntryLike,
>(
  payload: FeedDetailPreviewPayloadLike<T>,
  fallbackUrl: string,
): FeedDetailPreviewPayloadLike<T> {
  const displayFeed = resolveFeedDetailDisplayState(
    payload.feedTitle,
    payload.imageUrl || '',
    payload.description || '',
    payload.resolvedFeedUrl || fallbackUrl,
    payload.siteUrl || '',
  )

  return {
    etag: payload.etag,
    lastModified: payload.lastModified,
    feedTitle: displayFeed.title,
    siteUrl: payload.siteUrl || '',
    imageUrl: displayFeed.imageUrl,
    description: displayFeed.description,
    resolvedFeedUrl: payload.resolvedFeedUrl,
    entries: payload.entries,
  }
}

export function resolveFeedDetailPreferredDisplayImageUrl(
  primaryImageUrl: string,
  fallbackImageUrl: string,
): string {
  const incoming = (primaryImageUrl || '').trim()
  const existing = (fallbackImageUrl || '').trim()
  return resolvePreferredStoredFeedImageUrl(existing, incoming)
}

export function latestFeedDetailEntryPublishedAt(
  entries: FeedDetailEntryLike[],
): number {
  let latest = 0
  entries.forEach((entry: FeedDetailEntryLike) => {
    latest = Math.max(latest, entry.publishedAt || 0)
  })
  return latest
}

export function oldestFeedDetailEntryPublishedAt(
  entries: FeedDetailEntryLike[],
): number {
  let oldest = 0
  entries.forEach((entry: FeedDetailEntryLike) => {
    const publishedAt = entry.publishedAt || 0
    if (publishedAt <= 0) {
      return
    }
    if (oldest <= 0 || publishedAt < oldest) {
      oldest = publishedAt
    }
  })
  return oldest
}

export function resolvePreferredFeedDetailPreviewEntries<
  T extends FeedDetailEntryLike,
>(localEntries: T[], cachedEntries: T[]): T[] {
  if (localEntries.length === 0) {
    return cachedEntries
  }
  if (cachedEntries.length === 0) {
    return localEntries
  }

  const localLatest = latestFeedDetailEntryPublishedAt(localEntries)
  const cachedLatest = latestFeedDetailEntryPublishedAt(cachedEntries)
  return cachedLatest > localLatest ? cachedEntries : localEntries
}

export function shouldReseedFeedDetailFromCachedPreview<
  T extends FeedDetailEntryLike,
>(
  localEntries: T[],
  cachedPayload: FeedDetailPreviewPayloadLike<T> | undefined,
): boolean {
  if (!cachedPayload || (cachedPayload.entries?.length ?? 0) === 0) {
    return false
  }

  const cachedEntries = cachedPayload.entries
  if (localEntries.length === 0) {
    return true
  }

  const localLatest = latestFeedDetailEntryPublishedAt(localEntries)
  const cachedLatest = latestFeedDetailEntryPublishedAt(cachedEntries)
  if (cachedLatest > localLatest) {
    return true
  }

  const localOldest = oldestFeedDetailEntryPublishedAt(localEntries)
  const cachedOldest = oldestFeedDetailEntryPublishedAt(cachedEntries)
  const cachedHasEarlierHistory =
    cachedOldest > 0 && (localOldest <= 0 || cachedOldest < localOldest)
  const cachedHasMoreEntries = cachedEntries.length > localEntries.length
  const cachedIsNotStalerThanLocal = cachedLatest >= localLatest
  return (
    cachedHasEarlierHistory &&
    cachedHasMoreEntries &&
    cachedIsNotStalerThanLocal
  )
}

export function normalizeFeedDetailUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase()
}

export function feedDetailMatchesTarget(
  feed: FeedDetailFeedLike,
  targetUrl: string,
  siteUrl: string,
): boolean {
  const normalizedTarget = normalizeFeedDetailUrl(targetUrl)
  const normalizedSite = normalizeFeedDetailUrl(siteUrl)
  return (
    normalizeFeedDetailUrl(feed.url) === normalizedTarget ||
    (!!feed.siteUrl &&
      normalizeFeedDetailUrl(feed.siteUrl) === normalizedTarget) ||
    (!!siteUrl && normalizeFeedDetailUrl(feed.url) === normalizedSite) ||
    (!!feed.siteUrl &&
      !!siteUrl &&
      normalizeFeedDetailUrl(feed.siteUrl) === normalizedSite)
  )
}

export function feedDetailHostOf(value: string): string {
  const matched = value.match(/^https?:\/\/([^/]+)/i)
  return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
}
