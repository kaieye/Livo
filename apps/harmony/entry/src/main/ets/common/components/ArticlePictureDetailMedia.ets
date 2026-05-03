import { PictureCarouselMediaItem } from '../utils/PictureGallery'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { showToast, TOAST_DURATION_SHORT } from '../utils/PageToastHelper'
import {
  findFirstLivePhotoIndex,
  findLivePhotoMediaItem,
  findMountedLivePhotoIndices,
  isInitialFirstLivePhoto,
  LIVE_PHOTO_VISIBILITY_THRESHOLD,
  resolveCenteredLivePhotoIndex,
} from '../utils/LivePhotoPlaybackPolicy'
import { ArticleLivePhotoSlide } from './article-picture-detail/ArticleLivePhotoSlide'
import { ArticleStaticImageSlide } from './article-picture-detail/ArticleStaticImageSlide'

@Component
export struct ArticlePictureDetailMedia {
  @Prop mediaItems: PictureCarouselMediaItem[] = []
  @Prop title: string = '图片预览'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State private activeMediaIndex: number = 0
  @State private playingLivePhotoIndex: number = -1
  @State private pausedLivePhotoIndex: number = -1
  @State private preparedLivePhotoIndices: number[] = []
  @State private livePhotoInstanceSeeds: number[] = []
  @State private livePhotoAspectRatios: number[] = []
  @State private livePhotoVisibilityRatios: number[] = []
  @State private livePhotoMuted: boolean = true
  private readonly livePhotoControllers: VideoController[] = []

  private showToast(message: string, duration: number = TOAST_DURATION_SHORT): void {
    showToast(this.getUIContext(), message, duration)
  }

  private controllerFor(index: number): VideoController {
    if (!this.livePhotoControllers[index]) {
      this.livePhotoControllers[index] = new VideoController()
    }
    return this.livePhotoControllers[index]
  }

  private isLivePhotoPrepared(index: number): boolean {
    return this.preparedLivePhotoIndices.includes(index)
  }

  private clearPreparedLivePhoto(index: number): void {
    if (!this.preparedLivePhotoIndices.includes(index)) {
      return
    }
    this.preparedLivePhotoIndices = this.preparedLivePhotoIndices.filter((value: number) => value !== index)
  }

  private markPreparedLivePhoto(index: number): void {
    if (this.preparedLivePhotoIndices.includes(index)) {
      return
    }
    this.preparedLivePhotoIndices = [...this.preparedLivePhotoIndices, index]
  }

  private livePhotoInstanceSeed(index: number): number {
    return this.livePhotoInstanceSeeds[index] ?? 0
  }

  private refreshLivePhotoInstance(index: number): void {
    this.clearPreparedLivePhoto(index)
    const nextSeeds = [...this.livePhotoInstanceSeeds]
    nextSeeds[index] = (nextSeeds[index] ?? 0) + 1
    this.livePhotoInstanceSeeds = nextSeeds
  }

  private livePhotoVisibilityRatio(index: number): number {
    return this.livePhotoVisibilityRatios[index] ?? 0
  }

  private livePhotoAspectRatio(index: number): number {
    const ratio = this.livePhotoAspectRatios[index]
    return ratio && ratio > 0 ? ratio : 4 / 5
  }

