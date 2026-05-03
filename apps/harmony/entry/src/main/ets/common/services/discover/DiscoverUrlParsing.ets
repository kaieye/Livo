import { DEFAULT_RSSHUB_INSTANCE } from '../../AppConfig'
import { DiscoverSearchPlatform, RecommendedFeed, WebUrlParts } from './DiscoverTypes'

export function normalizeDiscoverInput(value: string): string {
  const trimmed = value.trim()
  const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
  if (rsshubMatch?.[1]) {
    const route = rsshubMatch[1].replace(/^\/+/, '')
    return `${DEFAULT_RSSHUB_INSTANCE}/${route}`
  }
  return trimmed
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

export function discoverFeedPlatform(feed: RecommendedFeed): DiscoverSearchPlatform {
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
