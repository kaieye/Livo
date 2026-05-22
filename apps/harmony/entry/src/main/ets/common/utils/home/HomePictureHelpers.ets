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

const _pictureEntryCache = new Map<string, Entry>()

function pictureEntryCacheKey(entry: EntryCardModel): string {
  return `${entry.id}|${entry.feedId}|${entry.articleUrl}`
}

export function pictureCardEntry(entry: EntryCardModel): Entry {
  // 同一个 EntryCardModel 在 LazyForEach 复用期间会多次调用
  // pictureCardEntry。缓存避免每次渲染都分配新 Entry 并重复
  // 调用 selectPictureCarouselMediaUrls。
  const key = pictureEntryCacheKey(entry)
  const cached = _pictureEntryCache.get(key)
  if (cached) {
    return cached
  }
  const result: Entry = {
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
  _pictureEntryCache.set(key, result)
  return result
}
