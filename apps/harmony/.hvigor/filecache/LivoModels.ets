export enum FeedViewType {
  Articles = 0,
  SocialMedia = 1,
  Videos = 2,
  Pictures = 3,
}

export interface ViewDefinition {
  id: FeedViewType
  label: string
  badgeColor: string
  accentColor: string
}

export interface Feed {
  id: string
  title: string
  url: string
  siteUrl?: string
  description?: string
  category?: string
  view: FeedViewType
  showInAll: boolean
  lastFetched?: number
  etag?: string
  lastModified?: string
  errorCount: number
  createdAt: number
  updatedAt: number
}

export interface Entry {
  id: string
  feedId: string
  title: string
  url: string
  summary: string
  content: string
  author: string
  publishedAt: number
  readingTimeMinutes: number
  tags: string[]
  isRead: boolean
  isStarred: boolean
  createdAt: number
  updatedAt: number
}

export interface FeedWithCount extends Feed {
  unreadCount: number
}

export interface DashboardMetric {
  label: string
  value: string
  hint: string
}

export interface FeedCardModel {
  id: string
  title: string
  description: string
  category: string
  siteUrl: string
  unreadLabel: string
  unreadCount: number
  viewLabel: string
  viewBadgeColor: string
  accentColor: string
}

export interface EntryCardModel {
  id: string
  feedId: string
  title: string
  summary: string
  author: string
  publishedLabel: string
  readingLabel: string
  tags: string[]
  feedTitle: string
  feedCategory: string
  viewLabel: string
  viewBadgeColor: string
  isRead: boolean
  isStarred: boolean
}

export interface ArticleDetailModel extends EntryCardModel {
  contentParagraphs: string[]
  siteUrl: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface HarmonySettings {
  autoRefresh: boolean
  aiSummaryEnabled: boolean
  imageProxyEnabled: boolean
  refreshIntervalMinutes: number
  themeMode: ThemeMode
  language: string
  remoteFeedUrl: string
}

export interface RemoteFeedResult {
  entries: EntryCardModel[]
  sourceLabel: string
  fallbackUsed: boolean
}

export const DEFAULT_HARMONY_SETTINGS: HarmonySettings = {
  autoRefresh: true,
  aiSummaryEnabled: true,
  imageProxyEnabled: false,
  refreshIntervalMinutes: 30,
  themeMode: 'system',
  language: 'zh-CN',
  remoteFeedUrl: 'https://sspai.com/feed',
}

export function viewDefinitionOf(view: FeedViewType): ViewDefinition {
  switch (view) {
    case FeedViewType.SocialMedia:
      return {
        id: FeedViewType.SocialMedia,
        label: '社交',
        badgeColor: '#DBEAFE',
        accentColor: '#2563EB',
      }
    case FeedViewType.Videos:
      return {
        id: FeedViewType.Videos,
        label: '视频',
        badgeColor: '#FEE2E2',
        accentColor: '#DC2626',
      }
    case FeedViewType.Pictures:
      return {
        id: FeedViewType.Pictures,
        label: '图片',
        badgeColor: '#FCE7F3',
        accentColor: '#DB2777',
      }
    default:
      return {
        id: FeedViewType.Articles,
        label: '文章',
        badgeColor: '#DCFCE7',
        accentColor: '#16A34A',
      }
  }
}

export function formatPublishedAt(timestamp: number): string {
  const target = new Date(timestamp)
  const now = new Date()
  const sameYear = target.getFullYear() === now.getFullYear()
  const sameMonth = target.getMonth() === now.getMonth()
  const sameDate = target.getDate() === now.getDate()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const isYesterday = target.getFullYear() === yesterday.getFullYear()
    && target.getMonth() === yesterday.getMonth()
    && target.getDate() === yesterday.getDate()
  const hours = target.getHours().toString().padStart(2, '0')
  const minutes = target.getMinutes().toString().padStart(2, '0')

  if (sameYear && sameMonth && sameDate) {
    return `今天 ${hours}:${minutes}`
  }

  if (isYesterday) {
    return `昨天 ${hours}:${minutes}`
  }

  return `${sameYear ? '' : `${target.getFullYear()}年`}${target.getMonth() + 1}月${target.getDate()}日 ${hours}:${minutes}`
}

export function toFeedCardModel(feed: FeedWithCount): FeedCardModel {
  const definition = viewDefinitionOf(feed.view)

  return {
    id: feed.id,
    title: feed.title,
    description: feed.description ?? '等待补充订阅描述',
    category: feed.category ?? '未分类',
    siteUrl: feed.siteUrl ?? feed.url,
    unreadLabel: `${feed.unreadCount} 未读`,
    unreadCount: feed.unreadCount,
    viewLabel: definition.label,
    viewBadgeColor: definition.badgeColor,
    accentColor: definition.accentColor,
  }
}

export function toEntryCardModel(entry: Entry, feed: Feed): EntryCardModel {
  const definition = viewDefinitionOf(feed.view)

  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary,
    author: entry.author,
    publishedLabel: formatPublishedAt(entry.publishedAt),
    readingLabel: `${entry.readingTimeMinutes} 分钟`,
    tags: entry.tags,
    feedTitle: feed.title,
    feedCategory: feed.category ?? '未分类',
    viewLabel: definition.label,
    viewBadgeColor: definition.badgeColor,
    isRead: entry.isRead,
    isStarred: entry.isStarred,
  }
}

export function toArticleDetailModel(entry: Entry, feed: Feed): ArticleDetailModel {
  const card = toEntryCardModel(entry, feed)
  const paragraphs = entry.content.split('\n').filter((paragraph: string) => paragraph.trim().length > 0)

  return {
    id: card.id,
    feedId: card.feedId,
    title: card.title,
    summary: card.summary,
    author: card.author,
    publishedLabel: card.publishedLabel,
    readingLabel: card.readingLabel,
    tags: card.tags,
    feedTitle: card.feedTitle,
    feedCategory: card.feedCategory,
    viewLabel: card.viewLabel,
    viewBadgeColor: card.viewBadgeColor,
    contentParagraphs: paragraphs,
    siteUrl: feed.siteUrl ?? feed.url,
  }
}
