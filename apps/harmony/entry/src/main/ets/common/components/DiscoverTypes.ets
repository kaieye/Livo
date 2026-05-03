import { FeedViewType } from '../models/LivoModels'
import { RecommendedFeed, ResolvedDiscoverCandidate } from '../services/discover/DiscoverTypes'

export interface DirectUrlResult {
  targetUrl: string
  siteUrl: string
  title: string
  description: string
}

export class DiscoverFlowRouteParams {
  targetUrl: string = ''
  targetTitle: string = ''
  targetView: FeedViewType = FeedViewType.Articles
  siteUrl: string = ''
  imageUrl: string = ''
  description: string = ''
  sourceKind: string = ''
  category: string = ''
  restoreOverlayLevel: number = 0
}

export class DiscoverBrowseRouteParams {
  view: FeedViewType = FeedViewType.Articles
  title: string = ''
  sourceKey: string = ''
  restoreOverlayLevel: number = 0
}

export interface DiscoverCategoryCard {
  id: string
  view: FeedViewType
  label: string
  accent: string
  sourceKey?: string
  icon?: Resource
}

export interface DiscoverBrowseAvatarHydrationTask {
  key: string
  title: string
  targetUrl: string
  siteUrl: string
  imageUrl: string
  currentImageUrl: string
}

export type DiscoverOverlayRoute = 'none' | 'browse' | 'preview' | 'subscribe-config'
export type DiscoverConfigReturnTarget = 'root' | 'browse' | 'preview'

export function createDiscoverResultFromFeed(feed: RecommendedFeed): ResolvedDiscoverCandidate {
  return {
    targetUrl: feed.url,
    targetTitle: feed.title,
    targetView: feed.view,
    description: feed.description,
    siteUrl: feed.siteUrl,
    sourceKind: '推荐',
    imageUrl: feed.imageUrl || '',
    followers: feed.followers || '',
  }
}

function isBilibiliDiscoverTarget(targetUrl: string, siteUrl: string): boolean {
  const normalizedTargetUrl = targetUrl.toLowerCase()
  const normalizedSiteUrl = siteUrl.toLowerCase()
  return normalizedTargetUrl.includes('/bilibili/')
    || normalizedSiteUrl.includes('space.bilibili.com')
    || normalizedSiteUrl.includes('bilibili.com')
}

function resolveDiscoverDefaultTargetView(targetUrl: string, siteUrl: string, targetView: FeedViewType): FeedViewType {
  if (isBilibiliDiscoverTarget(targetUrl, siteUrl)) {
    return FeedViewType.Videos
  }
  return targetView
}

export function createDiscoverFlowRouteParams(
  targetUrl: string,
  targetTitle: string,
  targetView: FeedViewType,
  siteUrl: string,
  imageUrl: string,
  description: string,
  sourceKind: string,
  category: string,
  restoreOverlayLevel: number = 0,
): DiscoverFlowRouteParams {
  const params = new DiscoverFlowRouteParams()
  params.targetUrl = targetUrl
  params.targetTitle = targetTitle
  params.targetView = resolveDiscoverDefaultTargetView(targetUrl, siteUrl, targetView)
  params.siteUrl = siteUrl
  params.imageUrl = imageUrl
  params.description = description
  params.sourceKind = sourceKind
  params.category = category
  params.restoreOverlayLevel = restoreOverlayLevel
  return params
}

