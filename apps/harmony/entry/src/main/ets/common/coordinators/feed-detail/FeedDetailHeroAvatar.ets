import { FeedRepository } from '../../repositories/FeedRepository'
import { Feed } from '../../models/LivoModels'
import { FeedRefreshPayload } from '../../services/RssFeedService'
import { SocialFeedAvatarService } from '../../services/SocialFeedAvatarService'
import { resolvePreferredStoredFeedImageUrl } from '../../utils/social/SocialFeedPresentation'
import { resolveFeedDetailPreferredDisplayImageUrl } from './FeedDetailPreviewPolicy'
import { bumpFeedsChangedSignal } from '../../utils/FeedChangeSignal'
import { DiscoverAvatarCacheStore } from '../../services/DiscoverAvatarCacheStore'
import { isDiscoverAvatarCacheableImageUrl } from '../../coordinators/discover/DiscoverAvatarPresentation'
import { extractInstagramUsername, extractXUsername } from '../../utils/social/SocialFeedTitles'
import { extractBilibiliIdentity, extractYouTubeIdentity } from '../../coordinators/discover/DiscoverFeedIdentity'
import { feedDetailHostOf } from './FeedDetailPreviewPolicy'

export interface FeedDetailHeroAvatarOwner {
  targetUrl: string
  targetSiteUrl: string
  targetTitle: string
  targetImageUrl: string
  previewPayload: FeedRefreshPayload | undefined
  existingFeed: Feed | undefined
  heroAvatarCandidates: string[]
  heroAvatarIndex: number

  setTargetImageUrl(value: string): void
  applyPreviewPayload(payload: FeedRefreshPayload | undefined): void
  setHeroAvatarCandidates(candidates: string[]): void
  setHeroAvatarIndex(index: number): void
}

