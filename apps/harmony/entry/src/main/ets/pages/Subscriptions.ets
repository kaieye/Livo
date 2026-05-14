import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
} from '@kit.UIDesignKit'
import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { SubscriptionsModeRail } from '../common/components/SubscriptionsModeRail'
import { SubscriptionMode } from '../common/components/HomeRootConfig'
import { rootTabTitleBarStyle } from '../common/utils/IndexRootChrome'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct Subscriptions {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State mode: SubscriptionMode = 'articles'
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      HdsNavigation() {
        SubscriptionsContent({
          inheritedTheme: this.theme,
          mode: this.mode,
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
          title: { mainTitle: '订阅' },
        },
        avoidLayoutSafeArea: true,
        enableComponentSafeArea: false,
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideBackButton(true)
      .hideTitleBar(this.subscriptionsOverlayLevel > 0)
      .ignoreLayoutSafeArea(
        [LayoutSafeAreaType.SYSTEM],
        [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM],
      )
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)

      SubscriptionsModeRail({
        mode: this.mode,
        onModeChange: (mode: SubscriptionMode) => { this.handleModeChange(mode) },
      })
      .width('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  private handleModeChange(mode: SubscriptionMode): void {
    if (mode === this.mode) {
      return
    }
    this.mode = mode
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut }).opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut }).opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut }).opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut }).opacity(0)
  }
}
