import { SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { HOME_MODE_RAIL_HEIGHT, HOME_TITLE_BAR_OVERLAY_SPACER, SubscriptionMode } from './HomeRootConfig'
import { SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER } from './SubscriptionsConstants'
import { BOTTOM_TAB_FLOAT_GAP } from '../ui/UiTokens'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/HomeModeMeta'

const SUBS_RAIL_EXTRA_MARGIN: number = HOME_TITLE_BAR_OVERLAY_SPACER - SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER

@Component
export struct SubscriptionsModeRail {
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  @Prop barBottomMargin: number = BOTTOM_TAB_FLOAT_GAP + 10 + 640 + SUBS_RAIL_EXTRA_MARGIN
  private modeTabsController: HdsTabsController = new HdsTabsController()
  onModeChange: (mode: SubscriptionMode) => void = () => {}

  private modeIndex(mode: SubscriptionMode): number {
    const i = HOME_MODES.indexOf(mode as HomeMode)
    return i >= 0 ? i : 0
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
      barBottomMargin: this.barBottomMargin,
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
