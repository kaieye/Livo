import http from '@ohos.net.http'
import { AppRepository } from '../data/AppRepository'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { Entry, Feed, FeedViewType, formatPublishedAt } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import { resolveEntryCardImageUrl } from '../utils/EntryCardPreview'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import {
  extractPictureCarouselMediaUrls,
  extractEntryGalleryImageUrls,
  shouldUseCachedPicturePreview,
} from '../utils/PictureGallery'
import { canonicalInstagramFeedUrl, extractInstagramUsername } from '../utils/SocialFeedTitles'
import {
  resolveSocialFeedDisplayDescription,
  resolveSocialFeedDisplayImageUrl,
  resolvePreferredStoredFeedImageUrl,
  resolveSocialFeedDisplayTitle,
} from '../utils/SocialFeedPresentation'
import { presentTweetEntryFromEntry, TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import { TweetEntryCard } from './TweetEntryCard'

interface VideoPreviewCacheItem {
  videoUrl: string
  previewUrl: string
}

interface DisplayFeedState {
  title: string
  imageUrl: string
  description: string
}

const X_PREVIEW_COLLAPSED_TEXT_LINES: number = 8

@Component
export struct FeedDetailView {
  @Prop feedId: string = ''
  @Prop targetUrl: string = ''
  @Prop initialTargetTitle: string = ''
  @Prop initialTargetSiteUrl: string = ''
  @Prop initialTargetImageUrl: string = ''
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  
  // Callbacks for navigation and actions
  onBack: () => void = () => {}
  onEdit: (feed: Feed) => void = () => {}
  onSubscribe: (payload: FeedRefreshPayload) => void = () => {}
  onOpenArticle: (entry: Entry, feed: Feed) => void = () => {}

  @State private targetTitle: string = ''
  @State private targetSiteUrl: string = ''
  @State private targetImageUrl: string = ''
  @State private targetDescription: string = ''
  @State private previewPayload: FeedRefreshPayload | undefined = undefined
  @State private resolvedPreviewEntries: Entry[] = []
  @State private previewError: string = ''
  @State private previewNotice: string = ''
  @State private isLoading: boolean = true
  @State private isRefreshing: boolean = false
  @State private isRefreshBusy: boolean = false
  @State private existingFeed: Feed | undefined = undefined
  @State private videoPreviewCache: VideoPreviewCacheItem[] = []
  @State private heroAvatarCandidates: string[] = []
  @State private heroAvatarIndex: number = 0
  private readonly previewEntryDataSource: ArrayLazyDataSource<Entry> = new ArrayLazyDataSource<Entry>(
    () => this.resolvedPreviewEntries,
  )
  private readonly picturePreviewLeadUrlCache: Map<string, string> = new Map()
  private readonly tweetPresentationCache: Map<string, TweetEntryPresentation> = new Map()
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0

  aboutToAppear(): void {
    // Clear transient detail state before loading to avoid showing stale content from previous destination.
    this.previewPayload = undefined
    this.resolvedPreviewEntries = []
    this.picturePreviewLeadUrlCache.clear()
    this.previewError = ''
    this.previewNotice = ''
    this.existingFeed = undefined
    this.videoPreviewCache = []
    this.heroAvatarCandidates = []
    this.heroAvatarIndex = 0
    this.tweetPresentationCache.clear()

    this.targetTitle = this.initialTargetTitle
    this.targetSiteUrl = this.initialTargetSiteUrl
    this.targetImageUrl = this.initialTargetImageUrl
    this.targetDescription = this.initialTargetDescription
    this.resetHeroAvatarCandidates()
    void this.loadData()
  }

  private handleFeedsChanged(): void {
    if (!this.feedId || this.isLoading || this.isRefreshing) {
      return
    }
    void this.reloadSubscribedFeedSnapshot()
  }

  private async reloadSubscribedFeedSnapshot(): Promise<void> {
    if (!this.feedId) {
      return
    }

    try {
      const feed = await AppRepository.feedEntityById(this.feedId)
      if (!feed) {
        return
      }

      this.existingFeed = feed
      const displayFeed = this.displayFeedState(feed.title, feed.imageUrl || '', feed.description || '', feed.url, feed.siteUrl || '')
      this.targetTitle = displayFeed.title
      this.targetSiteUrl = feed.siteUrl || ''
      this.targetImageUrl = displayFeed.imageUrl
      this.targetDescription = displayFeed.description

      const entries = await AppRepository.entryEntitiesByFeed(this.feedId)
      const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(feed.url)
      const previewEntries = this.preferredPreviewEntries(entries, cachedPayload?.entries ?? [])
      const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl)
      this.targetImageUrl = payloadImageUrl
      this.applyPreviewPayload({
        etag: feed.etag || '',
        lastModified: feed.lastModified || '',
        feedTitle: displayFeed.title || cachedPayload?.feedTitle || '',
        siteUrl: feed.siteUrl || cachedPayload?.siteUrl || '',
        imageUrl: payloadImageUrl,
        description: displayFeed.description || cachedPayload?.description || '',
        entries: previewEntries,
      })
      this.resetHeroAvatarCandidates()
      void this.hydrateVideoPreviews(previewEntries)
    } catch (error) {
      console.error(`reload subscribed feed snapshot failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private async loadData(): Promise<void> {
    this.isLoading = true
    this.previewError = ''
    this.previewNotice = ''
    
    try {
      if (this.feedId) {
        // Mode: Subscribed Feed
        const feed = await AppRepository.feedEntityById(this.feedId)
        if (feed) {
          this.existingFeed = feed
          const displayFeed = this.displayFeedState(feed.title, feed.imageUrl || '', feed.description || '', feed.url, feed.siteUrl || '')
          this.targetTitle = displayFeed.title
          this.targetSiteUrl = feed.siteUrl || ''
          this.targetImageUrl = displayFeed.imageUrl
          this.targetDescription = displayFeed.description
          
          const entries = await AppRepository.entryEntitiesByFeed(this.feedId)
          const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(feed.url)
          const shouldReseed = this.shouldReseedFromCachedPreview(entries, cachedPayload)
          const persistedEntries = shouldReseed
            ? await this.reseedSubscribedFeedFromCachedPreview(this.feedId, cachedPayload as FeedRefreshPayload)
            : entries
          const previewEntries = this.preferredPreviewEntries(persistedEntries, cachedPayload?.entries ?? [])
          const payloadTitle = displayFeed.title || cachedPayload?.feedTitle || ''
          const payloadDescription = displayFeed.description || cachedPayload?.description || ''
          const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl)
          this.targetImageUrl = payloadImageUrl
          // For the shared view, we'll construct a pseudo-payload
          this.applyPreviewPayload({
            etag: feed.etag || '',
            lastModified: feed.lastModified || '',
            feedTitle: payloadTitle,
            siteUrl: feed.siteUrl || cachedPayload?.siteUrl || '',
            imageUrl: payloadImageUrl,
            description: payloadDescription,
            entries: previewEntries,
          })
          this.resetHeroAvatarCandidates()
          await this.hydrateSubscribedAvatar(feed, payloadImageUrl)
          void this.hydrateVideoPreviews(previewEntries)
        }
      } else if (this.targetUrl) {
        // Mode: Discover Preview
        const previewTargetUrl = this.resolvedPreviewTargetUrl()
        this.existingFeed = await this.findExistingFeed(previewTargetUrl, this.targetSiteUrl)
        const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(this.targetUrl)
        if (shouldUseCachedPicturePreview(this.isPicturesPreview(), cachedPayload)) {
          const resolvedCachedPayload = this.normalizedPreviewPayload(cachedPayload as FeedRefreshPayload, previewTargetUrl)
          DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, resolvedCachedPayload)
          this.applyPreviewPayload(resolvedCachedPayload)
          this.targetTitle = resolvedCachedPayload.feedTitle || this.targetTitle
          this.targetSiteUrl = resolvedCachedPayload.siteUrl || this.targetSiteUrl
          this.targetImageUrl = this.preferredDisplayImageUrl(resolvedCachedPayload.imageUrl || '', this.targetImageUrl)
          this.targetDescription = resolvedCachedPayload.description || this.targetDescription
          this.resetHeroAvatarCandidates()
          void this.hydratePreviewAvatar(previewTargetUrl, this.targetSiteUrl, this.targetImageUrl)
          void this.hydrateVideoPreviews(resolvedCachedPayload.entries)

          if (!this.existingFeed && resolvedCachedPayload.siteUrl) {
            this.existingFeed = await this.findExistingFeed(previewTargetUrl, resolvedCachedPayload.siteUrl)
          }
          return
        }
        const fallbackPayload = this.buildFallbackPreviewPayload()
        if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
          this.applyPreviewPayload(fallbackPayload)
          this.previewNotice = '正在拉取实时预览，已先展示订阅源信息。'
          this.resetHeroAvatarCandidates()
        }
        try {
          const payload = this.normalizedPreviewPayload(await RssFeedService.previewFeedUrl(previewTargetUrl), previewTargetUrl)
          DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload)
          this.applyPreviewPayload(payload)
          this.previewNotice = ''
          this.targetTitle = payload.feedTitle || this.targetTitle
          this.targetSiteUrl = payload.siteUrl || this.targetSiteUrl
          this.targetImageUrl = this.preferredDisplayImageUrl(payload.imageUrl || '', this.targetImageUrl)
          this.targetDescription = payload.description || this.targetDescription
          this.resetHeroAvatarCandidates()
          void this.hydratePreviewAvatar(previewTargetUrl, this.targetSiteUrl, this.targetImageUrl)
          void this.hydrateVideoPreviews(payload.entries)

          // If it matches an existing entry, update it
          if (!this.existingFeed && payload.siteUrl) {
             this.existingFeed = await this.findExistingFeed(previewTargetUrl, payload.siteUrl)
          }
        } catch (e) {
          const fallbackPayload = this.buildFallbackPreviewPayload()
          if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
            this.applyPreviewPayload(fallbackPayload)
            this.previewNotice = '暂时无法拉取实时预览，已先展示订阅源信息。订阅后会在“图片”栏目按图片流展示内容。'
            this.resetHeroAvatarCandidates()
          } else {
            throw new Error(e instanceof Error ? e.message : '预览加载失败')
          }
        }
      }
    } catch (e) {
      this.previewError = `加载失败: ${e instanceof Error ? e.message : '未知错误'}`
    } finally {
      this.isLoading = false
    }
  }

  private triggerRefreshData(): void {
    if (this.isRefreshBusy) {
      return
    }

    // Let Refresh finish release animation first, then run network/data work.
    this.isRefreshBusy = true
    this.isRefreshing = true
    setTimeout(() => {
      void this.refreshDataCore()
    }, 16)
  }

  private async refreshDataCore(): Promise<void> {
    try {
      if (this.existingFeed) {
        const previousEntries = this.previewPayload?.entries ?? []
        const previousCount = previousEntries.length
        const previousLatestPublishedAt = this.latestPublishedAt(previousEntries)
        await AppRepository.refreshFeed(this.existingFeed.id, true, false, false, false)
        const refreshedFeed = await AppRepository.feedEntityById(this.existingFeed.id)
        const entries = await AppRepository.entryEntitiesByFeed(this.existingFeed.id)
        if (refreshedFeed) {
          this.signalFeedsChanged()
          this.existingFeed = refreshedFeed
          const displayFeed = this.displayFeedState(
            refreshedFeed.title,
            refreshedFeed.imageUrl || '',
            refreshedFeed.description || '',
            refreshedFeed.url,
            refreshedFeed.siteUrl || '',
          )
          this.targetTitle = displayFeed.title
          this.targetSiteUrl = refreshedFeed.siteUrl || ''
          this.targetDescription = displayFeed.description
          const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(refreshedFeed.url)
          // 在订阅详情页刷新时优先展示本地最新拉取结果，仅在本地为空时回退缓存预览。
          const previewEntries = entries.length > 0 ? entries : (cachedPayload?.entries ?? [])
          const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl)
          this.targetImageUrl = payloadImageUrl
          this.applyPreviewPayload({
            etag: refreshedFeed.etag || '',
            lastModified: refreshedFeed.lastModified || '',
            feedTitle: displayFeed.title || this.previewPayload?.feedTitle || '',
            siteUrl: refreshedFeed.siteUrl || this.previewPayload?.siteUrl || '',
            imageUrl: payloadImageUrl || this.previewPayload?.imageUrl || '',
            description: displayFeed.description || this.previewPayload?.description || '',
            entries: previewEntries,
          })
          this.resetHeroAvatarCandidates()
          await this.hydrateSubscribedAvatar(refreshedFeed, payloadImageUrl)
          void this.hydrateVideoPreviews(previewEntries)
          const latestPublishedAt = this.latestPublishedAt(previewEntries)
          const hasNewerEntries = latestPublishedAt > previousLatestPublishedAt
          const countDelta = previewEntries.length - previousCount
          if (hasNewerEntries || countDelta > 0) {
            this.showToast(`刷新完成，新增 ${Math.max(countDelta, 1)} 条内容`)
          } else {
            this.showToast('已刷新到最新')
          }
          return
        }
        void this.hydrateVideoPreviews(entries)
      } else if (this.targetUrl) {
        try {
          const previewTargetUrl = this.resolvedPreviewTargetUrl()
          const payload = this.normalizedPreviewPayload(await RssFeedService.previewFeedUrl(previewTargetUrl), previewTargetUrl)
          DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload)
          this.applyPreviewPayload(payload)
          this.previewNotice = ''
          this.targetTitle = payload.feedTitle || this.targetTitle
          this.targetSiteUrl = payload.siteUrl || this.targetSiteUrl
          this.targetImageUrl = this.preferredDisplayImageUrl(payload.imageUrl || '', this.targetImageUrl)
          this.targetDescription = payload.description || this.targetDescription
          this.resetHeroAvatarCandidates()
          void this.hydratePreviewAvatar(previewTargetUrl, this.targetSiteUrl, this.targetImageUrl)
          void this.hydrateVideoPreviews(payload.entries)
          this.showToast('预览已刷新')
        } catch (e) {
          const fallbackPayload = this.buildFallbackPreviewPayload()
          if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
            this.applyPreviewPayload(fallbackPayload)
            this.previewNotice = '暂时无法刷新实时预览，已保留订阅源信息。'
            this.resetHeroAvatarCandidates()
            this.showToast('刷新失败，已保留当前内容')
          } else {
            throw new Error(e instanceof Error ? e.message : '预览刷新失败')
          }
        }
      }
    } catch (error) {
      this.showToast(`刷新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      this.isRefreshing = false
      this.isRefreshBusy = false
    }
  }

  private applyPreviewPayload(payload: FeedRefreshPayload | undefined): void {
    this.previewPayload = payload
    this.resolvedPreviewEntries = this.resolvePreviewEntries(payload)
    this.reconcilePicturePreviewLeadUrlCache()
    this.previewEntryDataSource.notifyDataReloaded()
    this.reconcileTweetPresentationCache()
  }

  private resolvePreviewEntries(payload: FeedRefreshPayload | undefined): Entry[] {
    const entries = payload?.entries ?? []
    return entries
  }

  private shouldEnablePreviewItemTransition(): boolean {
    return !(this.isRefreshing || this.isRefreshBusy)
  }

  private picturePreviewCacheKey(entry: Entry): string {
    const id = (entry.id || '').trim()
    if (id) {
      return id
    }

    return `${entry.feedId}|${entry.publishedAt}|${entry.url}|${entry.title}`
  }

  private entryVersionCacheKey(entry: Entry): string {
    return `${this.picturePreviewCacheKey(entry)}|${entry.updatedAt || 0}`
  }

  private resolvePicturePreviewLeadUrl(entry: Entry): string {
    const galleryUrls = this.entryGalleryUrls(entry)
    if (galleryUrls.length > 0) {
      return galleryUrls[0]
    }
    return this.entryPictureUrl(entry)
  }

  private reconcileEntryScopedCache<T>(
    cache: Map<string, T>,
    expectedKeys: Set<string>,
  ): void {
    const staleKeys: string[] = []
    cache.forEach((_value: T, key: string) => {
      if (!expectedKeys.has(key)) {
        staleKeys.push(key)
      }
    })

    staleKeys.forEach((key: string) => {
      cache.delete(key)
    })
  }

  private reconcilePicturePreviewLeadUrlCache(): void {
    if (!this.isPicturesPreview()) {
      this.picturePreviewLeadUrlCache.clear()
      return
    }

    const expectedKeys: Set<string> = new Set<string>()
    this.resolvedPreviewEntries.forEach((entry: Entry) => {
      expectedKeys.add(this.entryVersionCacheKey(entry))
    })

    this.reconcileEntryScopedCache(this.picturePreviewLeadUrlCache, expectedKeys)
  }

  private reconcileTweetPresentationCache(): void {
    if (!this.isXPreview()) {
      this.tweetPresentationCache.clear()
      return
    }

    const expectedKeys: Set<string> = new Set<string>()
    this.resolvedPreviewEntries.forEach((entry: Entry) => {
      expectedKeys.add(this.entryVersionCacheKey(entry))
    })

    this.reconcileEntryScopedCache(this.tweetPresentationCache, expectedKeys)
  }

  private tweetPresentationWithAvatar(
    presentation: TweetEntryPresentation,
    avatarUrl: string,
  ): TweetEntryPresentation {
    return {
      kind: presentation.kind,
      retweetStyle: presentation.retweetStyle,
      displayName: presentation.displayName,
      username: presentation.username,
      avatarUrl,
      text: presentation.text,
      mediaUrls: presentation.mediaUrls,
      publishedLabel: presentation.publishedLabel,
      articleUrl: presentation.articleUrl,
      replyCount: presentation.replyCount,
      repostCount: presentation.repostCount,
      likeCount: presentation.likeCount,
      viewCount: presentation.viewCount,
      retweetByLabel: presentation.retweetByLabel,
      quotedTweet: presentation.quotedTweet,
    }
  }

  private showToast(message: string, duration: number = 1800): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (_error) {}
  }

  private shouldUseSoftPreviewFallback(): boolean {
    if (this.targetView !== FeedViewType.Pictures) {
      return false
    }
    return !!(this.targetTitle.trim() || this.targetSiteUrl.trim() || this.targetImageUrl.trim() || this.targetDescription.trim())
  }

  private buildFallbackPreviewPayload(): FeedRefreshPayload | undefined {
    const title = (this.targetTitle || this.initialTargetTitle || '').trim()
    const siteUrl = (this.targetSiteUrl || this.initialTargetSiteUrl || '').trim()
    const imageUrl = (this.targetImageUrl || this.initialTargetImageUrl || this.existingFeed?.imageUrl || '').trim()
    const description = (this.targetDescription || this.initialTargetDescription || '').trim()

    if (!title && !siteUrl && !imageUrl && !description) {
      return undefined
    }

    return {
      etag: '',
      lastModified: '',
      feedTitle: title || this.targetUrl,
      siteUrl,
      imageUrl,
      description,
      entries: [],
    }
  }

  private displayFeedState(
    title: string,
    imageUrl: string,
    description: string,
    feedUrl: string,
    siteUrl: string,
  ): DisplayFeedState {
    const displayTitle = resolveSocialFeedDisplayTitle(title, feedUrl, siteUrl)
    return {
      title: displayTitle,
      imageUrl: resolveSocialFeedDisplayImageUrl(imageUrl, feedUrl, siteUrl, displayTitle),
      description: resolveSocialFeedDisplayDescription(description, feedUrl, siteUrl),
    }
  }

  private normalizedPreviewPayload(payload: FeedRefreshPayload, fallbackUrl: string): FeedRefreshPayload {
    const displayFeed = this.displayFeedState(
      payload.feedTitle,
      payload.imageUrl || '',
      payload.description || '',
      payload.resolvedFeedUrl || fallbackUrl,
      payload.siteUrl || '',
    )

    return {
      etag: payload.etag,
      lastModified: payload.lastModified,
      feedTitle: displayFeed.title,
      siteUrl: payload.siteUrl || '',
      imageUrl: displayFeed.imageUrl,
      description: displayFeed.description,
      resolvedFeedUrl: payload.resolvedFeedUrl,
      entries: payload.entries,
    }
  }

  private preferredDisplayImageUrl(primaryImageUrl: string, fallbackImageUrl: string): string {
    const incoming = (primaryImageUrl || '').trim()
    const existing = (fallbackImageUrl || '').trim()
    return resolvePreferredStoredFeedImageUrl(existing, incoming)
  }

  private async hydrateSubscribedAvatar(feed: Feed, currentImageUrl: string): Promise<void> {
    const resolvedAvatar = await SocialFeedAvatarService.resolveFeedAvatar(
      feed.url,
      feed.siteUrl || '',
      currentImageUrl,
      feed.imageUrl || '',
    )
    if (!resolvedAvatar || resolvedAvatar === this.targetImageUrl) {
      return
    }

    this.targetImageUrl = resolvedAvatar
    await AppRepository.updateFeed(feed.id, {
      title: feed.title,
      url: feed.url,
      siteUrl: feed.siteUrl || '',
      imageUrl: resolvedAvatar,
      description: feed.description || '',
      category: feed.category || '',
      view: feed.view,
      showInAll: feed.showInAll,
    })
    this.signalFeedsChanged()
    if (this.previewPayload) {
      this.applyPreviewPayload({
        etag: this.previewPayload.etag,
        lastModified: this.previewPayload.lastModified,
        feedTitle: this.previewPayload.feedTitle,
        siteUrl: this.previewPayload.siteUrl,
        imageUrl: resolvedAvatar,
        description: this.previewPayload.description,
        resolvedFeedUrl: this.previewPayload.resolvedFeedUrl,
        entries: this.previewPayload.entries,
      })
    }
    this.resetHeroAvatarCandidates()
  }

  private async hydratePreviewAvatar(feedUrl: string, siteUrl: string, currentImageUrl: string): Promise<void> {
    const resolvedAvatar = await SocialFeedAvatarService.resolveFeedAvatar(
      feedUrl,
      siteUrl,
      currentImageUrl,
      this.targetImageUrl,
    )
    if (!resolvedAvatar) {
      return
    }

    const preferred = this.preferredDisplayImageUrl(resolvedAvatar, this.targetImageUrl)
    if (!preferred || preferred === this.targetImageUrl) {
      return
    }

    this.targetImageUrl = preferred
    if (this.previewPayload) {
      this.applyPreviewPayload({
        etag: this.previewPayload.etag,
        lastModified: this.previewPayload.lastModified,
        feedTitle: this.previewPayload.feedTitle,
        siteUrl: this.previewPayload.siteUrl,
        imageUrl: preferred,
        description: this.previewPayload.description,
        resolvedFeedUrl: this.previewPayload.resolvedFeedUrl,
        entries: this.previewPayload.entries,
      })
    }
    this.resetHeroAvatarCandidates()
  }

  private latestPublishedAt(entries: Entry[]): number {
    let latest = 0
    entries.forEach((entry: Entry) => {
      latest = Math.max(latest, entry.publishedAt || 0)
    })
    return latest
  }

  private oldestPublishedAt(entries: Entry[]): number {
    let oldest = 0
    entries.forEach((entry: Entry) => {
      const publishedAt = entry.publishedAt || 0
      if (publishedAt <= 0) {
        return
      }
      if (oldest <= 0 || publishedAt < oldest) {
        oldest = publishedAt
      }
    })
    return oldest
  }

  private preferredPreviewEntries(localEntries: Entry[], cachedEntries: Entry[]): Entry[] {
    if (localEntries.length === 0) {
      return cachedEntries
    }
    if (cachedEntries.length === 0) {
      return localEntries
    }

    const localLatest = this.latestPublishedAt(localEntries)
    const cachedLatest = this.latestPublishedAt(cachedEntries)
    if (cachedLatest > localLatest) {
      return cachedEntries
    }

    return localEntries
  }

  private shouldReseedFromCachedPreview(localEntries: Entry[], cachedPayload: FeedRefreshPayload | undefined): boolean {
    if (!cachedPayload || (cachedPayload.entries?.length ?? 0) === 0) {
      return false
    }

    const cachedEntries = cachedPayload.entries
    if (localEntries.length === 0) {
      return true
    }

    const localLatest = this.latestPublishedAt(localEntries)
    const cachedLatest = this.latestPublishedAt(cachedEntries)
    if (cachedLatest > localLatest) {
      return true
    }

    const localOldest = this.oldestPublishedAt(localEntries)
    const cachedOldest = this.oldestPublishedAt(cachedEntries)
    const cachedHasEarlierHistory = cachedOldest > 0 && (localOldest <= 0 || cachedOldest < localOldest)
    const cachedHasMoreEntries = cachedEntries.length > localEntries.length
    const cachedIsNotStalerThanLocal = cachedLatest >= localLatest
    return cachedHasEarlierHistory && cachedHasMoreEntries && cachedIsNotStalerThanLocal
  }

  private async reseedSubscribedFeedFromCachedPreview(feedId: string, payload: FeedRefreshPayload): Promise<Entry[]> {
    await AppRepository.seedFeedFromPreview(feedId, payload)
    this.signalFeedsChanged()
    return AppRepository.entryEntitiesByFeed(feedId)
  }

  private signalFeedsChanged(): void {
    bumpFeedsChangedSignal()
  }

  private normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, '').toLowerCase()
  }

  private resolvedPreviewTargetUrl(): string {
    return canonicalInstagramFeedUrl(this.targetUrl, this.targetSiteUrl) || this.targetUrl
  }

  private feedMatchesTarget(feed: Feed, targetUrl: string, siteUrl: string): boolean {
    const normalizedTarget = this.normalizeUrl(targetUrl)
    const normalizedSite = this.normalizeUrl(siteUrl)
    return this.normalizeUrl(feed.url) === normalizedTarget
      || (!!feed.siteUrl && this.normalizeUrl(feed.siteUrl) === normalizedTarget)
      || (!!siteUrl && this.normalizeUrl(feed.url) === normalizedSite)
      || (!!feed.siteUrl && !!siteUrl && this.normalizeUrl(feed.siteUrl) === normalizedSite)
  }

  private async findExistingFeed(targetUrl: string, siteUrl: string): Promise<Feed | undefined> {
    const feeds = await AppRepository.feedEntities()
    return feeds.find((feed: Feed) => this.feedMatchesTarget(feed, targetUrl, siteUrl))
  }

  private hostOf(value: string): string {
    const matched = value.match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private dedupeUrls(urls: string[]): string[] {
    const result: string[] = []
    urls.forEach((url: string) => {
      const trimmed = url.trim()
      if (trimmed && !result.includes(trimmed)) {
        result.push(trimmed)
      }
    })
    return result
  }

  private buildHeroAvatarCandidates(): string[] {
    const candidates: string[] = []
    const pushCandidate = (value: string): void => {
      const trimmed = value.trim()
      if (!trimmed) {
        return
      }
      candidates.push(trimmed)
    }

    pushCandidate(this.previewPayload?.imageUrl || '')
    pushCandidate(this.targetImageUrl)

    const instagramUsername = extractInstagramUsername(this.previewPayload?.resolvedFeedUrl || '')
      || extractInstagramUsername(this.existingFeed?.url || '')
      || extractInstagramUsername(this.previewPayload?.siteUrl || '')
      || extractInstagramUsername(this.existingFeed?.siteUrl || '')
      || extractInstagramUsername(this.targetSiteUrl || this.targetUrl)
      || extractInstagramUsername(this.previewPayload?.feedTitle || this.targetTitle)
    if (instagramUsername) {
      pushCandidate(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`)
      pushCandidate(`https://unavatar.io/${encodeURIComponent(`instagram.com/${instagramUsername}`)}?fallback=false`)
    }

    const host = this.hostOf(this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl)
    if (host) {
      pushCandidate(`https://${host}/favicon.ico`)
    }

    return this.dedupeUrls(candidates)
  }

  private resetHeroAvatarCandidates(): void {
    this.heroAvatarCandidates = this.buildHeroAvatarCandidates()
    this.heroAvatarIndex = 0
  }

  private currentHeroAvatarUrl(): string {
    return this.heroAvatarCandidates[this.heroAvatarIndex] ?? ''
  }

  private advanceHeroAvatar(): void {
    if (this.heroAvatarIndex + 1 < this.heroAvatarCandidates.length) {
      this.heroAvatarIndex += 1
    } else {
      this.heroAvatarIndex = this.heroAvatarCandidates.length
    }
  }

  private avatarFallback(): string {
    const title = this.resolvedFeedDisplayTitle().trim()
    return title ? title.substring(0, 1).toUpperCase() : '?'
  }

  private extractYouTubeVideoId(value: string): string {
    const matched = (value || '').match(
      /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    )
    return matched?.[1] ?? ''
  }

  private extractBilibiliVideoToken(value: string): string {
    const bvid = (value || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1]
    if (bvid) {
      return `BV:${bvid}`
    }

    const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
    if (aid) {
      return `AV:${aid}`
    }

    return ''
  }

  private normalizeVideoUrl(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }

    if (isDirectVideoUrl(trimmed)) {
      return trimmed
    }

    const youTubeId = this.extractYouTubeVideoId(trimmed)
    if (youTubeId) {
      return `https://www.youtube.com/watch?v=${youTubeId}`
    }

    const bilibiliToken = this.extractBilibiliVideoToken(trimmed)
    if (bilibiliToken.startsWith('BV:')) {
      return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`
    }
    if (bilibiliToken.startsWith('AV:')) {
      return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`
    }

    return ''
  }

  private entryVideoUrl(entry: Entry): string {
    const directMediaUrl = (entry.mediaUrls ?? []).find((url: string) => isDirectVideoUrl(url))
    if (directMediaUrl) {
      return directMediaUrl
    }

    const candidates: string[] = [entry.url, entry.content, entry.summary]
    for (const candidate of candidates) {
      const normalized = this.normalizeVideoUrl(candidate || '')
      if (normalized) {
        return normalized
      }
    }

    const rawContent = `${entry.content || ''}\n${entry.summary || ''}`
    const matched = rawContent.match(
      /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/i,
    )?.[0] ?? ''
    if (!matched) {
      return ''
    }
    return this.normalizeVideoUrl(matched.startsWith('http') ? matched : `https://${matched}`)
  }

  private entryVideoPreviewUrl(entry: Entry): string {
    const videoUrl = this.entryVideoUrl(entry)
    const cached = this.videoPreviewCache.find((item: VideoPreviewCacheItem) => item.videoUrl === videoUrl)
    if (cached?.previewUrl) {
      return cached.previewUrl
    }
    const youTubeId = this.extractYouTubeVideoId(videoUrl)
    if (youTubeId) {
      return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`
    }
    return ''
  }

  private entryVideoSourceLabel(entry: Entry): string {
    const lower = this.entryVideoUrl(entry).toLowerCase()
    if (isDirectVideoUrl(lower)) {
      return '直链'
    }
    if (lower.includes('youtube.com')) {
      return 'YouTube'
    }
    if (lower.includes('bilibili.com')) {
      return 'Bilibili'
    }
    return ''
  }

  private async hydrateVideoPreviews(entries: Entry[]): Promise<void> {
    for (const entry of entries) {
      const videoUrl = this.entryVideoUrl(entry)
      if (!videoUrl || this.entryVideoPreviewUrl(entry)) {
        continue
      }

      const previewUrl = await this.fetchBilibiliVideoPreviewUrl(videoUrl)
      if (!previewUrl) {
        continue
      }

      const existingIndex = this.videoPreviewCache.findIndex((item: VideoPreviewCacheItem) => item.videoUrl === videoUrl)
      const nextCache = [...this.videoPreviewCache]
      const item: VideoPreviewCacheItem = { videoUrl, previewUrl }
      if (existingIndex >= 0) {
        nextCache[existingIndex] = item
      } else {
        nextCache.push(item)
      }
      this.videoPreviewCache = nextCache
    }
  }

  private async fetchBilibiliVideoPreviewUrl(videoUrl: string): Promise<string> {
    if (!videoUrl.toLowerCase().includes('bilibili.com')) {
      return ''
    }

    const bvid = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1] ?? ''
    if (!bvid) {
      return ''
    }

    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: 5000,
          readTimeout: 5000,
          header: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://www.bilibili.com/video/${bvid}`,
            'Origin': 'https://www.bilibili.com',
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const payload = JSON.parse(String(response.result)) as Record<string, Object | string | number>
      const data = payload['data'] as Record<string, string> | undefined
      return typeof data?.['pic'] === 'string' ? data['pic'] : ''
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }

  private heroDescription(): string {
    return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl
  }

  private previewEntries(): Entry[] {
    return this.resolvedPreviewEntries
  }

  private previewEntryCount(): number {
    return this.resolvedPreviewEntries.length
  }

  private previewEntryStableKey(entry: Entry): string {
    const id = (entry.id || '').trim()
    if (id) {
      return id
    }

    return `${entry.feedId}|${entry.publishedAt}|${entry.url}`
  }

  private normalizePreviewText(value: string): string {
    return (value || '')
      .trim()
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }

  private dedupePicturePreviewEntries(entries: Entry[]): Entry[] {
    const deduped = new Map<string, Entry>()

    entries.forEach((entry: Entry) => {
      const galleryUrls = this.entryGalleryUrls(entry)
      const leadImageUrl = galleryUrls[0] || this.entryPictureUrl(entry)
      const normalizedTitle = this.normalizePreviewText(entry.title || this.galleryCaption(entry))
      const normalizedAuthor = this.normalizePreviewText(entry.author)
      const publishedBucket = Math.floor((entry.publishedAt || 0) / (60 * 1000))
      const key = `${normalizedAuthor}|${publishedBucket}|${normalizedTitle}|${leadImageUrl}`
      const existing = deduped.get(key)

      if (!existing) {
        deduped.set(key, entry)
        return
      }

      const existingGalleryCount = this.entryGalleryUrls(existing).length
      const incomingGalleryCount = galleryUrls.length
      const keepIncoming = incomingGalleryCount > existingGalleryCount
        || (incomingGalleryCount === existingGalleryCount && (entry.publishedAt || 0) >= (existing.publishedAt || 0))

      if (keepIncoming) {
        deduped.set(key, entry)
      }
    })

    return Array.from(deduped.values()).sort((left: Entry, right: Entry) => (right.publishedAt || 0) - (left.publishedAt || 0))
  }

  private isPicturesPreview(): boolean {
    const currentView = this.existingFeed?.view ?? this.targetView
    return currentView === FeedViewType.Pictures
  }

  private isXUrl(value: string): boolean {
    const normalized = (value || '').toLowerCase()
    return normalized.includes('x.com/') || normalized.includes('twitter.com/')
      || normalized.includes('/x/user/') || normalized.includes('/twitter/user/')
  }

  private isXPreview(): boolean {
    return this.isXUrl(this.existingFeed?.url || '')
      || this.isXUrl(this.existingFeed?.siteUrl || '')
      || this.isXUrl(this.targetUrl)
      || this.isXUrl(this.targetSiteUrl)
      || this.isXUrl(this.previewPayload?.siteUrl || '')
  }

  private tweetPresentation(entry: Entry): TweetEntryPresentation {
    return presentTweetEntryFromEntry(entry, this.resolvedAvatarUrl())
  }

  private cachedTweetPresentation(entry: Entry): TweetEntryPresentation {
    const cacheKey = this.entryVersionCacheKey(entry)
    const currentAvatarUrl = this.resolvedAvatarUrl()
    const cached = this.tweetPresentationCache.get(cacheKey)
    if (cached) {
      if (cached.avatarUrl === currentAvatarUrl) {
        return cached
      }

      const withAvatar = this.tweetPresentationWithAvatar(cached, currentAvatarUrl)
      this.tweetPresentationCache.set(cacheKey, withAvatar)
      return withAvatar
    }

    const generated = this.tweetPresentation(entry)
    this.tweetPresentationCache.set(cacheKey, generated)
    return generated
  }

  private entryPictureUrl(entry: Entry): string {
    return resolveEntryCardImageUrl({
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      articleUrl: entry.url,
      siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl,
      mediaUrls: entry.mediaUrls ?? [],
    })
  }

  private entryGalleryUrls(entry: Entry): string[] {
    return extractEntryGalleryImageUrls({
      summary: entry.summary,
      content: entry.content,
      articleUrl: entry.url,
      siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl,
      mediaUrls: entry.mediaUrls ?? [],
    })
  }

  private hasEntryPicture(entry: Entry): boolean {
    return this.entryGalleryUrls(entry).length > 0 || !!this.entryPictureUrl(entry)
  }

  private galleryCaption(entry: Entry): string {
    const title = (entry.title || '').trim()
    if (title && title !== '远程条目') {
      return title
    }
    return (entry.summary || '').trim()
  }

  private picturePreviewLeadUrl(entry: Entry): string {
    const cacheKey = this.entryVersionCacheKey(entry)
    const cached = this.picturePreviewLeadUrlCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const resolved = this.resolvePicturePreviewLeadUrl(entry)
    this.picturePreviewLeadUrlCache.set(cacheKey, resolved)
    return resolved
  }

  @Builder
  private PicturePreviewEntryCard(entry: Entry, index: number) {
    Column({ space: 10 }) {
      if (this.picturePreviewLeadUrl(entry)) {
        Image(this.picturePreviewLeadUrl(entry))
          .width('100%')
          .height(220)
          .objectFit(ImageFit.Cover)
          .borderRadius(16)
          .backgroundColor(this.theme.elevated)
      }

      Row({ space: 8 }) {
        Text(entry.author || this.heroTitle() || '未知作者')
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(11)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(entry.publishedAt))
          .fontSize(11)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(this.galleryCaption(entry) || entry.title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(22)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (entry.summary) {
        Text(entry.summary)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .alignItems(HorizontalAlign.Start)
    .transition(this.shouldEnablePreviewItemTransition() ? livoMotion.enterSoft(index * 18 + 40) : TransitionEffect.IDENTITY)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpenArticle(entry, this.articleDetailFeed(entry))
    })
  }

  private pictureCardEntry(entry: Entry): Entry {
    return {
      id: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      url: entry.url,
      summary: entry.summary,
      content: entry.content,
      author: entry.author,
      publishedAt: entry.publishedAt,
      readingTimeMinutes: entry.readingTimeMinutes,
      tags: entry.tags,
      mediaUrls: extractPictureCarouselMediaUrls({
        summary: entry.summary,
        content: entry.content,
        articleUrl: entry.url,
        siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl,
        mediaUrls: entry.mediaUrls ?? [],
      }),
      isRead: entry.isRead,
      isStarred: entry.isStarred,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }
  }

  private articleDetailFeed(entry: Entry): Feed {
    if (this.existingFeed) {
      return this.existingFeed
    }

    return {
      id: entry.feedId || this.feedId || 'preview',
      title: this.resolvedFeedDisplayTitle(),
      url: this.targetUrl || entry.url,
      siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || entry.url,
      imageUrl: this.previewPayload?.imageUrl || '',
      description: this.previewPayload?.description || this.targetDescription || '',
      category: this.targetCategory || '未分类',
      view: this.targetView,
      showInAll: true,
      errorCount: 0,
      createdAt: 0,
      updatedAt: 0,
    }
  }

  private resolvedAvatarUrl(): string {
    return this.currentHeroAvatarUrl()
  }

  private resolvedFeedDisplayTitle(): string {
    const previewTitle = (this.previewPayload?.feedTitle || '').trim()
    if (previewTitle) {
      return previewTitle
    }

    const targetTitle = (this.targetTitle || '').trim()
    if (targetTitle) {
      return targetTitle
    }

    const existingTitle = (this.existingFeed?.title || '').trim()
    if (existingTitle) {
      return existingTitle
    }

    const siteOrTarget = (
      this.previewPayload?.siteUrl
      || this.targetSiteUrl
      || this.targetUrl
      || this.existingFeed?.siteUrl
      || this.existingFeed?.url
      || ''
    ).trim()

    return this.hostOf(siteOrTarget) || siteOrTarget || '订阅详情'
  }

  private heroTitle(): string {
    return this.resolvedFeedDisplayTitle()
  }

  private heroHostLabel(): string {
    const siteOrTarget = this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl
    return this.hostOf(siteOrTarget) || siteOrTarget
  }

  @Builder
  private FeedAvatar(size: number = 32, radius: number = 10, fontSize: number = 14) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resolvedAvatarUrl()) {
        Image(this.resolvedAvatarUrl())
          .width(size)
          .height(size)
          .borderRadius(radius)
          .backgroundColor(this.theme.elevated)
          .objectFit(ImageFit.Cover)
          .onError(() => {
            this.advanceHeroAvatar()
          })
      } else {
        Row()
          .width(size)
          .height(size)
          .borderRadius(radius)
          .backgroundColor(this.theme.accent)

        Text(this.avatarFallback())
          .fontSize(fontSize)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.heroTitle(),
        theme: this.theme,
        showBackButton: true,
        trailingText: !this.isLoading && this.existingFeed ? '编辑' : '',
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => { this.onBack() },
        onTrailingClick: () => {
          if (this.existingFeed) {
            this.onEdit(this.existingFeed)
          }
        },
      })
        .width('100%')
    }
  }

  @Builder
  private HeroCard() {
    Column({ space: 14 }) {
      this.FeedAvatar(88, 26, 28)

      Column({ space: 6 }) {
        Text(this.heroTitle())
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
          .maxLines(2)
          .textAlign(TextAlign.Center)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 24 })
    .backgroundColor(this.theme.surface)
    .borderRadius(28)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  private DescriptionCard() {
    if (this.heroDescription()) {
      Column({ space: 8 }) {
        Text('简介')
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Text(this.heroDescription())
          .fontSize(14)
          .lineHeight(22)
          .fontColor(this.theme.textSecondary)
      }
      .width('100%')
      .padding(16)
      .backgroundColor(this.theme.surface)
      .borderRadius(20)
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  private NoticeCard() {
    if (this.previewNotice) {
      Row({ space: 10 }) {
        Text('预览说明')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.accent)

        Text(this.previewNotice)
          .layoutWeight(1)
          .fontSize(12)
          .lineHeight(18)
          .fontColor(this.theme.textSecondary)
      }
      .width('100%')
      .padding(14)
      .backgroundColor(this.theme.surface)
      .borderRadius(18)
      .border({ width: 0.8, color: this.theme.divider })
    }
  }

  @Builder
  private EntryCard(entry: Entry, index: number) {
    Column({ space: 8 }) {
      if (this.entryVideoPreviewUrl(entry)) {
        Stack({ alignContent: Alignment.TopStart }) {
          Image(this.entryVideoPreviewUrl(entry))
            .width('100%')
            .height(172)
            .objectFit(ImageFit.Cover)
            .borderRadius(16)

          Text(this.entryVideoSourceLabel(entry) || '视频')
            .fontSize(11)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
            .padding({ left: 10, right: 10, top: 6, bottom: 6 })
            .backgroundColor('rgba(17,24,39,0.72)')
            .borderRadius(999)
            .margin({ left: 12, top: 12 })
        }
        .width('100%')
        .clip(true)
      }

      Row({ space: 8 }) {
        Text(entry.author || '未知作者')
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(11)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(entry.publishedAt))
          .fontSize(11)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(entry.title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
        .lineHeight(22)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (entry.summary) {
        Text(entry.summary)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      if (this.entryVideoSourceLabel(entry)) {
        Text(`${this.entryVideoSourceLabel(entry)} 视频源`)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.accent)
      }
    }
    .width('100%')
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
    .alignItems(HorizontalAlign.Start)
    .transition(this.shouldEnablePreviewItemTransition() ? livoMotion.enterSoft(index * 18 + 40) : TransitionEffect.IDENTITY)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.onOpenArticle(entry, this.articleDetailFeed(entry))
    })
  }

  @Builder
  private PreviewSectionHeader() {
    Row() {
      Text('内容预览')
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Blank()

      Text(`${this.previewEntryCount()} 条`)
        .fontSize(12)
        .fontColor(this.theme.textMuted)
    }
    .width('100%')
  }

  @Builder
  private PicturePreviewEmptyStateCard() {
    Column({ space: 8 }) {
      Text('图片流预览暂不可用')
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Text('这个订阅源已识别为图片类来源。当前先展示订阅源信息，订阅后会在“图片”栏目按图片卡片方式展示。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private PreviewEntryListItem(entry: Entry, index: number) {
    if (this.isPicturesPreview()) {
      this.PicturePreviewEntryCard(entry, index)
    } else if (this.isXPreview()) {
      TweetEntryCard({
        presentation: this.cachedTweetPresentation(entry),
        theme: this.theme,
        isUnread: !entry.isRead,
        flatMode: true,
        showBottomDivider: index < this.previewEntryCount() - 1,
        collapsedTextLines: X_PREVIEW_COLLAPSED_TEXT_LINES,
        enableEnterTransition: false,
        onOpen: () => {
          this.onOpenArticle(entry, this.articleDetailFeed(entry))
        },
      })
    } else {
      this.EntryCard(entry, index)
    }
  }

  build() {
    Column({ space: 0 }) {
      this.HeaderSection()

      if (this.previewError) {
        Column({ space: 16 }) {
          Text('预览失败')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
          
          Text(this.previewError)
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
            .textAlign(TextAlign.Center)
            .padding({ left: 32, right: 32 })
            
          Button('重试')
            .onClick(() => { void this.loadData() })
            .backgroundColor(this.theme.accent)
            .fontColor('#FFFFFF')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.previewPayload) {
        Stack({ alignContent: Alignment.TopStart }) {
          Refresh({ refreshing: $$this.isRefreshing }) {
            List({ space: 12 }) {
              ListItem() {
                this.HeroCard()
              }
              .width('100%')

              if (this.heroDescription()) {
                ListItem() {
                  this.DescriptionCard()
                }
                .width('100%')
              }

              if (this.previewNotice) {
                ListItem() {
                  this.NoticeCard()
                }
                .width('100%')
              }

              ListItem() {
                this.PreviewSectionHeader()
              }
              .width('100%')

              if (this.previewEntryCount() > 0) {
                LazyForEach(this.previewEntryDataSource, (entry: Entry, index: number) => {
                  ListItem() {
                    this.PreviewEntryListItem(entry, index)
                  }
                  .width('100%')
                }, (entry: Entry) => this.previewEntryStableKey(entry))
              } else if (this.isPicturesPreview()) {
                ListItem() {
                  this.PicturePreviewEmptyStateCard()
                }
                .width('100%')
              }

              ListItem() {
                Row().height(100).width('100%')
              }
            }
            .width('100%')
            .height('100%')
            .padding({ left: 18, right: 18, top: 0, bottom: 24 })
            .scrollBar(BarState.Off)
            .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
          }
          .onRefreshing(() => { this.triggerRefreshData() })

          if (this.previewPayload && !this.existingFeed) {
            Row() {
              Button('订阅')
                .type(ButtonType.Capsule)
                .width('80%')
                .height(50)
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .backgroundColor(this.theme.accent)
                .fontColor('#FFFFFF')
                .shadow({ radius: 20, color: 'rgba(0,0,0,0.15)', offsetY: 8 })
                .onClick(() => {
                  this.onSubscribe(this.previewPayload!)
                })
            }
            .width('100%')
            .justifyContent(FlexAlign.Center)
            .padding({ bottom: 24 })
            .position({ x: 0, y: '100%' })
            .markAnchor({ x: 0, y: '100%' })
            .transition(TransitionEffect.move(TransitionEdge.BOTTOM).combine(TransitionEffect.OPACITY))
          }
        }
        .width('100%')
        .layoutWeight(1)
      } else if (this.isLoading) {
        Column({ space: 12 }) {
          LoadingProgress().width(42).height(42).color(this.theme.accent)
          Text('正在加载预览...')
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        Column({ space: 12 }) {
          LoadingProgress().width(42).height(42).color(this.theme.accent)
          Text('正在初始化预览...')
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
