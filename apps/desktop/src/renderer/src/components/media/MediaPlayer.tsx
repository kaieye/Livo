/**
 * Media Player component — audio/video player with controls.
 * Supports a compact corner audio player.
 * and inline video player for video entries.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Maximize2, Minimize2, X, Loader2 } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'
import {
  buildBilibiliInAppPlayerUrl,
  normalizeBilibiliVideoUrl,
} from '../../lib/bilibili-video'
import {
  buildYoutubeIframeUrl,
  extractYoutubeVideoId,
  resolveYoutubePlayback,
} from '../../lib/youtube-playback'

// ====== Player store + mini bar ======
// The audio player state machine moved to `store/player-store.ts` (backed by
// `lib/audio-playback.ts`'s AudioPlaybackService) and the mini bar UI to
// `AudioMiniBar.tsx`. Re-exported here for backwards-compatible import paths.
export { usePlayerStore } from '../../store/player-store'
export type { PlayOptions, AudioTrack } from '../../store/player-store'
export { AudioMiniBar as CornerPlayer } from './AudioMiniBar'

/** Transform a video URL into an embeddable iframe URL. */
export function transformVideoUrl(url: string): string | null {
  if (!url) return null

  // YouTube
  const youtubeId = extractYoutubeVideoId(url)
  if (youtubeId) {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?controls=1&autoplay=0&mute=0`
  }

  // Bilibili
  const bilibiliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)
  if (bilibiliMatch) {
    return `//player.bilibili.com/player.html?bvid=${bilibiliMatch[1]}&high_quality=1&danmaku=1&autoplay=0`
  }

  // Bilibili av number
  const bilibiliAvMatch = url.match(/bilibili\.com\/video\/(av\d+)/)
  if (bilibiliAvMatch) {
    return `//player.bilibili.com/player.html?aid=${bilibiliAvMatch[1].slice(2)}&high_quality=1&danmaku=1&autoplay=0`
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`
  }

  // TED Talks — ted.com/talks/{slug} (strip query params)
  const tedMatch = url.match(/ted\.com\/talks\/([a-zA-Z0-9_]+)/)
  if (tedMatch) {
    return `https://embed.ted.com/talks/${tedMatch[1]}`
  }

  // TED direct download — download.ted.com/products/XXXXX.mp4
  // These are direct video files, not embeddable — return null to let the <video> tag handle it
  if (/download\.ted\.com\//.test(url)) {
    return null
  }

  return null
}

/** Check if a URL is a known video platform */
export function isVideoUrl(url: string): boolean {
  return transformVideoUrl(url) !== null
}

