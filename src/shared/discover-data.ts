/**
 * Curated RSS feed directory for Discover.
 */

export interface DiscoverCategory {
  id: string
  name: string
  nameEn: string
  icon: string
  description: string
}

export interface DiscoverFeed {
  title: string
  url: string
  siteUrl: string
  description: string
  category: string
  language: string
  imageUrl?: string
}

export interface RSSHubRoute {
  name: string
  url: string
  description: string
  category: string
}

export const DEFAULT_RSSHUB_INSTANCE = "https://rsshub.pseudoyu.com"

export const DISCOVER_CATEGORIES: DiscoverCategory[] = []

export const CURATED_FEEDS: DiscoverFeed[] = []

export const RSSHUB_ROUTES: RSSHubRoute[] = []

export interface RecommendedFeed {
  title: string
  url: string
  description: string
  isRSSHub: boolean
}

export interface RecommendedVideoFeed extends RecommendedFeed {}

export const RECOMMENDED_ARTICLE_FEEDS: RecommendedFeed[] = []

export const RECOMMENDED_SOCIAL_FEEDS: RecommendedFeed[] = []

export const RECOMMENDED_VIDEO_FEEDS: RecommendedVideoFeed[] = []

export function searchCuratedFeeds(query: string): DiscoverFeed[] {
  const q = query.toLowerCase().trim()
  if (!q) return CURATED_FEEDS
  return CURATED_FEEDS.filter((f) =>
    f.title.toLowerCase().includes(q) ||
    f.description.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q) ||
    f.siteUrl.toLowerCase().includes(q),
  )
}

export interface TrendingFeed {
  title: string
  url: string
  siteUrl: string
  description: string
  category: string
  language: string
  reason: string
}

export const TRENDING_FEEDS: TrendingFeed[] = []

export interface FeedBundle {
  id: string
  name: string
  description: string
  feeds: Array<{ title: string; url: string }>
}

export const FEED_BUNDLES: FeedBundle[] = []
