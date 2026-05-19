import { FeedViewType } from '../../models/LivoModels'
import { DEFAULT_NITTER_INSTANCE, DEFAULT_RSSHUB_INSTANCE } from '../../AppConfig'
import { DiscoverSearchPlatform, ResolvedDiscoverCandidate, WebUrlParts } from './DiscoverTypes'
import { extractWebParts } from './DiscoverUrlParsing'
import { sortResolvedCandidates } from './DiscoverCandidateScoring'

type ProfileResolver = (parts: WebUrlParts) => ResolvedDiscoverCandidate[]

function resolveYouTubeProfile(parts: WebUrlParts): ResolvedDiscoverCandidate[] {
  const candidates: ResolvedDiscoverCandidate[] = []
  const first = parts.pathSegments[0] ?? ''
  const second = parts.pathSegments[1] ?? ''

  if (first === 'channel' && second.startsWith('UC')) {
    candidates.push({
      targetUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(second)}`,
      targetTitle: `YouTube ${second}`,
      targetView: FeedViewType.Videos,
      description: '已从 YouTube 频道主页解析为官方订阅地址。',
      siteUrl: parts.normalizedUrl,
      sourceKind: '官方 RSS',
    })
    candidates.push({
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
      candidates.push({
        targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/@${encodeURIComponent(handle)}`,
        targetTitle: `YouTube @${handle}`,
        targetView: FeedViewType.Videos,
        description: '已从 YouTube 主页解析为 RSSHub 订阅地址。',
        siteUrl: parts.normalizedUrl,
        sourceKind: 'RSSHub',
      })
    }
  } else if ((first === 'user' || first === 'c') && second) {
    candidates.push({
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/youtube/user/${encodeURIComponent(second)}`,
      targetTitle: `YouTube ${second}`,
      targetView: FeedViewType.Videos,
      description: '已从 YouTube 用户主页解析为 RSSHub 订阅地址。',
      siteUrl: parts.normalizedUrl,
      sourceKind: 'RSSHub',
    })
  }
  return candidates
}

function resolveXProfile(parts: WebUrlParts): ResolvedDiscoverCandidate[] {
  const username = (parts.pathSegments[0] ?? '').replace(/^@/, '')
  if (!username) {
    return []
  }
  return [
    {
      targetUrl: `${DEFAULT_NITTER_INSTANCE}/${encodeURIComponent(username.toLowerCase())}/rss`,
      targetTitle: `@${username}`,
      targetView: FeedViewType.SocialMedia,
      description: '已从 X/Twitter 主页解析为 Nitter 订阅地址。',
      siteUrl: parts.normalizedUrl,
      sourceKind: 'Nitter',
    },
  ]
}

function resolveInstagramProfile(parts: WebUrlParts): ResolvedDiscoverCandidate[] {
  const username = (parts.pathSegments[0] ?? '').replace(/^@/, '')
  if (!username) {
    return []
  }
  return [{
    targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/instagram/user/${encodeURIComponent(username)}`,
    targetTitle: `@${username}`,
    targetView: FeedViewType.Pictures,
    description: '已从 Instagram 主页解析为 RSSHub 用户订阅地址。',
    siteUrl: parts.normalizedUrl,
    sourceKind: 'RSSHub',
  }]
}

function resolveBilibiliProfile(parts: WebUrlParts): ResolvedDiscoverCandidate[] {
  const uid = parts.pathSegments[0] ?? ''
  if (!/^\d+$/.test(uid)) {
    return []
  }
  return [
    {
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/dynamic/${uid}`,
      targetTitle: `Bilibili ${uid}`,
      targetView: FeedViewType.SocialMedia,
      description: '已从 Bilibili 主页解析为动态订阅地址。',
      siteUrl: parts.normalizedUrl,
      sourceKind: 'RSSHub',
    },
    {
      targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/bilibili/user/video/${uid}`,
      targetTitle: `Bilibili ${uid}`,
      targetView: FeedViewType.Videos,
      description: '已从 Bilibili 主页解析为视频订阅地址。',
      siteUrl: parts.normalizedUrl,
      sourceKind: 'RSSHub',
    },
  ]
}

function resolveGitHubProfile(parts: WebUrlParts): ResolvedDiscoverCandidate[] {
  const username = parts.pathSegments[0] ?? ''
  if (!username) {
    return []
  }
  return [{
    targetUrl: `${DEFAULT_RSSHUB_INSTANCE}/github/user/${encodeURIComponent(username)}`,
    targetTitle: `GitHub ${username}`,
    targetView: FeedViewType.Articles,
    description: '已从 GitHub 主页解析为 RSSHub 用户订阅地址。',
    siteUrl: parts.normalizedUrl,
    sourceKind: 'RSSHub',
  }]
}

function resolverForHost(host: string): ProfileResolver | undefined {
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    return resolveYouTubeProfile
  }
  if (host === 'x.com' || host === 'twitter.com') {
    return resolveXProfile
  }
  if (host === 'instagram.com') {
    return resolveInstagramProfile
  }
  if (host === 'space.bilibili.com') {
    return resolveBilibiliProfile
  }
  if (host === 'github.com') {
    return resolveGitHubProfile
  }
  return undefined
}

function resolveProfileCandidates(value: string): ResolvedDiscoverCandidate[] {
  const parts = extractWebParts(value)
  if (!parts) {
    return []
  }
  const resolver = resolverForHost(parts.host)
  if (!resolver) {
    return []
  }

  const seen = new Set<string>()
  const candidates: ResolvedDiscoverCandidate[] = []
  resolver(parts).forEach((candidate: ResolvedDiscoverCandidate) => {
    if (seen.has(candidate.targetUrl)) {
      return
    }
    seen.add(candidate.targetUrl)
    candidates.push(candidate)
  })
  return sortResolvedCandidates(candidates, value)
}

function matchesPlatform(candidate: ResolvedDiscoverCandidate, platform: DiscoverSearchPlatform): boolean {
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
}

export function resolveProfileCandidatesByPlatform(
  value: string,
  platform: DiscoverSearchPlatform,
): ResolvedDiscoverCandidate[] {
  const items = resolveProfileCandidates(value)
  if (platform === 'all') {
    return items
  }
  return items.filter((candidate: ResolvedDiscoverCandidate) => matchesPlatform(candidate, platform))
}
