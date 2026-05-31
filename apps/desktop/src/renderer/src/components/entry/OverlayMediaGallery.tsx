import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { memo, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { VideoPlayer } from '../ui/VideoPlayer'
import { CachedImage } from '../ui/CachedImage'

type OverlayPhoto = {
  url?: string
  previewUrl?: string
}

type OverlayVideo = {
  url: string
  previewUrl?: string
}

export const OverlayMediaGallery = memo(function OverlayMediaGallery({
  displayPhotos,
  videos,
  previewIdx,
  lightboxOpen,
  failedPhotoTokens,
  getPhotoToken,
  getPhotoInitialSrc,
  onPhotoError,
  onSetPreviewIdx,
  onSetLightboxOpen,
}: {
  displayPhotos: OverlayPhoto[]
  videos: OverlayVideo[]
  previewIdx: number | null
  lightboxOpen: boolean
  failedPhotoTokens: Set<string>
  getPhotoToken: (photo?: OverlayPhoto) => string
  getPhotoInitialSrc: (photo?: OverlayPhoto) => string
  onPhotoError: (
    photo: OverlayPhoto | undefined,
    e: SyntheticEvent<HTMLImageElement>,
  ) => void
  onSetPreviewIdx: (index: number) => void
  onSetLightboxOpen: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {displayPhotos.length > 0 && (
        <div className="group/carousel relative">
          <div className="relative overflow-hidden" style={{ height: '70vh' }}>
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${(previewIdx ?? 0) * 100}%)` }}
            >
              {displayPhotos.map((photo, i) => {
                const token = getPhotoToken(photo)
                const isFailed = !!token && failedPhotoTokens.has(token)
                return (
                  <div
                    key={`slide-${i}`}
                    className="flex h-full w-full flex-shrink-0 items-center justify-center"
                  >
                    {isFailed ? (
                      <div className="dark:text-text-dark-tertiary flex min-h-[180px] w-full max-w-full items-center justify-center rounded-lg bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary">
                        图片加载失败
                      </div>
                    ) : (
                      <CachedImage
                        src={getPhotoInitialSrc(photo)}
                        alt=""
                        className="max-h-full max-w-full cursor-zoom-in rounded-lg object-contain"
                        loading={i <= (previewIdx ?? 0) + 1 ? 'eager' : 'lazy'}
                        referrerPolicy="no-referrer"
                        onClick={() => onSetLightboxOpen(true)}
                        onLoad={(e) => {
                          e.currentTarget.style.display = ''
                        }}
                        onError={(e) => onPhotoError(photo, e)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {displayPhotos.length > 1 && (previewIdx ?? 0) > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSetPreviewIdx(Math.max(0, (previewIdx ?? 0) - 1))
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover/carousel:opacity-100"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {displayPhotos.length > 1 &&
              (previewIdx ?? 0) < displayPhotos.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSetPreviewIdx(
                      Math.min(displayPhotos.length - 1, (previewIdx ?? 0) + 1),
                    )
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover/carousel:opacity-100"
                >
                  <ChevronRight size={22} />
                </button>
              )}
          </div>

          {displayPhotos.length > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {displayPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSetPreviewIdx(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === (previewIdx ?? 0)
                      ? 'bg-accent'
                      : 'bg-text-tertiary/40 hover:bg-text-tertiary/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {videos.map((video, i) => (
        <div key={`video-${i}`} className="mt-3">
          <VideoPlayer
            src={video.url}
            previewImage={video.previewUrl}
            className="aspect-video w-full rounded-lg"
          />
        </div>
      ))}

      {lightboxOpen && displayPhotos[previewIdx ?? 0] && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={() => onSetLightboxOpen(false)}
        >
          {(() => {
            const idx = previewIdx ?? 0
            const previewPhoto = displayPhotos[idx]
            const previewToken = getPhotoToken(previewPhoto)
            const previewFailed =
              !!previewToken && failedPhotoTokens.has(previewToken)
            return previewFailed ? (
              <div
                className="dark:text-text-dark-tertiary flex max-h-[90vh] min-h-[240px] min-w-[240px] max-w-[90vw] items-center justify-center rounded-lg bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary"
                onClick={(e) => e.stopPropagation()}
              >
                图片加载失败
              </div>
            ) : (
              <CachedImage
                key={`overlay-preview-${idx}-${previewPhoto.url}`}
                src={getPhotoInitialSrc(previewPhoto)}
                alt=""
                className="max-h-[90vh] max-w-[90vw] object-contain"
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  e.currentTarget.style.display = ''
                }}
                onError={(e) => onPhotoError(previewPhoto, e)}
                onClick={(e) => e.stopPropagation()}
              />
            )
          })()}
          <button
            onClick={() => onSetLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X size={20} />
          </button>
          {(() => {
            const previewPhoto = displayPhotos[previewIdx ?? 0]
            const saveUrl = previewPhoto?.url || previewPhoto?.previewUrl
            if (!saveUrl) return null
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void window.api.app.downloadUrl({
                    url: saveUrl,
                    suggestedFileName: 'image',
                    title: t('imageViewer.save'),
                    filters: [
                      {
                        name: 'Images',
                        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
                      },
                    ],
                  })
                }}
                aria-label={t('imageViewer.save')}
                title={t('imageViewer.save')}
                className="absolute right-16 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <Download size={20} />
              </button>
            )
          })()}
          {displayPhotos.length > 1 && (previewIdx ?? 0) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetPreviewIdx((previewIdx ?? 0) - 1)
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {displayPhotos.length > 1 &&
            (previewIdx ?? 0) < displayPhotos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSetPreviewIdx((previewIdx ?? 0) + 1)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight size={24} />
              </button>
            )}
        </div>
      )}
    </>
  )
})
