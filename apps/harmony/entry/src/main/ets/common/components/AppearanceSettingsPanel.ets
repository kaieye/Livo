import { SettingsStore } from '../services/SettingsStore'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings, ThemeAccent, ThemeMode } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  optimisticAppearancePalette,
  patchAppearanceSettings,
  THEME_ACCENT_OPTIONS,
  THEME_MODE_OPTIONS,
  themeAccentLabel,
  themeModeLabel,
} from '../utils/AppearanceSettingsResolver'
import { AppearanceMenuRow, AppearanceUnreadDotRow } from './AppearanceSettingRows'
import { PageHeader } from './PageHeader'
import { SettingsPanelDividerLine, SettingsPanelSheetHandle } from './SettingsPanelShared'

const PANEL_SECTION_SPACING: number = 2

@Component
export struct AppearanceSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @Prop showBackButton: boolean = true
  @Prop initialSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @Prop inheritedTheme: ThemePalette = ThemeService.currentPalette()
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onClose: () => void = () => {}
  private settingsMutationVersion: number = 0

  aboutToAppear(): void {
    this.applyResolvedState(this.initialSettings, this.inheritedTheme)
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    const loadVersion = this.settingsMutationVersion
    const saved = await SettingsStore.load()
    const palette = await ThemeService.resolvePalette(saved)
    if (loadVersion !== this.settingsMutationVersion) {
      return
    }
    this.applyResolvedState(saved, palette)
  }

  private applyResolvedState(settings: HarmonySettings, palette: ThemePalette): void {
    this.config = settings
    this.theme = palette
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.onSettingsChange(settings)
    this.onThemeChange(palette)
  }

  private syncSettings(next: HarmonySettings): void {
    const mutationVersion = this.settingsMutationVersion + 1
    this.settingsMutationVersion = mutationVersion
    this.applyResolvedState(next, optimisticAppearancePalette(next, this.theme))
    void ThemeService.resolvePalette(next).then((resolved: ThemePalette) => {
      if (mutationVersion !== this.settingsMutationVersion) {
        return
      }
      this.applyResolvedState(next, resolved)
    })
    void SettingsStore.save(next).then((saved: HarmonySettings) => {
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        if (mutationVersion !== this.settingsMutationVersion) {
          return
        }
        this.applyResolvedState(saved, palette)
      })
    }).catch((_error: Error) => {})
  }

  private applyThemeMode(value: string): void {
    this.syncSettings(patchAppearanceSettings(this.config, { themeMode: value as ThemeMode }))
  }

  private applyThemeAccent(value: string): void {
    this.syncSettings(patchAppearanceSettings(this.config, { themeAccent: value as ThemeAccent }))
  }

  private toggleShowUnreadDot(): void {
    const next = !this.config.showUnreadDot
    AppStorage.setOrCreate('showUnreadDot', next)
    this.syncSettings(patchAppearanceSettings(this.config, { showUnreadDot: next }))
  }

  @Builder
  private PanelHeader() {
    PageHeader({
      title: '外观',
      theme: this.theme,
      showBackButton: this.showBackButton,
      titleSize: 20,
      topPadding: 0,
      bottomPadding: 0,
      onBack: () => this.onClose(),
    })
      .width('100%')
  }

  @Builder
  private SettingsGroup() {
    Column({ space: 14 }) {
      Column() {
        AppearanceMenuRow({
          theme: this.theme,
          icon: $r('sys.symbol.circle_righthalf_inset_filled'),
          title: '主题模式',
          subtitle: '切换浅色、深色或跟随系统',
          hint: themeModeLabel(this.config.themeMode),
          options: THEME_MODE_OPTIONS,
          selectedValue: this.config.themeMode,
          iconDelay: 0,
          onSelect: (value: string) => this.applyThemeMode(value),
        })
        SettingsPanelDividerLine({ theme: this.theme })
        AppearanceMenuRow({
          theme: this.theme,
          icon: $r('sys.symbol.paintpalette_fill'),
          title: '主题色',
          subtitle: '统一强调色、选中态与操作按钮色彩',
          hint: themeAccentLabel(this.config.themeAccent),
          options: THEME_ACCENT_OPTIONS,
          selectedValue: this.config.themeAccent,
          iconDelay: 0.5,
          onSelect: (value: string) => this.applyThemeAccent(value),
        })
      }
      .width('100%')
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_LG)
      .border({ width: 0.8, color: this.theme.divider })
      .transition(livoMotion.enterSoft(40))

      Column() {
        AppearanceUnreadDotRow({
          theme: this.theme,
          checked: this.config.showUnreadDot,
          iconDelay: 2,
          onToggle: (_next: boolean) => this.toggleShowUnreadDot(),
        })
      }
      .width('100%')
      .backgroundColor(this.theme.surface)
      .borderRadius(CARD_RADIUS_LG)
      .border({ width: 0.8, color: this.theme.divider })
      .transition(livoMotion.enterSoft(60))
    }
    .width('100%')
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        if (!this.showBackButton) {
          SettingsPanelSheetHandle({ theme: this.theme })
        }
        this.PanelHeader()
        this.SettingsGroup()

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .alignItems(HorizontalAlign.Start)
      .padding({
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
        top: 0,
        bottom: 12,
      })
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
