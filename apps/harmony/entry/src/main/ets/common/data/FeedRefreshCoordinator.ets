import {
  Feed,
  RemoteFeedResult,
} from '../models/LivoModels'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { RefreshLogStore } from '../services/RefreshLogStore'
import { RssFeedService, FeedRefreshPayload } from '../services/RssFeedService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { canonicalFeedUrl, normalizeSocialFeedDescription } from '../utils/SocialFeedTitles'
import { resolvePreferredStoredFeedImageUrl, resolvePreferredStoredFeedTitle, resolveSocialFeedDisplayTitle } from '../utils/SocialFeedPresentation'
import { rekeyPreviewEntries } from '../utils/PreviewFeedSeed'
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'
import { sortFeedsStable } from './AppRepositoryEntryHelpers'

const SUCCESSFUL_REFRESH_COOLDOWN_MS: number = 3 * 60 * 1000
const REFRESH_CONCURRENCY: number = 12

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
  private static bootstrapped: boolean = false
  private static seedFeedHydrationStarted: boolean = false
  private static feedMetadataRepairStarted: boolean = false

  static async bootstrap(): Promise<void> {
    if (FeedRefreshCoordinator.bootstrapped) {
      return
    }
    FeedRefreshCoordinator.bootstrapped = true
    void FeedRefreshCoordinator.repairFeedMetadataInBackground()
  }

  private static async repairFeedMetadataInBackground(): Promise<void> {
    if (FeedRefreshCoordinator.feedMetadataRepairStarted) {
      return
    }
    FeedRefreshCoordinator.feedMetadataRepairStarted = true

    try {
      const feeds = sortFeedsStable(await FeedRepository.list())
      let repaired = false

      for (const feed of feeds) {
        const fallbackTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
        if (!(feed.title || '').trim() && !!fallbackTitle) {
          await FeedRepository.update(feed.id, {
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

  static isFeedRefreshInCooldown(feed: Feed, now: number = Date.now()): boolean {
    const lastFetched = feed.lastFetched ?? 0
    return lastFetched > 0 && (now - lastFetched < SUCCESSFUL_REFRESH_COOLDOWN_MS)
  }

  static resolveRefreshConcurrency(totalFeeds: number): number {
    return totalFeeds <= 0 ? 1 : REFRESH_CONCURRENCY
  }

  static async hydrateSeedFeeds(feeds: Feed[]): Promise<void> {
    if (FeedRefreshCoordinator.seedFeedHydrationStarted) {
      return
    }
    FeedRefreshCoordinator.seedFeedHydrationStarted = true

    for (const feed of feeds) {
      try {
        const payload = await RssFeedService.fetchFeedEntries(feed)
        const nextUrl = canonicalFeedUrl(payload.resolvedFeedUrl || feed.url, payload.siteUrl || feed.siteUrl || '') || feed.url
        const nextSiteUrl = payload.siteUrl || feed.siteUrl || ''
        const nextTitle = resolvePreferredStoredFeedTitle(feed.title, payload.feedTitle || '', nextUrl, nextSiteUrl)
        const nextDescription = normalizeSocialFeedDescription(payload.description || feed.description || '', nextUrl, nextSiteUrl)
        const nextResolvedImageUrl = await SocialFeedAvatarService.resolveFeedAvatar(nextUrl, nextSiteUrl, payload.imageUrl || '', feed.imageUrl || '')
        const nextImageUrl = resolvePreferredStoredFeedImageUrl(feed.imageUrl || '', nextResolvedImageUrl)

        await EntryRepository.upsertMany(payload.entries)
        await FeedRepository.updateFetchState(feed.id, {
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

  static async refreshFeed(
    feedId: string,
    preferFastImageResolve: boolean = false,
    includeEntries: boolean = true,
    includeNewEntryCount: boolean = true,
    notifyFeedsChanged: boolean = true,
  ): Promise<RemoteFeedResult> {
    const feed = await FeedRepository.getById(feedId)
    if (!feed) {
      throw new Error('订阅源不存在')
    }

    if (FeedRefreshCoordinator.isFeedRefreshInCooldown(feed)) {
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
        const existingEntries = await EntryRepository.listByFeed(feedId)
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

      await EntryRepository.upsertMany(payload.entries)
      await FeedRepository.updateFetchState(feedId, {
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
      await FeedRepository.updateFetchState(feedId, {
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

  static async seedFeedFromPreview(feedId: string, payload: FeedRefreshPayload): Promise<void> {
    const feed = await FeedRepository.getById(feedId)
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
    const existingEntries = await EntryRepository.listByFeed(feedId)
    const shouldReplace = existingEntries.length === 0 || normalizedPreviewEntries.length >= existingEntries.length

    debugLog(`seedFeedFromPreview feedId=${feedId} previewEntries=${normalizedPreviewEntries.length} existingEntries=${existingEntries.length} replace=${shouldReplace}`)

    if (shouldReplace) {
      await EntryRepository.removeByFeed(feedId)
    }
    await EntryRepository.upsertMany(normalizedPreviewEntries)
    await FeedRepository.updateFetchState(feedId, {
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

  private static async refreshFeedsWithPool(
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
          const value = await FeedRefreshCoordinator.refreshFeed(feed.id, true, false, false, false)
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

  static async refreshAllFeeds(
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<RemoteFeedResult> {
    const feeds = sortFeedsStable(await FeedRepository.list())
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
    const pendingFeeds = feeds.filter(f => !FeedRefreshCoordinator.isFeedRefreshInCooldown(f, refreshStartedAt))
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

    const results = await FeedRefreshCoordinator.refreshFeedsWithPool(
      pendingFeeds,
      FeedRefreshCoordinator.resolveRefreshConcurrency(pendingFeeds.length),
      (completedCount, totalCount) => onProgress?.(skippedByCooldownCount + completedCount, skippedByCooldownCount + totalCount),
    )

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