export function VideoPlayer({
  url,
  poster,
  title: _title,
  onOpenBilibiliInPage,
}: {
  url: string
  poster?: string
  title?: string
  onOpenBilibiliInPage?: (url: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [_isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showInlineEmbed, setShowInlineEmbed] = useState(false)
  const [isResolvingYoutube, setIsResolvingYoutube] = useState(false)
  const [youtubePlayback, setYoutubePlayback] = useState<{
    kind: 'direct' | 'iframe'
    url: string
  } | null>(null)
  const bilibiliOpenInPage = useSettingsStore(
    (s) => s.settings.general.bilibiliOpenInPage,
  )
  const isBilibiliVideo = /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)
  const youtubeVideoId = extractYoutubeVideoId(url)
  const isYouTubeVideo = !!youtubeVideoId
  const shouldUseBilibiliWebview = isBilibiliVideo && !bilibiliOpenInPage
  const youtubeFallbackIframeUrl = youtubeVideoId
    ? buildYoutubeIframeUrl(youtubeVideoId)
    : null

  const toggleFullscreen = () => {
    if (!videoRef.current) return
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFS = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFS)
    return () => document.removeEventListener('fullscreenchange', handleFS)
  }, [])

  useEffect(() => {
    if (!showModal || !isYouTubeVideo) return

    let cancelled = false
    setIsResolvingYoutube(true)
    setYoutubePlayback(null)

    void resolveYoutubePlayback(window.api.video, url)
      .then((result) => {
        if (cancelled) return
        setYoutubePlayback(result)
      })
      .catch(() => {
        if (cancelled || !youtubeFallbackIframeUrl) return
        setYoutubePlayback({
          kind: 'iframe',
          url: youtubeFallbackIframeUrl,
        })
      })
      .finally(() => {
        if (cancelled) return
        setIsResolvingYoutube(false)
      })

    return () => {
      cancelled = true
    }
  }, [isYouTubeVideo, showModal, url, youtubeFallbackIframeUrl])

  // Try to get an iframe embed URL
  const iframeSrc = transformVideoUrl(url)
  const bilibiliWebviewUrl = shouldUseBilibiliWebview
    ? buildBilibiliInAppPlayerUrl(url, { includeOutsideFlag: true })
    : null
  const bilibiliPageUrl =
    isBilibiliVideo && bilibiliOpenInPage
      ? normalizeBilibiliVideoUrl(url)
      : null

  const handleOpenVideo = useCallback(() => {
    if (bilibiliPageUrl && onOpenBilibiliInPage) {
      onOpenBilibiliInPage(bilibiliPageUrl)
      return
    }
    if (shouldUseBilibiliWebview && bilibiliWebviewUrl) {
      setShowInlineEmbed(true)
      return
    }
    setShowModal(true)
  }, [
    bilibiliPageUrl,
    onOpenBilibiliInPage,
    shouldUseBilibiliWebview,
    bilibiliWebviewUrl,
  ])

  if (iframeSrc) {
    return (
      <>
        <div
          className="group relative aspect-video cursor-pointer overflow-hidden rounded-xl bg-black"
          onClick={handleOpenVideo}
        >
          {showInlineEmbed && shouldUseBilibiliWebview && bilibiliWebviewUrl ? (
            <webview
              src={bilibiliWebviewUrl}
              className="h-full w-full bg-black"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            />
          ) : poster ? (
            <img src={poster} alt="" className="h-full w-full object-cover" />
          ) : (
            <iframe
              src={iframeSrc}
              className="pointer-events-none h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              allowFullScreen
              allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
            />
          )}
          {!showInlineEmbed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60">
                <Play size={24} className="ml-1 text-white" fill="white" />
              </div>
            </div>
          )}
        </div>

        {/* Full-screen video modal */}
        {showModal && !showInlineEmbed && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowModal(false)
            }}
          >
            <div
              className="aspect-video w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {shouldUseBilibiliWebview && bilibiliWebviewUrl ? (
                <webview
                  src={bilibiliWebviewUrl}
                  className="h-full w-full rounded-xl bg-black"
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                />
              ) : bilibiliPageUrl ? (
                <webview
                  src={bilibiliPageUrl}
                  className="h-full w-full rounded-xl bg-black"
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                />
              ) : isYouTubeVideo ? (
                isResolvingYoutube ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
                    <Loader2 size={32} className="animate-spin opacity-60" />
                    <span className="text-sm opacity-60">
                      正在解析视频地址...
                    </span>
                  </div>
                ) : youtubePlayback?.kind === 'direct' ? (
                  <video
                    src={youtubePlayback.url}
                    className="h-full w-full rounded-xl bg-black"
                    controls
                    autoPlay
                    preload="metadata"
                    onError={() => {
                      if (!youtubeFallbackIframeUrl) return
                      setYoutubePlayback({
                        kind: 'iframe',
                        url: youtubeFallbackIframeUrl,
                      })
                    }}
                  />
                ) : youtubePlayback?.kind === 'iframe' ? (
                  <iframe
                    src={youtubePlayback.url}
                    className="h-full w-full rounded-xl"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                    allowFullScreen
                    allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
                  />
                ) : null
              ) : (
                <iframe
                  src={iframeSrc.replace('autoplay=0', 'autoplay=1')}
                  className="h-full w-full rounded-xl"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                  allowFullScreen
                  allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
                />
              )}
            </div>
            <button
              onClick={() => {
                setShowModal(false)
                setYoutubePlayback(null)
                setIsResolvingYoutube(false)
              }}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="group relative overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        className="w-full"
        controls
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={toggleFullscreen}
          className="rounded-lg bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  )
}
