import { isDirectVideoUrl } from '../utils/FeedMediaUrl'

export function selectPictureMediaUrls(mediaUrls: string[]): string[] {
  const result: string[] = []
  mediaUrls.forEach((url: string) => {
    const trimmed = (url || '').trim()
    if (!trimmed) {
      return
    }
    const normalized = trimmed.toLowerCase()
    const hasImageFormatQuery = /[?&]format=(jpg|jpeg|png|webp|gif|bmp|avif)(?:[&#]|$)/i.test(normalized)
    const isImageUrl = /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(normalized)
      || hasImageFormatQuery
      || normalized.includes('cdninstagram')
      || normalized.includes('scontent.')
      || normalized.includes('fbcdn.net')
      || normalized.includes('googleusercontent.com/')
      || normalized.includes('ytimg.com/')
      || normalized.includes('pbs.twimg.com/media/')
      || normalized.includes('twimg.com/media/')
    if (!isImageUrl || result.includes(trimmed)) {
      return
    }
    result.push(trimmed)
  })
  return result
}

export function selectPictureCarouselMediaUrls(
  mediaUrls: string[],
  fallbackImageUrls: string[] = [],
): string[] {
  const result: string[] = []
  ;[...mediaUrls, ...fallbackImageUrls].forEach((url: string) => {
    const trimmed = (url || '').trim()
    if (!trimmed || result.includes(trimmed)) {
      return
    }
    if (isDirectVideoUrl(trimmed) || selectPictureMediaUrls([trimmed]).length > 0) {
      result.push(trimmed)
    }
  })
  return result
}
