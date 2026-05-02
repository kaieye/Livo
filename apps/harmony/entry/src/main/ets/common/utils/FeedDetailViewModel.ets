import { Entry, Feed, FeedViewType } from '../models/LivoModels'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { extractEntryGalleryImageUrls } from './PictureGallery'
import { resolveEntryCardImageUrl } from './EntryCardPreview'
import { feedDetailHostOf } from './FeedDetailPreviewPolicy'

export interface FeedDetailDisplaySnapshot {
  previewPayload: FeedRefreshPayload | undefined
  existingFeed: Feed | undefined
  targetTitle: string
  targetSiteUrl: string
  targetUrl: string
  targetDescription: string
  targetCategory: string
  targetView: FeedViewType
  feedId: string
}

export function resolveFeedDetailDisplayTitle(
  snapshot: FeedDetailDisplaySnapshot,
): string {
  const previewTitle = (snapshot.previewPayload?.feedTitle || '').trim()
  if (previewTitle) {
    return previewTitle
  }
  const targetTitle = (snapshot.targetTitle || '').trim()
  if (targetTitle) {
    return targetTitle
  }
  const existingTitle = (snapshot.existingFeed?.title || '').trim()
  if (existingTitle) {
    return existingTitle
  }
  const siteOrTarget = (
    snapshot.previewPayload?.siteUrl ||
    snapshot.targetSiteUrl ||
    snapshot.targetUrl ||
    snapshot.existingFeed?.siteUrl ||
    snapshot.existingFeed?.url ||
    ''
  ).trim()
  return feedDetailHostOf(siteOrTarget) || siteOrTarget || '订阅详情'
}

export function resolveFeedDetailHeroDescription(
  snapshot: FeedDetailDisplaySnapshot,
): string {
  return (
    snapshot.previewPayload?.description ||
    snapshot.targetDescription ||
    snapshot.previewPayload?.siteUrl ||
    snapshot.targetSiteUrl
  )
}

export function isFeedDetailPicturesPreview(
  snapshot: FeedDetailDisplaySnapshot,
): boolean {
  const currentView = snapshot.existingFeed?.view ?? snapshot.targetView
  return currentView === FeedViewType.Pictures
}

function isXUrl(value: string): boolean {
  const normalized = (value || '').toLowerCase()
  return (
    normalized.includes('x.com/') ||
    normalized.includes('twitter.com/') ||
    normalized.includes('/x/user/') ||
    normalized.includes('/twitter/user/')
  )
}

export function isFeedDetailXPreview(
  snapshot: FeedDetailDisplaySnapshot,
): boolean {
  return (
    isXUrl(snapshot.existingFeed?.url || '') ||
    isXUrl(snapshot.existingFeed?.siteUrl || '') ||
    isXUrl(snapshot.targetUrl) ||
    isXUrl(snapshot.targetSiteUrl) ||
    isXUrl(snapshot.previewPayload?.siteUrl || '')
  )
}

export function resolveFeedDetailGalleryCaption(entry: Entry): string {
  const title = (entry.title || '').trim()
  if (title && title !== '远程条目') {
    return title
  }
  return (entry.summary || '').trim()
}

export function resolveFeedDetailPicturePreviewLeadUrl(
  entry: Entry,
  snapshot: FeedDetailDisplaySnapshot,
): string {
  const siteUrl =
    snapshot.previewPayload?.siteUrl || snapshot.targetSiteUrl || snapshot.targetUrl
  const galleryUrls = extractEntryGalleryImageUrls({
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl,
    mediaUrls: entry.mediaUrls ?? [],
  })
  if (galleryUrls.length > 0) {
    return galleryUrls[0]
  }
  return resolveEntryCardImageUrl({
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    articleUrl: entry.url,
    siteUrl,
    mediaUrls: entry.mediaUrls ?? [],
  })
}

export function resolveFeedDetailArticleFeed(
  entry: Entry,
  snapshot: FeedDetailDisplaySnapshot,
): Feed {
  if (snapshot.existingFeed) {
    return snapshot.existingFeed
  }
  return {
    id: entry.feedId || snapshot.feedId || 'preview',
    title: resolveFeedDetailDisplayTitle(snapshot),
    url: snapshot.targetUrl || entry.url,
    siteUrl: snapshot.previewPayload?.siteUrl || snapshot.targetSiteUrl || entry.url,
    imageUrl: snapshot.previewPayload?.imageUrl || '',
    description: snapshot.previewPayload?.description || snapshot.targetDescription || '',
    category: snapshot.targetCategory || '未分类',
    view: snapshot.targetView,
    showInAll: true,
    errorCount: 0,
    createdAt: 0,
    updatedAt: 0,
  }
}
