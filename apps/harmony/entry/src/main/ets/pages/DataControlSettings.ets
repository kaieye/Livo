import { RefreshLogSettingsPanel } from '../common/components/SettingsSecondaryPanels'

@Entry
@Component
struct DataControlSettings {
  build() {
    Column() {
      RefreshLogSettingsPanel()
    }
    .width('100%')
    .height('100%')
  }
}
