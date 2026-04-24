import { openRootTab } from '../common/navigation/AppRouter'

@Entry
@Component
struct Subscriptions {
  aboutToAppear(): void {
    void openRootTab('subscriptions', true)
  }

  build() {
    Column()
    .width('100%')
    .height('100%')
  }
}
