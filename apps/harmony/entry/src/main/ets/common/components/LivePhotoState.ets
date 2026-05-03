import { PictureCarouselMediaItem } from '../utils/PictureGallery'

interface MediaSize {
  width: number
  height: number
}

export interface LivePhotoEvents {
  onPrepared: (index: number) => void
  onStart: (index: number) => void
  onPause: (index: number) => void
  onStop: (index: number) => void
  onError: (index: number) => void
}

export class LivePhotoState {
  private controllers: VideoController[] = []
  private preparedIndices: number[] = []
  private instanceSeeds: number[] = []
  private aspectRatios: number[] = []
  private mediaSizes: MediaSize[] = []

  playingIndex: number = -1
  pausedIndex: number = -1
  isNearlyVisible: boolean = false
  muted: boolean = true

  private callbacks: LivePhotoEvents

  constructor(callbacks: LivePhotoEvents) {
    this.callbacks = callbacks
  }

  controllerFor(index: number): VideoController {
    if (!this.controllers[index]) {
      this.controllers[index] = new VideoController()
    }
    return this.controllers[index]
  }

  currentItem(items: PictureCarouselMediaItem[], activeIndex: number): PictureCarouselMediaItem | undefined {
    const item = items[activeIndex]
    return item?.kind === 'livePhoto' && item.videoUrl ? item : undefined
  }

  isLivePhotoItem(items: PictureCarouselMediaItem[], index: number): boolean {
    const item = items[index]
    return item?.kind === 'livePhoto' && !!item.videoUrl
  }

  isPrepared(index: number): boolean {
    return this.preparedIndices.includes(index)
  }

  mountedIndices(items: PictureCarouselMediaItem[], activeIndex: number): number[] {
    const mounted = new Set<number>()
    const currentItem = this.currentItem(items, activeIndex)
    if (currentItem) {
      mounted.add(activeIndex)
    }
    this.preparedIndices.forEach((i: number) => mounted.add(i))
    if (this.playingIndex >= 0) mounted.add(this.playingIndex)
    if (this.pausedIndex >= 0) mounted.add(this.pausedIndex)
    return Array.from(mounted.values())
  }

  shouldShowPlaying(index: number): boolean {
    return this.playingIndex === index && this.isPrepared(index)
  }

  shouldShowPaused(index: number): boolean {
    return this.pausedIndex === index && this.isPrepared(index)
  }

  shouldWarm(index: number, activeIndex: number, items: PictureCarouselMediaItem[]): boolean {
    return this.isNearlyVisible && activeIndex === index && this.isLivePhotoItem(items, index)
  }

  shouldShowLoading(items: PictureCarouselMediaItem[], index: number, activeIndex: number): boolean {
    return this.isLivePhotoItem(items, index) && activeIndex === index && this.isNearlyVisible && !this.isPrepared(index)
  }

  instanceSeed(index: number): number {
    return this.instanceSeeds[index] ?? 0
  }

