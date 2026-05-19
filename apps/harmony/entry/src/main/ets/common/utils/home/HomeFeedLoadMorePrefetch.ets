import { FeaturedEntriesQuery } from '../../data/FeaturedEntriesQuery'
import { EntryCardModel } from '../../models/LivoModels'
import {
  HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED,
  HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER,
  HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { resolveHomeVisibleEntryLoadMoreStep } from './HomeVisibleEntryPolicy'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { HomeFeedGuard, HomeFeedGuardProvider } from './HomeFeedGuard'
import { mergeUniqueEntries } from './HomeEntryUtils'

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
  private readonly state: HomeFeedState
  private readonly actions: HomeFeedActions
  private readonly owner: HomeFeedLoadMorePrefetchOwner
  private readonly featuredEntriesQuery: FeaturedEntriesQuery
  private readonly guard: HomeFeedGuard

  constructor(
    state: HomeFeedState,
    actions: HomeFeedActions,
    owner: HomeFeedLoadMorePrefetchOwner,
    featuredEntriesQuery?: FeaturedEntriesQuery,
  ) {
    this.state = state
    this.actions = actions
    this.owner = owner
    this.featuredEntriesQuery = featuredEntriesQuery ?? FeaturedEntriesQuery.default
    const provider = new HomeFeedGuardProvider(
      () => actions.isHomeRootTab(),
      () => actions.hasHomeInlineSearchQuery(),
      () => false,
      (_mode: SubscriptionMode) => false,
      (mode: SubscriptionMode) => owner.shouldRenderAllEntriesForMode(mode),
      (_mode: SubscriptionMode) => false,
      (mode: SubscriptionMode) => owner.modeHasMoreEntries(mode),
      (_mode: SubscriptionMode) => 0,
    )
    this.guard = new HomeFeedGuard(state, provider)
  }

  canPrefetch(): boolean {
    if (!HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED) {
      return false
    }
    return this.guard.canPrefetch()
  }

  invalidate(): void {
    this.state.homeLoadMorePrefetchToken += 1
    this.state.homeLoadMorePrefetchInProgress = false
    this.state.homeLoadMorePrefetchLimit = 0
    this.state.homeLoadMorePrefetchEntries = []
    this.state.homeLoadMorePrefetchMode = this.state.mode
  }

  schedule(delayMs: number = 220): void {
    this.actions.runManagedTimeout(() => {
      void this.run()
    }, delayMs)
  }

  private prefetchPageMultiplier(mode: SubscriptionMode): number {
    if (mode === 'articles') {
      return Math.max(2, HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER)
    }
    return HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER
  }

  async run(): Promise<void> {
    if (!this.canPrefetch()) {
      return
    }
    const mode = this.state.mode
    const currentLimit = this.owner.candidateLimitForMode(mode)
    const step = resolveHomeVisibleEntryLoadMoreStep(mode)
    const targetLimit = Math.min(
      HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT,
      currentLimit + step * this.prefetchPageMultiplier(mode),
    )
    if (targetLimit <= currentLimit) {
      return
    }
    if (this.state.homeLoadMorePrefetchLimit >= targetLimit && this.state.homeLoadMorePrefetchEntries.length > 0) {
      return
    }
    if (this.state.homeLoadMorePrefetchInProgress) {
      return
    }

    this.state.homeLoadMorePrefetchInProgress = true
    const token = this.state.homeLoadMorePrefetchToken + 1
    this.state.homeLoadMorePrefetchToken = token
    this.actions.logHomeLoadMore(`prefetch start mode=${mode} currentLimit=${currentLimit} targetLimit=${targetLimit}`)

    try {
      const previousEntries = this.actions.filteredEntriesFor(mode)
      const appendCount = Math.max(1, targetLimit - previousEntries.length)
      const nextPage = await this.featuredEntriesQuery.featuredEntriesFastPageByMode(mode, appendCount, previousEntries.length)
      if (!this.state.isComponentActive || this.state.homeLoadMorePrefetchToken !== token) {
        return
      }
      const entries = mergeUniqueEntries(previousEntries, nextPage, targetLimit)
      if (entries.length <= previousEntries.length) {
        this.actions.logHomeLoadMore(
          `prefetch skip-no-growth mode=${mode} targetLimit=${targetLimit} previous=${previousEntries.length} page=${nextPage.length}`,
        )
        return
      }
      this.state.homeLoadMorePrefetchLimit = targetLimit
      this.state.homeLoadMorePrefetchEntries = entries
      this.state.homeLoadMorePrefetchMode = mode
      this.actions.logHomeLoadMore(`prefetch done mode=${mode} targetLimit=${targetLimit} entries=${entries.length}`)
    } catch (_error) {
      this.actions.logHomeLoadMore(`prefetch failed targetLimit=${targetLimit}`)
    } finally {
      if (this.state.homeLoadMorePrefetchToken === token) {
        this.state.homeLoadMorePrefetchInProgress = false
      }
    }
  }

  consume(mode: SubscriptionMode, nextLimit: number): EntryCardModel[] | undefined {
    if (this.state.homeLoadMorePrefetchMode !== mode) {
      return undefined
    }
    if (this.state.homeLoadMorePrefetchLimit < nextLimit || this.state.homeLoadMorePrefetchEntries.length === 0) {
      return undefined
    }
    const entries = this.state.homeLoadMorePrefetchEntries.slice(0, nextLimit)
    const remainingPrefetchedLimit = this.state.homeLoadMorePrefetchLimit
    this.state.homeLoadMorePrefetchEntries = this.state.homeLoadMorePrefetchEntries
    this.state.homeLoadMorePrefetchInProgress = false
    this.actions.logHomeLoadMore(
      `consume-prefetch nextLimit=${nextLimit} entries=${entries.length} prefetchedLimit=${remainingPrefetchedLimit}`,
    )
    if (remainingPrefetchedLimit === nextLimit) {
      this.state.homeLoadMorePrefetchLimit = 0
      this.state.homeLoadMorePrefetchEntries = []
    }
    return entries
  }
}