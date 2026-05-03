import { DiscoverBuiltinFeedSeed } from '../data/DiscoverBuiltinFeeds'
import { AppPreferenceService, DiscoverAvatarCacheEntry } from '../services/AppPreferenceService'
import { RecommendedFeed } from '../services/discover/DiscoverTypes'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { RssFeedService } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import {
  discoverAvatarCacheKey,
  discoverAvatarCacheKeys,
  isDiscoverAvatarCacheableImageUrl,
  isDiscoverAvatarPlaceholderUrl,
  resolveDiscoverAvatarImageUrl,
} from '../utils/DiscoverAvatarPresentation'
import { DiscoverBrowseAvatarHydrationTask } from './DiscoverTypes'

export class DiscoverBrowseAvatarHydrator {
  private readonly overrideMap: Map<string, string> = new Map()
  private readonly hydratingKeys: Set<string> = new Set()
  private readonly queue: DiscoverBrowseAvatarHydrationTask[] = []
  private running: boolean = false
  private active: boolean = false
  private persistedLoaded: boolean = false
  private _version: number = 0
  private readonly onVersionChange?: () => void

  constructor(onVersionChange?: () => void) {
    this.onVersionChange = onVersionChange
  }

  get version(): number {
    return this._version
  }

  get isActive(): boolean {
    return this.active
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
    this.queue.length = 0
    this.hydratingKeys.clear()
  }

  getOverride(targetUrl: string, siteUrl: string): string {
    const keys = discoverAvatarCacheKeys(targetUrl, siteUrl)
    for (const key of keys) {
      const value = this.overrideMap.get(key)
      if (value) {
        return value
      }
    }
    return ''
  }

  async loadPersistedCache(): Promise<void> {
    if (this.persistedLoaded) {
      return
    }

    try {
      const entries = await AppPreferenceService.loadDiscoverAvatarCache()
      entries.forEach((entry: DiscoverAvatarCacheEntry) => {
        discoverAvatarCacheKeys(entry.targetUrl, entry.siteUrl).forEach((key: string) => {
          this.overrideMap.set(key, entry.imageUrl)
        })
      })
      this.persistedLoaded = true
      this._version += 1
      this.onVersionChange?.()
    } catch (error) {
      this.persistedLoaded = true
      console.warn(`load discover avatar cache failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  resolveFeedAvatarUrl(feed: RecommendedFeed): string {
    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(feed.url)
      || DiscoverRemoteSearchService.cachedPreviewPayload(feed.siteUrl)
    return resolveDiscoverAvatarImageUrl({
      imageUrl: feed.imageUrl || '',
      targetUrl: feed.url,
      siteUrl: feed.siteUrl,
      title: feed.title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.getOverride(feed.url, feed.siteUrl),
    })
  }

  resolveInsMemberAvatarUrl(member: DiscoverBuiltinFeedSeed): string {
    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(member.url)
    return resolveDiscoverAvatarImageUrl({
      imageUrl: '',
      targetUrl: member.url,
      siteUrl: '',
      title: member.title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.getOverride(member.url, ''),
    })
  }

  needsHydration(imageUrl: string): boolean {
    return isDiscoverAvatarPlaceholderUrl(imageUrl)
  }

  rememberLoaded(targetUrl: string, siteUrl: string, imageUrl: string): void {
    const normalizedImageUrl = (imageUrl || '').trim()
    if (!isDiscoverAvatarCacheableImageUrl(normalizedImageUrl)) {
      return
    }

    discoverAvatarCacheKeys(targetUrl, siteUrl).forEach((key: string) => {
      this.overrideMap.set(key, normalizedImageUrl)
    })
    void AppPreferenceService.rememberDiscoverAvatar(targetUrl, siteUrl, normalizedImageUrl)
    if (siteUrl) {
      void AppPreferenceService.rememberDiscoverAvatar(targetUrl, '', normalizedImageUrl)
    }
  }

  async hydrate(
    title: string,
    targetUrl: string,
    siteUrl: string,
    imageUrl: string,
  ): Promise<void> {
    if (!this.active) {
      return
    }

    const key = discoverAvatarCacheKey(targetUrl, siteUrl)
    if (this.overrideMap.has(key) || this.hydratingKeys.has(key)) {
      return
    }

    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(targetUrl)
      || DiscoverRemoteSearchService.cachedPreviewPayload(siteUrl)
    const currentImageUrl = resolveDiscoverAvatarImageUrl({
      imageUrl,
      targetUrl,
      siteUrl,
      title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.getOverride(targetUrl, siteUrl),
    })
    if (!this.needsHydration(currentImageUrl)) {
      return
    }

    this.hydratingKeys.add(key)
    this.queue.push({
      key,
      title,
      targetUrl,
      siteUrl,
      imageUrl,
      currentImageUrl,
    })
    void this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true
    try {
      while (this.active && this.queue.length > 0) {
        const task = this.queue.shift()
        if (!task) {
          continue
        }
        await this.runTask(task)
      }
    } finally {
      this.running = false
    }
  }

  private async runTask(task: DiscoverBrowseAvatarHydrationTask): Promise<void> {
    try {
      if (!this.active) {
        return
      }

      const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(task.targetUrl)
        || DiscoverRemoteSearchService.cachedPreviewPayload(task.siteUrl)
      const payload = cachedPayload || await RssFeedService.previewFeedUrl(task.targetUrl)
      if (!this.active) {
        return
      }

      const resolvedAvatar = await SocialFeedAvatarService.resolveFeedAvatar(
        payload.resolvedFeedUrl || task.targetUrl,
        payload.siteUrl || task.siteUrl,
        payload.imageUrl || '',
        task.imageUrl || '',
      )
      const hydratedImageUrl = (resolvedAvatar || payload.imageUrl || '').trim()
      if (!hydratedImageUrl) {
        return
      }

      DiscoverRemoteSearchService.rememberPreviewPayload(task.targetUrl, {
        etag: payload.etag,
        lastModified: payload.lastModified,
        feedTitle: payload.feedTitle,
        siteUrl: payload.siteUrl,
        imageUrl: hydratedImageUrl,
        description: payload.description,
        resolvedFeedUrl: payload.resolvedFeedUrl,
        entries: payload.entries,
      })
      void AppPreferenceService.rememberDiscoverAvatar(task.targetUrl, task.siteUrl, hydratedImageUrl)
      if (task.siteUrl) {
        void AppPreferenceService.rememberDiscoverAvatar(task.targetUrl, '', hydratedImageUrl)
      }

      const nextImageUrl = resolveDiscoverAvatarImageUrl({
        imageUrl: task.imageUrl,
        targetUrl: task.targetUrl,
        siteUrl: task.siteUrl,
        title: task.title,
        cachedImageUrl: hydratedImageUrl,
        cachedSiteUrl: payload.siteUrl || '',
        cachedTitle: payload.feedTitle || '',
        cachedResolvedFeedUrl: payload.resolvedFeedUrl || '',
      })
      if (nextImageUrl && nextImageUrl !== task.currentImageUrl) {
        discoverAvatarCacheKeys(task.targetUrl, task.siteUrl).forEach((key: string) => {
          this.overrideMap.set(key, hydratedImageUrl)
        })
        this._version += 1
        this.onVersionChange?.()
      }
    } catch (error) {
      console.warn(`hydrate discover browse avatar failed: ${task.targetUrl} ${error instanceof Error ? error.message : error}`)
    } finally {
      this.hydratingKeys.delete(task.key)
    }
  }
}
