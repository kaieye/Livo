import { FeaturedEntriesQuery } from '../data/FeaturedEntriesQuery'
import { EntryCardModel } from '../models/LivoModels'
import {
  HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import { resolveHomeVisibleEntryLoadMoreStep } from './HomeVisibleEntryPolicy'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'

// Owner-side hooks the prefetcher needs from HomeFeedPagination(State).
// Kept narrow so we do not pull the whole pagination class in.
export interface HomeFeedLoadMorePrefetchOwner {
  candidateLimitForMode(mode: SubscriptionMode): number
  modeHasMoreEntries(mode: SubscriptionMode): boolean
  shouldRenderAllEntriesForMode(mode: SubscriptionMode): boolean
}

// Background prefetch of next-page entries so requestLoadMoreForMode can
// hand back results synchronously when the user crosses the trigger zone.
export class HomeFeedLoadMorePrefetch {
  private readonly session: HomeFeedSessionOwner
  private readonly owner: HomeFeedLoadMorePrefetchOwner

  constructor(session: HomeFeedSessionOwner, owner: HomeFeedLoadMorePrefetchOwner) {
    this.session = session
    this.owner = owner
  }

  canPrefetch(): boolean {
    if (!HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED) {
      return false
    }
    return this.session.isComponentActive
      && this.session.isHomeRootTab()
      && !this.owner.shouldRenderAllEntriesForMode(this.session.mode)
      && !this.session.searchOverlayVisible
      && !this.session.hasHomeInlineSearchQuery()
      && !this.session.isRefreshing
      && !this.session.isHomeStartupRefreshing
      && !this.session.homeInitialLoadPending
      && !this.session.homeLoadMoreInProgress
      && this.session.homeHasMoreEntries
      && this.owner.modeHasMoreEntries(this.session.mode)
  }

  invalidate(): void {
    this.session.homeLoadMorePrefetchToken += 1
    this.session.homeLoadMorePrefetchInProgress = false
    this.session.homeLoadMorePrefetchLimit = 0
    this.session.homeLoadMorePrefetchEntries = []
    this.session.homeLoadMorePrefetchMode = this.session.mode
  }

  schedule(delayMs: number = 220): void {
    this.session.runManagedTimeout(() => {
      void this.run()
    }, delayMs)
  }

  async run(): Promise<void> {
    if (!this.canPrefetch()) {
      return
    }
    const mode = this.session.mode
    const currentLimit = this.owner.candidateLimitForMode(mode)
    const targetLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentLimit + resolveHomeVisibleEntryLoadMoreStep(mode),
    )
    if (targetLimit <= currentLimit) {
      return
    }
    if (this.session.homeLoadMorePrefetchLimit >= targetLimit && this.session.homeLoadMorePrefetchEntries.length > 0) {
      return
    }
    if (this.session.homeLoadMorePrefetchInProgress) {
      return
    }

    this.session.homeLoadMorePrefetchInProgress = true
    const token = this.session.homeLoadMorePrefetchToken + 1
    this.session.homeLoadMorePrefetchToken = token
    this.session.logHomeLoadMore(`prefetch start mode=${mode} currentLimit=${currentLimit} targetLimit=${targetLimit}`)

    try {
      const entries = await FeaturedEntriesQuery.featuredEntriesByMode(mode, targetLimit)
      if (!this.session.isComponentActive || this.session.homeLoadMorePrefetchToken !== token) {
        return
      }
      this.session.homeLoadMorePrefetchLimit = targetLimit
      this.session.homeLoadMorePrefetchEntries = entries
      this.session.homeLoadMorePrefetchMode = mode
      this.session.logHomeLoadMore(`prefetch done mode=${mode} targetLimit=${targetLimit} entries=${entries.length}`)
    } catch (_error) {
      this.session.logHomeLoadMore(`prefetch failed targetLimit=${targetLimit}`)
    } finally {
      if (this.session.homeLoadMorePrefetchToken === token) {
        this.session.homeLoadMorePrefetchInProgress = false
      }
    }
  }

  consume(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    if (this.session.homeLoadMorePrefetchMode !== mode) {
      return undefined
    }
    if (this.session.homeLoadMorePrefetchLimit < nextLimit || this.session.homeLoadMorePrefetchEntries.length === 0) {
      return undefined
    }
    const entries = this.session.homeLoadMorePrefetchEntries
    this.session.homeLoadMorePrefetchLimit = 0
    this.session.homeLoadMorePrefetchEntries = []
    this.session.homeLoadMorePrefetchInProgress = false
    this.session.logHomeLoadMore(`consume-prefetch nextLimit=${nextLimit} entries=${entries.length}`)
    return entries
  }
}
