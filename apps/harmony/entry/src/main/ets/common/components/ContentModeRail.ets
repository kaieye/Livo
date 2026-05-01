import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_SM, CHIP_RADIUS } from '../ui/UiTokens'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/HomeModeMeta'
export type ContentMode = HomeMode

@Component
export struct ContentModeRail {
  @Prop mode: ContentMode = 'articles'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop interactionLocked: boolean = false
  @Prop enableEnterTransition: boolean = true
  @Prop collapsed: boolean = false
  @Prop collapseProgress: number = 0
  @State pressedMode: ContentMode | '' = ''
  private lastCommittedMode: ContentMode | '' = ''
  private lastCommittedAt: number = 0
  @State railWidth: number = 0
  onExpandRequest: () => void = () => {}
  onChange: (mode: ContentMode) => void = () => {}

  private modeIndex(mode: ContentMode): number {
    return HOME_MODES.indexOf(mode)
  }

  private isPressed(mode: ContentMode): boolean {
    return this.pressedMode === mode
  }

  private indicatorSlotWidth(): number {
    if (this.railWidth <= 0) {
      return 0
    }

    return (this.railWidth - 8) / HOME_MODES.length
  }

  private indicatorOffsetX(): number {
    return this.indicatorSlotWidth() * this.modeIndex(this.mode)
  }

  private clampedCollapseProgress(): number {
    return Math.max(0, Math.min(this.collapseProgress, 1))
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

  private transitionalItemOpacity(mode: ContentMode): number {
    if (this.mode === mode) {
      return 1
    }

    const restOpacity = this.itemOpacity(mode)
    return restOpacity * (1 - this.clampedCollapseProgress())
  }

  private activeTextColor(): string {
    return this.theme.accent
  }

  private railBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.72)' : 'rgba(255,255,255,0.72)'
  }

  private railBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'
  }

  private railBackdropBlur(): number {
    return this.theme.isDark ? 10 : 18
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

  private railShellWidth(): Length {
    if (this.collapsed) {
      return this.collapsedCircleSize()
    }

    return '100%'
  }

  private collapsedCircleSize(): number {
    return 40
  }

  private modeIconSize(collapsed: boolean = false): number {
    return collapsed ? 24 : 16
  }

  private expandedRailScale(): number {
    return 1 - this.clampedCollapseProgress() * 0.14
  }

  private railShellPadding(): Padding {
    if (this.collapsed) {
      return { left: 0, right: 0, top: 0, bottom: 0 }
    }

    return { left: 4, right: 4, top: 4, bottom: 4 }
  }

  private railShellBackgroundColor(): string {
    return this.railBackgroundColor()
  }

  private railShellBorderWidth(): number {
    return 0.8
  }

  private railShellBackdropBlur(): number {
    return this.railBackdropBlur()
  }

  private railShellBorderRadius(): number {
    return this.collapsed ? CHIP_RADIUS : CARD_RADIUS_SM
  }

  private handleCollapsedTap(): void {
    if (this.interactionLocked) {
      return
    }

    this.onExpandRequest()
  }

  private commitModeSwitch(mode: ContentMode): void {
    if (this.collapsed) {
      this.onExpandRequest()
      return
    }

    if (this.interactionLocked || mode === this.mode) {
      return
    }

    const now = Date.now()
    if (this.lastCommittedMode === mode && now - this.lastCommittedAt < 260) {
      return
    }
    this.lastCommittedMode = mode
    this.lastCommittedAt = now
    this.onChange(mode)
  }

  private labelFor(mode: ContentMode): string {
    return resolveHomeModeTitle(mode)
  }

  private modeSymbol(mode: ContentMode): Resource {
    return resolveHomeModeSymbol(mode)
  }

  @Builder
  private collapsedIcon(mode: ContentMode) {
    SymbolGlyph(this.modeSymbol(mode))
      .fontSize(this.modeIconSize(true))
      .fontColor([this.activeTextColor()])
  }

  @Builder
  private ModeIcon(mode: ContentMode) {
    SymbolGlyph(this.modeSymbol(mode))
      .fontSize(this.modeIconSize())
      .fontColor([this.mode === mode ? this.activeTextColor() : this.theme.textSecondary])
  }

  @Builder
  private ModeTab(mode: ContentMode) {
    Row({ space: 6 }) {
      this.ModeIcon(mode)

      Text(this.labelFor(mode))
        .fontSize(14)
        .fontWeight(FontWeight.Regular)
        .fontColor(this.theme.textSecondary)
    }
    .layoutWeight(1)
    .height(38)
    .justifyContent(FlexAlign.Center)
    .borderRadius(CHIP_RADIUS)
    .scale({ x: this.itemScale(mode), y: this.itemScale(mode) })
    .opacity(this.transitionalItemOpacity(mode))
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => {
      this.commitModeSwitch(mode)
    })
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
        }
      }
    })
  }

  @Builder
  private CollapsedRail() {
    Row() {
      this.collapsedIcon(this.mode)
    }
    .width(this.collapsedCircleSize())
    .height(this.collapsedCircleSize())
    .justifyContent(FlexAlign.Center)
    .borderRadius(this.collapsedCircleSize())
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => {
      this.handleCollapsedTap()
    })
    .onTouch((event: TouchEvent) => {
      if (event.type === TouchType.Down) {
        this.pressedMode = this.mode
        return
      }

      if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
        const wasPressed = this.pressedMode === this.mode
        this.pressedMode = ''
        if (event.type === TouchType.Up && wasPressed) {
          this.handleCollapsedTap()
        }
      }
    })
  }

  @Builder
  private ExpandedRail() {
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
        ForEach(HOME_MODES, (mode: ContentMode) => {
          this.ModeTab(mode)
        }, (mode: ContentMode) => mode)
      }
      .width('100%')
      .height('100%')
    }
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.collapsed) {
        this.CollapsedRail()
      } else {
        this.ExpandedRail()
      }
    }
    .width(this.railShellWidth())
    .height(this.collapsed ? this.collapsedCircleSize() : 46)
    .padding(this.railShellPadding())
    .backgroundColor(this.railShellBackgroundColor())
    .backdropBlur(this.railShellBackdropBlur())
    .borderRadius(this.railShellBorderRadius())
    .border({ width: this.railShellBorderWidth(), color: this.railBorderColor() })
    .scale({
      x: this.collapsed ? 1 : this.expandedRailScale(),
      y: this.collapsed ? 1 : this.expandedRailScale(),
    })
    .onSizeChange((_, newValue) => {
      this.updateRailWidth(newValue.width)
    })
    .transition(this.enableEnterTransition ? livoMotion.enterScale(30) : TransitionEffect.IDENTITY)
  }
}