interface FeedDetailHeroAvatarSnapshot {
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

interface FeedDetailAvatarPersistContext {
  targetUrl: string
  siteUrl: string
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

function buildFeedDetailHeroAvatarCandidates(
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

function persistFeedDetailDiscoverAvatar(
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

export class FeedDetailHeroAvatar {
  private readonly owner: FeedDetailHeroAvatarOwner

  constructor(owner: FeedDetailHeroAvatarOwner) {
    this.owner = owner
  }

  resetCandidates(): void {
    const candidates = buildFeedDetailHeroAvatarCandidates(this.snapshot())
    this.owner.setHeroAvatarCandidates(candidates)
    this.owner.setHeroAvatarIndex(0)
  }

  currentUrl(): string {
    return this.owner.heroAvatarCandidates[this.owner.heroAvatarIndex] ?? ''
  }

  advance(): void {
    if (this.owner.heroAvatarIndex + 1 < this.owner.heroAvatarCandidates.length) {
      this.owner.setHeroAvatarIndex(this.owner.heroAvatarIndex + 1)
    } else {
      this.owner.setHeroAvatarIndex(this.owner.heroAvatarCandidates.length)
    }
  }

  fallbackLabel(title: string): string {
    const trimmed = (title || '').trim()
    return trimmed ? trimmed.substring(0, 1).toUpperCase() : '?'
  }

  rememberCurrentPreview(imageUrl: string): void {
    persistFeedDetailDiscoverAvatar(this.persistContexts(), imageUrl)
  }

  rememberFromPayload(payload: FeedRefreshPayload | undefined): void {
    if (!payload) {
      return
    }
    const targetUrl = (payload.resolvedFeedUrl || this.owner.targetUrl || this.owner.existingFeed?.url || '').trim()
    if (!targetUrl) {
      return
    }
    const siteUrl = payload.siteUrl || this.owner.targetSiteUrl || this.owner.existingFeed?.siteUrl || ''
    const contexts: FeedDetailAvatarPersistContext[] = [{ targetUrl, siteUrl }]
    if (this.owner.targetUrl && this.owner.targetUrl !== targetUrl) {
      contexts.push({ targetUrl: this.owner.targetUrl, siteUrl })
    }
    persistFeedDetailDiscoverAvatar(contexts, payload.imageUrl || '')
  }

  async hydrateSubscribedAvatar(feed: Feed, currentImageUrl: string): Promise<void> {
    const resolvedAvatar = (
      (await SocialFeedAvatarService.resolveFeedAvatar(
        feed.url,
        feed.siteUrl || '',
        currentImageUrl,
        feed.imageUrl || '',
      )) || ''
    ).trim()
    if (!resolvedAvatar) {
      return
    }

    const currentStoredImageUrl = (feed.imageUrl || '').trim()
    const nextStoredImageUrl = resolvePreferredStoredFeedImageUrl(currentStoredImageUrl, resolvedAvatar)
    if (!nextStoredImageUrl) {
      return
    }

    const shouldPersist = nextStoredImageUrl !== currentStoredImageUrl
    const shouldUpdateDetailState = nextStoredImageUrl !== this.owner.targetImageUrl
    if (!shouldPersist && !shouldUpdateDetailState) {
      return
    }

    if (shouldUpdateDetailState) {
      this.owner.setTargetImageUrl(nextStoredImageUrl)
    }
    if (shouldPersist) {
      await FeedRepository.default.update(feed.id, {
        title: feed.title,
        url: feed.url,
        siteUrl: feed.siteUrl || '',
        imageUrl: nextStoredImageUrl,
        description: feed.description || '',
        category: feed.category || '',
        view: feed.view,
        showInAll: feed.showInAll,
      })
      bumpFeedsChangedSignal()
    }
    if (this.owner.previewPayload) {
      this.owner.applyPreviewPayload({
        etag: this.owner.previewPayload.etag,
        lastModified: this.owner.previewPayload.lastModified,
        feedTitle: this.owner.previewPayload.feedTitle,
        siteUrl: this.owner.previewPayload.siteUrl,
        imageUrl: nextStoredImageUrl,
        description: this.owner.previewPayload.description,
        resolvedFeedUrl: this.owner.previewPayload.resolvedFeedUrl,
        entries: this.owner.previewPayload.entries,
      })
    }
    this.resetCandidates()
  }

  async hydratePreviewAvatar(feedUrl: string, siteUrl: string, currentImageUrl: string): Promise<void> {
    const resolvedAvatar = await SocialFeedAvatarService.resolveFeedAvatar(
      feedUrl,
      siteUrl,
      currentImageUrl,
      this.owner.targetImageUrl,
    )
    if (!resolvedAvatar) {
      return
    }

    const preferred = resolveFeedDetailPreferredDisplayImageUrl(resolvedAvatar, this.owner.targetImageUrl)
    if (!preferred || preferred === this.owner.targetImageUrl) {
      return
    }

    this.owner.setTargetImageUrl(preferred)
    persistFeedDetailDiscoverAvatar([{ targetUrl: feedUrl, siteUrl }], preferred)
    if (this.owner.previewPayload) {
      this.owner.applyPreviewPayload({
        etag: this.owner.previewPayload.etag,
        lastModified: this.owner.previewPayload.lastModified,
        feedTitle: this.owner.previewPayload.feedTitle,
        siteUrl: this.owner.previewPayload.siteUrl,
        imageUrl: preferred,
        description: this.owner.previewPayload.description,
        resolvedFeedUrl: this.owner.previewPayload.resolvedFeedUrl,
        entries: this.owner.previewPayload.entries,
      })
    }
    this.resetCandidates()
  }

  private snapshot(): FeedDetailHeroAvatarSnapshot {
    return {
      targetImageUrl: this.owner.targetImageUrl,
      targetSiteUrl: this.owner.targetSiteUrl,
      targetTitle: this.owner.targetTitle,
      targetUrl: this.owner.targetUrl,
      previewImageUrl: this.owner.previewPayload?.imageUrl || '',
      previewSiteUrl: this.owner.previewPayload?.siteUrl || '',
      previewFeedTitle: this.owner.previewPayload?.feedTitle || '',
      previewResolvedFeedUrl: this.owner.previewPayload?.resolvedFeedUrl || '',
      existingFeedUrl: this.owner.existingFeed?.url || '',
      existingFeedSiteUrl: this.owner.existingFeed?.siteUrl || '',
    }
  }

  private persistContexts(): FeedDetailAvatarPersistContext[] {
    const targetUrl = (
      this.owner.previewPayload?.resolvedFeedUrl ||
      this.owner.targetUrl ||
      this.owner.existingFeed?.url ||
      ''
    ).trim()
    const siteUrl =
      this.owner.previewPayload?.siteUrl || this.owner.targetSiteUrl || this.owner.existingFeed?.siteUrl || ''

    const contexts: FeedDetailAvatarPersistContext[] = []
    if (targetUrl) {
      contexts.push({ targetUrl, siteUrl })
    }
    if (this.owner.targetUrl && this.owner.targetUrl !== targetUrl) {
      contexts.push({ targetUrl: this.owner.targetUrl, siteUrl })
    }
    return contexts
  }
}
