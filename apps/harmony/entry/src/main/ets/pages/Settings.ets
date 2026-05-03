import { handleRootTabShellAppear } from '../common/utils/RootTabShellHelper'

@Entry
@Component
struct Settings {
  aboutToAppear(): void {
    handleRootTabShellAppear('settings')
  }

  build() {
    Column()
    .width('100%')
    .height('100%')
  }
}
