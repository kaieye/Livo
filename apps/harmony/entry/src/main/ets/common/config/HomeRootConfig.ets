import { SymbolGlyphModifier } from '@kit.ArkUI'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { EntryCardModel } from '../models/LivoModels'
import {
  ROOT_MODE_RAIL_TOP_GAP,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
} from '../components/FloatingRootPageLayout'
import { BOTTOM_TAB_BAR_HEIGHT, BOTTOM_TAB_FLOAT_GAP } from '../ui/UiTokens'
import { resolveHdsBottomTabBarBottomMargin } from '../coordinators/index-home/HdsBottomTabConfig'
import { HOME_MODES, HomeMode } from '../coordinators/home/HomeModeMeta'
import { resolveHomeVisibleEntryInitialLimit } from '../coordinators/home/HomeVisibleEntryPolicy'

export type SubscriptionMode = HomeMode

export const SUBSCRIPTION_MODES: SubscriptionMode[] = HOME_MODES

// 首页根页面的布局和分页调参集中放置，避免页面文件继续膨胀。
export const MODE_SWIPE_TRIGGER_OFFSET: number = 56
export const HOME_MODE_CONTENT_GAP: number = 6
// 底部导航栏以悬浮重叠方式渲染，首页列表尾部需要留出可滚出的遮挡区。
export const HOME_MODE_BOTTOM_TAB_SPACER: number =
  BOTTOM_TAB_BAR_HEIGHT + resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP) + HOME_MODE_CONTENT_GAP

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
export const HOME_MODE_RAIL_HEIGHT: number = 48
export const HOME_MODE_SCENE_TOP_INSET: number =
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT + ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
export const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP + HOME_MODE_RAIL_HEIGHT
export const HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL: number = 22
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
export const HOME_FULL_MODE_CANDIDATE_LIMIT: number = 20000
export const HOME_LOAD_MORE_MIN_INTERVAL_MS: number = 120
export const HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS: number = 1200
// 用户反馈"加载更多触发过早"：item-appear（卡片露出）和 scroll-progress（滚动进度）
// 这两类提前触发器在视觉上让用户感觉"还没滑到底就开始抖动/加载"。改为只用
// onReachEnd（HomeFeedLoadMoreDrain）作为唯一触发，保证"真正滑到底"才发起 load-more。
// 保留开关方便后续如有需要重新开启远端预读。
export const HOME_LOAD_MORE_ITEM_APPEAR_TRIGGER_ENABLED: boolean = false
export const HOME_LOAD_MORE_SCROLL_PROGRESS_TRIGGER_ENABLED: boolean = false
export const HOME_LOAD_MORE_BACKGROUND_PREFETCH_ENABLED: boolean = true
export const HOME_LOAD_MORE_AFTER_STOP_DELAY_MS: number = 100
export const HOME_LOAD_MORE_ITEM_APPEAR_MIN_INTERVAL_MS: number = 800
export const HOME_LOAD_MORE_ITEM_APPEAR_DEBOUNCE_MS: number = 80
export const HOME_LOAD_MORE_POST_COMPLETE_COOLDOWN_MS: number = 120
export const HOME_LOAD_MORE_FETCH_AHEAD_PAGE_MULTIPLIER: number = 2
// LoadMoreFooter 最短可见时长。预取命中时实际耗时可能 < 50ms，但用户仍需要
// 看到"加载中"反馈才能感知到操作生效，否则会觉得"按了没反应"。
export const HOME_LOAD_MORE_FOOTER_MIN_VISIBLE_MS: number = 480
// onReachEnd 触发时如果用户仍在 fling（惯性滑动），同步执行 revealLoadedEntries
// 和 LazyForEach 增量通知会占用主线程几十~几百毫秒，把 fling 帧 abort 掉，
// 表现为「滑到最后一条一小部分就被强制停下」。drain 用 lastUserScrollAt 等待
// 至少 QUIESCENT_MS 没有滚动事件才执行真正的请求，给 fling 减速到停的时间。
export const HOME_LOAD_MORE_SCROLL_QUIESCENT_MS: number = 140
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

/** Generic per-mode value container — collapses 9 type-identical map interfaces. */
export interface PerModeMap<T> {
  articles: T
  social: T
  pictures: T
  videos: T
}

export type HomeModeScrollOffsetMap = PerModeMap<number>
export type HomeModeVisibleEntryLimitMap = PerModeMap<number>

export interface HomeEntryDataSourceMap {
  articles: ArrayLazyDataSource<EntryCardModel>
  social: ArrayLazyDataSource<EntryCardModel>
  pictures: ArrayLazyDataSource<EntryCardModel>
  videos: ArrayLazyDataSource<EntryCardModel>
}

export type HomeModePendingLoadMoreMap = PerModeMap<boolean>
export type HomeModeLoadMoreTimestampMap = PerModeMap<number>
export type HomeModeHasMoreMap = PerModeMap<boolean>
export type HomeModeNoProgressCountMap = PerModeMap<number>
export type HomeModeCandidateLimitMap = PerModeMap<number>
export type HomeModeLoadedMap = PerModeMap<boolean>
export type HomeModeLoadingMap = PerModeMap<boolean>
