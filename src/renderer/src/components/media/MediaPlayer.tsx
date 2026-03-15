/**
 * Media Player component — audio/video player with controls.
 * Supports a compact corner audio player.
 * and inline video player for video entries.
 */
import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  Download,
  Gauge,
} from "lucide-react"
import { create } from "zustand"
import { useSettingsStore } from "../../store/settings-store"

// ====== Player Store ======
interface PlayOptions {
  url: string
  type?: "audio" | "video"
  title?: string
  artist?: string
  feedTitle?: string
  cover?: string
}

interface PlayerState {
  /** Currently playing media URL */
  url: string | null
  type: "audio" | "video"
  title: string
  feedTitle: string
  cover: string
  /** Is player visible (corner mode) */
  isVisible: boolean

  play: (options: PlayOptions) => void
  stop: () => void
  hide: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  url: null,
  type: "audio",
  title: "",
  feedTitle: "",
  cover: "",
  isVisible: false,

  play: (options: PlayOptions) =>
    set({
      url: options.url,
      type: options.type || "audio",
      title: options.title || "",
      feedTitle: options.artist || options.feedTitle || "",
      cover: options.cover || "",
      isVisible: true,
    }),
  stop: () =>
    set({ url: null, isVisible: false, title: "", feedTitle: "", cover: "" }),
  hide: () =>
    set({ isVisible: false }),
}))

// ====== Corner Audio Player ======
export function CornerPlayer() {
  const { url, type, title, feedTitle, isVisible, stop } = usePlayerStore()
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showRateMenu, setShowRateMenu] = useState(false)

  useEffect(() => {
    if (url && audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [url])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const seek = useCallback((seconds: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration))
  }, [duration])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [])

  const handleSeekBar = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
    setCurrentTime(time)
  }, [])

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
    setIsPlaying(false)
    stop()
  }, [stop])

  const handleDownload = useCallback(() => {
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = title || "audio"
    a.target = "_blank"
    a.click()
  }, [url, title])

  if (!isVisible || !url || type !== "audio") return null

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00"
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="fixed bottom-4 right-4 z-50 w-[340px] bg-white dark:bg-surface-dark-secondary rounded-2xl shadow-2xl border overflow-hidden animate-in">
        {/* Track info */}
        <div className="px-4 pt-3 pb-1">
          <h4 className="text-sm font-medium truncate">{title}</h4>
          <p className="text-xs text-text-tertiary truncate">{feedTitle}</p>
        </div>

        {/* Progress bar */}
        <div className="px-4 mt-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeekBar}
            className="w-full h-1 rounded-full appearance-none cursor-pointer accent-accent bg-surface-tertiary dark:bg-surface-dark-tertiary"
            style={{
              background: `linear-gradient(to right, var(--color-accent) ${(currentTime / (duration || 1)) * 100}%, var(--color-surface-tertiary, #e5e5e5) ${(currentTime / (duration || 1)) * 100}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-text-tertiary mt-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-1">
          <button onClick={() => seek(-10)} className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors" title={t("media.rewind10")}>
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="p-2.5 rounded-full bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button onClick={() => seek(10)} className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors" title={t("media.forward10")}>
            <SkipForward size={16} />
          </button>

          <div className="w-px h-5 bg-border dark:bg-border-dark mx-1" />

          {/* Playback rate */}
          <div className="relative">
            <button
              onClick={() => setShowRateMenu(!showRateMenu)}
              className="px-1.5 py-1 rounded text-xs font-mono hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors"
              title={t("media.playbackSpeed")}
            >
              {playbackRate}x
            </button>
            {showRateMenu && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white dark:bg-surface-dark-secondary border rounded-lg shadow-lg py-1 min-w-[48px]">
                {rates.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setPlaybackRate(r); setShowRateMenu(false) }}
                    className={`block w-full text-center px-2 py-1 text-xs hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary ${r === playbackRate ? "text-accent font-medium" : ""}`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors"
            title={isMuted ? t("media.unmute") : t("media.mute")}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors"
            title={t("media.download")}
          >
            <Download size={16} />
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors text-text-tertiary"
            title={t("media.closePlayer")}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

// ====== Inline Video Player ======

/** Transform a video URL into an embeddable iframe URL. */
export function transformVideoUrl(url: string): string | null {
  if (!url) return null

  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (youtubeMatch) {
    return `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}?controls=1&autoplay=0&mute=0`
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

function buildBilibiliInAppPlayerUrl(rawUrl: string, mini = false): string {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) {
    return `https://www.bilibili.com/blackboard/newplayer.html?${new URLSearchParams({
      isOutside: "true",
      autoplay: "true",
      danmaku: "true",
      muted: mini ? "true" : "false",
      highQuality: "true",
      bvid: bvidMatch[1],
    }).toString()}`
  }
  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) {
    return `https://www.bilibili.com/blackboard/newplayer.html?${new URLSearchParams({
      isOutside: "true",
      autoplay: "true",
      danmaku: "true",
      muted: mini ? "true" : "false",
      highQuality: "true",
      aid: aidMatch[1],
    }).toString()}`
  }
  return rawUrl
}

function normalizeBilibiliVideoUrl(rawUrl: string): string {
  const bvidMatch = rawUrl.match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)
  if (bvidMatch?.[1]) return `https://www.bilibili.com/video/${bvidMatch[1]}`

  const aidMatch = rawUrl.match(/(?:\/video\/av|[?&]aid=)(\d+)/i)
  if (aidMatch?.[1]) return `https://www.bilibili.com/video/av${aidMatch[1]}`

  return rawUrl
}

