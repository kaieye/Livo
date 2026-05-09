import { SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  SubscriptionMode,
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT,
} from './HomeRootConfig'
import { HOME_MODES, HomeMode, resolveHomeModeSymbol, resolveHomeModeTitle } from '../utils/HomeModeMeta'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_LABEL_SIZE,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'

const HOME_MODE_TABS_TOP_OFFSET: number = -8

@Component
export struct HomeRootOverlayControls {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  private tabsController: HdsTabsController = new HdsTabsController()

  onModeChange: (mode: SubscriptionMode) => void = () => {}

  private modeIndex(m: SubscriptionMode): number {
    const i = HOME_MODES.indexOf(m as HomeMode)
    return i >= 0 ? i : 0
  }

  @Builder
  private ModeTabs() {
    HdsTabs({ controller: this.tabsController, index: this.modeIndex(this.mode) }) {
      ForEach(HOME_MODES, (m: HomeMode) => {
        TabContent() {
          Row().width(0).height(0)
        }
        .tabBar(BottomTabBarStyle.of({
          normal: new SymbolGlyphModifier(resolveHomeModeSymbol(m)),
          selected: new SymbolGlyphModifier(resolveHomeModeSymbol(m)),
        }, resolveHomeModeTitle(m)))
      }, (m: HomeMode) => m)
    }
    .vertical(false)
    .scrollable(false)
    .animationDuration(140)
    .barPosition(BarPosition.End)
    .barOverlap(true)
    .barHeight(BOTTOM_TAB_BAR_HEIGHT)
    .barFloatingStyle({
      barBottomMargin: 0,
      systemMaterialEffect: {
        materialType: hdsMaterial.MaterialType.ADAPTIVE,
        materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
      },
    })
    .enabled(!this.interactionLocked)
    .onChange((index: number) => {
      const mode = HOME_MODES[index]
      if (mode) { this.onModeChange(mode) }
    })
    .width('100%')
    .height(BOTTOM_TAB_BAR_HEIGHT)
    .hitTestBehavior(HitTestMode.Block)
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        this.ModeTabs()
      }
      .width('100%')
      .clip(true)
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