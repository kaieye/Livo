import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  SubscriptionMode,
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT,
} from './HomeRootConfig'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/HomeModeMeta'
import {
  BOTTOM_TAB_LABEL_SIZE,
  CHIP_RADIUS,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'

const HOME_MODE_TABS_TOP_OFFSET: number = -8
const MODE_ICON_SIZE: number = 24

@Component
export struct HomeRootOverlayControls {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  @State pressedMode: SubscriptionMode | '' = ''
  private lastCommittedMode: SubscriptionMode | '' = ''
  private lastCommittedAt: number = 0

  onModeChange: (mode: SubscriptionMode) => void = () => {}

  private isActive(m: SubscriptionMode): boolean {
    return this.mode === m
  }

  private activeColor(): string {
    return this.theme.isDark ? '#76A2FF' : '#2F6BFF'
  }

  private inactiveColor(): string {
    return this.theme.isDark ? '#A3A8B3' : '#9B9BA1'
  }

  private labelWeight(m: SubscriptionMode): number {
    return this.isActive(m) ? FontWeight.Medium : FontWeight.Regular
  }

  private itemScale(m: SubscriptionMode): number {
    if (this.interactionLocked) {
      return 1
    }
    if (this.pressedMode === m) {
      return 0.985
    }
    return 1
  }

  private itemOpacity(m: SubscriptionMode): number {
    return this.isActive(m) ? 1 : 0.94
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

  private commitModeSwitch(m: SubscriptionMode): void {
    if (this.interactionLocked || m === this.mode) {
      return
    }
    const now = Date.now()
    if (this.lastCommittedMode === m && now - this.lastCommittedAt < 260) {
      return
    }
    this.lastCommittedMode = m
    this.lastCommittedAt = now
    this.onModeChange(m)
  }

  @Builder
  private ModeTabItem(m: HomeMode) {
    Column({ space: 3 }) {
      SymbolGlyph(resolveHomeModeSymbol(m))
        .fontSize(MODE_ICON_SIZE)
        .fontColor([this.isActive(m) ? this.activeColor() : this.inactiveColor()])

      Text(resolveHomeModeTitle(m))
        .fontSize(BOTTOM_TAB_LABEL_SIZE)
        .fontWeight(this.labelWeight(m))
        .fontColor(this.isActive(m) ? this.activeColor() : this.inactiveColor())
    }
    .alignItems(HorizontalAlign.Center)
    .justifyContent(FlexAlign.Start)
    .padding({ top: 9, bottom: 2, left: 16, right: 16 })
    .scale({ x: this.itemScale(m), y: this.itemScale(m) })
    .opacity(this.itemOpacity(m))
    .animation({ duration: 140, curve: Curve.EaseOut })
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .onClick(() => {
      this.commitModeSwitch(m)
    })
    .onTouch((event: TouchEvent) => {
      if (this.interactionLocked) {
        this.pressedMode = ''
        return
      }
      if (event.type === TouchType.Down) {
        this.pressedMode = m
        return
      }
      if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
        if (this.pressedMode === m) {
          this.pressedMode = ''
        }
      }
    })
  }

  @Builder
  private ModeRail() {
    Row({ space: 0 }) {
      ForEach(HOME_MODES, (m: HomeMode) => {
        this.ModeTabItem(m)
      }, (m: HomeMode) => m)
    }
    .padding({ left: 2, right: 2 })
    .backgroundColor(this.dockBackgroundColor())
    .backdropBlur(this.theme.isDark ? 10 : 18)
    .borderRadius(CHIP_RADIUS)
    .border({ width: 0.6, color: this.dockBorderColor() })
    .shadow({
      radius: 10,
      color: this.dockShadowColor(),
      offsetX: 0,
      offsetY: 2,
    })
    .hitTestBehavior(HitTestMode.Block)
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        this.ModeRail()
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .padding({
        top: HOME_MODE_CONTENT_TOP_SPACER_HEIGHT + HOME_MODE_TABS_TOP_OFFSET,
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
      })
      .zIndex(100)
    }
    .width('100%')
    .hitTestBehavior(HitTestMode.Transparent)
  }
}
