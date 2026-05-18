import { EntryCardModel, HarmonySettings } from '../../models/LivoModels'
import { ThemePalette } from '../../services/ThemeService'
import { HomeScrollIntentTracker } from './HomeScrollIntentTracker'
import { HomeEntryGroups } from './HomeEntryGroups'
import {
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeVisibleEntryLimitMap,
  SubscriptionMode,
} from '../../components/HomeRootConfig'

/**
 * Readable and writable data properties consumed by home-feed coordinators
 * (HomeFeedRefresh, HomeFeedPagination, etc.).
 *
 * Split from the monolithic HomeFeedSessionOwner for consistency with the
 * existing HomeModeState / HomeModeActions and HomeInlineSearchState /
 * HomeInlineSearchActions patterns — a coordinator that only needs to
 * observe state can depend on HomeFeedState alone.
 */
export interface HomeFeedState {
  // Core feed state
  mode: SubscriptionMode
  featuredEntries: EntryCardModel[]
  entryGroups: HomeEntryGroups<EntryCardModel>
  feedSourceLabel: string

  // Component lifecycle
  isComponentActive: boolean
  homeInitialLoadPending: boolean
  hasLoadedInitialData: boolean
  initialFeedCount: number
  theme: ThemePalette
  rootSettings: HarmonySettings

  // Refresh state
  isRefreshing: boolean
  isHomeStartupRefreshing: boolean
  refreshCompletedCount: number
  refreshTotalCount: number
  lastRefreshProgressUiUpdateAt: number
  displayRefreshPercent: number
  refreshPercentAnimationTimer: number
  pendingRefreshPercentTarget: number
  lastHomeRefreshFinishedAt: number
  homePostRefreshReloadPending: boolean
  postRefreshReloadVersion: number
  suppressFeedsChangedUntilMs: number
  hasDeferredFeedsChangedReload: boolean
  deferredFeedsChangedRetryToken: number
  feedsChangedReloadVersion: number

  // Load-more state
  homeLoadMoreInProgress: boolean
  homeHasMoreEntries: boolean
  homeCandidateLimit: number
  homeCandidateLimitsByMode: HomeModeCandidateLimitMap
  homeModeLoaded: HomeModeLoadedMap
  homeModeLoading: HomeModeLoadingMap
  homeVisibleEntryLimits: HomeModeVisibleEntryLimitMap
  homeHasMoreEntriesByMode: HomeModeHasMoreMap
  homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap
  homeLoadMorePrefetchToken: number
  homeLoadMorePrefetchLimit: number
  homeLoadMorePrefetchEntries: EntryCardModel[]
  homeLoadMorePrefetchMode: SubscriptionMode
  homeLoadMorePrefetchInProgress: boolean
  lastHomeLoadMoreRequestedAt: number
  homeLoadMoreRequestToken: number
  lastHomeLoadMoreCompletedAt: number

  // UI interaction state
  searchOverlayVisible: boolean
  isModeTransitioning: boolean
  homeListSwapAnimating: boolean
  homeListSwapMode: SubscriptionMode
  homeListSwapToken: number

  // Tracker (read-only reference — mutations go through its own API)
  homeScrollIntent: HomeScrollIntentTracker
}

/**
 * Actions / methods consumed by home-feed coordinators.
 *
 * Split from HomeFeedSessionOwner so that a test can provide a narrow fake
 * implementing only the methods exercised by a single coordinator.
 */
export interface HomeFeedActions {
  // Diagnostics
  logHomePerf(message: string): void
  logHomeAsyncError(stage: string, error: Error | string | Object): void
  logHomeLoadMore(message: string): void
  logHomeLoadState(message: string): void
  describeError(error: Error | string | Object): string
  beginTweetPresentationDiagSession(mode: SubscriptionMode, reason: string, expectedStartIndex: number): void
  flushTweetPresentationDiagSession(reason: string): void

  // Runtime infra
  runManagedTimeout(callback: () => void, delayMs: number): void
  showToast(message: string, duration?: number): void

  // External coordinator delegation
  isHomeRootTab(): boolean
  hasHomeInlineSearchQuery(): boolean
  readHomeModeScrollOffset(mode: SubscriptionMode): number
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[]
  mergeFeaturedEntriesFromGroups(): EntryCardModel[]
  applyEntriesForMode(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    deferredPersist: boolean,
    skipNotify?: boolean,
    skipMerge?: boolean,
    skipPersist?: boolean,
  ): void
  settleInitialHomeLoadState(force?: boolean): void
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void
  notifyHomeEntryDataAppendedForMode(mode: SubscriptionMode, startIndex: number): void
  getItemRectForMode(mode: SubscriptionMode, index: number): RectResult

  // Notify descendant components that visible entries changed
  bumpHomeContentVersion(): void

  // Pagination delegation
  invalidateHomeLoadMorePrefetch(): void
  resetModeLoadMoreStates(reason: string): void
  scheduleHomeLoadMorePrefetch(delayMs?: number): void
  shouldRenderAllEntriesForMode(mode: SubscriptionMode): boolean
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean
  hasRecentHomeScrollIntent(): boolean
  handleHomeListEndReach(mode: SubscriptionMode, totalCount: number): void

  // Cross-module lifecycle methods
  reloadFeaturedEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
    targetMode?: SubscriptionMode,
  ): Promise<void>
  reloadHomeEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
  ): Promise<void>
}

/**
 * Monolithic owner interface kept for backward compatibility.
 *
 * New coordinator code should depend on HomeFeedState + HomeFeedActions
 * separately; existing code can continue to use this combined type.
 */
export interface HomeFeedSessionOwner extends HomeFeedState, HomeFeedActions {}