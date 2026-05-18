import { FeedViewType } from '../models/LivoModels'
import i18n from '@ohos.i18n'
import articlesFeedData from './discover-builtin-feeds/articles.json'
import socialFeedData from './discover-builtin-feeds/social.json'
import picturesFeedData from './discover-builtin-feeds/pictures.json'
import videosFeedData from './discover-builtin-feeds/videos.json'
import insFeedData from './discover-builtin-feeds/ins.json'
import aiFeedData from './discover-builtin-feeds/ai.json'
import podcastFeedData from './discover-builtin-feeds/podcast.json'
import cctvFeedData from './discover-builtin-feeds/cctv.json'

export type DiscoverBuiltinFeedSourceKey = '' | 'ins' | 'ai' | 'podcast' | 'cctv'

export interface DiscoverBuiltinFeedSeed {
  title: string
  url: string
  language: string
  descriptionZh?: string
  descriptionEn?: string
}

export function resolveDescription(seed: DiscoverBuiltinFeedSeed): string {
  const lang = i18n.System.getSystemLanguage()
  const isZh = lang.startsWith('zh')
  if (isZh) {
    return (seed.descriptionZh || seed.descriptionEn || '').trim()
  }
  return (seed.descriptionEn || seed.descriptionZh || '').trim()
}

export interface DiscoverBuiltinFeed {
  title: string
  url: string
  siteUrl: string
  description: string
  view: FeedViewType
  category: string
  sourceKey: DiscoverBuiltinFeedSourceKey
  imageUrl?: string
  followers?: string
}

export interface InsGroupFeed {
  groupName: string
  members: DiscoverBuiltinFeedSeed[]
}

export interface DiscoverBuiltinFeedViewMap {
  articles: DiscoverBuiltinFeed[]
  social: DiscoverBuiltinFeed[]
  pictures: DiscoverBuiltinFeed[]
  videos: DiscoverBuiltinFeed[]
  ins: DiscoverBuiltinFeed[]
  ai: DiscoverBuiltinFeed[]
  podcast: DiscoverBuiltinFeed[]
  cctv: DiscoverBuiltinFeed[]
}

function normalizeBuiltinFeedUrl(url: string): string {
  const trimmed = url.trim()
  const prefix = 'rsshub://'
  if (trimmed.toLowerCase().startsWith(prefix)) {
    return 'https://rsshub.pseudoyu.com/' + trimmed.slice(prefix.length).replace(/^\/+/, '')
  }
  return trimmed
}

function extractOrigin(url: string): string {
  const trimmed = url.trim()
  const schemeIndex = trimmed.indexOf('://')
  if (schemeIndex < 0) {
    return ''
  }
  const slashIndex = trimmed.indexOf('/', schemeIndex + 3)
  return slashIndex >= 0 ? trimmed.slice(0, slashIndex) : trimmed
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch (_) {
    return value
  }
}

