import { IAvatarResolver } from './IAvatarResolver'
import { DiscoverAvatarCacheStore } from '../DiscoverAvatarCacheStore'
import {
  discoverAvatarCacheKeys,
  isDiscoverAvatarCacheableImageUrl,
} from '../../utils/discover/DiscoverAvatarPresentation'

function trimValue(value: string | undefined): string {
  return (value || '').trim()
}

function isPlaceholderAvatar(url?: string): boolean {
  const raw = trimValue(url).toLowerCase()
  if (!raw) {
    return true
  }

  return (
    raw.includes('unavatar.io/instagram/') ||
    raw.includes('unavatar.io/youtube/') ||
    raw.includes('unavatar.io/bilibili/') ||
    raw.includes('unavatar.io/x/') ||
    raw.includes('instagram.com/static/images/ico') ||
    raw.includes('instagram_static/images/ico') ||
    raw.includes('instagram_logo') ||
    raw.includes('instagram-logo') ||
    raw.includes('youtube.com/favicon') ||
    raw.includes('bilibili.com/favicon') ||
    raw.includes('/apple-touch-icon') ||
    raw.includes('favicon') ||
    ((raw.includes('picnob') ||
      raw.includes('pixnoy') ||
      raw.includes('piokok')) &&
      raw.includes('logo'))
  )
}

export class PreferenceCachedAvatarResolver implements IAvatarResolver {
  private readonly delegate: IAvatarResolver

  constructor(delegate: IAvatarResolver) {
    this.delegate = delegate
  }

  async resolveFeedAvatar(
    feedUrl: string,
    siteUrl: string,
    incomingImageUrl: string,
    existingImageUrl: string = '',
  ): Promise<string> {
    const preferredIncoming = trimValue(incomingImageUrl)
    if (preferredIncoming && !isPlaceholderAvatar(preferredIncoming)) {
      return preferredIncoming
    }

    // 1. Check if we have a valid cached avatar
    try {
      const keys = discoverAvatarCacheKeys(feedUrl, siteUrl)
      const entries = await DiscoverAvatarCacheStore.load()
      for (const entry of entries) {
        if (isDiscoverAvatarCacheableImageUrl(entry.imageUrl)) {
          const entryKeys = discoverAvatarCacheKeys(
            entry.targetUrl,
            entry.siteUrl,
          )
          for (const key of keys) {
            if (entryKeys.includes(key)) {
              return entry.imageUrl
            }
          }
        }
      }
    } catch (_error) {
      // If cache load fails, ignore and proceed to resolution
    }

    // 2. Delegate to the inner resolver
    const resolved = await this.delegate.resolveFeedAvatar(
      feedUrl,
      siteUrl,
      incomingImageUrl,
      existingImageUrl,
    )

    // 3. Cache the resolved result if it's a valid non-placeholder url
    const normalizedResolved = trimValue(resolved)
    if (
      normalizedResolved &&
      isDiscoverAvatarCacheableImageUrl(normalizedResolved)
    ) {
      try {
        await DiscoverAvatarCacheStore.remember(
          feedUrl,
          siteUrl,
          normalizedResolved,
        )
        if (siteUrl) {
          await DiscoverAvatarCacheStore.remember(
            feedUrl,
            '',
            normalizedResolved,
          )
        }
      } catch (_error) {
        // Caching errors shouldn't break the resolution flow
      }
    }

    return resolved
  }

  async fetchInstagramAvatar(username: string): Promise<string> {
    const cleanUsername = trimValue(username).replace(/^@+/, '').toLowerCase()
    if (!cleanUsername) {
      return ''
    }

    try {
      const entries = await DiscoverAvatarCacheStore.load()
      for (const entry of entries) {
        if (isDiscoverAvatarCacheableImageUrl(entry.imageUrl)) {
          const target = entry.targetUrl.toLowerCase()
          const site = entry.siteUrl.toLowerCase()
          const matchesInstagram = (target.includes('instagram.com') || site.includes('instagram.com'))
            && (target.includes(cleanUsername) || site.includes(cleanUsername))
          if (matchesInstagram) {
            return entry.imageUrl
          }
        }
      }
    } catch (_) {}

    const resolved = await this.delegate.fetchInstagramAvatar(username)

    const normalizedResolved = trimValue(resolved)
    if (normalizedResolved && isDiscoverAvatarCacheableImageUrl(normalizedResolved)) {
      try {
        const dummyUrl = `https://instagram.com/${cleanUsername}`
        await DiscoverAvatarCacheStore.remember(dummyUrl, dummyUrl, normalizedResolved)
      } catch (_) {}
    }

    return resolved
  }

  async fetchYouTubeAvatar(identity: string): Promise<string> {
    const cleanIdentity = trimValue(identity).replace(/^@+/, '').toLowerCase()
    if (!cleanIdentity) {
      return ''
    }

    try {
      const entries = await DiscoverAvatarCacheStore.load()
      for (const entry of entries) {
        if (isDiscoverAvatarCacheableImageUrl(entry.imageUrl)) {
          const target = entry.targetUrl.toLowerCase()
          const site = entry.siteUrl.toLowerCase()
          const matchesYouTube = (target.includes('youtube.com') || site.includes('youtube.com'))
            && (target.includes(cleanIdentity) || site.includes(cleanIdentity))
          if (matchesYouTube) {
            return entry.imageUrl
          }
        }
      }
    } catch (_) {}

    const resolved = await this.delegate.fetchYouTubeAvatar(identity)

    const normalizedResolved = trimValue(resolved)
    if (normalizedResolved && isDiscoverAvatarCacheableImageUrl(normalizedResolved)) {
      try {
        const dummyUrl = `https://youtube.com/@${cleanIdentity}`
        await DiscoverAvatarCacheStore.remember(dummyUrl, dummyUrl, normalizedResolved)
      } catch (_) {}
    }

    return resolved
  }

  async fetchBilibiliAvatar(uid: string): Promise<string> {
    const cleanUid = trimValue(uid).toLowerCase()
    if (!cleanUid) {
      return ''
    }

    try {
      const entries = await DiscoverAvatarCacheStore.load()
      for (const entry of entries) {
        if (isDiscoverAvatarCacheableImageUrl(entry.imageUrl)) {
          const target = entry.targetUrl.toLowerCase()
          const site = entry.siteUrl.toLowerCase()
          const matchesBilibili = (target.includes('bilibili.com') || site.includes('bilibili.com'))
            && (target.includes(cleanUid) || site.includes(cleanUid))
          if (matchesBilibili) {
            return entry.imageUrl
          }
        }
      }
    } catch (_) {}

    const resolved = await this.delegate.fetchBilibiliAvatar(uid)

    const normalizedResolved = trimValue(resolved)
    if (normalizedResolved && isDiscoverAvatarCacheableImageUrl(normalizedResolved)) {
      try {
        const dummyUrl = `https://space.bilibili.com/${cleanUid}`
        await DiscoverAvatarCacheStore.remember(dummyUrl, dummyUrl, normalizedResolved)
      } catch (_) {}
    }

    return resolved
  }
}
