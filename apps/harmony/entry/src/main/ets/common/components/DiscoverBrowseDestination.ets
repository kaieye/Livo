import { builtinDiscoverInsGroups, InsGroupFeed, DiscoverBuiltinFeedSeed, resolveDescription } from '../data/DiscoverBuiltinFeeds'
import { FeedViewType } from '../models/LivoModels'
import { AppPreferenceService, DiscoverAvatarCacheEntry } from '../services/AppPreferenceService'
import { discoverViewLabel, filteredRecommendedFeeds, RecommendedFeed } from '../services/DiscoverService'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import { FeedRefreshPayload, RssFeedService } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  discoverAvatarCacheKey,
  discoverAvatarCacheKeys,
  isDiscoverAvatarCacheableImageUrl,
  isDiscoverAvatarPlaceholderUrl,
  resolveDiscoverAvatarImageUrl,
} from '../utils/DiscoverAvatarPresentation'
import {
  initialDiscoverBrowseVisibleCount,
  nextDiscoverBrowseVisibleCount,
  shouldPreloadDiscoverBrowseMore,
} from '../utils/DiscoverBrowsePagination'
import { extractInstagramUsername, extractXUsername } from '../utils/SocialFeedTitles'
import { AvatarTile } from './AvatarTile'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import { DiscoverBrowseAvatarHydrationTask } from './DiscoverTypes'

@Component
export struct DiscoverBrowseDestination {
  @Prop view: FeedViewType = FeedViewType.Articles
  @Prop title: string = ''
  @Prop sourceKey: string = ''
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  onBack: () => void = () => {}
  onOpenPreview: (feed: RecommendedFeed) => void = (_feed: RecommendedFeed) => {}
  onOpenSubscribeConfig: (feed: RecommendedFeed) => void = (_feed: RecommendedFeed) => {}
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @State private cachedFeeds: RecommendedFeed[] = []
  @State private insGroups: InsGroupFeed[] = []
  @State private visibleFeedCount: number = 0
  @State private avatarHydrationVersion: number = 0
  @State private persistedAvatarCacheLoaded: boolean = false
  private readonly browseScroller: Scroller = new Scroller()
  private readonly browseAvatarOverrideMap: Map<string, string> = new Map<string, string>()
  private readonly browseAvatarHydratingKeys: Set<string> = new Set<string>()
  private readonly browseAvatarHydrationQueue: DiscoverBrowseAvatarHydrationTask[] = []
  private browseAvatarHydrationRunning: boolean = false
  private browseDestinationActive: boolean = false

  aboutToAppear(): void {
    this.browseDestinationActive = true
    this.cachedFeeds = filteredRecommendedFeeds(this.view, this.sourceKey)
    this.visibleFeedCount = initialDiscoverBrowseVisibleCount(this.cachedFeeds.length)
    if (this.sourceKey === 'ins') {
      this.insGroups = builtinDiscoverInsGroups()
    }
    setTimeout(() => {
      if (this.browseDestinationActive) {
        void this.loadPersistedAvatarCache()
      }
    }, 120)
  }

  private browseFeeds(): RecommendedFeed[] {
    return filteredRecommendedFeeds(this.view, this.sourceKey)
  }

  private visibleBrowseFeeds(): RecommendedFeed[] {
    return this.cachedFeeds.slice(0, this.visibleFeedCount)
  }

  private hasMoreBrowseFeeds(): boolean {
    return this.visibleFeedCount < this.cachedFeeds.length
  }

  private loadMoreBrowseFeeds(): void {
    if (!this.hasMoreBrowseFeeds()) {
      return
    }

    this.visibleFeedCount = nextDiscoverBrowseVisibleCount(this.visibleFeedCount, this.cachedFeeds.length)
  }

  private handleBrowseScrollLoadMore(): void {
    if (!this.hasMoreBrowseFeeds()) {
      return
    }

    const currentOffset = Math.max(0, this.browseScroller.currentOffset().yOffset)
    if (shouldPreloadDiscoverBrowseMore(
      currentOffset,
      this.cachedFeeds.length,
      this.visibleFeedCount,
    )) {
      this.loadMoreBrowseFeeds()
    }
  }

  private browseTitle(): string {
    return this.title || discoverViewLabel(this.view)
  }

  private hostOf(url: string): string {
    const matched = (url || '').match(/^https?:\/\/([^/]+)/i)
    return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
  }

