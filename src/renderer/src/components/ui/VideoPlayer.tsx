/**
 * VideoPlayer - Inline video player component for social media and entry views.
 * Video player with preview image, play button overlay,
 * and native HTML5 video controls.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Play,
  Pause,
  Maximize2,
  Volume2,
  VolumeX,
  ExternalLink,
} from 'lucide-react'
import { getImageProxyFallbackUrls } from '../../lib/image-proxy'
import {
  buildBilibiliInAppPlayerUrl,
  normalizeBilibiliVideoUrl,
} from '../../lib/bilibili-video'
import { useSettingsStore } from '../../store/settings-store'

export const PAUSE_INLINE_VIDEOS_EVENT = 'livo:pause-inline-videos'

export function pauseInlineVideos() {
  window.dispatchEvent(new Event(PAUSE_INLINE_VIDEOS_EVENT))
}

interface VideoPlayerProps {
  src: string
  previewImage?: string
  width?: number
  height?: number
  className?: string
  autoPlay?: boolean
  onOpenBilibiliInPage?: (url: string) => void
}

function decodeHtmlEntities(raw: string): string {
  return (raw || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function decodeMirrorPreviewUrl(rawUrl: string): string {
  const raw = decodeHtmlEntities(rawUrl || '').trim()
  if (!raw) return ''
  const normalized = raw.startsWith('//') ? `https:${raw}` : raw
  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase()

    const isPicnobMirror = (h: string) =>
      h === 'media.picnob.info' ||
      h === 'media.pixnoy.com' ||
      h.includes('piokok.com') ||
      h.includes('picnob.com')

    if (isPicnobMirror(host) && parsed.pathname === '/get') {
      const qIndex = normalized.indexOf('?')
      const rawQuery = qIndex >= 0 ? normalized.slice(qIndex + 1) : ''
      const marker = rawQuery.indexOf('url=')
      if (marker >= 0) {
        const nestedRaw = rawQuery.slice(marker + 4).trim()
        if (nestedRaw) {
          try {
            const decoded = decodeURIComponent(nestedRaw)
            if (/^https?:\/\//i.test(decoded)) return decoded
          } catch {
            // Ignore decode failure.
          }
          if (/^https?:\/\//i.test(nestedRaw)) return nestedRaw
        }
      }
    }

    if (
      (host.includes('pixnoy') ||
        host.includes('picnob') ||
        host.includes('piokok')) &&
      parsed.searchParams.has('o')
    ) {
      const encoded = parsed.searchParams.get('o') || ''
      if (encoded) {
        const base = encoded.replace(/-/g, '+').replace(/_/g, '/')
        const padded = base + '='.repeat((4 - (base.length % 4)) % 4)
        try {
          const decoded = atob(padded)
          const nested = decoded.match(/https?:\/\/\S+/i)?.[0] || decoded
          if (/^https?:\/\//i.test(nested)) return nested
        } catch {
          // Ignore invalid payload.
        }
      }
    }
  } catch {
    // Ignore parse failures.
  }
  return normalized
}

function buildPreviewCandidates(previewImage?: string): string[] {
  const seed = decodeMirrorPreviewUrl(previewImage || '')
  if (!seed) return []
  const candidates = [
    seed,
    ...getImageProxyFallbackUrls(seed, {
      width: 1280,
      quality: 86,
      format: 'jpg',
    }),
  ]
  const unique: string[] = []
  for (const c of candidates) {
    if (!c || !/^https?:\/\//i.test(c)) continue
    if (!unique.includes(c)) unique.push(c)
  }
  return unique
}

export function VideoPlayer({
  src,
  previewImage,
  width,
  height,
  className = '',
  autoPlay = false,
  onOpenBilibiliInPage,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [hasStarted, setHasStarted] = useState(autoPlay)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [showBilibiliModal, setShowBilibiliModal] = useState(false)
  const bilibiliOpenInPage = useSettingsStore(
    (s) => s.settings.general.bilibiliOpenInPage,
  )
  const isBilibiliVideo = /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(src)
  const previewCandidates = useMemo(
    () => buildPreviewCandidates(previewImage),
    [previewImage],
  )
  const [previewIndex, setPreviewIndex] = useState(0)
  useEffect(() => {
    setPreviewIndex(0)
  }, [previewImage, src])
  const activePreviewImage = previewCandidates[previewIndex] || ''
  const handlePreviewError = useCallback(() => {
    setPreviewIndex((prev) => {
      const next = prev + 1
      return next < previewCandidates.length ? next : prev
    })
  }, [previewCandidates.length])

  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (videoError) {
        // Codec not supported - open in browser
        if (src) window.open(src, '_blank')
        return
      }
      if (!hasStarted) {
        setHasStarted(true)
        setIsStarting(true)
      }
      const video = videoRef.current
      if (!video) return
      if (video.paused) {
        setIsStarting(true)
        video.play().catch(() => {
          setIsStarting(false)
        })
        setIsPlaying(true)
      } else {
        video.pause()
        setIsPlaying(false)
        setIsStarting(false)
      }
    },
    [hasStarted, videoError, src],
  )

  const handleTimeUpdate = useCallback(() => {
    if (isDragging) return
    const video = videoRef.current
    if (!video || !video.duration) return
    setProgress((video.currentTime / video.duration) * 100)
    setCurrentTime(video.currentTime)
    setDuration(video.duration)
  }, [isDragging])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    setIsStarting(false)
    setProgress(0)
    setCurrentTime(0)
  }, [])

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const toggleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen().catch(() => {})
    }
  }, [])

  /** Seek to a position based on click/drag on the progress bar */
  const seekToPosition = useCallback((clientX: number) => {
    const bar = progressRef.current
    const video = videoRef.current
    if (!bar || !video || !video.duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    video.currentTime = ratio * video.duration
    setProgress(ratio * 100)
    setCurrentTime(video.currentTime)
  }, [])

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      setIsDragging(true)
      seekToPosition(e.clientX)
    },
    [seekToPosition],
  )

  // Global mousemove/mouseup for drag-seeking
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      seekToPosition(e.clientX)
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, seekToPosition])

  // Pause this player when app asks all inline preview videos to stop.
  useEffect(() => {
    const onPauseAll = () => {
      const video = videoRef.current
      if (!video || video.paused) return
      video.pause()
      setIsPlaying(false)
    }
    window.addEventListener(PAUSE_INLINE_VIDEOS_EVENT, onPauseAll)
    return () =>
      window.removeEventListener(PAUSE_INLINE_VIDEOS_EVENT, onPauseAll)
  }, [])

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // If it's an embeddable URL (YouTube, etc.), don't render inline - the parent should handle embedding
  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src)

  if (!isDirectVideo) {
    const bilibiliPageUrl = isBilibiliVideo
      ? normalizeBilibiliVideoUrl(src)
      : null
    const bilibiliPlayerUrl = isBilibiliVideo
      ? buildBilibiliInAppPlayerUrl(src)
      : null
    const bilibiliWebviewUrl = isBilibiliVideo
      ? bilibiliOpenInPage
        ? bilibiliPageUrl
        : bilibiliPlayerUrl
      : null

    return (
      <>
        <div
          className={`group relative cursor-pointer overflow-hidden rounded-lg bg-black ${className}`}
          style={{ width, height }}
          onClick={async (e) => {
            e.stopPropagation()
            if (isBilibiliVideo) {
              if (
                bilibiliOpenInPage &&
                bilibiliPageUrl &&
                onOpenBilibiliInPage
              ) {
                onOpenBilibiliInPage(bilibiliPageUrl)
                return
              }
              setShowBilibiliModal(true)
              return
            }
            window.open(src, '_blank')
          }}
        >
          {activePreviewImage ? (
            <img
              src={activePreviewImage}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePreviewError}
            />
          ) : (
            <div className="h-full w-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
              <Play size={20} className="ml-0.5 text-white" fill="white" />
            </div>
          </div>
        </div>
        {showBilibiliModal && isBilibiliVideo && bilibiliWebviewUrl && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-8"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowBilibiliModal(false)
            }}
          >
            <div
              className="aspect-video w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <webview
                src={bilibiliWebviewUrl}
                className="h-full w-full rounded-xl bg-black"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
              />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-lg bg-black ${className}`}
      style={{ width, height }}
      onClick={handlePlay}
    >
      {/* Video element - only load when user clicks play to avoid mass ffmpeg errors */}
      {hasStarted && !videoError ? (
        <video
          ref={videoRef}
          src={src}
          poster={previewImage}
          muted={isMuted}
          autoPlay
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => {
            setIsPlaying(true)
            setIsStarting(false)
          }}
          onPause={() => {
            setIsPlaying(false)
            setIsStarting(false)
          }}
          onLoadedMetadata={() => {
            const v = videoRef.current
            if (v) setDuration(v.duration)
          }}
          onError={() => {
            setVideoError(true)
            setIsStarting(false)
          }}
        />
      ) : (
        <>
          {/* Preview image or placeholder */}
          {previewImage ? (
            <img
              src={activePreviewImage || previewImage}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePreviewError}
            />
          ) : (
            <div className="h-full w-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          )}
        </>
      )}

      {/* Error overlay - unsupported codec, offer to open in browser */}
      {videoError && (
        <div className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 bg-black/60 text-white">
          <ExternalLink size={20} />
          <span className="text-xs opacity-80">
            格式不支持，点击在浏览器中打开
          </span>
        </div>
      )}

      {/* Play overlay - shown when not actively playing and no error */}
      {!isPlaying && !videoError && !isStarting && (
        <div className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20 transition-colors hover:bg-black/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <Play size={24} className="ml-1 text-white" fill="white" />
          </div>
        </div>
      )}

      {/* Controls overlay - always visible when playing, interactive progress bar */}
      {hasStarted && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 transition-opacity ${
            isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {/* Seekable progress bar */}
          <div
            ref={progressRef}
            className="mb-1 flex h-3 w-full cursor-pointer items-center"
            onMouseDown={handleProgressMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-1 w-full rounded-full bg-white/30 transition-all hover:h-1.5">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${progress}%` }}
              />
              {/* Drag handle */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlay}
                className="text-white transition-colors hover:text-white/80"
              >
                {isPlaying ? (
                  <Pause size={16} />
                ) : (
                  <Play size={16} fill="white" />
                )}
              </button>
              <button
                onClick={toggleMute}
                className="text-white transition-colors hover:text-white/80"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <span className="select-none text-[11px] tabular-nums text-white/70">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button
              onClick={toggleFullscreen}
              className="text-white transition-colors hover:text-white/80"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
