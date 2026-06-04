// Feed-related types

export enum FeedViewType {
  Articles = 0,
  SocialMedia = 1,
  Videos = 2,
  Pictures = 3,
}

export type FeedRefreshStatus = 'idle' | 'succeeded' | 'failed'

export interface ViewDefinition {
  id: FeedViewType
  name: string
  icon: string
  color: string
  gridMode: boolean
  wideMode: boolean
}

export const VIEW_DEFINITIONS: Record<FeedViewType, ViewDefinition> = {
  [FeedViewType.Articles]: {
    id: FeedViewType.Articles,
    name: '文章',
    icon: 'FileText',
    color: 'text-lime-600',
    gridMode: false,
    wideMode: false,
  },
  [FeedViewType.SocialMedia]: {
    id: FeedViewType.SocialMedia,
    name: '社交媒体',
    icon: 'MessageCircle',
    color: 'text-sky-500',
    gridMode: false,
    wideMode: true,
  },
  [FeedViewType.Videos]: {
    id: FeedViewType.Videos,
    name: '视频',
    icon: 'Play',
    color: 'text-red-500',
    gridMode: true,
    wideMode: true,
  },
  [FeedViewType.Pictures]: {
    id: FeedViewType.Pictures,
    name: '图片',
    icon: 'Image',
    color: 'text-pink-500',
    gridMode: true,
    wideMode: true,
  },
}

export interface Feed {
  id: string
  title: string
  url: string
  siteUrl?: string
  description?: string
  imageUrl?: string
  folder?: string
  category?: string
  view: FeedViewType
  maxEntries?: number
  showInAll?: boolean
  lastFetched?: number
  etag?: string
  lastModified?: string
  fetchSource?: 'auto' | 'direct' | 'local-agent' | 'private-aggregator'
  upstreamUrl?: string
  remoteFeedId?: string
  provider?: 'local' | 'fever'
  lastRefreshStatus?: FeedRefreshStatus
  lastRefreshAttemptedAt?: number
  lastRefreshError?: string
  lastRefreshRawError?: string
  errorCount: number
  createdAt: number
}

export interface FeedWithCount extends Feed {
  unreadCount: number
}

export type FeedColumnId =
  | 'category'
  | 'type'
  | 'maxEntries'
  | 'unread'
  | 'actions'

export const FEED_COLUMN_DEFAULTS: Array<{
  id: FeedColumnId
  visible: boolean
}> = [
  { id: 'category', visible: true },
  { id: 'type', visible: true },
  { id: 'maxEntries', visible: true },
  { id: 'unread', visible: true },
  { id: 'actions', visible: true },
]
