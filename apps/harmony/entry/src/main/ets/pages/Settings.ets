import { SettingsContent } from '../common/components/SettingsContent'
import { openRootTab } from '../common/navigation/AppRouter'

@Entry
@Component
struct Settings {
  aboutToAppear(): void {
    void openRootTab('settings', true)
  }

  build() {
    Stack() {
      SettingsContent({ showBottomTabs: true })
    }
    .width('100%')
    .height('100%')
  }
}
