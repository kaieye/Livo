import { handleRootTabShellAppear } from '../common/utils/RootTabShellHelper'

@Entry
@Component
struct Subscriptions {
  aboutToAppear(): void {
    handleRootTabShellAppear('subscriptions')
  }

  build() {
    Column()
    .width('100%')
    .height('100%')
  }
}
