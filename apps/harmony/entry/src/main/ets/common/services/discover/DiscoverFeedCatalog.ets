import { FeedViewType } from '../../models/LivoModels'
import { builtinDiscoverFeedsAll } from '../../data/DiscoverBuiltinFeeds'
import trendingFeedSeeds from '../../data/discover-builtin-feeds/trending-feeds.json'
import { DiscoverSearchPlatform, RecommendedFeed } from './DiscoverTypes'
import { discoverFeedPlatform } from './DiscoverUrlParsing'
import { scoreRecommendedFeed } from './DiscoverCandidateScoring'

interface TrendingFeedSeed {
  title: string
  url: string
  siteUrl: string
  description?: string
  view: string
  category?: string
  sourceKey?: string
  imageUrl?: string
  followers?: string
}

interface TrendingFeedSeedFileShape {
  feeds?: TrendingFeedSeed[]
}

const RECOMMENDED_FEEDS: RecommendedFeed[] = builtinDiscoverFeedsAll()
let cachedTrendingFeedsFromJson: RecommendedFeed[] | null = null

function parseFeedView(viewRaw: string): FeedViewType {
  const normalized = (viewRaw || '').trim().toLowerCase()
  if (normalized === 'social' || normalized === 'socialmedia') {
    return FeedViewType.SocialMedia
  }
  if (normalized === 'pictures' || normalized === 'picture') {
    return FeedViewType.Pictures
  }
  if (normalized === 'videos' || normalized === 'video') {
    return FeedViewType.Videos
  }
  return FeedViewType.Articles
}

function normalizeTrendingFeedSeed(seed: TrendingFeedSeed): RecommendedFeed | undefined {
  const title = (seed.title || '').trim()
  const url = (seed.url || '').trim()
  const siteUrl = (seed.siteUrl || '').trim()
  if (!title || !url || !siteUrl) {
    return undefined
  }

  return {
    title,
    url,
    siteUrl,
    description: (seed.description || '').trim(),
    view: parseFeedView(seed.view),
    category: (seed.category || '热门推荐').trim(),
    sourceKey: (seed.sourceKey || '').trim(),
    imageUrl: (seed.imageUrl || '').trim(),
    followers: (seed.followers || '').trim(),
  }
}

function extractTrendingFeedSeeds(raw: Object | TrendingFeedSeed[] | TrendingFeedSeedFileShape): TrendingFeedSeed[] {
  if (Array.isArray(raw)) {
    return raw as TrendingFeedSeed[]
  }

  const fileShape = raw as TrendingFeedSeedFileShape
  if (Array.isArray(fileShape.feeds)) {
    return fileShape.feeds
  }

  return []
}

function trendingFallback(): RecommendedFeed[] {
  return RECOMMENDED_FEEDS.slice(0, 8)
}

function matchesRecommended(feed: RecommendedFeed, query: string): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return false
  }

  return feed.title.toLowerCase().includes(keyword)
    || feed.description.toLowerCase().includes(keyword)
    || feed.category.toLowerCase().includes(keyword)
    || feed.siteUrl.toLowerCase().includes(keyword)
}

export function filteredRecommendedFeeds(selectedView: FeedViewType, sourceKey: string = ''): RecommendedFeed[] {
  if (sourceKey) {
    return RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => (feed.sourceKey || '') === sourceKey)
  }

  return RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => {
    return feed.view === selectedView && !(feed.sourceKey || '')
  })
}

export function searchedRecommendedFeedsByPlatform(
  query: string,
  platform: DiscoverSearchPlatform,
): RecommendedFeed[] {
  const scoped = platform === 'all'
    ? RECOMMENDED_FEEDS
    : RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => discoverFeedPlatform(feed) === platform)
  const keyword = query.trim()
  if (!keyword) {
    return scoped
  }
  return scoped
    .filter((feed: RecommendedFeed) => matchesRecommended(feed, keyword))
    .sort((left: RecommendedFeed, right: RecommendedFeed) => {
      return scoreRecommendedFeed(right, keyword) - scoreRecommendedFeed(left, keyword)
    })
}

export function trendingDiscoverFeedsFromJsonNow(): RecommendedFeed[] {
  if (cachedTrendingFeedsFromJson) {
    return cachedTrendingFeedsFromJson
  }

  try {
    const parsed = extractTrendingFeedSeeds(trendingFeedSeeds as Object | TrendingFeedSeed[] | TrendingFeedSeedFileShape)
    const normalized: RecommendedFeed[] = []
    parsed.forEach((seed: TrendingFeedSeed) => {
      const item = normalizeTrendingFeedSeed(seed)
      if (item) {
        normalized.push(item)
      }
    })
    cachedTrendingFeedsFromJson = normalized.length > 0 ? normalized : trendingFallback()
  } catch (error) {
    console.warn(`[DiscoverService] Failed to load trending feeds from JSON: ${error instanceof Error ? error.message : 'unknown error'}`)
    cachedTrendingFeedsFromJson = trendingFallback()
  }

  return cachedTrendingFeedsFromJson
}
