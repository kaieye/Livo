import { openRootTab } from '../common/navigation/AppRouter'

@Entry
@Component
struct Settings {
  aboutToAppear(): void {
    void openRootTab('settings', true)
  }

  build() {
    Column()
    .width('100%')
    .height('100%')
  }
}
