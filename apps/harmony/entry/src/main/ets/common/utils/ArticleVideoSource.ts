import { isDirectVideoUrl } from './FeedMediaUrl.ts'

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

export function selectArticleVideoUrls(
  feedMediaUrls: string[],
  extractedVideoUrls: string[],
): string[] {
  const normalizedFeedMediaUrls = dedupeUrls(feedMediaUrls).filter(
    (url: string) => isDirectVideoUrl(url),
  )
  if (normalizedFeedMediaUrls.length > 0) {
    return normalizedFeedMediaUrls
  }

  return dedupeUrls(extractedVideoUrls)
}
