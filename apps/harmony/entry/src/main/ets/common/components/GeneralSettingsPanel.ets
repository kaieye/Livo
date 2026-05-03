import { SymbolGlyphModifier } from '@kit.ArkUI'
import { AppPreferenceService } from '../services/AppPreferenceService'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  PANEL_HINT_SIZE,
  PANEL_ICON_SIZE,
  PANEL_ROW_MIN_HEIGHT,
  PANEL_ROW_PADDING_HORIZONTAL,
  PANEL_ROW_PADDING_VERTICAL,
  PANEL_ROW_TEXT_SPACING,
  PANEL_SECTION_SPACING,
  PANEL_SUBTITLE_SIZE,
  PANEL_TITLE_SIZE,
  SelectOption,
  SettingsPanelDividerLine,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

const REFRESH_INTERVAL_OPTIONS: string[] = ['15', '30', '60', '120']

interface SettingsChanges {
  language?: string
  refreshIntervalMinutes?: number
  searchAllHomeCategories?: boolean
}

const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

@Component
export struct GeneralSettingsPanel {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State saveHint: string = '通用设置将保存到本地'
  @State refreshIntervalSelection: string = `${DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes}`
  @Prop useInheritedState: boolean = false
  @Prop initialSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @Prop initialTheme: ThemePalette = ThemeService.currentPalette()
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  aboutToAppear(): void {
    if (this.useInheritedState) {
      this.config = this.initialSettings
      this.theme = this.initialTheme
      this.refreshIntervalSelection = `${this.config.refreshIntervalMinutes}`
      this.saveHint = '已加载通用配置'
      return
    }
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppPreferenceService.loadSettings()
    this.refreshIntervalSelection = `${this.config.refreshIntervalMinutes}`
    this.theme = await ThemeService.resolvePalette(this.config)
    this.saveHint = '已加载通用配置'
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    this.refreshIntervalSelection = `${next.refreshIntervalMinutes}`
    console.info(`[GeneralSettings] syncSettings -> refreshIntervalMinutes=${next.refreshIntervalMinutes}`)
    void AppPreferenceService.saveSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      this.refreshIntervalSelection = `${saved.refreshIntervalMinutes}`
      this.onSettingsChange(saved)
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
      })
      this.saveHint = '已保存通用配置'
      console.info(`[GeneralSettings] persistSettings saved -> refreshIntervalMinutes=${saved.refreshIntervalMinutes}`)
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
      console.error(`[GeneralSettings] persistSettings failed: ${error.message}`)
    })
  }

  private getRefreshIntervalOptions(): SelectOption[] {
    return REFRESH_INTERVAL_OPTIONS.map((minutes: string): SelectOption => ({
      label: `${minutes} 分钟`,
      value: minutes,
    }))
  }

  private copyWith(changes: SettingsChanges): HarmonySettings {
    return {
      autoRefresh: this.config.autoRefresh,
      aiSummaryEnabled: this.config.aiSummaryEnabled,
      aiSummaryAutoTrigger: this.config.aiSummaryAutoTrigger,
      aiTranslationEnabled: this.config.aiTranslationEnabled,
      aiTranslationLanguage: this.config.aiTranslationLanguage,
      aiTranslationAutoTrigger: this.config.aiTranslationAutoTrigger,
      imageProxyEnabled: this.config.imageProxyEnabled,
      searchAllHomeCategories: changes.searchAllHomeCategories ?? this.config.searchAllHomeCategories,
      refreshIntervalMinutes: changes.refreshIntervalMinutes ?? this.config.refreshIntervalMinutes,
      themeMode: this.config.themeMode,
      themeAccent: this.config.themeAccent,
      language: changes.language ?? this.config.language,
      remoteFeedUrl: this.config.remoteFeedUrl,
      showUnreadDot: this.config.showUnreadDot,
    }
  }

  private applyRefreshInterval(value: string): void {
    const minutes = Number(value)
    const normalizedMinutes = Number.isFinite(minutes) && minutes > 0
      ? Math.floor(minutes)
      : this.config.refreshIntervalMinutes
    console.info(`[GeneralSettings] applyRefreshInterval input=${value}, normalized=${normalizedMinutes}`)
    this.refreshIntervalSelection = `${normalizedMinutes}`
    this.syncSettings(this.copyWith({ refreshIntervalMinutes: normalizedMinutes }))
  }

  private applyLanguage(value: string): void {
    this.syncSettings(this.copyWith({ language: value }))
  }

  private applySearchAllHomeCategories(enabled: boolean): void {
    this.syncSettings(this.copyWith({ searchAllHomeCategories: enabled }))
  }

  private toggleSearchAllHomeCategories(): void {
    this.applySearchAllHomeCategories(!this.config.searchAllHomeCategories)
  }

  @Builder
  private SheetHandle() {
    SettingsPanelSheetHandle({ theme: this.theme })
  }

  @Builder
  private PanelHeader() {
    SettingsPanelTitle({ title: '通用', theme: this.theme })
  }

  @Builder
  private OptionMenu(
    options: SelectOption[],
    selectedValue: string,
    onSelect: (value: string) => void,
  ) {
    Menu() {
      ForEach(options, (option: SelectOption) => {
        MenuItem({
          content: option.label,
          symbolEndIcon: selectedValue === option.value ? new SymbolGlyphModifier($r('sys.symbol.checkmark')) : undefined,
        })
          .selected(selectedValue === option.value)
          .onChange((selected: boolean) => {
            if (selected && option.value !== selectedValue) {
              onSelect(option.value)
            }
          })
      }, (option: SelectOption) => option.value)
    }
  }

  @Builder
  private ActionLabel(label: string, options: SelectOption[], selectedValue: string,
    onSelect: (value: string) => void) {
    Row({ space: 6 }) {
      Text(label)
        .fontSize(PANEL_HINT_SIZE)
        .fontColor(this.theme.textSecondary)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
        .fontSize(11)
        .fontColor([this.theme.textMuted])
    }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.OptionMenu(options, selectedValue, onSelect))
  }

  @Builder
  private SettingActionRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    actionLabel: string,
    options: SelectOption[],
    selectedValue: string,
    onSelect: (value: string) => void,
    iconDelay: number = 0,
  ) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      this.ActionLabel(actionLabel, options, selectedValue, onSelect)
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private DividerLine() {
    SettingsPanelDividerLine({ theme: this.theme })
  }

  @Builder
  private RefreshIntervalMenuRow(iconDelay: number = 0) {
    Row({ space: 12 }) {
      SymbolGlyph($r('sys.symbol.arrow_clockwise'))
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text('刷新间隔')
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text('控制后台自动刷新频率')
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Row({ space: 6 }) {
        Text(`${this.refreshIntervalSelection} 分钟`)
          .fontSize(PANEL_HINT_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        SymbolGlyph($r('sys.symbol.arrowtriangle_down_fill'))
          .fontSize(11)
          .fontColor([this.theme.textMuted])
      }
      .padding({ left: 6, right: 6, top: 8, bottom: 8 })
      .bindMenu(this.OptionMenu(
        this.getRefreshIntervalOptions(),
        this.refreshIntervalSelection,
        (value: string) => {
          this.applyRefreshInterval(value)
        },
      ))
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
  }

  @Builder
  private ToggleRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    checked: boolean,
    onToggle: (nextChecked: boolean) => void,
    iconDelay: number = 0,
  ) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .onChange((isOn: boolean) => {
          onToggle(isOn)
        })
    }
    .width('100%')
    .constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: PANEL_ROW_PADDING_HORIZONTAL,
      right: PANEL_ROW_PADDING_HORIZONTAL,
      top: PANEL_ROW_PADDING_VERTICAL,
      bottom: PANEL_ROW_PADDING_VERTICAL,
    })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle(!checked))
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column() {
          this.SettingActionRow(
            $r('sys.symbol.translate'),
            '界面语言',
            '切换应用显示语言',
            this.config.language === 'en' ? 'English' : '简体中文',
            LANGUAGE_OPTIONS,
            this.config.language,
            (value: string) => this.applyLanguage(value),
            0,
          )
          this.DividerLine()
          this.RefreshIntervalMenuRow(1)
          this.DividerLine()
          this.ToggleRow(
            $r('sys.symbol.magnifyingglass_circle'),
            '跨栏目搜索',
            '开启后，搜索范围包含所有栏目',
            this.config.searchAllHomeCategories,
            (isOn: boolean) => this.applySearchAllHomeCategories(isOn),
            2,
          )
        }
        .width('100%')
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(40))

        Text(this.saveHint)
          .fontSize(12)
          .fontColor(this.theme.textMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .padding({ left: 6, right: 6, top: 6, bottom: 2 })

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
