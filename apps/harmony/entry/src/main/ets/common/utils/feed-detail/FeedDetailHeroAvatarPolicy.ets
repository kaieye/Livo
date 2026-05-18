import { DiscoverAvatarCacheStore } from '../../services/DiscoverAvatarCacheStore'
import { isDiscoverAvatarCacheableImageUrl } from '../discover/DiscoverAvatarPresentation'
import { feedDetailHostOf } from './FeedDetailPreviewPolicy'
import { extractInstagramUsername } from '../social/SocialFeedTitles'

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
