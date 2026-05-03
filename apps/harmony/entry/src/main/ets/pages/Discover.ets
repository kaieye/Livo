import { handleRootTabShellAppear } from '../common/utils/RootTabShellHelper'

@Entry
@Component
struct Discover {
  aboutToAppear(): void {
    handleRootTabShellAppear('discover')
  }

  build() {
    Column()
    .width('100%')
    .height('100%')
  }
}
