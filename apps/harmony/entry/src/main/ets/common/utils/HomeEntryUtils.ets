import { EntryCardModel } from '../models/LivoModels'
import { SubscriptionMode } from '../components/HomeRootConfig'

export function resolveEntryMode(entry: EntryCardModel): SubscriptionMode {
  if (entry.viewLabel === '图片' && entry.hasVideoMedia && (!entry.mediaUrls || entry.mediaUrls.length === 0)) {
    return 'videos'
  }
  switch (entry.viewLabel) {
    case '社交':
      return 'social'
    case '图片':
      return 'pictures'
    case '视频':
      return 'videos'
    default:
      return 'articles'
  }
}

export function filterEntriesByMode(mode: SubscriptionMode, entries: EntryCardModel[]): EntryCardModel[] {
  return entries.filter((entry: EntryCardModel) => resolveEntryMode(entry) === mode)
}

export function homeEntryRenderBaseKey(entry: EntryCardModel): string {
  const id = (entry.id || '').trim()
  const feedId = (entry.feedId || '').trim()
  const articleUrl = (entry.articleUrl || '').trim()
  const title = (entry.title || '').trim()
  const publishedAt = entry.publishedAt > 0 ? String(entry.publishedAt) : '0'
  return `${id}|${feedId}|${articleUrl}|${title}|${publishedAt}`
}

export function homeEntryListRenderKey(entry: EntryCardModel, index: number): string {
  const readFlag = entry.isRead ? '1' : '0'
  return `${homeEntryRenderBaseKey(entry)}|${readFlag}|${index}`
}

// 视频网格的 LazyForEach 行级 key 生成器：视频行只有 1-2 张卡片，
// 用 id+isRead 作为稳定标识就足够唯一；不再像 homeEntryListRenderKey
// 那样把 baseKey 的 5 个字段全部拼起来。
// 滚动期间 LazyForEach 频繁调 keyGenerator，简化后单帧节省数百次
// 字符串拼接与数组分配，是视频网格滚动顺滑度的关键路径。
export function homeVideoRowRenderKey(rowEntries: EntryCardModel[], rowIndex: number): string {
  const first = rowEntries.length > 0 ? rowEntries[0] : undefined
  const second = rowEntries.length > 1 ? rowEntries[1] : undefined
  const firstKey = first ? `${first.id}|${first.isRead ? '1' : '0'}` : ''
  const secondKey = second ? `${second.id}|${second.isRead ? '1' : '0'}` : 'half'
  return `vrow-${rowIndex}-${firstKey}-${secondKey}`
}

export function duplicateKeyCount(counter: Map<string, number>): number {
  let duplicateCount = 0
  counter.forEach((count: number) => {
    if (count > 1) {
      duplicateCount += count - 1
    }
  })
  return duplicateCount
}

export function cloneHomeSnapshotEntry(entry: EntryCardModel): EntryCardModel {
  return {
    id: entry.id,
    feedId: entry.feedId,
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    imageUrl: entry.imageUrl,
    feedImageUrl: entry.feedImageUrl,
    author: entry.author,
    articleUrl: entry.articleUrl,
    publishedAt: entry.publishedAt,
    publishedLabel: entry.publishedLabel,
    readingLabel: entry.readingLabel,
    tags: [...entry.tags],
    mediaUrls: entry.mediaUrls ? [...entry.mediaUrls] : undefined,
    rawMediaUrls: entry.rawMediaUrls ? [...entry.rawMediaUrls] : undefined,
    feedTitle: entry.feedTitle,
    feedCategory: entry.feedCategory,
    viewLabel: entry.viewLabel,
    viewBadgeColor: entry.viewBadgeColor,
    hasVideoMedia: entry.hasVideoMedia,
    isRead: entry.isRead,
    isStarred: entry.isStarred,
  }
}

export function describeError(error: Error | string | Object): string {
  if (error instanceof Error) {
    const stack = error.stack ? ` stack=${error.stack}` : ''
    return `${error.name}: ${error.message}${stack}`
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch (_) {
    return String(error)
  }
}

export function isXSocialEntry(entry: EntryCardModel): boolean {
  const articleUrl = (entry.articleUrl || '').toLowerCase()
  const feedTitle = (entry.feedTitle || '').toLowerCase()
  return articleUrl.includes('x.com/')
    || articleUrl.includes('twitter.com/')
    || feedTitle.includes('x / twitter')
}

export function isTweetLikeEntry(entry: EntryCardModel): boolean {
  if (isXSocialEntry(entry)) {
    return true
  }

  const articleUrl = (entry.articleUrl || '').toLowerCase()
  const feedTitle = (entry.feedTitle || '').toLowerCase()
  const author = (entry.author || '').toLowerCase()
  const title = (entry.title || '').toLowerCase()
  const summary = (entry.summary || '').toLowerCase()
  const content = (entry.content || '').toLowerCase()
  const combinedText = `${title}\n${summary}\n${content}`
  return articleUrl.includes('/status/')
    || articleUrl.includes('x.com/')
    || articleUrl.includes('twitter.com/')
    || articleUrl.includes('nitter.')
    || articleUrl.includes('/x/user/')
    || feedTitle.includes('twitter')
    || feedTitle.includes('x.com')
    || feedTitle.includes('nitter')
    || feedTitle.includes(' on x')
    || author.startsWith('@')
    || /(^|\s)rt\s+@[a-z0-9_]{1,15}\s*:/i.test(combinedText)
    || combinedText.includes('/twitter/user/')
    || combinedText.includes('/x/user/')
}
