import { selectArticleVideoUrls } from '../utils/ArticleVideoSource'
import { resolveEntryCardImageUrl } from '../utils/EntryCardPreview'
import { isDirectVideoUrl } from '../utils/FeedMediaUrl'
import {
  extractEntryGalleryImageUrls,
  extractPictureCarouselMediaUrls,
  resolvePictureCarouselMediaItems,
} from '../utils/PictureGallery'

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
  mediaUrls?: string[]
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
  viewLabel: string
  viewBadgeColor: string
  hasVideoMedia: boolean
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
  type: 'paragraph' | 'image' | 'video'
  text: string
  imageUrl: string
  videoUrl: string
}

export function isLegacyPlainArticleContent(content: string): boolean {
  const normalized = (content || '').trim()
  if (!normalized) {
    return false
  }

  return !/<[a-z][\s\S]*>/i.test(normalized) && !/\[\[IMG_\d+\]\]/.test(normalized)
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent = 'orange' | 'blue' | 'red' | 'pink' | 'green'

export interface HarmonySettings {
  autoRefresh: boolean
  aiSummaryEnabled: boolean
  imageProxyEnabled: boolean
  searchAllHomeCategories: boolean
  refreshIntervalMinutes: number
  themeMode: ThemeMode
  themeAccent: ThemeAccent
  language: string
  remoteFeedUrl: string
}

export type AIProvider = 'minimax' | 'deepseek' | 'openai' | 'anthropic' | 'glm' | 'custom'

export interface AIProviderDefinition {
  label: string
  defaultBaseUrl: string
  models: string[]
}

export interface AIProviderOptionMap {
  minimax: AIProviderDefinition
  deepseek: AIProviderDefinition
  openai: AIProviderDefinition
  anthropic: AIProviderDefinition
  glm: AIProviderDefinition
  custom: AIProviderDefinition
}

export interface AIAssistantSettings {
  provider: AIProvider
  apiKeys: Record<string, string>
  baseUrl: string
  model: string
  enableSystemPrompt: boolean
  systemPromptTemplate: string
  chatPersonaPrompt: string
}

export const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE: string =
  'You are Livo AI assistant. Answer in concise Chinese. Context: {{context}}. Persona: {{persona}}.'

export const AI_PROVIDER_OPTIONS: AIProviderOptionMap = {
  minimax: {
    label: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    models: ['MiniMax-M2.7'],
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.4', 'gpt-5.4-mini'],
  },
  anthropic: {
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  glm: {
    label: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['GLM-5.1', 'GLM-5'],
  },
  custom: {
    label: '自定义',
    defaultBaseUrl: '',
    models: [],
  },
}

export const DEFAULT_AI_ASSISTANT_SETTINGS: AIAssistantSettings = {
  provider: 'deepseek',
  apiKeys: {},
  baseUrl: '',
  model: 'deepseek-chat',
  enableSystemPrompt: false,
  systemPromptTemplate: DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  chatPersonaPrompt: '',
}

export interface RemoteFeedResult {
  entries: EntryCardModel[]
  sourceLabel: string
  newEntriesCount?: number
  failedFeedCount?: number
  failedFeedLabels?: string[]
  failedFeedDetails?: string[]
  fallbackUsed: boolean
}

export const DEFAULT_HARMONY_SETTINGS: HarmonySettings = {
  autoRefresh: false,
  aiSummaryEnabled: true,
  imageProxyEnabled: false,
  searchAllHomeCategories: true,
  refreshIntervalMinutes: 30,
  themeMode: 'system',
  themeAccent: 'pink',
  language: 'zh-CN',
  remoteFeedUrl: 'https://sspai.com/feed',
}

export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AccountStatusResult {
  provider: AccountProvider
  linked: boolean
  displayName: string
  error: string
}

export interface AccountSelfCheckRow {
  name: string
  pass: boolean
  detail: string
}

export interface AccountSelfCheckResult {
  summary: string
  rows: AccountSelfCheckRow[]
}

export interface PendingBilibiliCreator {
  mid: number
  uname: string
  exists: boolean
}

export interface BilibiliImportProgress {
  total: number
  completed: number
  imported: number
  skipped: number
  failed: number
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

export function selectPictureMediaUrls(mediaUrls: string[]): string[] {
  const result: string[] = []

  mediaUrls.forEach((url: string) => {
    const trimmed = (url || '').trim()
    if (!trimmed) {
      return
    }

    const normalized = trimmed.toLowerCase()
    const hasImageFormatQuery = /[?&]format=(jpg|jpeg|png|webp|gif|bmp|avif)(?:[&#]|$)/i.test(normalized)
    const isImageUrl = /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized)
      || hasImageFormatQuery
      || normalized.includes('cdninstagram')
      || normalized.includes('scontent.')
      || normalized.includes('fbcdn.net')
      || normalized.includes('googleusercontent.com/')
      || normalized.includes('ytimg.com/')
      || normalized.includes('pbs.twimg.com/media/')
      || normalized.includes('twimg.com/media/')

    if (!isImageUrl || result.includes(trimmed)) {
      return
    }

    result.push(trimmed)
  })

  return result
}

export function selectPictureCarouselMediaUrls(
  mediaUrls: string[],
  fallbackImageUrls: string[] = [],
): string[] {
  const result: string[] = []

  ;[...mediaUrls, ...fallbackImageUrls].forEach((url: string) => {
    const trimmed = (url || '').trim()
    if (!trimmed || result.includes(trimmed)) {
      return
    }

    if (isDirectVideoUrl(trimmed)) {
      result.push(trimmed)
      return
    }

    if (selectPictureMediaUrls([trimmed]).length > 0) {
      result.push(trimmed)
    }
  })

  return result
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
  const pictureMediaUrls = extractEntryGalleryImageUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feed.siteUrl ?? feed.url,
    mediaUrls: entry.mediaUrls ?? [],
  })
  const hasVideoMedia = extractSupportedVideoUrls(
    [entry.title, entry.summary, entry.content, entry.url, ...(entry.mediaUrls ?? [])].join('\n'),
    entry.url || feed.siteUrl || feed.url,
    entry.url,
  ).length > 0

  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary,
    imageUrl: resolveEntryCardImageUrl({
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      articleUrl: entry.url,
      siteUrl: feed.siteUrl ?? feed.url,
      mediaUrls: entry.mediaUrls ?? [],
    }),
    feedImageUrl: feed.imageUrl ?? '',
    author: entry.author,
    articleUrl: entry.url,
    publishedAt: entry.publishedAt,
    publishedLabel: formatPublishedAt(entry.publishedAt),
    readingLabel: `${entry.readingTimeMinutes} 分钟`,
    tags: entry.tags,
    mediaUrls: selectPictureMediaUrls(pictureMediaUrls),
    rawMediaUrls: extractPictureCarouselMediaUrls({
      summary: entry.summary,
      content: entry.content,
      articleUrl: entry.url,
      siteUrl: feed.siteUrl ?? feed.url,
      mediaUrls: selectPictureCarouselMediaUrls(entry.mediaUrls ?? [], pictureMediaUrls),
    }),
    feedTitle: feed.title,
    feedCategory: feed.category ?? '未分类',
    viewLabel: definition.label,
    viewBadgeColor: definition.badgeColor,
    hasVideoMedia,
    isRead: entry.isRead,
    isStarred: entry.isStarred,
  }
}

export function articleDetailModelFromCard(card: EntryCardModel): ArticleDetailModel {
  const rawUrls = card.rawMediaUrls ?? []
  const mediaItems = resolvePictureCarouselMediaItems(rawUrls, card.imageUrl)
  const blocks: ArticleContentBlock[] = mediaItems.map((item, index): ArticleContentBlock => {
    if (item.kind === 'livePhoto' && item.videoUrl) {
      return {
        id: `video-${index}`,
        type: 'video',
        text: '',
        imageUrl: item.imageUrl || card.imageUrl,
        videoUrl: item.videoUrl,
      }
    }
    return {
      id: `image-${index}`,
      type: 'image',
      text: '',
      imageUrl: item.imageUrl,
      videoUrl: '',
    }
  })

  return {
    id: card.id,
    feedId: card.feedId,
    title: card.title,
    summary: card.summary,
    imageUrl: card.imageUrl,
    feedImageUrl: card.feedImageUrl,
    author: card.author,
    articleUrl: card.articleUrl,
    publishedAt: card.publishedAt,
    publishedLabel: card.publishedLabel,
    readingLabel: card.readingLabel,
    tags: card.tags,
    mediaUrls: card.mediaUrls,
    rawMediaUrls: card.rawMediaUrls,
    feedTitle: card.feedTitle,
    feedCategory: card.feedCategory,
    viewLabel: card.viewLabel,
    viewBadgeColor: card.viewBadgeColor,
    hasVideoMedia: card.hasVideoMedia,
    isRead: card.isRead,
    isStarred: card.isStarred,
    contentParagraphs: [],
    contentBlocks: blocks,
    siteUrl: card.articleUrl,
  }
}

export function toArticleDetailModel(entry: Entry, feed: Feed): ArticleDetailModel {
  const card = toEntryCardModel(entry, feed)
  const blocks = feed.view === FeedViewType.Pictures
    ? buildPictureDetailContentBlocks(entry, feed, card.imageUrl)
    : buildArticleContentBlocks(entry.content, entry.url || feed.siteUrl || feed.url, entry.url, entry.mediaUrls ?? [])
  const paragraphs = blocks
    .filter((block: ArticleContentBlock) => block.type === 'paragraph')
    .map((block: ArticleContentBlock) => block.text)

  return {
    id: card.id,
    feedId: card.feedId,
    title: card.title,
    summary: card.summary,
    imageUrl: card.imageUrl,
    feedImageUrl: card.feedImageUrl,
    author: card.author,
    articleUrl: card.articleUrl,
    publishedAt: card.publishedAt,
    publishedLabel: card.publishedLabel,
    readingLabel: card.readingLabel,
    tags: card.tags,
    mediaUrls: card.mediaUrls,
    feedTitle: card.feedTitle,
    feedCategory: card.feedCategory,
    viewLabel: card.viewLabel,
    viewBadgeColor: card.viewBadgeColor,
    hasVideoMedia: card.hasVideoMedia,
    isRead: card.isRead,
    isStarred: card.isStarred,
    contentParagraphs: paragraphs,
    contentBlocks: blocks,
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

function extractYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

function extractBilibiliVideoToken(value: string): string {
  const bvid = (value || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1]
  if (bvid) {
    return `BV:${bvid}`
  }

  const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1]
  if (aid) {
    return `AV:${aid}`
  }

  return ''
}

function isSupportedVideoUrl(value: string): boolean {
  return isDirectVideoUrl(value) || !!extractYouTubeVideoId(value) || !!extractBilibiliVideoToken(value)
}

function normalizeSupportedVideoUrl(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }

  if (isDirectVideoUrl(trimmed)) {
    return trimmed
  }

  const youTubeId = extractYouTubeVideoId(trimmed)
  if (youTubeId) {
    return `https://www.youtube.com/watch?v=${youTubeId}`
  }

  const bilibiliToken = extractBilibiliVideoToken(trimmed)
  if (bilibiliToken.startsWith('BV:')) {
    return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`
  }
  if (bilibiliToken.startsWith('AV:')) {
    return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`
  }

  return trimmed
}

function buildVideoPreviewUrl(videoUrl: string): string {
  const youTubeId = extractYouTubeVideoId(videoUrl)
  if (youTubeId) {
    return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`
  }
  return ''
}

function extractSupportedVideoUrls(content: string, baseUrl: string, articleUrl: string): string[] {
  const results: string[] = []
  const pushUrl = (value: string): void => {
    const resolved = normalizeSupportedVideoUrl(resolveAbsoluteUrl(baseUrl, decodeBasicHtml(value)))
    if (!resolved || !isSupportedVideoUrl(resolved) || results.includes(resolved)) {
      return
    }
    results.push(resolved)
  }

  const normalizedArticleUrl = normalizeSupportedVideoUrl(articleUrl)
  if (normalizedArticleUrl && isSupportedVideoUrl(normalizedArticleUrl)) {
    results.push(normalizedArticleUrl)
  }

  const raw = decodeBasicHtml(content || '')
  const attributeMatches = raw.matchAll(/\b(?:href|src|data-src)=["']([^"']+)["']/gi)
  for (const matched of attributeMatches) {
    if (matched[1]) {
      pushUrl(matched[1])
    }
  }

  const textMatches = raw.matchAll(
    /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/gi,
  )
  for (const matched of textMatches) {
    if (!matched[0]) {
      continue
    }
    const candidate = matched[0].startsWith('http') ? matched[0] : `https://${matched[0]}`
    pushUrl(candidate)
  }

  return results
}

function createVideoContentBlock(id: string, videoUrl: string): ArticleContentBlock {
  return {
    id,
    type: 'video',
    text: '',
    imageUrl: buildVideoPreviewUrl(videoUrl),
    videoUrl,
  }
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
      if (isStandaloneVideoParagraph(paragraph)) {
        return
      }
      blocks.push({
        id: `paragraph-${index}`,
        type: 'paragraph',
        text: paragraph,
        imageUrl: '',
        videoUrl: '',
      })
      index += 1
    })
  })
  return index
}

