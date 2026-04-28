import { goBack } from '../common/navigation/AppRouter'
import { AppearanceSettingsPanel } from '../common/components/AppearanceSettingsPanel'

@Entry
@Component
struct AppearanceSettings {
  build() {
    Column() {
      AppearanceSettingsPanel({
        showBackButton: true,
        onClose: () => {
          void goBack()
        },
      })
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
