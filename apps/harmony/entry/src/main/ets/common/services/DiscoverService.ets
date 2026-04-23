import { FeedViewType } from '../models/LivoModels'
import {
  DEFAULT_NITTER_INSTANCE,
  DEFAULT_RSSHUB_INSTANCE as APP_DEFAULT_RSSHUB_INSTANCE,
} from '../AppConfig'
import { builtinDiscoverFeedsAll } from '../data/DiscoverBuiltinFeeds'
import trendingFeedSeeds from '../data/discover-builtin-feeds/trending-feeds.json'

export type DiscoverSearchPlatform = 'all' | 'youtube' | 'bilibili' | 'x' | 'instagram'

export interface RecommendedFeed {
  title: string
  url: string
  siteUrl: string
  description: string
  view: FeedViewType
  category: string
  sourceKey?: string
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

function discoverInstagramAvatarUrl(usernameRaw: string): string {
  const username = (usernameRaw || '').trim().replace(/^@+/, '')
  return username ? `https://unavatar.io/instagram/${encodeURIComponent(username)}?fallback=false` : ''
}

export const DEFAULT_RSSHUB_INSTANCE = APP_DEFAULT_RSSHUB_INSTANCE

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

export function filteredRecommendedFeeds(selectedView: FeedViewType, sourceKey: string = ''): RecommendedFeed[] {
  if (sourceKey) {
    return RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => (feed.sourceKey || '') === sourceKey)
  }

  return RECOMMENDED_FEEDS.filter((feed: RecommendedFeed) => {
    return feed.view === selectedView && !(feed.sourceKey || '')
  })
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
    cachedTrendingFeedsFromJson = normalized.length > 0 ? normalized : trendingDiscoverFeeds()
  } catch (error) {
    console.warn(`[DiscoverService] Failed to load trending feeds from JSON: ${error instanceof Error ? error.message : 'unknown error'}`)
    cachedTrendingFeedsFromJson = trendingDiscoverFeeds()
  }

  return cachedTrendingFeedsFromJson
}

export async function trendingDiscoverFeedsFromJson(): Promise<RecommendedFeed[]> {
  return trendingDiscoverFeedsFromJsonNow()
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
