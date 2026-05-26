import { SubscriptionMode } from '../../config/HomeRootConfig'
import { HomeFeedState } from './HomeFeedSessionOwner'

/**
 * Narrow callable provider consumed by HomeFeedGuard predicates.
 *
 * MUST be a class (not an interface) because ArkTS forbids structural typing —
 * coordinators instantiate this with `new HomeFeedGuardProvider(...)`.
 */
export class HomeFeedGuardProvider {
  readonly isHomeRootTab: () => boolean
  readonly hasHomeInlineSearchQuery: () => boolean
  readonly hasRecentHomeScrollIntent: () => boolean
  readonly pendingLoadMoreForMode: (mode: SubscriptionMode) => boolean
  readonly shouldRenderAllEntriesForMode: (mode: SubscriptionMode) => boolean
  readonly hasBufferedEntriesForMode: (mode: SubscriptionMode) => boolean
  readonly modeHasMoreEntries: (mode: SubscriptionMode) => boolean
  readonly readHomeModeScrollOffset: (mode: SubscriptionMode) => number

  constructor(
    isHomeRootTab: () => boolean,
    hasHomeInlineSearchQuery: () => boolean,
    hasRecentHomeScrollIntent: () => boolean,
    pendingLoadMoreForMode: (mode: SubscriptionMode) => boolean,
    shouldRenderAllEntriesForMode: (mode: SubscriptionMode) => boolean,
    hasBufferedEntriesForMode: (mode: SubscriptionMode) => boolean,
    modeHasMoreEntries: (mode: SubscriptionMode) => boolean,
    readHomeModeScrollOffset: (mode: SubscriptionMode) => number,
  ) {
    this.isHomeRootTab = isHomeRootTab
    this.hasHomeInlineSearchQuery = hasHomeInlineSearchQuery
    this.hasRecentHomeScrollIntent = hasRecentHomeScrollIntent
    this.pendingLoadMoreForMode = pendingLoadMoreForMode
    this.shouldRenderAllEntriesForMode = shouldRenderAllEntriesForMode
    this.hasBufferedEntriesForMode = hasBufferedEntriesForMode
    this.modeHasMoreEntries = modeHasMoreEntries
    this.readHomeModeScrollOffset = readHomeModeScrollOffset
  }
}

/**
 * Encapsulates the shared boolean-state conjunctions that were previously
 * duplicated across HomeFeedPagination, HomeFeedLoadMorePrefetch,
 * HomeFeedRefresh, and HomeFeedLoadMoreDrain.
 *
 * Adding a new guard condition (e.g. "suppress all fetches when battery is low")
 * now changes ONE file instead of 4-5.
 */
export class HomeFeedGuard {
  private readonly state: HomeFeedState
  private readonly p: HomeFeedGuardProvider

  constructor(state: HomeFeedState, provider: HomeFeedGuardProvider) {
    this.state = state
    this.p = provider
  }

  /**
   * Can the client load more entries for `mode`?
   *
   * Replaces the 8-condition conjunction formerly in
   * HomeFeedPagination.canLoadMoreForMode().
   */
  canLoadMore(mode: SubscriptionMode): boolean {
    if (this.p.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const hasBuffered = this.p.hasBufferedEntriesForMode(mode)
    return this.p.isHomeRootTab()
      && mode === this.state.mode
      && (hasBuffered || this.p.modeHasMoreEntries(mode))
      && !this.state.searchOverlayVisible
      && !this.p.hasHomeInlineSearchQuery()
      && !this.state.homeInitialLoadPending
      && !this.state.homeLoadMoreInProgress
      && (hasBuffered || this.state.homeHasMoreEntries)
  }

  /**
   * Can the prefetcher run a background fetch for the current mode?
   *
   * The caller is responsible for checking HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED
   * (a build-time flag, not runtime state).
   *
   * Replaces the 12-condition conjunction formerly in
   * HomeFeedLoadMorePrefetch.canPrefetch().
   */
  canPrefetch(): boolean {
    return this.state.isComponentActive
      && this.p.isHomeRootTab()
      && !this.state.homeScrollIntent.isInteracting
      && !this.p.shouldRenderAllEntriesForMode(this.state.mode)
      && !this.state.searchOverlayVisible
      && !this.p.hasHomeInlineSearchQuery()
      && !this.state.isRefreshing
      && !this.state.isHomeStartupRefreshing
      && !this.state.homeInitialLoadPending
      && !this.state.homeLoadMoreInProgress
      && this.state.homeHasMoreEntries
      && this.p.modeHasMoreEntries(this.state.mode)
  }

  /**
   * Is the system idle enough for a post-refresh home reload?
   *
   * Replaces the 12-condition conjunction formerly in
   * HomeFeedRefresh.shouldRunFinalHomeReloadNow().
   */
  canReloadNow(
    currentOffset: number,
    shouldApplyLengthGuard: boolean,
    maxScrollOffset: number,
    maxCandidateLimit: number,
  ): boolean {
    return this.state.isComponentActive
      && this.p.isHomeRootTab()
      && !this.state.isRefreshing
      && !this.state.isHomeStartupRefreshing
      && !this.state.isModeTransitioning
      && !this.state.homeListSwapAnimating
      && !this.state.searchOverlayVisible
      && !this.state.homeScrollIntent.isInteracting
      && !this.state.homeLoadMoreInProgress
      && !this.p.pendingLoadMoreForMode(this.state.mode)
      && !this.p.hasRecentHomeScrollIntent()
      && currentOffset < maxScrollOffset
      && (!shouldApplyLengthGuard || this.state.featuredEntries.length <= maxCandidateLimit)
  }

  /**
   * Can the drain controller step forward for `mode`?
   *
   * Replaces the 7-condition conjunction formerly in
   * HomeFeedLoadMoreDrain.canRun().
   */
  canDrain(mode: SubscriptionMode, totalCount: number): boolean {
    if (totalCount <= 0) {
      return false
    }
    return this.state.isComponentActive
      && this.p.isHomeRootTab()
      && mode === this.state.mode
      && !this.state.searchOverlayVisible
      && !this.p.hasHomeInlineSearchQuery()
      && (this.p.hasBufferedEntriesForMode(mode) || this.p.modeHasMoreEntries(mode))
  }
}
