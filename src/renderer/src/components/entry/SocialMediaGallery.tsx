import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react'
import { blurhashToAverageColor } from '../../lib/blurhash'
import {
  decodeHtmlEntitiesUrl,
  decodeMediaUrl,
} from '../../lib/entry-media-url'
import {
  advanceCardImageFallback,
  dedupeGalleryPhotoVariants,
  getRememberedMediaSrc,
  isInstagramLikeGalleryPhoto,
  normalizeImageCacheKey,
  rememberMediaSrc,
} from '../../lib/entry-media-decision'
import { getPhotoDedupeKey } from '../../lib/social-entry-utils'
import { getSafeImageSrc } from '../../lib/safe-image-source'

interface SocialMediaGalleryPhoto {
  url: string
  previewUrl?: string
  width?: number
  height?: number
  blurhash?: string
}

interface SocialMediaGalleryProps {
  photos: SocialMediaGalleryPhoto[]
  cacheScope: string
  onAllFailed?: () => void
  hasMirrorDerivedContent?: boolean
}

/** 社交条目媒体画廊：负责去重、失败回退、镜像图片抑制和响应式排版。 */
export function SocialMediaGallery({
  photos,
  cacheScope,
  onAllFailed,
  hasMirrorDerivedContent,
}: SocialMediaGalleryProps) {
  const allFailedNotifiedRef = useRef(false)
  const [failedPhotoTokens, setFailedPhotoTokens] = useState<Set<string>>(
    new Set(),
  )
  const [loadedPhotoTokens, setLoadedPhotoTokens] = useState<Set<string>>(
    new Set(),
  )
  const [suppressedPhotoTokens, setSuppressedPhotoTokens] = useState<
    Set<string>
  >(new Set())
  useEffect(() => {
    allFailedNotifiedRef.current = false
    setFailedPhotoTokens(new Set())
    setLoadedPhotoTokens(new Set())
    setSuppressedPhotoTokens(new Set())
  }, [cacheScope, photos])

  const uniquePhotos = useMemo(() => {
    return dedupeGalleryPhotoVariants(photos)
  }, [photos])

  const getPhotoCacheToken = useCallback(
    (photo: { url: string; previewUrl?: string }) => {
      const key = getPhotoDedupeKey(photo.url || '', photo.previewUrl || '')
      if (key) return key
      return normalizeImageCacheKey(photo.url || photo.previewUrl || '')
    },
    [],
  )

  const markPhotoFailed = useCallback(
    (photo: { url: string; previewUrl?: string }) => {
      const token = getPhotoCacheToken(photo)
      if (!token) return
      setFailedPhotoTokens((prev) => {
        if (prev.has(token)) return prev
        const next = new Set(prev)
        next.add(token)
        return next
      })
    },
    [getPhotoCacheToken],
  )

  const getInitialSrc = useCallback(
    (photo: { url: string; previewUrl?: string }) => {
      // 优先使用 previewUrl，它通常是稳定镜像地址，直接 CDN 签名链接更容易过期。
      if (photo.previewUrl) {
        const raw = decodeHtmlEntitiesUrl(photo.previewUrl)
        const safeRaw = getSafeImageSrc(raw)
        if (safeRaw) {
          return getRememberedMediaSrc(safeRaw, safeRaw)
        }
      }
      const seedUrl = decodeMediaUrl(photo.url || '')
      const primaryUrl = decodeMediaUrl(photo.url || '')
      return getRememberedMediaSrc(seedUrl, primaryUrl || seedUrl)
    },
    [],
  )

  const visiblePhotos = useMemo(() => {
    if (suppressedPhotoTokens.size === 0) return uniquePhotos
    return uniquePhotos.filter((photo) => {
      const token = getPhotoCacheToken(photo)
      return !token || !suppressedPhotoTokens.has(token)
    })
  }, [getPhotoCacheToken, suppressedPhotoTokens, uniquePhotos])

  useEffect(() => {
    if (uniquePhotos.length < 2) return
    const lastPhoto = uniquePhotos[uniquePhotos.length - 1]
    const lastToken = getPhotoCacheToken(lastPhoto)
    if (
      !lastToken ||
      !failedPhotoTokens.has(lastToken) ||
      suppressedPhotoTokens.has(lastToken)
    )
      return
    if (!hasMirrorDerivedContent) return
    if (!isInstagramLikeGalleryPhoto(lastPhoto)) return

    let allPreviousLoaded = true
    for (let index = 0; index < uniquePhotos.length - 1; index += 1) {
      const token = getPhotoCacheToken(uniquePhotos[index])
      if (
        !token ||
        !loadedPhotoTokens.has(token) ||
        failedPhotoTokens.has(token)
      ) {
        allPreviousLoaded = false
        break
      }
    }

    if (!allPreviousLoaded) return
    setSuppressedPhotoTokens((prev) => {
      if (prev.has(lastToken)) return prev
      const next = new Set(prev)
      next.add(lastToken)
      return next
    })
  }, [
    failedPhotoTokens,
    getPhotoCacheToken,
    hasMirrorDerivedContent,
    loadedPhotoTokens,
    suppressedPhotoTokens,
    uniquePhotos,
  ])

  useEffect(() => {
    if (visiblePhotos.length === 0) return
    let visibleFailedCount = 0
    for (const photo of visiblePhotos) {
      const token = getPhotoCacheToken(photo)
      if (token && failedPhotoTokens.has(token)) visibleFailedCount += 1
    }
    if (visibleFailedCount !== visiblePhotos.length) return
    if (allFailedNotifiedRef.current) return
    allFailedNotifiedRef.current = true
    onAllFailed?.()
  }, [failedPhotoTokens, getPhotoCacheToken, onAllFailed, visiblePhotos])

  const rememberLoadedSrc = useCallback(
    (
      photo: { url: string; previewUrl?: string },
      _index: number,
      _img: HTMLImageElement,
    ) => {
      const token = getPhotoCacheToken(photo)
      if (!token) return
      rememberMediaSrc(
        decodeMediaUrl(photo.url || photo.previewUrl || ''),
        decodeMediaUrl(
          _img.currentSrc || _img.src || photo.url || photo.previewUrl || '',
        ),
      )
      setLoadedPhotoTokens((prev) => {
        if (prev.has(token)) return prev
        const next = new Set(prev)
        next.add(token)
        return next
      })
    },
    [getPhotoCacheToken],
  )

  const handlePhotoError = useCallback(
    (
      photo: { url: string; previewUrl?: string },
      index: number,
      e: SyntheticEvent<HTMLImageElement>,
    ) => {
      advanceCardImageFallback(
        e,
        photo.url || photo.previewUrl || '',
        (img) => {
          img.style.display = 'none'
          markPhotoFailed(photo)
        },
        photo.previewUrl,
      )
    },
    [markPhotoFailed],
  )

  const allSameRatio = useMemo(() => {
    if (visiblePhotos.length <= 1) return true
    let ratio = 0
    for (const p of visiblePhotos) {
      if (p.width && p.height) {
        const r = p.height / p.width
        if (ratio === 0) ratio = r
        else if (ratio !== r) return false
      } else {
        return false
      }
    }
    return true
  }, [visiblePhotos])

  return (
    <>
      {allSameRatio && visiblePhotos.every((p) => p.width && p.height) ? (
        <div className="mt-4 flex gap-[8px] overflow-x-auto pb-2">
          {visiblePhotos.map((photo, i, list) => {
            const widthClass =
              list.length === 1
                ? 'w-full'
                : list.length === 2
                  ? 'w-[calc((100%-8px)/2)]'
                  : 'w-[calc((100%-16px)/3)]'
            const token = getPhotoCacheToken(photo)
            const isFailed = !!token && failedPhotoTokens.has(token)
            return (
              <div
                key={`${token || 'media'}:${i}`}
                className={`relative shrink-0 rounded ${widthClass}`}
                style={{
                  aspectRatio:
                    photo.width && photo.height
                      ? `${photo.width} / ${photo.height}`
                      : undefined,
                  height: 'auto',
                  maxHeight: list.length === 1 ? '66vh' : undefined,
                  backgroundColor: photo.blurhash
                    ? blurhashToAverageColor(photo.blurhash)
                    : undefined,
                }}
              >
                {isFailed ? (
                  <div className="dark:text-text-dark-tertiary bg-surface-tertiary text-text-tertiary dark:bg-surface-dark-tertiary flex h-full min-h-[120px] w-full items-center justify-center rounded text-xs">
                    图片加载失败
                  </div>
                ) : (
                  <img
                    src={getInitialSrc(photo)}
                    alt=""
                    className="h-full w-full rounded object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      e.currentTarget.style.display = ''
                      rememberLoadedSrc(photo, i, e.currentTarget)
                    }}
                    onError={(e) => handlePhotoError(photo, i, e)}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-4">
          {visiblePhotos.length === 1 ? (
            (() => {
              const photo = visiblePhotos[0]
              const token = getPhotoCacheToken(photo)
              const isFailed = !!token && failedPhotoTokens.has(token)
              return isFailed ? (
                <div
                  className="dark:text-text-dark-tertiary bg-surface-tertiary text-text-tertiary dark:bg-surface-dark-tertiary flex w-full items-center justify-center rounded text-sm"
                  style={{ maxHeight: '70vh', minHeight: '240px' }}
                >
                  图片加载失败
                </div>
              ) : (
                <img
                  src={getInitialSrc(photo)}
                  alt=""
                  className="h-auto w-full rounded object-contain"
                  style={{
                    maxHeight: '70vh',
                    backgroundColor: photo.blurhash
                      ? blurhashToAverageColor(photo.blurhash)
                      : undefined,
                  }}
                  loading="eager"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    e.currentTarget.style.display = ''
                    rememberLoadedSrc(photo, 0, e.currentTarget)
                  }}
                  onError={(e) => handlePhotoError(photo, 0, e)}
                />
              )
            })()
          ) : (
            <div
              className={`grid gap-2 ${
                visiblePhotos.length === 2
                  ? 'grid-cols-2'
                  : visiblePhotos.length === 3
                    ? 'grid-cols-2'
                    : visiblePhotos.length === 4
                      ? 'grid-cols-2'
                      : visiblePhotos.length >= 5
                        ? 'grid-cols-3'
                        : ''
              }`}
            >
              {visiblePhotos.map((photo, i) => {
                const token = getPhotoCacheToken(photo)
                const isFailed = !!token && failedPhotoTokens.has(token)
                return (
                  <div
                    key={`${token || 'media'}:${i}`}
                    className="relative aspect-square w-full"
                    style={{
                      ...(visiblePhotos.length === 3 && i === 2
                        ? { gridRow: 'span 2' }
                        : {}),
                    }}
                  >
                    {isFailed ? (
                      <div className="dark:text-text-dark-tertiary bg-surface-tertiary text-text-tertiary dark:bg-surface-dark-tertiary flex h-full w-full items-center justify-center rounded text-xs">
                        图片加载失败
                      </div>
                    ) : (
                      <img
                        src={getInitialSrc(photo)}
                        alt=""
                        className="aspect-square w-full rounded object-cover"
                        style={{
                          backgroundColor: photo.blurhash
                            ? blurhashToAverageColor(photo.blurhash)
                            : undefined,
                        }}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        referrerPolicy="no-referrer"
                        onLoad={(e) => {
                          e.currentTarget.style.display = ''
                          rememberLoadedSrc(photo, i, e.currentTarget)
                        }}
                        onError={(e) => handlePhotoError(photo, i, e)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
