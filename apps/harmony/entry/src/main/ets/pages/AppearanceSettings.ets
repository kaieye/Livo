import { goBack } from '../common/navigation/AppRouter'
import { AppearanceSettingsPanel } from '../common/components/AppearanceSettingsPanel'

@Entry
@Component
struct AppearanceSettings {
  build() {
    Column() {
      AppearanceSettingsPanel({
        showBackButton: true,
        onClose: () => {
          void goBack()
        },
      })
    }
    .width('100%')
    .height('100%')
  }
}