function isStandaloneVideoParagraph(text: string): boolean {
  const normalized = (text || '')
    .trim()
    .replace(/^[("'\[{<\s]+|[)"'\]}>、，,。.!！？\s]+$/g, '')

  if (!normalized) {
    return false
  }

  return isSupportedVideoUrl(normalized) || isSupportedVideoUrl(normalizeSupportedVideoUrl(normalized))
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

function buildArticleContentBlocks(content: string, baseUrl: string, articleUrl: string, mediaUrls: string[] = []): ArticleContentBlock[] {
  const raw = (content || '').trim()
  const videoUrls = selectArticleVideoUrls(
    articleUrl,
    mediaUrls,
    extractSupportedVideoUrls(raw, baseUrl, articleUrl),
  )

  if (!raw) {
    return videoUrls.map((videoUrl: string, index: number) => createVideoContentBlock(`video-${index}`, videoUrl))
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
      return `

[[IMG_${imageIndex}]]

`
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

  videoUrls.forEach((videoUrl: string) => {
    blocks.push(createVideoContentBlock(`video-${blockIndex}`, videoUrl))
    blockIndex += 1
  })

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
          videoUrl: '',
        })
        blockIndex += 1
      }
      return
    }

    blockIndex = pushParagraphBlocks(part, blocks, blockIndex)
  })

  return blocks
}

