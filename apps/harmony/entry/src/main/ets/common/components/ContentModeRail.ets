import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_SM, CHIP_RADIUS } from '../ui/UiTokens'
export type ContentMode = 'articles' | 'social' | 'pictures' | 'videos'
const CONTENT_MODES: ContentMode[] = ['articles', 'social', 'pictures', 'videos']

@Component
export struct ContentModeRail {
  @Prop mode: ContentMode = 'articles'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop interactionLocked: boolean = false
  @Prop enableEnterTransition: boolean = true
  @State pressedMode: ContentMode | '' = ''
  @State railWidth: number = 0
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
    if (this.interactionLocked) {
      return 1
    }

    if (this.mode === mode) {
      return this.isPressed(mode) ? 0.98 : 1
    }

    return this.isPressed(mode) ? 0.96 : 1
  }

  private itemOpacity(mode: ContentMode): number {
    if (this.interactionLocked) {
      return this.mode === mode ? 1 : 0.94
    }

    if (this.mode === mode) {
      return 1
    }

    return this.isPressed(mode) ? 0.9 : 0.94
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
    return 8
  }

  private commitModeSwitch(mode: ContentMode): void {
    if (this.interactionLocked || mode === this.mode) {
      return
    }

    this.onChange(mode)
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
    } else if (mode === 'social') {
      Image($r('app.media.sub_social_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else if (mode === 'pictures') {
      Image($r('app.media.sub_pictures_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else {
      Image($r('app.media.sub_videos_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
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
    }
    .layoutWeight(1)
    .height(38)
    .justifyContent(FlexAlign.Center)
    .borderRadius(CHIP_RADIUS)
    .scale({ x: this.itemScale(mode), y: this.itemScale(mode) })
    .opacity(this.itemOpacity(mode))
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onTouch((event: TouchEvent) => {
      if (this.interactionLocked) {
        this.pressedMode = ''
        return
      }

      if (event.type === TouchType.Down) {
        this.pressedMode = mode
        return
      }

      if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
        if (this.pressedMode === mode) {
          this.pressedMode = ''
          if (event.type === TouchType.Up) {
            this.commitModeSwitch(mode)
          }
        }
      }
    })
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row() {
        Row()
          .width(this.indicatorSlotWidth())
          .height(38)
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
    .transition(this.enableEnterTransition ? livoMotion.enterScale(30) : TransitionEffect.IDENTITY)
  }
}