  private rememberLivePhotoAspectRatio(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return
    }
    const nextRatio = width / height
    const currentRatio = this.livePhotoAspectRatios[index]
    if (currentRatio && Math.abs(currentRatio - nextRatio) < 0.001) {
      return
    }
    const nextAspectRatios = [...this.livePhotoAspectRatios]
    nextAspectRatios[index] = nextRatio
    this.livePhotoAspectRatios = nextAspectRatios
  }

  private isCurrentlyActiveLivePhoto(index: number): boolean {
    if (this.activeMediaIndex === index && this.livePhotoVisibilityRatio(index) >= LIVE_PHOTO_VISIBILITY_THRESHOLD) {
      return true
    }
    return isInitialFirstLivePhoto(this.mediaItems, this.livePhotoVisibilityRatios, index)
  }

  private stopAllLivePhotoPlayback(exceptIndex: number = -1): void {
    this.livePhotoControllers.forEach((controller: VideoController, index: number) => {
      if (index === exceptIndex || !controller) {
        return
      }
      try {
        controller.pause()
      } catch (_) {
      }
    })
  }

  private stopLivePhotoPlayback(): void {
    this.playingLivePhotoIndex = -1
    this.pausedLivePhotoIndex = -1
    this.preparedLivePhotoIndices = []
    this.stopAllLivePhotoPlayback()
  }

  private pauseLivePhotoPlayback(index: number): void {
    if (!findLivePhotoMediaItem(this.mediaItems, index)) {
      this.pausedLivePhotoIndex = -1
      this.playingLivePhotoIndex = -1
      return
    }
    this.stopAllLivePhotoPlayback(index)
    try {
      this.controllerFor(index).pause()
      this.pausedLivePhotoIndex = index
    } catch (_) {
      this.pausedLivePhotoIndex = -1
    }
    this.playingLivePhotoIndex = -1
  }

  private syncLivePhotoPlayback(index: number): void {
    if (!findLivePhotoMediaItem(this.mediaItems, index)) {
      this.playingLivePhotoIndex = -1
      this.pausedLivePhotoIndex = -1
      return
    }
    if (this.livePhotoVisibilityRatio(index) < LIVE_PHOTO_VISIBILITY_THRESHOLD) {
      this.pauseLivePhotoPlayback(index)
      return
    }
    if (findMountedLivePhotoIndices(this.mediaItems).includes(index)) {
      try {
        this.controllerFor(index).start()
      } catch (_) {
      }
    }
    if (this.isLivePhotoPrepared(index)) {
      this.pausedLivePhotoIndex = -1
      this.playingLivePhotoIndex = index
      return
    }
    this.pausedLivePhotoIndex = -1
    this.playingLivePhotoIndex = -1
  }

  private updateLivePhotoVisibility(index: number, currentRatio: number): void {
    if (findLivePhotoMediaItem(this.mediaItems, index) === undefined) {
      return
    }
    const nextRatios = [...this.livePhotoVisibilityRatios]
    nextRatios[index] = currentRatio
    this.livePhotoVisibilityRatios = nextRatios

    const centeredIndex = resolveCenteredLivePhotoIndex(this.mediaItems, nextRatios)
    if (centeredIndex < 0) {
      this.stopLivePhotoPlayback()
      return
    }
    if (this.activeMediaIndex !== centeredIndex) {
      this.activeMediaIndex = centeredIndex
    }
    this.syncLivePhotoPlayback(centeredIndex)
  }

  private toggleLivePhotoMuted(): void {
    this.livePhotoMuted = !this.livePhotoMuted
    this.showToast(this.livePhotoMuted ? '已静音' : '已开启声音')
  }

  private toggleLivePhotoPlayback(index: number): void {
    if (!findLivePhotoMediaItem(this.mediaItems, index)) {
      return
    }
    if (this.playingLivePhotoIndex === index) {
      this.pauseLivePhotoPlayback(index)
      return
    }
    if (this.livePhotoVisibilityRatio(index) < LIVE_PHOTO_VISIBILITY_THRESHOLD) {
      return
    }
    this.syncLivePhotoPlayback(index)
  }

  private shouldShowVideoSurface(index: number): boolean {
    if (!this.isLivePhotoPrepared(index)) {
      return false
    }
    return this.activeMediaIndex === index || this.pausedLivePhotoIndex === index
  }

  private shouldShowPlayingLivePhoto(index: number): boolean {
    return this.activeMediaIndex === index && this.isLivePhotoPrepared(index)
  }

  private shouldWarmLivePhoto(index: number): boolean {
    if (!findMountedLivePhotoIndices(this.mediaItems).includes(index)) {
      return false
    }
    if (this.livePhotoVisibilityRatio(index) >= LIVE_PHOTO_VISIBILITY_THRESHOLD) {
      return this.activeMediaIndex === index
    }
    return isInitialFirstLivePhoto(this.mediaItems, this.livePhotoVisibilityRatios, index)
  }

  private shouldShowLivePhotoLoading(index: number): boolean {
    if (findLivePhotoMediaItem(this.mediaItems, index) === undefined) {
      return false
    }
    if (this.isLivePhotoPrepared(index)) {
      return false
    }
    const ratio = this.livePhotoVisibilityRatio(index)
    if (ratio > 0) {
      return this.activeMediaIndex === index && ratio >= LIVE_PHOTO_VISIBILITY_THRESHOLD
    }
    return index === findFirstLivePhotoIndex(this.mediaItems)
      && this.livePhotoVisibilityRatios.every((value: number) => value === 0)
  }

  private handleLivePhotoPrepared(index: number): void {
    this.markPreparedLivePhoto(index)
    if (!this.isCurrentlyActiveLivePhoto(index)) {
      return
    }
    this.pausedLivePhotoIndex = -1
    this.playingLivePhotoIndex = index
    try {
      this.controllerFor(index).start()
    } catch (_) {
    }
  }

  private handleLivePhotoStart(index: number): void {
    this.markPreparedLivePhoto(index)
    if (this.pausedLivePhotoIndex === index) {
      this.pausedLivePhotoIndex = -1
    }
    if (this.isCurrentlyActiveLivePhoto(index)) {
      this.playingLivePhotoIndex = index
    }
  }

  private handleLivePhotoPause(index: number): void {
    if (this.isLivePhotoPrepared(index)) {
      this.pausedLivePhotoIndex = index
    }
    if (this.playingLivePhotoIndex === index) {
      this.playingLivePhotoIndex = -1
    }
  }

  private handleLivePhotoStop(index: number): void {
    if (this.playingLivePhotoIndex === index) {
      this.playingLivePhotoIndex = -1
    }
    if (this.pausedLivePhotoIndex === index) {
      this.pausedLivePhotoIndex = -1
    }
  }

  private handleLivePhotoError(index: number): void {
    this.clearPreparedLivePhoto(index)
    if (this.playingLivePhotoIndex === index) {
      this.playingLivePhotoIndex = -1
    }
    if (this.pausedLivePhotoIndex === index) {
      this.pausedLivePhotoIndex = -1
    }
    this.refreshLivePhotoInstance(index)
  }

  build() {
    if (this.mediaItems.length > 0) {
      Column({ space: 20 }) {
        ForEach(this.mediaItems, (item: PictureCarouselMediaItem, index: number) => {
          Column() {
            if (item.kind === 'livePhoto') {
              ArticleLivePhotoSlide({
                item,
                theme: this.theme,
                isMounted: findMountedLivePhotoIndices(this.mediaItems).includes(index),
                shouldShowVideo: this.shouldShowVideoSurface(index),
                shouldShowLoading: this.shouldShowLivePhotoLoading(index),
                shouldWarm: this.shouldWarmLivePhoto(index),
                isMuted: this.livePhotoMuted || !this.shouldShowPlayingLivePhoto(index),
                slideAspectRatio: this.livePhotoAspectRatio(index),
                controller: this.controllerFor(index),
                onPrepared: () => this.handleLivePhotoPrepared(index),
                onStart: () => this.handleLivePhotoStart(index),
                onPause: () => this.handleLivePhotoPause(index),
                onStop: () => this.handleLivePhotoStop(index),
                onError: () => this.handleLivePhotoError(index),
                onSlideClick: () => this.toggleLivePhotoPlayback(index),
                onMutedToggle: () => this.toggleLivePhotoMuted(),
                onAspectChange: (width: number, height: number) =>
                  this.rememberLivePhotoAspectRatio(index, width, height),
                onVisibilityChange: (currentRatio: number) =>
                  this.updateLivePhotoVisibility(index, currentRatio),
              })
            } else {
              ArticleStaticImageSlide({
                item,
                theme: this.theme,
                title: this.title,
                slideAspectRatio: this.livePhotoAspectRatio(index),
                onAspectChange: (width: number, height: number) =>
                  this.rememberLivePhotoAspectRatio(index, width, height),
              })
            }
          }
          .width('100%')
        }, (item: PictureCarouselMediaItem, index: number) =>
          `${item.kind}-${item.imageUrl}-${item.videoUrl}-${index}-${this.livePhotoInstanceSeed(index)}`)
      }
      .width('100%')
      .onVisibleAreaChange([0], (isVisible: boolean) => {
        if (!isVisible) {
          this.livePhotoVisibilityRatios = []
          this.stopLivePhotoPlayback()
        }
      })
      .onDisAppear(() => {
        this.stopLivePhotoPlayback()
      })
    }
  }
}
