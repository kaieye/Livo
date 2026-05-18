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

function hasSocialFeedHint(value: string): boolean {
  const normalized = trimValue(value).toLowerCase()
  if (!normalized) {
    return false
  }

  return (
    normalized.includes('/instagram/') ||
    normalized.includes('/picnob/') ||
    normalized.includes('/pixnoy/') ||
    normalized.includes('/piokok/') ||
    normalized.includes('instagram.com/') ||
    normalized.includes('/x/') ||
    normalized.includes('/twitter/') ||
    normalized.includes('x.com/') ||
    normalized.includes('twitter.com/') ||
    normalized.includes('nitter.')
  )
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

function extractBilibiliUid(value: string): string {
  const matched = trimValue(value).match(
    /\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i,
  )
  return matched?.[1]?.trim() || ''
}

function extractYouTubeIdentity(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  return (
    trimmed.match(/[?&]channel_id=([^&]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/channel\/([^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/youtube\/user\/(@[^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/@([^/?#]+)/i)?.[1]?.trim() ||
    // /user/ and /c/ only match when the host is clearly YouTube
    trimmed.match(/youtube\.com\/(?:user|c)\/([^/?#]+)/i)?.[1]?.trim() ||
    ''
  )
}

function normalizeYouTubeIdentity(value: string): string {
  const raw = trimValue(value).replace(/^@+/, '')
  return raw ? decodeURIComponent(raw).trim().toLowerCase() : ''
}

function youTubeAvatarUrl(identity: string): string {
  const normalized = normalizeYouTubeIdentity(identity)
  return normalized
    ? `https://unavatar.io/youtube/${encodeURIComponent(normalized)}?fallback=false`
    : ''
}

function bilibiliAvatarUrl(uid: string): string {
  const normalized = trimValue(uid)
  return normalized
    ? `https://unavatar.io/bilibili/${encodeURIComponent(normalized)}?fallback=false`
    : ''
}

function isGenericFeedIcon(value: string): boolean {
  const normalized = trimValue(value).toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    normalized.includes('google.com/s2/favicons') ||
    normalized.includes('/favicon.ico') ||
    normalized.includes('/favicon.') ||
    normalized.includes('/apple-touch-icon') ||
    isGenericInstagramIcon(normalized) ||
    isGenericXIcon(normalized)
  )
}

function faviconUrlForHost(host: string): string {
  const trimmed = host.trim()
  return trimmed
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(trimmed)}&sz=128`
    : ''
}

function scoreStoredFeedTitle(
  value: string,
  feedUrl: string,
  siteUrl: string,
): number {
  const normalized = normalizeSocialFeedTitle(value, feedUrl, siteUrl).trim()
  if (!normalized) {
    return 0
  }

  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (instagramUsername) {
    const lowered = normalized.toLowerCase()
    if (lowered === instagramUsername || lowered === `@${instagramUsername}`) {
      return 1
    }
    return 4
  }

  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  if (xUsername) {
    const lowered = normalized.toLowerCase()
    if (
      lowered === xUsername ||
      lowered === `@${xUsername}` ||
      lowered === `${xUsername} @ ${xUsername}`
    ) {
      return 1
    }
    return 4
  }

  const bilibiliUid = extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
  if (bilibiliUid) {
    return new RegExp(`^bilibili\\s+${bilibiliUid}$`, 'i').test(normalized)
      ? 1
      : 4
  }

  if (extractYouTubeIdentity(feedUrl) || extractYouTubeIdentity(siteUrl)) {
    if (/^youtube\s+(?:@|频道|channel|uc[a-z0-9_-]+)/i.test(normalized)) {
      return 1
    }
    return 4
  }

  return normalized.length >= 2 ? 3 : 1
}

function scoreStoredFeedImage(value: string): number {
  const normalized = trimValue(value)
  if (!normalized) {
    return 0
  }

  if (isGenericFeedIcon(normalized)) {
    return 1
  }

  if (normalized.toLowerCase().includes('unavatar.io/')) {
    return 2
  }

  return 3
}

export function resolveSocialFeedDisplayTitle(
  title: string,
  feedUrl: string,
  siteUrl: string,
): string {
  const normalizedTitle = normalizeSocialFeedTitle(title, feedUrl, siteUrl)
  if (normalizedTitle) {
    return normalizedTitle
  }

  const fallbackHost = hostOf(siteUrl || feedUrl)
  if (fallbackHost) {
    return fallbackHost
  }

  const fallbackSite = trimValue(siteUrl)
  if (fallbackSite) {
    return fallbackSite
  }

  return trimValue(feedUrl)
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
  const instagramUsernameFromUrl =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  const xUsernameFromUrl =
    extractXUsername(feedUrl) || extractXUsername(siteUrl)
  const bilibiliUidFromUrl =
    extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
  const youTubeIdentityFromUrl =
    extractYouTubeIdentity(feedUrl) || extractYouTubeIdentity(siteUrl)
  const canInferUsernameFromTitle =
    !!instagramUsernameFromUrl ||
    !!xUsernameFromUrl ||
    hasSocialFeedHint(feedUrl) ||
    hasSocialFeedHint(siteUrl)
  const instagramUsername =
    instagramUsernameFromUrl ||
    (canInferUsernameFromTitle ? extractInstagramUsername(title) : '')
  const xUsername =
    xUsernameFromUrl ||
    (canInferUsernameFromTitle ? extractXUsername(title) : '')
  const bilibiliUid = bilibiliUidFromUrl
  const youTubeIdentity = youTubeIdentityFromUrl

  if (normalizedImage) {
    if (xUsernameFromUrl && isGenericFeedIcon(normalizedImage)) {
      return `https://unavatar.io/x/${encodeURIComponent(xUsernameFromUrl)}`
    }
    if (instagramUsernameFromUrl && isGenericFeedIcon(normalizedImage)) {
      return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsernameFromUrl)}?fallback=false`
    }
    if (instagramUsername && isGenericFeedIcon(normalizedImage)) {
      return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`
    }
    if (xUsername && isGenericFeedIcon(normalizedImage)) {
      return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
    }
    if (youTubeIdentity && isGenericFeedIcon(normalizedImage)) {
      return youTubeAvatarUrl(youTubeIdentity)
    }
    if (bilibiliUid && isGenericFeedIcon(normalizedImage)) {
      return bilibiliAvatarUrl(bilibiliUid)
    }
    if (instagramUsername && isGenericInstagramIcon(normalizedImage)) {
      return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`
    }
    if (xUsername && isGenericXIcon(normalizedImage)) {
      return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
    }
    if (isGenericFeedIcon(normalizedImage)) {
      const host = hostOf(siteUrl || feedUrl)
      return faviconUrlForHost(host)
    }
    return normalizedImage
  }

  if (xUsernameFromUrl) {
    return `https://unavatar.io/x/${encodeURIComponent(xUsernameFromUrl)}`
  }

  if (instagramUsernameFromUrl) {
    return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsernameFromUrl)}?fallback=false`
  }

  if (youTubeIdentityFromUrl) {
    return youTubeAvatarUrl(youTubeIdentityFromUrl)
  }

  if (bilibiliUidFromUrl) {
    return bilibiliAvatarUrl(bilibiliUidFromUrl)
  }

  if (xUsername) {
    return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
  }

  if (instagramUsername) {
    return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`
  }

  const host = hostOf(siteUrl || feedUrl)
  return faviconUrlForHost(host)
}

export function resolvePreferredStoredFeedTitle(
  existingTitle: string,
  incomingTitle: string,
  feedUrl: string,
  siteUrl: string,
): string {
  const normalizedExisting = normalizeSocialFeedTitle(
    existingTitle,
    feedUrl,
    siteUrl,
  )
  const normalizedIncoming = normalizeSocialFeedTitle(
    incomingTitle,
    feedUrl,
    siteUrl,
  )
  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  const bilibiliUid = extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
  const youTubeIdentity =
    extractYouTubeIdentity(feedUrl) || extractYouTubeIdentity(siteUrl)

  if (
    normalizedExisting &&
    normalizedIncoming &&
    normalizedExisting !== normalizedIncoming
  ) {
    const loweredIncoming = normalizedIncoming.toLowerCase()
    if (
      (instagramUsername &&
        (loweredIncoming === instagramUsername ||
          loweredIncoming === `@${instagramUsername}`)) ||
      (xUsername &&
        (loweredIncoming === xUsername ||
          loweredIncoming === `@${xUsername}` ||
          loweredIncoming === `${xUsername} @ ${xUsername}`)) ||
      (bilibiliUid &&
        new RegExp(`^bilibili\\s+${bilibiliUid}$`, 'i').test(
          normalizedIncoming,
        )) ||
      (youTubeIdentity &&
        /^youtube\s+(?:@|频道|channel|uc[a-z0-9_-]+)/i.test(normalizedIncoming))
    ) {
      return normalizedExisting
    }
  }

  const existingScore = scoreStoredFeedTitle(
    normalizedExisting,
    feedUrl,
    siteUrl,
  )
  const incomingScore = scoreStoredFeedTitle(
    normalizedIncoming,
    feedUrl,
    siteUrl,
  )

  if (incomingScore >= existingScore && normalizedIncoming) {
    return normalizedIncoming
  }

  return normalizedExisting || normalizedIncoming
}

export function resolvePreferredStoredFeedImageUrl(
  existingImageUrl: string,
  incomingImageUrl: string,
): string {
  const normalizedExisting = trimValue(existingImageUrl)
  const normalizedIncoming = trimValue(incomingImageUrl)
  const existingScore = scoreStoredFeedImage(normalizedExisting)
  const incomingScore = scoreStoredFeedImage(normalizedIncoming)

  if (incomingScore >= existingScore && normalizedIncoming) {
    return normalizedIncoming
  }

  return normalizedExisting || normalizedIncoming
}
