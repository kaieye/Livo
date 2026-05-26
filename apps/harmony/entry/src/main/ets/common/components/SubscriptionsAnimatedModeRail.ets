import { SubscriptionMode } from '../config/HomeRootConfig'
import { SubscriptionsModeRail } from './SubscriptionsModeRail'

@Component
export struct SubscriptionsAnimatedModeRail {
  @StorageProp('subscriptionsRailDismissProgress') dismissProgress: number = 0
  @Prop mode: SubscriptionMode = 'articles'
  onModeChange: (mode: SubscriptionMode) => void = () => {}

  build() {
    Stack() {
      SubscriptionsModeRail({
        mode: this.mode,
        onModeChange: (mode: SubscriptionMode) => {
          this.onModeChange(mode)
        },
      })
      .width('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    }
    .width('100%')
    .translate({ y: -22 * this.dismissProgress })
    .opacity(Math.max(0, 1 - this.dismissProgress))
    .animation({ duration: 80, curve: Curve.EaseInOut })
  }
}
