/**
 * Target-URL reasoning for the feed-subscribe flow.
 *
 * The user can arrive at the subscribe screen via three different paths:
 *   - Direct URL paste                  → targetUrl is the canonical feed URL
 *   - Discover preview / RSSHub source  → targetUrl is an RSSHub route that
 *                                          may need provider-specific remapping
 *                                          (e.g. Bilibili: video vs dynamic)
 *   - Edit of an already-subscribed feed → targetUrl is the stored feed URL
 *
 * The helpers here are pure functions: given the inputs the user typed/picked,
 * produce the URL that should actually be posted to the repository.
 */

import { FeedViewType } from '../models/LivoModels'
import { canonicalInstagramFeedUrl } from './SocialFeedTitles'

const DEFAULT_RSSHUB_INSTANCE = 'https://rsshub.pseudoyu.com'
const BILIBILI_USER_ROUTE_PATTERN = /\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i
const URL_INSTANCE_PATTERN = /^(https?:\/\/[^/]+)/i
const URL_HOST_PATTERN = /^https?:\/\/([^/]+)/i

export function normalizeFeedUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

export function isBilibiliFeedSource(targetUrl: string, targetSiteUrl: string): boolean {
  const site = targetSiteUrl.toLowerCase()
  const target = targetUrl.toLowerCase()
  return site.includes('space.bilibili.com')
    || site.includes('bilibili.com')
    || target.includes('/bilibili/user/video/')
    || target.includes('/bilibili/user/dynamic/')
}

export function mapBilibiliTargetUrl(
  targetUrl: string,
  targetSiteUrl: string,
  selectedView: FeedViewType,
): string {
  if (!isBilibiliFeedSource(targetUrl, targetSiteUrl)) {
    return targetUrl
  }
  const matched = targetUrl.match(BILIBILI_USER_ROUTE_PATTERN)
  const uid = matched?.[1] ?? ''
  if (!uid) {
    return targetUrl
  }
  const instanceMatch = targetUrl.match(URL_INSTANCE_PATTERN)
  const instance = instanceMatch?.[1] ?? DEFAULT_RSSHUB_INSTANCE

  if (selectedView === FeedViewType.SocialMedia) {
    return `${instance}/bilibili/user/dynamic/${uid}`
  }
  if (selectedView === FeedViewType.Videos) {
    return `${instance}/bilibili/user/video/${uid}`
  }
  return targetUrl
}

export function effectiveSubscribedUrl(targetUrl: string, siteUrl: string): string {
  return canonicalInstagramFeedUrl(targetUrl, siteUrl) || targetUrl
}

export function feedFaviconUrl(siteUrl: string, targetUrl: string): string {
  const host = hostOf(siteUrl || targetUrl)
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : ''
}

function hostOf(url: string): string {
  const matched = url.match(URL_HOST_PATTERN)
  return matched?.[1] ? matched[1].replace(/^www\./i, '') : ''
}