function resolveBuiltinFeedSiteUrl(normalizedUrl: string): string {
  const lower = normalizedUrl.toLowerCase()
  const origin = extractOrigin(normalizedUrl)

  const twitterPrefix = '/twitter/user/'
  const xPrefix = '/x/user/'
  const twitterIndex = lower.indexOf(twitterPrefix)
  const xIndex = lower.indexOf(xPrefix)
  if (twitterIndex >= 0 || xIndex >= 0) {
    const prefix = twitterIndex >= 0 ? twitterPrefix : xPrefix
    const start = (twitterIndex >= 0 ? twitterIndex : xIndex) + prefix.length
    const handle = decodeSegment(normalizedUrl.slice(start).split('/')[0]).replace(/^@+/, '')
    return `https://x.com/${handle}`
  }

  const instagramPrefix = '/instagram/user/'
  const picnobPrefix = '/picnob/user/'
  const instagramIndex = lower.indexOf(instagramPrefix)
  const picnobIndex = lower.indexOf(picnobPrefix)
  if (instagramIndex >= 0 || picnobIndex >= 0) {
    const prefix = instagramIndex >= 0 ? instagramPrefix : picnobPrefix
    const start = (instagramIndex >= 0 ? instagramIndex : picnobIndex) + prefix.length
    const handle = decodeSegment(normalizedUrl.slice(start).split('/')[0]).replace(/^@+/, '')
    return `https://www.instagram.com/${handle}/`
  }

  const youtubeChannelPrefix = '/youtube/channel/'
  const youtubeChannelIndex = lower.indexOf(youtubeChannelPrefix)
  if (youtubeChannelIndex >= 0) {
    const channelId = decodeSegment(normalizedUrl.slice(youtubeChannelIndex + youtubeChannelPrefix.length).split('/')[0])
    return `https://www.youtube.com/channel/${channelId}`
  }

  const youtubeUserPrefix = '/youtube/user/'
  const youtubeCPrefix = '/youtube/c/'
  const youtubeUserIndex = lower.indexOf(youtubeUserPrefix)
  const youtubeCIndex = lower.indexOf(youtubeCPrefix)
  if (youtubeUserIndex >= 0 || youtubeCIndex >= 0) {
    const prefix = youtubeUserIndex >= 0 ? youtubeUserPrefix : youtubeCPrefix
    const handle = decodeSegment(normalizedUrl.slice((youtubeUserIndex >= 0 ? youtubeUserIndex : youtubeCIndex) + prefix.length).split('/')[0]).replace(/^@+/, '')
    return `https://www.youtube.com/@${handle}`
  }

  const bilibiliVideoPrefix = '/bilibili/user/video/'
  const bilibiliDynamicPrefix = '/bilibili/user/dynamic/'
  const bilibiliVideoIndex = lower.indexOf(bilibiliVideoPrefix)
  const bilibiliDynamicIndex = lower.indexOf(bilibiliDynamicPrefix)
  if (bilibiliVideoIndex >= 0 || bilibiliDynamicIndex >= 0) {
    const prefix = bilibiliVideoIndex >= 0 ? bilibiliVideoPrefix : bilibiliDynamicPrefix
    const uid = normalizedUrl.slice((bilibiliVideoIndex >= 0 ? bilibiliVideoIndex : bilibiliDynamicIndex) + prefix.length).split('/')[0]
    return `https://space.bilibili.com/${uid}`
  }

  const xiaoyuzhouPodcastPrefix = '/xiaoyuzhou/podcast/'
  const xiaoyuzhouPodcastIndex = lower.indexOf(xiaoyuzhouPodcastPrefix)
  if (xiaoyuzhouPodcastIndex >= 0) {
    // 小宇宙 RSSHub 路由保留播客主页，方便预览页和头像兜底使用。
    const podcastId = normalizedUrl.slice(xiaoyuzhouPodcastIndex + xiaoyuzhouPodcastPrefix.length).split('/')[0]
    return `https://www.xiaoyuzhoufm.com/podcast/${podcastId}`
  }

  if (lower.includes('/github/trending/')) {
    return 'https://github.com/trending'
  }

  if (lower.includes('/hackernews')) {
    return 'https://news.ycombinator.com'
  }

  if (lower.includes('youtube.com/feeds/videos.xml')) {
    return 'https://www.youtube.com'
  }

  return origin || normalizedUrl
}

function resolveBuiltinSourceCategory(sourceKey: DiscoverBuiltinFeedSourceKey): string {
  switch (sourceKey) {
    case 'ins':
      return '内置-Ins'
    case 'ai':
      return '内置-AI'
    case 'podcast':
      return '内置-播客'
    case 'cctv':
      return '内置-央视'
    default:
      return '内置'
  }
}

