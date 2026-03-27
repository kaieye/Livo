import { goBack } from '../common/navigation/AppRouter'
import { GeneralSettingsPanel } from '../common/components/SettingsSecondaryPanels'

@Entry
@Component
struct GeneralSettings {
  build() {
    Column() {
      GeneralSettingsPanel()
    }
    .width('100%')
    .height('100%')
  }
}
