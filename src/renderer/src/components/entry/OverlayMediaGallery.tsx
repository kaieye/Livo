import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { memo, type SyntheticEvent } from "react"

import { VideoPlayer } from "../ui/VideoPlayer"

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
  onPhotoError: (photo: OverlayPhoto | undefined, e: SyntheticEvent<HTMLImageElement>) => void
  onSetPreviewIdx: (index: number) => void
  onSetLightboxOpen: (open: boolean) => void
}) {
  return (
    <>
      {displayPhotos.length > 0 && (
        <div className="relative group/carousel">
          <div className="relative overflow-hidden" style={{ height: "70vh" }}>
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${(previewIdx ?? 0) * 100}%)` }}
            >
              {displayPhotos.map((photo, i) => {
                const token = getPhotoToken(photo)
                const isFailed = !!token && failedPhotoTokens.has(token)
                return (
                  <div key={`slide-${i}`} className="flex-shrink-0 w-full h-full flex items-center justify-center">
                    {isFailed ? (
                      <div className="flex min-h-[180px] w-full max-w-full items-center justify-center rounded-lg bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary">
                        图片加载失败
                      </div>
                    ) : (
                      <img
                        src={getPhotoInitialSrc(photo)}
                        alt=""
                        className="max-w-full max-h-full rounded-lg cursor-zoom-in object-contain"
                        loading={i <= (previewIdx ?? 0) + 1 ? "eager" : "lazy"}
                        referrerPolicy="no-referrer"
                        onClick={() => onSetLightboxOpen(true)}
                        onLoad={(e) => { e.currentTarget.style.display = "" }}
                        onError={(e) => onPhotoError(photo, e)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {displayPhotos.length > 1 && (previewIdx ?? 0) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onSetPreviewIdx(Math.max(0, (previewIdx ?? 0) - 1)) }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {displayPhotos.length > 1 && (previewIdx ?? 0) < displayPhotos.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onSetPreviewIdx(Math.min(displayPhotos.length - 1, (previewIdx ?? 0) + 1)) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>

          {displayPhotos.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {displayPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSetPreviewIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === (previewIdx ?? 0)
                      ? "bg-accent"
                      : "bg-text-tertiary/40 hover:bg-text-tertiary/60"
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
            className="w-full aspect-video rounded-lg"
          />
        </div>
      ))}

      {lightboxOpen && displayPhotos[(previewIdx ?? 0)] && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
          onClick={() => onSetLightboxOpen(false)}
        >
          {(() => {
            const idx = previewIdx ?? 0
            const previewPhoto = displayPhotos[idx]
            const previewToken = getPhotoToken(previewPhoto)
            const previewFailed = !!previewToken && failedPhotoTokens.has(previewToken)
            return previewFailed ? (
              <div
                className="flex min-h-[240px] min-w-[240px] max-w-[90vw] max-h-[90vh] items-center justify-center rounded-lg bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary dark:text-text-dark-tertiary"
                onClick={(e) => e.stopPropagation()}
              >
                图片加载失败
              </div>
            ) : (
              <img
                key={`overlay-preview-${idx}-${previewPhoto.url}`}
                src={getPhotoInitialSrc(previewPhoto)}
                alt=""
                className="max-w-[90vw] max-h-[90vh] object-contain"
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  e.currentTarget.style.display = ""
                }}
                onError={(e) => onPhotoError(previewPhoto, e)}
                onClick={(e) => e.stopPropagation()}
              />
            )
          })()}
          <button
            onClick={() => onSetLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          {displayPhotos.length > 1 && (previewIdx ?? 0) > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetPreviewIdx((previewIdx ?? 0) - 1) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {displayPhotos.length > 1 && (previewIdx ?? 0) < displayPhotos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetPreviewIdx((previewIdx ?? 0) + 1) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </>
  )
})
