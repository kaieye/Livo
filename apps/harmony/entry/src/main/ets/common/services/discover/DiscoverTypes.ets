import { FeedViewType } from '../../models/LivoModels'

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
