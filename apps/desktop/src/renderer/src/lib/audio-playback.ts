/**
 * AudioPlaybackService — the desktop equivalent of Harmony's
 * `AudioPlaybackService`.
 *
 * Owns a single (detached) media element so audio keeps playing as the user
 * navigates between views, and exposes an imperative control surface plus a
 * snapshot subscription. The element is created lazily and can be injected for
 * tests, so the playback logic (rate/seek/state emission) is unit testable
 * without a DOM.
 *
 * The zustand player store wraps this service: the service owns *playback*
 * (element + time/duration/playing), the store owns *metadata* (track, queue,
 * cover, source).
 */

/** Allowed playback speeds, shared across the UI (10.3 unified speed control). */
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number]

/** Cycle to the next speed in {@link SPEED_OPTIONS}, wrapping around. */
export function nextSpeed(current: number): PlaybackSpeed {
  const idx = SPEED_OPTIONS.findIndex((s) => s === current)
  // Unknown speeds fall back to 1x (index 2), the normal-speed default.
  const next = idx === -1 ? 2 : (idx + 1) % SPEED_OPTIONS.length
  return SPEED_OPTIONS[next]
}

/** Format seconds as `m:ss`, tolerating NaN/Infinity. */
export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface AudioPlaybackSnapshot {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  volume: number
  muted: boolean
}

/** Minimal media-element surface the service depends on (subset of HTMLAudioElement). */
export interface MediaElementLike {
  src: string
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playbackRate: number
  paused: boolean
  play(): Promise<void> | void
  pause(): void
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

type Listener = (snapshot: AudioPlaybackSnapshot) => void

const INITIAL_SNAPSHOT: AudioPlaybackSnapshot = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  muted: false,
}

export class AudioPlaybackService {
  private el: MediaElementLike | null = null
  private readonly factory: () => MediaElementLike
  private readonly listeners = new Set<Listener>()
  private snapshot: AudioPlaybackSnapshot = { ...INITIAL_SNAPSHOT }
  /** Fired when the current track ends (used by the store to advance the queue). */
  private endedHandler: (() => void) | null = null

  constructor(factory?: () => MediaElementLike) {
    this.factory = factory ?? (() => new Audio() as unknown as MediaElementLike)
  }

  private ensureElement(): MediaElementLike {
    if (this.el) return this.el
    const el = this.factory()
    el.addEventListener('timeupdate', this.onTimeUpdate)
    el.addEventListener('loadedmetadata', this.onLoadedMetadata)
    el.addEventListener('durationchange', this.onLoadedMetadata)
    el.addEventListener('play', this.onPlay)
    el.addEventListener('pause', this.onPause)
    el.addEventListener('ended', this.onEnded)
    this.el = el
    return el
  }

  private onTimeUpdate = () => {
    if (!this.el) return
    this.update({ currentTime: this.el.currentTime })
  }

  private onLoadedMetadata = () => {
    if (!this.el) return
    this.update({ duration: this.el.duration })
  }

  private onPlay = () => this.update({ isPlaying: true })
  private onPause = () => this.update({ isPlaying: false })

  private onEnded = () => {
    this.update({ isPlaying: false })
    this.endedHandler?.()
  }

  private update(patch: Partial<AudioPlaybackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }

  /** Load (and by default start) a track from a URL. */
  load(url: string, autoplay = true): void {
    const el = this.ensureElement()
    el.src = url
    el.playbackRate = this.snapshot.playbackRate
    el.volume = this.snapshot.muted ? 0 : this.snapshot.volume
    this.update({ currentTime: 0, duration: 0 })
    if (autoplay) void el.play()
  }

  play(): void {
    if (!this.el) return
    void this.el.play()
  }

  pause(): void {
    this.el?.pause()
  }

  toggle(): void {
    if (!this.el) return
    if (this.el.paused) this.play()
    else this.pause()
  }

  /** Seek to an absolute time (seconds), clamped to [0, duration]. */
  seekTo(time: number): void {
    if (!this.el) return
    const max = this.el.duration || this.snapshot.duration || 0
    const next = Math.max(0, Math.min(time, max || time))
    this.el.currentTime = next
    this.update({ currentTime: next })
  }

  /** Seek by a relative offset (seconds). */
  seekBy(delta: number): void {
    if (!this.el) return
    this.seekTo(this.el.currentTime + delta)
  }

  setRate(rate: number): void {
    this.update({ playbackRate: rate })
    if (this.el) this.el.playbackRate = rate
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(volume, 1))
    this.update({ volume: v })
    if (this.el) this.el.volume = this.snapshot.muted ? 0 : v
  }

  setMuted(muted: boolean): void {
    this.update({ muted })
    if (this.el) this.el.volume = muted ? 0 : this.snapshot.volume
  }

  /** Stop playback and release the source. */
  stop(): void {
    if (this.el) {
      this.el.pause()
      this.el.src = ''
    }
    this.update({ isPlaying: false, currentTime: 0, duration: 0 })
  }

  /** Register a callback fired when the current track ends. */
  onTrackEnded(handler: (() => void) | null): void {
    this.endedHandler = handler
  }

  getSnapshot(): AudioPlaybackSnapshot {
    return this.snapshot
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

/** Shared singleton used by the player store and the AudioMiniBar. */
export const audioPlayback = new AudioPlaybackService()
