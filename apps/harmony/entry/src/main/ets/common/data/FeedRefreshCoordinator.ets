import {
  Feed,
  RemoteFeedResult,
} from '../models/LivoModels'
import { FeedRepository, IFeedRepository } from '../repositories/FeedRepository'
import { EntryRepository, IEntryRepository } from '../repositories/EntryRepository'
import { RefreshLogStore } from '../services/RefreshLogStore'
import { RssFeedService, FeedRefreshPayload } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { BackgroundTaskService } from '../services/BackgroundTaskService'
import { canonicalFeedUrl, normalizeSocialFeedDescription } from '../utils/social/SocialFeedTitles'
import { resolvePreferredStoredFeedImageUrl, resolvePreferredStoredFeedTitle, resolveSocialFeedDisplayTitle } from '../utils/social/SocialFeedPresentation'
import { rekeyPreviewEntries } from '../utils/PreviewFeedSeed'
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'
import { sortFeedsStable } from './AppRepositoryEntryHelpers'

const SUCCESSFUL_REFRESH_COOLDOWN_MS: number = 3 * 60 * 1000
const REFRESH_CONCURRENCY: number = 4

const DEBUG_ENABLED: boolean = false
const DEBUG_PREFIX: string = '[FeedRefreshCoordinator]'

function debugLog(message: string): void {
  if (DEBUG_ENABLED) {
    console.info(`${DEBUG_PREFIX} ${message}`)
  }
}

async function appendRefreshLog(successFeedCount: number, failedFeedCount: number, failedFeedTitles: string[]): Promise<void> {
  const normalizedTitles = failedFeedTitles.filter((title: string) => !!title)
  await RefreshLogStore.append({
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    refreshedAt: Date.now(),
    successFeedCount: Math.max(0, successFeedCount),
    failedFeedCount: Math.max(0, failedFeedCount),
    failedFeedTitles: normalizedTitles,
  })
}

class FeedRefreshCoordinator {
  static readonly default: FeedRefreshCoordinator = new FeedRefreshCoordinator(
    FeedRepository.default,
    EntryRepository.default,
  )

  private readonly feedRepo: IFeedRepository
  private readonly entryRepo: IEntryRepository
  private bootstrapped: boolean = false
  private seedFeedHydrationStarted: boolean = false
  private feedMetadataRepairStarted: boolean = false

  constructor(feedRepo: IFeedRepository, entryRepo: IEntryRepository) {
    this.feedRepo = feedRepo
    this.entryRepo = entryRepo
  }

  async bootstrap(): Promise<void> {
    if (this.bootstrapped) {
      return
    }
    this.bootstrapped = true
    void this.repairFeedMetadataInBackground()
  }

