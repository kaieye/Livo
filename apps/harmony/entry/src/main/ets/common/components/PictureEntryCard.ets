import { Entry, formatPublishedAt, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'

@Component
export struct PictureEntryCard {
  @Prop entry: Entry = {} as Entry
  @Prop index: number = 0
  @Prop enableEnterTransition: boolean = true
  @Prop authorLabel: string = ''
  @Prop feedImageUrl: string = ''
  @Prop caption: string = ''
  @Prop pictureUrl: string = ''
  @Prop galleryUrls: string[] = []
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State private activeMediaIndex: number = 0
  @State private playingLivePhotoIndex: number = -1
  @State private pausedLivePhotoIndex: number = -1
  @State private preparedLivePhotoIndices: number[] = []
  @State private livePhotoInstanceSeeds: number[] = []
  @State private livePhotoAspectRatios: number[] = []
  @State private isFullyVisible: boolean = false
  @State private isNearlyVisible: boolean = false
  private readonly livePhotoControllers: VideoController[] = []

  onOpen: () => void = () => {}

  private displayAuthor(): string {
    return (this.authorLabel || this.entry.author || '').trim() || '未知来源'
  }

  @Builder
  private FeedAvatar() {
    if (this.feedImageUrl.trim()) {
      Image(this.feedImageUrl.trim())
        .width(28)
        .height(28)
        .borderRadius(14)
        .backgroundColor(this.theme.elevated)
    } else {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(28)
          .height(28)
          .borderRadius(14)
          .backgroundColor(this.theme.accent)

        Text(this.displayAuthor().substring(0, 1).toUpperCase())
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
    }
  }

  private normalizedGalleryUrls(): string[] {
    return selectPictureMediaUrls(this.galleryUrls)
  }

  private carouselMediaItems(): PictureCarouselMediaItem[] {
    const rawMediaUrls = this.entry.mediaUrls ?? []
    const resolvedItems = resolvePictureCarouselMediaItems(rawMediaUrls, this.pictureUrl)
    if (resolvedItems.length > 0) {
      return resolvedItems
    }

    const galleryMediaUrls = this.normalizedGalleryUrls()
    if (galleryMediaUrls.length > 0) {
      return galleryMediaUrls.map((url: string): PictureCarouselMediaItem => ({
        kind: 'image',
        imageUrl: url,
        videoUrl: '',
      }))
    }

    const singleMediaUrl = (this.pictureUrl || '').trim()
    return singleMediaUrl
      ? [{
          kind: 'image',
          imageUrl: singleMediaUrl,
          videoUrl: '',
        }]
      : []
  }

  private controllerFor(index: number): VideoController {
    if (!this.livePhotoControllers[index]) {
      this.livePhotoControllers[index] = new VideoController()
    }
    return this.livePhotoControllers[index]
  }

  private currentLivePhotoItem(index: number): PictureCarouselMediaItem | undefined {
    const item = this.carouselMediaItems()[index]
    return item?.kind === 'livePhoto' && item.videoUrl ? item : undefined
  }

  private firstLivePhotoIndex(): number {
    const items = this.carouselMediaItems()
    for (let index = 0; index < items.length; index += 1) {
      if (items[index]?.kind === 'livePhoto' && items[index].videoUrl) {
        return index
      }
    }

    return -1
  }

  private preloadLivePhotoIndices(): number[] {
    const items = this.carouselMediaItems()
    const result: number[] = []
    if (items.length <= 1) {
      return result
    }

    const previousIndex = (this.activeMediaIndex - 1 + items.length) % items.length
    const previousItem = items[previousIndex]
    if (previousIndex !== this.activeMediaIndex
      && previousItem?.kind === 'livePhoto'
      && previousItem.videoUrl
      && !result.includes(previousIndex)) {
      result.push(previousIndex)
    }

    let offset = 1
    while (offset < items.length && result.length < 4) {
      const candidateIndex = (this.activeMediaIndex + offset) % items.length
      const candidateItem = items[candidateIndex]
      if (candidateItem?.kind === 'livePhoto' && candidateItem.videoUrl && !result.includes(candidateIndex)) {
        result.push(candidateIndex)
      }
      offset += 1
    }

    return result
  }

  private mountedLivePhotoIndices(): number[] {
    const mounted = new Set<number>()
    const currentItem = this.currentLivePhotoItem(this.activeMediaIndex)
    if (currentItem) {
      mounted.add(this.activeMediaIndex)
    }

    this.preloadLivePhotoIndices().forEach((index: number) => {
      mounted.add(index)
    })

    this.preparedLivePhotoIndices.forEach((index: number) => {
      mounted.add(index)
    })

    const firstLiveIndex = this.firstLivePhotoIndex()
    if (firstLiveIndex >= 0 && this.isNearlyVisible) {
      mounted.add(firstLiveIndex)
    }

    if (this.playingLivePhotoIndex >= 0) {
      mounted.add(this.playingLivePhotoIndex)
    }
    if (this.pausedLivePhotoIndex >= 0) {
      mounted.add(this.pausedLivePhotoIndex)
    }

    return Array.from(mounted.values())
  }

  private warmMountedLivePhotos(): void {
    this.mountedLivePhotoIndices().forEach((index: number) => {
      try {
        this.controllerFor(index).start()
      } catch (_) {
      }
    })
  }

  private syncVisibleLivePhotoPlayback(index: number): void {
    const item = this.currentLivePhotoItem(index)
    if (!item) {
      this.playingLivePhotoIndex = -1
      this.pausedLivePhotoIndex = -1
      return
    }

    if (!this.isNearlyVisible) {
      this.pauseLivePhotoPlayback(index)
      return
    }

    if (!this.isFullyVisible) {
      this.pauseLivePhotoPlayback(index)
      return
    }

    this.warmMountedLivePhotos()

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

  private stopLivePhotoPlayback(): void {
    this.playingLivePhotoIndex = -1
    this.pausedLivePhotoIndex = -1
    this.preparedLivePhotoIndices = []
    this.stopAllLivePhotoPlayback()
  }

  private isLivePhotoPrepared(index: number): boolean {
    return this.preparedLivePhotoIndices.includes(index)
  }

  private shouldShowPlayingLivePhoto(index: number): boolean {
    return this.playingLivePhotoIndex === index && this.isLivePhotoPrepared(index)
  }

  private shouldShowPausedLivePhoto(index: number): boolean {
    return this.pausedLivePhotoIndex === index && this.isLivePhotoPrepared(index)
  }

  private shouldWarmLivePhoto(index: number): boolean {
    return this.isNearlyVisible && this.mountedLivePhotoIndices().includes(index)
  }

  private shouldShowLivePhotoLoading(index: number): boolean {
    return this.currentLivePhotoItem(index) !== undefined
      && this.activeMediaIndex === index
      && this.isFullyVisible
      && !this.isLivePhotoPrepared(index)
  }

  private handleLivePhotoPrepared(index: number): void {
    this.markPreparedLivePhoto(index)
    if (this.isFullyVisible && this.activeMediaIndex === index) {
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
    if (this.isFullyVisible && this.activeMediaIndex === index) {
      this.playingLivePhotoIndex = index
    }
  }

  private handleLivePhotoPause(index: number): void {
    if (this.activeMediaIndex === index && this.isLivePhotoPrepared(index)) {
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
  private LoadingIndicator() {
    Stack({ alignContent: Alignment.Center }) {
      LoadingProgress()
        .color(Color.White)
        .layoutWeight(1)
        .width(40)
        .height(40)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('rgba(0,0,0,0.3)')
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
  private LivePhotoSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.TopEnd }) {
      Image(item.imageUrl || this.pictureUrl)
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
          previewUri: item.imageUrl || this.pictureUrl,
        })
          .width('100%')
          .height('100%')
          .borderRadius(18)
          .controls(false)
          .autoPlay(this.shouldWarmLivePhoto(index))
          .loop(true)
          .muted(!this.shouldShowPlayingLivePhoto(index))
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

      if (this.shouldShowLivePhotoLoading(index)) {
        this.LoadingIndicator()
      }

      this.LiveBadge()
    }
    .width('100%')
    .aspectRatio(this.livePhotoAspectRatio(index))
  }

  @Builder
  private MediaCarousel() {
    if (this.carouselMediaItems().length > 0) {
      Stack({ alignContent: Alignment.Center }) {
        Swiper() {
          ForEach(this.carouselMediaItems(), (item: PictureCarouselMediaItem, index: number) => {
            if (item.kind === 'livePhoto') {
              this.LivePhotoSlide(item, index)
            } else {
              Image(item.imageUrl || this.pictureUrl)
                .width('100%')
                .objectFit(ImageFit.Contain)
                .borderRadius(18)
                .backgroundColor(this.theme.elevated)
            }
          }, (item: PictureCarouselMediaItem, index: number) => `${item.kind}-${item.imageUrl}-${item.videoUrl}-${index}-${this.livePhotoInstanceSeed(index)}`)
        }
        .width('100%')
        .vertical(false)
        .autoPlay(false)
        .displayArrow(false)
        .effectMode(EdgeEffect.None)
        .cachedCount(4)
        .indicator(new DotIndicator()
          .itemWidth(6)
          .itemHeight(6)
          .selectedItemWidth(12)
          .selectedItemHeight(6)
          .color($r('sys.color.comp_background_secondary'))
          .selectedColor(this.theme.accent))
        .loop(this.carouselMediaItems().length > 1)
        .duration(260)
        .onChange((index: number) => {
          this.activeMediaIndex = index
          this.syncVisibleLivePhotoPlayback(index)
        })
      }
      .width('100%')
      .constraintSize({ maxHeight: 640 })
      .clip(true)
      .borderRadius(18)
      .backgroundColor(this.theme.elevated)
    }
  }

  build() {

    Column({ space: 10 }) {
      Row({ space: 8 }) {
        this.FeedAvatar()

        Text(this.displayAuthor())
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text('·')
          .fontSize(12)
          .fontColor(this.theme.textMuted)

        Text(formatPublishedAt(this.entry.publishedAt))
          .fontSize(12)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      if (this.caption) {
        Text(this.caption)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      if (this.carouselMediaItems().length > 0) {
        this.MediaCarousel()
      }
    }
    .width('100%')
    .padding({ top: 8, bottom: 10 })
    .alignItems(HorizontalAlign.Start)
    .transition(this.enableEnterTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
    .onVisibleAreaChange([1], (isVisible: boolean, currentRatio: number) => {
      this.isNearlyVisible = isVisible && currentRatio >= 0.6
      this.isFullyVisible = isVisible && currentRatio >= 0.99
      this.syncVisibleLivePhotoPlayback(this.activeMediaIndex)
    })
    .onDisAppear(() => {
      this.stopLivePhotoPlayback()
    })
    .onClick(() => {
      this.onOpen()
    })
  }
}
