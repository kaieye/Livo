import { EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
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
} from '../components/HomeRootConfig'

export interface HomeFeedSessionOwner {
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
  homeScrollIntent: HomeScrollIntentTracker

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

  // Notify descendant components that visible entries (data or visible-limit) changed
  // so they re-evaluate @Builder children and pull fresh entries through callbacks.
  bumpHomeContentVersion(): void

  // Pagination delegation (called by HomeFeedRefresh)
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
