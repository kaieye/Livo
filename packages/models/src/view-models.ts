import type { FeedViewType, MediaItem } from './types'

/**
 * View model for rendering an entry card in a list or grid.
 * Derived from the raw Entry + Feed data, with computed display properties.
 *
 * Components should consume this instead of reading store state directly.
 */
export interface EntryCardModel {
  id: string
  feedId: string
  title: string
  summary: string
  /** Full entry content (HTML or plain text) */
  content: string
  /** Thumbnail / hero image URL for the card */
  imageUrl: string
  /** Source feed icon/avatar URL */
  feedImageUrl: string
  author: string
  /** Original article external URL */
  articleUrl: string
  publishedAt: number
  publishedLabel: string
  readingLabel: string
  tags: string[]
  /** Processed media URLs for display (e.g., picture thumbnails) */
  mediaUrls?: string[]
  /** Raw media URLs from the entry */
  rawMediaUrls?: string[]
  /** Source feed display name (processed for social media platforms) */
  feedTitle: string
  /** Source feed category */
  feedCategory: string
  viewType: FeedViewType
  viewLabel: string
  viewBadgeColor: string
  hasVideoMedia: boolean
  isRead: boolean
  isStarred: boolean
}

/** @deprecated Use `EntryCardModel` instead — renamed for cross-platform alignment */
export type EntryCardViewModel = EntryCardModel

/**
 * View model for rendering a feed/subscription card in sidebar or feed list.
 * Derived from the raw Feed + unread count, with computed display properties.
 */
export interface FeedCardModel {
  /** Unique feed identifier */
  id: string
  /** Display title (processed for social media platforms like X/Instagram) */
  title: string
  /** Feed description or site description */
  description: string | null
  /** Feed icon/avatar URL */
  imageUrl: string | null
  /** Feed URL (RSS/Atom endpoint) */
  url: string
  /** Feed website URL */
  siteUrl: string | null
  /** User-assigned category or auto-assigned folder name */
  category: string
  /** The feed view type (Articles, SocialMedia, Videos, Pictures) */
  viewType: FeedViewType
  /** Display label for the view type */
  viewLabel: string
  /** CSS color class for the view type badge */
  viewBadgeColor: string
  /** Number of unread entries */
  unreadCount: number
  /** Human-readable unread count label (e.g., "99+" for large counts) */
  unreadLabel: string
  /** Last successful fetch timestamp (ms since epoch) */
  lastFetched: number | null
  /** Whether this feed is currently being refreshed */
  isRefreshing: boolean
  /** Whether this is a recommended/built-in feed */
  isRecommended: boolean
}

/**
 * View model for rendering a full article detail page.
 * Contains all data needed to display article content, media,
 * AI-generated summaries/translations, and source metadata.
 */
export interface ArticleDetailModel {
  /** Unique entry identifier */
  id: string
  /** Parent feed identifier */
  feedId: string
  /** Article title */
  title: string
  /** Full article HTML content (sanitized) */
  content: string
  /** Article summary / excerpt */
  summary: string
  /** Author display name */
  author: string | null
  /** Author avatar URL */
  authorAvatar: string | null
  /** Hero / cover image URL */
  imageUrl: string | null
  /** Media items (photos, videos, audio) in the article */
  media: MediaItem[]
  /** Publication timestamp (ms since epoch) */
  publishedAt: number
  /** Human-readable relative time label */
  publishedLabel: string
  /** Source feed display name */
  sourceName: string
  /** Source feed URL (for linking back) */
  sourceUrl: string
  /** Source feed icon URL */
  sourceIcon: string | null
  /** Original article URL (external link) */
  articleUrl: string
  /** Whether the entry has been read */
  isRead: boolean
  /** Whether the entry is starred */
  isStarred: boolean
  /** AI-generated summary, if available */
  aiSummary: string | null
  /** AI-generated translation, if available */
  aiTranslation: string | null
  /** Whether AI summary is currently loading */
  isSummaryLoading: boolean
  /** Whether AI translation is currently loading */
  isTranslationLoading: boolean
  /** Error message from last AI operation, if any */
  aiError: string | null
  /** Content tags */
  tags: string[]
  /** Estimated reading time in minutes */
  readingTimeMinutes: number
  /** Human-readable reading time label */
  readingLabel: string
  /** The feed view type */
  viewType: FeedViewType
}
