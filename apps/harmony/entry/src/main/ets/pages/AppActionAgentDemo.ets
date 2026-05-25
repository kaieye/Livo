import { router } from '@kit.ArkUI'
import { ThemeService, ThemePalette } from '../common/services/ThemeService'
import { AppActionPanel } from '../common/components/AppActionPanel'

@Entry
@Component
struct AppActionAgentDemo {
  @State theme: ThemePalette = ThemeService.lightPalette()

  aboutToAppear() {
    // 初始化主题
    ThemeService.default.resolvePalette({
      autoRefresh: true,
      aiSummaryEnabled: false,
      aiSummaryAutoTrigger: false,
      aiTranslationEnabled: false,
      aiTranslationLanguage: 'zh',
      aiTranslationAutoTrigger: false,
      imageProxyEnabled: true,
      searchAllHomeCategories: false,
      refreshIntervalMinutes: 15,
      themeMode: 'system',
      themeAccent: 'orange',
      language: 'zh',
      remoteFeedUrl: '',
      showUnreadDot: true,
    }).then(palette => {
      this.theme = palette
    })
  }

  build() {
    Column() {
      AppActionPanel({
        theme: this.theme,
        onClose: () => {
          router.back()
        }
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
