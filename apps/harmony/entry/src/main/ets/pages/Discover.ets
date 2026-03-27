import { DiscoverContent } from '../common/components/DiscoverContent'
import { openRootTab } from '../common/navigation/AppRouter'

@Entry
@Component
struct Discover {
  aboutToAppear(): void {
    void openRootTab('discover', true)
  }

  build() {
    Stack() {
      DiscoverContent({ showBottomTabs: true })
    }
    .width('100%')
    .height('100%')
  }
}
