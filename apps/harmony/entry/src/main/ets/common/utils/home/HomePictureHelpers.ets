import { EntryCardModel, Entry, selectPictureCarouselMediaUrls } from '../../models/LivoModels'

export function pictureGalleryUrls(entry: EntryCardModel): string[] {
  return entry.mediaUrls ?? []
}

export function pictureCaption(entry: EntryCardModel): string {
  const title = (entry.title || '').trim()
  if (title && title !== '远程条目') {
    return title
  }
  return (entry.summary || '').trim()
}

export function pictureCardEntry(entry: EntryCardModel): Entry {
  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    url: entry.articleUrl,
    summary: entry.summary,
    content: '',
    author: entry.author,
    publishedAt: entry.publishedAt,
    readingTimeMinutes: 0,
    tags: entry.tags,
    mediaUrls: entry.rawMediaUrls ?? selectPictureCarouselMediaUrls(entry.mediaUrls ?? []),
    isRead: entry.isRead,
    isStarred: entry.isStarred,
    createdAt: entry.publishedAt,
    updatedAt: entry.publishedAt,
  }
}
