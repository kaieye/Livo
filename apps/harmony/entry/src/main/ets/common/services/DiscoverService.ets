import { FeedViewType } from '../models/LivoModels'

export type DiscoverSearchPlatform = 'all' | 'youtube' | 'bilibili' | 'x' | 'instagram'

export interface RecommendedFeed {
  title: string
  url: string
  siteUrl: string
  description: string
  view: FeedViewType
  category: string
  imageUrl?: string
  followers?: string
}

export interface WebUrlParts {
  host: string
  pathSegments: string[]
  normalizedUrl: string
}

export interface ResolvedDiscoverCandidate {
  targetUrl: string
  targetTitle: string
  targetView: FeedViewType
  description: string
  siteUrl: string
  sourceKind: string
  imageUrl?: string
  followers?: string
}

export const DEFAULT_RSSHUB_INSTANCE = 'https://rsshub.pseudoyu.com'
const DEFAULT_NITTER_INSTANCE = 'https://nitter.poast.org'

export const RECOMMENDED_FEEDS: RecommendedFeed[] = [
  {
    title: '少数派',
    url: 'https://sspai.com/feed',
    siteUrl: 'https://sspai.com',
    description: '高效工作，品质生活',
    view: FeedViewType.Articles,
    category: '精选',
  },
  {
    title: '阮一峰的网络日志',
    url: 'https://www.ruanyifeng.com/blog/atom.xml',
    siteUrl: 'https://www.ruanyifeng.com/blog',
    description: '技术、互联网与个人思考',
    view: FeedViewType.Articles,
    category: '博客',
  },
  {
    title: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    siteUrl: 'https://www.theverge.com',
    description: '科技新闻与深度报道',
    view: FeedViewType.Articles,
    category: '科技',
  },
  {
    title: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    siteUrl: 'https://openai.com/news',
    description: 'OpenAI 官方动态',
    view: FeedViewType.Articles,
    category: 'AI',
  },
  {
    title: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    siteUrl: 'https://blog.google/technology/ai/',
    description: 'Google AI 团队的官方更新',
    view: FeedViewType.Articles,
    category: 'AI',
  },
  {
    title: 'GitHub Changelog',
    url: 'https://github.blog/changelog/feed/',
    siteUrl: 'https://github.blog/changelog',
    description: 'GitHub 产品更新',
    view: FeedViewType.Articles,
    category: '开发',
  },
  {
    title: 'V2EX 技术',
    url: 'https://www.v2ex.com/feed/tab/tech.xml',
    siteUrl: 'https://www.v2ex.com',
    description: '技术社区热门讨论',
    view: FeedViewType.Articles,
    category: '社区',
  },
  {
    title: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    description: '开发者热点讨论',
    view: FeedViewType.SocialMedia,
    category: '讨论',
  },
  {
    title: 'Lobsters',
    url: 'https://lobste.rs/rss',
    siteUrl: 'https://lobste.rs',
    description: '开发者社区的链接与讨论',
    view: FeedViewType.SocialMedia,
    category: '社区',
  },
  {
    title: 'Product Hunt',
    url: 'https://www.producthunt.com/feed',
    siteUrl: 'https://www.producthunt.com',
    description: '每日产品讨论与发布',
    view: FeedViewType.SocialMedia,
    category: '社区',
  },
  {
    title: '爱范儿',
    url: 'https://www.ifanr.com/feed',
    siteUrl: 'https://www.ifanr.com',
    description: '创新与消费科技',
    view: FeedViewType.Pictures,
    category: '图文',
  },
  {
    title: 'NASA Image of the Day',
    url: 'https://www.nasa.gov/feeds/iotd-feed/',
    siteUrl: 'https://www.nasa.gov',
    description: '每日精选太空图片',
    view: FeedViewType.Pictures,
    category: '摄影',
  },
  {
    title: 'Astronomy Picture of the Day',
    url: 'https://apod.nasa.gov/apod.rss',
    siteUrl: 'https://apod.nasa.gov/apod/astropix.html',
    description: 'NASA 每日天文图集',
    view: FeedViewType.Pictures,
    category: '摄影',
  },
  {
    title: 'TED Talks Daily',
    url: 'https://feeds.feedburner.com/TEDTalks_audio',
    siteUrl: 'https://www.ted.com/talks',
    description: '全球演讲精选',
    view: FeedViewType.Videos,
    category: '演讲',
  },
  {
    title: 'NPR Video',
    url: 'https://feeds.npr.org/1004/rss.xml',
    siteUrl: 'https://www.npr.org',
    description: '新闻视频与故事',
    view: FeedViewType.Videos,
    category: '资讯',
  },
  {
    title: 'OpenAI',
    url: `${DEFAULT_RSSHUB_INSTANCE}/youtube/channel/UCXZCJLdBC09xxGZ6gcdrc6A`,
    siteUrl: 'https://www.youtube.com/@OpenAI',
    description: 'OpenAI 官方频道更新',
    view: FeedViewType.Videos,
    category: 'YouTube',
    imageUrl: 'https://yt3.googleusercontent.com/MopgmVAFV9BqlzOJ-UINtmutvEPcNe5IbKMmP_4vZZo3vnJXcZGtybUBsXaEVxkmxKyGqX9R=s900-c-k-c0x00ffffff-no-rj',
    followers: '362K 订阅者',
  },
  {
    title: 'Google Developers',
    url: `${DEFAULT_RSSHUB_INSTANCE}/youtube/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw`,
    siteUrl: 'https://www.youtube.com/@GoogleDevelopers',
    description: 'Google Developers 官方视频更新',
    view: FeedViewType.Videos,
    category: 'YouTube',
    imageUrl: 'https://yt3.googleusercontent.com/WZ_63J_-745xyW_DGxGi3VUyTZAe0Jvhw2ZCg7fdz-tv9esTbNPZTFR9X79QzA0ArIrMjYJCDA=s900-c-k-c0x00ffffff-no-rj',
    followers: '2.61M 订阅者',
  },
  {
    title: 'Fireship',
    url: `${DEFAULT_RSSHUB_INSTANCE}/youtube/channel/UC2Xd-TjJByJyK2w1zNwY0zQ`,
    siteUrl: 'https://www.youtube.com/@Fireship',
    description: '开发者视频推荐源',
    view: FeedViewType.Videos,
    category: 'YouTube',
    imageUrl: 'https://yt3.googleusercontent.com/3fPNbkf_xPyCleq77ZhcxyeorY97NtMHVNUbaAON_RBDH9ydL4hJkjxC8x_4mpuopkB8oI7Ct6Y=s900-c-k-c0x00ffffff-no-rj',
    followers: '469K 订阅者',
  },
  {
    title: 'Veritasium',
    url: `${DEFAULT_RSSHUB_INSTANCE}/youtube/channel/UCHnyfMqiRRG1u-2MsSQLbXA`,
    siteUrl: 'https://www.youtube.com/@veritasium',
    description: '科普视频推荐源',
    view: FeedViewType.Videos,
    category: 'YouTube',
    imageUrl: 'https://yt3.googleusercontent.com/7vCbvtCqtjQ3YLgsJt7Y952MQV1sBvhllSCSxHP8_sVZdcPCBrITfhkN2RdyCuwPnsByq-1GoA=s900-c-k-c0x00ffffff-no-rj',
    followers: '20.5M 订阅者',
  },
  {
    title: '罗翔说刑法',
    url: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/517327498`,
    siteUrl: 'https://space.bilibili.com/517327498',
    description: 'Bilibili 视频更新示例源',
    view: FeedViewType.Videos,
    category: 'Bilibili',
    imageUrl: 'https://i1.hdslb.com/bfs/face/4e5d0a51273fe3f8fabc700b6a71bb8a38c9e21e.jpg',
    followers: '3206万粉丝',
  },
  {
    title: '影视飓风',
    url: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/946974`,
    siteUrl: 'https://space.bilibili.com/946974',
    description: '影像与数码创作内容',
    view: FeedViewType.Videos,
    category: 'Bilibili',
    imageUrl: 'https://i0.hdslb.com/bfs/face/c1733474892caa45952b2c09a89323157df7129a.jpg',
    followers: '1568万粉丝',
  },
  {
    title: '老师好我叫何同学',
    url: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/163637592`,
    siteUrl: 'https://space.bilibili.com/163637592',
    description: '数码与创意视频更新',
    view: FeedViewType.Videos,
    category: 'Bilibili',
    imageUrl: 'https://i0.hdslb.com/bfs/face/492d0bb71749332040f9d812954fa0b52e66c490.jpg',
    followers: '1269万粉丝',
  },
  {
    title: '老番茄',
    url: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/546195`,
    siteUrl: 'https://space.bilibili.com/546195',
    description: 'Bilibili 动态示例源',
    view: FeedViewType.SocialMedia,
    category: 'Bilibili',
    imageUrl: 'https://i0.hdslb.com/bfs/face/bc5ca101313d4db223c395d64779e76eb3482d60.jpg',
    followers: '2017万粉丝',
  },
  {
    title: 'OpenAI on X',
    url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/openai`,
    siteUrl: 'https://x.com/OpenAI',
    description: 'OpenAI 在 X 上的公开动态',
    view: FeedViewType.SocialMedia,
    category: 'X',
    imageUrl: 'https://unavatar.io/x/openai',
  },
  {
    title: 'GitHub on X',
    url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/github`,
    siteUrl: 'https://x.com/github',
    description: 'GitHub 官方动态',
    view: FeedViewType.SocialMedia,
    category: 'X',
    imageUrl: 'https://unavatar.io/x/github',
  },
  {
    title: 'verge on X',
    url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/verge`,
    siteUrl: 'https://x.com/verge',
    description: 'The Verge 社交动态',
    view: FeedViewType.SocialMedia,
    category: 'X',
    imageUrl: 'https://unavatar.io/x/verge',
    followers: '3.4M followers',
  },
  {
    title: 'Figma on X',
    url: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/figma`,
    siteUrl: 'https://x.com/figma',
    description: 'Figma 官方动态',
    view: FeedViewType.SocialMedia,
    category: 'X',
    imageUrl: 'https://unavatar.io/x/figma',
  },
  {
    title: 'NASA',
    url: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/nasa`,
    siteUrl: 'https://www.instagram.com/nasa/',
    description: 'Instagram 图片流示例源',
    view: FeedViewType.Pictures,
    category: 'Instagram',
    imageUrl: 'https://unavatar.io/instagram/nasa?fallback=false',
    followers: '100M followers',
  },
  {
    title: 'National Geographic',
    url: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/natgeo`,
    siteUrl: 'https://www.instagram.com/natgeo/',
    description: '国家地理图片更新',
    view: FeedViewType.Pictures,
    category: 'Instagram',
    imageUrl: 'https://unavatar.io/instagram/natgeo?fallback=false',
    followers: '275M followers',
  },
  {
    title: 'Figma',
    url: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/figma`,
    siteUrl: 'https://www.instagram.com/figma/',
    description: 'Figma 官方视觉内容',
    view: FeedViewType.Pictures,
    category: 'Instagram',
    imageUrl: 'https://unavatar.io/instagram/figma?fallback=false',
    followers: '898K followers',
  },
  {
    title: 'Google',
    url: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/google`,
    siteUrl: 'https://www.instagram.com/google/',
    description: 'Google 官方图片内容',
    view: FeedViewType.Pictures,
    category: 'Instagram',
    imageUrl: 'https://unavatar.io/instagram/google?fallback=false',
    followers: '16M followers',
  },
]

