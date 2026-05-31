import { describe, expect, it, vi } from 'vitest'
import {
  AudioPlaybackService,
  formatPlaybackTime,
  nextSpeed,
  SPEED_OPTIONS,
  type MediaElementLike,
} from './audio-playback'

/** Minimal fake of the media element that records event listeners so tests can fire them. */
function createFakeElement() {
  const listeners: Record<string, Array<() => void>> = {}
  const el: MediaElementLike & {
    fire: (type: string) => void
    playCalls: number
    pauseCalls: number
  } = {
    src: '',
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    paused: true,
    playCalls: 0,
    pauseCalls: 0,
    play() {
      this.paused = false
      this.playCalls++
    },
    pause() {
      this.paused = true
      this.pauseCalls++
    },
    addEventListener(type, cb) {
      ;(listeners[type] ??= []).push(cb)
    },
    removeEventListener(type, cb) {
      listeners[type] = (listeners[type] ?? []).filter((fn) => fn !== cb)
    },
    fire(type) {
      for (const cb of listeners[type] ?? []) cb()
    },
  }
  return el
}

describe('formatPlaybackTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatPlaybackTime(0)).toBe('0:00')
    expect(formatPlaybackTime(65)).toBe('1:05')
    expect(formatPlaybackTime(600)).toBe('10:00')
  })

  it('tolerates NaN / Infinity / negatives', () => {
    expect(formatPlaybackTime(NaN)).toBe('0:00')
    expect(formatPlaybackTime(Infinity)).toBe('0:00')
    expect(formatPlaybackTime(-5)).toBe('0:00')
  })
})

describe('nextSpeed', () => {
  it('cycles through the unified speed options and wraps', () => {
    expect(nextSpeed(0.5)).toBe(0.75)
    expect(nextSpeed(1)).toBe(1.25)
    expect(nextSpeed(2)).toBe(SPEED_OPTIONS[0])
  })

  it('falls back to normal speed (1x) for unknown speeds', () => {
    expect(nextSpeed(3)).toBe(1)
  })
})

describe('AudioPlaybackService', () => {
  it('loads and autoplays a track, applying current rate/volume', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    svc.setRate(1.5)
    svc.load('https://x/a.mp3')
    expect(el.src).toBe('https://x/a.mp3')
    expect(el.playbackRate).toBe(1.5)
    expect(el.playCalls).toBe(1)
  })

  it('does not autoplay when asked not to', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    svc.load('https://x/a.mp3', false)
    expect(el.playCalls).toBe(0)
  })

  it('emits snapshots on element events', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    const seen: number[] = []
    svc.subscribe((s) => seen.push(s.currentTime))
    svc.load('https://x/a.mp3', false)
    el.currentTime = 42
    el.fire('timeupdate')
    expect(svc.getSnapshot().currentTime).toBe(42)
    expect(seen).toContain(42)

    el.duration = 100
    el.fire('loadedmetadata')
    expect(svc.getSnapshot().duration).toBe(100)
  })

  it('tracks play/pause state from element events', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    svc.load('https://x/a.mp3', false)
    el.fire('play')
    expect(svc.getSnapshot().isPlaying).toBe(true)
    el.fire('pause')
    expect(svc.getSnapshot().isPlaying).toBe(false)
  })

  it('clamps seek to [0, duration]', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    svc.load('https://x/a.mp3', false)
    el.duration = 30
    el.fire('loadedmetadata')
    svc.seekTo(999)
    expect(el.currentTime).toBe(30)
    svc.seekTo(-10)
    expect(el.currentTime).toBe(0)
  })

  it('mutes by zeroing element volume without losing the stored level', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    svc.load('https://x/a.mp3', false)
    svc.setVolume(0.6)
    svc.setMuted(true)
    expect(el.volume).toBe(0)
    expect(svc.getSnapshot().volume).toBe(0.6)
    svc.setMuted(false)
    expect(el.volume).toBe(0.6)
  })

  it('fires the ended handler when a track finishes', () => {
    const el = createFakeElement()
    const svc = new AudioPlaybackService(() => el)
    const onEnded = vi.fn()
    svc.onTrackEnded(onEnded)
    svc.load('https://x/a.mp3', false)
    el.fire('ended')
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(svc.getSnapshot().isPlaying).toBe(false)
  })
})
