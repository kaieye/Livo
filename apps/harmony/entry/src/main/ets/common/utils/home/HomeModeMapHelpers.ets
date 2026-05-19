import {
  PerModeMap,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeLoadMoreTimestampMap,
  HomeModeNoProgressCountMap,
  HomeModePendingLoadMoreMap,
  HomeModeScrollOffsetMap,
  HomeModeVisibleEntryLimitMap,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { resolveHomeVisibleEntryInitialLimit } from './HomeVisibleEntryPolicy'

// ── Generic per-mode-map operations ──────────────────────────────────────
//
// Previously 32 nearly-identical functions (8 map types × 4 operations each).
// Now collapsed to 2 generic functions + 2 factory helpers.  Adding a new
// per-mode state field is a one-liner type alias instead of copy-pasting
// 4 functions.

/** Read the value for `mode` from a PerModeMap<T>. */
export function perModeGet<T>(mode: SubscriptionMode, map: PerModeMap<T>): T {
  switch (mode) {
    case 'social': return map.social
    case 'pictures': return map.pictures
    case 'videos': return map.videos
    default: return map.articles
  }
}

/** Return a new PerModeMap<T> with `mode` updated to `value`, other modes unchanged. */
export function perModeSet<T>(mode: SubscriptionMode, value: T, map: PerModeMap<T>): PerModeMap<T> {
  return {
    articles: mode === 'articles' ? value : map.articles,
    social: mode === 'social' ? value : map.social,
    pictures: mode === 'pictures' ? value : map.pictures,
    videos: mode === 'videos' ? value : map.videos,
  }
}

/** Create a PerModeMap<T> with the same `value` for all four modes. */
export function createPerModeMap<T>(value: T): PerModeMap<T> {
  return { articles: value, social: value, pictures: value, videos: value }
}

/** @deprecated Use createPerModeMap<boolean>(value) instead. */
export function createHomeModeBooleanMap(value: boolean): PerModeMap<boolean> {
  return createPerModeMap(value)
}

/** @deprecated Use createPerModeMap<number>(value) instead. */
export function createHomeModeNumberMap(value: number): PerModeMap<number> {
  return createPerModeMap(value)
}

// ── Specialized factories that compute per-mode initial values ───────────

export function createHomeCandidateLimitMap(): HomeModeCandidateLimitMap {
  return {
    articles: resolveHomeVisibleEntryInitialLimit('articles'),
    social: resolveHomeVisibleEntryInitialLimit('social'),
    pictures: resolveHomeVisibleEntryInitialLimit('pictures'),
    videos: resolveHomeVisibleEntryInitialLimit('videos'),
  }
}

export function createHomeVisibleEntryLimitMap(): HomeModeVisibleEntryLimitMap {
  return {
    articles: resolveHomeVisibleEntryInitialLimit('articles'),
    social: resolveHomeVisibleEntryInitialLimit('social'),
    pictures: resolveHomeVisibleEntryInitialLimit('pictures'),
    videos: resolveHomeVisibleEntryInitialLimit('videos'),
  }
}

export function createHomePendingLoadMoreMap(): HomeModePendingLoadMoreMap {
  return createPerModeMap<boolean>(false)
}

export function createHomeLoadedMap(): HomeModeLoadedMap {
  return createPerModeMap<boolean>(false)
}

export function createHomeLoadingMap(): HomeModeLoadingMap {
  return createPerModeMap<boolean>(false)
}

export function createHomeLoadMoreTimestampMap(): HomeModeLoadMoreTimestampMap {
  return createPerModeMap<number>(0)
}

export function createHomeNoProgressCountMap(): HomeModeNoProgressCountMap {
  return createPerModeMap<number>(0)
}

export function createHomeScrollOffsetMap(): HomeModeScrollOffsetMap {
  return createPerModeMap<number>(0)
}

// ── Backward-compatible getters (delegate to perModeGet) ─────────────────

export function homeModeNumberValue(mode: SubscriptionMode, values: HomeModeScrollOffsetMap): number {
  return perModeGet(mode, values)
}

export function homeCandidateLimitValue(mode: SubscriptionMode, values: HomeModeCandidateLimitMap): number {
  return perModeGet(mode, values)
}

export function homeVisibleEntryLimitValue(mode: SubscriptionMode, values: HomeModeVisibleEntryLimitMap): number {
  return perModeGet(mode, values)
}

export function homeNoProgressCountValue(mode: SubscriptionMode, values: HomeModeNoProgressCountMap): number {
  return perModeGet(mode, values)
}

export function homeLoadMoreTimestampValue(mode: SubscriptionMode, values: HomeModeLoadMoreTimestampMap): number {
  return perModeGet(mode, values)
}

export function homeModeBooleanValue(mode: SubscriptionMode, values: HomeModeHasMoreMap): boolean {
  return perModeGet(mode, values)
}

export function homeModeLoadedValue(mode: SubscriptionMode, values: HomeModeLoadedMap): boolean {
  return perModeGet(mode, values)
}

export function homeModeLoadingValue(mode: SubscriptionMode, values: HomeModeLoadingMap): boolean {
  return perModeGet(mode, values)
}

export function homeModePendingLoadMoreValue(mode: SubscriptionMode, values: HomeModePendingLoadMoreMap): boolean {
  return perModeGet(mode, values)
}

// ── Backward-compatible setters (delegate to perModeSet) ─────────────────

export function withHomeModeNumberValue(
  mode: SubscriptionMode, value: number, values: HomeModeScrollOffsetMap,
): HomeModeScrollOffsetMap {
  return perModeSet(mode, value, values)
}

export function withHomeModeBooleanValue(
  mode: SubscriptionMode, value: boolean, values: HomeModeHasMoreMap,
): HomeModeHasMoreMap {
  return perModeSet(mode, value, values)
}

export function withHomeCandidateLimitValue(
  mode: SubscriptionMode, value: number, values: HomeModeCandidateLimitMap,
): HomeModeCandidateLimitMap {
  return perModeSet(mode, value, values)
}

export function withHomeLoadedValue(
  mode: SubscriptionMode, value: boolean, values: HomeModeLoadedMap,
): HomeModeLoadedMap {
  return perModeSet(mode, value, values)
}

export function withHomeLoadingValue(
  mode: SubscriptionMode, value: boolean, values: HomeModeLoadingMap,
): HomeModeLoadingMap {
  return perModeSet(mode, value, values)
}

export function withHomeVisibleEntryLimitValue(
  mode: SubscriptionMode, value: number, values: HomeModeVisibleEntryLimitMap,
): HomeModeVisibleEntryLimitMap {
  return perModeSet(mode, value, values)
}

export function withHomeNoProgressCountValue(
  mode: SubscriptionMode, value: number, values: HomeModeNoProgressCountMap,
): HomeModeNoProgressCountMap {
  return perModeSet(mode, value, values)
}

export function withHomePendingLoadMoreValue(
  mode: SubscriptionMode, value: boolean, values: HomeModePendingLoadMoreMap,
): HomeModePendingLoadMoreMap {
  return perModeSet(mode, value, values)
}

export function withHomeLoadMoreTimestampValue(
  mode: SubscriptionMode, value: number, values: HomeModeLoadMoreTimestampMap,
): HomeModeLoadMoreTimestampMap {
  return perModeSet(mode, value, values)
}
