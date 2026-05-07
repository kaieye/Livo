import { ThemePalette } from '../services/ThemeService'
import { AudioPlaybackService } from '../services/AudioPlaybackService'

@Component
export struct MiniAudioPlayer {
  @Prop theme: ThemePalette = {} as ThemePalette
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @StorageProp('audioServiceShouldShow') private shouldShow: boolean = false
  @StorageProp('audioServicePlaying') @Watch('onPlayingChanged') private playing: boolean = false
  @StorageProp('audioServiceTrackTitle') private trackTitle: string = ''
  @StorageProp('audioServicePositionMs') private positionMs: number = 0
  @StorageProp('audioServiceDurationMs') private durationMs: number = 0
  @State private collapsed: boolean = false
  private audioService: AudioPlaybackService = AudioPlaybackService.getInstance()

  private readonly EXPANDED_WIDTH: number = 328
  private readonly PLAYER_HEIGHT: number = 52
  private readonly COLLAPSED_SIZE: number = 42
  private readonly BOTTOM_OFFSET: number = 72

  aboutToAppear(): void {
    this.collapsed = false
  }

  onPlayingChanged(): void {
    if (this.playing) {
      this.collapsed = true
    }
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

  private togglePlayPause(): void {
    if (this.playing) {
      void this.audioService.pause()
    } else {
      void this.audioService.resume()
    }
  }

  build() {
    if (!this.shouldShow) {
      Stack() {}
    } else if (this.collapsed) {
      Row() {
        SymbolGlyph($r(this.playing ? 'sys.symbol.pause_fill' : 'sys.symbol.play_fill'))
          .fontSize(20)
          .fontColor([this.theme.accent])
      }
      .width(this.COLLAPSED_SIZE)
      .height(this.COLLAPSED_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.theme.surface)
      .border({ width: 0.8, color: this.theme.divider })
      .borderRadius(999)
      .shadow({
        radius: 12,
        color: this.theme.isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.10)',
        offsetY: 2,
      })
      .margin({ right: 12, bottom: this.bottomAvoidArea + this.BOTTOM_OFFSET })
      .onClick(() => {
        this.collapsed = false
      })
    } else {
      Row({ space: 0 }) {
        Row() {
          SymbolGlyph($r(this.playing ? 'sys.symbol.pause_fill' : 'sys.symbol.play_fill'))
            .fontSize(22)
            .fontColor([this.theme.accent])
        }
        .width(38)
        .height(38)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor(this.theme.elevated)
        .borderRadius(999)
        .onClick(() => {
          this.togglePlayPause()
        })

        Column({ space: 2 }) {
          Text(this.trackTitle || '音频')
            .fontSize(13)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width(140)

          Row({ space: 0 }) {
            Row() {
              Blank()
                .width(this.progressWidth())
                .height(3)
                .backgroundColor(this.theme.accent)
                .borderRadius(999)
            }
            .width(96)
            .height(3)
            .backgroundColor(this.theme.divider)
            .borderRadius(999)
            .clip(true)

            Text(`${this.formatTime(this.positionMs)} / ${this.formatTime(this.durationMs)}`)
              .fontSize(10)
              .fontColor(this.theme.textMuted)
              .margin({ left: 6 })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
        .margin({ left: 10 })

        Row({ space: 2 }) {
          Row() {
            SymbolGlyph($r('sys.symbol.chevron_right'))
              .fontSize(18)
              .fontColor([this.theme.textSecondary])
          }
          .width(30)
          .height(30)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .borderRadius(8)
          .onClick(() => {
            this.collapsed = true
          })

          Row() {
            SymbolGlyph($r('sys.symbol.xmark'))
              .fontSize(16)
              .fontColor([this.theme.textSecondary])
          }
          .width(30)
          .height(30)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .borderRadius(8)
          .onClick(() => {
            this.audioService.stop()
            this.collapsed = false
          })
        }
      }
      .width(this.EXPANDED_WIDTH)
      .height(this.PLAYER_HEIGHT)
      .padding({ left: 12, right: 8 })
      .backgroundColor(this.theme.surface)
      .border({ width: 0.8, color: this.theme.divider })
      .borderRadius(14)
      .margin({ right: 12, bottom: this.bottomAvoidArea + this.BOTTOM_OFFSET })
      .shadow({
        radius: 16,
        color: this.theme.isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.12)',
        offsetY: 4,
      })
    }
  }
}