/** Check if a URL is a known video platform */
export function isVideoUrl(url: string): boolean {
  return transformVideoUrl(url) !== null
}

export function VideoPlayer({
  url,
  poster,
  title,
}: {
  url: string
  poster?: string
  title?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const bilibiliOpenInPage = useSettingsStore((s) => s.settings.general.bilibiliOpenInPage)
  const isBilibiliVideo = /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)
  const shouldUseBilibiliWebview = isBilibiliVideo && !bilibiliOpenInPage

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
  }

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
    document.addEventListener("fullscreenchange", handleFS)
    return () => document.removeEventListener("fullscreenchange", handleFS)
  }, [])

  const handleOpenVideo = useCallback(() => {
    setShowModal(true)
  }, [])

  // Try to get an iframe embed URL
  const iframeSrc = transformVideoUrl(url)
  const bilibiliWebviewUrl = shouldUseBilibiliWebview ? buildBilibiliInAppPlayerUrl(url) : null
  const bilibiliPageUrl = isBilibiliVideo && bilibiliOpenInPage ? normalizeBilibiliVideoUrl(url) : null

  if (iframeSrc) {
    return (
      <>
        <div
          className="relative aspect-video rounded-xl overflow-hidden bg-black cursor-pointer group"
          onClick={handleOpenVideo}
        >
          {poster ? (
            <img src={poster} alt="" className="w-full h-full object-cover" />
          ) : (
            <iframe
              src={iframeSrc}
              className="w-full h-full pointer-events-none"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              allowFullScreen
              allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={24} className="text-white ml-1" fill="white" />
            </div>
          </div>
        </div>

        {/* Full-screen video modal */}
        {showModal && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowModal(false)
            }}
          >
            <div className="w-full max-w-5xl aspect-video" onClick={(e) => e.stopPropagation()}>
              {shouldUseBilibiliWebview && bilibiliWebviewUrl ? (
                <webview
                  src={bilibiliWebviewUrl}
                  className="w-full h-full rounded-xl bg-black"
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                />
              ) : bilibiliPageUrl ? (
                <webview
                  src={bilibiliPageUrl}
                  className="w-full h-full rounded-xl bg-black"
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                />
              ) : (
                <iframe
                  src={iframeSrc.replace("autoplay=0", "autoplay=1")}
                  className="w-full h-full rounded-xl"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                  allowFullScreen
                  allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
                />
              )}
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black group">
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
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  )
}
