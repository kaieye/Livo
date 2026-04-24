import { openRootTab } from '../common/navigation/AppRouter'

@Entry
@Component
struct Discover {
  aboutToAppear(): void {
    void openRootTab('discover', true)
  }

  build() {
    Column()
    .width('100%')
    .height('100%')
  }
}
