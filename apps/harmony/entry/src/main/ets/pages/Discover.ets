import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
} from '@kit.UIDesignKit'
import { DiscoverContent } from '../common/components/DiscoverContent'
import { rootTabTitleBarStyle } from '../common/utils/IndexRootChrome'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct Discover {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      HdsNavigation() {
        DiscoverContent({
          inheritedTheme: this.theme,
        })
      }
      .mode(NavigationMode.Stack)
      .titleBar({
        padding: {
          start: LengthMetrics.vp(2),
          end: LengthMetrics.vp(2),
        },
        style: rootTabTitleBarStyle(),
        content: {
          title: { mainTitle: '发现' },
        },
        avoidLayoutSafeArea: true,
        enableComponentSafeArea: false,
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideBackButton(true)
      .hideTitleBar(this.discoverOverlayLevel > 0)
      .ignoreLayoutSafeArea(
        [LayoutSafeAreaType.SYSTEM],
        [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM],
      )
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut }).opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut }).opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut }).opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut }).opacity(0)
  }
}
