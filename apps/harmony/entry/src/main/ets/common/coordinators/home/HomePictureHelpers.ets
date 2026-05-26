import { EntryCardModel, Entry, selectPictureCarouselMediaUrls } from '../../models/LivoModels'

// Per-entry-id memo: LazyForEach 复用 + @Reusable 复用每条目可能多次回调 captioned/gallery,
// 都是纯函数,缓存 id→结果可避免重复字符串/数组操作。
const _captionCache = new Map<string, string>()
const _galleryUrlsCache = new Map<string, string[]>()

export function pictureGalleryUrls(entry: EntryCardModel): string[] {
  const key = entry.id || ''
  if (!key) return entry.mediaUrls ?? []
  const cached = _galleryUrlsCache.get(key)
  if (cached) return cached
  const result = entry.mediaUrls ?? []
  _galleryUrlsCache.set(key, result)
  return result
}

export function pictureCaption(entry: EntryCardModel): string {
  const key = entry.id || ''
  if (!key) {
    const title = (entry.title || '').trim()
    return title && title !== '远程条目' ? title : (entry.summary || '').trim()
  }
  const cached = _captionCache.get(key)
  if (cached !== undefined) return cached
  const title = (entry.title || '').trim()
  const result = title && title !== '远程条目' ? title : (entry.summary || '').trim()
  _captionCache.set(key, result)
  return result
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
