import type { Entry, MediaItem } from '../../../shared/types'
import { isAllowedStoredMediaUrl } from '../../../shared/media-url-policy'

const SOCIAL_QUOTE_CARD_CLASS = 'social-quote-card'

export function isBrokenScraperEntry(entry: Entry): boolean {
  return /instagram\.com\/(?:p|reel)\/\d{13,}\/?$/i.test(entry.url || '')
}

function hasSocialQuoteCard(content: string | undefined): boolean {
  return String(content || '').includes(SOCIAL_QUOTE_CARD_CLASS)
}

function isNitterRetweetDisplayTitle(title: string | undefined): boolean {
  return /^RT\s+@[a-zA-Z0-9_]{1,15}\s*$/.test(String(title || '').trim())
}

function isLegacyNitterRetweetTitle(title: string | undefined): boolean {
  return /^RT by @[a-zA-Z0-9_]{1,15}:\s*/i.test(String(title || '').trim())
}

function shouldUpgradeNitterRetweetPresentation(
  existing: Entry,
  incoming: Entry,
): boolean {
  if (!isNitterRetweetDisplayTitle(incoming.title)) return false
  if (!hasSocialQuoteCard(incoming.content)) return false
  if (isLegacyNitterRetweetTitle(existing.title)) return true
  return !!incoming.url && incoming.url === existing.url
}

function sanitizeIncomingMedia(items: MediaItem[] | undefined): MediaItem[] {
  const safeItems: MediaItem[] = []
  for (const item of items || []) {
    const url = (item.url || '').trim()
    if (!isAllowedStoredMediaUrl(url)) continue

    const previewUrl = (item.previewUrl || '').trim()
    const safeItem: MediaItem = {
      ...item,
      url,
    }
    if (previewUrl && isAllowedStoredMediaUrl(previewUrl)) {
      safeItem.previewUrl = previewUrl
    } else {
      delete safeItem.previewUrl
    }
    safeItems.push(safeItem)
  }
  return safeItems
}

export function mergeTextFromEntry(target: Entry, source: Entry): boolean {
  let changed = false
  const srcTitle = (source.title || '').normalize('NFKC')
  const tgtTitle = (target.title || '').normalize('NFKC')

  const isStatLikeTitle = (value: string): boolean => {
    const normalized = (value || '').normalize('NFKC').trim()
    if (!normalized) return true
    if (/[\p{Script=Han}A-Za-z]/u.test(normalized)) return false
    return /^(?:\d+(?:\.\d+)?(?:万|亿)?)+(?::\d{1,2}){1,2}$/u.test(normalized)
  }

  const shouldPreferSourceTitle =
    srcTitle.length > tgtTitle.length ||
    (isStatLikeTitle(tgtTitle) && !isStatLikeTitle(srcTitle))

  if (shouldPreferSourceTitle && srcTitle && srcTitle !== tgtTitle) {
    target.title = source.title
    changed = true
  }
  if ((source.summary || '').length > (target.summary || '').length) {
    target.summary = source.summary
    changed = true
  }
  return changed
}

export function mergeEntryData(
  existing: Entry,
  incoming: Entry,
  options?: { onPublishedAtAdvanced?: () => void },
): boolean {
  let changed = false

  const preferredTitleBeforeMerge = existing.title
  if (mergeTextFromEntry(existing, incoming)) {
    changed = true
  }

  const shouldUpgradeNitterRetweet = shouldUpgradeNitterRetweetPresentation(
    existing,
    incoming,
  )

  if (shouldUpgradeNitterRetweet && existing.title !== incoming.title) {
    existing.title = incoming.title
    changed = true
  }

  if ((incoming.publishedAt || 0) > (existing.publishedAt || 0)) {
    existing.publishedAt = incoming.publishedAt
    changed = true
    options?.onPublishedAtAdvanced?.()
  } else if (
    existing.title !== preferredTitleBeforeMerge &&
    incoming.publishedAt &&
    incoming.publishedAt !== existing.publishedAt
  ) {
    existing.publishedAt = incoming.publishedAt
    changed = true
    options?.onPublishedAtAdvanced?.()
  }

  const incomingMedia = sanitizeIncomingMedia(incoming.media)
  if (incomingMedia.length > 0) {
    const existingMediaSignature = JSON.stringify(
      (existing.media || []).map((m) => `${m.type || ''}|${m.url || ''}`),
    )
    const incomingMediaSignature = JSON.stringify(
      incomingMedia.map((m) => `${m.type || ''}|${m.url || ''}`),
    )
    if (existingMediaSignature !== incomingMediaSignature) {
      existing.media = incomingMedia
      changed = true
    }
  }

  if (shouldUpgradeNitterRetweet && incoming.content !== existing.content) {
    existing.content = incoming.content
    changed = true
  } else if (
    (incoming.content || '').length > (existing.content || '').length
  ) {
    existing.content = incoming.content
    changed = true
  }
  if ((incoming.summary || '').length > (existing.summary || '').length) {
    existing.summary = incoming.summary
    changed = true
  }
  if (
    incoming.readabilityContent &&
    (!existing.readabilityContent ||
      (incoming.readabilityFetchedAt || 0) >
        (existing.readabilityFetchedAt || 0))
  ) {
    existing.readabilityContent = incoming.readabilityContent
    existing.readabilityTitle = incoming.readabilityTitle
    existing.readabilityExcerpt = incoming.readabilityExcerpt
    existing.readabilitySiteName = incoming.readabilitySiteName
    existing.readabilityLength = incoming.readabilityLength
    existing.readabilityFetchedAt = incoming.readabilityFetchedAt
    existing.readabilityError = incoming.readabilityError
    changed = true
  }
  if (
    incoming.aiSummary &&
    (!existing.aiSummary ||
      (incoming.aiSummaryGeneratedAt || 0) >
        (existing.aiSummaryGeneratedAt || 0))
  ) {
    existing.aiSummary = incoming.aiSummary
    existing.aiSummaryGeneratedAt = incoming.aiSummaryGeneratedAt
    existing.aiSummaryError = incoming.aiSummaryError
    changed = true
  }
  if (
    incoming.notifiedAt &&
    (!existing.notifiedAt || incoming.notifiedAt > existing.notifiedAt)
  ) {
    existing.notifiedAt = incoming.notifiedAt
    changed = true
  }
  if (incoming.authorAvatar && !existing.authorAvatar) {
    existing.authorAvatar = incoming.authorAvatar
    changed = true
  }
  if (
    shouldUpgradeNitterRetweet &&
    incoming.authorAvatar &&
    incoming.authorAvatar !== existing.authorAvatar
  ) {
    existing.authorAvatar = incoming.authorAvatar
    changed = true
  }
  if (
    (incoming.author || '').trim() &&
    (!(existing.author || '').trim() ||
      (existing.author || '').includes('投稿视频') ||
      (existing.author || '').includes('视频分享')) &&
    incoming.author !== existing.author
  ) {
    existing.author = incoming.author
    changed = true
  }
  if (
    shouldUpgradeNitterRetweet &&
    (incoming.author || '').trim() &&
    incoming.author !== existing.author
  ) {
    existing.author = incoming.author
    changed = true
  }
  const incomingImageUrl = (incoming.imageUrl || '').trim()
  if (
    incomingImageUrl &&
    isAllowedStoredMediaUrl(incomingImageUrl) &&
    incomingImageUrl !== existing.imageUrl
  ) {
    existing.imageUrl = incomingImageUrl
    changed = true
  }
  if (incoming.url && !existing.url) {
    existing.url = incoming.url
    changed = true
  }

  return changed
}
