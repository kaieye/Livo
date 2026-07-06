import { isAllowedStoredMediaUrl } from '../../../shared/media-url-policy'

export function getSafeImageSrc(
  rawSrc: string | null | undefined,
): string | undefined {
  const src = (rawSrc || '').trim()
  if (!src) return undefined
  return isAllowedStoredMediaUrl(src) ? src : undefined
}
