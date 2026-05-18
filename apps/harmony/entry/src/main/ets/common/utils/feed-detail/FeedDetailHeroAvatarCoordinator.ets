import { FeedRepository } from '../../repositories/FeedRepository'
import { Feed } from '../../models/LivoModels'
import { FeedRefreshPayload } from '../../services/RssFeedService'
import { SocialFeedAvatarService } from '../../services/SocialFeedAvatarService'
import { resolvePreferredStoredFeedImageUrl } from '../social/SocialFeedPresentation'
import { resolveFeedDetailPreferredDisplayImageUrl } from './FeedDetailPreviewPolicy'
import { bumpFeedsChangedSignal } from '../FeedChangeSignal'
import {
  buildFeedDetailHeroAvatarCandidates,
  FeedDetailAvatarPersistContext,
  FeedDetailHeroAvatarSnapshot,
  persistFeedDetailDiscoverAvatar,
  resolveFeedDetailAvatarFallbackLabel,
} from './FeedDetailHeroAvatarPolicy'

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

export class FeedDetailHeroAvatarCoordinator {
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
    return resolveFeedDetailAvatarFallbackLabel(title)
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
