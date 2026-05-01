import { LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
import {
  ScrollEffectType,
  SystemMaterialParams,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import { RootTabId } from '../navigation/AppRouter'
import { HdsBottomTabId } from './HdsBottomTabConfig'
import { RootTabSymbolPair } from '../components/HomeRootConfig'

export function rootTitleFor(tabId: RootTabId): string {
  switch (tabId) {
    case 'discover':
      return '添加订阅'
    case 'subscriptions':
      return '订阅库'
    case 'settings':
      return '设置'
    default:
      return '今日推荐'
  }
}

export function rootScrollEffectType(): ScrollEffectType {
  return ScrollEffectType.IMMERSIVE_GRADIENT_BLUR
}

export function rootBlurEffectiveEndOffset(): LengthMetrics {
  return LengthMetrics.vp(30)
}

export function rootTransparentBackgroundColor(): ResourceColor {
  return '#00000000'
}

export function rootOriginalTitleBarBlurRadius(): number {
  return 28
}

export function rootScrollEffectTitleBarBlurRadius(): number {
  return 48
}

export function rootTitleBarMaskExtraHeight(): number {
  return 0
}

export function rootBlurStrategy(): BlurStrategy | undefined {
  return BlurStrategy.ENABLE
}

export function rootSystemMaterialEffect(): SystemMaterialParams | undefined {
  return {
    materialType: hdsMaterial.MaterialType.IMMERSIVE,
    materialLevel: hdsMaterial.MaterialLevel.EXQUISITE,
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
