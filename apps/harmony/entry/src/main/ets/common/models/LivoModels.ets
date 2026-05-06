import { resolveEntryCardImageUrl } from '../utils/EntryCardPreview'
import { resolvePictureCarouselMediaItems } from '../utils/PictureGallery'
import { resolveSocialFeedDisplayTitle } from '../utils/SocialFeedPresentation'
import {
  buildArticleContentBlocks,
  buildMediaContentBlocks,
  buildPictureDetailContentBlocks,
  extractSupportedVideoUrls,
  isSupportedVideoUrl,
  resolveEntryMediaContext,
} from './ArticleContentBuilder'
import { feedSiteUrl, formatPublishedAt, viewDefinitionOf } from './FeedViewUtils'
import { selectPictureMediaUrls } from './MediaUrlUtils'
import {
  ArticleContentBlock,
  ArticleDetailModel,
  Entry,
  EntryCardModel,
  Feed,
  FeedCardModel,
  FeedViewType,
  FeedWithCount,
} from './LivoTypes'

export * from './LivoTypes'
export * from './LivoDefaults'
export * from './FeedViewUtils'
export * from './MediaUrlUtils'
export { isLegacyPlainArticleContent, extractSupportedVideoUrls } from './ArticleContentBuilder'

export function toFeedCardModel(feed: FeedWithCount): FeedCardModel {
  const definition = viewDefinitionOf(feed.view)
  const displayFeedTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  return {
    id: feed.id,
    title: displayFeedTitle,
    description: feed.description ?? '等待补充订阅描述',
    category: feed.category ?? '未分类',
    url: feed.url,
    siteUrl: feedSiteUrl(feed),
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
  const displayFeedTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  const t0 = Date.now()
  const mediaCtx = resolveEntryMediaContext(entry, feed)
  const mediaCtxMs = Date.now() - t0
  // 快速路径：先检查 mediaUrls 和 articleUrl，无需 join 5 字段
  let hasVideoMedia = false
  const mediaUrls = entry.mediaUrls ?? []
  for (let vi = 0; vi < mediaUrls.length; vi += 1) {
    if (isSupportedVideoUrl(mediaUrls[vi])) {
      hasVideoMedia = true
      break
    }
  }
  if (!hasVideoMedia && entry.url && isSupportedVideoUrl(entry.url)) {
    hasVideoMedia = true
  }
  if (!hasVideoMedia) {
    const joined = [entry.summary, entry.content, entry.title, entry.url, ...mediaUrls].join('\n')
    hasVideoMedia = extractSupportedVideoUrls(
      joined,
      entry.url || feedSiteUrl(feed),
      entry.url,
    ).length > 0
  }
  const videoUrlsMs = Date.now() - t0 - mediaCtxMs

  const tImg = Date.now()
  const imageUrl = resolveEntryCardImageUrl({
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feedSiteUrl(feed),
    mediaUrls: entry.mediaUrls ?? [],
  })
  const imageUrlMs = Date.now() - tImg

  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    imageUrl,
    feedImageUrl: feed.imageUrl ?? '',
    author: entry.author,
    articleUrl: entry.url,
    publishedAt: entry.publishedAt,
    publishedLabel: formatPublishedAt(entry.publishedAt),
    readingLabel: `${entry.readingTimeMinutes} 分钟`,
    tags: entry.tags,
    mediaUrls: selectPictureMediaUrls(mediaCtx.pictureUrls),
    rawMediaUrls: mediaCtx.rawUrls,
    feedTitle: displayFeedTitle,
    feedCategory: feed.category ?? '未分类',
    viewLabel: definition.label,
    viewBadgeColor: definition.badgeColor,
    hasVideoMedia,
    isRead: entry.isRead,
    isStarred: entry.isStarred,
  }
}

export interface ToEntryCardModelTiming {
  mediaCtxMs: number
  videoUrlsMs: number
  imageUrlMs: number
}

export interface ToEntryCardModelWithTimingResult {
  card: EntryCardModel
  timing: ToEntryCardModelTiming
}

export function toEntryCardModelWithTiming(entry: Entry, feed: Feed): ToEntryCardModelWithTimingResult {
  const definition = viewDefinitionOf(feed.view)
  const displayFeedTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  const t0 = Date.now()
  const mediaCtx = resolveEntryMediaContext(entry, feed)
  const mediaCtxMs = Date.now() - t0
  const hasVideoMedia = extractSupportedVideoUrls(
    [entry.title, entry.summary, entry.content, entry.url, ...(entry.mediaUrls ?? [])].join('\n'),
    entry.url || feedSiteUrl(feed),
    entry.url,
  ).length > 0
  const videoUrlsMs = Date.now() - t0 - mediaCtxMs

  const tImg = Date.now()
  const imageUrl = resolveEntryCardImageUrl({
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl: feedSiteUrl(feed),
    mediaUrls: entry.mediaUrls ?? [],
  })
  const imageUrlMs = Date.now() - tImg

  return {
    card: {
      id: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      imageUrl,
      feedImageUrl: feed.imageUrl ?? '',
      author: entry.author,
      articleUrl: entry.url,
      publishedAt: entry.publishedAt,
      publishedLabel: formatPublishedAt(entry.publishedAt),
      readingLabel: `${entry.readingTimeMinutes} 分钟`,
      tags: entry.tags,
      mediaUrls: selectPictureMediaUrls(mediaCtx.pictureUrls),
      rawMediaUrls: mediaCtx.rawUrls,
      feedTitle: displayFeedTitle,
      feedCategory: feed.category ?? '未分类',
      viewLabel: definition.label,
      viewBadgeColor: definition.badgeColor,
      hasVideoMedia,
      isRead: entry.isRead,
      isStarred: entry.isStarred,
    },
    timing: {
      mediaCtxMs,
      videoUrlsMs,
      imageUrlMs,
    },
  }
}

export function articleDetailModelFromCard(card: EntryCardModel): ArticleDetailModel {
  const rawUrls = card.rawMediaUrls ?? []
  const mediaItems = resolvePictureCarouselMediaItems(rawUrls, card.imageUrl)
  const blocks = buildMediaContentBlocks(mediaItems, card.imageUrl)

  return {
    id: card.id,
    feedId: card.feedId,
    title: card.title,
    summary: card.summary,
    content: card.content,
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
    : buildArticleContentBlocks(entry.content, entry.url || feedSiteUrl(feed), entry.url, entry.mediaUrls ?? [])
  const paragraphs = blocks
    .filter((block: ArticleContentBlock) => block.type === 'paragraph')
    .map((block: ArticleContentBlock) => block.text)

  return {
    id: card.id,
    feedId: card.feedId,
    title: card.title,
    summary: card.summary,
    content: card.content,
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
    contentParagraphs: paragraphs,
    contentBlocks: blocks,
    siteUrl: feedSiteUrl(feed),
  }
}
