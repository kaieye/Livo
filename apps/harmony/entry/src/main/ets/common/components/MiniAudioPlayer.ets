import { ThemePalette } from '../services/ThemeService'
import { AudioPlaybackService } from '../services/AudioPlaybackService'
import {
  BOTTOM_TAB_FLOAT_GAP,
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_TOTAL_HEIGHT,
  BOTTOM_TAB_BAR_WIDTH,
} from '../ui/UiTokens'

@Component
export struct MiniAudioPlayer {
  @Prop theme: ThemePalette = {} as ThemePalette
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @StorageProp('audioServiceShouldShow') private shouldShow: boolean = false
  @StorageProp('audioServicePlaying') private playing: boolean = false
  @StorageProp('audioServiceTrackTitle') private trackTitle: string = ''
  @StorageProp('audioServicePositionMs') private positionMs: number = 0
  @StorageProp('audioServiceDurationMs') private durationMs: number = 0
  @StorageLink('audioPlayerCollapsed') private collapsed: boolean = false
  private audioService: AudioPlaybackService = AudioPlaybackService.getInstance()

  private readonly PANEL_HEIGHT: number = 44
  private readonly PANEL_RADIUS: number = 24
  private readonly PANEL_HORIZONTAL_PADDING: number = 16
  private readonly PANEL_VERTICAL_PADDING: number = 3
  private readonly CONTROL_BUTTON_SIZE: number = 26
  private readonly PANEL_CONTENT_HEIGHT: number = 26

  private floatingPlayerBottomPadding(): number {
    return BOTTOM_TAB_FLOAT_GAP + BOTTOM_TAB_BAR_HEIGHT + this.bottomAvoidArea + 16
  }

  aboutToAppear(): void {
    // We use StorageLink to persist the collapsed state, so we don't force it here
  }

  private progressWidth(): string {
    if (this.durationMs <= 0) {
      return '0%'
    }
    const percent = Math.max(0, Math.min(100, (this.positionMs / this.durationMs) * 100))
    return `${percent}%`
  }

  private formatTime(valueMs: number): string {
    const seconds = Math.max(0, Math.floor((valueMs || 0) / 1000))
    const minutes = Math.floor(seconds / 60)
    const restSeconds = seconds % 60
    return `${minutes}:${restSeconds < 10 ? '0' : ''}${restSeconds}`
  }

