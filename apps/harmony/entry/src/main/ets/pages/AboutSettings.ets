import { AboutSettingsPanel } from '../common/components/SettingsSecondaryPanels'

@Entry
@Component
struct AboutSettings {
  build() {
    Column() {
      AboutSettingsPanel()
    }
    .width('100%')
    .height('100%')
  }
}
