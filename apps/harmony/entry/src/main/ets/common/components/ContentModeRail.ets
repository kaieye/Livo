import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_SM, CHIP_RADIUS } from '../ui/UiTokens'
import { curves } from '@kit.ArkUI'

export type ContentMode = 'articles' | 'social' | 'pictures' | 'videos'
const CONTENT_MODES: ContentMode[] = ['articles', 'social', 'pictures', 'videos']
const INDICATOR_MOVE_DURATION: number = 100
const INDICATOR_BOUNCE_DURATION: number = 56

@Component
export struct ContentModeRail {
  @Prop mode: ContentMode = 'articles'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @State pressedMode: ContentMode | '' = ''
  @State indicatorScaleX: number = 1
  @State indicatorScaleY: number = 1
  @State emphasizedMode: ContentMode | '' = ''
  @State railWidth: number = 0
  private indicatorBounceVersion: number = 0
  private emphasisVersion: number = 0
  onChange: (mode: ContentMode) => void = () => {}

  private modeIndex(mode: ContentMode): number {
    return CONTENT_MODES.indexOf(mode)
  }

  private isPressed(mode: ContentMode): boolean {
    return this.pressedMode === mode
  }

  private indicatorSlotWidth(): number {
    if (this.railWidth <= 0) {
      return 0
    }

    return (this.railWidth - 8) / CONTENT_MODES.length
  }

  private indicatorOffsetX(): number {
    return this.indicatorSlotWidth() * this.modeIndex(this.mode)
  }

  private updateRailWidth(width: Length | undefined): void {
    if (width === undefined) {
      this.railWidth = 0
      return
    }

    if (typeof width === 'number') {
      this.railWidth = width
      return
    }

    this.railWidth = 0
  }

  private itemScale(mode: ContentMode): number {
    if (this.mode === mode) {
      return this.isPressed(mode) ? 0.98 : 1
    }

    return this.isPressed(mode) ? 0.96 : 1
  }

  private itemOpacity(mode: ContentMode): number {
    if (this.mode === mode) {
      return 1
    }

    return this.isPressed(mode) ? 0.9 : 0.94
  }

  private isEmphasized(mode: ContentMode): boolean {
    return this.emphasizedMode === mode
  }

  private iconScale(mode: ContentMode): number {
    if (this.isEmphasized(mode)) {
      return 1.12
    }

    if (this.mode === mode) {
      return 1.04
    }

    return 1
  }

  private iconOffset(mode: ContentMode): number {
    if (this.isEmphasized(mode)) {
      return -1.5
    }

    if (this.mode === mode) {
      return -0.5
    }

    return 0
  }

  private labelOffset(mode: ContentMode): number {
    if (this.isEmphasized(mode)) {
      return -0.8
    }

    return this.mode === mode ? -0.2 : 0
  }

  private activeTextColor(): string {
    return this.theme.isDark ? '#F5F8FF' : '#14213D'
  }

