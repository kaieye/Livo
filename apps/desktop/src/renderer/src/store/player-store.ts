import { create } from 'zustand'

import { audioPlayback } from '../lib/audio-playback'

/** A single playable audio track with its display metadata. */
export interface AudioTrack {
  url: string
  type?: 'audio' | 'video'
  title: string
  /** Source label — feed/show/artist name. */
  feedTitle: string
  /** Cover/artwork URL. */
  cover: string
}

/** Options accepted by `play` — backward compatible with the old PlayOptions. */
export interface PlayOptions {
  url: string
  type?: 'audio' | 'video'
  title?: string
  artist?: string
  feedTitle?: string
  cover?: string
}

function toTrack(options: PlayOptions): AudioTrack {
  return {
    url: options.url,
    type: options.type || 'audio',
    title: options.title || '',
    feedTitle: options.artist || options.feedTitle || '',
    cover: options.cover || '',
  }
}

interface PlayerState {
  // Current track metadata
  url: string | null
  type: 'audio' | 'video'
  title: string
  feedTitle: string
  cover: string
  isVisible: boolean

  // Queue
  queue: AudioTrack[]
  queueIndex: number

  // Playback state (mirrored from AudioPlaybackService)
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  muted: boolean

  // Actions
  play: (options: PlayOptions) => void
  playQueue: (tracks: PlayOptions[], startIndex?: number) => void
  next: () => void
  previous: () => void
  hasNext: () => boolean
  hasPrevious: () => boolean
  togglePlay: () => void
  seekTo: (time: number) => void
  seekBy: (delta: number) => void
  setRate: (rate: number) => void
  toggleMuted: () => void
  stop: () => void
  hide: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // Bridge: reflect playback snapshots into the store so views re-render.
  audioPlayback.subscribe((snapshot) => {
    set({
      isPlaying: snapshot.isPlaying,
      currentTime: snapshot.currentTime,
      duration: snapshot.duration,
      playbackRate: snapshot.playbackRate,
      muted: snapshot.muted,
    })
  })

  // Advance the queue automatically when a track ends.
  audioPlayback.onTrackEnded(() => {
    if (get().hasNext()) get().next()
  })

  function activate(track: AudioTrack): void {
    set({
      url: track.url,
      type: track.type || 'audio',
      title: track.title,
      feedTitle: track.feedTitle,
      cover: track.cover,
      isVisible: true,
    })
    // Only audio is driven by the playback service; video is handled inline.
    if ((track.type || 'audio') === 'audio') {
      audioPlayback.load(track.url, true)
    }
  }

  return {
    url: null,
    type: 'audio',
    title: '',
    feedTitle: '',
    cover: '',
    isVisible: false,

    queue: [],
    queueIndex: -1,

    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    muted: false,

    play: (options) => {
      const track = toTrack(options)
      set({ queue: [track], queueIndex: 0 })
      activate(track)
    },

    playQueue: (tracks, startIndex = 0) => {
      if (tracks.length === 0) return
      const queue = tracks.map(toTrack)
      const index = Math.max(0, Math.min(startIndex, queue.length - 1))
      set({ queue, queueIndex: index })
      activate(queue[index])
    },

    next: () => {
      const { queue, queueIndex } = get()
      if (queueIndex < queue.length - 1) {
        const index = queueIndex + 1
        set({ queueIndex: index })
        activate(queue[index])
      }
    },

    previous: () => {
      const { queue, queueIndex } = get()
      if (queueIndex > 0) {
        const index = queueIndex - 1
        set({ queueIndex: index })
        activate(queue[index])
      }
    },

    hasNext: () => {
      const { queue, queueIndex } = get()
      return queueIndex >= 0 && queueIndex < queue.length - 1
    },

    hasPrevious: () => get().queueIndex > 0,

    togglePlay: () => audioPlayback.toggle(),
    seekTo: (time) => audioPlayback.seekTo(time),
    seekBy: (delta) => audioPlayback.seekBy(delta),
    setRate: (rate) => audioPlayback.setRate(rate),
    toggleMuted: () => audioPlayback.setMuted(!get().muted),

    stop: () => {
      audioPlayback.stop()
      set({
        url: null,
        isVisible: false,
        title: '',
        feedTitle: '',
        cover: '',
        queue: [],
        queueIndex: -1,
      })
    },

    hide: () => set({ isVisible: false }),
  }
})
