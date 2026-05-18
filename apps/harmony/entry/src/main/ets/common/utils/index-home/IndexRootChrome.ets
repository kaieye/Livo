import { LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
import {
  ScrollEffectType,
  TitleBarStyleOptions,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import { RootTabId } from '../../navigation/AppRouter'
import { HdsBottomTabId } from './HdsBottomTabConfig'
import { RootTabSymbolPair } from '../../components/HomeRootConfig'

export function rootTitleFor(tabId: RootTabId): string {
  switch (tabId) {
    case 'discover':
      return '发现'
    case 'subscriptions':
      return '订阅'
    case 'settings':
      return '设置'
    default:
      return '首页'
  }
}

/**
 * Shared titleBar style for root tab pages (subscriptions, discover, settings).
 * Provides immersive gradient blur, system material, and scroll-aware transition
 * from transparent (blurRadius=28) to fully blurred (blurRadius=48).
 */
export function rootTabTitleBarStyle(): TitleBarStyleOptions {
  return {
    scrollEffectOpts: {
      enableScrollEffect: true,
      scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR,
      blurEffectiveStartOffset: LengthMetrics.vp(0),
      blurEffectiveEndOffset: LengthMetrics.vp(30),
    },
    blurStrategy: BlurStrategy.ENABLE,
    systemMaterialEffect: {
      materialType: hdsMaterial.MaterialType.ADAPTIVE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
    },
    originalStyle: {
      backgroundStyle: {
        backgroundColor: '#00000000',
        maskExtraHeight: 0,
        blurRadius: 28,
      },
      contentStyle: {
        titleStyle: {
          mainTitleColor: $r('sys.color.font_primary'),
          subTitleColor: $r('sys.color.font_secondary'),
        },
        menuStyle: {
          backgroundColor: $r('sys.color.comp_background_tertiary'),
          iconColor: $r('sys.color.icon_primary'),
        },
        backIconStyle: {
          backgroundColor: $r('sys.color.comp_background_tertiary'),
          iconColor: $r('sys.color.icon_primary'),
        },
      },
    },
    scrollEffectStyle: {
      backgroundStyle: {
        backgroundColor: '#00000000',
        maskExtraHeight: 0,
        blurRadius: 48,
      },
      contentStyle: {
        titleStyle: {
          mainTitleColor: $r('sys.color.font_primary'),
          subTitleColor: $r('sys.color.font_secondary'),
        },
        menuStyle: {
          backgroundColor: $r('sys.color.comp_background_tertiary'),
          iconColor: $r('sys.color.icon_primary'),
        },
        backIconStyle: {
          backgroundColor: $r('sys.color.comp_background_tertiary'),
          iconColor: $r('sys.color.icon_primary'),
        },
      },
    },
  }
}

function bottomTabSymbol(symbol: Resource, colors: ResourceColor[]): SymbolGlyphModifier {
  return new SymbolGlyphModifier(symbol)
    .renderingStrategy(SymbolRenderingStrategy.MULTIPLE_COLOR)
    .fontColor(colors)
}

export function rootTabSymbolPair(tabId: HdsBottomTabId): RootTabSymbolPair {
  const normalColors: ResourceColor[] = [
    $r('sys.color.ohos_id_color_bottom_tab_icon_off'),
    $r('sys.color.ohos_id_color_bottom_tab_icon_auxcolor_off02'),
  ]
  const selectedColors: ResourceColor[] = [
    $r('sys.color.ohos_id_color_activated'),
    $r('sys.color.ohos_id_color_primary_contrary'),
  ]

  switch (tabId) {
    case 'subscriptions':
      return {
        normal: bottomTabSymbol($r('sys.symbol.folder_fill'), normalColors),
        selected: bottomTabSymbol($r('sys.symbol.folder_fill'), selectedColors),
      } as RootTabSymbolPair
    case 'discover':
      return {
        normal: bottomTabSymbol($r('sys.symbol.magnifyingglass'), normalColors),
        selected: bottomTabSymbol($r('sys.symbol.magnifyingglass'), selectedColors),
      } as RootTabSymbolPair
    case 'settings':
      return {
        normal: bottomTabSymbol($r('sys.symbol.gearshape'), normalColors),
        selected: bottomTabSymbol($r('sys.symbol.gearshape_fill'), selectedColors),
      } as RootTabSymbolPair
    default:
      return {
        normal: bottomTabSymbol($r('sys.symbol.house'), normalColors),
        selected: bottomTabSymbol($r('sys.symbol.house_fill'), selectedColors),
      } as RootTabSymbolPair
  }
}
