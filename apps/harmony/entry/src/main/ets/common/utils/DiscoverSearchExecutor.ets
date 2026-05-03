import { DirectUrlResult, createDiscoverResultFromFeed } from '../components/DiscoverTypes'
import { DiscoverRemoteSearchService } from '../services/DiscoverRemoteSearchService'
import {
  DiscoverSearchPlatform,
  RecommendedFeed,
  ResolvedDiscoverCandidate,
} from '../services/DiscoverService'
import { SocialFeedAvatarService } from '../services/SocialFeedAvatarService'
import { isInstagramPlaceholderAvatar } from '../utils/DiscoverCandidatePresentation'

const PLATFORM_SWITCH_SETTLE_MS: number = 220

export interface DiscoverSearchOwner {
  query: string
  searchPlatform: DiscoverSearchPlatform
  isPlatformSwitchSearching: boolean
  remoteResults: ResolvedDiscoverCandidate[]
  isSearchingRemote: boolean
  avatarOverrideVersion: number
  searchSession: number
  platformSwitchSession: number
  avatarOverrideMap: Map<string, string>
  avatarHydratingKeys: Set<string>

  discoverFeaturedFeeds(): RecommendedFeed[]
  directUrlResult(): DirectUrlResult | undefined
  resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string
  candidateAvatarCacheKey(candidate: ResolvedDiscoverCandidate): string
  shouldHydrateCandidateAvatar(candidate: ResolvedDiscoverCandidate): boolean
  resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string
}

export class DiscoverSearchExecutor {
  private readonly owner: DiscoverSearchOwner

  constructor(owner: DiscoverSearchOwner) {
    this.owner = owner
  }

  featuredFeedCandidates(): ResolvedDiscoverCandidate[] {
    return this.owner
      .discoverFeaturedFeeds()
      .map((feed: RecommendedFeed): ResolvedDiscoverCandidate => createDiscoverResultFromFeed(feed))
  }

  onQueryChange(value: string): void {
    this.owner.query = value
    void this.refreshRemoteResults()
  }

  onClearQuery(): void {
    this.owner.query = ''
    this.owner.remoteResults = []
    this.owner.isSearchingRemote = false
  }

  resetSearchState(): void {
    this.owner.remoteResults = []
    this.owner.isSearchingRemote = false
    this.owner.isPlatformSwitchSearching = false
  }

  async refreshRemoteResults(): Promise<void> {
    const trimmed = this.owner.query.trim()
    this.owner.searchSession += 1
    const session = this.owner.searchSession

    if (!trimmed) {
      this.owner.remoteResults = []
      this.owner.isSearchingRemote = false
      void this.hydrateAvatarsForCandidates(this.featuredFeedCandidates())
      return
    }

    if (this.owner.directUrlResult()) {
      this.owner.remoteResults = []
      this.owner.isSearchingRemote = false
      return
    }

    this.owner.isSearchingRemote = true
    try {
      const results = await DiscoverRemoteSearchService.search(trimmed, this.owner.searchPlatform)
      if (this.owner.searchSession !== session) {
        return
      }
      this.owner.remoteResults = results
      void this.hydrateAvatarsForCandidates(results)
    } catch (_) {
      if (this.owner.searchSession !== session) {
        return
      }
      this.owner.remoteResults = []
    } finally {
      if (this.owner.searchSession === session) {
        this.owner.isSearchingRemote = false
      }
    }
  }

  async handlePlatformSwitch(platform: DiscoverSearchPlatform): Promise<void> {
    if (this.owner.searchPlatform === platform) {
      return
    }

    this.owner.searchPlatform = platform
    this.owner.remoteResults = []

    if (!this.owner.query.trim()) {
      void this.hydrateAvatarsForCandidates(this.featuredFeedCandidates())
      return
    }

    this.owner.platformSwitchSession += 1
    const session = this.owner.platformSwitchSession
    this.owner.isPlatformSwitchSearching = true

    await Promise.all([
      this.refreshRemoteResults(),
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), PLATFORM_SWITCH_SETTLE_MS)
      }),
    ])

    if (this.owner.platformSwitchSession === session) {
      this.owner.isPlatformSwitchSearching = false
    }
  }

  async hydrateAvatarsForCandidates(candidates: ResolvedDiscoverCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      const key = this.owner.candidateAvatarCacheKey(candidate)
      if (this.owner.avatarOverrideMap.has(key) || this.owner.avatarHydratingKeys.has(key)) {
        continue
      }
      if (!this.owner.shouldHydrateCandidateAvatar(candidate)) {
        continue
      }

      this.owner.avatarHydratingKeys.add(key)
      try {
        const resolved = await SocialFeedAvatarService.resolveFeedAvatar(
          candidate.targetUrl,
          candidate.siteUrl,
          candidate.imageUrl ?? '',
          '',
        )
        const trimmedResolved = (resolved || '').trim()
        if (!trimmedResolved) {
          continue
        }

        const platform = this.owner.resolvedPlatformLabel(candidate)
        if (platform === 'Instagram' && isInstagramPlaceholderAvatar(trimmedResolved)) {
          continue
        }

        const current = this.owner.resolvedCandidateAvatarUrl(candidate).trim()
        if (!current || current !== trimmedResolved) {
          this.owner.avatarOverrideMap.set(key, trimmedResolved)
          this.owner.avatarOverrideVersion += 1
        }
      } catch (_) {
        // Keep original avatar URL when hydration fails.
      } finally {
        this.owner.avatarHydratingKeys.delete(key)
      }
    }
  }
}
