import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_ITEM_HEIGHT,
  BOTTOM_TAB_LABEL_SIZE,
  CHIP_RADIUS,
} from '../ui/UiTokens'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/home/HomeModeMeta'
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
  onExpandRequest: () => void = () => {}
  onChange: (mode: ContentMode) => void = () => {}

  private isPressed(mode: ContentMode): boolean {
    return this.pressedMode === mode
  }

  private clampedCollapseProgress(): number {
    return Math.max(0, Math.min(this.collapseProgress, 1))
  }

  private isActive(mode: ContentMode): boolean {
    return this.mode === mode
  }

  private activeColor(): string {
    return this.theme.isDark ? '#76A2FF' : '#2F6BFF'
  }

  private inactiveColor(): string {
    return this.theme.isDark ? '#A3A8B3' : '#9B9BA1'
  }

  private labelWeight(mode: ContentMode): number {
    return this.isActive(mode) ? FontWeight.Medium : FontWeight.Regular
  }

  private itemOffsetY(mode: ContentMode): number {
    return this.isActive(mode) ? -2 : 0
  }

  private itemScale(mode: ContentMode): number {
    if (this.interactionLocked) {
      return 1
    }

    if (this.pressedMode === mode) {
      return 0.985
    }

    return 1
  }

  private itemOpacity(mode: ContentMode): number {
    return this.isActive(mode) ? 1 : 0.94
  }

  private dockBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.85)' : 'rgba(255,255,255,0.85)'
  }

  private dockBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.94)'
  }

  private dockShadowColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.25)'
  }

  private collapsibleScale(): number {
    return 1 - this.clampedCollapseProgress() * 0.14
  }

  private collapsedCircleSize(): number {
    return 40
  }

  private modeIconSize(): number {
    return 24
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
      .fontSize(this.modeIconSize())
      .fontColor([this.activeColor()])
  }

  @Builder
  private ModeTabIcon(mode: ContentMode) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(36)
        .height(26)
        .borderRadius(CHIP_RADIUS)
        .backgroundColor('rgba(0,0,0,0)')
        .animation({ duration: 140, curve: Curve.EaseOut })

      SymbolGlyph(this.modeSymbol(mode))
        .fontSize(this.modeIconSize())
        .fontColor([this.isActive(mode) ? this.activeColor() : this.inactiveColor()])
    }
    .width(36)
    .height(26)
  }

  @Builder
  private ModeTab(mode: ContentMode) {
    Column({ space: 3 }) {
      this.ModeTabIcon(mode)

      Text(this.labelFor(mode))
        .fontSize(BOTTOM_TAB_LABEL_SIZE)
        .fontWeight(this.labelWeight(mode))
        .fontColor(this.isActive(mode) ? this.activeColor() : this.inactiveColor())
        .animation({ duration: 140, curve: Curve.EaseOut })
    }
    .alignItems(HorizontalAlign.Center)
    .justifyContent(FlexAlign.Start)
    .width(`${100 / HOME_MODES.length}%`)
    .height(BOTTOM_TAB_ITEM_HEIGHT)
    .padding({ top: 9, bottom: 2 })
    .scale({ x: this.itemScale(mode), y: this.itemScale(mode) })
    .translate({ y: this.itemOffsetY(mode) })
    .opacity(this.itemOpacity(mode))
    .animation({ duration: 140, curve: Curve.EaseOut })
    .clickEffect({ level: ClickEffectLevel.LIGHT })
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
    Row({ space: 0 }) {
      ForEach(HOME_MODES, (mode: ContentMode) => {
        this.ModeTab(mode)
      }, (mode: ContentMode) => mode)
    }
    .width('100%')
    .height('100%')
    .padding({ left: 2, right: 2 })
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.collapsed) {
        this.CollapsedRail()
      } else {
        this.ExpandedRail()
      }
    }
    .width('100%')
    .height(this.collapsed ? this.collapsedCircleSize() : BOTTOM_TAB_BAR_HEIGHT)
    .backgroundColor(this.collapsed ? Color.Transparent : this.dockBackgroundColor())
    .backdropBlur(this.collapsed ? 0 : (this.theme.isDark ? 10 : 18))
    .borderRadius(this.collapsed ? this.collapsedCircleSize() : CHIP_RADIUS)
    .border(this.collapsed ? { width: 0 } : { width: 0.6, color: this.dockBorderColor() })
    .shadow(this.collapsed ? {
      radius: 0,
      color: 'rgba(0,0,0,0)',
      offsetX: 0,
      offsetY: 0,
    } : {
      radius: 10,
      color: this.dockShadowColor(),
      offsetX: 0,
      offsetY: 2,
    })
    .scale({
      x: this.collapsed ? 1 : this.collapsibleScale(),
      y: this.collapsed ? 1 : this.collapsibleScale(),
    })
    .transition(this.enableEnterTransition ? livoMotion.enterScale(30) : TransitionEffect.IDENTITY)
  }
}
