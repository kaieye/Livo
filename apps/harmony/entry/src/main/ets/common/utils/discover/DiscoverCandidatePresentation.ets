import { FeedViewType } from '../../models/LivoModels'
import { ResolvedDiscoverCandidate } from '../../services/discover/DiscoverTypes'
import { extractBilibiliIdentity, extractYouTubeIdentity } from './DiscoverFeedIdentity'
import { extractInstagramUsername, extractXUsername } from '../social/SocialFeedTitles'
import { resolveSocialFeedDisplayImageUrl } from '../social/SocialFeedPresentation'

export function hostOf(url: string): string {
  const matched = (url || '').match(/^https?:\/\/([^/]+)/i)
  return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
}

export function normalizeSiteUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/\/+/, '')}`
  }
  return trimmed
}

function hostOfAny(primaryUrl: string, secondaryUrl: string): string {
  const primaryHost = hostOf(normalizeSiteUrl(primaryUrl))
  if (primaryHost) {
    return primaryHost
  }
  return hostOf(normalizeSiteUrl(secondaryUrl))
}

export function platformColor(label: string, fallback: string): string {
  if (label === 'YouTube') {
    return '#FF3B30'
  }
  if (label === 'Instagram') {
    return '#E1306C'
  }
  if (label === 'Bilibili') {
    return '#00A1D6'
  }
  if (label === 'GitHub') {
    return '#111827'
  }
  if (label === 'X') {
    return '#111111'
  }
  if (label === '官方 RSS') {
    return '#16A34A'
  }
  if (label === 'RSSHub') {
    return '#2563EB'
  }
  if (label === 'Nitter') {
    return '#475569'
  }
  if (label === '关键词') {
    return '#7C3AED'
  }
  if (label === '推荐') {
    return '#F97316'
  }
  if (label === '精选') {
    return '#0EA5E9'
  }
  if (label === '博客') {
    return '#8B5CF6'
  }
  if (label === '科技') {
    return '#2563EB'
  }
  if (label === '开发') {
    return '#0F766E'
  }
  if (label === '社区') {
    return '#D97706'
  }
  if (label === '图文') {
    return '#F59E0B'
  }
  if (label === '摄影') {
    return '#14B8A6'
  }
  if (label === '演讲') {
    return '#7C3AED'
  }
  if (label === '资讯') {
    return '#14A44D'
  }
  return fallback
}

export function isInstagramPlaceholderAvatar(url: string): boolean {
  const normalized = (url || '').trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return normalized.includes('unavatar.io/instagram/')
    || normalized.includes('instagram.com/static/images/ico')
    || normalized.includes('instagram_static/images/ico')
    || normalized.includes('instagram_logo')
    || normalized.includes('instagram-logo')
    || normalized.includes('favicon')
    || normalized.includes('/logo')
}

export function resolvedPlatformLabel(
  candidate: ResolvedDiscoverCandidate,
  viewLabel: (view: FeedViewType) => string,
): string {
  if (candidate.targetUrl.includes('/youtube/') || candidate.targetUrl.includes('youtube.com/feeds/videos.xml')) {
    return 'YouTube'
  }
  if (candidate.targetUrl.includes('/instagram/')) {
    return 'Instagram'
  }
  if (candidate.targetUrl.includes('/bilibili/')) {
    return 'Bilibili'
  }
  if (candidate.targetUrl.includes('/github/')) {
    return 'GitHub'
  }
  if (candidate.targetUrl.includes('/x/user/') || candidate.targetUrl.includes('/twitter/user/') || candidate.targetUrl.includes('nitter.')) {
    return 'X'
  }
  return viewLabel(candidate.targetView)
}

export function candidateAvatarCacheKey(candidate: ResolvedDiscoverCandidate): string {
  return `${candidate.targetUrl.trim()}|${candidate.siteUrl.trim()}`
}

export function faviconUrl(siteUrl: string): string {
  const host = hostOf(siteUrl)
  return host ? `https://${host}/favicon.ico` : ''
}

