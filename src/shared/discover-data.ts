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

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  { id: "tech", name: "科技", nameEn: "Technology", icon: "Cpu", description: "科技与互联网" },
  { id: "programming", name: "编程", nameEn: "Programming", icon: "Code", description: "开发与工程" },
  { id: "news", name: "新闻", nameEn: "News", icon: "Newspaper", description: "新闻与时事" },
  { id: "social", name: "社交", nameEn: "Social", icon: "Users", description: "社交媒体更新" },
]

export const CURATED_FEEDS: DiscoverFeed[] = [
  { title: "Hacker News", url: "https://hnrss.org/frontpage", siteUrl: "https://news.ycombinator.com", description: "Top stories from HN", category: "tech", language: "en" },
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com", description: "Tech and culture", category: "tech", language: "en" },
  { title: "InfoQ", url: "https://feed.infoq.com/", siteUrl: "https://www.infoq.com", description: "Software engineering news", category: "programming", language: "en" },
  { title: "OpenAI - X", url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/OpenAI`, siteUrl: "https://x.com/OpenAI", description: "OpenAI posts on X", category: "social", language: "en" },
]

export const RSSHUB_ROUTES: RSSHubRoute[] = [
  { name: "X User", url: "/twitter/user/:id", description: "X user timeline", category: "social" },
  { name: "YouTube Channel", url: "/youtube/channel/:id", description: "YouTube channel feed", category: "tech" },
  { name: "Bilibili Dynamic", url: "/bilibili/user/dynamic/:uid", description: "Bilibili user dynamics", category: "social" },
  { name: "Telegram Channel", url: "/telegram/channel/:name", description: "Telegram channel messages", category: "social" },
]

export interface RecommendedFeed {
  title: string
  url: string
  description: string
  isRSSHub: boolean
}

export interface RecommendedVideoFeed extends RecommendedFeed {}

export const RECOMMENDED_ARTICLE_FEEDS: RecommendedFeed[] = [
  { title: "Hacker News", url: "https://hnrss.org/frontpage", description: "Top stories from HN", isRSSHub: false },
  { title: "InfoQ", url: "https://feed.infoq.com/", description: "Software engineering news", isRSSHub: false },
]

export const RECOMMENDED_SOCIAL_FEEDS: RecommendedFeed[] = [
  { title: "OpenAI - X", url: "/twitter/user/OpenAI", description: "OpenAI posts on X", isRSSHub: true },
  { title: "Sam Altman - X", url: "/twitter/user/sama", description: "Sam Altman posts on X", isRSSHub: true },
]

export const RECOMMENDED_VIDEO_FEEDS: RecommendedVideoFeed[] = [
  { title: "Fireship - YouTube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA", description: "Dev news and tutorials", isRSSHub: false },
  { title: "Veritasium - YouTube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA", description: "Science videos", isRSSHub: false },
]

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

export const TRENDING_FEEDS: TrendingFeed[] = [
  { title: "Hacker News", url: "https://hnrss.org/frontpage", siteUrl: "https://news.ycombinator.com", description: "Top stories from HN", category: "tech", language: "en", reason: "High-signal technology news" },
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com", description: "Tech and culture", category: "tech", language: "en", reason: "Timely consumer tech coverage" },
]

export interface FeedBundle {
  id: string
  name: string
  description: string
  feeds: Array<{ title: string; url: string }>
}

export const FEED_BUNDLES: FeedBundle[] = [
  {
    id: "starter-tech",
    name: "Tech Starter",
    description: "Core technology feeds to get started quickly",
    feeds: [
      { title: "Hacker News", url: "https://hnrss.org/frontpage" },
      { title: "InfoQ", url: "https://feed.infoq.com/" },
      { title: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    ],
  },
  {
    id: "starter-social",
    name: "Social Starter",
    description: "Popular social timelines",
    feeds: [
      { title: "OpenAI - X", url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/OpenAI` },
      { title: "Sam Altman - X", url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/sama` },
    ],
  },
]
