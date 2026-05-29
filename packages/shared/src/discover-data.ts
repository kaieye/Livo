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

export const DEFAULT_RSSHUB_INSTANCE = 'https://rsshub.pseudoyu.com'
export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  {
    id: 'ai',
    name: '人工智能',
    nameEn: 'AI',
    icon: '🤖',
    description: 'AI blogs, papers, tools and products',
  },
  {
    id: 'articles',
    name: '文章精选',
    nameEn: 'Articles',
    icon: '📝',
    description: 'Curated articles from top blogs and publications',
  },
  {
    id: 'news',
    name: '新闻资讯',
    nameEn: 'News',
    icon: '📰',
    description: 'Mainstream news from Chinese and international media',
  },
  {
    id: 'social',
    name: '社交媒体',
    nameEn: 'Social',
    icon: '💬',
    description: 'Social media and community discussions',
  },
  {
    id: 'videos',
    name: '视频',
    nameEn: 'Videos',
    icon: '🎬',
    description: 'Video channels and media',
  },
  {
    id: 'pictures',
    name: '图片',
    nameEn: 'Pictures',
    icon: '🖼️',
    description: 'Daily photos and visual content',
  },
  {
    id: 'podcast',
    name: '播客',
    nameEn: 'Podcast',
    icon: '🎙️',
    description: 'Podcasts and audio-first content',
  },
]

