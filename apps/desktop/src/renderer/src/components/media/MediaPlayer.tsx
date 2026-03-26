/**
 * Media Player component — audio/video player with controls.
 * Supports a compact corner audio player.
 * and inline video player for video entries.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
} from 'lucide-react'
import { create } from 'zustand'
import { useSettingsStore } from '../../store/settings-store'
import {
  buildBilibiliInAppPlayerUrl,
  normalizeBilibiliVideoUrl,
} from '../../lib/bilibili-video'

// ====== Player Store ======
interface PlayOptions {
  url: string
  type?: 'audio' | 'video'
  title?: string
  artist?: string
  feedTitle?: string
  cover?: string
}

interface PlayerState {
  /** Currently playing media URL */
  url: string | null
  type: 'audio' | 'video'
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
  type: 'audio',
  title: '',
  feedTitle: '',
  cover: '',
  isVisible: false,

  play: (options: PlayOptions) =>
    set({
      url: options.url,
      type: options.type || 'audio',
      title: options.title || '',
      feedTitle: options.artist || options.feedTitle || '',
      cover: options.cover || '',
      isVisible: true,
    }),
  stop: () =>
    set({ url: null, isVisible: false, title: '', feedTitle: '', cover: '' }),
  hide: () => set({ isVisible: false }),
}))

// ====== Corner Audio Player ======
export function CornerPlayer() {
  const { url, type, title, feedTitle, isVisible, stop } = usePlayerStore()
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume] = useState(1)
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

  const seek = useCallback(
    (seconds: number) => {
      if (!audioRef.current) return
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(audioRef.current.currentTime + seconds, duration),
      )
    },
    [duration],
  )

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

  const handleSeekBar = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
      if (audioRef.current) {
        audioRef.current.currentTime = time
      }
      setCurrentTime(time)
    },
    [],
  )

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setIsPlaying(false)
    stop()
  }, [stop])

  const handleDownload = useCallback(() => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = title || 'audio'
    a.target = '_blank'
    a.click()
  }, [url, title])

  if (!isVisible || !url || type !== 'audio') return null

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
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

      <div className="animate-in fixed bottom-4 right-4 z-50 w-[340px] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-surface-dark-secondary">
        {/* Track info */}
        <div className="px-4 pb-1 pt-3">
          <h4 className="truncate text-sm font-medium">{title}</h4>
          <p className="truncate text-xs text-text-tertiary">{feedTitle}</p>
        </div>

        {/* Progress bar */}
        <div className="mt-1 px-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeekBar}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-tertiary accent-accent dark:bg-surface-dark-tertiary"
            style={{
              background: `linear-gradient(to right, var(--color-accent) ${(currentTime / (duration || 1)) * 100}%, var(--color-surface-tertiary, #e5e5e5) ${(currentTime / (duration || 1)) * 100}%)`,
            }}
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-text-tertiary">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-1">
          <button
            onClick={() => seek(-10)}
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            title={t('media.rewind10')}
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="rounded-full bg-accent p-2.5 text-white transition-colors hover:bg-accent-hover"
          >
            {isPlaying ? (
              <Pause size={18} />
            ) : (
              <Play size={18} className="ml-0.5" />
            )}
          </button>
          <button
            onClick={() => seek(10)}
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            title={t('media.forward10')}
          >
            <SkipForward size={16} />
          </button>

          <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />

          {/* Playback rate */}
          <div className="relative">
            <button
              onClick={() => setShowRateMenu(!showRateMenu)}
              className="rounded px-1.5 py-1 font-mono text-xs transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              title={t('media.playbackSpeed')}
            >
              {playbackRate}x
            </button>
            {showRateMenu && (
              <div className="absolute bottom-full left-1/2 mb-1 min-w-[48px] -translate-x-1/2 rounded-lg border bg-white py-1 shadow-lg dark:bg-surface-dark-secondary">
                {rates.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setPlaybackRate(r)
                      setShowRateMenu(false)
                    }}
                    className={`block w-full px-2 py-1 text-center text-xs hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary ${r === playbackRate ? 'font-medium text-accent' : ''}`}
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
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            title={isMuted ? t('media.unmute') : t('media.mute')}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            title={t('media.download')}
          >
            <Download size={16} />
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            title={t('media.closePlayer')}
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
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
  )
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
  const bilibiliOpenInPage = useSettingsStore(
    (s) => s.settings.general.bilibiliOpenInPage,
  )
  const isBilibiliVideo = /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)
  const shouldUseBilibiliWebview = isBilibiliVideo && !bilibiliOpenInPage

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
              onClick={() => setShowModal(false)}
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
