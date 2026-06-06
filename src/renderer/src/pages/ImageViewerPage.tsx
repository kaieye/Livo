import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ImageOff,
  Loader2,
} from 'lucide-react'

import { CachedImage } from '../components/ui/CachedImage'
import { useDeepLinkEntry } from '../hooks/useDeepLinkEntry'
import { resolveEntryImages, type EntryImage } from '../lib/entry-image-source'

// Page shell for `/image/:entryId/:imageIndex?`. Mirrors VideoPlayerPage (1.4):
// entry-store hydration via `useDeepLinkEntry` + dark chrome + fullscreen body.
// The viewer enumerates the entry's photo media and supports prev/next via
// header buttons, keyboard arrows, and edge clicks. Pan/zoom is intentionally
// deferred (carry-over for P3) — basic letterboxed display is the MVP for
// parity with the Harmony ImageViewer page.
export default function ImageViewerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entryId, imageIndex } = useParams<{
    entryId: string
    imageIndex?: string
  }>()

  const { activeEntry, state: fetchState } = useDeepLinkEntry(entryId)

  const images = useMemo<EntryImage[]>(
    () => (activeEntry ? resolveEntryImages(activeEntry) : []),
    [activeEntry],
  )

  // URL is the source of truth for the active image. Treat both out-of-range
  // and non-numeric segments as canonicalisation triggers so the URL never
  // lingers in a "renders 0 but says foo" state.
  const parsedIndex =
    imageIndex !== undefined ? Number.parseInt(imageIndex, 10) : 0
  const isWellFormedSegment =
    imageIndex === undefined ||
    (Number.isInteger(parsedIndex) && String(parsedIndex) === imageIndex)
  const requestedIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0
  const safeIndex = images.length
    ? Math.min(Math.max(requestedIndex, 0), images.length - 1)
    : 0

  // Normalise once images are known. A segment is canonical when it matches
  // `String(safeIndex)`, or is absent for safeIndex === 0.
  useEffect(() => {
    if (!entryId || images.length === 0) return
    const isCanonical =
      isWellFormedSegment &&
      (safeIndex === 0
        ? imageIndex === undefined
        : imageIndex === String(safeIndex))
    if (!isCanonical) {
      navigate(
        safeIndex === 0
          ? `/image/${entryId}`
          : `/image/${entryId}/${safeIndex}`,
        { replace: true },
      )
    }
  }, [
    entryId,
    images.length,
    imageIndex,
    isWellFormedSegment,
    safeIndex,
    navigate,
  ])

  const goToIndex = useCallback(
    (next: number) => {
      if (!entryId || images.length === 0) return
      const clamped = Math.min(Math.max(next, 0), images.length - 1)
      if (clamped === safeIndex) return
      navigate(
        clamped === 0 ? `/image/${entryId}` : `/image/${entryId}/${clamped}`,
        { replace: true },
      )
    },
    [entryId, images.length, safeIndex, navigate],
  )

  const handleBack = useCallback(() => navigate(-1), [navigate])
  const handlePrev = useCallback(
    () => goToIndex(safeIndex - 1),
    [goToIndex, safeIndex],
  )
  const handleNext = useCallback(
    () => goToIndex(safeIndex + 1),
    [goToIndex, safeIndex],
  )

  const [isSaving, setIsSaving] = useState(false)
  const handleSave = useCallback(
    async (imageUrl: string, title: string) => {
      if (!imageUrl || isSaving) return
      setIsSaving(true)
      try {
        await window.api.app.downloadUrl({
          url: imageUrl,
          suggestedFileName: title?.trim() || 'image',
          title: t('imageViewer.save'),
          filters: [
            {
              name: 'Images',
              extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
            },
          ],
        })
      } finally {
        setIsSaving(false)
      }
    },
    [isSaving, t],
  )

  // Keyboard navigation: arrows move within the gallery, Escape exits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlePrev, handleNext, handleBack])

  const headerTitle = useMemo(() => {
    if (activeEntry) {
      return (
        activeEntry.title?.trim() ||
        activeEntry.author?.trim() ||
        t('imageViewer.pageTitle')
      )
    }
    return t('imageViewer.pageTitle')
  }, [activeEntry, t])

  const showNotFound =
    fetchState === 'missing' ||
    (fetchState === 'idle' && !!activeEntry && images.length === 0)
  const showLoading =
    !showNotFound && (fetchState === 'loading' || !activeEntry)

  const currentImage = images[safeIndex]
  // Prefer the high-res `url`; previewUrl only matters when the primary fails.
  const currentSrc = currentImage?.url || currentImage?.previewUrl || ''
  const externalUrl = activeEntry?.url || currentImage?.url || ''
  const total = images.length
  const hasPrev = safeIndex > 0
  const hasNext = safeIndex < total - 1

  return (
    <div className="titlebar-safe-pt flex h-full w-full flex-col overflow-hidden bg-black">
      <header className="no-drag flex flex-shrink-0 items-center gap-3 border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('imageViewer.back')}
          title={t('imageViewer.back')}
          className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {headerTitle}
        </h1>
        {total > 1 && (
          <span className="flex-shrink-0 text-xs tabular-nums text-white/60">
            {t('imageViewer.counter', {
              current: safeIndex + 1,
              total,
            })}
          </span>
        )}
        {currentSrc && (
          <button
            type="button"
            onClick={() =>
              void handleSave(currentImage?.url || currentSrc, headerTitle)
            }
            disabled={isSaving}
            aria-label={t('imageViewer.save')}
            title={t('imageViewer.save')}
            className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
          </button>
        )}
        {externalUrl && (
          <button
            type="button"
            onClick={() => window.open(externalUrl, '_blank')}
            aria-label={t('imageViewer.openExternal')}
            title={t('imageViewer.openExternal')}
            className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        )}
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center">
        {showNotFound ? (
          <UnviewableState
            t={t}
            externalUrl={externalUrl}
            onBack={handleBack}
          />
        ) : showLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span>{t('imageViewer.loading')}</span>
          </div>
        ) : currentSrc ? (
          <>
            <CachedImage
              key={`viewer-${safeIndex}-${currentSrc}`}
              src={currentSrc}
              alt=""
              className="max-h-full max-w-full object-contain"
              referrerPolicy="no-referrer"
              draggable={false}
            />

            {/* Edge click zones — cheap prev/next without overlapping center. */}
            {hasPrev && (
              <button
                type="button"
                onClick={handlePrev}
                aria-label={t('imageViewer.previous')}
                title={t('imageViewer.previous')}
                className="group absolute left-0 top-0 flex h-full w-[15%] min-w-[64px] items-center justify-start pl-3 focus:outline-none"
              >
                <span className="rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <ChevronLeft size={22} aria-hidden="true" />
                </span>
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={handleNext}
                aria-label={t('imageViewer.next')}
                title={t('imageViewer.next')}
                className="group absolute right-0 top-0 flex h-full w-[15%] min-w-[64px] items-center justify-end pr-3 focus:outline-none"
              >
                <span className="rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <ChevronRight size={22} aria-hidden="true" />
                </span>
              </button>
            )}
          </>
        ) : (
          <UnviewableState
            t={t}
            externalUrl={externalUrl}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  )
}

function UnviewableState({
  t,
  externalUrl,
  onBack,
}: {
  t: (key: string) => string
  externalUrl: string
  onBack: () => void
}) {
  return (
    <div className="px-6 text-center">
      <ImageOff
        size={48}
        aria-hidden="true"
        className="mx-auto mb-4 text-white/40"
      />
      <p className="text-sm text-white/80">{t('imageViewer.notFound')}</p>
      <p className="mt-1 text-xs text-white/50">
        {t('imageViewer.notFoundHint')}
      </p>
      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        {externalUrl && (
          <button
            type="button"
            onClick={() => window.open(externalUrl, '_blank')}
            className="text-accent inline-flex items-center gap-1 hover:underline"
          >
            <ExternalLink size={14} aria-hidden="true" />
            {t('imageViewer.openExternal')}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-white/70 hover:underline"
        >
          {t('imageViewer.back')}
        </button>
      </div>
    </div>
  )
}
