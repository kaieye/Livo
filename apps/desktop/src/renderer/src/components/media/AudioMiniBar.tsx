/**
 * AudioMiniBar — global floating mini player (productized CornerPlayer).
 *
 * Pure view bound to the player store + AudioPlaybackService: it renders track
 * metadata (cover, title, source), a scrubber, transport controls, queue
 * skip, unified speed control, mute and download. All playback state lives in
 * the store, so the bar persists across view changes.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  Volume2,
  VolumeX,
  X,
  Download,
  Music,
} from 'lucide-react'

import { usePlayerStore } from '../../store/player-store'
import { SPEED_OPTIONS, formatPlaybackTime } from '../../lib/audio-playback'
import { useStoreShallow } from '../../store/helpers'

export function AudioMiniBar() {
  const { t } = useTranslation()
  const [showRateMenu, setShowRateMenu] = useState(false)

  const state = useStoreShallow(usePlayerStore, (s) => ({
    type: s.type,
    title: s.title,
    feedTitle: s.feedTitle,
    cover: s.cover,
    url: s.url,
    isVisible: s.isVisible,
    isPlaying: s.isPlaying,
    currentTime: s.currentTime,
    duration: s.duration,
    playbackRate: s.playbackRate,
    muted: s.muted,
    queueLength: s.queue.length,
  }))
  const hasNext = usePlayerStore((s) => s.hasNext())
  const hasPrevious = usePlayerStore((s) => s.hasPrevious())
  const actions = useStoreShallow(usePlayerStore, (s) => ({
    togglePlay: s.togglePlay,
    seekTo: s.seekTo,
    seekBy: s.seekBy,
    setRate: s.setRate,
    toggleMuted: s.toggleMuted,
    next: s.next,
    previous: s.previous,
    stop: s.stop,
  }))

  if (!state.isVisible || !state.url || state.type !== 'audio') return null

  const progressPct =
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
  const showQueueControls = state.queueLength > 1

  return (
    <div className="animate-in fixed bottom-4 right-4 z-50 w-[340px] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-surface-dark-secondary">
      {/* Track info */}
      <div className="flex items-center gap-3 px-4 pb-1 pt-3">
        {state.cover ? (
          <img
            src={state.cover}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <Music size={18} className="text-text-tertiary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{state.title}</h4>
          <p className="truncate text-xs text-text-tertiary">
            {state.feedTitle}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-1 px-4">
        <input
          type="range"
          min={0}
          max={state.duration || 0}
          value={state.currentTime}
          onChange={(e) => actions.seekTo(parseFloat(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-tertiary accent-accent dark:bg-surface-dark-tertiary"
          style={{
            background: `linear-gradient(to right, var(--color-accent) ${progressPct}%, var(--color-surface-tertiary, #e5e5e5) ${progressPct}%)`,
          }}
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-text-tertiary">
          <span>{formatPlaybackTime(state.currentTime)}</span>
          <span>{formatPlaybackTime(state.duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-1">
        {showQueueControls && (
          <button
            onClick={actions.previous}
            disabled={!hasPrevious}
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary disabled:opacity-30 dark:hover:bg-surface-dark-tertiary"
            title={t('media.previousTrack')}
          >
            <ChevronFirst size={16} />
          </button>
        )}
        <button
          onClick={() => actions.seekBy(-10)}
          className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          title={t('media.rewind10')}
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={actions.togglePlay}
          className="rounded-full bg-accent p-2.5 text-white transition-colors hover:bg-accent-hover"
        >
          {state.isPlaying ? (
            <Pause size={18} />
          ) : (
            <Play size={18} className="ml-0.5" />
          )}
        </button>
        <button
          onClick={() => actions.seekBy(10)}
          className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          title={t('media.forward10')}
        >
          <SkipForward size={16} />
        </button>
        {showQueueControls && (
          <button
            onClick={actions.next}
            disabled={!hasNext}
            className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary disabled:opacity-30 dark:hover:bg-surface-dark-tertiary"
            title={t('media.nextTrack')}
          >
            <ChevronLast size={16} />
          </button>
        )}

        <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />

        {/* Playback rate (unified SPEED_OPTIONS) */}
        <div className="relative">
          <button
            onClick={() => setShowRateMenu(!showRateMenu)}
            className="rounded px-1.5 py-1 font-mono text-xs transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            title={t('media.playbackSpeed')}
          >
            {state.playbackRate}x
          </button>
          {showRateMenu && (
            <div className="absolute bottom-full left-1/2 mb-1 min-w-[48px] -translate-x-1/2 rounded-lg border bg-white py-1 shadow-lg dark:bg-surface-dark-secondary">
              {SPEED_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    actions.setRate(r)
                    setShowRateMenu(false)
                  }}
                  className={`block w-full px-2 py-1 text-center text-xs hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary ${
                    r === state.playbackRate ? 'font-medium text-accent' : ''
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Volume */}
        <button
          onClick={actions.toggleMuted}
          className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          title={state.muted ? t('media.unmute') : t('media.mute')}
        >
          {state.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Download */}
        <button
          onClick={() => {
            if (!state.url) return
            void window.api.app.downloadUrl({
              url: state.url,
              suggestedFileName: state.title || 'audio',
              title: t('media.download'),
            })
          }}
          className="rounded-lg p-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          title={t('media.download')}
        >
          <Download size={16} />
        </button>

        {/* Close */}
        <button
          onClick={actions.stop}
          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          title={t('media.closePlayer')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
