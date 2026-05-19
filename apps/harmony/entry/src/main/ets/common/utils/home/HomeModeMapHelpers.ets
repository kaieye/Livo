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


