import { Entry, Feed, FeedViewType } from '../../models/LivoModels'
import { FeedRepository } from '../../repositories/FeedRepository'
import { EntryRepository } from '../../repositories/EntryRepository'
import { FeedRefreshCoordinator } from '../../data/FeedRefreshCoordinator'
import { FeedRefreshPayload, RssFeedService } from '../../services/RssFeedService'
import { DiscoverRemoteSearchService } from '../../services/DiscoverRemoteSearchService'
import { canonicalInstagramFeedUrl } from '../../utils/social/SocialFeedTitles'
import { shouldUseCachedPicturePreview } from '../../utils/PictureGallery'
import { bumpFeedsChangedSignal } from '../../utils/FeedChangeSignal'
import {
  FeedDetailDisplayFeedState,
  feedDetailMatchesTarget,
  latestFeedDetailEntryPublishedAt,
  normalizeFeedDetailPreviewPayload,
  resolveFeedDetailDisplayState,
  resolveFeedDetailPreferredDisplayImageUrl,
  resolvePreferredFeedDetailPreviewEntries,
  shouldReseedFeedDetailFromCachedPreview,
} from './FeedDetailPreviewPolicy'

export interface FeedDetailDataOwner {
  feedId: string
  targetUrl: string
  targetView: FeedViewType
  initialTargetTitle: string
  initialTargetSiteUrl: string
  initialTargetImageUrl: string
  initialTargetDescription: string
  targetTitle: string
  targetSiteUrl: string
  targetImageUrl: string
  targetDescription: string
  previewPayload: FeedRefreshPayload | undefined
  existingFeed: Feed | undefined
  isLoading: boolean
  isRefreshing: boolean

  setIsLoading(loading: boolean): void
  setIsRefreshing(value: boolean): void
  setIsRefreshBusy(value: boolean): void
  setPreviewError(value: string): void
  setPreviewNotice(value: string): void
  setExistingFeed(feed: Feed | undefined): void
  setTargetTitle(value: string): void
  setTargetSiteUrl(value: string): void
  setTargetImageUrl(value: string): void
  setTargetDescription(value: string): void

  applyPreviewPayload(payload: FeedRefreshPayload | undefined): void
  resetHeroAvatarCandidates(): void
  hydrateSubscribedAvatar(feed: Feed, currentImageUrl: string): Promise<void>
  hydratePreviewAvatar(feedUrl: string, siteUrl: string, currentImageUrl: string): Promise<void>
  hydrateVideoPreviews(entries: Entry[]): Promise<void>
  showToast(message: string, duration?: number): void
}

export class FeedDetailDataCoordinator {
  private readonly owner: FeedDetailDataOwner

  constructor(owner: FeedDetailDataOwner) {
    this.owner = owner
  }