function buildPictureDetailContentBlocks(entry: Entry, feed: Feed, fallbackImageUrl: string): ArticleContentBlock[] {
  const baseUrl = entry.url || feed.siteUrl || feed.url
  const galleryImageUrls = extractEntryGalleryImageUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feed.siteUrl ?? feed.url,
    mediaUrls: entry.mediaUrls ?? [],
  })
  const orderedMediaUrls = extractPictureCarouselMediaUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feed.siteUrl ?? feed.url,
    mediaUrls: selectPictureCarouselMediaUrls(entry.mediaUrls ?? [], galleryImageUrls),
  })
  const mediaItems = resolvePictureCarouselMediaItems(orderedMediaUrls, fallbackImageUrl)
  const blocks: ArticleContentBlock[] = []
  let blockIndex = 0

  mediaItems.forEach((item) => {
    if (item.kind === 'livePhoto' && item.videoUrl) {
      blocks.push({
        id: `video-${blockIndex}`,
        type: 'video',
        text: '',
        imageUrl: item.imageUrl || fallbackImageUrl,
        videoUrl: item.videoUrl,
      })
      blockIndex += 1
      return
    }

    if (item.imageUrl) {
      blocks.push({
        id: `image-${blockIndex}`,
        type: 'image',
        text: '',
        imageUrl: item.imageUrl,
        videoUrl: '',
      })
      blockIndex += 1
    }
  })

  const mediaStrippedContent = decodeBasicHtml(entry.content || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:img|video|source)\b[^>]*>/gi, '\n\n')
  const pictureTextSource = [entry.summary, mediaStrippedContent]
    .filter((value: string) => !!(value || '').trim())
    .join('\n\n')

  blockIndex = pushParagraphBlocks(pictureTextSource, blocks, blockIndex)
  return blocks
}
