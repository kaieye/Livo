import type { Entry, MediaItem } from '../../../shared/types'

type BilibiliId =
  | { kind: 'bvid'; value: string }
  | { kind: 'aid'; value: string }

function parseBilibiliVideoId(rawUrl: string): BilibiliId | null {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) return { kind: 'bvid', value: bvidMatch[1] }

  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) return { kind: 'aid', value: aidMatch[1] }

  return null
}

export function normalizeBilibiliVideoUrl(rawUrl: string): string {
  const parsed = parseBilibiliVideoId(rawUrl)
  if (!parsed) return rawUrl
  return parsed.kind === 'bvid'
    ? `https://www.bilibili.com/video/${parsed.value}`
    : `https://www.bilibili.com/video/av${parsed.value}`
}

export function buildBilibiliInAppPlayerUrl(
  rawUrl: string,
  options?: {
    muted?: boolean
    includeOutsideFlag?: boolean
    fallbackToPage?: boolean
  },
): string {
  const parsed = parseBilibiliVideoId(rawUrl)
  if (!parsed) {
    return options?.fallbackToPage ? normalizeBilibiliVideoUrl(rawUrl) : rawUrl
  }

  const params = new URLSearchParams({
    autoplay: 'true',
    danmaku: 'true',
    muted: options?.muted ? 'true' : 'false',
    highQuality: 'true',
  })
  if (options?.includeOutsideFlag) params.set('isOutside', 'true')
  params.set(parsed.kind, parsed.value)
  return `https://www.bilibili.com/blackboard/newplayer.html?${params.toString()}`
}

export function resolveBilibiliVideoPageUrl(
  entry: Pick<Entry, 'url' | 'media'>,
): string | null {
  const urls = [
    entry.url || '',
    ...((entry.media || []) as MediaItem[])
      .filter((media) => media.type === 'video')
      .map((media) => media.url),
  ]

  for (const url of urls) {
    if (!url) continue
    if (/(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)) {
      return normalizeBilibiliVideoUrl(url)
    }
  }

  return null
}