  async load(): Promise<void> {
    this.owner.setIsLoading(true)
    this.owner.setPreviewError('')
    this.owner.setPreviewNotice('')

    try {
      if (this.owner.feedId) {
        await this.loadSubscribedFeed()
      } else if (this.owner.targetUrl) {
        await this.loadDiscoverPreview()
      }
    } catch (e) {
      this.owner.setPreviewError(`加载失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      this.owner.setIsLoading(false)
    }
  }

  triggerRefresh(): void {
    if (this.owner.isRefreshing) {
      return
    }
    this.owner.setIsRefreshBusy(true)
    this.owner.setIsRefreshing(true)
    setTimeout(() => {
      void this.refreshCore()
    }, 16)
  }

  async reloadSubscribedFeedSnapshot(): Promise<void> {
    if (!this.owner.feedId) {
      return
    }

    try {
      const feed = await FeedRepository.default.getById(this.owner.feedId)
      if (!feed) {
        return
      }

      this.owner.setExistingFeed(feed)
      const displayFeed = this.displayFeedState(
        feed.title,
        feed.imageUrl || '',
        feed.description || '',
        feed.url,
        feed.siteUrl || '',
      )
      this.owner.setTargetTitle(displayFeed.title)
      this.owner.setTargetSiteUrl(feed.siteUrl || '')
      this.owner.setTargetImageUrl(displayFeed.imageUrl)
      this.owner.setTargetDescription(displayFeed.description)

      const entries = await EntryRepository.default.listByFeed(this.owner.feedId)
      const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(feed.url)
      const previewEntries = resolvePreferredFeedDetailPreviewEntries(entries, cachedPayload?.entries ?? [])
      const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl)
      this.owner.applyPreviewPayload({
        etag: feed.etag || '',
        lastModified: feed.lastModified || '',
        feedTitle: displayFeed.title || cachedPayload?.feedTitle || '',
        siteUrl: feed.siteUrl || cachedPayload?.siteUrl || '',
        imageUrl: payloadImageUrl,
        description: displayFeed.description || cachedPayload?.description || '',
        entries: previewEntries,
      })
      this.owner.resetHeroAvatarCandidates()
      void this.owner.hydrateVideoPreviews(previewEntries)
    } catch (error) {
      console.error(`reload subscribed feed snapshot failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private async loadSubscribedFeed(): Promise<void> {
    const feed = await FeedRepository.default.getById(this.owner.feedId)
    if (!feed) {
      return
    }
    this.owner.setExistingFeed(feed)
    const displayFeed = this.displayFeedState(
      feed.title,
      feed.imageUrl || '',
      feed.description || '',
      feed.url,
      feed.siteUrl || '',
    )
    this.owner.setTargetTitle(displayFeed.title)
    this.owner.setTargetSiteUrl(feed.siteUrl || '')
    this.owner.setTargetImageUrl(displayFeed.imageUrl)
    this.owner.setTargetDescription(displayFeed.description)

    const entries = await EntryRepository.default.listByFeed(this.owner.feedId)
    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(feed.url)
    const shouldReseed = shouldReseedFeedDetailFromCachedPreview(entries, cachedPayload)
    const persistedEntries = shouldReseed
      ? await this.reseedSubscribedFeedFromCachedPreview(this.owner.feedId, cachedPayload as FeedRefreshPayload)
      : entries
    const previewEntries = resolvePreferredFeedDetailPreviewEntries(persistedEntries, cachedPayload?.entries ?? [])
    const payloadTitle = displayFeed.title || cachedPayload?.feedTitle || ''
    const payloadDescription = displayFeed.description || cachedPayload?.description || ''
    const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl)

    this.owner.applyPreviewPayload({
      etag: feed.etag || '',
      lastModified: feed.lastModified || '',
      feedTitle: payloadTitle,
      siteUrl: feed.siteUrl || cachedPayload?.siteUrl || '',
      imageUrl: payloadImageUrl,
      description: payloadDescription,
      entries: previewEntries,
    })
    this.owner.resetHeroAvatarCandidates()
    await this.owner.hydrateSubscribedAvatar(feed, payloadImageUrl)
    void this.owner.hydrateVideoPreviews(previewEntries)
  }

  private async loadDiscoverPreview(): Promise<void> {
    const previewTargetUrl = this.resolvedPreviewTargetUrl()
    this.owner.setExistingFeed(await this.findExistingFeed(previewTargetUrl, this.owner.targetSiteUrl))
    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(this.owner.targetUrl)

    if (shouldUseCachedPicturePreview(this.isPicturesPreview(), cachedPayload)) {
      const resolvedCachedPayload = normalizeFeedDetailPreviewPayload(
        cachedPayload as FeedRefreshPayload,
        previewTargetUrl,
      )
      DiscoverRemoteSearchService.rememberPreviewPayload(this.owner.targetUrl, resolvedCachedPayload)
      this.owner.applyPreviewPayload(resolvedCachedPayload)
      this.owner.setTargetTitle(resolvedCachedPayload.feedTitle || this.owner.targetTitle)
      this.owner.setTargetSiteUrl(resolvedCachedPayload.siteUrl || this.owner.targetSiteUrl)
      this.owner.setTargetImageUrl(
        this.preferredDisplayImageUrl(resolvedCachedPayload.imageUrl || '', this.owner.targetImageUrl),
      )
      this.owner.setTargetDescription(resolvedCachedPayload.description || this.owner.targetDescription)
      this.owner.resetHeroAvatarCandidates()
      void this.owner.hydratePreviewAvatar(previewTargetUrl, this.owner.targetSiteUrl, this.owner.targetImageUrl)
      void this.owner.hydrateVideoPreviews(resolvedCachedPayload.entries)

      if (!this.owner.existingFeed && resolvedCachedPayload.siteUrl) {
        this.owner.setExistingFeed(await this.findExistingFeed(previewTargetUrl, resolvedCachedPayload.siteUrl))
      }
      return
    }

    const fallbackPayload = this.buildFallbackPreviewPayload()
    if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
      this.owner.applyPreviewPayload(fallbackPayload)
      this.owner.setPreviewNotice('正在拉取实时预览，已先展示订阅源信息。')
      this.owner.resetHeroAvatarCandidates()
    }

    try {
      const payload = normalizeFeedDetailPreviewPayload(
        await RssFeedService.previewFeedUrl(previewTargetUrl),
        previewTargetUrl,
      )
      DiscoverRemoteSearchService.rememberPreviewPayload(this.owner.targetUrl, payload)
      this.owner.applyPreviewPayload(payload)
      this.owner.setPreviewNotice('')
      this.owner.setTargetTitle(payload.feedTitle || this.owner.targetTitle)
      this.owner.setTargetSiteUrl(payload.siteUrl || this.owner.targetSiteUrl)
      this.owner.setTargetImageUrl(this.preferredDisplayImageUrl(payload.imageUrl || '', this.owner.targetImageUrl))
      this.owner.setTargetDescription(payload.description || this.owner.targetDescription)
      this.owner.resetHeroAvatarCandidates()
      void this.owner.hydratePreviewAvatar(previewTargetUrl, this.owner.targetSiteUrl, this.owner.targetImageUrl)
      void this.owner.hydrateVideoPreviews(payload.entries)

      if (!this.owner.existingFeed && payload.siteUrl) {
        this.owner.setExistingFeed(await this.findExistingFeed(previewTargetUrl, payload.siteUrl))
      }
    } catch (e) {
      const lateFallback = this.buildFallbackPreviewPayload()
      if (this.shouldUseSoftPreviewFallback() && lateFallback) {
        this.owner.applyPreviewPayload(lateFallback)
        this.owner.setPreviewNotice('暂时无法拉取实时预览，已先展示订阅源信息。订阅后会在“图片”栏目按图片流展示内容。')
        this.owner.resetHeroAvatarCandidates()
      } else {
        throw new Error(e instanceof Error ? e.message : '预览加载失败')
      }
    }
  }

  private async refreshCore(): Promise<void> {
    try {
      if (this.owner.existingFeed) {
        await this.refreshSubscribedFeed()
      } else if (this.owner.targetUrl) {
        await this.refreshDiscoverPreview()
      }
    } catch (error) {
      this.owner.showToast(`刷新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      this.owner.setIsRefreshing(false)
      this.owner.setIsRefreshBusy(false)
    }
  }

  private async refreshSubscribedFeed(): Promise<void> {
    const existingFeed = this.owner.existingFeed
    if (!existingFeed) {
      return
    }
    const previousEntries = this.owner.previewPayload?.entries ?? []
    const previousCount = previousEntries.length
    const previousLatestPublishedAt = latestFeedDetailEntryPublishedAt(previousEntries)
    await FeedRefreshCoordinator.default.refreshFeed(existingFeed.id, true, false, false, false)
    const refreshedFeed = await FeedRepository.default.getById(existingFeed.id)
    const entries = await EntryRepository.default.listByFeed(existingFeed.id)
    if (!refreshedFeed) {
      void this.owner.hydrateVideoPreviews(entries)
      return
    }

    bumpFeedsChangedSignal()
    this.owner.setExistingFeed(refreshedFeed)
    const displayFeed = this.displayFeedState(
      refreshedFeed.title,
      refreshedFeed.imageUrl || '',
      refreshedFeed.description || '',
      refreshedFeed.url,
      refreshedFeed.siteUrl || '',
    )
    this.owner.setTargetTitle(displayFeed.title)
    this.owner.setTargetSiteUrl(refreshedFeed.siteUrl || '')
    this.owner.setTargetDescription(displayFeed.description)
    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(refreshedFeed.url)
    const previewEntries = entries.length > 0 ? entries : (cachedPayload?.entries ?? [])
    const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl)
    this.owner.setTargetImageUrl(displayFeed.imageUrl)
    this.owner.applyPreviewPayload({
      etag: refreshedFeed.etag || '',
      lastModified: refreshedFeed.lastModified || '',
      feedTitle: displayFeed.title || this.owner.previewPayload?.feedTitle || '',
      siteUrl: refreshedFeed.siteUrl || this.owner.previewPayload?.siteUrl || '',
      imageUrl: payloadImageUrl || this.owner.previewPayload?.imageUrl || '',
      description: displayFeed.description || this.owner.previewPayload?.description || '',
      entries: previewEntries,
    })
    this.owner.resetHeroAvatarCandidates()
    await this.owner.hydrateSubscribedAvatar(refreshedFeed, payloadImageUrl)
    void this.owner.hydrateVideoPreviews(previewEntries)
    const latestPublishedAt = latestFeedDetailEntryPublishedAt(previewEntries)
    const hasNewerEntries = latestPublishedAt > previousLatestPublishedAt
    const countDelta = previewEntries.length - previousCount
    if (hasNewerEntries || countDelta > 0) {
      this.owner.showToast(`刷新完成，新增 ${Math.max(countDelta, 1)} 条内容`)
    } else {
      this.owner.showToast('已刷新到最新')
    }
  }

  private async refreshDiscoverPreview(): Promise<void> {
    try {
      const previewTargetUrl = this.resolvedPreviewTargetUrl()
      const payload = normalizeFeedDetailPreviewPayload(
        await RssFeedService.previewFeedUrl(previewTargetUrl),
        previewTargetUrl,
      )
      DiscoverRemoteSearchService.rememberPreviewPayload(this.owner.targetUrl, payload)
      this.owner.applyPreviewPayload(payload)
      this.owner.setPreviewNotice('')
      this.owner.setTargetTitle(payload.feedTitle || this.owner.targetTitle)
      this.owner.setTargetSiteUrl(payload.siteUrl || this.owner.targetSiteUrl)
      this.owner.setTargetImageUrl(this.preferredDisplayImageUrl(payload.imageUrl || '', this.owner.targetImageUrl))
      this.owner.setTargetDescription(payload.description || this.owner.targetDescription)
      this.owner.resetHeroAvatarCandidates()
      void this.owner.hydratePreviewAvatar(previewTargetUrl, this.owner.targetSiteUrl, this.owner.targetImageUrl)
      void this.owner.hydrateVideoPreviews(payload.entries)
      this.owner.showToast('预览已刷新')
    } catch (e) {
      const fallbackPayload = this.buildFallbackPreviewPayload()
      if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
        this.owner.applyPreviewPayload(fallbackPayload)
        this.owner.setPreviewNotice('暂时无法刷新实时预览，已保留订阅源信息。')
        this.owner.resetHeroAvatarCandidates()
        this.owner.showToast('刷新失败，已保留当前内容')
      } else {
        throw new Error(e instanceof Error ? e.message : '预览刷新失败')
      }
    }
  }

  private displayFeedState(
    title: string,
    imageUrl: string,
    description: string,
    feedUrl: string,
    siteUrl: string,
  ): FeedDetailDisplayFeedState {
    return resolveFeedDetailDisplayState(title, imageUrl, description, feedUrl, siteUrl)
  }

  private preferredDisplayImageUrl(primaryImageUrl: string, fallbackImageUrl: string): string {
    return resolveFeedDetailPreferredDisplayImageUrl(primaryImageUrl, fallbackImageUrl)
  }

  private resolvedPreviewTargetUrl(): string {
    return canonicalInstagramFeedUrl(this.owner.targetUrl, this.owner.targetSiteUrl) || this.owner.targetUrl
  }

  private async findExistingFeed(targetUrl: string, siteUrl: string): Promise<Feed | undefined> {
    const feeds = await FeedRepository.default.list()
    return feeds.find((feed: Feed) => feedDetailMatchesTarget(feed, targetUrl, siteUrl))
  }

  private buildFallbackPreviewPayload(): FeedRefreshPayload | undefined {
    const title = (this.owner.targetTitle || this.owner.initialTargetTitle || '').trim()
    const siteUrl = (this.owner.targetSiteUrl || this.owner.initialTargetSiteUrl || '').trim()
    const imageUrl = (
      this.owner.targetImageUrl ||
      this.owner.initialTargetImageUrl ||
      this.owner.existingFeed?.imageUrl ||
      ''
    ).trim()
    const description = (this.owner.targetDescription || this.owner.initialTargetDescription || '').trim()

    if (!title && !siteUrl && !imageUrl && !description) {
      return undefined
    }

    return {
      etag: '',
      lastModified: '',
      feedTitle: title || this.owner.targetUrl,
      siteUrl,
      imageUrl,
      description,
      entries: [],
    }
  }

  private shouldUseSoftPreviewFallback(): boolean {
    if (this.owner.targetView !== FeedViewType.Pictures) {
      return false
    }
    return !!(
      this.owner.targetTitle.trim() ||
      this.owner.targetSiteUrl.trim() ||
      this.owner.targetImageUrl.trim() ||
      this.owner.targetDescription.trim()
    )
  }

  private async reseedSubscribedFeedFromCachedPreview(
    feedId: string,
    payload: FeedRefreshPayload,
  ): Promise<Entry[]> {
    await FeedRefreshCoordinator.default.seedFeedFromPreview(feedId, payload)
    bumpFeedsChangedSignal()
    return EntryRepository.default.listByFeed(feedId)
  }

  private isPicturesPreview(): boolean {
    const currentView = this.owner.existingFeed?.view ?? this.owner.targetView
    return currentView === FeedViewType.Pictures
  }
}