export function resolvedCandidateAvatarUrl(
  candidate: ResolvedDiscoverCandidate,
  override: string,
  viewLabel: (view: FeedViewType) => string,
): string {
  if (override.trim()) {
    return override.trim()
  }

  const resolvedImageUrl = resolveSocialFeedDisplayImageUrl(
    candidate.imageUrl ?? '',
    candidate.targetUrl,
    candidate.siteUrl,
    candidate.targetTitle,
  )
  if (resolvedImageUrl) {
    if (resolvedPlatformLabel(candidate, viewLabel) === 'Instagram' && isInstagramPlaceholderAvatar(resolvedImageUrl)) {
      return ''
    }
    return resolvedImageUrl
  }

  const platform = resolvedPlatformLabel(candidate, viewLabel)
  if (platform === 'GitHub') {
    return 'https://github.githubassets.com/favicons/favicon.svg'
  }
  return faviconUrl(candidate.siteUrl)
}

export function candidateAvatarFallbackUrls(
  imageUrl: string,
  targetUrl: string,
  siteUrl: string,
  title: string,
): string[] {
  const candidates: string[] = []
  const pushCandidate = (value: string): void => {
    const trimmed = (value || '').trim()
    if (!trimmed || candidates.includes(trimmed)) {
      return
    }
    candidates.push(trimmed)
  }

  pushCandidate(imageUrl)

  const normalizedTargetUrl = normalizeSiteUrl(targetUrl)
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl)
  const host = hostOfAny(normalizedSiteUrl, normalizedTargetUrl)

  const xUsername = extractXUsername(normalizedTargetUrl) || extractXUsername(normalizedSiteUrl) || extractXUsername(title || '')
  if (xUsername) {
    pushCandidate(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
  }

  const instagramUsername = extractInstagramUsername(normalizedTargetUrl)
    || extractInstagramUsername(normalizedSiteUrl)
    || extractInstagramUsername(title || '')
  if (instagramUsername) {
    pushCandidate(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`)
  }

  const bilibiliIdentity = extractBilibiliIdentity(normalizedTargetUrl) || extractBilibiliIdentity(normalizedSiteUrl)
  if (bilibiliIdentity.startsWith('bilibili:')) {
    pushCandidate(`https://unavatar.io/bilibili/${encodeURIComponent(bilibiliIdentity.replace(/^bilibili:/, ''))}?fallback=false`)
  }

  const youtubeIdentity = extractYouTubeIdentity(normalizedTargetUrl) || extractYouTubeIdentity(normalizedSiteUrl)
  if (youtubeIdentity.startsWith('youtube:channel:')) {
    pushCandidate(`https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:channel:/, ''))}?fallback=false`)
  } else if (youtubeIdentity.startsWith('youtube:handle:')) {
    pushCandidate(`https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:handle:/, ''))}?fallback=false`)
  } else if (youtubeIdentity.startsWith('youtube:user:')) {
    pushCandidate(`https://unavatar.io/youtube/${encodeURIComponent(youtubeIdentity.replace(/^youtube:user:/, ''))}?fallback=false`)
  }

  if (host) {
    pushCandidate(`https://icons.duckduckgo.com/ip3/${host}.ico`)
    pushCandidate(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
    pushCandidate(`https://${host}/favicon.ico`)
    pushCandidate(`https://www.${host}/favicon.ico`)
  }

  return candidates
}

export function shouldHydrateCandidateAvatar(
  candidate: ResolvedDiscoverCandidate,
  currentUrl: string,
  viewLabel: (view: FeedViewType) => string,
): boolean {
  const platform = resolvedPlatformLabel(candidate, viewLabel)
  if (platform !== 'Instagram' && platform !== 'YouTube' && platform !== 'Bilibili') {
    return false
  }

  const normalizedCurrentUrl = currentUrl.toLowerCase()
  if (!normalizedCurrentUrl) {
    return true
  }

  return normalizedCurrentUrl.includes('unavatar.io/instagram/')
    || normalizedCurrentUrl.includes('unavatar.io/youtube/')
    || normalizedCurrentUrl.includes('unavatar.io/bilibili/')
    || normalizedCurrentUrl.includes('favicon')
    || normalizedCurrentUrl.includes('apple-touch-icon')
    || normalizedCurrentUrl.includes('/logo')
}
