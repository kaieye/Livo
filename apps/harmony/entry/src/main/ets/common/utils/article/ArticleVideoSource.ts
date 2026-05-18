import { isDirectVideoUrl } from '../FeedMediaUrl.ts'

function dedupeUrls(urls: string[]): string[] {
  const result: string[] = []
  urls.forEach((url: string) => {
    const trimmed = (url || '').trim()
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed)
    }
  })
  return result
}

function isSupportedVideoPageUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/|b23\.tv\/)/i.test(
    url,
  )
}

export function selectArticleVideoUrls(
  articleUrl: string,
  feedMediaUrls: string[],
  extractedVideoUrls: string[],
): string[] {
  const dedupedFeedMediaUrls = dedupeUrls(feedMediaUrls)
  const normalizedFeedMediaUrls = dedupedFeedMediaUrls.filter(
    (url: string) => isDirectVideoUrl(url) || isSupportedVideoPageUrl(url),
  )
  if (normalizedFeedMediaUrls.length > 0) {
    return normalizedFeedMediaUrls
  }

  const normalizedArticleUrl = (articleUrl || '').trim()
  if (
    normalizedArticleUrl &&
    (isDirectVideoUrl(normalizedArticleUrl) ||
      isSupportedVideoPageUrl(normalizedArticleUrl))
  ) {
    return dedupeUrls([normalizedArticleUrl, ...extractedVideoUrls])
  }

  return dedupeUrls(extractedVideoUrls)
}
