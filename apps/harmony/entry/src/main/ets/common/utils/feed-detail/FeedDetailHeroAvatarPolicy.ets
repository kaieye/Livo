import { DiscoverAvatarCacheStore } from '../../services/DiscoverAvatarCacheStore'
import { isDiscoverAvatarCacheableImageUrl } from '../discover/DiscoverAvatarPresentation'
import { feedDetailHostOf } from './FeedDetailPreviewPolicy'
import { extractInstagramUsername, extractXUsername } from '../social/SocialFeedTitles'
import { extractBilibiliIdentity, extractYouTubeIdentity } from '../discover/DiscoverFeedIdentity'

export interface FeedDetailHeroAvatarSnapshot {
  targetImageUrl: string
  targetSiteUrl: string
  targetTitle: string
  targetUrl: string
  previewImageUrl: string
  previewSiteUrl: string
  previewFeedTitle: string
  previewResolvedFeedUrl: string
  existingFeedUrl: string
  existingFeedSiteUrl: string
}

function pushCandidate(values: string[], value: string): void {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return
  }
  values.push(trimmed)
}

function dedupeUrls(urls: string[]): string[] {
  const result: string[] = []
  urls.forEach((url: string) => {
    const trimmed = url.trim()
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed)
    }
  })
  return result
}

export function buildFeedDetailHeroAvatarCandidates(
  snapshot: FeedDetailHeroAvatarSnapshot,
): string[] {
  const candidates: string[] = []

  pushCandidate(candidates, snapshot.targetImageUrl)
  pushCandidate(candidates, snapshot.previewImageUrl)

  const instagramUsername =
    extractInstagramUsername(snapshot.previewResolvedFeedUrl) ||
    extractInstagramUsername(snapshot.existingFeedUrl) ||
    extractInstagramUsername(snapshot.previewSiteUrl) ||
    extractInstagramUsername(snapshot.existingFeedSiteUrl) ||
    extractInstagramUsername(snapshot.targetSiteUrl || snapshot.targetUrl) ||
    extractInstagramUsername(snapshot.previewFeedTitle || snapshot.targetTitle)
  if (instagramUsername) {
    pushCandidate(
      candidates,
      `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`,
    )
    pushCandidate(
      candidates,
      `https://unavatar.io/${encodeURIComponent(`instagram.com/${instagramUsername}`)}?fallback=false`,
    )
  }

  const xUsername =
    extractXUsername(snapshot.previewResolvedFeedUrl) ||
    extractXUsername(snapshot.existingFeedUrl) ||
    extractXUsername(snapshot.previewSiteUrl) ||
    extractXUsername(snapshot.existingFeedSiteUrl) ||
    extractXUsername(snapshot.targetSiteUrl || snapshot.targetUrl) ||
    extractXUsername(snapshot.previewFeedTitle || snapshot.targetTitle)
  if (xUsername) {
    pushCandidate(
      candidates,
      `https://unavatar.io/x/${encodeURIComponent(xUsername)}`,
    )
  }

  const collectUrls = (urls: string[]): string[] => {
    const result: string[] = []
    urls.forEach((url: string) => {
      if (url.trim() && !result.includes(url.trim())) {
        result.push(url.trim())
      }
    })
    return result
  }

  const candidateUrls = collectUrls([
    snapshot.previewResolvedFeedUrl,
    snapshot.existingFeedUrl,
    snapshot.previewSiteUrl,
    snapshot.existingFeedSiteUrl,
    snapshot.targetSiteUrl,
    snapshot.targetUrl,
  ])

  candidateUrls.forEach((candidateUrl: string) => {
    const bilibiliIdentity = extractBilibiliIdentity(candidateUrl)
    if (bilibiliIdentity.startsWith('bilibili:')) {
      pushCandidate(
        candidates,
        `https://unavatar.io/bilibili/${encodeURIComponent(bilibiliIdentity.replace(/^bilibili:/, ''))}?fallback=false`,
      )
    }

    const youtubeIdentity = extractYouTubeIdentity(candidateUrl)
    if (youtubeIdentity.startsWith('youtube:channel:')) {
      pushCandidate(
        candidates,
        `https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:channel:/, ''))}?fallback=false`,
      )
    } else if (youtubeIdentity.startsWith('youtube:handle:')) {
      pushCandidate(
        candidates,
        `https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:handle:/, ''))}?fallback=false`,
      )
    } else if (youtubeIdentity.startsWith('youtube:user:')) {
      pushCandidate(
        candidates,
        `https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:user:/, ''))}?fallback=false`,
      )
    }
  })

  const host = feedDetailHostOf(
    snapshot.previewSiteUrl || snapshot.targetSiteUrl || snapshot.targetUrl,
  )
  if (host) {
    pushCandidate(candidates, `https://${host}/favicon.ico`)
  }

  return dedupeUrls(candidates)
}

export function resolveFeedDetailAvatarFallbackLabel(title: string): string {
  const trimmed = (title || '').trim()
  return trimmed ? trimmed.substring(0, 1).toUpperCase() : '?'
}

export interface FeedDetailAvatarPersistContext {
  targetUrl: string
  siteUrl: string
}

export function persistFeedDetailDiscoverAvatar(
  contexts: FeedDetailAvatarPersistContext[],
  imageUrl: string,
): void {
  const normalized = (imageUrl || '').trim()
  if (!isDiscoverAvatarCacheableImageUrl(normalized)) {
    return
  }

  const seen: Set<string> = new Set<string>()
  contexts.forEach((context: FeedDetailAvatarPersistContext) => {
    const targetUrl = (context.targetUrl || '').trim()
    if (!targetUrl) {
      return
    }
    const siteKey = `${targetUrl}|${context.siteUrl || ''}`
    if (!seen.has(siteKey)) {
      seen.add(siteKey)
      void DiscoverAvatarCacheStore.remember(
        targetUrl,
        context.siteUrl || '',
        normalized,
      )
    }
    const fallbackKey = `${targetUrl}|`
    if (!seen.has(fallbackKey)) {
      seen.add(fallbackKey)
      void DiscoverAvatarCacheStore.remember(targetUrl, '', normalized)
    }
  })
}
