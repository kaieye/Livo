import {
  PictureCarouselMediaItem,
  resolvePictureCarouselMediaItems,
} from './PictureGallery.ts'

const VIDEO_FILE_EXTENSION_PATTERN: RegExp =
  /\.(mp4|m4v|mov|webm|m3u8|mpd|avi|mkv)(\?|#|$)/i

export function isVideoLikeUrl(url: string): boolean {
  const normalized = (url || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  if (VIDEO_FILE_EXTENSION_PATTERN.test(normalized)) {
    return true
  }

  return (
    normalized.includes('youtube.com/watch') ||
    normalized.includes('youtu.be/') ||
    normalized.includes('bilibili.com/video/') ||
    normalized.includes('x.com/i/status/') ||
    normalized.includes('twitter.com/i/status/')
  )
}

export function inlineMediaItemsCacheKey(urls: string[]): string {
  return (urls || [])
    .map((url: string) => url.trim())
    .filter((url: string) => !!url)
    .join('|')
}

export function inlineMediaItemsFromUrls(
  urls: string[],
  maxCount: number = 4,
): PictureCarouselMediaItem[] {
  const normalizedUrls = (urls || [])
    .map((url: string) => url.trim())
    .filter((url: string) => !!url)
  const fallbackImageUrl =
    normalizedUrls.find((url: string) => !isVideoLikeUrl(url)) || ''
  return resolvePictureCarouselMediaItems(
    normalizedUrls,
    fallbackImageUrl,
  ).slice(0, maxCount)
}

export interface InlineMediaTileSize {
  largeWidth: string
  largeHeight: number
  threeColumnLargeHeight: number
  compactWidth: string
  compactHeight: number
}

export const QUOTED_TILE_SIZE: InlineMediaTileSize = {
  largeWidth: '100%',
  largeHeight: 208,
  threeColumnLargeHeight: 144,
  compactWidth: '49.75%',
  compactHeight: 112,
}

export const MAIN_TILE_SIZE: InlineMediaTileSize = {
  largeWidth: '100%',
  largeHeight: 232,
  threeColumnLargeHeight: 156,
  compactWidth: '49.75%',
  compactHeight: 124,
}

export function inlineMediaTileWidth(
  size: InlineMediaTileSize,
  index: number,
  count: number,
): string {
  if (count <= 1) {
    return size.largeWidth
  }
  if (count === 3 && index === 0) {
    return '100%'
  }
  return size.compactWidth
}

export function inlineMediaTileHeight(
  size: InlineMediaTileSize,
  index: number,
  count: number,
): number {
  if (count <= 1) {
    return size.largeHeight
  }
  if (count === 3 && index === 0) {
    return size.threeColumnLargeHeight
  }
  return size.compactHeight
}

export function inlineMediaTileBottomMargin(
  index: number,
  count: number,
): number {
  if (count <= 2) {
    return 0
  }
  if (count === 3) {
    return index === 0 ? 2 : 0
  }
  return index < 2 ? 2 : 0
}
