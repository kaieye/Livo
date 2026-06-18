import { deriveImageUrl, extractMedia } from './feed-utils'
import { isInstagramKeywordFeedUrl } from './feed-route-policy'

function isPlaceholderAvatar(url: string | undefined): boolean {
  const raw = (url || '').trim()
  if (!raw) return true
  const lower = raw.toLowerCase()
  if (lower.includes('unavatar.io/instagram/')) return true
  if (
    lower.includes('instagram.com/static/images/ico') ||
    lower.includes('instagram_static/images/ico') ||
    lower.includes('instagram_logo') ||
    lower.includes('instagram-logo') ||
    lower.includes('/apple-touch-icon') ||
    lower.includes('favicon')
  )
    return true
  if (
    (lower.includes('picnob') ||
      lower.includes('pixnoy') ||
      lower.includes('piokok')) &&
    lower.includes('logo')
  )
    return true
  return false
}

export function pickBestFeedAvatar(
  feedUrl: string | undefined,
  existing: string | undefined,
  incoming: string | undefined,
): string {
  const current = (existing || '').trim()
  const next = (incoming || '').trim()
  if (!current) return next
  if (!next) return current
  if (current === next) return current
  // Instagram/Picnob avatar URLs are often signed/expiring.
  // Prefer the latest fetched value so old expired URLs get replaced.
  if (isInstagramKeywordFeedUrl(feedUrl)) return next
  if (!isPlaceholderAvatar(next)) return next
  if (isPlaceholderAvatar(current) && !isPlaceholderAvatar(next)) return next
  return current
}

function normalizeAvatarComparisonKey(value: string | undefined): string {
  return (value || '').trim()
}

function collectParsedItemImageKeys(
  items: Array<Record<string, any>>,
): Set<string> {
  const keys = new Set<string>()
  const push = (value: string | undefined): void => {
    const key = normalizeAvatarComparisonKey(value)
    if (key) keys.add(key)
  }

  for (const item of items) {
    push(deriveImageUrl(item))
    for (const media of extractMedia(item) || []) {
      if (media.type !== 'photo') continue
      push(media.url)
      push(media.previewUrl)
    }
  }

  return keys
}

export function sanitizeExistingFeedAvatarForRefresh(
  existingImageUrl: string | undefined,
  parsedFeedImageUrl: string | undefined,
  items: Array<Record<string, any>>,
): string | undefined {
  if (parsedFeedImageUrl) return existingImageUrl
  const existingKey = normalizeAvatarComparisonKey(existingImageUrl)
  if (!existingKey) return existingImageUrl

  // 历史版本会把最新文章图写进 feed.imageUrl；刷新时不能继续保留。
  return collectParsedItemImageKeys(items).has(existingKey)
    ? undefined
    : existingImageUrl
}
