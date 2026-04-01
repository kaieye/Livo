import {
  extractInstagramUsername,
  extractXUsername,
  normalizeSocialFeedDescription,
  normalizeSocialFeedTitle,
} from './SocialFeedTitles.ts'

function trimValue(value: string | undefined): string {
  return (value || '').trim()
}

function hostOf(value: string): string {
  const matched = value.match(/^https?:\/\/([^/]+)/i)
  return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
}

function isGenericInstagramIcon(value: string): boolean {
  const normalized = trimValue(value).toLowerCase()
  if (!normalized) {
    return false
  }

  return (
    normalized.includes('instagram.com/static/images/ico') ||
    normalized.includes('instagram_static/images/ico') ||
    normalized.includes('instagram_logo') ||
    normalized.includes('instagram-logo') ||
    normalized.includes('/logo.') ||
    normalized.includes('iconfinder')
  )
}

function isGenericXIcon(value: string): boolean {
  const normalized = trimValue(value).toLowerCase()
  if (!normalized) {
    return false
  }

  return (
    normalized.endsWith('/twitter.3.ico') ||
    normalized.includes('abs.twimg.com/favicons')
  )
}

export function resolveSocialFeedDisplayTitle(
  title: string,
  feedUrl: string,
  siteUrl: string,
): string {
  return normalizeSocialFeedTitle(title, feedUrl, siteUrl)
}

export function resolveSocialFeedDisplayDescription(
  description: string,
  feedUrl: string,
  siteUrl: string,
): string {
  return normalizeSocialFeedDescription(description, feedUrl, siteUrl)
}

export function resolveSocialFeedDisplayImageUrl(
  imageUrl: string,
  feedUrl: string,
  siteUrl: string,
  title: string,
): string {
  const normalizedImage = trimValue(imageUrl)
  const instagramUsername =
    extractInstagramUsername(feedUrl) ||
    extractInstagramUsername(siteUrl) ||
    extractInstagramUsername(title)
  const xUsername =
    extractXUsername(feedUrl) ||
    extractXUsername(siteUrl) ||
    extractXUsername(title)

  if (normalizedImage) {
    if (instagramUsername && isGenericInstagramIcon(normalizedImage)) {
      return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`
    }
    if (xUsername && isGenericXIcon(normalizedImage)) {
      return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
    }
    return normalizedImage
  }

  if (instagramUsername) {
    return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`
  }

  if (xUsername) {
    return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
  }

  const host = hostOf(siteUrl || feedUrl)
  return host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : ''
}
