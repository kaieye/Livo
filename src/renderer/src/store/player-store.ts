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
  /** Associated entry ID for persisting listen progress. */
  entryId?: string
}

/** Options accepted by `play` — backward compatible with the old PlayOptions. */
export interface PlayOptions {
  url: string
  type?: 'audio' | 'video'
  title?: string
  artist?: string
  feedTitle?: string
  cover?: string
  /** Associated entry ID for persisting listen progress. */
  entryId?: string
  /** Saved listen progress percentage (0-100) for resume. */
  listenProgress?: number
}

function toTrack(options: PlayOptions): AudioTrack {
  return {
    url: options.url,
    type: options.type || 'audio',
    title: options.title || '',
    feedTitle: options.artist || options.feedTitle || '',
    cover: options.cover || '',
    entryId: options.entryId,
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
  /** Entry ID of the currently playing track, for progress persistence. */
  currentEntryId: string | null

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
  // Debounced listen-progress persistence
  let progressSaveTimer: ReturnType<typeof setTimeout> | null = null
  let lastSavedEntryId: string | null = null
  let lastSavedProgress = -1

  function flushListenProgress(): void {
    const { currentEntryId, currentTime, duration } = get()
    if (!currentEntryId || duration <= 0) return
    const pct = Math.round((currentTime / duration) * 100)
    if (currentEntryId === lastSavedEntryId && pct === lastSavedProgress) return
    lastSavedEntryId = currentEntryId
    lastSavedProgress = pct
    window.api.entries.saveListenProgress(currentEntryId, pct).catch(() => {})
  }

  function scheduleProgressSave(): void {
    if (progressSaveTimer) clearTimeout(progressSaveTimer)
    progressSaveTimer = setTimeout(flushListenProgress, 5000)
  }

  // Bridge: reflect playback snapshots into the store so views re-render.
  audioPlayback.subscribe((snapshot) => {
    set({
      isPlaying: snapshot.isPlaying,
      currentTime: snapshot.currentTime,
      duration: snapshot.duration,
      playbackRate: snapshot.playbackRate,
      muted: snapshot.muted,
    })
    // Persist listen progress while playing
    if (snapshot.isPlaying && snapshot.duration > 0 && get().currentEntryId) {
      scheduleProgressSave()
    }
  })

  // Advance the queue automatically when a track ends.
  audioPlayback.onTrackEnded(() => {
    // Mark current entry as listened before advancing
    const { currentEntryId } = get()
    if (currentEntryId) {
      window.api.entries.markListened(currentEntryId, true).catch(() => {})
      window.api.entries.saveListenProgress(currentEntryId, 100).catch(() => {})
    }
    if (get().hasNext()) get().next()
  })

  function activate(track: AudioTrack, listenProgress?: number): void {
    set({
      url: track.url,
      type: track.type || 'audio',
      title: track.title,
      feedTitle: track.feedTitle,
      cover: track.cover,
      isVisible: true,
      currentEntryId: track.entryId || null,
    })
    // Only audio is driven by the playback service; video is handled inline.
    if ((track.type || 'audio') === 'audio') {
      audioPlayback.load(track.url, true)
      // Resume from saved position
      if (listenProgress && listenProgress > 0 && listenProgress < 100) {
        // Wait for metadata to load then seek
        const unsubscribe = audioPlayback.subscribe((snap) => {
          if (snap.duration > 0) {
            unsubscribe()
            const seekTime = (listenProgress / 100) * snap.duration
            audioPlayback.seekTo(seekTime)
          }
        })
      }
    }
  }

  return {
    url: null,
    type: 'audio',
    title: '',
    feedTitle: '',
    cover: '',
    isVisible: false,
    currentEntryId: null,

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
      activate(track, options.listenProgress)
    },

    playQueue: (tracks, startIndex = 0) => {
      if (tracks.length === 0) return
      const queue = tracks.map(toTrack)
      const index = Math.max(0, Math.min(startIndex, queue.length - 1))
      set({ queue, queueIndex: index })
      activate(queue[index], tracks[index].listenProgress)
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
      // Flush any pending progress before stopping
      flushListenProgress()
      audioPlayback.stop()
      set({
        url: null,
        isVisible: false,
        title: '',
        feedTitle: '',
        cover: '',
        currentEntryId: null,
        queue: [],
        queueIndex: -1,
      })
    },

    hide: () => set({ isVisible: false }),
  }
})