  private dockBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.94)'
  }

  private dockShadowColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.25)'
  }

  private dockBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.85)' : 'rgba(255,255,255,0.85)'
  }

  private activeColor(): string {
    return this.theme.isDark ? '#76A2FF' : '#2F6BFF'
  }

  private currentProgressLabel(): string {
    return `${this.formatTime(this.positionMs)} / ${this.formatTime(this.durationMs)}`
  }

  private togglePlayPause(): void {
    if (this.playing) {
      void this.audioService.pause()
    } else {
      void this.audioService.resume()
    }
  }

  @Builder
  private DockPanel(expanded: boolean) {
    Row({ space: 8 }) {
      Column({ space: 2 }) {
        Marquee({ src: this.trackTitle || '音频', start: true, step: 6, loop: -1, fromStart: true })
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .height(12)

        Row({ space: 6 }) {
          Slider({
            value: this.positionMs,
            min: 0,
            max: Math.max(1, this.durationMs),
            step: 1000,
          })
            .layoutWeight(1)
            .blockSize({ width: 8, height: 8 })
            .onChange((nextValue: number) => {
              this.audioService.seekTo(Math.floor(nextValue))
            })

          Text(this.currentProgressLabel())
            .fontSize(9)
            .fontColor(this.theme.textMuted)
            .flexShrink(0)
        }
        .height(12)
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      .height(this.PANEL_CONTENT_HEIGHT)
      .justifyContent(FlexAlign.SpaceBetween)
      .layoutWeight(1)
      .margin({ right: 6 })
      .alignItems(HorizontalAlign.Start)

      Row({ space: 3 }) {
        Row() {
          SymbolGlyph($r(this.playing ? 'sys.symbol.pause_fill' : 'sys.symbol.play_fill'))
            .fontSize(16)
            .fontColor([this.theme.textSecondary])
        }
        .width(this.CONTROL_BUTTON_SIZE)
        .height(this.CONTROL_BUTTON_SIZE)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor(this.theme.surface)
        .borderRadius(999)
        .border({ width: 0.6, color: this.theme.divider })
        .onClick(() => {
          this.togglePlayPause()
        })

        Row() {
          SymbolGlyph($r(expanded ? 'sys.symbol.chevron_right' : 'sys.symbol.chevron_left'))
            .fontSize(16)
            .fontColor([this.theme.textSecondary])
        }
        .width(this.CONTROL_BUTTON_SIZE)
        .height(this.CONTROL_BUTTON_SIZE)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor(this.theme.surface)
        .borderRadius(999)
        .border({ width: 0.6, color: this.theme.divider })
        .onClick(() => {
          this.collapsed = true
        })

        if (expanded) {
          Row() {
            SymbolGlyph($r('sys.symbol.xmark'))
              .fontSize(13)
              .fontColor([this.theme.textSecondary])
          }
          .width(this.CONTROL_BUTTON_SIZE)
          .height(this.CONTROL_BUTTON_SIZE)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .backgroundColor(this.theme.surface)
          .borderRadius(999)
          .border({ width: 0.6, color: this.theme.divider })
          .onClick(() => {
            this.audioService.stop()
            this.collapsed = false
          })
        }
      }
      .height(this.PANEL_CONTENT_HEIGHT)
      .alignItems(VerticalAlign.Top)
    }
    .width(BOTTOM_TAB_BAR_WIDTH)
    .height(this.PANEL_HEIGHT)
    .backgroundColor(this.dockBackgroundColor())
    .backdropBlur(this.theme.isDark ? 16 : 22)
    .borderRadius(this.PANEL_RADIUS)
    .clip(true)
    .border({ width: 0.6, color: this.dockBorderColor() })
    .shadow({
      radius: 14,
      color: this.dockShadowColor(),
      offsetX: 0,
      offsetY: 4,
    })
    .padding({ left: this.PANEL_HORIZONTAL_PADDING, right: this.PANEL_HORIZONTAL_PADDING, top: this.PANEL_VERTICAL_PADDING, bottom: this.PANEL_VERTICAL_PADDING })
  }

  @Builder
  private CollapsedBubble() {
    Row() {
      SymbolGlyph($r('sys.symbol.chevron_left'))
        .fontSize(18)
        .fontColor([this.theme.textSecondary])
    }
    .width(this.CONTROL_BUTTON_SIZE + this.PANEL_HORIZONTAL_PADDING)
    .height(this.PANEL_HEIGHT)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.dockBackgroundColor())
    .backdropBlur(this.theme.isDark ? 16 : 22)
    .borderRadius({
      topLeft: this.PANEL_RADIUS,
      bottomLeft: this.PANEL_RADIUS,
      topRight: 0,
      bottomRight: 0,
    })
    .border({ width: 0.6, color: this.dockBorderColor() })
    .shadow({
      radius: 12,
      color: this.dockShadowColor(),
      offsetX: 0,
      offsetY: 4,
    })
    .onClick(() => {
      this.collapsed = false
    })
  }

  build() {
    if (!this.shouldShow) {
      Stack() {}
        .width(0)
        .height(0)
    } else if (this.collapsed) {
      Stack({ alignContent: Alignment.BottomEnd }) {
        this.CollapsedBubble()
      }
      .width('100%')
      .height('100%')
      .backgroundColor(Color.Transparent)
      .hitTestBehavior(HitTestMode.Transparent)
      .padding({ bottom: this.floatingPlayerBottomPadding() })
    } else {
      Stack({ alignContent: Alignment.Bottom }) {
        this.DockPanel(true)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(Color.Transparent)
      .hitTestBehavior(HitTestMode.Transparent)
      .padding({ bottom: this.floatingPlayerBottomPadding() })
    }
  }
}
