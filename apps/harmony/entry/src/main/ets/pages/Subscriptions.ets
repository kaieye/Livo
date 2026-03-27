import { SubscriptionsContent } from '../common/components/SubscriptionsContent'
import { openRootTab } from '../common/navigation/AppRouter'

@Entry
@Component
struct Subscriptions {
  aboutToAppear(): void {
    void openRootTab('subscriptions', true)
  }

  build() {
    Stack() {
      SubscriptionsContent({ showBottomTabs: true })
    }
    .width('100%')
    .height('100%')
  }
}
