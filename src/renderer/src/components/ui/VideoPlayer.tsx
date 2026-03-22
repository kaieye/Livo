/**
 * VideoPlayer - Inline video player component for social media and entry views.
 * Video player with preview image, play button overlay,
 * and native HTML5 video controls.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Play, Pause, Maximize2, Volume2, VolumeX, ExternalLink } from "lucide-react"
import { getImageProxyFallbackUrls } from "../../lib/image-proxy"
import { useSettingsStore } from "../../store/settings-store"

export const PAUSE_INLINE_VIDEOS_EVENT = "livo:pause-inline-videos"

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
  return (raw || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function decodeMirrorPreviewUrl(rawUrl: string): string {
  const raw = decodeHtmlEntities(rawUrl || "").trim()
  if (!raw) return ""
  const normalized = raw.startsWith("//") ? `https:${raw}` : raw
  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase()

    const isPicnobMirror = (h: string) =>
      h === "media.picnob.info" ||
      h === "media.pixnoy.com" ||
      h.includes("piokok.com") ||
      h.includes("picnob.com")

    if (isPicnobMirror(host) && parsed.pathname === "/get") {
      const qIndex = normalized.indexOf("?")
      const rawQuery = qIndex >= 0 ? normalized.slice(qIndex + 1) : ""
      const marker = rawQuery.indexOf("url=")
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

    if ((host.includes("pixnoy") || host.includes("picnob") || host.includes("piokok")) && parsed.searchParams.has("o")) {
      const encoded = parsed.searchParams.get("o") || ""
      if (encoded) {
        const base = encoded.replace(/-/g, "+").replace(/_/g, "/")
        const padded = base + "=".repeat((4 - (base.length % 4)) % 4)
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
  const seed = decodeMirrorPreviewUrl(previewImage || "")
  if (!seed) return []
  const candidates = [seed, ...getImageProxyFallbackUrls(seed, { width: 1280, quality: 86, format: "jpg" })]
  const unique: string[] = []
  for (const c of candidates) {
    if (!c || !/^https?:\/\//i.test(c)) continue
    if (!unique.includes(c)) unique.push(c)
  }
  return unique
}

function normalizeBilibiliVideoUrl(rawUrl: string): string {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) return `https://www.bilibili.com/video/${bvidMatch[1]}`
  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) return `https://www.bilibili.com/video/av${aidMatch[1]}`
  return rawUrl
}

function buildBilibiliInAppPlayerUrl(rawUrl: string): string {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) {
    return `https://www.bilibili.com/blackboard/newplayer.html?${new URLSearchParams({
      bvid: bvidMatch[1],
      autoplay: "true",
      danmaku: "true",
      muted: "false",
      highQuality: "true",
    }).toString()}`
  }
  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) {
    return `https://www.bilibili.com/blackboard/newplayer.html?${new URLSearchParams({
      aid: aidMatch[1],
      autoplay: "true",
      danmaku: "true",
      muted: "false",
      highQuality: "true",
    }).toString()}`
  }
  return rawUrl
}

export function VideoPlayer({
  src,
  previewImage,
  width,
  height,
  className = "",
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
  const bilibiliOpenInPage = useSettingsStore((s) => s.settings.general.bilibiliOpenInPage)
  const isBilibiliVideo = /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(src)
  const previewCandidates = useMemo(() => buildPreviewCandidates(previewImage), [previewImage])
  const [previewIndex, setPreviewIndex] = useState(0)
  useEffect(() => {
    setPreviewIndex(0)
  }, [previewImage, src])
  const activePreviewImage = previewCandidates[previewIndex] || ""
  const handlePreviewError = useCallback(() => {
    setPreviewIndex((prev) => {
      const next = prev + 1
      return next < previewCandidates.length ? next : prev
    })
  }, [previewCandidates.length])

  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoError) {
      // Codec not supported - open in browser
      if (src) window.open(src, "_blank")
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
  }, [hasStarted, videoError, src])

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

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    seekToPosition(e.clientX)
  }, [seekToPosition])

  // Global mousemove/mouseup for drag-seeking
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      seekToPosition(e.clientX)
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
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
    return () => window.removeEventListener(PAUSE_INLINE_VIDEOS_EVENT, onPauseAll)
  }, [])

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00"
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  // If it's an embeddable URL (YouTube, etc.), don't render inline - the parent should handle embedding
  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src)

  if (!isDirectVideo) {
    const bilibiliPageUrl = isBilibiliVideo ? normalizeBilibiliVideoUrl(src) : null
    const bilibiliPlayerUrl = isBilibiliVideo ? buildBilibiliInAppPlayerUrl(src) : null
    const bilibiliWebviewUrl = isBilibiliVideo
      ? (bilibiliOpenInPage ? bilibiliPageUrl : bilibiliPlayerUrl)
      : null

    return (
      <>
        <div
          className={`relative bg-black rounded-lg overflow-hidden cursor-pointer group ${className}`}
          style={{ width, height }}
          onClick={async (e) => {
            e.stopPropagation()
            if (isBilibiliVideo) {
              if (bilibiliOpenInPage && bilibiliPageUrl && onOpenBilibiliInPage) {
                onOpenBilibiliInPage(bilibiliPageUrl)
                return
              }
              setShowBilibiliModal(true)
              return
            }
            window.open(src, "_blank")
          }}
        >
          {activePreviewImage ? (
            <img
              src={activePreviewImage}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePreviewError}
            />
          ) : (
            <div className="w-full h-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <Play size={20} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        </div>
        {showBilibiliModal && isBilibiliVideo && bilibiliWebviewUrl && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-8"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowBilibiliModal(false)
            }}
          >
            <div className="w-full max-w-5xl aspect-video" onClick={(e) => e.stopPropagation()}>
              <webview
                src={bilibiliWebviewUrl}
                className="w-full h-full rounded-xl bg-black"
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
      className={`relative bg-black rounded-lg overflow-hidden group ${className}`}
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
          className="w-full h-full object-contain"
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
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePreviewError}
            />
          ) : (
            <div className="w-full h-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          )}
        </>
      )}

      {/* Error overlay - unsupported codec, offer to open in browser */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-2 cursor-pointer">
          <ExternalLink size={20} />
          <span className="text-xs opacity-80">格式不支持，点击在浏览器中打开</span>
        </div>
      )}

      {/* Play overlay - shown when not actively playing and no error */}
      {!isPlaying && !videoError && !isStarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer">
          <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <Play size={24} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Controls overlay - always visible when playing, interactive progress bar */}
      {hasStarted && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 transition-opacity ${
            isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {/* Seekable progress bar */}
          <div
            ref={progressRef}
            className="w-full h-3 flex items-center cursor-pointer mb-1"
            onMouseDown={handleProgressMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full h-1 bg-white/30 rounded-full relative hover:h-1.5 transition-all">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${progress}%` }}
              />
              {/* Drag handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlay}
                className="text-white hover:text-white/80 transition-colors"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="white" />}
              </button>
              <button
                onClick={toggleMute}
                className="text-white hover:text-white/80 transition-colors"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <span className="text-white/70 text-[11px] tabular-nums select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-white/80 transition-colors"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