  private normalizeSiteUrl(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed.replace(/^\/\/+/, '')}`
    }
    return trimmed
  }

  private fallbackAvatarCandidates(imageUrl: string, targetUrl: string, siteUrl: string, title: string): string[] {
    const candidates: string[] = []
    const push = (value: string): void => {
      const trimmed = (value || '').trim()
      if (!trimmed || candidates.includes(trimmed)) {
        return
      }
      candidates.push(trimmed)
    }

    push(imageUrl)
    const normalizedTarget = this.normalizeSiteUrl(targetUrl)
    const normalizedSite = this.normalizeSiteUrl(siteUrl)
    const host = this.hostOf(normalizedSite) || this.hostOf(normalizedTarget)

    const xUsername = extractXUsername(normalizedTarget) || extractXUsername(normalizedSite) || extractXUsername(title || '')
    if (xUsername) {
      push(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
    }

    const instagramUsername = extractInstagramUsername(normalizedTarget)
      || extractInstagramUsername(normalizedSite)
      || extractInstagramUsername(title || '')
    if (instagramUsername) {
      push(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`)
    }

    if (host) {
      push(`https://icons.duckduckgo.com/ip3/${host}.ico`)
      push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
      push(`https://${host}/favicon.ico`)
      push(`https://www.${host}/favicon.ico`)
    }

    return candidates
  }

  private cachedPreviewPayloadForFeed(targetUrl: string, siteUrl: string): FeedRefreshPayload | undefined {
    return DiscoverRemoteSearchService.cachedPreviewPayload(targetUrl)
      || DiscoverRemoteSearchService.cachedPreviewPayload(siteUrl)
  }

  private browseAvatarCacheKey(targetUrl: string, siteUrl: string): string {
    return discoverAvatarCacheKey(targetUrl, siteUrl)
  }

  private browseAvatarOverride(targetUrl: string, siteUrl: string): string {
    const keys = discoverAvatarCacheKeys(targetUrl, siteUrl)
    for (const key of keys) {
      const value = this.browseAvatarOverrideMap.get(key)
      if (value) {
        return value
      }
    }
    return ''
  }

  private async loadPersistedAvatarCache(): Promise<void> {
    if (this.persistedAvatarCacheLoaded) {
      return
    }

    try {
      const entries = await AppPreferenceService.loadDiscoverAvatarCache()
      entries.forEach((entry: DiscoverAvatarCacheEntry) => {
        discoverAvatarCacheKeys(entry.targetUrl, entry.siteUrl).forEach((key: string) => {
          this.browseAvatarOverrideMap.set(key, entry.imageUrl)
        })
      })
      this.persistedAvatarCacheLoaded = true
      this.avatarHydrationVersion += 1
    } catch (error) {
      this.persistedAvatarCacheLoaded = true
      console.warn(`load discover avatar cache failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private browseFeedAvatarImageUrl(feed: RecommendedFeed): string {
    const cachedPayload = this.cachedPreviewPayloadForFeed(feed.url, feed.siteUrl)
    return resolveDiscoverAvatarImageUrl({
      imageUrl: feed.imageUrl || '',
      targetUrl: feed.url,
      siteUrl: feed.siteUrl,
      title: feed.title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.browseAvatarOverride(feed.url, feed.siteUrl),
    })
  }

  private insMemberAvatarImageUrl(member: DiscoverBuiltinFeedSeed): string {
    const cachedPayload = this.cachedPreviewPayloadForFeed(member.url, '')
    return resolveDiscoverAvatarImageUrl({
      imageUrl: '',
      targetUrl: member.url,
      siteUrl: '',
      title: member.title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.browseAvatarOverride(member.url, ''),
    })
  }

  private shouldHydrateBrowseAvatar(currentImageUrl: string): boolean {
    return isDiscoverAvatarPlaceholderUrl(currentImageUrl)
  }

  private rememberLoadedBrowseAvatar(targetUrl: string, siteUrl: string, imageUrl: string): void {
    const normalizedImageUrl = (imageUrl || '').trim()
    if (!isDiscoverAvatarCacheableImageUrl(normalizedImageUrl)) {
      return
    }

    discoverAvatarCacheKeys(targetUrl, siteUrl).forEach((key: string) => {
      this.browseAvatarOverrideMap.set(key, normalizedImageUrl)
    })
    void AppPreferenceService.rememberDiscoverAvatar(targetUrl, siteUrl, normalizedImageUrl)
    if (siteUrl) {
      void AppPreferenceService.rememberDiscoverAvatar(targetUrl, '', normalizedImageUrl)
    }
  }

  private rememberBrowseAvatarPayload(targetUrl: string, payload: FeedRefreshPayload, imageUrl: string): void {
    DiscoverRemoteSearchService.rememberPreviewPayload(targetUrl, {
      etag: payload.etag,
      lastModified: payload.lastModified,
      feedTitle: payload.feedTitle,
      siteUrl: payload.siteUrl,
      imageUrl,
      description: payload.description,
      resolvedFeedUrl: payload.resolvedFeedUrl,
      entries: payload.entries,
    })
  }

  private async hydrateBrowseFeedAvatar(
    title: string,
    targetUrl: string,
    siteUrl: string,
    imageUrl: string,
  ): Promise<void> {
    if (!this.browseDestinationActive) {
      return
    }

    const key = this.browseAvatarCacheKey(targetUrl, siteUrl)
    if (this.browseAvatarOverrideMap.has(key) || this.browseAvatarHydratingKeys.has(key)) {
      return
    }

    const cachedPayload = this.cachedPreviewPayloadForFeed(targetUrl, siteUrl)
    const currentImageUrl = resolveDiscoverAvatarImageUrl({
      imageUrl,
      targetUrl,
      siteUrl,
      title,
      cachedImageUrl: cachedPayload?.imageUrl || '',
      cachedSiteUrl: cachedPayload?.siteUrl || '',
      cachedTitle: cachedPayload?.feedTitle || '',
      cachedResolvedFeedUrl: cachedPayload?.resolvedFeedUrl || '',
      hydratedImageUrl: this.browseAvatarOverride(targetUrl, siteUrl),
    })
    if (!this.shouldHydrateBrowseAvatar(currentImageUrl)) {
      return
    }

    this.browseAvatarHydratingKeys.add(key)
    this.browseAvatarHydrationQueue.push({
      key,
      title,
      targetUrl,
      siteUrl,
      imageUrl,
      currentImageUrl,
    })
    void this.processBrowseAvatarHydrationQueue()
  }

  private async processBrowseAvatarHydrationQueue(): Promise<void> {
    if (this.browseAvatarHydrationRunning) {
      return
    }

    this.browseAvatarHydrationRunning = true
    try {
      while (this.browseDestinationActive && this.browseAvatarHydrationQueue.length > 0) {
        const task = this.browseAvatarHydrationQueue.shift()
        if (!task) {
          continue
        }
        await this.runBrowseAvatarHydrationTask(task)
      }
    } finally {
      this.browseAvatarHydrationRunning = false
    }
  }

  private async runBrowseAvatarHydrationTask(task: DiscoverBrowseAvatarHydrationTask): Promise<void> {
    try {
      if (!this.browseDestinationActive) {
        return
      }
      const cachedPayload = this.cachedPreviewPayloadForFeed(task.targetUrl, task.siteUrl)
      const payload = cachedPayload || await RssFeedService.previewFeedUrl(task.targetUrl)
      if (!this.browseDestinationActive) {
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

      this.rememberBrowseAvatarPayload(task.targetUrl, payload, hydratedImageUrl)
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
          this.browseAvatarOverrideMap.set(key, hydratedImageUrl)
        })
        this.avatarHydrationVersion += 1
      }
    } catch (error) {
      console.warn(`hydrate discover browse avatar failed: ${task.targetUrl} ${error instanceof Error ? error.message : error}`)
    } finally {
      this.browseAvatarHydratingKeys.delete(task.key)
    }
  }

  private stopBrowseAvatarHydration(): void {
    this.browseDestinationActive = false
    this.browseAvatarHydrationQueue.splice(0, this.browseAvatarHydrationQueue.length)
    this.browseAvatarHydratingKeys.clear()
  }

  aboutToDisappear(): void {
    this.stopBrowseAvatarHydration()
  }

  private openPreviewPage(feed: RecommendedFeed): void {
    this.onOpenPreview(feed)
  }

  private openSubscribeConfigPage(feed: RecommendedFeed): void {
    this.onOpenSubscribeConfig(feed)
  }

  @Builder
  private FeedRow(feed: RecommendedFeed, showDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 10 }) {
        AvatarTile({
          imageUrl: this.browseFeedAvatarImageUrl(feed),
          fallbackImageUrls: this.fallbackAvatarCandidates(
            this.browseFeedAvatarImageUrl(feed),
            feed.url,
            feed.siteUrl,
            feed.title,
          ),
          refreshToken: this.discoverOverlayLevel + this.avatarHydrationVersion,
          fallbackLabel: feed.title,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 8,
          textSize: 11,
          useAccentFallback: true,
          onImageLoaded: (url: string) => {
            this.rememberLoadedBrowseAvatar(feed.url, feed.siteUrl, url)
          },
        })

        Column({ space: 6 }) {
          Text(feed.title)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (feed.description.trim()) {
            Text(feed.description.trim())
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          } else if (feed.followers) {
            Text(feed.followers)
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height(feed.description.trim() ? 56 : 46)
      .padding({ left: 14, right: 14, top: 6, bottom: 6 })
      .backgroundColor('transparent')
      .onClick(() => {
        this.onOpenPreview(feed)
      })
      .onAppear(() => {
        setTimeout(() => {
          if (this.browseDestinationActive) {
            void this.hydrateBrowseFeedAvatar(feed.title, feed.url, feed.siteUrl, feed.imageUrl || '')
          }
        }, 520)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 14 })
      }
    }
    .width('100%')
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.browseTitle(),
        theme: this.theme,
        showBackButton: true,
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => {
          this.stopBrowseAvatarHydration()
          this.onBack()
        },
      })
        .width('100%')
    }
  }

  @Builder
  private InsFeedRow(member: DiscoverBuiltinFeedSeed, showDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 10 }) {
        AvatarTile({
          imageUrl: this.insMemberAvatarImageUrl(member),
          fallbackImageUrls: this.fallbackAvatarCandidates(
            this.insMemberAvatarImageUrl(member),
            member.url,
            '',
            member.title,
          ),
          refreshToken: this.discoverOverlayLevel + this.avatarHydrationVersion,
          fallbackLabel: member.title,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 8,
          textSize: 11,
          useAccentFallback: true,
          onImageLoaded: (url: string) => {
            this.rememberLoadedBrowseAvatar(member.url, '', url)
          },
        })

        Column({ space: 6 }) {
          Text(member.title)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (member.descriptionZh || member.descriptionEn) {
            Text(resolveDescription(member))
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height((member.descriptionZh || member.descriptionEn) ? 56 : 46)
      .padding({ left: 14, right: 14, top: 6, bottom: 6 })
      .backgroundColor('transparent')
      .onClick(() => {
        const feed: RecommendedFeed = {
          title: member.title,
          url: member.url,
          siteUrl: '',
          description: '',
          view: FeedViewType.Pictures,
          category: '内置-Ins',
        }
        this.openPreviewPage(feed)
      })
      .onAppear(() => {
        setTimeout(() => {
          if (this.browseDestinationActive) {
            void this.hydrateBrowseFeedAvatar(member.title, member.url, '', '')
          }
        }, 520)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 14 })
      }
    }
    .width('100%')
  }

  build() {
    Column() {
      this.HeaderSection()

      Scroll(this.browseScroller) {
        Column({ space: 12 }) {
          if (this.sourceKey === 'ins' && this.insGroups.length > 0) {
            ForEach(this.insGroups, (group: InsGroupFeed) => {
              Column({ space: 0 }) {
                Text(group.groupName)
                  .fontSize(14)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textPrimary)
                  .margin({ left: 14, top: 10, bottom: 6 })

                ForEach(group.members, (member: DiscoverBuiltinFeedSeed, index: number) => {
                  this.InsFeedRow(member, index < group.members.length - 1)
                }, (member: DiscoverBuiltinFeedSeed) => `${group.groupName}-${member.url}`)
              }
              .width('100%')
              .backgroundColor(this.theme.surface)
              .borderRadius(18)
              .border({ width: 0.8, color: this.theme.divider })
              .clip(true)
            }, (group: InsGroupFeed) => group.groupName)
          } else {
            Column({ space: 0 }) {
              ForEach(this.visibleBrowseFeeds(), (feed: RecommendedFeed, index: number) => {
                this.FeedRow(feed, index < this.visibleBrowseFeeds().length - 1)
              }, (feed: RecommendedFeed) => `${this.sourceKey || this.view}-${feed.url}`)
              if (this.hasMoreBrowseFeeds()) {
                Row() {
                  Text('继续下滑加载更多')
                    .fontSize(12)
                    .fontColor(this.theme.textMuted)
                }
                .width('100%')
                .height(44)
                .justifyContent(FlexAlign.Center)
              }
            }
            .width('100%')
            .backgroundColor(this.theme.surface)
            .borderRadius(18)
            .border({ width: 0.8, color: this.theme.divider })
            .clip(true)
          }
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 4, bottom: 16 })
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.Start)
        .constraintSize({ minHeight: '100%' })
      }
      .scrollBar(BarState.On)
      .edgeEffect(EdgeEffect.Spring)
      .width('100%')
      .layoutWeight(1)
      .onReachEnd(() => {
        this.loadMoreBrowseFeeds()
      })
      .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
        this.handleBrowseScrollLoadMore()
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onDisAppear(() => {
      this.stopBrowseAvatarHydration()
    })
  }
}

