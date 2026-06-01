import { useCallback, useEffect, useState, type SyntheticEvent } from 'react'

export function useOverlayMediaGallery({
  entryId,
  getPhotoDedupeKey,
  normalizeImageCacheKey,
  decodeUrlEntities,
  decodeMediaUrl,
  advanceOverlayPhotoFallback,
}: {
  entryId: string
  getPhotoDedupeKey: (url: string, previewUrl: string) => string
  normalizeImageCacheKey: (url: string) => string
  decodeUrlEntities: (value: string) => string
  decodeMediaUrl: (value: string) => string
  advanceOverlayPhotoFallback: (
    e: SyntheticEvent<HTMLImageElement>,
    originalUrl: string,
    onFailed: (img: HTMLImageElement) => void,
    preferredPreviewUrl?: string,
  ) => void
}) {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [failedPhotoTokens, setFailedPhotoTokens] = useState<Set<string>>(
    new Set(),
  )

  const getPhotoToken = useCallback(
    (photo?: { url?: string; previewUrl?: string }): string => {
      if (!photo) return ''
      const key = getPhotoDedupeKey(photo.url || '', photo.previewUrl || '')
      if (key) return key
      return normalizeImageCacheKey(photo.url || photo.previewUrl || '')
    },
    [getPhotoDedupeKey, normalizeImageCacheKey],
  )

  const getPhotoInitialSrc = useCallback(
    (photo?: { url?: string; previewUrl?: string }): string => {
      if (!photo) return ''
      if (photo.previewUrl) {
        const raw = decodeUrlEntities(photo.previewUrl)
        if (raw && /^https?:\/\//i.test(raw)) return raw
      }
      return decodeMediaUrl(photo.url || '')
    },
    [decodeMediaUrl, decodeUrlEntities],
  )

  useEffect(() => {
    setFailedPhotoTokens(new Set())
    setPreviewIdx(null)
    setLightboxOpen(false)
  }, [entryId])

  const markPhotoFailed = useCallback(
    (photo?: { url?: string; previewUrl?: string }) => {
      const token = getPhotoToken(photo)
      if (!token) return
      setFailedPhotoTokens((prev) => {
        if (prev.has(token)) return prev
        const next = new Set(prev)
        next.add(token)
        return next
      })
    },
    [getPhotoToken],
  )

  const handlePhotoError = useCallback(
    (
      photo: { url?: string; previewUrl?: string } | undefined,
      e: SyntheticEvent<HTMLImageElement>,
    ) => {
      advanceOverlayPhotoFallback(
        e,
        photo?.url || photo?.previewUrl || '',
        (img) => {
          img.style.display = 'none'
          markPhotoFailed(photo)
        },
        photo?.previewUrl,
      )
    },
    [advanceOverlayPhotoFallback, markPhotoFailed],
  )

  return {
    previewIdx,
    setPreviewIdx,
    lightboxOpen,
    setLightboxOpen,
    failedPhotoTokens,
    getPhotoToken,
    getPhotoInitialSrc,
    handlePhotoError,
  }
}
