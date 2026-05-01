import { openImageViewer } from '../navigation/AppRouter'
import { PictureCarouselMediaItem } from '../utils/PictureGallery'
import { ThemePalette, ThemeService } from '../services/ThemeService'

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

  private showToast(message: string, duration: number = 1800): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message, duration })
    } catch (error) {
      console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private controllerFor(index: number): VideoController {
    if (!this.livePhotoControllers[index]) {
      this.livePhotoControllers[index] = new VideoController()
    }
    return this.livePhotoControllers[index]
  }

  private currentLivePhotoItem(index: number): PictureCarouselMediaItem | undefined {
    const item = this.mediaItems[index]
    return item?.kind === 'livePhoto' && item.videoUrl ? item : undefined
  }

  private firstLivePhotoIndex(): number {
    for (let index = 0; index < this.mediaItems.length; index += 1) {
      const item = this.mediaItems[index]
      if (item?.kind === 'livePhoto' && item.videoUrl) {
        return index
      }
    }

    return -1
  }

  private mountedLivePhotoIndices(): number[] {
    const mounted = new Set<number>()

    this.mediaItems.forEach((item: PictureCarouselMediaItem, index: number) => {
      if (item.kind === 'livePhoto' && item.videoUrl) {
        mounted.add(index)
      }
    })

    return Array.from(mounted.values())
  }

  private warmMountedLivePhotos(targetIndex: number): void {
    this.mountedLivePhotoIndices().forEach((index: number) => {
      if (index !== targetIndex) {
        return
      }
      try {
        this.controllerFor(index).start()
      } catch (_) {
      }
    })
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
    const item = this.currentLivePhotoItem(index)
    if (!item) {
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
    const item = this.currentLivePhotoItem(index)
    if (!item) {
      this.playingLivePhotoIndex = -1
      this.pausedLivePhotoIndex = -1
      return
    }

    if (this.livePhotoVisibilityRatio(index) < 0.35) {
      this.pauseLivePhotoPlayback(index)
      return
    }

    this.warmMountedLivePhotos(index)

    if (this.isLivePhotoPrepared(index)) {
      this.pausedLivePhotoIndex = -1
      this.playingLivePhotoIndex = index
      try {
        this.controllerFor(index).start()
      } catch (_) {
      }
      return
    }

    this.pausedLivePhotoIndex = -1
    this.playingLivePhotoIndex = -1
  }

  private livePhotoVisibilityRatio(index: number): number {
    return this.livePhotoVisibilityRatios[index] ?? 0
  }

  private resolveCenteredLivePhotoIndex(ratios: number[]): number {
    let bestIndex = -1
    let bestScore = 0

    this.mediaItems.forEach((item: PictureCarouselMediaItem, index: number) => {
      if (item.kind !== 'livePhoto' || !item.videoUrl) {
        return
      }
      const score = ratios[index] ?? 0
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    return bestScore >= 0.35 ? bestIndex : -1
  }

  private updateLivePhotoVisibility(index: number, currentRatio: number): void {
    if (this.currentLivePhotoItem(index) === undefined) {
      return
    }

    const nextRatios = [...this.livePhotoVisibilityRatios]
    nextRatios[index] = currentRatio
    this.livePhotoVisibilityRatios = nextRatios

    const centeredIndex = this.resolveCenteredLivePhotoIndex(nextRatios)
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
    const item = this.currentLivePhotoItem(index)
    if (!item) {
      return
    }

    if (this.playingLivePhotoIndex === index) {
      this.pauseLivePhotoPlayback(index)
      return
    }

    if (this.livePhotoVisibilityRatio(index) < 0.35) {
      return
    }

    this.syncLivePhotoPlayback(index)
  }

  private shouldShowPlayingLivePhoto(index: number): boolean {
    return this.activeMediaIndex === index
      && this.isLivePhotoPrepared(index)
  }

  private shouldShowPausedLivePhoto(index: number): boolean {
    return this.pausedLivePhotoIndex === index && this.isLivePhotoPrepared(index)
  }

  private shouldWarmLivePhoto(index: number): boolean {
    // 可见比例尚未初始化时，对第一个 live 图片立即预热，减少首屏等待。
    if (this.livePhotoVisibilityRatio(index) >= 0.35) {
      return this.activeMediaIndex === index
        && this.mountedLivePhotoIndices().includes(index)
    }
    const allRatiosZero = this.livePhotoVisibilityRatios.every((ratio: number) => ratio === 0)
    return allRatiosZero
      && index === this.firstLivePhotoIndex()
      && this.mountedLivePhotoIndices().includes(index)
  }

  private shouldShowLivePhotoLoading(index: number): boolean {
    if (this.currentLivePhotoItem(index) === undefined) {
      return false
    }
    if (this.isLivePhotoPrepared(index)) {
      return false
    }
    const ratio = this.livePhotoVisibilityRatio(index)
    if (ratio > 0) {
      return this.activeMediaIndex === index && ratio >= 0.35
    }
    const allRatiosZero = this.livePhotoVisibilityRatios.every((value: number) => value === 0)
    return allRatiosZero && index === this.firstLivePhotoIndex()
  }

  private handleLivePhotoPrepared(index: number): void {
    this.markPreparedLivePhoto(index)
    const ratio = this.livePhotoVisibilityRatio(index)
    const allRatiosZero = this.livePhotoVisibilityRatios.every((value: number) => value === 0)
    const isInitialFirstPhoto = allRatiosZero && index === this.firstLivePhotoIndex()
    if ((this.activeMediaIndex === index && ratio >= 0.35) || isInitialFirstPhoto) {
      this.pausedLivePhotoIndex = -1
      this.playingLivePhotoIndex = index
      try {
        this.controllerFor(index).start()
      } catch (_) {
      }
    }
  }

  private handleLivePhotoStart(index: number): void {
    this.markPreparedLivePhoto(index)
    if (this.pausedLivePhotoIndex === index) {
      this.pausedLivePhotoIndex = -1
    }
    const ratio = this.livePhotoVisibilityRatio(index)
    const allRatiosZero = this.livePhotoVisibilityRatios.every((value: number) => value === 0)
    const isInitialFirstPhoto = allRatiosZero && index === this.firstLivePhotoIndex()
    if ((this.activeMediaIndex === index && ratio >= 0.35) || isInitialFirstPhoto) {
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

  @Builder
  private LiveBadge() {
    Row({ space: 4 }) {
      SymbolGlyph($r('sys.symbol.play_fill'))
        .fontSize(11)
        .fontColor(['rgba(255,255,255,0.92)'])

      Text('LIVE')
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor('rgba(255,255,255,0.92)')
    }
    .padding({ left: 8, right: 8, top: 5, bottom: 5 })
    .margin({ top: 10, right: 10 })
    .backgroundColor('rgba(0,0,0,0.22)')
    .borderRadius(999)
  }

  @Builder
  private LiveSoundToggle() {
    Row({ space: 4 }) {
      SymbolGlyph($r(this.livePhotoMuted ? 'sys.symbol.speaker_slash_fill' : 'sys.symbol.speaker_wave_2_fill'))
        .fontSize(11)
        .fontColor(['rgba(255,255,255,0.92)'])

      Text(this.livePhotoMuted ? '静音' : '有声')
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor('rgba(255,255,255,0.92)')
    }
    .padding({ left: 8, right: 8, top: 5, bottom: 5 })
    .margin({ right: 10, bottom: 10 })
    .backgroundColor('rgba(0,0,0,0.28)')
    .borderRadius(999)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.toggleLivePhotoMuted()
    })
  }

  @Builder
  private LivePhotoSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(item.imageUrl)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Contain)
          .borderRadius(18)
          .backgroundColor(this.theme.elevated)
          .onComplete((event) => {
            if (event) {
              this.rememberLivePhotoAspectRatio(index, event.width, event.height)
            }
          })
          .visibility((this.shouldShowPlayingLivePhoto(index) || this.shouldShowPausedLivePhoto(index))
            ? Visibility.Hidden
            : Visibility.Visible)

        if (item.kind === 'livePhoto' && item.videoUrl && this.mountedLivePhotoIndices().includes(index)) {
          Video({
            src: item.videoUrl,
            controller: this.controllerFor(index),
            previewUri: item.imageUrl,
          })
            .width('100%')
            .height('100%')
            .borderRadius(18)
            .controls(false)
            .autoPlay(this.shouldWarmLivePhoto(index))
            .loop(true)
            .muted(this.livePhotoMuted || !this.shouldShowPlayingLivePhoto(index))
            .objectFit(ImageFit.Cover)
            .opacity((this.shouldShowPlayingLivePhoto(index) || this.shouldShowPausedLivePhoto(index)) ? 1 : 0)
            .onPrepared(() => {
              this.handleLivePhotoPrepared(index)
            })
            .onStart(() => {
              this.handleLivePhotoStart(index)
            })
            .onPause(() => {
              this.handleLivePhotoPause(index)
            })
            .onStop(() => {
              this.handleLivePhotoStop(index)
            })
            .onError(() => {
              this.handleLivePhotoError(index)
            })
        }
      }
      .width('100%')
      .height('100%')
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .onClick(() => {
        this.toggleLivePhotoPlayback(index)
      })

      if (this.shouldShowLivePhotoLoading(index)) {
        Stack() {
          LoadingProgress()
            .width(28)
            .height(28)
            .color(this.theme.accent)
        }
        .width('100%')
        .height('100%')
        .align(Alignment.Center)
      }

      Stack() {
        this.LiveBadge()
      }
      .width('100%')
      .height('100%')
      .align(Alignment.TopEnd)

      Stack() {
        this.LiveSoundToggle()
      }
      .width('100%')
      .height('100%')
      .align(Alignment.BottomEnd)
    }
    .width('100%')
    .aspectRatio(this.livePhotoAspectRatio(index))
    .onVisibleAreaChange([0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0], (_isVisible: boolean, currentRatio: number) => {
      this.updateLivePhotoVisibility(index, currentRatio)
    })
  }

  @Builder
  private ImageSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Image(item.imageUrl)
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Contain)
        .borderRadius(18)
        .backgroundColor(this.theme.elevated)
        .onComplete((event) => {
          if (event) {
            this.rememberLivePhotoAspectRatio(index, event.width, event.height)
          }
        })
    }
    .width('100%')
    .aspectRatio(this.livePhotoAspectRatio(index))
    .clip(true)
    .borderRadius(18)
    .backgroundColor(this.theme.elevated)
    .onClick(() => {
      void openImageViewer(item.imageUrl, this.title || '图片预览')
    })
  }

  build() {
    if (this.mediaItems.length > 0) {
      Column({ space: 20 }) {
        ForEach(this.mediaItems, (item: PictureCarouselMediaItem, index: number) => {
          Column() {
            if (item.kind === 'livePhoto') {
              this.LivePhotoSlide(item, index)
            } else {
              this.ImageSlide(item, index)
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
