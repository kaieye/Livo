// Entry and discovery types
import type { FeedWithCount } from './feed'

export interface MediaItem {
  url: string
  type: 'photo' | 'video' | 'audio'
  previewUrl?: string
  width?: number
  height?: number
  blurhash?: string
  duration?: number
}

export interface Entry {
  id: string
  feedId: string
  title: string
  url: string
  content?: string
  summary?: string
  /** 自动全文抓取保存的正文，不覆盖 RSS 原始正文。 */
  readabilityContent?: string
  readabilityTitle?: string
  readabilityExcerpt?: string
  readabilitySiteName?: string
  readabilityLength?: number
  readabilityFetchedAt?: number
  readabilityError?: string
  /** 自动生成的 AI 摘要。 */
  aiSummary?: string
  aiSummaryGeneratedAt?: number
  aiSummaryError?: string
  notifiedAt?: number
  author?: string
  authorAvatar?: string
  imageUrl?: string
  media?: MediaItem[]
  publishedAt: number
  isRead: boolean
  isStarred: boolean
  readProgress?: number
  isListened?: boolean
  listenProgress?: number
  createdAt: number
}

export interface EntryListResult {
  entries: Entry[]
  hasMore: boolean
}

export type EntryTaskStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'

export interface EntryTaskState {
  status: EntryTaskStatus
  error?: string
  updatedAt?: number
}

export interface EntryTaskSnapshot {
  fulltext: EntryTaskState
  aiSummary: EntryTaskState
  aiTranslate?: EntryTaskState
}

export interface ReaderSnapshotEntry extends Entry {
  taskSnapshot: EntryTaskSnapshot
}

export interface DiscoverFeedPreviewEntry {
  id: string
  title: string
  url: string
  summary?: string
  content?: string
  author?: string
  imageUrl?: string
  publishedAt: number
}

export interface DiscoverFeedPreview {
  targetUrl: string
  resolvedFeedUrl: string
  feedTitle: string
  siteUrl?: string
  description?: string
  imageUrl?: string
  itemCount: number
  entries: DiscoverFeedPreviewEntry[]
}

export type DiscoverFeedPreviewResult =
  | { success: true; preview: DiscoverFeedPreview }
  | { success: false; error: string }

export type ReaderSnapshotScope =
  | { type: 'all'; feedIds?: string[] }
  | { type: 'feed'; feedId: string }
  | { type: 'starred' }

export interface ReaderSnapshotRequest {
  scope?: ReaderSnapshotScope
  limit?: number
  cursor?: string | null
  unreadOnly?: boolean
  compact?: boolean
  maxContentLength?: number
}

export interface ReaderSnapshotCounts {
  totalFeeds: number
  totalUnread: number
  unreadByFeedId: Record<string, number>
  scopeUnread: number
}

export interface ReaderSnapshot {
  feeds: FeedWithCount[]
  entries: ReaderSnapshotEntry[]
  counts: ReaderSnapshotCounts
  nextCursor: string | null
}
