import { AccountsSettingsPanel } from './AccountsSettingsPanel'
import { AIAssistantSettingsPanel } from './AIAssistantSettingsPanel'
import { AboutSettingsPanel } from './AboutSettingsPanel'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { FavoritesPanel } from './FavoritesPanel'
import { GeneralSettingsPanel } from './GeneralSettingsPanel'
import { PrivacySettingsPanel } from './PrivacySettingsPanel'
import { RefreshLogSettingsPanel } from './RefreshLogSettingsPanel'
import { SubscriptionsSettingsPanel } from './SubscriptionsSettingsPanel'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { SettingsSheetKey } from '../utils/SettingsCatalog'

@Component
export struct SettingsSheetRouter {
  @Prop activeSheet: SettingsSheetKey = ''
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onClose: () => void = () => {}

  build() {
    Column() {
      if (this.activeSheet === 'appearance') {
        AppearanceSettingsPanel({
          showBackButton: false,
          initialSettings: this.config,
          inheritedTheme: this.theme,
          onSettingsChange: (settings: HarmonySettings) => {
            this.onSettingsChange(settings)
          },
          onThemeChange: (theme: ThemePalette) => {
            this.onThemeChange(theme)
          },
          onClose: () => {
            this.onClose()
          },
        })
      } else if (this.activeSheet === 'general') {
        GeneralSettingsPanel({
          useInheritedState: true,
          initialSettings: this.config,
          initialTheme: this.theme,
          onSettingsChange: (settings: HarmonySettings) => {
            this.onSettingsChange(settings)
          },
        })
      } else if (this.activeSheet === 'refresh-log') {
        RefreshLogSettingsPanel({
          useInheritedTheme: true,
          inheritedTheme: this.theme,
          onSettingsChange: (settings: HarmonySettings) => {
            this.onSettingsChange(settings)
          },
        })
      } else if (this.activeSheet === 'privacy') {
        PrivacySettingsPanel({
          useInheritedTheme: true,
          inheritedTheme: this.theme,
        })
      } else if (this.activeSheet === 'about') {
        AboutSettingsPanel({
          useInheritedTheme: true,
          inheritedTheme: this.theme,
        })
      } else if (this.activeSheet === 'favorites') {
        FavoritesPanel()
      } else if (this.activeSheet === 'accounts') {
        AccountsSettingsPanel({
          inheritedTheme: this.theme,
        })
      } else if (this.activeSheet === 'ai-assistant') {
        AIAssistantSettingsPanel({
          onSettingsChange: (settings: HarmonySettings) => {
            this.onSettingsChange(settings)
          },
        })
      } else if (this.activeSheet === 'subscriptions') {
        SubscriptionsSettingsPanel({
          useInheritedTheme: true,
          inheritedTheme: this.theme,
        })
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
  }
}
