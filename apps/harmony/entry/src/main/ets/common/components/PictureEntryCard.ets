import { Entry, formatPublishedAt, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_MD } from '../ui/UiTokens'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'
import { HighlightedInlineText } from './HighlightedInlineText'

interface MediaSize {
  width: number
  height: number
}

interface CardPadding {
  left: number
  right: number
  top: number
  bottom: number
}

@Component
export struct PictureEntryCard {
  @Prop entry: Entry = {} as Entry
  @Prop index: number = 0
  @Prop enableEnterTransition: boolean = true
  @Prop flatMode: boolean = false
  @Prop authorLabel: string = ''
  @Prop feedImageUrl: string = ''
  @Prop caption: string = ''
  @Prop pictureUrl: string = ''
  @Prop galleryUrls: string[] = []
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop highlightQuery: string = ''
  @Prop isUnread: boolean = false
  @Prop showBottomDivider: boolean = false
  @StorageProp('showUnreadDot') showUnreadDot: boolean = true
  @State private activeMediaIndex: number = 0
  @State private playingLivePhotoIndex: number = -1
  @State private pausedLivePhotoIndex: number = -1
  @State private preparedLivePhotoIndices: number[] = []
  @State private livePhotoInstanceSeeds: number[] = []
  @State private livePhotoAspectRatios: number[] = []
  @State private mediaNaturalSizes: MediaSize[] = []
  @State private livePhotoMuted: boolean = true
  @State private isFullyVisible: boolean = false
  @State private isNearlyVisible: boolean = false
  @State private cachedCarouselItems: PictureCarouselMediaItem[] = []
  private readonly livePhotoControllers: VideoController[] = []

  onOpen: () => void = () => {}

  aboutToAppear(): void {
    this.cachedCarouselItems = this.computeCarouselMediaItems()
  }

  private computeCarouselMediaItems(): PictureCarouselMediaItem[] {
    const rawMediaUrls = this.entry.mediaUrls ?? []
    const resolvedItems = resolvePictureCarouselMediaItems(rawMediaUrls, this.pictureUrl)
    if (resolvedItems.length > 0) return resolvedItems
    const galleryMediaUrls = this.normalizedGalleryUrls()
    if (galleryMediaUrls.length > 0) {
      return galleryMediaUrls.map((url: string): PictureCarouselMediaItem => ({
        kind: 'image', imageUrl: url, videoUrl: '',
      }))
    }
    const singleMediaUrl = (this.pictureUrl || '').trim()
    return singleMediaUrl ? [{ kind: 'image', imageUrl: singleMediaUrl, videoUrl: '' }] : []
  }

  private displayAuthor(): string {
    return (this.authorLabel || this.entry.author || '').trim() || '未知来源'
  }

  private normalizedGalleryUrls(): string[] {
    return selectPictureMediaUrls(this.galleryUrls)
  }

