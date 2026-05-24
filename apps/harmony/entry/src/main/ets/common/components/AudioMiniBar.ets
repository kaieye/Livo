import {
  hdsMaterial,
  HdsTabs,
  HdsTabsController,
} from '@kit.UIDesignKit'
import { ThemePalette } from '../services/ThemeService'
import { AudioPlaybackService } from '../services/AudioPlaybackService'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
} from '../ui/UiTokens'
import { resolveHdsBottomTabBarBottomMargin } from '../utils/index-home/HdsBottomTabConfig'
import { HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY } from '../utils/index-home/HomeChromeProgressStore'

const AUDIO_MINI_BAR_HEIGHT: number = 44
const AUDIO_MINI_BAR_STACK_GAP: number = 10
const AUDIO_MINI_BAR_HORIZONTAL_PADDING: number = 14
const AUDIO_MINI_BAR_CONTROL_GAP: number = 10
const AUDIO_MINI_BAR_TEXT_GAP: number = 4
const AUDIO_MINI_BAR_TITLE_HEIGHT: number = 16
const AUDIO_MINI_BAR_PROGRESS_HEIGHT: number = 14
const AUDIO_MINI_BAR_SPEED_BUTTON_WIDTH: number = 42
const AUDIO_MINI_BAR_SMALL_WIDTH: number = 330
const AUDIO_MINI_BAR_MEDIUM_WIDTH: number = 360
const AUDIO_MINI_BAR_LARGE_WIDTH: number = 390
const AUDIO_MINI_BAR_COMPACT_HEIGHT: number = 57
const AUDIO_MINI_BAR_COMPACT_SMALL_WIDTH: number = 200
const AUDIO_MINI_BAR_COMPACT_MEDIUM_WIDTH: number = 240
const AUDIO_MINI_BAR_COMPACT_LARGE_WIDTH: number = 280
const AUDIO_MINI_BAR_TOUCH_BUFFER: number = 8

@Component
export struct AudioMiniBar {
  @Prop theme: ThemePalette = {} as ThemePalette
  @StorageProp('bottomAvoidArea') private bottomAvoidArea: number = 0
  @StorageProp('audioServiceShouldShow') private shouldShow: boolean = false
  @StorageProp('audioServicePlaying') private playing: boolean = false
  @StorageProp('audioServiceTrackTitle') private trackTitle: string = ''
  @StorageProp('audioServicePositionMs') private positionMs: number = 0
  @StorageProp('audioServiceDurationMs') private durationMs: number = 0
  @StorageProp('audioServiceSpeed') private playbackSpeed: number = 1.0
  // 折叠进度由 Index 写入 AppStorage,本组件订阅并在节点上跑 .animation(),
  // 避免 Index 顶层因 @State 进度变化触发整树 rebuild。
  @StorageProp(HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY) private scrollCollapseProgress: number = 0
  @Prop isHomeRootTab: boolean = false

  private readonly audioService: AudioPlaybackService = AudioPlaybackService.getInstance()
  private readonly tabsController: HdsTabsController = new HdsTabsController()

