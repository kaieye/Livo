import { SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { BOTTOM_TAB_FLOAT_GAP } from '../ui/UiTokens'
import { resolveHdsBottomTabBarBottomMargin } from '../utils/HdsBottomTabConfig'
import { HOME_MODE_RAIL_HEIGHT, SubscriptionMode } from './HomeRootConfig'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/HomeModeMeta'

@Component
export struct HomeRootOverlayControls {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  private modeTabsController: HdsTabsController = new HdsTabsController()
  onModeChange: (mode: SubscriptionMode) => void = () => {}

  private modeIndex(mode: SubscriptionMode): number {
    const i = HOME_MODES.indexOf(mode as HomeMode)
    return i >= 0 ? i : 0
  }

  private activeColor(): string {
    return this.theme.isDark ? '#76A2FF' : '#2F6BFF'
  }

  @Builder
  private ModeTabBuilder(mode: HomeMode) {
    TabContent() {
      Row().width(0).height(0)
    }
    .tabBar(BottomTabBarStyle.of({
      normal: new SymbolGlyphModifier(resolveHomeModeSymbol(mode)),
      selected: new SymbolGlyphModifier(resolveHomeModeSymbol(mode)),
    }, resolveHomeModeTitle(mode)))
  }

  build() {
    HdsTabs({
      controller: this.modeTabsController,
      index: this.modeIndex(this.mode)
    }) {
      ForEach(HOME_MODES, (m: HomeMode) => {
        this.ModeTabBuilder(m)
      }, (m: HomeMode) => m)
    }
    .width('100%')
    .height('100%')
    .vertical(false)
    .scrollable(false)
    .animationDuration(0)
    .barPosition(BarPosition.End)
    .barOverlap(true)
    .barHeight(HOME_MODE_RAIL_HEIGHT)
    .barFloatingStyle({
      barBottomMargin: resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP) + 640,
      systemMaterialEffect: {
        materialType: hdsMaterial.MaterialType.ADAPTIVE,
        materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
      },
    })
    .enabled(!this.interactionLocked)
    .onChange((index: number) => {
      const mode = HOME_MODES[index]
      if (mode) {
        this.onModeChange(mode)
      }
    })
    .clip(false)
    .zIndex(100)
  }
}