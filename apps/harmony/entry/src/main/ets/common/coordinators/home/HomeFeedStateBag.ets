import { EntryCardModel, HarmonySettings, DEFAULT_HARMONY_SETTINGS } from '../../models/LivoModels'
import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { HomeScrollIntentTracker } from './HomeScrollIntentTracker'
import { HomeEntryGroups, createEmptyHomeEntryGroups } from './HomeEntryGroups'
import { HomeFeedState } from './HomeFeedSessionOwner'
import {
  HOME_MODE_INITIAL_CANDIDATE_LIMIT,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeVisibleEntryLimitMap,
  SubscriptionMode,
} from '../../config/HomeRootConfig'
import {
  createHomeCandidateLimitMap,
  createHomeLoadedMap,
  createHomeLoadingMap,
  createPerModeMap,
  createHomeNoProgressCountMap,
  createHomeVisibleEntryLimitMap,
} from './HomeModeMapHelpers'

/**
 * Plain data holder implementing {@link HomeFeedState}.
 *
 * Owns every feed-state field that currently lives as @State on Index.
 * Because this is a regular class (no ArkUI decorators), it can be
 * instantiated in Node.js tests — the second adapter alongside Index
 * itself, which structurally satisfies HomeFeedState via its @State props.
 *
 * Production: Index continues to use its own @State fields directly.
 * Tests: construct a HomeFeedStateBag, configure it, and pass it into
 * coordinator constructors that accept HomeFeedState.
 */
export class HomeFeedStateBag implements HomeFeedState {
  // ── Core feed state ──
  mode: SubscriptionMode = 'articles'
  featuredEntries: EntryCardModel[] = []
  entryGroups: HomeEntryGroups<EntryCardModel> = createEmptyHomeEntryGroups()
  feedSourceLabel: string = '本地内容已加载'

  // ── Component lifecycle ──
  isComponentActive: boolean = false
  homeInitialLoadPending: boolean = true
  hasLoadedInitialData: boolean = false
  initialFeedCount: number = 0
  theme: ThemePalette = ThemeService.currentPalette()
  rootSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS

  // ── Refresh state ──
  isRefreshing: boolean = false
  isHomeStartupRefreshing: boolean = false
  refreshCompletedCount: number = 0
  refreshTotalCount: number = 0
  lastRefreshProgressUiUpdateAt: number = 0
  displayRefreshPercent: number = 0
  refreshPercentAnimationTimer: number = -1
  pendingRefreshPercentTarget: number = 0
  lastHomeRefreshFinishedAt: number = 0
  homePostRefreshReloadPending: boolean = false
  postRefreshReloadVersion: number = 0
  suppressFeedsChangedUntilMs: number = 0
  hasDeferredFeedsChangedReload: boolean = false
  deferredFeedsChangedRetryToken: number = 0
  feedsChangedReloadVersion: number = 0

  // ── Load-more state ──
  homeLoadMoreInProgress: boolean = false
  homeHasMoreEntries: boolean = true
  homeCandidateLimit: number = HOME_MODE_INITIAL_CANDIDATE_LIMIT
  homeCandidateLimitsByMode: HomeModeCandidateLimitMap = createHomeCandidateLimitMap()
  homeModeLoaded: HomeModeLoadedMap = createHomeLoadedMap()
  homeModeLoading: HomeModeLoadingMap = createHomeLoadingMap()
  homeVisibleEntryLimits: HomeModeVisibleEntryLimitMap = createHomeVisibleEntryLimitMap()
  homeHasMoreEntriesByMode: HomeModeHasMoreMap = createPerModeMap<boolean>(true)
  homeModeNoProgressLoadMoreCount: HomeModeNoProgressCountMap = createHomeNoProgressCountMap()
  homeLoadMorePrefetchToken: number = 0
  homeLoadMorePrefetchLimit: number = 0
  homeLoadMorePrefetchEntries: EntryCardModel[] = []
  homeLoadMorePrefetchMode: SubscriptionMode = 'articles'
  homeLoadMorePrefetchInProgress: boolean = false
  lastHomeLoadMoreRequestedAt: number = 0
  homeLoadMoreRequestToken: number = 0
  lastHomeLoadMoreCompletedAt: number = 0

  // ── UI interaction state ──
  searchOverlayVisible: boolean = false
  isModeTransitioning: boolean = false
  homeListSwapAnimating: boolean = false
  homeListSwapMode: SubscriptionMode = 'articles'
  homeListSwapToken: number = 0

  // ── Trackers (mutable via own API) ──
  homeScrollIntent: HomeScrollIntentTracker = new HomeScrollIntentTracker()
}