function buildBuiltinFeeds(
  view: FeedViewType,
  seeds: DiscoverBuiltinFeedSeed[],
  sourceKey: DiscoverBuiltinFeedSourceKey = '',
): DiscoverBuiltinFeed[] {
  return seeds.map((seed: DiscoverBuiltinFeedSeed): DiscoverBuiltinFeed => {
    const normalizedUrl = normalizeBuiltinFeedUrl(seed.url)
    return {
      title: seed.title,
      url: normalizedUrl,
      siteUrl: resolveBuiltinFeedSiteUrl(normalizedUrl),
      description: resolveDescription(seed),
      view,
      category: resolveBuiltinSourceCategory(sourceKey),
      sourceKey,
    }
  })
}

interface FeedFileShape {
  feeds?: DiscoverBuiltinFeedSeed[]
}

interface InsGroupShape {
  groupName: string
  members: DiscoverBuiltinFeedSeed[]
}

interface InsFeedFileShape {
  feeds?: DiscoverBuiltinFeedSeed[]
  groups?: InsGroupShape[]
}

export const BUILTIN_DISCOVER_FEEDS_BY_VIEW: DiscoverBuiltinFeedViewMap = {
  articles: buildBuiltinFeeds(FeedViewType.Articles, (articlesFeedData as FeedFileShape).feeds ?? []),
  social: buildBuiltinFeeds(FeedViewType.SocialMedia, (socialFeedData as FeedFileShape).feeds ?? []),
  pictures: buildBuiltinFeeds(FeedViewType.Pictures, (picturesFeedData as FeedFileShape).feeds ?? []),
  videos: buildBuiltinFeeds(FeedViewType.Videos, (videosFeedData as FeedFileShape).feeds ?? []),
  ins: buildBuiltinFeeds(FeedViewType.Pictures, (insFeedData as InsFeedFileShape).feeds ?? [], 'ins'),
  ai: buildBuiltinFeeds(FeedViewType.Articles, (aiFeedData as FeedFileShape).feeds ?? [], 'ai'),
  podcast: buildBuiltinFeeds(FeedViewType.Articles, (podcastFeedData as FeedFileShape).feeds ?? [], 'podcast'),
  cctv: buildBuiltinFeeds(FeedViewType.Articles, (cctvFeedData as FeedFileShape).feeds ?? [], 'cctv'),
}

export const BUILTIN_INS_GROUPS: InsGroupFeed[] = ((insFeedData as InsFeedFileShape).groups ?? []).map(
  (g: InsGroupShape): InsGroupFeed => ({ groupName: g.groupName, members: g.members })
)

export function builtinDiscoverFeedsByView(view: FeedViewType): DiscoverBuiltinFeed[] {
  switch (view) {
    case FeedViewType.SocialMedia:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.social
    case FeedViewType.Pictures:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.pictures
    case FeedViewType.Videos:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.videos
    default:
      return BUILTIN_DISCOVER_FEEDS_BY_VIEW.articles
  }
}

export function builtinDiscoverFeedsBySourceKey(sourceKey: DiscoverBuiltinFeedSourceKey): DiscoverBuiltinFeed[] {
  if (sourceKey === 'ins') {
    return BUILTIN_DISCOVER_FEEDS_BY_VIEW.ins
  }
  if (sourceKey === 'ai') {
    return BUILTIN_DISCOVER_FEEDS_BY_VIEW.ai
  }
  if (sourceKey === 'podcast') {
    return BUILTIN_DISCOVER_FEEDS_BY_VIEW.podcast
  }
  if (sourceKey === 'cctv') {
    return BUILTIN_DISCOVER_FEEDS_BY_VIEW.cctv
  }
  return []
}

export function builtinDiscoverInsGroups(): InsGroupFeed[] {
  return BUILTIN_INS_GROUPS
}

export function builtinDiscoverFeedsAll(): DiscoverBuiltinFeed[] {
  return [
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.articles,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.social,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.pictures,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.videos,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.ins,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.ai,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.podcast,
    ...BUILTIN_DISCOVER_FEEDS_BY_VIEW.cctv,
  ]
}
