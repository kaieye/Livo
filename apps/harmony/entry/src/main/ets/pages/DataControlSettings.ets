import { DataControlSettingsPanel } from '../common/components/SettingsSecondaryPanels'

@Entry
@Component
struct DataControlSettings {
  build() {
    Column() {
      DataControlSettingsPanel()
    }
    .width('100%')
    .height('100%')
  }
}
