import type { MouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { usePlayerStore } from '../../media/MediaPlayer'
import { formatMediaDuration } from './entry-content-utils'

export function AudioPlaybackPanel({
  title,
  duration,
  playLabel,
  onPlay,
  audioUrl,
  listenProgress,
}: {
  title: string
  duration?: number
  playLabel: string
  onPlay: () => void
  audioUrl: string
  listenProgress?: number
}) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const playerDuration = usePlayerStore((s) => s.duration)
  const playerUrl = usePlayerStore((s) => s.url)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const seekTo = usePlayerStore((s) => s.seekTo)

  const isCurrentTrack = playerUrl === audioUrl
  const effectiveDuration = isCurrentTrack ? playerDuration : duration || 0
  const progress =
    effectiveDuration > 0
      ? ((isCurrentTrack ? currentTime : 0) / effectiveDuration) * 100
      : 0
  const savedProgress = !isCurrentTrack && listenProgress ? listenProgress : 0
  const displayProgress = isCurrentTrack ? progress : savedProgress
  const durationText = formatMediaDuration(effectiveDuration)
  const currentText = formatMediaDuration(isCurrentTrack ? currentTime : 0)
  const resumeTime =
    listenProgress && effectiveDuration
      ? formatMediaDuration((listenProgress / 100) * effectiveDuration)
      : null

  const handleClick = () => {
    if (isCurrentTrack) {
      togglePlay()
    } else {
      onPlay()
    }
  }

  const handleSeek = (e: MouseEvent<HTMLDivElement>) => {
    if (!isCurrentTrack || !effectiveDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(pct * effectiveDuration)
  }

  return (
    <div className="border-border/70 bg-surface-secondary/70 dark:border-border-dark/70 dark:bg-surface-dark-secondary/70 mb-6 overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={handleClick}
        className="hover:bg-surface-tertiary/50 dark:hover:bg-surface-dark-tertiary/50 flex w-full items-center gap-3 px-3 py-3 text-left transition-colors"
      >
        <span className="bg-accent flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white">
          {isCurrentTrack && isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-text dark:text-text-dark-primary block text-sm font-medium">
            {!isCurrentTrack && resumeTime
              ? `继续播放 ${resumeTime}`
              : playLabel}
          </span>
          <span className="text-text-secondary dark:text-text-dark-secondary block truncate text-xs">
            {title}
          </span>
        </span>
        {durationText && (
          <span className="text-text-tertiary dark:text-text-dark-tertiary flex-shrink-0 text-xs tabular-nums">
            {currentText} / {durationText}
          </span>
        )}
      </button>
      <div
        className="bg-surface-tertiary dark:bg-surface-dark-tertiary group relative h-1 cursor-pointer"
        onClick={handleSeek}
      >
        <div
          className="bg-accent absolute left-0 top-0 h-full transition-[width] duration-150"
          style={{ width: `${displayProgress}%` }}
        />
        <div
          className="bg-accent absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>
    </div>
  )
}