export function discoverViewLabel(view: FeedViewType): string {
  switch (view) {
    case FeedViewType.SocialMedia:
      return '社交'
    case FeedViewType.Pictures:
      return '图片'
    case FeedViewType.Videos:
      return '视频'
    default:
      return '文章'
  }
}

export function discoverPlatformLabel(platform: DiscoverSearchPlatform): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube'
    case 'bilibili':
      return 'Bilibili'
    case 'x':
      return 'X'
    case 'instagram':
      return 'Instagram'
    default:
      return '全部'
  }
}

export function preferredViewForPlatform(platform: DiscoverSearchPlatform): FeedViewType {
  switch (platform) {
    case 'x':
      return FeedViewType.SocialMedia
    case 'instagram':
      return FeedViewType.Pictures
    case 'youtube':
    case 'bilibili':
      return FeedViewType.Videos
    default:
      return FeedViewType.Articles
  }
}

export function normalizeDiscoverInput(value: string): string {
  const trimmed = value.trim()
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    return `${DEFAULT_RSSHUB_INSTANCE}/${route}`
  }
  return trimmed
}

export function discoverFeedPlatform(feed: RecommendedFeed): DiscoverSearchPlatform {
  const site = feed.siteUrl.toLowerCase()
  const url = feed.url.toLowerCase()
  const siteHost = extractWebParts(feed.siteUrl)?.host ?? ''
  const matchesHost = (host: string): boolean => siteHost === host || siteHost.endsWith(`.${host}`)

  if (matchesHost('youtube.com') || url.includes('/youtube/')) {
    return 'youtube'
  }
  if (matchesHost('bilibili.com') || url.includes('/bilibili/')) {
    return 'bilibili'
  }
  if (matchesHost('instagram.com') || url.includes('/instagram/')) {
    return 'instagram'
  }
  if (
    matchesHost('x.com')
    || matchesHost('twitter.com')
    || matchesHost('bsky.app')
    || url.includes('/x/user/')
    || url.includes('/twitter/user/')
    || url.includes('nitter.')
  ) {
    return 'x'
  }
  return 'all'
}

