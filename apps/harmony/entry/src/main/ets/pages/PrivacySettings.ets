import { PrivacySettingsPanel } from '../common/components/SettingsSecondaryPanels'

@Entry
@Component
struct PrivacySettings {
  build() {
    Column() {
      PrivacySettingsPanel()
    }
    .width('100%')
    .height('100%')
  }
}