  private resolveBottomPadding(): number {
    return resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP)
      + BOTTOM_TAB_BAR_HEIGHT
      + this.bottomAvoidArea
      + AUDIO_MINI_BAR_STACK_GAP
  }

  private resolveBarHeight(): number {
    if (!this.isHomeRootTab) {
      return AUDIO_MINI_BAR_HEIGHT
    }
    return AUDIO_MINI_BAR_HEIGHT
      + (AUDIO_MINI_BAR_COMPACT_HEIGHT - AUDIO_MINI_BAR_HEIGHT) * this.scrollCollapseProgress
  }

  private resolveBarBottomMargin(): number {
    if (!this.isHomeRootTab) {
      return this.resolveBottomPadding()
    }
    const fullMargin = this.resolveBottomPadding()
    const compactMargin = resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP) + this.bottomAvoidArea
    return fullMargin + (compactMargin - fullMargin) * this.scrollCollapseProgress
  }

  private resolveOverlayHeight(): number {
    return this.resolveBarBottomMargin() + this.resolveBarHeight() + AUDIO_MINI_BAR_TOUCH_BUFFER
  }

  private formatTime(valueMs: number): string {
    const seconds = Math.max(0, Math.floor((valueMs || 0) / 1000))
    const minutes = Math.floor(seconds / 60)
    const restSeconds = seconds % 60
    return `${minutes}:${restSeconds < 10 ? '0' : ''}${restSeconds}`
  }

  private currentProgressLabel(): string {
    return `${this.formatTime(this.positionMs)} / ${this.formatTime(this.durationMs)}`
  }

  private togglePlayPause(): void {
    if (this.playing) {
      void this.audioService.pause()
      return
    }
    void this.audioService.resume()
  }

  private cycleSpeed(): void {
    this.audioService.cyclePlaybackSpeed()
  }

  private formatSpeedLabel(): string {
    const rate = this.playbackSpeed || 1.0
    if (Math.abs(rate - Math.floor(rate)) < 0.001) {
      return `${rate.toFixed(0)}×`
    }
    return `${rate.toFixed(2).replace(/0$/, '')}×`
  }

  private handleClose(): void {
    this.audioService.stop()
  }

  private resolveFullContentOpacity(): number {
    if (!this.isHomeRootTab) {
      return 1
    }
    return Math.max(0, 1 - this.scrollCollapseProgress * 2)
  }

  private resolveCompactContentOpacity(): number {
    if (!this.isHomeRootTab) {
      return 0
    }
    return Math.max(0, this.scrollCollapseProgress * 2 - 1)
  }

  @Builder
  private UnifiedAudioBarBuilder() {
    Stack() {
      Row({ space: AUDIO_MINI_BAR_CONTROL_GAP }) {
      Column({ space: AUDIO_MINI_BAR_TEXT_GAP }) {
        // 标题使用 TextOverflow.MARQUEE，只有溢出时才滚动，行为比独立 Marquee 更稳定。
        Text(this.trackTitle || '音频')
          .width('100%')
          .height(AUDIO_MINI_BAR_TITLE_HEIGHT)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.MARQUEE })
          .marqueeOptions({
            start: true,
            fromStart: true,
            step: 6,
            loop: -1,
            delay: 0,
            fadeout: false,
            marqueeStartPolicy: MarqueeStartPolicy.DEFAULT,
          })

        Row({ space: 6 }) {
          Slider({
            value: this.positionMs,
            min: 0,
            max: Math.max(1, this.durationMs),
            step: 1000,
          })
            .layoutWeight(1)
            .blockSize({ width: 5, height: 5 })
            .onChange((nextValue: number) => {
              this.audioService.seekTo(Math.floor(nextValue))
            })

          Text(this.currentProgressLabel())
            .fontSize(10)
            .fontColor(this.theme.textMuted)
            .flexShrink(0)
        }
        .width('100%')
        .height(AUDIO_MINI_BAR_PROGRESS_HEIGHT)
        .alignItems(VerticalAlign.Center)
      }
      .layoutWeight(1)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)

      Row({ space: 2 }) {
        Row() {
          SymbolGlyph($r(this.playing ? 'sys.symbol.pause_fill' : 'sys.symbol.play_fill'))
            .fontSize(22)
            .fontColor([this.theme.textPrimary])
        }
        .width(28)
        .height(32)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .onClick(() => this.togglePlayPause())

        Row() {
          Text(this.formatSpeedLabel())
            .fontSize(13)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
        }
        .width(AUDIO_MINI_BAR_SPEED_BUTTON_WIDTH)
        .height(28)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .onClick(() => this.cycleSpeed())

        Row() {
          SymbolGlyph($r('sys.symbol.xmark'))
            .fontSize(16)
            .fontColor([this.theme.textSecondary])
        }
        .width(24)
        .height(28)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .onClick(() => this.handleClose())
      }
      .margin({ top: -5 })
    }
    .width('100%')
    .height(this.resolveBarHeight())
    .padding({ left: AUDIO_MINI_BAR_HORIZONTAL_PADDING, right: AUDIO_MINI_BAR_HORIZONTAL_PADDING - 2 })
    .alignItems(VerticalAlign.Center)
    .opacity(this.resolveFullContentOpacity())

    Row({ space: 8 }) {
      Text(this.trackTitle || '音频')
        .layoutWeight(1)
        .maxLines(1)
        .fontSize(14)
        .fontColor(this.theme.textPrimary)
        .textOverflow({ overflow: TextOverflow.MARQUEE })
        .marqueeOptions({
          start: true,
          fromStart: true,
          step: 6,
          loop: -1,
          delay: 0,
          fadeout: false,
          marqueeStartPolicy: MarqueeStartPolicy.DEFAULT,
        })

      Stack() {
        Progress({
          value: this.positionMs,
          total: Math.max(1, this.durationMs),
          type: ProgressType.Ring,
        })
          .width(36)
          .height(36)
          .color('#7A5AF8')
          .style({ strokeWidth: 2.5, scaleCount: 0, scaleWidth: 0 })

        Row() {
          SymbolGlyph($r(this.playing ? 'sys.symbol.pause_fill' : 'sys.symbol.play_fill'))
            .fontSize(20)
            .fontColor([this.theme.textPrimary])
        }
        .width(28)
        .height(32)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .hitTestBehavior(HitTestMode.Block)
        .onClick(() => this.togglePlayPause())
      }
      .width(36)
      .height(36)

      Row() {
        SymbolGlyph($r('sys.symbol.xmark'))
          .fontSize(16)
          .fontColor([this.theme.textSecondary])
      }
      .width(24)
      .height(28)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .onClick(() => this.handleClose())
    }
    .width('100%')
    .height(this.resolveBarHeight())
    .padding({ left: AUDIO_MINI_BAR_HORIZONTAL_PADDING, right: AUDIO_MINI_BAR_HORIZONTAL_PADDING - 2 })
    .alignItems(VerticalAlign.Center)
    .translate({ y: -6 })
    .opacity(this.resolveCompactContentOpacity())
  }
  .width('100%')
  .height(this.resolveBarHeight())
}

  @Builder
  private AudioTabContentBuilder() {
    Row().width(0).height(0)
  }

  build() {
    if (!this.shouldShow) {
      Stack() {
      }
      .width(0)
      .height(0)
    } else {
      Stack({ alignContent: Alignment.Bottom }) {
        HdsTabs({ controller: this.tabsController, index: 0 }) {
          TabContent() {
            this.AudioTabContentBuilder()
          }
          .tabBar(this.UnifiedAudioBarBuilder())
        }
        .width('100%')
        .height(this.resolveOverlayHeight())
        .vertical(false)
        .scrollable(false)
        .animationDuration(0)
        .barPosition(BarPosition.End)
        .barOverlap(true)
        .barHeight(this.resolveBarHeight())
        .barFloatingStyle({
          barWidth: this.isHomeRootTab ? {
            smallWidth: AUDIO_MINI_BAR_SMALL_WIDTH - Math.floor((AUDIO_MINI_BAR_SMALL_WIDTH - AUDIO_MINI_BAR_COMPACT_SMALL_WIDTH) * this.scrollCollapseProgress),
            mediumWidth: AUDIO_MINI_BAR_MEDIUM_WIDTH - Math.floor((AUDIO_MINI_BAR_MEDIUM_WIDTH - AUDIO_MINI_BAR_COMPACT_MEDIUM_WIDTH) * this.scrollCollapseProgress),
            largeWidth: AUDIO_MINI_BAR_LARGE_WIDTH - Math.floor((AUDIO_MINI_BAR_LARGE_WIDTH - AUDIO_MINI_BAR_COMPACT_LARGE_WIDTH) * this.scrollCollapseProgress),
          } : {
            smallWidth: AUDIO_MINI_BAR_SMALL_WIDTH,
            mediumWidth: AUDIO_MINI_BAR_MEDIUM_WIDTH,
            largeWidth: AUDIO_MINI_BAR_LARGE_WIDTH,
          },
          barBottomMargin: this.resolveBarBottomMargin(),
          systemMaterialEffect: {
            materialType: hdsMaterial.MaterialType.ADAPTIVE,
            materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
          },
          adaptToHandedness: false,
          barOpacity: 1,
        })
        .backgroundColor(Color.Transparent)
        .clip(false)
        .animation({ duration: 200, curve: Curve.EaseInOut })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(Color.Transparent)
      .clip(false)
      .hitTestBehavior(HitTestMode.Transparent)
    }
  }
}
