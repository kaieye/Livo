import {
  HOME_MODE_INITIAL_CANDIDATE_LIMIT,
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
} from '../components/HomeRootConfig'
import { resolveHomeVisibleEntryInitialLimit } from './HomeVisibleEntryPolicy'

export function createHomeModeNumberMap(value: number): HomeModeScrollOffsetMap {
  return { articles: value, social: value, pictures: value, videos: value }
}

export function createHomeModeBooleanMap(value: boolean): HomeModeHasMoreMap {
  return { articles: value, social: value, pictures: value, videos: value }
}

export function createHomeCandidateLimitMap(): HomeModeCandidateLimitMap {
  return {
    articles: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
    social: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
    pictures: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
    videos: HOME_MODE_INITIAL_CANDIDATE_LIMIT,
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
  return createHomeModeBooleanMap(false) as HomeModePendingLoadMoreMap
}

export function createHomeLoadedMap(): HomeModeLoadedMap {
  return createHomeModeBooleanMap(false) as HomeModeLoadedMap
}

export function createHomeLoadingMap(): HomeModeLoadingMap {
  return createHomeModeBooleanMap(false) as HomeModeLoadingMap
}

export function createHomeLoadMoreTimestampMap(): HomeModeLoadMoreTimestampMap {
  return createHomeModeNumberMap(0) as HomeModeLoadMoreTimestampMap
}

export function createHomeNoProgressCountMap(): HomeModeNoProgressCountMap {
  return createHomeModeNumberMap(0) as HomeModeNoProgressCountMap
}

export function createHomeScrollOffsetMap(): HomeModeScrollOffsetMap {
  return createHomeModeNumberMap(0)
}

export function homeModeNumberValue(mode: SubscriptionMode, values: HomeModeScrollOffsetMap): number {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeCandidateLimitValue(mode: SubscriptionMode, values: HomeModeCandidateLimitMap): number {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeVisibleEntryLimitValue(mode: SubscriptionMode, values: HomeModeVisibleEntryLimitMap): number {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeNoProgressCountValue(mode: SubscriptionMode, values: HomeModeNoProgressCountMap): number {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeLoadMoreTimestampValue(mode: SubscriptionMode, values: HomeModeLoadMoreTimestampMap): number {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeModeBooleanValue(mode: SubscriptionMode, values: HomeModeHasMoreMap): boolean {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeModeLoadedValue(mode: SubscriptionMode, values: HomeModeLoadedMap): boolean {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeModeLoadingValue(mode: SubscriptionMode, values: HomeModeLoadingMap): boolean {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function homeModePendingLoadMoreValue(mode: SubscriptionMode, values: HomeModePendingLoadMoreMap): boolean {
  switch (mode) {
    case 'social': return values.social
    case 'pictures': return values.pictures
    case 'videos': return values.videos
    default: return values.articles
  }
}

export function withHomeModeNumberValue(
  mode: SubscriptionMode, value: number, values: HomeModeScrollOffsetMap,
): HomeModeScrollOffsetMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeModeBooleanValue(
  mode: SubscriptionMode, value: boolean, values: HomeModeHasMoreMap,
): HomeModeHasMoreMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeCandidateLimitValue(
  mode: SubscriptionMode, value: number, values: HomeModeCandidateLimitMap,
): HomeModeCandidateLimitMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeLoadedValue(
  mode: SubscriptionMode, value: boolean, values: HomeModeLoadedMap,
): HomeModeLoadedMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeLoadingValue(
  mode: SubscriptionMode, value: boolean, values: HomeModeLoadingMap,
): HomeModeLoadingMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeVisibleEntryLimitValue(
  mode: SubscriptionMode, value: number, values: HomeModeVisibleEntryLimitMap,
): HomeModeVisibleEntryLimitMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeNoProgressCountValue(
  mode: SubscriptionMode, value: number, values: HomeModeNoProgressCountMap,
): HomeModeNoProgressCountMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomePendingLoadMoreValue(
  mode: SubscriptionMode, value: boolean, values: HomeModePendingLoadMoreMap,
): HomeModePendingLoadMoreMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}

export function withHomeLoadMoreTimestampValue(
  mode: SubscriptionMode, value: number, values: HomeModeLoadMoreTimestampMap,
): HomeModeLoadMoreTimestampMap {
  return {
    articles: mode === 'articles' ? value : values.articles,
    social: mode === 'social' ? value : values.social,
    pictures: mode === 'pictures' ? value : values.pictures,
    videos: mode === 'videos' ? value : values.videos,
  }
}