  aspectRatio(index: number): number {
    const ratio = this.aspectRatios[index]
    return ratio && ratio > 0 ? ratio : 4 / 5
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  isMuted(): boolean {
    return this.muted
  }

  syncPlayback(items: PictureCarouselMediaItem[], index: number): void {
    const item = this.currentItem(items, index)
    if (!item) {
      this.playingIndex = -1
      this.pausedIndex = -1
      return
    }
    if (!this.isNearlyVisible) {
      this.pauseItem(index)
      return
    }
    if (this.isPrepared(index)) {
      this.pausedIndex = -1
      this.playingIndex = index
      try {
        this.controllerFor(index).start()
      } catch (_) {}
      return
    }
    this.pausedIndex = -1
    this.playingIndex = -1
  }

  handlePrepared(items: PictureCarouselMediaItem[], index: number): void {
    this.markPrepared(index)
    if (this.isNearlyVisible) {
      this.pausedIndex = -1
      this.playingIndex = index
      try {
        this.controllerFor(index).start()
      } catch (_) {}
    }
    this.callbacks.onPrepared(index)
  }

  handleStart(index: number): void {
    this.markPrepared(index)
    if (this.pausedIndex === index) {
      this.pausedIndex = -1
    }
    if (this.isNearlyVisible) {
      this.playingIndex = index
    }
    this.callbacks.onStart(index)
  }

  handlePause(index: number): void {
    if (this.isPrepared(index)) {
      this.pausedIndex = index
    }
    if (this.playingIndex === index) {
      this.playingIndex = -1
    }
    this.callbacks.onPause(index)
  }

  handleStop(index: number): void {
    if (this.playingIndex === index) this.playingIndex = -1
    if (this.pausedIndex === index) this.pausedIndex = -1
    this.callbacks.onStop(index)
  }

  handleError(index: number): void {
    this.clearPrepared(index)
    if (this.playingIndex === index) this.playingIndex = -1
    if (this.pausedIndex === index) this.pausedIndex = -1
    this.refreshInstance(index)
    this.callbacks.onError(index)
  }

  stopAll(): void {
    this.playingIndex = -1
    this.pausedIndex = -1
    this.preparedIndices = []
    this.controllers.forEach((controller: VideoController) => {
      try { controller.pause() } catch (_) {}
    })
  }

  private pauseItem(index: number): void {
    this.stopAllControllers()
    try {
      this.controllerFor(index).pause()
      this.pausedIndex = index
    } catch (_) {
      this.pausedIndex = -1
    }
    this.playingIndex = -1
  }

  private stopAllControllers(): void {
    this.controllers.forEach((controller: VideoController) => {
      try { controller.pause() } catch (_) {}
    })
  }

  private clearPrepared(index: number): void {
    if (!this.preparedIndices.includes(index)) return
    this.preparedIndices = this.preparedIndices.filter((v: number) => v !== index)
  }

  private markPrepared(index: number): void {
    if (!this.preparedIndices.includes(index)) {
      this.preparedIndices = [...this.preparedIndices, index]
    }
  }

  private refreshInstance(index: number): void {
    this.clearPrepared(index)
    const nextSeeds = [...this.instanceSeeds]
    nextSeeds[index] = (nextSeeds[index] ?? 0) + 1
    this.instanceSeeds = nextSeeds
  }

  rememberAspectRatio(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.rememberMediaSize(index, width, height)
    const nextRatio = width / height
    const currentRatio = this.aspectRatios[index]
    if (currentRatio && Math.abs(currentRatio - nextRatio) < 0.001) return
    const nextRatios = [...this.aspectRatios]
    nextRatios[index] = nextRatio
    this.aspectRatios = nextRatios
  }

  private rememberMediaSize(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    const nextSizes = [...this.mediaSizes]
    const size: MediaSize = { width, height }
    nextSizes[index] = size
    this.mediaSizes = nextSizes
  }

  frameAspectRatio(items: PictureCarouselMediaItem[]): number {
    const fallbackRatio = 4 / 5
    if (items.length === 0) return fallbackRatio
    let maxArea: number = -1
    let maxAreaIndex: number = 0
    for (let i = 0; i < items.length; i++) {
      const size = this.mediaSizes[i]
      const area = size ? size.width * size.height : -1
      if (area > maxArea) {
        maxArea = area
        maxAreaIndex = i
      }
    }
    if (items[maxAreaIndex]?.kind === 'livePhoto') {
      return this.aspectRatio(maxAreaIndex)
    }
    const defaultItem = items[maxAreaIndex] || items[0]
    if (!defaultItem) return fallbackRatio
    if (defaultItem.kind === 'livePhoto') {
      return this.aspectRatio(maxAreaIndex)
    }
    const measuredSize = this.mediaSizes[maxAreaIndex]
    if (!measuredSize || measuredSize.width <= 0 || measuredSize.height <= 0) {
      return fallbackRatio
    }
    return measuredSize.width / measuredSize.height
  }
}