export const CURATED_FEEDS: DiscoverFeed[] = [
  // ===== AI =====
  {
    title: '机器之心',
    url: 'https://www.jiqizhixin.com/rss',
    siteUrl: 'https://www.jiqizhixin.com',
    description: '国内领先 AI 科技媒体，深度报道人工智能前沿研究与产业动态',
    category: 'ai',
    language: 'Chinese',
  },
  {
    title: '量子位',
    url: 'https://www.qbitai.com/feed',
    siteUrl: 'https://www.qbitai.com',
    description: '追踪人工智能新趋势，报道科技行业新突破',
    category: 'ai',
    language: 'Chinese',
  },
  {
    title: 'OpenAI Blog',
    url: 'https://openai.com/news/rss.xml',
    siteUrl: 'https://openai.com',
    description:
      'OpenAI official blog covering GPT research and product updates',
    category: 'ai',
    language: 'English',
  },
  {
    title: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    siteUrl: 'https://huggingface.co/blog',
    description: 'Open-source AI models, tools and community updates',
    category: 'ai',
    language: 'English',
  },
  {
    title: 'Google DeepMind',
    url: 'https://deepmind.google/blog/rss.xml',
    siteUrl: 'https://deepmind.google',
    description: 'DeepMind research blog covering breakthroughs like AlphaFold',
    category: 'ai',
    language: 'English',
  },
  {
    title: "Simon Willison's Blog",
    url: 'https://simonwillison.net/atom/everything/',
    siteUrl: 'https://simonwillison.net',
    description: 'Django co-creator deep-diving into LLMs and developer tools',
    category: 'ai',
    language: 'English',
  },

  // ===== Articles =====
  {
    title: '阮一峰的网络日志',
    url: 'https://feeds.feedburner.com/ruanyifeng',
    siteUrl: 'https://www.ruanyifeng.com/blog',
    description: '知名技术博主，分享编程、科技与每周资讯汇总',
    category: 'articles',
    language: 'Chinese',
  },
  {
    title: '少数派',
    url: 'https://sspai.com/feed',
    siteUrl: 'https://sspai.com',
    description: '面向效率与品质生活的数字内容平台',
    category: 'articles',
    language: 'Chinese',
  },
  {
    title: '酷壳 – CoolShell',
    url: 'https://coolshell.cn/feed',
    siteUrl: 'https://coolshell.cn',
    description: '享受编程和技术所带来的快乐',
    category: 'articles',
    language: 'Chinese',
  },
  {
    title: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    siteUrl: 'https://www.technologyreview.com',
    description: 'In-depth analysis of frontier technology',
    category: 'articles',
    language: 'English',
  },
  {
    title: 'WIRED',
    url: 'https://www.wired.com/feed/rss',
    siteUrl: 'https://www.wired.com',
    description: 'Exploring the intersection of tech, culture and business',
    category: 'articles',
    language: 'English',
  },
  {
    title: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    siteUrl: 'https://www.theverge.com',
    description: 'Covering how technology shapes our lives',
    category: 'articles',
    language: 'English',
  },
  {
    title: '爱范儿',
    url: 'https://www.ifanr.com/feed',
    siteUrl: 'https://www.ifanr.com',
    description: '关注明日产品的数字潮牌媒体',
    category: 'articles',
    language: 'Chinese',
  },
  {
    title: 'IT之家',
    url: 'https://www.ithome.com/rss/',
    siteUrl: 'https://www.ithome.com',
    description: '软媒旗下科技资讯网站',
    category: 'articles',
    language: 'Chinese',
  },
  {
    title: '张鑫旭-鑫空间',
    url: 'https://www.zhangxinxu.com/wordpress/feed/',
    siteUrl: 'https://www.zhangxinxu.com',
    description: '专注 CSS 与前端技术深度分享',
    category: 'articles',
    language: 'Chinese',
  },
  {
    title: 'Paul Graham - Essays',
    url: 'https://feeds.feedburner.com/paulgraham',
    siteUrl: 'https://paulgraham.com',
    description: "YC co-founder Paul Graham's essays on startups and thinking",
    category: 'articles',
    language: 'English',
  },

  // ===== News =====
  {
    title: '华尔街见闻',
    url: 'https://wallstreetcn.com/rss',
    siteUrl: 'https://wallstreetcn.com',
    description: '全球金融市场资讯与深度分析',
    category: 'news',
    language: 'Chinese',
  },
  {
    title: '南方周末',
    url: 'https://feedx.net/rss/infzm.xml',
    siteUrl: 'https://www.infzm.com',
    description: '中国最具影响力的深度新闻周报，以调查报道和评论见长',
    category: 'news',
    language: 'Chinese',
  },
  {
    title: '财新网 - 最新文章',
    url: 'https://feedx.net/rss/caixin.xml',
    siteUrl: 'https://www.caixin.com',
    description: '深度财经新闻与调查报道',
    category: 'news',
    language: 'Chinese',
  },
  {
    title: 'Reuters',
    url: 'https://www.reutersagency.com/feed/',
    siteUrl: 'https://www.reuters.com',
    description: 'International news coverage from Reuters',
    category: 'news',
    language: 'English',
  },
  {
    title: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    siteUrl: 'https://www.bbc.com/news',
    description: 'BBC News - breaking and trending headlines',
    category: 'news',
    language: 'English',
  },
  {
    title: 'FT Home',
    url: 'https://www.ft.com/rss/home',
    siteUrl: 'https://www.ft.com',
    description:
      'Financial Times international edition with global business coverage',
    category: 'news',
    language: 'English',
  },

  // ===== Social =====
  {
    title: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    description: 'Hacker News community for programmers and entrepreneurs',
    category: 'social',
    language: 'English',
  },
  {
    title: 'Product Hunt',
    url: 'https://www.producthunt.com/feed',
    siteUrl: 'https://www.producthunt.com',
    description: 'Daily discovery of new tech products',
    category: 'social',
    language: 'English',
  },
  {
    title: 'GitHub Trending',
    url: 'https://github.com/trending',
    siteUrl: 'https://github.com/trending',
    description: 'GitHub trending repositories',
    category: 'social',
    language: 'English',
  },
  {
    title: '知乎日报',
    url: 'https://feedx.net/rss/zhihudaily.xml',
    siteUrl: 'https://daily.zhihu.com',
    description: '知乎每日精选优质内容',
    category: 'social',
    language: 'Chinese',
  },
  {
    title: 'LINUX DO - 最新话题',
    url: 'https://linux.do/latest.rss',
    siteUrl: 'https://linux.do',
    description: 'LINUX DO 技术社区最新话题，活跃的开发者交流平台',
    category: 'social',
    language: 'Chinese',
  },

  // ===== Videos =====
  {
    title: 'TED Talks Daily',
    url: 'https://feeds.feedburner.com/TEDTalks_video',
    siteUrl: 'https://www.ted.com/talks',
    description: 'TED talks covering technology, design and humanities',
    category: 'videos',
    language: 'English',
  },

  // ===== Pictures =====
  {
    title: 'NASA Astronomy Picture of the Day',
    url: 'https://apod.nasa.gov/apod.rss',
    siteUrl: 'https://apod.nasa.gov',
    description: 'Daily astronomy picture with expert astronomer explanations',
    category: 'pictures',
    language: 'English',
  },
  {
    title: 'National Geographic Photo of the Day',
    url: 'https://www.nationalgeographic.com/photography/photo-of-the-day/rss.xml',
    siteUrl: 'https://www.nationalgeographic.com/photography',
    description: 'Daily featured photo from National Geographic',
    category: 'pictures',
    language: 'English',
  },

  // ===== Podcast =====
  {
    title: '硬地骇客',
    url: 'https://rsshub.pseudoyu.com/xiaoyuzhou/podcast/640ee2438be5d40013fe4a87',
    siteUrl: 'https://www.xiaoyuzhoufm.com',
    description: '关注前沿科技、创业故事与产品构建的深度对话',
    category: 'podcast',
    language: 'Chinese',
  },
  {
    title: '知行小酒馆',
    url: 'https://rsshub.pseudoyu.com/xiaoyuzhou/podcast/6013f9f58e2f7ee375cf4216',
    siteUrl: 'https://www.xiaoyuzhoufm.com',
    description: '有知有行出品，分享投资理财与认知成长',
    category: 'podcast',
    language: 'Chinese',
  },
]

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
  return CURATED_FEEDS.filter(
    (f) =>
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
