import { resolveEntryCardImageUrl } from '../utils/EntryCardPreview'
import {
  extractEntryGalleryImageUrls,
  extractPictureCarouselMediaUrls,
  resolvePictureCarouselMediaItems,
} from '../utils/PictureGallery'
import { buildArticleContentBlocks, buildPictureDetailContentBlocks, extractSupportedVideoUrls } from './ArticleContentBuilder'
import { formatPublishedAt, viewDefinitionOf } from './FeedViewUtils'
import { selectPictureCarouselMediaUrls, selectPictureMediaUrls } from './MediaUrlUtils'
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
export * from './FeedViewUtils'
export * from './MediaUrlUtils'
export { isLegacyPlainArticleContent, extractSupportedVideoUrls } from './ArticleContentBuilder'

export function toFeedCardModel(feed: FeedWithCount): FeedCardModel {
  const definition = viewDefinitionOf(feed.view)
  return {
    id: feed.id,
    title: feed.title,
    description: feed.description ?? '等待补充订阅描述',
    category: feed.category ?? '未分类',
    url: feed.url,
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
    content: entry.content,
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
      return { id: `video-${index}`, type: 'video', text: '', imageUrl: item.imageUrl || card.imageUrl, videoUrl: item.videoUrl }
    }
    return { id: `image-${index}`, type: 'image', text: '', imageUrl: item.imageUrl, videoUrl: '' }
  })

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
    : buildArticleContentBlocks(entry.content, entry.url || feed.siteUrl || feed.url, entry.url, entry.mediaUrls ?? [])
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
    siteUrl: feed.siteUrl ?? feed.url,
  }
}
