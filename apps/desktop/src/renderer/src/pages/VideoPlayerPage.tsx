import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ExternalLink, Loader2, VideoOff } from 'lucide-react'

import { VideoPlayer } from '../components/ui/VideoPlayer'
import { useDeepLinkEntry } from '../hooks/useDeepLinkEntry'
import { resolvePreferredEntryVideo } from '../lib/entry-video-source'
import {
  buildYoutubeIframeUrl,
  extractYoutubeVideoId,
  resolveYoutubePlayback,
} from '../lib/youtube-playback'

type YoutubePlayback = { kind: 'direct' | 'iframe'; url: string }

// Page shell for `/video/:entryId`. Reuses the entry-store hydration pattern
// from ArticleDetailPage (1.3) so we get title + media + poster for free.
// `ui/VideoPlayer` already handles direct video files + Bilibili webview; for
// YouTube embeds — which it would otherwise punt to `window.open` — we resolve
// upfront via the existing `video-proxy` IPC and inline an iframe fallback so
// the page is the unified fullscreen entry.
export default function VideoPlayerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entryId } = useParams<{ entryId: string }>()

  const { activeEntry, state: fetchState } = useDeepLinkEntry(entryId)

  const videoMedia = useMemo(
    () => (activeEntry ? resolvePreferredEntryVideo(activeEntry) : null),
    [activeEntry],
  )

  const youtubeVideoId = videoMedia
    ? extractYoutubeVideoId(videoMedia.url)
    : null
  const isYouTubeVideo = !!youtubeVideoId
  // TODO(P2-9.5): unify with the matching regex in MediaPlayer/EntryContent —
  // 3 inline copies today, all driven by the same direct-stream policy.
  const isDirectVideo =
    !!videoMedia && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoMedia.url)
  const isBilibiliVideo =
    !!videoMedia && /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(videoMedia.url)
  // ui/VideoPlayer covers direct files (with controls) and Bilibili (modal
  // webview). Everything else (YouTube, Vimeo, TED, etc.) it would `window.open`
  // — we intercept YouTube here so the page can host the iframe fallback.
  // (P2-9.x carry-over: `media/MediaPlayer.VideoPlayer` already does YouTube
  // inline; consolidating the two players removes the need for this shim.)
  const shouldUseInlineVideoPlayer = isDirectVideo || isBilibiliVideo

  const [youtubePlayback, setYoutubePlayback] =
    useState<YoutubePlayback | null>(null)
  const [isResolvingYoutube, setIsResolvingYoutube] = useState(false)

  useEffect(() => {
    if (!isYouTubeVideo || !videoMedia) {
      setYoutubePlayback(null)
      return
    }

    const fallbackIframe = youtubeVideoId
      ? buildYoutubeIframeUrl(youtubeVideoId)
      : null

    let cancelled = false
    setIsResolvingYoutube(true)
    setYoutubePlayback(null)

    void resolveYoutubePlayback(window.api.video, videoMedia.url)
      .then((result) => {
        if (cancelled) return
        setYoutubePlayback(result)
      })
      .catch(() => {
        if (cancelled || !fallbackIframe) return
        setYoutubePlayback({ kind: 'iframe', url: fallbackIframe })
      })
      .finally(() => {
        if (cancelled) return
        setIsResolvingYoutube(false)
      })

    return () => {
      cancelled = true
    }
  }, [isYouTubeVideo, videoMedia, youtubeVideoId])

  const handleBack = useCallback(() => navigate(-1), [navigate])

  const headerTitle = useMemo(() => {
    if (activeEntry) {
      return (
        activeEntry.title?.trim() ||
        activeEntry.author?.trim() ||
        t('videoPlayer.pageTitle')
      )
    }
    return t('videoPlayer.pageTitle')
  }, [activeEntry, t])

  const showNotFound =
    fetchState === 'missing' ||
    (fetchState === 'idle' && !!activeEntry && !videoMedia)
  const showLoading =
    !showNotFound && (fetchState === 'loading' || !activeEntry)

  const externalUrl = activeEntry?.url || videoMedia?.url || ''

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-black">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('videoPlayer.back')}
          title={t('videoPlayer.back')}
          className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {headerTitle}
        </h1>
        {externalUrl && (
          <button
            type="button"
            onClick={() => window.open(externalUrl, '_blank')}
            aria-label={t('videoPlayer.openExternal')}
            title={t('videoPlayer.openExternal')}
            className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        )}
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center">
        {showNotFound ? (
          <UnplayableState
            t={t}
            externalUrl={externalUrl}
            onBack={handleBack}
          />
        ) : showLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span>{t('videoPlayer.loading')}</span>
          </div>
        ) : videoMedia && shouldUseInlineVideoPlayer ? (
          <div className="h-full w-full">
            <VideoPlayer
              src={videoMedia.url}
              previewImage={activeEntry?.imageUrl}
              autoPlay={isDirectVideo}
              className="h-full w-full rounded-none"
            />
          </div>
        ) : videoMedia && isYouTubeVideo ? (
          isResolvingYoutube || !youtubePlayback ? (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>{t('videoPlayer.loading')}</span>
            </div>
          ) : youtubePlayback.kind === 'direct' ? (
            <video
              src={youtubePlayback.url}
              className="h-full w-full object-contain"
              controls
              autoPlay
              preload="metadata"
              onError={() => {
                const fallback = youtubeVideoId
                  ? buildYoutubeIframeUrl(youtubeVideoId)
                  : null
                if (fallback)
                  setYoutubePlayback({ kind: 'iframe', url: fallback })
              }}
            />
          ) : (
            <iframe
              src={youtubePlayback.url}
              className="h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              allowFullScreen
              allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
            />
          )
        ) : (
          <UnplayableState
            t={t}
            externalUrl={externalUrl}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  )
}

function UnplayableState({
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
      <VideoOff
        size={48}
        aria-hidden="true"
        className="mx-auto mb-4 text-white/40"
      />
      <p className="text-sm text-white/80">{t('videoPlayer.unplayable')}</p>
      <p className="mt-1 text-xs text-white/50">
        {t('videoPlayer.unplayableHint')}
      </p>
      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        {externalUrl && (
          <button
            type="button"
            onClick={() => window.open(externalUrl, '_blank')}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            <ExternalLink size={14} aria-hidden="true" />
            {t('videoPlayer.openExternal')}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-white/70 hover:underline"
        >
          {t('videoPlayer.back')}
        </button>
      </div>
    </div>
  )
}
