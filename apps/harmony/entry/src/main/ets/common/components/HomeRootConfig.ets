import { SymbolGlyphModifier } from '@kit.ArkUI'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { EntryCardModel } from '../models/LivoModels'
import {
  ROOT_MODE_RAIL_TOP_GAP,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
} from './FloatingRootPageLayout'
import { HOME_MODES, HomeMode } from '../utils/HomeModeMeta'
import { resolveHomeVisibleEntryInitialLimit } from '../utils/HomeVisibleEntryPolicy'

export type SubscriptionMode = HomeMode

export const SUBSCRIPTION_MODES: SubscriptionMode[] = HOME_MODES

// 首页根页面的布局和分页调参集中放置，避免页面文件继续膨胀。
export const MODE_SWIPE_TRIGGER_OFFSET: number = 56
export const HOME_MODE_CONTENT_GAP: number = 6

export const HOME_LIST_SWAP_ENTER_DURATION: number = 180
export const HOME_LIST_SWAP_ENTRY_OFFSET_Y: number = 8
export const HOME_LIST_SWAP_ENTRY_MIN_OPACITY: number = 0.88
export const HOME_LIST_SWAP_ANIMATION_ENABLED: boolean = true

export const HEADER_BLUR_SCROLL_RANGE: number = 72
export const ROOT_TITLE_BAR_MINI_HEIGHT: number = 56
export const HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
export const HOME_TITLE_BAR_OVERLAY_SPACER: number =
  ROOT_TITLE_BAR_MINI_HEIGHT + HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
export const HOME_MODE_CONTENT_TOP_SPACER_HEIGHT: number = HOME_TITLE_BAR_OVERLAY_SPACER
export const HOME_MODE_RAIL_HEIGHT: number = 46
export const HOME_MODE_SCENE_TOP_INSET: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT + ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
export const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
export const HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL: number = 32
export const ROOT_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
export const HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET: number = 0
export const HOME_COLLAPSED_MODE_RAIL_SIZE: number = 40
export const HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA: number = 14
export const HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT: number = -6
export const HOME_COLLAPSED_MODE_RAIL_TOP_PADDING: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT - HOME_COLLAPSED_MODE_RAIL_SIZE - ROOT_MODE_RAIL_TOP_GAP

export const HOME_INLINE_SEARCH_ACTION_SIZE: number = 40
export const HOME_INLINE_SEARCH_ACTION_GAP: number = 8
export const HOME_INLINE_SEARCH_RESULT_LIMIT: number = 6
export const HOME_INLINE_SEARCH_VERTICAL_TRAVEL: number = 18
export const HOME_MODE_SCENE_TRANSITION_DURATION: number = 180

export const HOME_REFRESH_FIRST_SWAP_DELAY_MS: number = 72
export const HOME_REFRESH_FINAL_RELOAD_DELAY_MS: number = 460
export const HOME_REFRESH_PERCENT_COALESCE_MS: number = 60
export const HOME_REFRESH_PROGRESS_UI_THROTTLE_MS: number = 180
export const HOME_FINAL_RELOAD_IDLE_RETRY_MS: number = 120
export const HOME_FINAL_RELOAD_IDLE_MAX_RETRIES: number = 10
export const HOME_REFRESH_RESET_DEFER_MS: number = 32
export const HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS: number = 260
export const HOME_ENTRY_GROUP_DEFER_DELAY_MS: number = 96

export const HOME_MAX_CANDIDATE_LIMIT: number = 480
export const HOME_INITIAL_CANDIDATE_LIMIT: number = HOME_MAX_CANDIDATE_LIMIT
export const HOME_MODE_INITIAL_CANDIDATE_LIMIT: number = resolveHomeVisibleEntryInitialLimit('articles')
export const HOME_MODE_SWITCH_CANDIDATE_LIMIT: number = HOME_MODE_INITIAL_CANDIDATE_LIMIT
export const HOME_LOAD_MORE_MAX_CANDIDATE_LIMIT: number = 6000
export const HOME_FULL_MODE_CANDIDATE_LIMIT: number = 2147483647
export const HOME_LOAD_MORE_MIN_INTERVAL_MS: number = 120
export const HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS: number = 1200
export const HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED: boolean = true
export const HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED: boolean = true
export const HOME_LOAD_MORE_AFTER_STOP_DELAY_MS: number = 100
export const HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS: number = 800
export const HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS: number = 80
export const HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS: number = 120
export const HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER: number = 2
export const HOME_FAST_PAGE_CACHE_BUFFER: number = 60
export const HOME_LOAD_MORE_NEAR_END_TRIGGER_MIN_COUNT: number = 8
export const HOME_LOAD_MORE_NEAR_END_TRIGGER_DIVISOR: number = 3

export const HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS: number = 1200
export const HOME_STARTUP_REFRESH_COOLDOWN_MS: number = 3 * 60 * 1000
export const AUTO_REFRESH_MIN_INTERVAL_MINUTES: number = 1

export const HOME_GROUP_DEBUG_ENABLED: boolean = false
export const HOME_GROUP_DEBUG_PREFIX: string = '[FeedFetchStateDebug][HomeGroup]'
export const HOME_MODE_DEBUG_ENABLED: boolean = false
export const HOME_MODE_DEBUG_PREFIX: string = '[FeedFetchStateDebug][ModeSwitch]'
export const HOME_LOAD_MORE_DEBUG_ENABLED: boolean = true
export const HOME_LOAD_MORE_DEBUG_PREFIX: string = '[FeedFetchStateDebug][LoadMore]'
export const HOME_PERF_DIAG_ENABLED: boolean = true
export const HOME_PERF_DIAG_PREFIX: string = '[HomePerfDiag]'
export const HOME_LOAD_STATE_DIAG_ENABLED: boolean = true
export const HOME_LOAD_STATE_DIAG_PREFIX: string = '[HomeLoadStateDiag]'
export const HOME_ASYNC_ERROR_DEBUG_ENABLED: boolean = true
export const HOME_ASYNC_ERROR_PREFIX: string = '[HomeAsyncError]'

export interface RootTabSymbolPair {
  normal: SymbolGlyphModifier
  selected: SymbolGlyphModifier
}

export interface HomeModeRailOptions {
  collapsed?: boolean
  collapseProgress?: number
}

export interface HomeModeScrollOffsetMap {
  articles: number
  social: number
  pictures: number
  videos: number
}

export interface HomeModeVisibleEntryLimitMap {
  articles: number
  social: number
  pictures: number
  videos: number
}

export interface HomeEntryDataSourceMap {
  articles: ArrayLazyDataSource<EntryCardModel>
  social: ArrayLazyDataSource<EntryCardModel>
  pictures: ArrayLazyDataSource<EntryCardModel>
  videos: ArrayLazyDataSource<EntryCardModel>
}

export interface HomeModePendingLoadMoreMap {
  articles: boolean
  social: boolean
  pictures: boolean
  videos: boolean
}

export interface HomeModeLoadMoreTimestampMap {
  articles: number
  social: number
  pictures: number
  videos: number
}

export interface HomeModeHasMoreMap {
  articles: boolean
  social: boolean
  pictures: boolean
  videos: boolean
}

export interface HomeModeNoProgressCountMap {
  articles: number
  social: number
  pictures: number
  videos: number
}

export interface HomeModeCandidateLimitMap {
  articles: number
  social: number
  pictures: number
  videos: number
}

export interface HomeModeLoadedMap {
  articles: boolean
  social: boolean
  pictures: boolean
  videos: boolean
}

export interface HomeModeLoadingMap {
  articles: boolean
  social: boolean
  pictures: boolean
  videos: boolean
}
