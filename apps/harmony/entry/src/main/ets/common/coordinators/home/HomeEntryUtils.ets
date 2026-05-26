import { EntryCardModel } from '../../models/LivoModels'
import { SubscriptionMode } from '../../config/HomeRootConfig'
import { modeOfFeedView, uniqueEntryCardKey } from '../../data/AppRepositoryEntryHelpers'

/**
 * Merge `next` entries into `previous`, deduplicating by composite key
 * (`${id}|${feedId}|${articleUrl}`), and optionally slice to `limit`.
 *
 * Extracted from HomeFeedPagination.appendFeaturedEntriesFromLocalFast()
 * and HomeFeedLoadMorePrefetch.run() — both contained near-identical
 * Set<string>-based dedup logic with drift.
 */
export function mergeUniqueEntries(
  previous: EntryCardModel[],
  next: EntryCardModel[],
  limit?: number,
): EntryCardModel[] {
  const seen = new Set<string>()
  const merged: EntryCardModel[] = []
  previous.forEach((entry: EntryCardModel) => {
    const key = uniqueEntryCardKey(entry)
    seen.add(key)
    merged.push(entry)
  })
  next.forEach((entry: EntryCardModel) => {
    const key = uniqueEntryCardKey(entry)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    merged.push(entry)
  })
  if (limit !== undefined && merged.length > limit) {
    return merged.slice(0, limit)
  }
  return merged
}

export function filterEntriesByMode(mode: SubscriptionMode, entries: EntryCardModel[]): EntryCardModel[] {
  return entries.filter((entry: EntryCardModel) => modeOfFeedView(entry.view) === mode)
}

export function homeEntryRenderBaseKey(entry: EntryCardModel): string {
  const id = (entry.id || '').trim()
  const feedId = (entry.feedId || '').trim()
  const articleUrl = (entry.articleUrl || '').trim()
  const title = (entry.title || '').trim()
  const publishedAt = entry.publishedAt > 0 ? String(entry.publishedAt) : '0'
  return `${id}|${feedId}|${articleUrl}|${title}|${publishedAt}`
}

// 文章/社交/图片列表的 LazyForEach 行级 key 生成器:滚动期间 ArkUI 会频繁调用
// 该函数,过去把 baseKey 的 5 个字段全部拼起来导致单帧产生数百次字符串拼接,
// 而且把 index 拼进 key,任何插入都会让全表认为 key 失效失去复用。现在只用
// 稳定标识 + 已读状态,key 与 entry 的内容/位置解耦。
export function homeEntryListRenderKey(entry: EntryCardModel, index: number): string {
  const readFlag = entry.isRead ? '1' : '0'
  const id = entry.id
  if (id) {
    return `${id}|${readFlag}`
  }
  // entry.id 缺失时退化到 feedId+articleUrl 兜底,极端兜底再带 index 防同 key。
  return `${entry.feedId}|${entry.articleUrl}|${readFlag}|${index}`
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
    view: entry.view,
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

// 推文判定缓存:LazyForEach itemBuilder 中 HomeModeEntriesPage.shouldRenderTweetCard
// 和 HomeArticleEntryCard.computePreviewImage 都会高频调用 isTweetLikeEntry / isXSocialEntry。
// 原实现对 entry.content(常达数 KB)做 6 次 toLowerCase + 字符串拼接 + 14 次 includes + 正则,
// 滑入新卡时单次开销与 content 长度成正比。按 entry id 缓存后,首页四个栏目滚动期间
// 命中率接近 100%,LazyForEach 滑动开销显著降低。
// 缓存基于 entry 不可变标识(id + articleUrl + feedTitle),内容字段后续若被 hydrate
// 不会让旧分类失效——但 entry id 相同时这些 boolean 也不会翻转,所以无需失效。
const _xSocialEntryCache: Map<string, boolean> = new Map<string, boolean>()
const _tweetLikeEntryCache: Map<string, boolean> = new Map<string, boolean>()

function tweetClassificationCacheKey(entry: EntryCardModel): string {
  const id = (entry.id || '').trim()
  if (id) {
    return id
  }
  return `${entry.feedId}|${entry.articleUrl}`
}

export function isXSocialEntry(entry: EntryCardModel): boolean {
  const key = tweetClassificationCacheKey(entry)
  const cached = _xSocialEntryCache.get(key)
  if (cached !== undefined) {
    return cached
  }
  const articleUrl = (entry.articleUrl || '').toLowerCase()
  const feedTitle = (entry.feedTitle || '').toLowerCase()
  const result = articleUrl.includes('x.com/')
    || articleUrl.includes('twitter.com/')
    || feedTitle.includes('x / twitter')
  _xSocialEntryCache.set(key, result)
  return result
}

export function isTweetLikeEntry(entry: EntryCardModel): boolean {
  const key = tweetClassificationCacheKey(entry)
  const cached = _tweetLikeEntryCache.get(key)
  if (cached !== undefined) {
    return cached
  }
  let result: boolean = false
  if (isXSocialEntry(entry)) {
    result = true
  } else {
    const articleUrl = (entry.articleUrl || '').toLowerCase()
    const feedTitle = (entry.feedTitle || '').toLowerCase()
    const author = (entry.author || '').toLowerCase()
    const title = (entry.title || '').toLowerCase()
    const summary = (entry.summary || '').toLowerCase()
    const content = (entry.content || '').toLowerCase()
    const combinedText = `${title}\n${summary}\n${content}`
    result = articleUrl.includes('/status/')
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
  _tweetLikeEntryCache.set(key, result)
  return result
}
