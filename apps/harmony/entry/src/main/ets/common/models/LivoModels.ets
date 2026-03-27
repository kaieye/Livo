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
  imageUrl?: string
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
  imageUrl: string
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
  contentBlocks: ArticleContentBlock[]
  articleUrl: string
  siteUrl: string
}

export interface ArticleContentBlock {
  id: string
  type: 'paragraph' | 'image'
  text: string
  imageUrl: string
}

export function isLegacyPlainArticleContent(content: string): boolean {
  const normalized = (content || '').trim()
  if (!normalized) {
    return false
  }

  return !/<[a-z][\s\S]*>/i.test(normalized) && !/\[\[IMG_\d+\]\]/.test(normalized)
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
    imageUrl: feed.imageUrl ?? '',
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
  const blocks = buildArticleContentBlocks(entry.content, entry.url || feed.siteUrl || feed.url)
  const paragraphs = blocks
    .filter((block: ArticleContentBlock) => block.type === 'paragraph')
    .map((block: ArticleContentBlock) => block.text)

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
    isRead: card.isRead,
    isStarred: card.isStarred,
    contentParagraphs: paragraphs,
    contentBlocks: blocks,
    articleUrl: entry.url,
    siteUrl: feed.siteUrl ?? feed.url,
  }
}

function decodeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ')
}

function resolveAbsoluteUrl(baseUrl: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }

  const base = (baseUrl || '').trim()
  if (!base) {
    return trimmed
  }

  const originMatch = base.match(/^(https?:\/\/[^/]+)(\/.*)?$/i)
  const origin = originMatch?.[1] ?? ''
  const basePath = originMatch?.[2] ?? '/'

  if (!origin) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`
  }

  const normalizedBaseDir = basePath.includes('/')
    ? basePath.replace(/\/[^/]*$/, '/')
    : '/'

  return `${origin}${normalizedBaseDir}${trimmed}`.replace(/([^:]\/)\/+/g, '$1')
}

function extractImageUrl(tag: string, baseUrl: string): string {
  const srcMatch = tag.match(/\b(?:data-src|data-original|src)=["']([^"']+)["']/i)
  return srcMatch?.[1] ? resolveAbsoluteUrl(baseUrl, decodeBasicHtml(srcMatch[1])) : ''
}

function pushParagraphBlocks(source: string, blocks: ArticleContentBlock[], startIndex: number): number {
  const segments = source
    .split(/\n{2,}/)
    .map((item: string) => item.replace(/[ \t]+\n/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((item: string) => item.length > 0)

  let index = startIndex
  segments.forEach((text: string) => {
    const refinedParagraphs = splitDenseParagraph(text)
    refinedParagraphs.forEach((paragraph: string) => {
      blocks.push({
        id: `paragraph-${index}`,
        type: 'paragraph',
        text: paragraph,
        imageUrl: '',
      })
      index += 1
    })
  })
  return index
}

function splitDenseParagraph(text: string): string[] {
  const normalized = text.trim()
  if (!normalized) {
    return []
  }

  const numberedParts = normalized
    .replace(/([。！？!?])\s*(\d+[、.．])/g, '$1\n\n$2')
    .replace(/([。！？!?])\s*((?:其|另|再)次[，,]?)/g, '$1\n\n$2')
    .split(/\n{2,}/)
    .map((item: string) => item.trim())
    .filter((item: string) => item.length > 0)

  const result: string[] = []
  numberedParts.forEach((part: string) => {
    if (part.length <= 110) {
      result.push(part)
      return
    }

    let current = ''
    const sentences = part.match(/[^。！？!?]+[。！？!?]?/g) ?? [part]
    sentences.forEach((sentence: string) => {
      const next = `${current}${sentence}`.trim()
      if (current && next.length > 110) {
        result.push(current.trim())
        current = sentence.trim()
      } else {
        current = next
      }
    })
    if (current.trim()) {
      result.push(current.trim())
    }
  })

  return result.length > 0 ? result : [normalized]
}

function buildArticleContentBlocks(content: string, baseUrl: string): ArticleContentBlock[] {
  const raw = (content || '').trim()
  if (!raw) {
    return []
  }

  const imageUrls: string[] = []
  let normalized = decodeBasicHtml(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag: string) => {
      const imageUrl = extractImageUrl(tag, baseUrl)
      if (!imageUrl) {
        return '\n\n'
      }
      const imageIndex = imageUrls.length
      imageUrls.push(imageUrl)
      return `\n\n[[IMG_${imageIndex}]]\n\n`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?:\/p|\/div|\/section|\/article|\/blockquote|\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/tr)>/gi, '\n\n')
    .replace(/<(?:p|div|section|article|blockquote|h[1-6]|ul|ol|pre|tr)\b[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')

  const parts = normalized.split(/(\[\[IMG_\d+\]\])/g)
  const blocks: ArticleContentBlock[] = []
  let blockIndex = 0

  parts.forEach((part: string) => {
    const imageMatch = part.match(/^\[\[IMG_(\d+)\]\]$/)
    if (imageMatch?.[1]) {
      const imageUrl = imageUrls[Number(imageMatch[1])] ?? ''
      if (imageUrl) {
        blocks.push({
          id: `image-${blockIndex}`,
          type: 'image',
          text: '',
          imageUrl,
        })
        blockIndex += 1
      }
      return
    }

    blockIndex = pushParagraphBlocks(part, blocks, blockIndex)
  })

  return blocks
}
