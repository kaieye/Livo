import { Entry, formatPublishedAt, selectPictureMediaUrls } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_MD } from '../ui/UiTokens'
import { PictureCarouselMediaItem, resolvePictureCarouselMediaItems } from '../utils/PictureGallery'
import { HighlightedInlineText } from './HighlightedInlineText'
import { LivePhotoState } from './LivePhotoState'

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
  @State private livePhotoMuted: boolean = true
  @State private isFullyVisible: boolean = false
  @State private isNearlyVisible: boolean = false
  @State private cachedCarouselItems: PictureCarouselMediaItem[] = []

  onOpen: () => void = () => {}

  private livePhoto: LivePhotoState = new LivePhotoState({
    onPrepared: (_: number) => {},
    onStart: (_: number) => {},
    onPause: (_: number) => {},
    onStop: (_: number) => {},
    onError: (_: number) => {},
  })

  aboutToAppear(): void {
    this.livePhoto = new LivePhotoState({
      onPrepared: (i: number) => this.handleLivePhotoPrepared(i),
      onStart: (i: number) => this.handleLivePhotoStart(i),
      onPause: (i: number) => this.handleLivePhotoPause(i),
      onStop: (i: number) => this.handleLivePhotoStop(i),
      onError: (i: number) => this.handleLivePhotoError(i),
    })
    this.cachedCarouselItems = this.computeCarouselMediaItems()
  }

  private computeCarouselMediaItems(): PictureCarouselMediaItem[] {
    const rawMediaUrls = this.entry.mediaUrls ?? []
    const resolved = resolvePictureCarouselMediaItems(rawMediaUrls, this.pictureUrl)
    if (resolved.length > 0) return resolved
    const galleryUrls = this.normalizedGalleryUrls()
    if (galleryUrls.length > 0) {
      return galleryUrls.map((url: string): PictureCarouselMediaItem => ({
        kind: 'image', imageUrl: url, videoUrl: '',
      }))
    }
    const singleUrl = (this.pictureUrl || '').trim()
    return singleUrl ? [{ kind: 'image', imageUrl: singleUrl, videoUrl: '' }] : []
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

  private handleLivePhotoPrepared(index: number): void {
    if (this.isNearlyVisible && this.activeMediaIndex === index) {
      this.livePhoto.handlePrepared(this.cachedCarouselItems, index)
    }
  }

  private handleLivePhotoStart(index: number): void {
    this.livePhoto.handleStart(index)
  }

  private handleLivePhotoPause(index: number): void {
    this.livePhoto.handlePause(index)
  }

  private handleLivePhotoStop(index: number): void {
    this.livePhoto.handleStop(index)
  }

  private handleLivePhotoError(index: number): void {
    this.livePhoto.handleError(index)
  }

  private handleVisibleAreaChange(isVisible: boolean, currentRatio: number): void {
    const nearlyVisible = isVisible && currentRatio >= 0.35
    const fullyVisible = isVisible && currentRatio >= 0.6
    this.isNearlyVisible = nearlyVisible
    this.isFullyVisible = fullyVisible
    this.livePhoto.isNearlyVisible = nearlyVisible
    this.livePhoto.syncPlayback(this.cachedCarouselItems, this.activeMediaIndex)
  }

  private toggleMute(): void {
    this.livePhotoMuted = !this.livePhotoMuted
    this.livePhoto.setMuted(this.livePhotoMuted)
  }

  private frameShadowColor(): string {
    return this.theme.isDark ? 'rgba(0,0,0,0.34)' : 'rgba(15,23,42,0.16)'
  }

  private cardPadding(): CardPadding {
    return this.flatMode ? { left: 0, right: 0, top: 4, bottom: 6 } : { left: 14, right: 14, top: 10, bottom: 10 }
  }

  private cardBackgroundColor(): string {
    return this.flatMode ? '#00000000' : this.theme.surface
  }

  private cardBorderWidth(): number {
    return this.flatMode ? 0 : 0.8
  }

  private cardBorderRadius(): number {
    return this.flatMode ? 0 : CARD_RADIUS_MD
  }

  @Builder
  private UnreadDot() {
    if (this.isUnread && this.showUnreadDot) {
      Row()
        .width(8).height(8).borderRadius(999)
        .backgroundColor(this.theme.accent)
        .margin({ right: 8, top: 8 })
    }
  }

  @Builder
  private FeedAvatar() {
    if (this.feedImageUrl.trim()) {
      Image(this.feedImageUrl.trim())
        .width(28).height(28).borderRadius(14)
        .backgroundColor(this.theme.elevated)
    } else {
      Stack({ alignContent: Alignment.Center }) {
        Row().width(28).height(28).borderRadius(14)
          .backgroundColor(this.theme.accent)
        Text(this.displayAuthor().substring(0, 1).toUpperCase())
          .fontSize(12).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      }
    }
  }

  @Builder
  private FramedImageSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Image(item.imageUrl || this.pictureUrl)
        .width('100%').height('100%').objectFit(ImageFit.Cover)
        .opacity(0.26).blur(14).borderRadius(14)
      Image(item.imageUrl || this.pictureUrl)
        .width('100%').height('100%').objectFit(ImageFit.Contain)
        .borderRadius(14).backgroundColor(this.theme.elevated)
        .shadow({
          radius: this.theme.isDark ? 14 : 16,
          color: this.frameShadowColor(), offsetX: 0, offsetY: 3,
        })
        .onComplete((event) => {
          if (event) this.livePhoto.rememberAspectRatio(index, event.width, event.height)
        })
    }
    .width('100%')
    .aspectRatio(this.livePhoto.frameAspectRatio(this.carouselMediaItems()))
  }

  @Builder
  private LoadingIndicator() {
    Stack({ alignContent: Alignment.Center }) {
      LoadingProgress().color(Color.White).layoutWeight(1).width(40).height(40)
    }
    .width('100%').height('100%').backgroundColor('rgba(0,0,0,0.3)')
  }

  @Builder
  private LiveBadge() {
    Row({ space: 4 }) {
      Image($r('app.media.ic_gallery_frame_overlay_camera_livephoto'))
        .width(16).height(16).fillColor('#FFFFFF')
    }
    .padding({ left: 2, right: 2, top: 2, bottom: 2 })
    .margin({ top: 10, right: 10 })
  }

  @Builder
  private LiveSoundToggle() {
    Row() {
      SymbolGlyph($r(this.livePhotoMuted ? 'sys.symbol.speaker_slash_fill' : 'sys.symbol.speaker_wave_2_fill'))
        .fontSize(13).fontColor(['rgba(255,255,255,0.92)'])
    }
    .padding({ left: 7, right: 7, top: 6, bottom: 6 })
    .margin({ right: 10, bottom: 10 })
    .backgroundColor('rgba(0,0,0,0.28)').borderRadius(999)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => this.toggleMute())
  }

  private isLivePhotoMounted(index: number): boolean {
    return this.livePhoto.mountedIndices(this.carouselMediaItems(), this.activeMediaIndex).includes(index)
  }

  @Builder
  private LivePhotoSlide(item: PictureCarouselMediaItem, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(item.imageUrl || this.pictureUrl)
          .width('100%').height('100%').objectFit(ImageFit.Contain)
          .borderRadius(14).backgroundColor(this.theme.elevated)
          .onComplete((event) => {
            if (event) this.livePhoto.rememberAspectRatio(index, event.width, event.height)
          })
          .visibility((this.livePhoto.shouldShowPlaying(index) || this.livePhoto.shouldShowPaused(index))
            ? Visibility.Hidden : Visibility.Visible)

        if (item.kind === 'livePhoto' && item.videoUrl && this.isLivePhotoMounted(index)) {
          Video({
            src: item.videoUrl,
            controller: this.livePhoto.controllerFor(index),
            previewUri: item.imageUrl || this.pictureUrl,
          })
            .width('100%').height('100%').borderRadius(14)
            .controls(false)
            .autoPlay(this.livePhoto.shouldWarm(index, index, this.carouselMediaItems()))
            .loop(true)
            .muted(this.livePhotoMuted || !this.livePhoto.shouldShowPlaying(index))
            .objectFit(ImageFit.Cover)
            .opacity((this.livePhoto.shouldShowPlaying(index) || this.livePhoto.shouldShowPaused(index)) ? 1 : 0)
            .onPrepared(() => this.livePhoto.handlePrepared(this.carouselMediaItems(), index))
            .onStart(() => this.livePhoto.handleStart(index))
            .onPause(() => this.livePhoto.handlePause(index))
            .onStop(() => this.livePhoto.handleStop(index))
            .onError(() => this.livePhoto.handleError(index))
        }
      }
      .width('100%').height('100%')

      if (this.livePhoto.shouldShowLoading(this.carouselMediaItems(), index, this.activeMediaIndex)) {
        this.LoadingIndicator()
      }

      Stack() { this.LiveBadge() }.width('100%').height('100%').align(Alignment.TopEnd)
      Stack() { this.LiveSoundToggle() }.width('100%').height('100%').align(Alignment.BottomEnd)
    }
    .width('100%').aspectRatio(this.livePhoto.frameAspectRatio(this.carouselMediaItems()))
  }

  @Builder
  private MediaCarousel() {
    if (this.carouselMediaItems().length > 0) {
      Stack({ alignContent: Alignment.Center }) {
        Swiper() {
          ForEach(this.carouselMediaItems(), (item: PictureCarouselMediaItem, idx: number) => {
            if (item.kind === 'livePhoto') {
              this.LivePhotoSlide(item, idx)
            } else {
              this.FramedImageSlide(item, idx)
            }
          }, (item: PictureCarouselMediaItem, idx: number) =>
            `${item.kind}-${item.imageUrl}-${item.videoUrl}-${idx}-${this.livePhoto.instanceSeed(idx)}`
          )
        }
        .width('100%').vertical(false).autoPlay(false).displayArrow(false)
        .effectMode(EdgeEffect.None).cachedCount(4)
        .indicator(new DotIndicator()
          .itemWidth(6).itemHeight(6)
          .selectedItemWidth(12).selectedItemHeight(6)
          .color($r('sys.color.comp_background_secondary'))
          .selectedColor(this.theme.accent))
        .loop(this.carouselMediaItems().length > 1).duration(260)
        .onChange((idx: number) => {
          this.activeMediaIndex = idx
          this.livePhoto.syncPlayback(this.carouselMediaItems(), idx)
        })
      }
      .width('100%').constraintSize({ maxHeight: 640 }).clip(true)
      .borderRadius(14).backgroundColor(this.theme.elevated)
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column({ space: 10 }) {
        Row({ space: 8 }) {
          this.FeedAvatar()
          HighlightedInlineText({
            text: this.displayAuthor(), query: this.highlightQuery, theme: this.theme,
            fontSize: 15, lineHeight: 20, fontWeight: FontWeight.Medium,
            defaultColor: this.theme.textPrimary, maxLines: 1,
          })
          Text('·').fontSize(12).fontColor(this.theme.textMuted)
          Text(formatPublishedAt(this.entry.publishedAt)).fontSize(12).fontColor(this.theme.textMuted)
        }
        .width('100%')

        if (this.caption) {
          HighlightedInlineText({
            text: this.caption, query: this.highlightQuery, theme: this.theme,
            fontSize: 13, lineHeight: 20,
            defaultColor: this.theme.textSecondary, maxLines: 2,
          })
        }

        this.MediaCarousel()

        if (this.flatMode && this.showBottomDivider) {
          Row().width('100%').height(0.8).backgroundColor(this.theme.divider).margin({ top: 6 })
        }
      }
      .width('100%').padding({ top: 8, bottom: 10 })
      .alignItems(HorizontalAlign.Start)
      .transition(this.enableEnterTransition ? livoMotion.enterSoft(this.index * 18 + 40) : TransitionEffect.IDENTITY)
      .onVisibleAreaChange([0, 0.35, 0.6, 1.0], (isVisible: boolean, currentRatio: number) => {
        this.handleVisibleAreaChange(isVisible, currentRatio)
      })
      .onDisAppear(() => this.livePhoto.stopAll())
      .onClick(() => this.onOpen())

      this.UnreadDot()
    }
    .width('100%')
    .padding(this.cardPadding())
    .backgroundColor(this.cardBackgroundColor())
    .borderRadius(this.cardBorderRadius())
    .border({ width: this.cardBorderWidth(), color: this.theme.divider })
    .shadow(this.flatMode
      ? { radius: 0, color: '#00000000', offsetX: 0, offsetY: 0 }
      : { radius: this.theme.isDark ? 10 : 14, color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)', offsetX: 0, offsetY: 4 }
    )
  }
}