  private indicatorColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.92)'
  }

  private indicatorBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)'
  }

  private indicatorShadowColor(): string {
    return this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.08)'
  }

  private indicatorShadowRadius(): number {
    return this.indicatorScaleX > 1 ? 10 : 8
  }

  private triggerIndicatorBounce(nextMode: ContentMode): void {
    if (nextMode === this.mode) {
      return
    }

    this.indicatorBounceVersion += 1
    const version = this.indicatorBounceVersion
    this.indicatorScaleX = 1.055
    this.indicatorScaleY = 0.94

    setTimeout(() => {
      if (version !== this.indicatorBounceVersion) {
        return
      }

      this.indicatorScaleX = 1
      this.indicatorScaleY = 1
    }, INDICATOR_BOUNCE_DURATION)
  }

  private triggerModeEmphasis(nextMode: ContentMode): void {
    if (nextMode === this.mode) {
      return
    }

    this.emphasisVersion += 1
    const version = this.emphasisVersion
    this.emphasizedMode = nextMode

    setTimeout(() => {
      if (version !== this.emphasisVersion) {
        return
      }

      this.emphasizedMode = ''
    }, 140)
  }

  private labelFor(mode: ContentMode): string {
    switch (mode) {
      case 'articles':
        return '文章'
      case 'social':
        return '社交'
      case 'pictures':
        return '图片'
      case 'videos':
        return '视频'
      default:
        return ''
    }
  }

  @Builder
  private ModeIcon(mode: ContentMode) {
    if (mode === 'articles') {
      Image($r('app.media.sub_articles_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
        .scale({ x: this.iconScale(mode), y: this.iconScale(mode) })
        .translate({ y: this.iconOffset(mode) })
        .animation({ duration: 200, curve: curves.springMotion() })
    } else if (mode === 'social') {
      Image($r('app.media.sub_social_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
        .scale({ x: this.iconScale(mode), y: this.iconScale(mode) })
        .translate({ y: this.iconOffset(mode) })
        .animation({ duration: 200, curve: curves.springMotion() })
    } else if (mode === 'pictures') {
      Image($r('app.media.sub_pictures_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
        .scale({ x: this.iconScale(mode), y: this.iconScale(mode) })
        .translate({ y: this.iconOffset(mode) })
        .animation({ duration: 200, curve: curves.springMotion() })
    } else {
      Image($r('app.media.sub_videos_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
        .scale({ x: this.iconScale(mode), y: this.iconScale(mode) })
        .translate({ y: this.iconOffset(mode) })
        .animation({ duration: 200, curve: curves.springMotion() })
    }
  }

  @Builder
  private ModeTab(mode: ContentMode) {
    Row({ space: 6 }) {
      this.ModeIcon(mode)

      Text(this.labelFor(mode))
        .fontSize(14)
        .fontWeight(this.mode === mode ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.mode === mode ? this.activeTextColor() : this.theme.textSecondary)
        .translate({ y: this.labelOffset(mode) })
        .animation({ duration: 160, curve: Curve.EaseInOut })
    }
    .layoutWeight(1)
    .height(38)
    .justifyContent(FlexAlign.Center)
    .borderRadius(CHIP_RADIUS)
    .scale({ x: this.itemScale(mode), y: this.itemScale(mode) })
    .opacity(this.itemOpacity(mode))
    .animation({ duration: 160, curve: Curve.EaseInOut })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onTouch((event: TouchEvent) => {
      if (event.type === TouchType.Down) {
        this.pressedMode = mode
        return
      }

      if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
        if (this.pressedMode === mode) {
          this.pressedMode = ''
        }
      }
    })
    .onClick(() => {
      this.triggerIndicatorBounce(mode)
      this.triggerModeEmphasis(mode)
      this.onChange(mode)
    })
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row() {
        Row()
          .width(this.indicatorSlotWidth())
          .height(38)
          .scale({ x: this.indicatorScaleX, y: this.indicatorScaleY })
          .translate({ x: this.indicatorOffsetX() })
          .backgroundColor(this.indicatorColor())
          .borderRadius(CHIP_RADIUS)
          .border({ width: 0.6, color: this.indicatorBorderColor() })
          .shadow({
            radius: this.indicatorShadowRadius(),
            color: this.indicatorShadowColor(),
            offsetX: 0,
            offsetY: 2,
          })
          .animation({ duration: INDICATOR_MOVE_DURATION, curve: Curve.EaseOut })
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Start)

      Row({ space: 0 }) {
        ForEach(CONTENT_MODES, (mode: ContentMode) => {
          this.ModeTab(mode)
        }, (mode: ContentMode) => mode)
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height(46)
    .padding(4)
    .backgroundColor(this.theme.elevated)
    .borderRadius(CARD_RADIUS_SM)
    .border({ width: 0.8, color: this.theme.divider })
    .onSizeChange((_, newValue) => {
      this.updateRailWidth(newValue.width)
    })
    .transition(livoMotion.enterScale(30))
  }
}
