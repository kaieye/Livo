import { AppRepository } from '../data/AppRepository'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { Entry, Feed, FeedViewType } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { AppPreferenceService } from '../services/AppPreferenceService'
import { isDiscoverAvatarCacheableImageUrl } from '../utils/DiscoverAvatarPresentation'
import { resolveEntryCardImageUrl } from '../utils/EntryCardPreview'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { FeedDetailVideoPreviewService } from '../services/FeedDetailVideoPreviewService'
import {
  extractEntryGalleryImageUrls,
  shouldUseCachedPicturePreview,
} from '../utils/PictureGallery'
import { canonicalInstagramFeedUrl, extractInstagramUsername } from '../utils/SocialFeedTitles'
import {
  resolvePreferredStoredFeedImageUrl,
} from '../utils/SocialFeedPresentation'
import {
  FeedDetailDisplayFeedState,
  feedDetailHostOf,
  feedDetailMatchesTarget,
  latestFeedDetailEntryPublishedAt,
  normalizeFeedDetailPreviewPayload,
  resolveFeedDetailDisplayState,
  resolveFeedDetailPreferredDisplayImageUrl,
  resolvePreferredFeedDetailPreviewEntries,
  shouldReseedFeedDetailFromCachedPreview,
} from '../utils/FeedDetailPreviewPolicy'
import {
  FeedDetailVideoPreviewCacheItem,
  resolveFeedDetailEntryVideoUrl,
  resolveFeedDetailVideoSourceLabel,
  resolveStaticFeedDetailVideoPreviewUrl,
} from '../utils/FeedDetailVideoPreview'
import { presentTweetEntryFromEntry, TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import { TweetEntryCard } from './TweetEntryCard'
import {
  FeedDetailDescriptionCard,
  FeedDetailHeroCard,
  FeedDetailNoticeCard,
  FeedDetailPicturePreviewEmptyStateCard,
  FeedDetailPicturePreviewEntryCard,
  FeedDetailPreviewEntryCard,
  FeedDetailPreviewSectionHeader,
} from './FeedDetailPreviewCards'

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
  @State private videoPreviewCache: FeedDetailVideoPreviewCacheItem[] = []
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
          // targetImageUrl 保持 displayFeed.imageUrl（经过平台处理），与列表页 iconSource 保持一致
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
          // targetImageUrl 保持 displayFeed.imageUrl，与列表页 iconSource 保持一致
          this.targetImageUrl = displayFeed.imageUrl
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
    this.rememberPreviewAvatar(payload)
    this.resolvedPreviewEntries = this.resolvePreviewEntries(payload)
    this.reconcilePicturePreviewLeadUrlCache()
    this.previewEntryDataSource.notifyDataReloaded()
    this.reconcileTweetPresentationCache()
  }

  private rememberPreviewAvatar(payload: FeedRefreshPayload | undefined): void {
    const imageUrl = (payload?.imageUrl || '').trim()
    if (!isDiscoverAvatarCacheableImageUrl(imageUrl)) {
      return
    }

    const targetUrl = (payload?.resolvedFeedUrl || this.targetUrl || this.existingFeed?.url || '').trim()
    if (!targetUrl) {
      return
    }

    void AppPreferenceService.rememberDiscoverAvatar(
      targetUrl,
      payload?.siteUrl || this.targetSiteUrl || this.existingFeed?.siteUrl || '',
      imageUrl,
    )
    void AppPreferenceService.rememberDiscoverAvatar(targetUrl, '', imageUrl)
    if (this.targetUrl && this.targetUrl !== targetUrl) {
      void AppPreferenceService.rememberDiscoverAvatar(
        this.targetUrl,
        payload?.siteUrl || this.targetSiteUrl || this.existingFeed?.siteUrl || '',
        imageUrl,
      )
      void AppPreferenceService.rememberDiscoverAvatar(this.targetUrl, '', imageUrl)
    }
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
  ): FeedDetailDisplayFeedState {
    return resolveFeedDetailDisplayState(title, imageUrl, description, feedUrl, siteUrl)
  }

  private normalizedPreviewPayload(payload: FeedRefreshPayload, fallbackUrl: string): FeedRefreshPayload {
    return normalizeFeedDetailPreviewPayload(payload, fallbackUrl)
  }

  private preferredDisplayImageUrl(primaryImageUrl: string, fallbackImageUrl: string): string {
    return resolveFeedDetailPreferredDisplayImageUrl(primaryImageUrl, fallbackImageUrl)
  }

  private async hydrateSubscribedAvatar(feed: Feed, currentImageUrl: string): Promise<void> {
    const resolvedAvatar = (await SocialFeedAvatarService.resolveFeedAvatar(
      feed.url,
      feed.siteUrl || '',
      currentImageUrl,
      feed.imageUrl || '',
    ) || '').trim()
    if (!resolvedAvatar) {
      return
    }

    // 以持久化值为准进行比较，避免“详情页已显示新头像，但数据库未更新”导致返回列表仍是旧头像。
    const currentStoredImageUrl = (feed.imageUrl || '').trim()
    const nextStoredImageUrl = resolvePreferredStoredFeedImageUrl(currentStoredImageUrl, resolvedAvatar)
    if (!nextStoredImageUrl) {
      return
    }

    const shouldPersist = nextStoredImageUrl !== currentStoredImageUrl
    const shouldUpdateDetailState = nextStoredImageUrl !== this.targetImageUrl
    if (!shouldPersist && !shouldUpdateDetailState) {
      return
    }

    if (shouldUpdateDetailState) {
      this.targetImageUrl = nextStoredImageUrl
    }
    if (shouldPersist) {
      await AppRepository.updateFeed(feed.id, {
        title: feed.title,
        url: feed.url,
        siteUrl: feed.siteUrl || '',
        imageUrl: nextStoredImageUrl,
        description: feed.description || '',
        category: feed.category || '',
        view: feed.view,
        showInAll: feed.showInAll,
      })
      this.signalFeedsChanged()
    }
    if (this.previewPayload) {
      this.applyPreviewPayload({
        etag: this.previewPayload.etag,
        lastModified: this.previewPayload.lastModified,
        feedTitle: this.previewPayload.feedTitle,
        siteUrl: this.previewPayload.siteUrl,
        imageUrl: nextStoredImageUrl,
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
    void AppPreferenceService.rememberDiscoverAvatar(feedUrl, siteUrl, preferred)
    void AppPreferenceService.rememberDiscoverAvatar(feedUrl, '', preferred)
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
    return latestFeedDetailEntryPublishedAt(entries)
  }

  private preferredPreviewEntries(localEntries: Entry[], cachedEntries: Entry[]): Entry[] {
    return resolvePreferredFeedDetailPreviewEntries(localEntries, cachedEntries)
  }

  private shouldReseedFromCachedPreview(localEntries: Entry[], cachedPayload: FeedRefreshPayload | undefined): boolean {
    return shouldReseedFeedDetailFromCachedPreview(localEntries, cachedPayload)
  }

  private async reseedSubscribedFeedFromCachedPreview(feedId: string, payload: FeedRefreshPayload): Promise<Entry[]> {
    await AppRepository.seedFeedFromPreview(feedId, payload)
    this.signalFeedsChanged()
    return AppRepository.entryEntitiesByFeed(feedId)
  }

  private signalFeedsChanged(): void {
    bumpFeedsChangedSignal()
  }

  private resolvedPreviewTargetUrl(): string {
    return canonicalInstagramFeedUrl(this.targetUrl, this.targetSiteUrl) || this.targetUrl
  }

  private feedMatchesTarget(feed: Feed, targetUrl: string, siteUrl: string): boolean {
    return feedDetailMatchesTarget(feed, targetUrl, siteUrl)
  }

  private async findExistingFeed(targetUrl: string, siteUrl: string): Promise<Feed | undefined> {
    const feeds = await AppRepository.feedEntities()
    return feeds.find((feed: Feed) => this.feedMatchesTarget(feed, targetUrl, siteUrl))
  }

  private hostOf(value: string): string {
    return feedDetailHostOf(value)
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

    // targetImageUrl 经过 resolveSocialFeedDisplayImageUrl 处理，与列表页 iconSource 逻辑一致，优先使用
    pushCandidate(this.targetImageUrl)
    pushCandidate(this.previewPayload?.imageUrl || '')

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

  private rememberCurrentPreviewAvatar(imageUrl: string): void {
    const normalizedImageUrl = (imageUrl || '').trim()
    if (!isDiscoverAvatarCacheableImageUrl(normalizedImageUrl)) {
      return
    }

    const targetUrl = (this.previewPayload?.resolvedFeedUrl || this.targetUrl || this.existingFeed?.url || '').trim()
    if (targetUrl) {
      void AppPreferenceService.rememberDiscoverAvatar(
        targetUrl,
        this.previewPayload?.siteUrl || this.targetSiteUrl || this.existingFeed?.siteUrl || '',
        normalizedImageUrl,
      )
      void AppPreferenceService.rememberDiscoverAvatar(targetUrl, '', normalizedImageUrl)
    }

    if (this.targetUrl && this.targetUrl !== targetUrl) {
      void AppPreferenceService.rememberDiscoverAvatar(
        this.targetUrl,
        this.previewPayload?.siteUrl || this.targetSiteUrl || this.existingFeed?.siteUrl || '',
        normalizedImageUrl,
      )
      void AppPreferenceService.rememberDiscoverAvatar(this.targetUrl, '', normalizedImageUrl)
    }
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

  private entryVideoUrl(entry: Entry): string {
    return resolveFeedDetailEntryVideoUrl(entry)
  }

  private entryVideoPreviewUrl(entry: Entry): string {
    const videoUrl = this.entryVideoUrl(entry)
    const cached = this.videoPreviewCache.find((item: FeedDetailVideoPreviewCacheItem) => item.videoUrl === videoUrl)
    if (cached?.previewUrl) {
      return cached.previewUrl
    }
    return resolveStaticFeedDetailVideoPreviewUrl(videoUrl)
  }

  private entryVideoSourceLabel(entry: Entry): string {
    return resolveFeedDetailVideoSourceLabel(this.entryVideoUrl(entry))
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

      const existingIndex = this.videoPreviewCache.findIndex((item: FeedDetailVideoPreviewCacheItem) => item.videoUrl === videoUrl)
      const nextCache = [...this.videoPreviewCache]
      const item: FeedDetailVideoPreviewCacheItem = { videoUrl, previewUrl }
      if (existingIndex >= 0) {
        nextCache[existingIndex] = item
      } else {
        nextCache.push(item)
      }
      this.videoPreviewCache = nextCache
    }
  }

  private async fetchBilibiliVideoPreviewUrl(videoUrl: string): Promise<string> {
    return FeedDetailVideoPreviewService.fetchBilibiliPreviewUrl(videoUrl)
  }

  private heroDescription(): string {
    return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl
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
    FeedDetailPicturePreviewEntryCard({
      entry,
      index,
      leadImageUrl: this.picturePreviewLeadUrl(entry),
      authorLabel: this.heroTitle(),
      caption: this.galleryCaption(entry),
      enableTransition: this.shouldEnablePreviewItemTransition(),
      theme: this.theme,
      onOpen: () => {
        this.onOpenArticle(entry, this.articleDetailFeed(entry))
      },
    })
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
    FeedDetailHeroCard({
      title: this.heroTitle(),
      avatarUrl: this.resolvedAvatarUrl(),
      fallbackLabel: this.avatarFallback(),
      theme: this.theme,
      onAvatarLoaded: (imageUrl: string) => {
        this.rememberCurrentPreviewAvatar(imageUrl)
      },
      onAvatarError: () => {
        this.advanceHeroAvatar()
      },
    })
  }

  @Builder
  private DescriptionCard() {
    if (this.heroDescription()) {
      FeedDetailDescriptionCard({
        description: this.heroDescription(),
        theme: this.theme,
      })
    }
  }

  @Builder
  private NoticeCard() {
    if (this.previewNotice) {
      FeedDetailNoticeCard({
        notice: this.previewNotice,
        theme: this.theme,
      })
    }
  }

  @Builder
  private EntryCard(entry: Entry, index: number) {
    FeedDetailPreviewEntryCard({
      entry,
      index,
      videoPreviewUrl: this.entryVideoPreviewUrl(entry),
      videoSourceLabel: this.entryVideoSourceLabel(entry),
      enableTransition: this.shouldEnablePreviewItemTransition(),
      theme: this.theme,
      onOpen: () => {
        this.onOpenArticle(entry, this.articleDetailFeed(entry))
      },
    })
  }

  @Builder
  private PreviewSectionHeader() {
    FeedDetailPreviewSectionHeader({
      entryCount: this.previewEntryCount(),
      theme: this.theme,
    })
  }

  @Builder
  private PicturePreviewEmptyStateCard() {
    FeedDetailPicturePreviewEmptyStateCard({
      theme: this.theme,
    })
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