  private async repairFeedMetadataInBackground(): Promise<void> {
    if (this.feedMetadataRepairStarted) {
      return
    }
    this.feedMetadataRepairStarted = true

    try {
      const feeds = sortFeedsStable(await this.feedRepo.list())
      let repaired = false

      for (const feed of feeds) {
        const fallbackTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
        if (!(feed.title || '').trim() && !!fallbackTitle) {
          await this.feedRepo.update(feed.id, {
            title: fallbackTitle,
            url: feed.url,
            siteUrl: feed.siteUrl || '',
            imageUrl: feed.imageUrl || '',
            description: feed.description || '',
            category: feed.category || '',
            view: feed.view,
            showInAll: feed.showInAll,
          })
          repaired = true
        }
      }

      if (repaired) {
        bumpFeedsChangedSignal()
      }
    } catch (error) {
      console.error(`repair feed metadata failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  isFeedRefreshInCooldown(feed: Feed, now: number = Date.now()): boolean {
    const lastFetched = feed.lastFetched ?? 0
    return lastFetched > 0 && (now - lastFetched < SUCCESSFUL_REFRESH_COOLDOWN_MS)
  }

  resolveRefreshConcurrency(totalFeeds: number): number {
    return totalFeeds <= 0 ? 1 : REFRESH_CONCURRENCY
  }

  async hydrateSeedFeeds(feeds: Feed[]): Promise<void> {
    if (this.seedFeedHydrationStarted) {
      return
    }
    this.seedFeedHydrationStarted = true

    for (const feed of feeds) {
      try {
        const payload = await RssFeedService.fetchFeedEntries(feed)
        const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
        const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
        const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
        const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
        const nextResolvedImageUrl = await SocialFeedAvatarService.resolveFeedAvatar(nextUrl, nextSiteUrl, payload.imageUrl || '', feed.imageUrl || '')
        const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)

        await this.entryRepo.upsertMany(payload.entries)
        await this.feedRepo.updateFetchState(feed.id, {
          url: nextUrl,
          title: nextTitle,
          siteUrl: nextSiteUrl,
          imageUrl: nextImageUrl,
          description: nextDescription,
          lastFetched: Date.now(),
          etag: payload.etag,
          lastModified: payload.lastModified,
          errorCount: 0,
        })
        bumpFeedsChangedSignal()
      } catch (error) {
        console.error(`Failed to hydrate built-in feed ${feed.id}: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
  }

  async refreshFeed(
    feedId: string,
    preferFastImageResolve: boolean = false,
    includeEntries: boolean = true,
    includeNewEntryCount: boolean = true,
    notifyFeedsChanged: boolean = true,
  ): Promise<RemoteFeedResult> {
    const feed = await this.feedRepo.getById(feedId)
    if (!feed) {
      throw new Error('订阅源不存在')
    }

    if (this.isFeedRefreshInCooldown(feed)) {
      return {
        entries: [],
        sourceLabel: `${feed.title} · 3 分钟内已刷新，跳过`,
        newEntriesCount: 0,
        skippedByCooldown: true,
        skippedFeedCount: 1,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    }

    try {
      const payload = await RssFeedService.fetchFeedEntries(feed)
      let newEntriesCount = 0
      if (includeNewEntryCount) {
        const existingEntries = await this.entryRepo.listByFeed(feedId)
        const existingEntryIds = new Set(existingEntries.map(e => e.id))
        newEntriesCount = payload.entries.filter(e => !existingEntryIds.has(e.id)).length
      }
      const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
      const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
      const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
      const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
      const nextResolvedImageUrl = preferFastImageResolve
        ? (payload.imageUrl || feed.imageUrl || '')
        : await SocialFeedAvatarService.resolveFeedAvatar(nextUrl, nextSiteUrl, payload.imageUrl || '', feed.imageUrl || '')
      const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)

      await this.entryRepo.upsertMany(payload.entries)
      await this.feedRepo.updateFetchState(feedId, {
        url: nextUrl,
        title: nextTitle,
        siteUrl: nextSiteUrl,
        imageUrl: nextImageUrl,
        description: nextDescription,
        lastFetched: Date.now(),
        etag: payload.etag,
        lastModified: payload.lastModified,
        errorCount: 0,
      })

      if (notifyFeedsChanged) {
        bumpFeedsChangedSignal()
      }
      return {
        entries: [],
        sourceLabel: includeNewEntryCount ? `${feed.title} · 新增 ${newEntriesCount} 条` : `${feed.title} · 已刷新`,
        newEntriesCount,
        skippedByCooldown: false,
        skippedFeedCount: 0,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.feedRepo.updateFetchState(feedId, {
        lastFetched: feed.lastFetched ?? 0,
        etag: feed.etag ?? '',
        lastModified: feed.lastModified ?? '',
        errorCount: (feed.errorCount ?? 0) + 1,
        imageUrl: feed.imageUrl ?? '',
      })

      if (notifyFeedsChanged) {
        bumpFeedsChangedSignal()
      }
      return {
        entries: [],
        sourceLabel: `${feed.title} · 刷新失败：${message}`,
        newEntriesCount: 0,
        skippedByCooldown: false,
        skippedFeedCount: 0,
        failedFeedCount: 1,
        failedFeedLabels: [feed.title],
        failedFeedDetails: [`${feed.title}：${message}`],
        fallbackUsed: true,
      }
    }
  }

  async seedFeedFromPreview(feedId: string, payload: FeedRefreshPayload): Promise<void> {
    const feed = await this.feedRepo.getById(feedId)
    if (!feed) {
      throw new Error('订阅源不存在')
    }

    const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
    const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
    const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
    const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
    const nextResolvedImageUrl = await SocialFeedAvatarService.resolveFeedAvatar(nextUrl, nextSiteUrl, payload.imageUrl || '', feed.imageUrl || '')
    const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)
    const normalizedPreviewEntries = rekeyPreviewEntries(feedId, payload.entries)
    const existingEntries = await this.entryRepo.listByFeed(feedId)
    const shouldReplace = existingEntries.length === 0 || normalizedPreviewEntries.length >= existingEntries.length

    debugLog(`seedFeedFromPreview feedId=${feedId} previewEntries=${normalizedPreviewEntries.length} existingEntries=${existingEntries.length} replace=${shouldReplace}`)

    if (shouldReplace) {
      await this.entryRepo.removeByFeed(feedId)
    }
    await this.entryRepo.upsertMany(normalizedPreviewEntries)
    await this.feedRepo.updateFetchState(feedId, {
      url: nextUrl,
      title: nextTitle,
      siteUrl: nextSiteUrl,
      imageUrl: nextImageUrl,
      description: nextDescription,
      lastFetched: Date.now(),
      etag: payload.etag,
      lastModified: payload.lastModified,
      errorCount: 0,
    })

    debugLog(`seedFeedFromPreview updated feedId=${feedId} nextTitleLen=${nextTitle.trim().length} nextUrl=${nextUrl} nextSiteUrl=${nextSiteUrl}`)
  }

  private async refreshFeedsWithPool(
    feeds: Feed[],
    refreshConcurrency: number,
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<PromiseSettledResult<RemoteFeedResult>[]> {
    const results: PromiseSettledResult<RemoteFeedResult>[] = new Array(feeds.length)
    let nextIndex = 0
    let completedCount = 0

    const worker = async (): Promise<void> => {
      while (true) {
        const currentIndex = nextIndex
        nextIndex += 1
        if (currentIndex >= feeds.length) {
          return
        }

        const feed = feeds[currentIndex]
        if (!feed) {
          results[currentIndex] = { status: 'rejected', reason: '订阅源不存在' }
          completedCount += 1
          onProgress?.(completedCount, feeds.length)
          continue
        }

        try {
          const value = await this.refreshFeed(feed.id, true, false, false, false)
          results[currentIndex] = { status: 'fulfilled', value }
        } catch (reason) {
          results[currentIndex] = { status: 'rejected', reason }
        }

        completedCount += 1
        onProgress?.(completedCount, feeds.length)
      }
    }

    const workers: Promise<void>[] = []
    for (let index = 0; index < Math.min(refreshConcurrency, feeds.length); index += 1) {
      workers.push(worker())
    }
    await Promise.all(workers)
    return results
  }

  async refreshAllFeeds(
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<RemoteFeedResult> {
    const feeds = sortFeedsStable(await this.feedRepo.list())
    if (feeds.length === 0) {
      await appendRefreshLog(0, 0, [])
      return {
        entries: [],
        sourceLabel: '暂无可刷新的订阅源',
        newEntriesCount: 0,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    }

    const refreshStartedAt = Date.now()
    const pendingFeeds = feeds.filter(f => !this.isFeedRefreshInCooldown(f, refreshStartedAt))
    const skippedByCooldownCount = feeds.length - pendingFeeds.length

    debugLog(`refreshAllFeeds totalFeeds=${feeds.length} pending=${pendingFeeds.length} skippedByCooldown=${skippedByCooldownCount}`)

    onProgress?.(0, feeds.length)

    if (pendingFeeds.length === 0) {
      await appendRefreshLog(0, 0, [])
      return {
        entries: [],
        sourceLabel: '全部订阅源 3 分钟内已刷新，已跳过重复抓取',
        newEntriesCount: 0,
        skippedByCooldown: true,
        skippedFeedCount: skippedByCooldownCount,
        allSkippedByCooldown: true,
        failedFeedCount: 0,
        failedFeedLabels: [],
        failedFeedDetails: [],
        fallbackUsed: false,
      }
    }

    if (skippedByCooldownCount > 0) {
      onProgress?.(skippedByCooldownCount, feeds.length)
    }

    let backgroundTaskHeld: boolean = false
    try {
      await BackgroundTaskService.acquire('dataTransfer')
      backgroundTaskHeld = true
    } catch (error) {
      console.warn(`[FeedRefreshCoordinator] Failed to acquire background task: ${error instanceof Error ? error.message : String(error)}`)
    }

    let results: PromiseSettledResult<RemoteFeedResult>[] = []
    try {
      results = await this.refreshFeedsWithPool(
        pendingFeeds,
        this.resolveRefreshConcurrency(pendingFeeds.length),
        (completedCount, totalCount) => onProgress?.(skippedByCooldownCount + completedCount, skippedByCooldownCount + totalCount),
      )
    } finally {
      if (backgroundTaskHeld) {
        try {
          await BackgroundTaskService.release('dataTransfer')
        } catch (error) {
          console.warn(`[FeedRefreshCoordinator] Failed to release background task: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    let refreshedCount = 0
    let failedCount = 0
    const failedFeedLabels: string[] = []
    const failedFeedDetails: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.skippedByCooldown) {
          return
        }
        if (result.value.fallbackUsed) {
          failedCount += 1
          result.value.failedFeedLabels?.forEach(l => l && !failedFeedLabels.includes(l) && failedFeedLabels.push(l))
          result.value.failedFeedDetails?.forEach(d => d && failedFeedDetails.push(d))
        } else {
          refreshedCount += 1
        }
      } else {
        failedCount += 1
        const failedFeed = pendingFeeds[index]
        if (failedFeed && !failedFeedLabels.includes(failedFeed.title)) {
          failedFeedLabels.push(failedFeed.title)
        }
        failedFeedDetails.push(`${failedFeed?.title || '未知订阅源'}：${result.reason}`)
        console.error(`Failed to refresh feed in aggregate refresh: ${result.reason}`)
      }
    })

    if (failedCount > pendingFeeds.length) {
      failedCount = pendingFeeds.length
    }

    if (failedFeedDetails.length > 0) {
      console.error(`[FeedRefreshCoordinator] Aggregate refresh failed feeds: ${failedFeedDetails.join(' | ')}`)
    }

    const failedFeedSummary = failedFeedLabels.slice(0, 3).join('、')
    const failedFeedSuffix = failedFeedSummary ? `：${failedFeedSummary}${failedFeedLabels.length > 3 ? ' 等' : ''}` : ''
    const allSkippedByCooldown = skippedByCooldownCount === feeds.length && failedCount === 0

    await appendRefreshLog(refreshedCount, failedCount, failedFeedLabels)

    debugLog(`refreshAllFeeds done refreshed=${refreshedCount} failed=${failedCount} skipped=${skippedByCooldownCount}`)

    return {
      entries: [],
      sourceLabel: allSkippedByCooldown ? '全部订阅源 3 分钟内已刷新，已跳过重复抓取' : `新增 0 条，${failedCount} 个订阅源刷新失败${failedFeedSuffix}`,
      newEntriesCount: 0,
      skippedByCooldown: allSkippedByCooldown,
      skippedFeedCount: skippedByCooldownCount,
      allSkippedByCooldown,
      failedFeedCount: failedCount,
      failedFeedLabels,
      failedFeedDetails,
      fallbackUsed: failedCount > 0,
    } as RemoteFeedResult
  }

}

export { FeedRefreshCoordinator }