export function extractWebParts(value: string): WebUrlParts | undefined {
  const matched = value.trim().match(/^https?:\/\/([^/]+)(\/[^?#]*)?/i)
  if (!matched?.[1]) {
    return undefined
  }

  const host = matched[1].toLowerCase().replace(/^www\./, '')
  const rawPath = matched[2] ?? '/'
  const pathSegments = rawPath.split('/').filter((segment: string) => segment.length > 0)
  return {
    host,
    pathSegments,
    normalizedUrl: value.trim(),
  }
}

export function resolveProfileCandidates(value: string): ResolvedDiscoverCandidate[] {
  const parts = extractWebParts(value)
  if (!parts) {
    return []
  }

  const candidates: ResolvedDiscoverCandidate[] = []
  const pushCandidate = (candidate: ResolvedDiscoverCandidate): void => {
    if (candidates.some((item: ResolvedDiscoverCandidate) => item.targetUrl === candidate.targetUrl)) {
      return
    }
    candidates.push(candidate)
  }

  if (parts.host === 'youtube.com' || parts.host === 'm.youtube.com' || parts.host === 'youtu.be') {
    const first = parts.pathSegments[0] ?? ''
    const second = parts.pathSegments[1] ?? ''
    if (first === 'channel' && second.startsWith('UC')) {
      pushCandidate({
        targetUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(second)}`,
        targetTitle: `YouTube ${second}`,
        targetView: FeedViewType.Videos,
        description: '已从 YouTube 频道主页解析为官方订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: '官方 RSS',
      })
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/channel/${encodeURIComponent(second)}`,
        targetTitle: `YouTube ${second}`,
        targetView: FeedViewType.Videos,
        description: '已从 YouTube 频道主页解析为 RSSHub 订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
    } else if (first.startsWith('@')) {
      const handle = first.slice(1)
      if (handle) {
        pushCandidate({
          targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/@${encodeURIComponent(handle)}`,
          targetTitle: `YouTube @${handle}`,
          targetView: FeedViewType.Videos,
          description: '已从 YouTube 主页解析为 RSSHub 订阅地址。',
          siteUrl: parts.normalizedUrl,
          sourceKind: 'RSSHub',
        })
      }
    } else if ((first === 'user' || first === 'c') && second) {
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/${encodeURIComponent(second)}`,
        targetTitle: `YouTube ${second}`,
        targetView: FeedViewType.Videos,
        description: '已从 YouTube 用户主页解析为 RSSHub 订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
    }
  } else if (parts.host === 'x.com' || parts.host === 'twitter.com') {
    const username = (parts.pathSegments[0] ?? '').replace(/^@/, '')
    if (username) {
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/${encodeURIComponent(username.toLowerCase())}`,
        targetTitle: `@${username}`,
        targetView: FeedViewType.SocialMedia,
        description: '已从 X/Twitter 主页解析为 RSSHub 用户订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
      pushCandidate({
        targetUrl: `${DEFAULT_NITTER_INSTANCE}/${encodeURIComponent(username.toLowerCase())}/rss`,
        targetTitle: `@${username}`,
        targetView: FeedViewType.SocialMedia,
        description: '已从 X/Twitter 主页解析为 Nitter 订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'Nitter',
      })
    }
  } else if (parts.host === 'instagram.com') {
    const username = (parts.pathSegments[0] ?? '').replace(/^@/, '')
    if (username) {
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/${encodeURIComponent(username)}`,
        targetTitle: `@${username}`,
        targetView: FeedViewType.Pictures,
        description: '已从 Instagram 主页解析为 RSSHub 用户订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
    }
  } else if (parts.host === 'space.bilibili.com') {
    const uid = parts.pathSegments[0] ?? ''
    if (/^\d+$/.test(uid)) {
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/${uid}`,
        targetTitle: `Bilibili ${uid}`,
        targetView: FeedViewType.SocialMedia,
        description: '已从 Bilibili 主页解析为动态订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${uid}`,
        targetTitle: `Bilibili ${uid}`,
        targetView: FeedViewType.Videos,
        description: '已从 Bilibili 主页解析为视频订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
    }
  } else if (parts.host === 'github.com') {
    const username = parts.pathSegments[0] ?? ''
    if (username) {
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/github/user/${encodeURIComponent(username)}`,
        targetTitle: `GitHub ${username}`,
        targetView: FeedViewType.Articles,
        description: '已从 GitHub 主页解析为 RSSHub 用户订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
    }
  }

  return sortResolvedCandidates(candidates, value)
}

export function resolveProfileCandidatesByPlatform(
  value: string,
  platform: DiscoverSearchPlatform,
): ResolvedDiscoverCandidate[] {
  const items = resolveProfileCandidates(value)
  if (platform === 'all') {
    return items
  }
  return items.filter((candidate: ResolvedDiscoverCandidate) => {
    if (platform === 'youtube') {
      return candidate.targetUrl.includes('/youtube/') || candidate.targetUrl.includes('youtube.com/feeds/videos.xml')
    }
    if (platform === 'bilibili') {
      return candidate.targetUrl.includes('/bilibili/')
    }
    if (platform === 'x') {
      return candidate.targetUrl.includes('/x/user/')
        || candidate.targetUrl.includes('/twitter/user/')
        || candidate.targetUrl.includes('nitter.')
    }
    if (platform === 'instagram') {
      return candidate.targetUrl.includes('/instagram/')
    }
    return true
  })
}

export function matchesRecommended(feed: RecommendedFeed, query: string): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return false
  }

  return feed.title.toLowerCase().includes(keyword)
    || feed.description.toLowerCase().includes(keyword)
    || feed.category.toLowerCase().includes(keyword)
    || feed.siteUrl.toLowerCase().includes(keyword)
}

export function filteredRecommendedFeeds(selectedView: FeedViewType): RecommendedFeed[] {
  return RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => feed.view === selectedView)
}

export function filteredRecommendedFeedsByPlatform(platform: DiscoverSearchPlatform): RecommendedFeed[] {
  if (platform === 'all') {
    return RECOMMENDED_FEEDS
  }
  return RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => discoverFeedPlatform(feed) === platform)
}

export function searchedRecommendedFeeds(query: string): RecommendedFeed[] {
  const keyword = query.trim()
  if (!keyword) {
    return RECOMMENDED_FEEDS
  }

  return RECOMMENDED_FEEDS
    .filter((feed: RecommendedFeed) => matchesRecommended(feed, keyword))
    .sort((left: RecommendedFeed, right: RecommendedFeed) => {
      return scoreRecommendedFeed(right, keyword) - scoreRecommendedFeed(left, keyword)
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

export function trendingDiscoverFeeds(): RecommendedFeed[] {
  return RECOMMENDED_FEEDS.slice(0, 8)
}

export function resolveKeywordCandidates(query: string, preferredView: FeedViewType): ResolvedDiscoverCandidate[] {
  const clean = query.trim().replace(/^@/, '')
  if (!clean) {
    return []
  }

  if (/^https?:\/\//i.test(clean) || /^rsshub:\/\//i.test(clean)) {
    return []
  }

  const candidates: ResolvedDiscoverCandidate[] = []
  const pushCandidate = (candidate: ResolvedDiscoverCandidate): void => {
    if (candidates.some((item: ResolvedDiscoverCandidate) => item.targetUrl === candidate.targetUrl)) {
      return
    }
    candidates.push(candidate)
  }

  if (preferredView === FeedViewType.SocialMedia) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/${encodeURIComponent(clean.toLowerCase())}`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据关键词生成 X/Twitter 用户订阅地址。',
      siteUrl: `https://x.com/${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
    pushCandidate({
      targetUrl: `${DEFAULT_NITTER_INSTANCE}/${encodeURIComponent(clean.toLowerCase())}/rss`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据关键词生成 Nitter 订阅地址。',
      siteUrl: `https://x.com/${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
  }

  if (preferredView === FeedViewType.Pictures) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/${encodeURIComponent(clean)}`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.Pictures,
      description: '根据关键词生成 Instagram 用户订阅地址。',
      siteUrl: `https://www.instagram.com/${encodeURIComponent(clean)}/`,
      sourceKind: '关键词',
    })
  }

  if (preferredView === FeedViewType.Videos) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/@${encodeURIComponent(clean)}`,
      targetTitle: `YouTube @${clean}`,
      targetView: FeedViewType.Videos,
      description: '根据关键词生成 YouTube 频道订阅地址。',
      siteUrl: `https://www.youtube.com/@${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
    if (/^\d+$/.test(clean)) {
      pushCandidate({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${clean}`,
        targetTitle: `Bilibili ${clean}`,
        targetView: FeedViewType.Videos,
        description: '根据 UID 生成 Bilibili 视频订阅地址。',
        siteUrl: `https://space.bilibili.com/${clean}`,
        sourceKind: '关键词',
      })
    }
  }

  if (preferredView === FeedViewType.Articles) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/github/user/${encodeURIComponent(clean)}`,
      targetTitle: `GitHub ${clean}`,
      targetView: FeedViewType.Articles,
      description: '根据关键词生成 GitHub 用户订阅地址。',
      siteUrl: `https://github.com/${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
  }

  return sortResolvedCandidates(candidates, query)
}

export function resolveKeywordCandidatesByPlatform(
  query: string,
  platform: DiscoverSearchPlatform,
): ResolvedDiscoverCandidate[] {
  const clean = query.trim().replace(/^@/, '')
  if (!clean) {
    return []
  }

  if (/^https?:\/\//i.test(clean) || /^rsshub:\/\//i.test(clean)) {
    return []
  }

  const candidates: ResolvedDiscoverCandidate[] = []
  const pushCandidate = (candidate: ResolvedDiscoverCandidate): void => {
    if (candidates.some((item: ResolvedDiscoverCandidate) => item.targetUrl === candidate.targetUrl)) {
      return
    }
    candidates.push(candidate)
  }

  const enableX = platform === 'all' || platform === 'x'
  const enableInstagram = platform === 'all' || platform === 'instagram'
  const enableYouTube = platform === 'all' || platform === 'youtube'
  const enableBilibili = platform === 'all' || platform === 'bilibili'

  if (enableX) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/twitter/user/${encodeURIComponent(clean.toLowerCase())}`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据关键词生成 X/Twitter 用户订阅地址。',
      siteUrl: `https://x.com/${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
    pushCandidate({
      targetUrl: `${DEFAULT_NITTER_INSTANCE}/${encodeURIComponent(clean.toLowerCase())}/rss`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据关键词生成 Nitter 订阅地址。',
      siteUrl: `https://x.com/${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
  }

  if (enableInstagram) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/${encodeURIComponent(clean)}`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.Pictures,
      description: '根据关键词生成 Instagram 用户订阅地址。',
      siteUrl: `https://www.instagram.com/${encodeURIComponent(clean)}/`,
      sourceKind: '关键词',
    })
  }

  if (enableYouTube) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/@${encodeURIComponent(clean)}`,
      targetTitle: `YouTube @${clean}`,
      targetView: FeedViewType.Videos,
      description: '根据关键词生成 YouTube 频道订阅地址。',
      siteUrl: `https://www.youtube.com/@${encodeURIComponent(clean)}`,
      sourceKind: '关键词',
    })
  }

  if (enableBilibili && /^\d+$/.test(clean)) {
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${clean}`,
      targetTitle: `Bilibili ${clean}`,
      targetView: FeedViewType.Videos,
      description: '根据 UID 生成 Bilibili 视频订阅地址。',
      siteUrl: `https://space.bilibili.com/${clean}`,
      sourceKind: '关键词',
    })
    pushCandidate({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/${clean}`,
      targetTitle: `Bilibili ${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据 UID 生成 Bilibili 动态订阅地址。',
      siteUrl: `https://space.bilibili.com/${clean}`,
      sourceKind: '关键词',
    })
  }

  return sortResolvedCandidates(candidates, query)
}

