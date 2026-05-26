import { FeedViewType } from './DomainModels'

export interface FeedCardModel {
  id: string
  title: string
  description: string
  category: string
  url: string
  siteUrl: string
  imageUrl: string
  unreadLabel: string
  unreadCount: number
  view: FeedViewType
  viewLabel: string
  viewBadgeColor: string
  accentColor: string
}

export interface EntryCardModel {
  id: string
  feedId: string
  title: string
  summary: string
  content: string
  imageUrl: string
  feedImageUrl: string
  author: string
  articleUrl: string
  publishedAt: number
  publishedLabel: string
  readingLabel: string
  tags: string[]
  mediaUrls?: string[]
  rawMediaUrls?: string[]
  feedTitle: string
  feedCategory: string
  view: FeedViewType
  viewLabel: string
  viewBadgeColor: string
  hasVideoMedia: boolean
  isRead: boolean
  isStarred: boolean
}

export interface ArticleContentBlock {
  id: string
  type: 'paragraph' | 'image' | 'video' | 'audio'
  text: string
  imageUrl: string
  videoUrl: string
  audioUrl?: string
}

export interface ArticleDetailModel extends EntryCardModel {
  contentParagraphs: string[]
  contentBlocks: ArticleContentBlock[]
  articleUrl: string
  siteUrl: string
}