  private carouselMediaItems(): PictureCarouselMediaItem[] {
    return this.cachedCarouselItems
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

  private mountedLivePhotoIndices(): number[] {
    const mounted = new Set<number>()
    const currentItem = this.currentLivePhotoItem(this.activeMediaIndex)
    if (currentItem) mounted.add(this.activeMediaIndex)
    this.preparedLivePhotoIndices.forEach((i: number) => mounted.add(i))
    if (this.playingLivePhotoIndex >= 0) mounted.add(this.playingLivePhotoIndex)
    if (this.pausedLivePhotoIndex >= 0) mounted.add(this.pausedLivePhotoIndex)
    return Array.from(mounted.values())
  }

  private syncVisibleLivePhotoPlayback(index: number): void {
    const item = this.currentLivePhotoItem(index)
    if (!item) { this.playingLivePhotoIndex = -1; this.pausedLivePhotoIndex = -1; return }
    if (!this.isNearlyVisible) { this.pauseLivePhotoPlayback(index); return }
    if (this.isLivePhotoPrepared(index)) {
      this.pausedLivePhotoIndex = -1
      this.playingLivePhotoIndex = index
      try { this.controllerFor(index).start() } catch (_) {}
      return
    }
    this.pausedLivePhotoIndex = -1
    this.playingLivePhotoIndex = -1
  }

  private pauseLivePhotoPlayback(index: number): void {
    const item = this.currentLivePhotoItem(index)
    if (!item) { this.pausedLivePhotoIndex = -1; this.playingLivePhotoIndex = -1; return }
    this.stopAllLivePhotoPlayback(index)
    try { this.controllerFor(index).pause(); this.pausedLivePhotoIndex = index } catch (_) { this.pausedLivePhotoIndex = -1 }
    this.playingLivePhotoIndex = -1
  }

  private stopAllLivePhotoPlayback(exceptIndex: number = -1): void {
    this.livePhotoControllers.forEach((controller: VideoController, i: number) => {
      if (i === exceptIndex || !controller) return
      try { controller.pause() } catch (_) {}
    })
  }

  private isLivePhotoPrepared(index: number): boolean { return this.preparedLivePhotoIndices.includes(index) }
  private shouldShowPlayingLivePhoto(index: number): boolean { return this.playingLivePhotoIndex === index && this.isLivePhotoPrepared(index) }
  private shouldShowPausedLivePhoto(index: number): boolean { return this.pausedLivePhotoIndex === index && this.isLivePhotoPrepared(index) }
  private shouldWarmLivePhoto(index: number): boolean { return this.isNearlyVisible && this.activeMediaIndex === index && this.mountedLivePhotoIndices().includes(index) }
  private shouldShowLivePhotoLoading(index: number): boolean { return this.currentLivePhotoItem(index) !== undefined && this.activeMediaIndex === index && this.isNearlyVisible && !this.isLivePhotoPrepared(index) }

  private handleLivePhotoPrepared(index: number): void {
    this.markPreparedLivePhoto(index)
    if (this.isNearlyVisible && this.activeMediaIndex === index) {
      this.pausedLivePhotoIndex = -1
      this.playingLivePhotoIndex = index
      try { this.controllerFor(index).start() } catch (_) {}
    }
  }

  private handleLivePhotoStart(index: number): void {
    this.markPreparedLivePhoto(index)
    if (this.pausedLivePhotoIndex === index) this.pausedLivePhotoIndex = -1
    if (this.isNearlyVisible && this.activeMediaIndex === index) this.playingLivePhotoIndex = index
  }

  private handleLivePhotoPause(index: number): void {
    if (this.activeMediaIndex === index && this.isLivePhotoPrepared(index)) this.pausedLivePhotoIndex = index
    if (this.playingLivePhotoIndex === index) this.playingLivePhotoIndex = -1
  }

  private handleLivePhotoStop(index: number): void {
    if (this.playingLivePhotoIndex === index) this.playingLivePhotoIndex = -1
    if (this.pausedLivePhotoIndex === index) this.pausedLivePhotoIndex = -1
  }

  private handleLivePhotoError(index: number): void {
    this.clearPreparedLivePhoto(index)
    if (this.playingLivePhotoIndex === index) this.playingLivePhotoIndex = -1
    if (this.pausedLivePhotoIndex === index) this.pausedLivePhotoIndex = -1
    this.refreshLivePhotoInstance(index)
  }

  private markPreparedLivePhoto(index: number): void { if (!this.preparedLivePhotoIndices.includes(index)) this.preparedLivePhotoIndices = [...this.preparedLivePhotoIndices, index] }
  private clearPreparedLivePhoto(index: number): void { if (this.preparedLivePhotoIndices.includes(index)) this.preparedLivePhotoIndices = this.preparedLivePhotoIndices.filter((v: number) => v !== index) }
  private livePhotoInstanceSeed(index: number): number { return this.livePhotoInstanceSeeds[index] ?? 0 }

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

  private rememberMediaNaturalSize(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    const nextSizes = [...this.mediaNaturalSizes]
    const size: MediaSize = { width, height }
    nextSizes[index] = size
    this.mediaNaturalSizes = nextSizes
  }

  private livePhotoAspectRatio(index: number): number { const ratio = this.livePhotoAspectRatios[index]; return ratio && ratio > 0 ? ratio : 4 / 5 }

  private rememberLivePhotoAspectRatio(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.rememberMediaNaturalSize(index, width, height)
    const nextRatio = width / height
    const currentRatio = this.livePhotoAspectRatios[index]
    if (currentRatio && Math.abs(currentRatio - nextRatio) < 0.001) return
    const nextAspectRatios = [...this.livePhotoAspectRatios]
    nextAspectRatios[index] = nextRatio
    this.livePhotoAspectRatios = nextAspectRatios
  }

  private resolvedMediaFrameAspectRatio(): number {
    const fallbackRatio = 4 / 5
    const items = this.carouselMediaItems()
    if (items.length === 0) return fallbackRatio
    let maxArea: number = -1; let maxAreaIndex: number = 0
    for (let i = 0; i < items.length; i++) {
      const size = this.mediaNaturalSizes[i]
      const area = size ? size.width * size.height : -1
      if (area > maxArea) { maxArea = area; maxAreaIndex = i }
    }
    if (items[maxAreaIndex]?.kind === 'livePhoto') return this.livePhotoAspectRatio(maxAreaIndex)
    const defaultItem = items[maxAreaIndex] || items[0]
    if (!defaultItem) return fallbackRatio
    if (defaultItem.kind === 'livePhoto') return this.livePhotoAspectRatio(maxAreaIndex)
    const measuredSize = this.mediaNaturalSizes[maxAreaIndex]
    if (!measuredSize || measuredSize.width <= 0 || measuredSize.height <= 0) return fallbackRatio
    return measuredSize.width / measuredSize.height
  }

  private cardPadding(): CardPadding { return this.flatMode ? { left: 0, right: 0, top: 4, bottom: 6 } : { left: 14, right: 14, top: 10, bottom: 10 } }

  private toggleMute(): void { this.livePhotoMuted = !this.livePhotoMuted }

  @Builder private UnreadDot() { if (this.isUnread && this.showUnreadDot) { Row().width(8).height(8).borderRadius(999).backgroundColor(this.theme.accent).margin({ right: 8, top: 8 }) } }

  @Builder private FeedAvatar() {
    if (this.feedImageUrl.trim()) {
      Image(this.feedImageUrl.trim()).width(28).height(28).borderRadius(14).backgroundColor(this.theme.elevated)
    } else {
      Stack({ alignContent: Alignment.Center }) {
        Row().width(28).height(28).borderRadius(14).backgroundColor(this.theme.accent)
        Text(this.displayAuthor().substring(0, 1).toUpperCase()).fontSize(12).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      }
    }
  }

  @Builder private FramedImageSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Image(item.imageUrl || this.pictureUrl).width('100%').height('100%').objectFit(ImageFit.Cover).opacity(0.26).blur(14).borderRadius(14)
      Image(item.imageUrl || this.pictureUrl).width('100%').height('100%').objectFit(ImageFit.Contain).borderRadius(14).backgroundColor(this.theme.elevated)
        .shadow({ radius: this.theme.isDark ? 14 : 16, color: this.theme.isDark ? 'rgba(0,0,0,0.34)' : 'rgba(15,23,42,0.16)', offsetX: 0, offsetY: 3 })
        .onComplete((event) => { if (event) this.rememberMediaNaturalSize(index, event.width, event.height) })
    }.width('100%').aspectRatio(this.resolvedMediaFrameAspectRatio())
  }

  @Builder private LoadingIndicator() { Stack({ alignContent: Alignment.Center }) { LoadingProgress().color(Color.White).layoutWeight(1).width(40).height(40) }.width('100%').height('100%').backgroundColor('rgba(0,0,0,0.3)') }

  @Builder private LiveBadge() { Row({ space: 4 }) { Image($r('app.media.ic_gallery_frame_overlay_camera_livephoto')).width(16).height(16).fillColor('#FFFFFF') }.padding({ left: 2, right: 2, top: 2, bottom: 2 }).margin({ top: 10, right: 10 }) }

  @Builder private LiveSoundToggle() {
    Row() { SymbolGlyph($r(this.livePhotoMuted ? 'sys.symbol.speaker_slash_fill' : 'sys.symbol.speaker_wave_2_fill')).fontSize(13).fontColor(['rgba(255,255,255,0.92)']) }
      .padding({ left: 7, right: 7, top: 6, bottom: 6 }).margin({ right: 10, bottom: 10 }).backgroundColor('rgba(0,0,0,0.28)').borderRadius(999)
      .clickEffect({ level: ClickEffectLevel.LIGHT }).onClick(() => this.toggleMute())
  }

  @Builder private LivePhotoSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(item.imageUrl || this.pictureUrl).width('100%').height('100%').objectFit(ImageFit.Contain).borderRadius(14).backgroundColor(this.theme.elevated)
          .onComplete((event) => { if (event) this.rememberLivePhotoAspectRatio(index, event.width, event.height) })
          .visibility((this.shouldShowPlayingLivePhoto(index) || this.shouldShowPausedLivePhoto(index)) ? Visibility.Hidden : Visibility.Visible)
        if (item.kind === 'livePhoto' && item.videoUrl && this.mountedLivePhotoIndices().includes(index)) {
          Video({ src: item.videoUrl, controller: this.controllerFor(index), previewUri: item.imageUrl || this.pictureUrl })
            .width('100%').height('100%').borderRadius(14).controls(false).autoPlay(this.shouldWarmLivePhoto(index)).loop(true)
            .muted(this.livePhotoMuted || !this.shouldShowPlayingLivePhoto(index)).objectFit(ImageFit.Cover)
            .opacity((this.shouldShowPlayingLivePhoto(index) || this.shouldShowPausedLivePhoto(index)) ? 1 : 0)
            .onPrepared(() => this.handleLivePhotoPrepared(index)).onStart(() => this.handleLivePhotoStart(index))
            .onPause(() => this.handleLivePhotoPause(index)).onStop(() => this.handleLivePhotoStop(index))
            .onError(() => this.handleLivePhotoError(index))
        }
      }.width('100%').height('100%')
      if (this.shouldShowLivePhotoLoading(index)) this.LoadingIndicator()
      Stack() { this.LiveBadge() }.width('100%').height('100%').align(Alignment.TopEnd)
      Stack() { this.LiveSoundToggle() }.width('100%').height('100%').align(Alignment.BottomEnd)
    }.width('100%').aspectRatio(this.resolvedMediaFrameAspectRatio())
  }

  @Builder private MediaCarousel() {
    if (this.carouselMediaItems().length > 0) {
      Stack({ alignContent: Alignment.Center }) {
        Swiper() {
          ForEach(this.carouselMediaItems(), (item: PictureCarouselMediaItem, idx: number) => {
            if (item.kind === 'livePhoto') this.LivePhotoSlide(item, idx)
            else this.FramedImageSlide(item, idx)
          }, (item: PictureCarouselMediaItem, idx: number) => `${item.kind}-${item.imageUrl}-${item.videoUrl}-${idx}-${this.livePhotoInstanceSeed(idx)}`)
        }
        .width('100%').vertical(false).autoPlay(false).displayArrow(false).effectMode(EdgeEffect.None).cachedCount(4)
        .indicator(new DotIndicator().itemWidth(6).itemHeight(6).selectedItemWidth(12).selectedItemHeight(6)
          .color($r('sys.color.comp_background_secondary')).selectedColor(this.theme.accent))
        .loop(this.carouselMediaItems().length > 1).duration(260)
        .onChange((idx: number) => { this.activeMediaIndex = idx; this.syncVisibleLivePhotoPlayback(idx) })
      }.width('100%').constraintSize({ maxHeight: 640 }).clip(true).borderRadius(14).backgroundColor(this.theme.elevated)
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column({ space: 10 }) {
        Row({ space: 8 }) {
          this.FeedAvatar()
          HighlightedInlineText({ text: this.displayAuthor(), query: this.highlightQuery, theme: this.theme, fontSize: 15, lineHeight: 20, fontWeight: FontWeight.Medium, defaultColor: this.theme.textPrimary, maxLines: 1 })
          Text('·').fontSize(12).fontColor(this.theme.textMuted)
          Text(formatPublishedAt(this.entry.publishedAt)).fontSize(12).fontColor(this.theme.textMuted)
        }.width('100%')
        if (this.caption) HighlightedInlineText({ text: this.caption, query: this.highlightQuery, theme: this.theme, fontSize: 13, lineHeight: 20, defaultColor: this.theme.textSecondary, maxLines: 2 })
        this.MediaCarousel()
        if (this.flatMode && this.showBottomDivider) Row().width('100%').height(0.8).backgroundColor(this.theme.divider).margin({ top: 6 })
      }
      .width('100%').padding({ top: 8, bottom: 10 }).alignItems(HorizontalAlign.Start)
      .transition(this.enableEnterTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
      .onVisibleAreaChange([0, 0.35, 0.6, 1.0], (isVisible: boolean, currentRatio: number) => {
        this.isNearlyVisible = isVisible && currentRatio >= 0.35
        this.isFullyVisible = isVisible && currentRatio >= 0.6
        this.syncVisibleLivePhotoPlayback(this.activeMediaIndex)
      })
      .onDisAppear(() => this.stopLivePhotoPlayback())
      .onClick(() => this.onOpen())
      this.UnreadDot()
    }
    .width('100%').padding(this.cardPadding()).backgroundColor(this.flatMode ? '#00000000' : this.theme.surface)
    .borderRadius(this.flatMode ? 0 : CARD_RADIUS_MD).border({ width: this.flatMode ? 0 : 0.8, color: this.theme.divider })
    .shadow(this.flatMode ? { radius: 0, color: '#00000000', offsetX: 0, offsetY: 0 }
      : { radius: this.theme.isDark ? 10 : 14, color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)', offsetX: 0, offsetY: 4 })
  }
}
