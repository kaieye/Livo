import { DEFAULT_RSSHUB_INSTANCE } from '../config/PlatformInstances'
import { DiscoverSearchPlatform, ResolvedDiscoverCandidate } from './discover/DiscoverTypes'
import { FeedRefreshPayload } from './rss-feed/RssFeedService'
import { searchBilibiliUsers } from './discover-remote/BilibiliUserSearchService'
import { searchInstagramUsers } from './discover-remote/InstagramUserSearchService'
import { searchXUsers } from './discover-remote/XUserSearchService'
import { searchYouTubeChannels } from './discover-remote/YouTubeChannelSearchService'
import { dedupeCandidates } from './discover-remote/SharedSearchHelpers'

const RSSHUB_BASE_URL = DEFAULT_RSSHUB_INSTANCE.replace(/\/+$/, '')
const MAX_MERGED_RESULTS = 12

/**
 * Thin orchestrator over the per-platform discover-remote search adapters.
 *
 * Owns two responsibilities:
 *   1. Fan-out to the platform adapters (`discover-remote/*SearchService`) for
 *      a search query, then dedupe the merged candidates.
 *   2. Hold the in-memory preview cache that subscribe / detail flows read.
 *
 * The platform-specific HTTP, parsing, and fallback logic lives behind the
 * adapter seams — adding a new platform means dropping in a sibling adapter
 * and one extra dispatch line below, not extending this file.
 */
export class DiscoverRemoteSearchService {
  private static previewCache: Map<string, FeedRefreshPayload> = new Map<string, FeedRefreshPayload>()

  static rememberPreviewPayload(targetUrl: string, payload: FeedRefreshPayload): void {
    DiscoverRemoteSearchService.cachePayload(targetUrl, payload)
    if (payload.resolvedFeedUrl?.trim()) {
      DiscoverRemoteSearchService.cachePayload(payload.resolvedFeedUrl, payload)
    }
    if (payload.siteUrl?.trim()) {
      DiscoverRemoteSearchService.cachePayload(payload.siteUrl, payload)
    }
  }

  static cachedPreviewPayload(targetUrl: string): FeedRefreshPayload | undefined {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      return undefined
    }
    return DiscoverRemoteSearchService.previewCache.get(trimmed)
  }

  static async search(query: string, platform: DiscoverSearchPlatform): Promise<ResolvedDiscoverCandidate[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    const tasks: Array<Promise<ResolvedDiscoverCandidate[]>> = []
    if (platform === 'all' || platform === 'youtube') {
      tasks.push(searchYouTubeChannels(trimmed))
    }
    if (platform === 'all' || platform === 'bilibili') {
      tasks.push(searchBilibiliUsers(trimmed, RSSHUB_BASE_URL))
    }
    if (platform === 'all' || platform === 'x') {
      tasks.push(searchXUsers(trimmed, RSSHUB_BASE_URL))
    }
    if (platform === 'all' || platform === 'instagram') {
      tasks.push(searchInstagramUsers(trimmed, RSSHUB_BASE_URL))
    }

    const groups = await Promise.allSettled(tasks)
    const merged: ResolvedDiscoverCandidate[] = []
    groups.forEach((group: PromiseSettledResult<ResolvedDiscoverCandidate[]>) => {
      if (group.status !== 'fulfilled') {
        return
      }
      group.value.forEach((item: ResolvedDiscoverCandidate) => {
        merged.push(item)
      })
    })
    return dedupeCandidates(merged).slice(0, MAX_MERGED_RESULTS)
  }

  private static cachePayload(targetUrl: string, payload: FeedRefreshPayload): void {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      return
    }
    DiscoverRemoteSearchService.previewCache.set(trimmed, payload)
  }
}
