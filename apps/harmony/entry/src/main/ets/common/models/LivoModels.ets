import { resolveEntryCardImageUrl } from '../utils/EntryCardPreview'
import { resolveSocialFeedDisplayImageUrl, resolveSocialFeedDisplayTitle } from '../utils/social/SocialFeedPresentation'
import {
  buildArticleContentBlocks,
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
    view: feed.view,
    viewLabel: definition.label,
    viewBadgeColor: definition.badgeColor,
    accentColor: definition.accentColor,
  }
}

export interface EntryCardTiming {
  mediaCtxMs: number
  videoUrlsMs: number
  imageUrlMs: number
}

export function toEntryCardModel(entry: Entry, feed: Feed, timing?: EntryCardTiming): EntryCardModel {
  const definition = viewDefinitionOf(feed.view)
  const displayFeedTitle = resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  const displayFeedImageUrl = resolveSocialFeedDisplayImageUrl(feed.imageUrl ?? '', feed.url, feed.siteUrl || '', displayFeedTitle)
  const t0 = Date.now()
  const mediaCtx = resolveEntryMediaContext(entry, feed)
  const mediaCtxMs = Date.now() - t0
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

  if (timing) {
    timing.mediaCtxMs = mediaCtxMs
    timing.videoUrlsMs = videoUrlsMs
    timing.imageUrlMs = imageUrlMs
  }

  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    imageUrl,
    feedImageUrl: displayFeedImageUrl,
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
    view: feed.view,
    viewLabel: definition.label,
    viewBadgeColor: definition.badgeColor,
    hasVideoMedia,
    isRead: entry.isRead,
    isStarred: entry.isStarred,
  }
}

export function articleDetailModelFromCard(card: EntryCardModel): ArticleDetailModel {
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
    view: card.view,
    viewLabel: card.viewLabel,
    viewBadgeColor: card.viewBadgeColor,
    hasVideoMedia: card.hasVideoMedia,
    isRead: card.isRead,
    isStarred: card.isStarred,
    contentParagraphs: [],
    contentBlocks: [],
    siteUrl: card.articleUrl,
  }
}

export function toArticleDetailModel(entry: Entry, feed: Feed): ArticleDetailModel {
  const card = toEntryCardModel(entry, feed)
  const blocks = feed.view === FeedViewType.Pictures
    ? buildPictureDetailContentBlocks(entry, feed, card.imageUrl)
    : buildArticleContentBlocks(entry.content, entry.url || feedSiteUrl(feed), entry.url, entry.mediaUrls ?? [], entry.title)
  const paragraphs = blocks
    .filter((block: ArticleContentBlock) => block.type === 'paragraph')
    .map((block: ArticleContentBlock) => block.text)

  const model = articleDetailModelFromCard(card)
  model.contentParagraphs = paragraphs
  model.contentBlocks = blocks
  model.siteUrl = feedSiteUrl(feed)
  return model
}
