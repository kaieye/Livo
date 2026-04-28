import { PrivacySettingsPanel } from '../common/components/SettingsSecondaryPanels'

@Entry
@Component
struct PrivacySettings {
  build() {
    Column() {
      PrivacySettingsPanel()
    }
    .width('100%')
    .height('100%')
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
