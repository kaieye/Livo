import { FeedViewType } from '../../models/LivoModels'
import { DEFAULT_NITTER_INSTANCE, DEFAULT_RSSHUB_INSTANCE } from '../../AppConfig'
import { DiscoverSearchPlatform, ResolvedDiscoverCandidate } from './DiscoverTypes'
import { sortResolvedCandidates } from './DiscoverCandidateScoring'

type KeywordPlatform = 'x' | 'instagram' | 'youtube' | 'bilibili'

interface KeywordCandidateBuilder {
  platform: KeywordPlatform
  build: (clean: string) => ResolvedDiscoverCandidate[]
}

function buildXKeywordCandidates(clean: string): ResolvedDiscoverCandidate[] {
  const lower = clean.toLowerCase()
  const siteUrl = `https://x.com/${encodeURIComponent(clean)}`
  return [
    {
      targetUrl: `${DEFAULT_NITTER_INSTANCE}/${encodeURIComponent(lower)}/rss`,
      targetTitle: `@${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据关键词生成 Nitter 订阅地址。',
      siteUrl,
      sourceKind: '关键词',
    },
  ]
}

function buildInstagramKeywordCandidates(clean: string): ResolvedDiscoverCandidate[] {
  return [{
    targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/${encodeURIComponent(clean)}`,
    targetTitle: `@${clean}`,
    targetView: FeedViewType.Pictures,
    description: '根据关键词生成 Instagram 用户订阅地址。',
    siteUrl: `https://www.instagram.com/${encodeURIComponent(clean)}/`,
    sourceKind: '关键词',
  }]
}

function buildYouTubeKeywordCandidates(clean: string): ResolvedDiscoverCandidate[] {
  return [{
    targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/@${encodeURIComponent(clean)}`,
    targetTitle: `YouTube @${clean}`,
    targetView: FeedViewType.Videos,
    description: '根据关键词生成 YouTube 频道订阅地址。',
    siteUrl: `https://www.youtube.com/@${encodeURIComponent(clean)}`,
    sourceKind: '关键词',
  }]
}

function buildBilibiliKeywordCandidates(clean: string): ResolvedDiscoverCandidate[] {
  if (!/^\d+$/.test(clean)) {
    return []
  }
  const siteUrl = `https://space.bilibili.com/${clean}`
  return [
    {
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${clean}`,
      targetTitle: `Bilibili ${clean}`,
      targetView: FeedViewType.Videos,
      description: '根据 UID 生成 Bilibili 视频订阅地址。',
      siteUrl,
      sourceKind: '关键词',
    },
    {
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/${clean}`,
      targetTitle: `Bilibili ${clean}`,
      targetView: FeedViewType.SocialMedia,
      description: '根据 UID 生成 Bilibili 动态订阅地址。',
      siteUrl,
      sourceKind: '关键词',
    },
  ]
}

const KEYWORD_BUILDERS: KeywordCandidateBuilder[] = [
  { platform: 'x', build: buildXKeywordCandidates },
  { platform: 'instagram', build: buildInstagramKeywordCandidates },
  { platform: 'youtube', build: buildYouTubeKeywordCandidates },
  { platform: 'bilibili', build: buildBilibiliKeywordCandidates },
]

function sanitizeKeywordQuery(query: string): string {
  const clean = query.trim().replace(/^@/, '')
  if (!clean || /^https?:\/\//i.test(clean) || /^rsshub:\/\//i.test(clean)) {
    return ''
  }
  return clean
}

export function resolveKeywordCandidatesByPlatform(
  query: string,
  platform: DiscoverSearchPlatform,
): ResolvedDiscoverCandidate[] {
  const clean = sanitizeKeywordQuery(query)
  if (!clean) {
    return []
  }

  const seen: Set<string> = new Set<string>()
  const candidates: ResolvedDiscoverCandidate[] = []
  KEYWORD_BUILDERS.forEach((builder: KeywordCandidateBuilder) => {
    if (platform !== 'all' && platform !== builder.platform) {
      return
    }
    builder.build(clean).forEach((candidate: ResolvedDiscoverCandidate) => {
      if (seen.has(candidate.targetUrl)) {
        return
      }
      seen.add(candidate.targetUrl)
      candidates.push(candidate)
    })
  })
  return sortResolvedCandidates(candidates, query)
}