export function resolveKeywordCandidatesAcrossViews(query: string): ResolvedDiscoverCandidate[] {
  const allViews: FeedViewType[] = [
    FeedViewType.Articles,
    FeedViewType.SocialMedia,
    FeedViewType.Pictures,
    FeedViewType.Videos,
  ]

  const merged: ResolvedDiscoverCandidate[] = []
  allViews.forEach((view: FeedViewType) => {
    resolveKeywordCandidates(query, view).forEach((candidate: ResolvedDiscoverCandidate) => {
      if (!merged.some((item: ResolvedDiscoverCandidate) => item.targetUrl === candidate.targetUrl)) {
        merged.push(candidate)
      }
    })
  })
  return sortResolvedCandidates(merged, query)
}

function scoreRecommendedFeed(feed: RecommendedFeed, query: string): number {
  const keyword = query.trim().toLowerCase()
  let score = 0
  const title = feed.title.toLowerCase()
  const category = feed.category.toLowerCase()
  const description = feed.description.toLowerCase()
  const site = feed.siteUrl.toLowerCase()

  if (title === keyword) score += 100
  if (title.startsWith(keyword)) score += 60
  if (title.includes(keyword)) score += 40
  if (category.includes(keyword)) score += 20
  if (description.includes(keyword)) score += 10
  if (site.includes(keyword)) score += 8
  return score
}

function scoreResolvedCandidate(candidate: ResolvedDiscoverCandidate, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase()
  const title = candidate.targetTitle.toLowerCase()
  let score = 0

  if (candidate.sourceKind === '官方 RSS') score += 100
  if (candidate.sourceKind === 'RSSHub') score += 70
  if (candidate.sourceKind === 'Nitter') score += 50
  if (candidate.sourceKind === '关键词') score += 35
  if (title === query || title === `@${query}`) score += 50
  if (title.includes(query)) score += 20
  return score
}

function sortResolvedCandidates(
  candidates: ResolvedDiscoverCandidate[],
  rawQuery: string,
): ResolvedDiscoverCandidate[] {
  return [...candidates].sort((left: ResolvedDiscoverCandidate, right: ResolvedDiscoverCandidate) => {
    return scoreResolvedCandidate(right, rawQuery) - scoreResolvedCandidate(left, rawQuery)
  })
}
